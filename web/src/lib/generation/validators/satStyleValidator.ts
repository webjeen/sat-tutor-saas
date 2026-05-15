import type { SATStyleCheckResult, ParsedGeneration } from "../types";
import type { CheckResult } from "../types";
import { GENERATION_CONFIG } from "../config";

export function validateSATStyle(
  parsed: ParsedGeneration,
  section: "RW" | "Math",
  recentCorrectPositions?: string[]
): SATStyleCheckResult {
  const issues: string[] = [];

  const questionStemFormat = checkQuestionStemFormat(parsed, section, issues);
  const choiceFormat = checkChoiceFormat(parsed, issues);
  const noProhibitedContent = checkNoProhibitedContent(parsed, issues);
  const correctAnswerDistribution = checkCorrectAnswerDistribution(parsed, recentCorrectPositions, issues);

  const worstResult = getWorstResult([questionStemFormat, choiceFormat, noProhibitedContent, correctAnswerDistribution]);

  return {
    result: worstResult,
    questionStemFormat,
    choiceFormat,
    noProhibitedContent,
    correctAnswerDistribution,
    issues,
  };
}

function checkQuestionStemFormat(
  parsed: ParsedGeneration,
  _section: "RW" | "Math",
  issues: string[]
): CheckResult {
  const q = parsed.question.trim();

  if (!q.endsWith("?")) {
    issues.push("Question stem does not end with '?'");
    return "review";
  }

  const qLower = q.toLowerCase();
  const hasStandardOpener = GENERATION_CONFIG.satStyle.requiredStemPatterns.some(
    (p) => qLower.includes(p)
  );

  if (!hasStandardOpener) {
    issues.push("Question stem does not use standard SAT opener pattern");
    return "review";
  }

  return "pass";
}

function checkChoiceFormat(
  parsed: ParsedGeneration,
  issues: string[]
): CheckResult {
  const choiceKeys = Object.keys(parsed.choices);
  if (choiceKeys.length !== 4 || !["A", "B", "C", "D"].every((k) => choiceKeys.includes(k))) {
    issues.push("Choices do not follow A-D format");
    return "fail";
  }

  const texts = Object.values(parsed.choices);
  const emptyCount = texts.filter((t) => t.trim().length === 0).length;
  if (emptyCount > 0) {
    issues.push(`${emptyCount} choice(s) are empty`);
    return "fail";
  }

  return "pass";
}

function checkNoProhibitedContent(
  parsed: ParsedGeneration,
  issues: string[]
): CheckResult {
  const prohibited = GENERATION_CONFIG.satStyle.prohibitedChoicePatterns;

  for (const [key, text] of Object.entries(parsed.choices)) {
    const lower = text.toLowerCase().trim();
    if (prohibited.some((p) => lower === p || lower.includes(p))) {
      issues.push(`Choice ${key} contains prohibited pattern: "${text.trim()}"`);
      return "fail";
    }
  }

  return "pass";
}

function checkCorrectAnswerDistribution(
  parsed: ParsedGeneration,
  recentCorrectPositions: string[] | undefined,
  _issues: string[]
): CheckResult {
  if (!recentCorrectPositions || recentCorrectPositions.length < 3) {
    return "pass";
  }

  const allPositions = [...recentCorrectPositions, parsed.correctChoice];
  const positionCounts: Record<string, number> = {};
  for (const pos of allPositions) {
    positionCounts[pos] = (positionCounts[pos] || 0) + 1;
  }

  const maxRatio = Math.max(...Object.values(positionCounts)) / allPositions.length;
  if (maxRatio > GENERATION_CONFIG.satStyle.maxCorrectAnswerPositionBias) {
    return "review";
  }

  return "pass";
}

function getWorstResult(results: CheckResult[]): CheckResult {
  if (results.includes("fail")) return "fail";
  if (results.includes("review")) return "review";
  return "pass";
}
