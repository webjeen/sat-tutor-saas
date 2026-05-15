import type {
  WorksheetAssemblyResult,
  OutputProfile,
} from "../assembly/types";
import type {
  ExportJob,
  ExportResult,
  LayoutValidationResult,
} from "./types";
import { EXPORT_CONFIG } from "./config";
import { validateLayoutForExport } from "./layoutValidator";
import { buildRenderDocument } from "./outputProfiles";
import { renderPdf } from "./pdfRenderer";

// -- Export orchestration layer --
// From output-design.md §9-10 + agent-loop-orchestration.md

const exportJobs = new Map<string, ExportJob>();

export async function submitExportJob(
  assembly: WorksheetAssemblyResult,
  profile: OutputProfile,
  studentName: string | null
): Promise<ExportResult> {
  const job = createExportJob(assembly, profile, studentName);
  exportJobs.set(job.id, job);

  return runExportPipeline(job);
}

export function getExportJob(jobId: string): ExportJob | undefined {
  return exportJobs.get(jobId);
}

async function runExportPipeline(job: ExportJob): Promise<ExportResult> {
  let currentJob = { ...job };

  while (currentJob.retryCount <= currentJob.maxRetries) {
    try {
      // Stage 1: Validate
      currentJob = updateJob(currentJob, { status: "validating" });
      const validation = runValidation(currentJob);

      if (!validation.passed) {
        currentJob = updateJob(currentJob, {
          status: "failed",
          validation,
          errorMessage: `Layout validation failed: ${validation.blockedReasons.join("; ")}`,
        });
        return toExportResult(currentJob);
      }

      currentJob = updateJob(currentJob, { validation });

      // Stage 2: Build render document
      const renderDoc = buildRenderDocument(
        currentJob.assemblyResult,
        currentJob.assemblyResult.config.studentName ?? null
      );
      currentJob = updateJob(currentJob, {
        status: "rendering",
        renderDocument: renderDoc,
      });

      // Stage 3: Render PDF
      const pdfBuffer = await renderPdf(renderDoc);
      currentJob = updateJob(currentJob, {
        status: "success",
        pdfBuffer,
      });

      return toExportResult(currentJob);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown render error";
      currentJob = updateJob(currentJob, {
        retryCount: currentJob.retryCount + 1,
        errorMessage,
      });

      if (currentJob.retryCount > currentJob.maxRetries) {
        currentJob = updateJob(currentJob, { status: "failed" });
        return toExportResult(currentJob);
      }
    }
  }

  currentJob = updateJob(currentJob, { status: "failed" });
  return toExportResult(currentJob);
}

function runValidation(job: ExportJob): LayoutValidationResult {
  const { studentWorksheet, answerKey, explanationPack } = job.assemblyResult;

  const result = validateLayoutForExport(studentWorksheet, answerKey, explanationPack);

  // Log validation issues
  if (result.issues.length > 0) {
    logExportEvent(job.id, "layout_validation", result.issues.map((i) => i.message).join("; "));
  }

  return result;
}

function createExportJob(
  assembly: WorksheetAssemblyResult,
  profile: OutputProfile,
  _studentName: string | null
): ExportJob {
  const now = new Date().toISOString();
  return {
    id: `export:${Date.now()}:${Math.random().toString(36).substring(2, 8)}`,
    assemblyResult: assembly,
    profile,
    status: "pending",
    renderDocument: null,
    pdfBuffer: null,
    validation: null,
    retryCount: 0,
    maxRetries: EXPORT_CONFIG.maxRetries,
    errorMessage: null,
    createdAt: now,
    updatedAt: now,
  };
}

function updateJob(
  job: ExportJob,
  updates: Partial<ExportJob>
): ExportJob {
  const updated = {
    ...job,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  exportJobs.set(updated.id, updated);
  return updated;
}

function toExportResult(job: ExportJob): ExportResult {
  return {
    jobId: job.id,
    status: job.status,
    pdfBuffer: job.pdfBuffer,
    validation: job.validation,
    errorMessage: job.errorMessage,
  };
}

// -- Export event logging (in-memory, for audit) --

const exportLogs: { jobId: string; event: string; detail: string; timestamp: string }[] = [];

function logExportEvent(jobId: string, event: string, detail: string): void {
  exportLogs.push({
    jobId,
    event,
    detail,
    timestamp: new Date().toISOString(),
  });
}

export function getExportLogs(): typeof exportLogs {
  return [...exportLogs];
}
