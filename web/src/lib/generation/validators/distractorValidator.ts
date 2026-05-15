import type {
  DistractorCheckResult,
  PerDistractorAnalysis,
  ParsedGeneration,
  CrossDistractorSimilarityResult,
  DistractorCorrectOverlapResult,
  StrategyConformanceResult,
} from "../types";
import type { DistractorGenerationStrategy } from "../../library/types";
import { GENERATION_CONFIG } from "../config";
import { computeContentSimilarity } from "../../dedup/similarity";

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

  // Phase 3: Cross-distractor similarity
  const crossDistractorSimilarity = checkCrossDistractorSimilarity(perDistractor);

  // Phase 3: Distractor-correct overlap
  const distractorCorrectOverlap = checkDistractorCorrectOverlap(perDistractor, parsed);

  // Phase 3: Strategy conformance
  const strategyConformance = checkStrategyConformance(perDistractor);

  let result: "pass" | "fail" | "review" = "pass";
  if (throwawayCount > 0) result = "fail";
  else if (lowPlausibilityCount > 1) result = "fail";
  else if (crossDistractorSimilarity.result === "fail") result = "fail";
  else if (distractorCorrectOverlap.result === "fail") result = "fail";
  else if (!primaryPatternCovered && strategy.primary_patterns.length > 0) result = "review";
  else if (diversityScore < GENERATION_CONFIG.distractor.minDiversityScore) result = "review";
  else if (crossDistractorSimilarity.result === "review") result = "review";
  else if (distractorCorrectOverlap.result === "review") result = "review";
  else if (strategyConformance.result === "review") result = "review";

  return {
    result,
    distractorCount: perDistractor.length,
    strategiesUsed,
    primaryPatternCovered,
    diversityScore: Math.round(diversityScore * 100) / 100,
    perDistractor,
    crossDistractorSimilarity,
    distractorCorrectOverlap,
    strategyConformance,
  };
}

function checkCrossDistractorSimilarity(
  perDistractor: PerDistractorAnalysis[]
): CrossDistractorSimilarityResult {
  const similarPairs: CrossDistractorSimilarityResult["similarPairs"] = [];
  const threshold = GENERATION_CONFIG.distractor.crossDistractorSimilarityThreshold;

  for (let i = 0; i < perDistractor.length; i++) {
    for (let j = i + 1; j < perDistractor.length; j++) {
      const similarity = computeContentSimilarity(
        perDistractor[i].text,
        perDistractor[j].text
      );
      if (similarity >= threshold) {
        similarPairs.push({
          distractorA: perDistractor[i].label,
          distractorB: perDistractor[j].label,
          similarity: Math.round(similarity * 1000) / 1000,
        });
      }
    }
  }

  let result: "pass" | "fail" | "review" = "pass";
  if (similarPairs.some((p) => p.similarity >= 0.9)) {
    result = "fail";
  } else if (similarPairs.length > 0) {
    result = "review";
  }

  return { result, similarPairs };
}

function checkDistractorCorrectOverlap(
  perDistractor: PerDistractorAnalysis[],
  parsed: ParsedGeneration
): DistractorCorrectOverlapResult {
  const correctText = parsed.choices[parsed.correctChoice] || "";
  const threshold = GENERATION_CONFIG.distractor.distractorCorrectOverlapThreshold;

  const overlappingDistractors: DistractorCorrectOverlapResult["overlappingDistractors"] = [];

  for (const d of perDistractor) {
    const similarity = computeContentSimilarity(d.text, correctText);
    if (similarity >= threshold) {
      overlappingDistractors.push({
        label: d.label,
        similarity: Math.round(similarity * 1000) / 1000,
      });
    }
  }

  let result: "pass" | "fail" | "review" = "pass";
  if (overlappingDistractors.length >= 2) {
    result = "fail";
  } else if (overlappingDistractors.length === 1) {
    result = "review";
  }

  return { result, overlappingDistractors };
}

function checkStrategyConformance(
  perDistractor: PerDistractorAnalysis[]
): StrategyConformanceResult {
  const nonConforming: StrategyConformanceResult["nonConformingDistractors"] = [];
  const minWords = GENERATION_CONFIG.distractor.strategyConformanceMinWords;

  for (const d of perDistractor) {
    if (!d.strategy) continue;

    const strategyKeywords = extractStrategyKeywords(d.strategy);
    if (strategyKeywords.length === 0) continue;

    const textLower = d.text.toLowerCase();
    const matchingKeywords = strategyKeywords.filter((k) => textLower.includes(k));

    if (matchingKeywords.length < minWords && strategyKeywords.length >= minWords) {
      nonConforming.push({
        label: d.label,
        claimedStrategy: d.strategy,
        issue: `Distractor text does not reflect claimed strategy "${d.strategy}" (0/${strategyKeywords.length} keywords found)`,
      });
    }
  }

  let result: "pass" | "fail" | "review" = "pass";
  if (nonConforming.length >= 2) {
    result = "review";
  } else if (nonConforming.length === 1) {
    result = "review";
  }

  return { result, nonConformingDistractors: nonConforming };
}

function extractStrategyKeywords(strategy: string): string[] {
  const keywordMap: Record<string, string[]> = {
    sign_error: ["negative", "opposite", "inverse", "-"],
    wrong_operation: ["add", "subtract", "multiply", "divide", "sum", "product", "difference"],
    scope_error: ["narrow", "broad", "specific", "general", "partial"],
    over_extension: ["beyond", "extends", "exceeds", "more than"],
    under_extension: ["insufficient", "less than", "incomplete", "partial"],
    misattribution: ["wrong", "incorrect", "different", "another"],
    reversal: ["reverse", "opposite", "contrary", "backward"],
    off_by_one: ["adjacent", "neighboring", "next", "previous"],
    computation_error: ["calculate", "compute", "miscalculat", "arithmeti"],
    formula_error: ["formula", "equation", "expression"],
    unit_confusion: ["unit", "meter", "foot", "dollar", "cent", "hour", "minute"],
  };

  const normalized = strategy.toLowerCase().replace(/[-\s]/g, "_");
  for (const [key, keywords] of Object.entries(keywordMap)) {
    if (normalized.includes(key)) return keywords;
  }

  return strategy.split(/[-_\s]/).filter((w) => w.length > 2);
}

function assessPlausibility(
  text: string,
  correctLabel: string,
  choices: Record<string, string>
): "high" | "medium" | "low" {
  const correctText = choices[correctLabel] || "";
  if (text.trim().length === 0) return "low";
  if (text.length < 10) return "low";

  // Word overlap with correct answer
  const textWords = new Set(text.toLowerCase().split(/\s+/));
  const correctWords = new Set(correctText.toLowerCase().split(/\s+/));
  let overlap = 0;
  for (const w of textWords) {
    if (correctWords.has(w)) overlap++;
  }
  const overlapRatio = textWords.size > 0 ? overlap / textWords.size : 0;

  // Length similarity
  const lengthRatio = correctText.length > 0
    ? Math.min(text.length, correctText.length) / Math.max(text.length, correctText.length)
    : 0;

  // Combined plausibility
  if (overlapRatio > 0.8) return "medium"; // Too similar to correct — suspicious but not low
  if (overlapRatio > 0.7 && lengthRatio > 0.5) return "medium";
  if (lengthRatio < 0.3) return "low"; // Very different length — often low plausibility
  return "high";
}

function detectThrowaway(text: string): boolean {
  if (text.trim().length < 5) return true;
  if (/^(none|all of the above|n\/a|not applicable|none of the above)$/i.test(text.trim())) return true;
  return false;
}
