import type { ExplanationCoherenceCheckResult, ParsedGeneration } from "../types";
import { GENERATION_CONFIG } from "../config";

export function validateExplanationCoherence(
  parsed: ParsedGeneration,
  _section: "RW" | "Math"
): ExplanationCoherenceCheckResult {
  const explanation = parsed.tutorExplanation.toLowerCase();

  const referencesCorrectChoice = checkReferencesCorrectChoice(parsed);
  const explainsWhy = checkExplainsWhy(explanation);
  const addressesDistractors = checkAddressesDistractors(explanation);

  const coherenceScore = computeCoherenceScore(
    referencesCorrectChoice,
    explainsWhy,
    addressesDistractors
  );

  const minScore = GENERATION_CONFIG.explanationCoherence.minCoherenceScore;
  let result: "pass" | "fail" | "review";
  if (coherenceScore < minScore) {
    result = "fail";
  } else if (coherenceScore < 0.7) {
    result = "review";
  } else {
    result = "pass";
  }

  return {
    result,
    referencesCorrectChoice,
    explainsWhy,
    addressesDistractors,
    coherenceScore: Math.round(coherenceScore * 1000) / 1000,
  };
}

function checkReferencesCorrectChoice(parsed: ParsedGeneration): boolean {
  const explanation = parsed.tutorExplanation.toLowerCase();
  const correctLabel = parsed.correctChoice.toLowerCase();
  const correctText = parsed.choices[parsed.correctChoice]?.toLowerCase() || "";

  if (explanation.includes(`choice ${correctLabel}`)) return true;
  if (explanation.includes(`(${correctLabel})`)) return true;
  if (correctText.length > 10 && explanation.includes(correctText.substring(0, Math.floor(correctText.length * 0.6)))) return true;

  return false;
}

function checkExplainsWhy(explanation: string): boolean {
  const connectives = GENERATION_CONFIG.explanationCoherence.causalConnectives;
  return connectives.some((c) => explanation.includes(c));
}

function checkAddressesDistractors(explanation: string): boolean {
  const patterns = GENERATION_CONFIG.explanationCoherence.distractorAddressPatterns;
  return patterns.some((p) => explanation.includes(p));
}

function computeCoherenceScore(
  referencesCorrect: boolean,
  explainsWhy: boolean,
  addressesDistractors: boolean
): number {
  let score = 0;
  if (referencesCorrect) score += 0.35;
  if (explainsWhy) score += 0.35;
  if (addressesDistractors) score += 0.30;
  return score;
}
