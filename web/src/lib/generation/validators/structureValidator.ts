import type {
  StructureCheckResult,
  ParsedGeneration,
  ChoiceDeduplicationResult,
  ExplanationQualityResult,
  CorrectAnswerConsistencyResult,
} from "../types";
import { GENERATION_CONFIG, getTargetPassageWords } from "../config";
import { computeContentSimilarity } from "../../dedup/similarity";

export function validateStructure(
  parsed: ParsedGeneration,
  section: "RW" | "Math",
  difficulty: "easy" | "medium" | "hard" = "medium"
): StructureCheckResult {
  const criticalIssues: string[] = [];
  const borderlineIssues: string[] = [];

  // -- Existing checks (critical) --
  const hasQuestion = parsed.question.trim().length > 0;
  if (!hasQuestion) criticalIssues.push("Missing question text");

  const hasPassage = parsed.passage !== null && parsed.passage.trim().length > 0;
  if (section === "RW" && !hasPassage) criticalIssues.push("RW question missing passage");

  const choiceKeys = ["A", "B", "C", "D"];
  const choiceValues = choiceKeys.map((k) => parsed.choices[k]?.trim() || "");
  const hasAllChoices = choiceValues.every((v) => v.length > 0);
  if (!hasAllChoices) criticalIssues.push("Missing one or more choices (A-D)");

  const validChoices = new Set(["A", "B", "C", "D"]);
  const hasCorrectChoice = validChoices.has(parsed.correctChoice);
  if (!hasCorrectChoice) criticalIssues.push(`Invalid correct_choice: "${parsed.correctChoice}"`);

  const hasExplanation = parsed.tutorExplanation.trim().length > 0;
  if (!hasExplanation) criticalIssues.push("Missing tutor explanation");

  // Choice length variance
  const lengths = choiceValues.filter((v) => v.length > 0).map((v) => v.length);
  const choiceLengthVariance = lengths.length >= 2 ? computeVariance(lengths) : 0;

  if (choiceLengthVariance < 0.01 && lengths.length === 4) {
    borderlineIssues.push("All choices have nearly identical length — distractors may be too obvious");
  }

  // Choice length limits
  for (const val of choiceValues) {
    if (val.length > 0 && val.length < GENERATION_CONFIG.limits.minChoiceLength) {
      criticalIssues.push(`Choice too short (<${GENERATION_CONFIG.limits.minChoiceLength} chars)`);
      break;
    }
    if (val.length > GENERATION_CONFIG.limits.maxChoiceLength) {
      criticalIssues.push(`Choice too long (>${GENERATION_CONFIG.limits.maxChoiceLength} chars)`);
      break;
    }
  }

  // -- Phase 3: Choice content dedup --
  const choiceDeduplication = checkChoiceDeduplication(parsed);

  // -- Phase 3: Passage word count bounds --
  const passageWordCount = parsed.passage ? parsed.passage.split(/\s+/).filter((w) => w.length > 0).length : 0;
  const passageWordCountInRange = checkPassageWordCount(passageWordCount, section, difficulty, borderlineIssues);

  // -- Phase 3: Explanation quality --
  const explanationQuality = checkExplanationQuality(parsed);

  // -- Phase 3: Student explanation --
  const studentExplanationPresent = parsed.studentExplanation.trim().split(/\s+/).filter((w) => w.length > 0).length
    >= GENERATION_CONFIG.structure.minStudentExplanationWords;
  if (!studentExplanationPresent) {
    borderlineIssues.push("Student explanation missing or too short");
  }

  // -- Phase 3: Correct answer consistency --
  const correctAnswerConsistency = checkCorrectAnswerConsistency(parsed, borderlineIssues);

  // -- Three-state result --
  let result: "pass" | "fail" | "review";
  if (criticalIssues.length > 0) {
    result = "fail";
  } else if (borderlineIssues.length > 0) {
    result = "review";
  } else {
    result = "pass";
  }

  return {
    result,
    issues: [...criticalIssues, ...borderlineIssues],
    hasPassage,
    hasQuestion,
    hasAllChoices,
    hasCorrectChoice,
    hasExplanation,
    choiceLengthVariance: Math.round(choiceLengthVariance * 1000) / 1000,
    passageWordCount,
    passageWordCountInRange,
    choiceDeduplication,
    explanationQuality,
    studentExplanationPresent,
    correctAnswerConsistency,
  };
}

function checkChoiceDeduplication(parsed: ParsedGeneration): ChoiceDeduplicationResult {
  const entries = Object.entries(parsed.choices);
  const duplicatePairs: ChoiceDeduplicationResult["duplicatePairs"] = [];
  const threshold = GENERATION_CONFIG.structure.choiceSimilarityThreshold;

  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const similarity = computeContentSimilarity(entries[i][1], entries[j][1]);
      if (similarity >= threshold) {
        duplicatePairs.push({
          choiceA: entries[i][0],
          choiceB: entries[j][0],
          similarity: Math.round(similarity * 1000) / 1000,
        });
      }
    }
  }

  return {
    hasDuplicates: duplicatePairs.length > 0,
    duplicatePairs,
  };
}

function checkPassageWordCount(
  wordCount: number,
  section: "RW" | "Math",
  difficulty: "easy" | "medium" | "hard",
  issues: string[]
): boolean {
  if (section !== "RW") return true;

  const { min, max } = getTargetPassageWords(difficulty);
  if (wordCount < min) {
    issues.push(`RW passage too short: ${wordCount} words (min ${min} for ${difficulty})`);
    return false;
  }
  if (wordCount > max) {
    issues.push(`RW passage too long: ${wordCount} words (max ${max})`);
    return false;
  }
  return true;
}

function checkExplanationQuality(parsed: ParsedGeneration): ExplanationQualityResult {
  const wordCount = parsed.tutorExplanation.trim().split(/\s+/).filter((w) => w.length > 0).length;
  const meetsMinimum = wordCount >= GENERATION_CONFIG.structure.minExplanationWords;

  const causalWords = ["because", "since", "therefore", "thus", "consequently", "so", "hence"];
  const lower = parsed.tutorExplanation.toLowerCase();
  const containsReasoning = causalWords.some((w) => lower.includes(w));

  let result: "pass" | "fail" | "review";
  if (!meetsMinimum) {
    result = "fail";
  } else if (!containsReasoning) {
    result = "review";
  } else {
    result = "pass";
  }

  return {
    result,
    wordCount,
    meetsMinimum,
    containsReasoning,
  };
}

function checkCorrectAnswerConsistency(
  parsed: ParsedGeneration,
  issues: string[]
): CorrectAnswerConsistencyResult {
  const correctText = parsed.choices[parsed.correctChoice] || "";
  if (correctText.length === 0) {
    return { result: "pass", embeddedInQuestion: false, overlappingPhrases: [] };
  }

  const questionLower = parsed.question.toLowerCase();
  const correctLower = correctText.toLowerCase();
  const overlap = computeContentSimilarity(correctLower, questionLower);
  const threshold = GENERATION_CONFIG.structure.correctAnswerOverlapThreshold;

  const overlappingPhrases: string[] = [];
  if (overlap > threshold) {
    // Extract key phrases from correct answer that appear in question
    const correctWords = correctLower.split(/\s+/);
    for (let i = 0; i < correctWords.length - 2; i++) {
      const phrase = correctWords.slice(i, i + 3).join(" ");
      if (phrase.length > 8 && questionLower.includes(phrase)) {
        overlappingPhrases.push(phrase);
      }
    }
  }

  const embeddedInQuestion = overlap > threshold;
  if (embeddedInQuestion) {
    issues.push("Correct answer text overlaps significantly with question stem");
  }

  return {
    result: embeddedInQuestion ? "review" : "pass",
    embeddedInQuestion,
    overlappingPhrases,
  };
}

function computeVariance(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map((v) => (v - mean) ** 2);
  return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
}
