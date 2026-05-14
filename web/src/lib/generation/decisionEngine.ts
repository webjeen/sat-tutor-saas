import type { GenerationValidationResult, DecisionResult } from "./types";
import { GENERATION_CONFIG } from "./config";

export function decideGenerationAction(
  validation: GenerationValidationResult,
  retryCount: number,
  availableTemplateIds: string[],
  currentTemplateId: string | null
): DecisionResult {
  const failedChecks: string[] = [];

  if (validation.leakage.result === "fail") {
    return {
      action: "discard",
      reason: `Leakage detected: similarity ${validation.leakage.maxSimilarity} exceeds threshold ${GENERATION_CONFIG.thresholds.leakFail}`,
      failedChecks: ["leakage"],
      retryCount,
      suggestedTemplateId: null,
    };
  }

  if (validation.structure.result === "fail") {
    failedChecks.push("structure");
  }

  if (validation.difficulty.result === "fail") {
    failedChecks.push("difficulty");
  }

  if (validation.distractor.result === "fail") {
    failedChecks.push("distractor");
  }

  if (validation.dedup.result === "fail") {
    failedChecks.push("dedup");
  }

  const reviewChecks: string[] = [];
  if (validation.leakage.result === "review") reviewChecks.push("leakage");
  if (validation.difficulty.result === "review") reviewChecks.push("difficulty");
  if (validation.distractor.result === "review") reviewChecks.push("distractor");
  if (validation.dedup.result === "review") reviewChecks.push("dedup");

  if (retryCount >= GENERATION_CONFIG.pipeline.maxRetriesPerQuestion) {
    return {
      action: "review",
      reason: `Max retries (${GENERATION_CONFIG.pipeline.maxRetriesPerQuestion}) reached. Failed: [${failedChecks.join(", ")}]. Review: [${reviewChecks.join(", ")}]`,
      failedChecks: [...failedChecks, ...reviewChecks],
      retryCount,
      suggestedTemplateId: null,
    };
  }

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

  if (reviewChecks.length >= 2) {
    return {
      action: "review",
      reason: `Multiple checks in review state: [${reviewChecks.join(", ")}]. Requires human review.`,
      failedChecks: reviewChecks,
      retryCount,
      suggestedTemplateId: null,
    };
  }

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
