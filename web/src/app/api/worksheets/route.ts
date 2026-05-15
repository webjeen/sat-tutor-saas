import { NextRequest, NextResponse } from "next/server";
import { assembleWorksheet, isReadyForExport } from "@/lib/assembly/worksheetAssembler";
import { saveWorksheetJob, updateWorksheetJob } from "@/lib/supabase/saveWorksheetJob";
import type { WorksheetConfig } from "@/lib/assembly/types";
import { ASSEMBLY_CONFIG } from "@/lib/assembly/config";

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validationError = validateRequestBody(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const config: WorksheetConfig = {
    title: (body.title as string) || "SAT Practice Worksheet",
    section: body.section as "RW" | "Math",
    categories: body.categories as string[],
    questionCount: Math.min(
      Math.max((body.questionCount as number) || ASSEMBLY_CONFIG.limits.defaultQuestionCount, ASSEMBLY_CONFIG.limits.minQuestionsPerWorksheet),
      ASSEMBLY_CONFIG.limits.maxQuestionsPerWorksheet
    ),
    difficultyMode: (body.difficultyMode as WorksheetConfig["difficultyMode"]) || "mixed",
    difficultyDistribution: body.difficultyDistribution as { easy: number; medium: number; hard: number } | undefined,
    purpose: (body.purpose as WorksheetConfig["purpose"]) || "homework",
    outputProfile: (body.outputProfile as WorksheetConfig["outputProfile"]) || "homework_with_key",
    timeConstraintMinutes: body.timeConstraintMinutes as number | undefined,
    studentName: body.studentName as string | undefined,
  };

  // Create worksheet job
  const { id: jobId, error: jobError } = await saveWorksheetJob({
    title: config.title,
    section: config.section,
    categories: config.categories,
    question_count: config.questionCount,
    difficulty_mode: config.difficultyMode,
    purpose: config.purpose,
    output_profile: config.outputProfile,
    status: "assembling",
    processing_stage: "assembly_started",
    validation_result: null,
    error_message: null,
    retry_count: 0,
    last_processed_at: new Date().toISOString(),
  });

  if (jobError || !jobId) {
    return NextResponse.json({ error: `Failed to create worksheet job: ${jobError}` }, { status: 500 });
  }

  try {
    const result = await assembleWorksheet(config);

    const readyForExport = isReadyForExport(result);
    const status = readyForExport ? "ready_for_export" : "validation_failed";

    await updateWorksheetJob(jobId, {
      status,
      processing_stage: "assembly_complete",
      validation_result: result.validation as unknown as Record<string, unknown>,
      error_message: readyForExport ? null : `Validation failed: [${result.validation.failedChecks.join(", ")}]`,
      last_processed_at: new Date().toISOString(),
    });

    return NextResponse.json({
      worksheetId: result.worksheetId,
      jobId,
      readyForExport,
      validation: result.validation,
      metadata: result.metadata,
      studentWorksheet: result.studentWorksheet,
      answerKey: result.answerKey,
      explanationPack: result.explanationPack,
    }, { status: readyForExport ? 201 : 422 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Assembly failed";
    await updateWorksheetJob(jobId, {
      status: "failed",
      processing_stage: "assembly_failed",
      error_message: message,
      last_processed_at: new Date().toISOString(),
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function validateRequestBody(body: Record<string, unknown>): string | null {
  if (!body.section || !["RW", "Math"].includes(body.section as string)) {
    return "Invalid or missing section (must be RW or Math)";
  }

  if (!Array.isArray(body.categories) || (body.categories as string[]).length === 0) {
    return "categories must be a non-empty array of skill categories";
  }

  const count = body.questionCount as number;
  if (count !== undefined && (count < ASSEMBLY_CONFIG.limits.minQuestionsPerWorksheet || count > ASSEMBLY_CONFIG.limits.maxQuestionsPerWorksheet)) {
    return `questionCount must be between ${ASSEMBLY_CONFIG.limits.minQuestionsPerWorksheet} and ${ASSEMBLY_CONFIG.limits.maxQuestionsPerWorksheet}`;
  }

  const validModes = ["easy", "medium", "hard", "mixed", "progressive"];
  if (body.difficultyMode && !validModes.includes(body.difficultyMode as string)) {
    return `difficultyMode must be one of: ${validModes.join(", ")}`;
  }

  const validProfiles = ["student_clean", "homework_with_key", "full_review_pack", "tutor_compact", "test_mode"];
  if (body.outputProfile && !validProfiles.includes(body.outputProfile as string)) {
    return `outputProfile must be one of: ${validProfiles.join(", ")}`;
  }

  return null;
}
