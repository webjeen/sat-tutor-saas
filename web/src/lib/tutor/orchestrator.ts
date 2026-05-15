import type {
  TutorJob,
  TutorJobResult,
  TutorJobStage,
} from "./types";
import type { WorksheetConfig, WorksheetAssemblyResult } from "../assembly/types";
import type { GenerationResult, BatchGenerationResult, GenerationJobConfig, BatchGenerationConfig } from "../generation/types";
import type { LibraryCategory } from "../library/types";
import { TUTOR_CONFIG } from "./config";
import { createTutorJob, transitionJobStatus, transitionJobStage, updateJob, getJob } from "./jobs";
import { acquireExportSlot, releaseExportSlot, checkJobConcurrency } from "./safety";
import {
  auditValidationFailed,
  auditValidationPassed,
  auditExportStarted,
  auditExportCompleted,
  auditExportFailed,
} from "./auditLog";
import { saveExportMetadata } from "./persistence";

// -- Lazy imports to avoid circular deps at module level --
// Generation, assembly, and export modules are heavy — import on demand.

async function runGeneration(config: WorksheetConfig): Promise<GenerationResult> {
  const { runGenerationPipeline } = await import("../generation/generationOrchestrator");
  return runGenerationPipeline({
    section: config.section,
    category: config.categories[0] as LibraryCategory,
    difficulty: config.difficultyMode === "mixed" || config.difficultyMode === "progressive" ? "medium" : config.difficultyMode,
    count: config.questionCount,
  });
}

async function runBatchGeneration(config: WorksheetConfig): Promise<BatchGenerationResult> {
  const { runBatchGenerationPipeline } = await import("../generation/batchOrchestrator");

  const categories = config.categories;
  const difficultyDist = config.difficultyDistribution ?? { easy: 30, medium: 40, hard: 30 };

  const requests: GenerationJobConfig[] = categories.map((cat) => ({
    section: config.section,
    category: cat as LibraryCategory,
    difficulty: "medium" as const,
    count: Math.ceil(config.questionCount / categories.length),
  }));

  const batchConfig: BatchGenerationConfig = {
    requests,
    diversityRules: {
      maxSameCategory: 5,
      difficultyDistribution: difficultyDist,
      requireCategorySpread: true,
      minCategorySpread: categories.length > 1 ? 2 : 1,
    },
    maxTotalQuestions: config.questionCount,
  };

  return runBatchGenerationPipeline(batchConfig);
}

async function runAssembly(config: WorksheetConfig): Promise<WorksheetAssemblyResult> {
  const { assembleWorksheet } = await import("../assembly/worksheetAssembler");
  return assembleWorksheet(config);
}

async function runExport(assembly: WorksheetAssemblyResult, profile: import("../assembly/types").OutputProfile) {
  const { submitExportJob } = await import("../pdf-layout/exportOrchestrator");
  return submitExportJob(assembly, profile, null);
}

// -- Main pipeline: create + run a full tutor job --

export async function createAndRunJob(config: WorksheetConfig): Promise<TutorJobResult> {
  // Concurrency check
  const concurrency = checkJobConcurrency();
  if (!concurrency.allowed) {
    return {
      jobId: "",
      status: "failed",
      stage: "intake",
      worksheetId: null,
      exportMetadata: null,
      validationSnapshot: null,
      errorMessage: `Job concurrency limit reached (${concurrency.activeCount}/${TUTOR_CONFIG.concurrency.maxConcurrentJobs})`,
    };
  }

  // Create job
  const { job, error: createError } = await createTutorJob({ config, type: "generation" });
  if (createError || !job) {
    return {
      jobId: "",
      status: "failed",
      stage: "intake",
      worksheetId: null,
      exportMetadata: null,
      validationSnapshot: null,
      errorMessage: createError ?? "Failed to create job",
    };
  }

  // Run pipeline
  return runPipeline(job);
}

// -- Run the pipeline for an existing job --

export async function runPipeline(job: TutorJob): Promise<TutorJobResult> {
  const jobId = job.id;

  // Move to processing
  await transitionJobStatus(jobId, "processing", "Pipeline started");

  // STEP 1: Generation
  await transitionJobStage(jobId, "generating");
  const genResult = await executeGenerationStep(job);
  if (!genResult.success) {
    await handleStepFailure(jobId, genResult);
    return buildResult(jobId, "failed", genResult.stage, genResult.error);
  }

  // STEP 2: Generation validation (captured in generation result)
  await transitionJobStage(jobId, "validating");
  const genValidation = captureGenerationValidation(genResult);
  if (!genValidation.allPassed) {
    auditValidationFailed(jobId, genValidation.failedChecks);
    if (genValidation.hardFail) {
      await transitionJobStatus(jobId, "failed", `Generation validation hard-fail: [${genValidation.failedChecks.join(", ")}]`);
      return buildResult(jobId, "failed", "validating", `Hard validation failure: [${genValidation.failedChecks.join(", ")}]`);
    }
    await transitionJobStatus(jobId, "review_required", `Generation validation borderline: [${genValidation.failedChecks.join(", ")}]`);
    return buildResult(jobId, "review_required", "validating", null);
  }
  auditValidationPassed(jobId, "generation");

  // STEP 3: Assembly
  await transitionJobStage(jobId, "assembling");
  const assemblyStep = await executeAssemblyStep(job);
  if (!assemblyStep.success || !assemblyStep.data) {
    await handleStepFailure(jobId, assemblyStep);
    return buildResult(jobId, "failed", assemblyStep.stage, assemblyStep.error);
  }

  // STEP 4: Assembly validation
  await transitionJobStage(jobId, "assembly_validation");
  const assemblyResult = assemblyStep.data;
  const wsValidation = assemblyResult.validation;
  await updateJob(jobId, { worksheetJobId: assemblyResult.worksheetId });

  if (!wsValidation.allPassed) {
    auditValidationFailed(jobId, wsValidation.failedChecks);
    await transitionJobStatus(jobId, "review_required", `Worksheet validation: [${wsValidation.failedChecks.join(", ")}]`);
    return buildResult(jobId, "review_required", "assembly_validation", null);
  }
  auditValidationPassed(jobId, "worksheet_assembly");

  // Move to draft (awaiting tutor approval)
  await transitionJobStatus(jobId, "draft", "Assembly passed — awaiting tutor approval");
  await transitionJobStage(jobId, "complete");

  return buildResult(jobId, "draft", "complete", null, {
    worksheetId: assemblyResult.worksheetId,
  });
}

// -- Export pipeline (called after approval) --

export async function runExportPipeline(jobId: string): Promise<TutorJobResult> {
  const job = await getJob(jobId);
  if (!job) {
    return buildResult(jobId, "failed", "rendering", "Job not found");
  }

  if (job.status !== "approved_for_export") {
    return buildResult(jobId, job.status, job.stage, "Job not approved for export");
  }

  // Acquire export slot
  const slot = acquireExportSlot(jobId);
  if (!slot.allowed) {
    return buildResult(jobId, job.status, job.stage, "Export concurrency limit reached");
  }

  try {
    // Re-assemble to get the assembly result
    await transitionJobStage(jobId, "layout_validation");
    const assemblyStep = await executeAssemblyStep(job);
    if (!assemblyStep.success || !assemblyStep.data) {
      await transitionJobStatus(jobId, "failed", `Re-assembly failed: ${assemblyStep.error}`);
      return buildResult(jobId, "failed", "layout_validation", assemblyStep.error);
    }
    const assemblyResult = assemblyStep.data;

    // Layout validation
    if (!assemblyResult.validation.allPassed) {
      auditValidationFailed(jobId, ["layout"]);
      await transitionJobStatus(jobId, "failed", "Layout validation failed");
      return buildResult(jobId, "failed", "layout_validation", "Layout validation failed");
    }

    // Export
    auditExportStarted(jobId, job.config.outputProfile);
    await transitionJobStage(jobId, "rendering");
    await transitionJobStatus(jobId, "exporting", "Export started");

    const profile = job.config.outputProfile;
    const exportResult = await runExport(assemblyResult, profile);

    if (exportResult.status === "failed") {
      auditExportFailed(jobId, exportResult.errorMessage ?? "Unknown export error");
      await transitionJobStatus(jobId, "failed", `Export failed: ${exportResult.errorMessage}`);
      return buildResult(jobId, "failed", "rendering", exportResult.errorMessage);
    }

    // Save export metadata
    const pdfSize = exportResult.pdfBuffer?.length ?? null;
    await saveExportMetadata({
      jobId,
      profile,
      pdfSizeBytes: pdfSize,
      pdfBuffer: exportResult.pdfBuffer,
      questionCount: job.config.questionCount,
      section: job.config.section,
      categories: job.config.categories,
      status: "success",
      errorMessage: null,
    });

    auditExportCompleted(jobId, pdfSize);
    await transitionJobStatus(jobId, "exported", "Export completed successfully");
    await transitionJobStage(jobId, "complete");

    return buildResult(jobId, "exported", "complete", null, {
      exportMetadata: {
        id: `export:${Date.now()}`,
        jobId,
        profile,
        pdfSizeBytes: pdfSize,
        pdfBuffer: exportResult.pdfBuffer,
        questionCount: job.config.questionCount,
        section: job.config.section,
        categories: job.config.categories,
        status: "success",
        errorMessage: null,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown export error";
    auditExportFailed(jobId, message);
    await transitionJobStatus(jobId, "failed", `Export error: ${message}`);
    return buildResult(jobId, "failed", "rendering", message);
  } finally {
    releaseExportSlot();
  }
}

// -- Step executors --

interface GenerationStepResult {
  success: boolean;
  stage: TutorJobStage;
  error: string | null;
  data?: GenerationResult | BatchGenerationResult;
}

interface AssemblyStepResult {
  success: boolean;
  stage: TutorJobStage;
  error: string | null;
  data?: WorksheetAssemblyResult;
}

async function executeGenerationStep(job: TutorJob): Promise<GenerationStepResult> {
  try {
    const config = job.config;

    // Use batch generation if multiple categories
    if (config.categories.length > 1) {
      const batchResult = await runBatchGeneration(config);
      if (batchResult.totalApproved === 0 && batchResult.totalGenerated === 0) {
        return { success: false, stage: "generating", error: "Batch generation produced no questions" };
      }
      await updateJob(job.id, { generationJobId: batchResult.batchId });
      return { success: true, stage: "generating", error: null, data: batchResult };
    }

    const genResult = await runGeneration(config);
    if (genResult.totalApproved === 0 && genResult.totalGenerated === 0) {
      return { success: false, stage: "generating", error: "Generation produced no approved questions" };
    }
    await updateJob(job.id, { generationJobId: genResult.jobId });
    return { success: true, stage: "generating", error: null, data: genResult };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation error";
    return { success: false, stage: "generating", error: message };
  }
}

async function executeAssemblyStep(job: TutorJob): Promise<AssemblyStepResult> {
  try {
    const assemblyResult = await runAssembly(job.config);
    return { success: true, stage: "assembling", error: null, data: assemblyResult };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Assembly error";
    return { success: false, stage: "assembling", error: message };
  }
}

// -- Validation capture --

function captureGenerationValidation(
  genResult: GenerationStepResult
): { allPassed: boolean; hardFail: boolean; failedChecks: string[] } {
  const result = genResult.data;

  if (!result) {
    return { allPassed: false, hardFail: true, failedChecks: ["no_results"] };
  }

  if ("jobResults" in result) {
    // BatchGenerationResult
    const batchResult = result as BatchGenerationResult;
    const allPassed = batchResult.totalApproved > 0 && batchResult.totalDiscarded === 0;
    const failedChecks: string[] = [];
    if (batchResult.totalReview > 0) failedChecks.push("review_required");
    if (batchResult.totalDiscarded > 0) failedChecks.push("discarded");
    return { allPassed, hardFail: batchResult.totalDiscarded > 0, failedChecks };
  }

  // GenerationResult
  const genRes = result as GenerationResult;
  if (!genRes.results) {
    return { allPassed: false, hardFail: true, failedChecks: ["no_results"] };
  }

  const allPassed = genRes.results.every((r) => r.validation?.allPassed);
  const failedChecks = genRes.results
    .filter((r) => !r.validation?.allPassed)
    .flatMap((r) => r.validation?.failedChecks ?? []);

  const hasDiscarded = genRes.results.some((r) => r.decision?.action === "discard");

  return { allPassed, hardFail: hasDiscarded, failedChecks: [...new Set(failedChecks)] };
}

// -- Failure handler --

async function handleStepFailure(jobId: string, step: GenerationStepResult | AssemblyStepResult): Promise<void> {
  const job = await getJob(jobId);
  if (!job) return;

  const retryExhausted = job.retryCount >= job.maxRetries;
  const reason = retryExhausted
    ? (step.error ?? "Step failed (retries exhausted)")
    : (step.error ?? "Step failed");

  await transitionJobStatus(jobId, "failed", reason);
  await updateJob(jobId, { errorMessage: step.error });
}

// -- Result builder --

function buildResult(
  jobId: string,
  status: TutorJobResult["status"],
  stage: TutorJobResult["stage"],
  errorMessage: string | null,
  extra?: { worksheetId?: string; exportMetadata?: TutorJobResult["exportMetadata"] }
): TutorJobResult {
  return {
    jobId,
    status,
    stage,
    worksheetId: extra?.worksheetId ?? null,
    exportMetadata: extra?.exportMetadata ?? null,
    validationSnapshot: null,
    errorMessage,
  };
}
