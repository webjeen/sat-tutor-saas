import type {
  GenerationValidationResult,
  PreSaveValidationResult,
  PreSaveCheck,
  ParsedGeneration,
  DecisionResult,
} from "./types";
import type { Fingerprint } from "../dedup/types";

export function runPreSaveValidation(
  parsed: ParsedGeneration,
  validation: GenerationValidationResult,
  decision: DecisionResult,
  fingerprint: Fingerprint | null
): PreSaveValidationResult {
  const checks: PreSaveCheck[] = [];
  const blockedReasons: string[] = [];

  // 1. All critical validations must not be "fail"
  checks.push(checkNotFailed("structure", validation.structure.result));
  checks.push(checkNotFailed("leakage", validation.leakage.result));
  checks.push(checkNotFailed("difficulty", validation.difficulty.result));
  checks.push(checkNotFailed("distractor", validation.distractor.result));
  checks.push(checkNotFailed("dedup", validation.dedup.result));
  checks.push(checkNotFailed("explanation_coherence", validation.explanationCoherence.result));
  checks.push(checkNotFailed("sat_style", validation.satStyle.result));
  checks.push(checkNotFailed("anti_leak_safeguard", validation.antiLeakSafeguard.result));
  checks.push(checkNotFailed("generation_score", validation.generationScore.result));
  checks.push(checkNotFailed("structural_clone", validation.structuralClone.result));

  // 2. Decision must not be "discard"
  const decisionNotDiscard = decision.action !== "discard";
  checks.push({
    name: "decision_not_discard",
    passed: decisionNotDiscard,
    reason: decisionNotDiscard ? null : `Decision is "discard": ${decision.reason}`,
  });

  // 3. Fingerprint must exist
  const fingerprintPresent = fingerprint !== null
    && fingerprint.textHash !== ""
    && fingerprint.textHash.length > 0;
  checks.push({
    name: "fingerprint_present",
    passed: fingerprintPresent,
    reason: fingerprintPresent ? null : "Fingerprint not generated or empty",
  });

  // 4. Required fields must be present
  const hasQuestion = parsed.question.trim().length > 0;
  checks.push({
    name: "question_text_present",
    passed: hasQuestion,
    reason: hasQuestion ? null : "Question text is empty",
  });

  const hasCorrectChoice = ["A", "B", "C", "D"].includes(parsed.correctChoice);
  checks.push({
    name: "correct_choice_valid",
    passed: hasCorrectChoice,
    reason: hasCorrectChoice ? null : `Invalid correct choice: "${parsed.correctChoice}"`,
  });

  const hasAllChoices = ["A", "B", "C", "D"].every(
    (k) => parsed.choices[k]?.trim().length > 0
  );
  checks.push({
    name: "all_choices_present",
    passed: hasAllChoices,
    reason: hasAllChoices ? null : "One or more choices are missing",
  });

  // 5. Leakage must not be "fail" (hard gate — no leakage allowed)
  const leakageGate = validation.leakage.result !== "fail";
  checks.push({
    name: "leakage_hard_gate",
    passed: leakageGate,
    reason: leakageGate ? null : `Leakage hard gate: similarity ${validation.leakage.maxSimilarity}`,
  });

  // 6. Anti-leak safeguard must not have critical violations
  const antiLeakCriticalGate = validation.antiLeakSafeguard.result !== "fail";
  checks.push({
    name: "anti_leak_critical_gate",
    passed: antiLeakCriticalGate,
    reason: antiLeakCriticalGate
      ? null
      : `Anti-leak critical: ngram=${validation.antiLeakSafeguard.ngramOverlapScore}, violations=${validation.antiLeakSafeguard.criticalViolations}`,
  });

  // Collect blocked reasons from failed checks
  for (const check of checks) {
    if (!check.passed && check.reason) {
      blockedReasons.push(check.reason);
    }
  }

  const cleared = blockedReasons.length === 0;

  return { cleared, checks, blockedReasons };
}

function checkNotFailed(name: string, result: "pass" | "fail" | "review"): PreSaveCheck {
  const passed = result !== "fail";
  return {
    name: `${name}_not_failed`,
    passed,
    reason: passed ? null : `${name} check result is "fail"`,
  };
}
