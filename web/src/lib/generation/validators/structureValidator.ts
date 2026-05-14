import type { StructureCheckResult, ParsedGeneration } from "../types";
import { GENERATION_CONFIG } from "../config";

export function validateStructure(
  parsed: ParsedGeneration,
  section: "RW" | "Math"
): StructureCheckResult {
  const issues: string[] = [];

  const hasQuestion = parsed.question.trim().length > 0;
  if (!hasQuestion) issues.push("Missing question text");

  const hasPassage = parsed.passage !== null && parsed.passage.trim().length > 0;
  if (section === "RW" && !hasPassage) issues.push("RW question missing passage");

  const choiceKeys = ["A", "B", "C", "D"];
  const choiceValues = choiceKeys.map((k) => parsed.choices[k]?.trim() || "");
  const hasAllChoices = choiceValues.every((v) => v.length > 0);
  if (!hasAllChoices) issues.push("Missing one or more choices (A-D)");

  const validChoices = new Set(["A", "B", "C", "D"]);
  const hasCorrectChoice = validChoices.has(parsed.correctChoice);
  if (!hasCorrectChoice) issues.push(`Invalid correct_choice: "${parsed.correctChoice}"`);

  const hasExplanation = parsed.tutorExplanation.trim().length > 0;
  if (!hasExplanation) issues.push("Missing tutor explanation");

  const lengths = choiceValues.filter((v) => v.length > 0).map((v) => v.length);
  const choiceLengthVariance = lengths.length >= 2
    ? computeVariance(lengths)
    : 0;

  if (choiceLengthVariance < 0.01 && lengths.length === 4) {
    issues.push("All choices have nearly identical length — distractors may be too obvious");
  }

  for (const val of choiceValues) {
    if (val.length > 0 && val.length < GENERATION_CONFIG.limits.minChoiceLength) {
      issues.push(`Choice too short (<${GENERATION_CONFIG.limits.minChoiceLength} chars)`);
      break;
    }
    if (val.length > GENERATION_CONFIG.limits.maxChoiceLength) {
      issues.push(`Choice too long (>${GENERATION_CONFIG.limits.maxChoiceLength} chars)`);
      break;
    }
  }

  const result = issues.length === 0 ? "pass" : "fail";

  return {
    result,
    issues,
    hasPassage,
    hasQuestion,
    hasAllChoices,
    hasCorrectChoice,
    hasExplanation,
    choiceLengthVariance: Math.round(choiceLengthVariance * 1000) / 1000,
  };
}

function computeVariance(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map((v) => (v - mean) ** 2);
  return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
}
