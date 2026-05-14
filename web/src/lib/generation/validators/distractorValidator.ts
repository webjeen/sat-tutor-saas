import type { DistractorCheckResult, PerDistractorAnalysis, ParsedGeneration } from "../types";
import type { DistractorGenerationStrategy } from "../../library/types";
import { GENERATION_CONFIG } from "../config";

export function validateDistractors(
  parsed: ParsedGeneration,
  strategy: DistractorGenerationStrategy
): DistractorCheckResult {
  const wrongChoices = Object.entries(parsed.choices)
    .filter(([key]) => key !== parsed.correctChoice);

  const perDistractor: PerDistractorAnalysis[] = wrongChoices.map(([label, text]) => {
    const assignedStrategy = parsed.distractorStrategies[label] || null;
    const plausibility = assessPlausibility(text, parsed.correctChoice, parsed.choices);
    const isThrowaway = detectThrowaway(text);

    return {
      label,
      text,
      strategy: assignedStrategy,
      plausibility,
      isThrowaway,
    };
  });

  const strategiesUsed = perDistractor
    .map((d) => d.strategy)
    .filter((s): s is string => s !== null);

  const uniqueStrategies = new Set(strategiesUsed);
  const primaryPatternCovered = strategy.primary_patterns.some((p) => uniqueStrategies.has(p));

  const diversityScore = uniqueStrategies.size / Math.max(perDistractor.length, 1);

  const throwawayCount = perDistractor.filter((d) => d.isThrowaway).length;
  const lowPlausibilityCount = perDistractor.filter((d) => d.plausibility === "low").length;

  let result: "pass" | "fail" | "review" = "pass";
  if (throwawayCount > 0) result = "fail";
  else if (lowPlausibilityCount > 1) result = "fail";
  else if (!primaryPatternCovered && strategy.primary_patterns.length > 0) result = "review";
  else if (diversityScore < GENERATION_CONFIG.distractor.minDiversityScore) result = "review";

  return {
    result,
    distractorCount: perDistractor.length,
    strategiesUsed,
    primaryPatternCovered,
    diversityScore: Math.round(diversityScore * 100) / 100,
    perDistractor,
  };
}

function assessPlausibility(
  text: string,
  _correctLabel: string,
  choices: Record<string, string>
): "high" | "medium" | "low" {
  const correctText = choices[_correctLabel] || "";
  if (text.trim().length === 0) return "low";

  const textWords = new Set(text.toLowerCase().split(/\s+/));
  const correctWords = new Set(correctText.toLowerCase().split(/\s+/));
  let overlap = 0;
  for (const w of textWords) {
    if (correctWords.has(w)) overlap++;
  }
  const overlapRatio = textWords.size > 0 ? overlap / textWords.size : 0;

  if (text.length < 10) return "low";
  if (overlapRatio > 0.7) return "medium";
  return "high";
}

function detectThrowaway(text: string): boolean {
  if (text.trim().length < 5) return true;
  if (/^(none|all of the above|n\/a|not applicable|none of the above)$/i.test(text.trim())) return true;
  return false;
}
