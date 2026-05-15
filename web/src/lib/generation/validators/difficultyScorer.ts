import type { DifficultyCheckResult, DifficultyFactors, ParsedGeneration } from "../types";
import type { DifficultyParameters } from "../../library/types";
import { GENERATION_CONFIG, mapScoreToLevel } from "../config";

export function scoreDifficulty(
  parsed: ParsedGeneration,
  difficultyParams: DifficultyParameters,
  targetBand: "easy" | "medium" | "hard",
  section: "RW" | "Math" = "RW"
): DifficultyCheckResult {
  const factors = computeFactors(parsed, difficultyParams, section);
  const weights = difficultyParams.factor_weights;

  let score = 0;
  let totalWeight = 0;
  for (const [key, weight] of Object.entries(weights)) {
    const factorVal = factors[key as keyof DifficultyFactors] ?? 0;
    const w = Number(weight);
    score += factorVal * w;
    totalWeight += w;
  }

  const rawScore = totalWeight > 0 ? score / totalWeight : 0;
  const difficultyScore = Math.round(rawScore * 100);
  const mappedLevel = mapScoreToLevel(difficultyScore);

  const range = getDifficultyRange(targetBand);
  const mismatch = difficultyScore < range.min || difficultyScore > range.max;

  let result: "pass" | "fail" | "review" = "pass";
  if (targetBand === "hard" && difficultyScore < 60) {
    result = "fail";
  } else if (targetBand === "easy" && difficultyScore > 50) {
    result = "review";
  } else if (mismatch) {
    result = "review";
  }

  return {
    result,
    difficultyScore,
    mappedLevel,
    factors,
    targetBand,
    mismatch,
  };
}

function computeFactors(
  parsed: ParsedGeneration,
  _params: DifficultyParameters,
  section: "RW" | "Math"
): DifficultyFactors {
  const questionWords = parsed.question.split(/\s+/).length;
  const passageWords = parsed.passage ? parsed.passage.split(/\s+/).filter((w) => w.length > 0).length : 0;

  const complexity = Math.min(1, (questionWords + passageWords * 0.3) / 80);
  const syntax = Math.min(1, countComplexWords(parsed.question) / 8);
  const reasoning = Math.min(1, parsed.reasoningTrace.length / 5);
  const distractor = estimateDistractorComplexity(parsed);
  const density = Math.min(1, passageWords / 400);
  const time = Math.min(1, (questionWords + passageWords) / 150);

  // Phase 3: Passage quality (RW-specific)
  const passageQuality = section === "RW" ? computePassageQuality(parsed, passageWords) : 0;

  // Phase 3: Explanation depth
  const explanationDepth = computeExplanationDepth(parsed);

  // Phase 3: SAT-specific markers
  const satMarkers = computeSATMarkers(parsed, section);

  return {
    complexity: Math.round(complexity * 100) / 100,
    syntax: Math.round(syntax * 100) / 100,
    reasoning: Math.round(reasoning * 100) / 100,
    distractor: Math.round(distractor * 100) / 100,
    density: Math.round(density * 100) / 100,
    time: Math.round(time * 100) / 100,
    passageQuality: Math.round(passageQuality * 100) / 100,
    explanationDepth: Math.round(explanationDepth * 100) / 100,
    satMarkers: Math.round(satMarkers * 100) / 100,
  };
}

function computePassageQuality(parsed: ParsedGeneration, passageWords: number): number {
  if (!parsed.passage) return 0;

  let score = 0;

  // Length relative to expected range (0-0.4)
  if (passageWords >= 50 && passageWords <= 400) score += 0.3;
  else if (passageWords >= 30 && passageWords <= 600) score += 0.15;

  // Academic vocabulary (0-0.3)
  const academicCount = countAcademicWords(parsed.passage);
  if (academicCount >= 3) score += 0.3;
  else if (academicCount >= 1) score += 0.15;

  // Paragraph structure (0-0.3)
  const paragraphs = parsed.passage.split(/\n\n+/).filter((p) => p.trim().length > 0);
  if (paragraphs.length >= 3) score += 0.3;
  else if (paragraphs.length >= 2) score += 0.15;

  return Math.min(1, score);
}

function computeExplanationDepth(parsed: ParsedGeneration): number {
  const wordCount = parsed.tutorExplanation.trim().split(/\s+/).filter((w) => w.length > 0).length;

  let score = 0;

  // Length-based depth (0-0.4)
  if (wordCount >= 50) score += 0.4;
  else if (wordCount >= 30) score += 0.3;
  else if (wordCount >= 15) score += 0.15;

  // Step-by-step language (0-0.3)
  const stepWords = ["first", "then", "next", "finally", "step", "therefore", "thus"];
  const lower = parsed.tutorExplanation.toLowerCase();
  const stepMatches = stepWords.filter((w) => lower.includes(w)).length;
  if (stepMatches >= 2) score += 0.3;
  else if (stepMatches >= 1) score += 0.15;

  // Reasoning trace presence (0-0.3)
  if (parsed.reasoningTrace.length >= 3) score += 0.3;
  else if (parsed.reasoningTrace.length >= 2) score += 0.15;

  return Math.min(1, score);
}

function computeSATMarkers(parsed: ParsedGeneration, section: "RW" | "Math"): number {
  let score = 0;
  const qLower = parsed.question.toLowerCase();

  if (section === "RW") {
    // Qualifying language
    if (/\b(most|least|primarily|best|strongest)\b/.test(qLower)) score += 0.2;
    // Scope-shifting
    if (/\b(except|not|least|however|although)\b/.test(qLower)) score += 0.2;
    // Evidence-based
    if (/\b(support|evidence|suggests|implies|indicates)\b/.test(qLower)) score += 0.2;
    // Double-negative
    if (/\b(not\b.*\b(un|non|in))|(\b(un|non|in)\w+\b.*\bnot)\b/.test(qLower)) score += 0.2;
  } else {
    // Multi-step indicator
    if (/\b(solve|find|determine|calculate|evaluate)\b/.test(qLower)) score += 0.2;
    // Abstract notation
    if (/\bf\s*\(|equation|function|variable|expression/.test(qLower)) score += 0.2;
    // Contextual complexity
    if (/\b(table|graph|chart|figure|diagram)\b/.test(qLower)) score += 0.2;
    // Multi-constraint
    if (/\b(at least|at most|no more than|between)\b/.test(qLower)) score += 0.2;
  }

  return Math.min(1, score);
}

function countComplexWords(text: string): number {
  return text.split(/\s+/).filter((w) => w.length > 7).length;
}

function estimateDistractorComplexity(parsed: ParsedGeneration): number {
  const strategies = Object.values(parsed.distractorStrategies).filter((s) => s !== null);
  const uniqueStrategies = new Set(strategies);
  return Math.min(1, uniqueStrategies.size / 3);
}

function countAcademicWords(text: string): number {
  const academicTerms = new Set([
    "furthermore", "moreover", "consequently", "nevertheless", "notwithstanding",
    "subsequently", "hypothesis", "phenomenon", "correlation", "implication",
    "paradigm", "empirical", "theoretical", "methodology", "assertion",
    "contention", "premise", "proposition", "inference", "synthesis",
  ]);
  const words = text.toLowerCase().split(/\s+/);
  return words.filter((w) => academicTerms.has(w.replace(/[^a-z]/g, ""))).length;
}

function getDifficultyRange(level: "easy" | "medium" | "hard"): { min: number; max: number } {
  switch (level) {
    case "easy":
      return { min: 0, max: GENERATION_CONFIG.difficulty.easyMax };
    case "medium":
      return { min: GENERATION_CONFIG.difficulty.easyMax + 1, max: GENERATION_CONFIG.difficulty.mediumMax };
    case "hard":
      return { min: GENERATION_CONFIG.difficulty.mediumMax + 1, max: GENERATION_CONFIG.difficulty.hardMax };
  }
}
