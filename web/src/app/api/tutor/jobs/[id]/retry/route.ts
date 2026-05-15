import { NextRequest, NextResponse } from "next/server";
import { retryJob } from "@/lib/tutor/jobs";

// POST /api/tutor/jobs/[id]/retry — Retry a failed job
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { job, error } = await retryJob(id);

  if (error || !job) {
    return NextResponse.json({ error: error ?? "Job not found" }, { status: error?.includes("not retryable") ? 409 : 404 });
  }

  // Re-run the pipeline after retry
  const { runPipeline } = await import("@/lib/tutor/orchestrator");
  const result = await runPipeline(job);

  return NextResponse.json({
    jobId: result.jobId,
    status: result.status,
    stage: result.stage,
    worksheetId: result.worksheetId,
    errorMessage: result.errorMessage,
  });
}
