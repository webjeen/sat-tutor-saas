import { NextRequest, NextResponse } from "next/server";
import { createAndRunJob } from "@/lib/tutor/orchestrator";
import { listJobs } from "@/lib/tutor/jobs";
import type { WorksheetConfig, OutputProfile, DifficultyMode, Purpose } from "@/lib/assembly/types";
import { ASSEMBLY_CONFIG } from "@/lib/assembly/config";

// POST /api/tutor/jobs — Create and run a new tutor job
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validationError = validateJobRequest(body);
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
    difficultyMode: (body.difficultyMode as DifficultyMode) || "mixed",
    difficultyDistribution: body.difficultyDistribution as { easy: number; medium: number; hard: number } | undefined,
    purpose: (body.purpose as Purpose) || "homework",
    outputProfile: (body.outputProfile as OutputProfile) || "homework_with_key",
    timeConstraintMinutes: body.timeConstraintMinutes as number | undefined,
    studentName: body.studentName as string | undefined,
  };

  const result = await createAndRunJob(config);

  if (result.status === "failed") {
    return NextResponse.json({
      error: result.errorMessage,
      jobId: result.jobId,
      status: result.status,
      stage: result.stage,
    }, { status: 500 });
  }

  return NextResponse.json({
    jobId: result.jobId,
    status: result.status,
    stage: result.stage,
    worksheetId: result.worksheetId,
    errorMessage: result.errorMessage,
  }, { status: result.status === "draft" ? 201 : 202 });
}

// GET /api/tutor/jobs — List tutor jobs
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") as WorksheetConfig["section"] | null;
  const type = searchParams.get("type") as string | null;
  const limit = parseInt(searchParams.get("limit") ?? "20", 10);

  const jobs = await listJobs({
    status: status as import("@/lib/tutor/types").TutorJobStatus | undefined,
    type: type as import("@/lib/tutor/types").TutorJobType | undefined,
    limit: Math.min(limit, 100),
  });

  return NextResponse.json({ jobs });
}

function validateJobRequest(body: Record<string, unknown>): string | null {
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
