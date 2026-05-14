import { NextRequest, NextResponse } from "next/server";
import { fetchPatternById, updatePatternStatus } from "@/lib/supabase/fetchPatterns";
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

  // Fetch current status to validate transition
  const { data: pattern, error: fetchError } = await fetchPatternById(id);
  if (fetchError || !pattern) {
    return NextResponse.json(
      { error: fetchError || "Pattern not found" },
      { status: 404 }
    );
  }

  const currentStatus = pattern.status;
  const allowedTargets = VALID_TRANSITIONS[currentStatus];

  if (!allowedTargets) {
    return NextResponse.json(
      { error: `No transitions allowed from status "${currentStatus}"` },
      { status: 400 }
    );
  }

  if (!allowedTargets.includes(newStatus)) {
    return NextResponse.json(
      {
        error: `Invalid transition: "${currentStatus}" → "${newStatus}". Allowed: [${allowedTargets.join(", ")}]`,
        currentStatus,
        allowedTargets,
      },
      { status: 400 }
    );
  }

  const { success, error } = await updatePatternStatus(id, newStatus, reason);

  if (!success) {
    return NextResponse.json({ error }, { status: 500 });
  }

  // Log the admin action
  await saveExtractionLog({
    source_question_id: pattern.source_question_id || "",
    pattern_id: id,
    section: pattern.section,
    extraction_stage: "complete",
    status: "success",
    decision: "approve",
    decision_reason: `Admin status change: ${currentStatus} → ${newStatus}${reason ? ": " + reason : ""}`,
    validation_results: { previous_status: currentStatus, new_status: newStatus },
    error_message: null,
    retry_count: 0,
    extraction_duration_ms: null,
    fingerprint_text: null,
    fingerprint_structure: null,
  });

  return NextResponse.json({
    success: true,
    patternId: id,
    previousStatus: currentStatus,
    newStatus,
  });
}
