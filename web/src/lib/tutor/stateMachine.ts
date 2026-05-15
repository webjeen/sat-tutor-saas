import type { TutorJobStatus, StateTransition, TransitionResult } from "./types";

// -- Valid state transitions --
// From agent-loop-orchestration.md + output-design.md state model

const VALID_TRANSITIONS: Record<TutorJobStatus, TutorJobStatus[]> = {
  pending: ["processing"],
  processing: ["draft", "review_required", "failed"],
  draft: ["approved_for_export", "review_required", "failed"],
  review_required: ["approved_for_export", "rejected", "processing"],
  approved_for_export: ["exporting", "failed"],
  exporting: ["exported", "failed"],
  exported: [],
  failed: ["processing"], // retry
  rejected: [],
};

export function canTransition(from: TutorJobStatus, to: TutorJobStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function validateTransition(from: TutorJobStatus, to: TutorJobStatus): TransitionResult {
  if (from === to) {
    return { allowed: false, reason: "Same-status transition is a no-op", newStatus: from };
  }

  if (canTransition(from, to)) {
    return { allowed: true, reason: "Valid transition", newStatus: to };
  }

  return {
    allowed: false,
    reason: `Invalid transition: ${from} → ${to}. Allowed from '${from}': [${VALID_TRANSITIONS[from]?.join(", ") ?? "none"}]`,
    newStatus: from,
  };
}

export function createTransition(from: TutorJobStatus, to: TutorJobStatus, reason: string): StateTransition | null {
  if (!canTransition(from, to)) return null;
  return { from, to, reason, timestamp: new Date().toISOString() };
}

export function isTerminalStatus(status: TutorJobStatus): boolean {
  return status === "exported" || status === "rejected";
}

export function isActiveStatus(status: TutorJobStatus): boolean {
  return !isTerminalStatus(status) && status !== "failed";
}

export function canRetry(status: TutorJobStatus): boolean {
  return status === "failed";
}

export function requiresReview(status: TutorJobStatus): boolean {
  return status === "review_required";
}

export function isExportable(status: TutorJobStatus): boolean {
  return status === "approved_for_export" || status === "exporting";
}
