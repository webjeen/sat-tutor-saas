import type { GenerationValidationResult, DecisionResult } from "./types";
import { GENERATION_CONFIG } from "./config";

export function decideGenerationAction(
  validation: GenerationValidationResult,
  retryCount: number,
  availableTemplateIds: string[],
  currentTemplateId: string | null
): DecisionResult {
  // Priority 1: Leak/anti-leak → discard
  if (validation.leakage.result === "fail") {
    return {
      action: "discard",
      reason: `Leakage detected: similarity ${validation.leakage.maxSimilarity} exceeds threshold ${GENERATION_CONFIG.thresholds.leakFail}`,
      failedChecks: ["leakage"],
      retryCount,
      suggestedTemplateId: null,
    };
  }

  if (validation.antiLeakSafeguard.result === "fail") {
    return {
      action: "discard",
      reason: `Anti-leak safeguard failed: ngram=${validation.antiLeakSafeguard.ngramOverlapScore}, structural=${validation.antiLeakSafeguard.structuralLeakageScore}, passage=${validation.antiLeakSafeguard.passageLeakageScore}, criticalViolations=${validation.antiLeakSafeguard.criticalViolations}`,
      failedChecks: ["anti_leak_safeguard"],
      retryCount,
      suggestedTemplateId: null,
    };
  }

  // Priority 2: Collect failed and review checks
  const failedChecks: string[] = [];
  const reviewChecks: string[] = [];

  if (validation.structure.result === "fail") failedChecks.push("structure");
  if (validation.structure.result === "review") reviewChecks.push("structure");

  if (validation.difficulty.result === "fail") failedChecks.push("difficulty");
  if (validation.difficulty.result === "review") reviewChecks.push("difficulty");

  if (validation.distractor.result === "fail") failedChecks.push("distractor");
  if (validation.distractor.result === "review") reviewChecks.push("distractor");

  if (validation.dedup.result === "fail") failedChecks.push("dedup");

  if (validation.explanationCoherence.result === "fail") failedChecks.push("explanation_coherence");
  if (validation.explanationCoherence.result === "review") reviewChecks.push("explanation_coherence");

  if (validation.satStyle.result === "fail") failedChecks.push("sat_style");
  if (validation.satStyle.result === "review") reviewChecks.push("sat_style");

  if (validation.generationScore.result === "fail") failedChecks.push("generation_score");
  if (validation.generationScore.result === "review") reviewChecks.push("generation_score");

  if (validation.structuralClone.result === "fail") failedChecks.push("structural_clone");
  if (validation.structuralClone.result === "review") reviewChecks.push("structural_clone");

  if (validation.antiLeakSafeguard.result === "review") reviewChecks.push("anti_leak_safeguard");

  if (validation.leakage.result === "review") reviewChecks.push("leakage");

  // Priority 3: Max retries → review
  if (retryCount >= GENERATION_CONFIG.pipeline.maxRetriesPerQuestion) {
    return {
      action: "review",
      reason: `Max retries (${GENERATION_CONFIG.pipeline.maxRetriesPerQuestion}) reached. Failed: [${failedChecks.join(", ")}]. Review: [${reviewChecks.join(", ")}]`,
      failedChecks: [...failedChecks, ...reviewChecks],
      retryCount,
      suggestedTemplateId: null,
    };
  }

  // Priority 4: Failed checks → regenerate with template rotation
  if (failedChecks.length > 0) {
    const nextTemplate = suggestNextTemplate(availableTemplateIds, currentTemplateId);
    return {
      action: "regenerate",
      reason: `Validation failed: [${failedChecks.join(", ")}]. Rotating template.`,
      failedChecks,
      retryCount,
      suggestedTemplateId: nextTemplate,
    };
  }

  // Priority 5: Multiple review states → review
  if (reviewChecks.length >= 2) {
    return {
      action: "review",
      reason: `Multiple checks in review state: [${reviewChecks.join(", ")}]. Requires human review.`,
      failedChecks: reviewChecks,
      retryCount,
      suggestedTemplateId: null,
    };
  }

  // Priority 6: Single review → regenerate with template rotation
  if (reviewChecks.length === 1) {
    const nextTemplate = suggestNextTemplate(availableTemplateIds, currentTemplateId);
    return {
      action: "regenerate",
      reason: `Check in review state: [${reviewChecks.join(", ")}]. Attempting regeneration with template rotation.`,
      failedChecks: reviewChecks,
      retryCount,
      suggestedTemplateId: nextTemplate,
    };
  }

  // Priority 7: All pass → approve
  return {
    action: "approve",
    reason: "All validation checks passed",
    failedChecks: [],
    retryCount,
    suggestedTemplateId: null,
  };
}

function suggestNextTemplate(
  availableIds: string[],
  currentId: string | null
): string | null {
  if (availableIds.length <= 1) return currentId;
  if (!currentId) return availableIds[0];

  const currentIndex = availableIds.indexOf(currentId);
  if (currentIndex === -1) return availableIds[0];

  return availableIds[(currentIndex + 1) % availableIds.length];
}
