import type {
  GenerationValidationResult,
  DecisionResult,
  GenerationDecision,
  EscalationLevel,
  EscalationEvent,
  EscalationDecision,
} from "./types";
import { GENERATION_CONFIG } from "./config";

const MAX_REGENERATE_RETRIES = 3;
const MAX_REVIEW_ESCALATIONS = 2;
const BORDERLINE_THRESHOLD = 0.70;

export function applyEscalationPolicy(
  validation: GenerationValidationResult,
  baseDecision: DecisionResult,
  retryCount: number,
  escalationHistory: EscalationEvent[]
): EscalationDecision {
  const currentLevel = inferEscalationLevel(baseDecision.action);
  const reviewChecks = collectReviewChecks(validation);

  // Rule 1: Leak/anti-leak → immediate reject (no escalation)
  if (validation.leakage.result === "fail" || validation.antiLeakSafeguard.result === "fail") {
    const event = createEvent(
      null, currentLevel, "reject",
      `Leakage detected — mandatory rejection, no escalation`,
      retryCount
    );
    return {
      action: "discard",
      escalationLevel: "reject",
      reason: event.reason,
      escalationHistory: [...escalationHistory, event],
    };
  }

  // Rule 2: Max retries exhausted → escalate from regenerate to review
  if (retryCount >= MAX_REGENERATE_RETRIES && baseDecision.action === "regenerate") {
    const event = createEvent(
      null, "regenerate", "review",
      `Max regenerate retries (${MAX_REGENERATE_RETRIES}) exhausted — escalating to review`,
      retryCount
    );
    return {
      action: "review",
      escalationLevel: "review",
      reason: event.reason,
      escalationHistory: [...escalationHistory, event],
    };
  }

  // Rule 3: Multiple review checks → escalate review to reject if already escalated too many times
  const reviewEscalationCount = escalationHistory.filter(
    (e) => e.toLevel === "review"
  ).length;

  if (reviewEscalationCount >= MAX_REVIEW_ESCALATIONS && baseDecision.action === "review") {
    const event = createEvent(
      null, "review", "reject",
      `Max review escalations (${MAX_REVIEW_ESCALATIONS}) reached — escalating to reject`,
      retryCount
    );
    return {
      action: "discard",
      escalationLevel: "reject",
      reason: event.reason,
      escalationHistory: [...escalationHistory, event],
    };
  }

  // Rule 4: Borderline checks — route to review with reason code
  const borderlineChecks = reviewChecks.filter(
    (check) => isBorderline(check, validation)
  );

  if (borderlineChecks.length > 0 && baseDecision.action === "regenerate") {
    const reason = `Borderline checks detected: [${borderlineChecks.join(", ")}]. Routing to review instead of regenerate.`;
    const event = createEvent(null, "regenerate", "review", reason, retryCount);
    return {
      action: "review",
      escalationLevel: "review",
      reason,
      escalationHistory: [...escalationHistory, event],
    };
  }

  // Rule 5: Structural clone fail → mandatory review (not reject, since it's not a leak)
  if (validation.structuralClone.result === "fail") {
    const reason = `Structural clone detected (score: ${validation.structuralClone.maxCombinedScore}) — routing to review`;
    const event = createEvent(null, currentLevel, "review", reason, retryCount);
    return {
      action: "review",
      escalationLevel: "review",
      reason,
      escalationHistory: [...escalationHistory, event],
    };
  }

  // Rule 6: Default — keep base decision
  return {
    action: baseDecision.action,
    escalationLevel: currentLevel,
    reason: baseDecision.reason,
    escalationHistory,
  };
}

function inferEscalationLevel(action: GenerationDecision): EscalationLevel {
  switch (action) {
    case "approve":
      return "regenerate";
    case "regenerate":
      return "regenerate";
    case "review":
      return "review";
    case "discard":
      return "reject";
  }
}

function collectReviewChecks(validation: GenerationValidationResult): string[] {
  const review: string[] = [];
  if (validation.structure.result === "review") review.push("structure");
  if (validation.leakage.result === "review") review.push("leakage");
  if (validation.difficulty.result === "review") review.push("difficulty");
  if (validation.distractor.result === "review") review.push("distractor");
  if (validation.dedup.result === "review") review.push("dedup");
  if (validation.explanationCoherence.result === "review") review.push("explanation_coherence");
  if (validation.satStyle.result === "review") review.push("sat_style");
  if (validation.antiLeakSafeguard.result === "review") review.push("anti_leak_safeguard");
  if (validation.generationScore.result === "review") review.push("generation_score");
  if (validation.structuralClone.result === "review") review.push("structural_clone");
  return review;
}

function isBorderline(
  checkName: string,
  validation: GenerationValidationResult
): boolean {
  switch (checkName) {
    case "leakage":
      return validation.leakage.maxSimilarity >= BORDERLINE_THRESHOLD
        && validation.leakage.maxSimilarity < GENERATION_CONFIG.thresholds.leakFail;
    case "dedup":
      return Math.max(validation.dedup.maxRealSimilarity, validation.dedup.maxGeneratedSimilarity) >= BORDERLINE_THRESHOLD
        && Math.max(validation.dedup.maxRealSimilarity, validation.dedup.maxGeneratedSimilarity) < GENERATION_CONFIG.thresholds.dedupDuplicate;
    case "structural_clone":
      return validation.structuralClone.maxCombinedScore >= BORDERLINE_THRESHOLD
        && validation.structuralClone.maxCombinedScore < 0.85;
    case "anti_leak_safeguard":
      return validation.antiLeakSafeguard.warningViolations > 0
        && validation.antiLeakSafeguard.criticalViolations === 0;
    default:
      return false;
  }
}

function createEvent(
  questionId: string | null,
  fromLevel: EscalationLevel,
  toLevel: EscalationLevel,
  reason: string,
  retryCount: number
): EscalationEvent {
  return {
    questionId,
    fromLevel,
    toLevel,
    reason,
    retryCount,
    timestamp: new Date().toISOString(),
  };
}
