import { NextRequest, NextResponse } from "next/server";
import { updatePatternStatus } from "@/lib/supabase/fetchPatterns";
import { saveExtractionLog } from "@/lib/supabase/saveExtractionLog";

const VALID_TRANSITIONS: Record<string, string[]> = {
  pattern_candidate: ["pattern_approved", "pattern_review_required", "pattern_rejected"],
  pattern_review_required: ["pattern_approved", "pattern_rejected"],
  pattern_approved: ["pattern_active", "pattern_deprecated"],
  pattern_active: ["pattern_deprecated"],
  pattern_deprecated: [],
  pattern_rejected: [],
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let body: { status?: string; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const newStatus = body.status;
  const reason = body.reason || "";

  if (!newStatus) {
    return NextResponse.json(
      { error: "Missing required field: status" },
      { status: 400 }
    );
  }

  // Validate transition (we'd need to fetch current status for full validation)
  // For Phase 1, we do a basic check
  const validTargets = VALID_TRANSITIONS[newStatus];
  if (validTargets === undefined) {
    return NextResponse.json(
      { error: `Invalid target status: ${newStatus}` },
      { status: 400 }
    );
  }

  const { success, error } = await updatePatternStatus(id, newStatus, reason);

  if (!success) {
    return NextResponse.json({ error }, { status: 500 });
  }

  // Log the admin action
  await saveExtractionLog({
    source_question_id: "",
    pattern_id: id,
    section: "RW", // placeholder, log doesn't need it for status changes
    extraction_stage: "complete",
    status: "success",
    decision: "approve",
    decision_reason: `Admin status change to ${newStatus}${reason ? ": " + reason : ""}`,
    validation_results: {},
    error_message: null,
    retry_count: 0,
    extraction_duration_ms: null,
    fingerprint_text: null,
    fingerprint_structure: null,
  });

  return NextResponse.json({ success: true, patternId: id, newStatus });
}
