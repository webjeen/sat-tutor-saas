import { NextRequest, NextResponse } from "next/server";
import { getReviewQueue, submitReview } from "@/lib/tutor/review";
import type { ReviewDecision } from "@/lib/tutor/types";

// GET /api/tutor/review — Fetch review queue
export async function GET() {
  const queue = await getReviewQueue();
  return NextResponse.json({ queue });
}

// POST /api/tutor/review — Submit a review decision
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { jobId, decision, notes, reviewerId } = body as {
    jobId?: string;
    decision?: string;
    notes?: string;
    reviewerId?: string;
  };

  if (!jobId || !decision) {
    return NextResponse.json({ error: "Missing required fields: jobId, decision" }, { status: 400 });
  }

  const validDecisions: ReviewDecision[] = ["approve", "reject", "retry"];
  if (!validDecisions.includes(decision as ReviewDecision)) {
    return NextResponse.json({ error: `decision must be one of: ${validDecisions.join(", ")}` }, { status: 400 });
  }

  const result = await submitReview(
    jobId,
    decision as ReviewDecision,
    notes ?? "",
    reviewerId ?? null
  );

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  // If approved, trigger export pipeline
  if (decision === "approve") {
    const { runExportPipeline } = await import("@/lib/tutor/orchestrator");
    const exportResult = await runExportPipeline(jobId);

    return NextResponse.json({
      jobId,
      newStatus: result.newStatus,
      exportStatus: exportResult.status,
      exportStage: exportResult.stage,
      errorMessage: exportResult.errorMessage,
    }, { status: exportResult.status === "exported" ? 200 : 202 });
  }

  return NextResponse.json({
    jobId,
    newStatus: result.newStatus,
  });
}
