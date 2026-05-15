import type { WorksheetQuestion, WorksheetValidationResult } from "./types";
import { ASSEMBLY_CONFIG } from "./config";
import { computeWeightedContentSimilarity } from "../dedup/similarity";
import type { StructuredContent } from "../dedup/types";

export function validateWorksheet(
  questions: WorksheetQuestion[]
): WorksheetValidationResult {
  const issues: string[] = [];

  const difficultyProgression = checkDifficultyProgression(questions, issues);
  const answerDistribution = checkAnswerDistribution(questions, issues);
  const categoryDiversity = checkCategoryDiversity(questions, issues);
  const patternDiversity = checkPatternDiversity(questions, issues);
  const duplicateCheck = checkDuplicateQuestions(questions, issues);

  const failedChecks: string[] = [];
  if (difficultyProgression !== "pass") failedChecks.push("difficulty_progression");
  if (answerDistribution !== "pass") failedChecks.push("answer_distribution");
  if (categoryDiversity !== "pass") failedChecks.push("category_diversity");
  if (patternDiversity !== "pass") failedChecks.push("pattern_diversity");
  if (duplicateCheck !== "pass") failedChecks.push("duplicate_check");

  const allPassed = failedChecks.length === 0;

  return {
    difficultyProgression,
    answerDistribution,
    categoryDiversity,
    patternDiversity,
    duplicateCheck,
    allPassed,
    failedChecks,
    issues,
  };
}

function checkDifficultyProgression(
  questions: WorksheetQuestion[],
  issues: string[]
): "pass" | "fail" | "review" {
  if (questions.length === 0) return "fail";

  const levels = questions.map((q) => q.difficultyLevel);
  const order: Record<string, number> = { easy: 0, medium: 1, hard: 2 };

  // Check that there's a general progression (not strict, but no wild jumps)
  let violations = 0;
  for (let i = 1; i < levels.length; i++) {
    const prev = order[levels[i - 1]] ?? 1;
    const curr = order[levels[i]] ?? 1;
    // A drop of 2 levels (hard → easy) is a violation
    if (prev - curr >= 2) violations++;
  }

  if (violations > Math.ceil(questions.length * 0.3)) {
    issues.push(`Difficulty progression has ${violations} significant drops`);
    return "fail";
  }
  if (violations > 0) {
    issues.push(`Difficulty progression has ${violations} minor drops`);
    return "review";
  }

  return "pass";
}

function checkAnswerDistribution(
  questions: WorksheetQuestion[],
  issues: string[]
): "pass" | "fail" | "review" {
  if (questions.length === 0) return "fail";

  const counts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
  for (const q of questions) {
    counts[q.correctChoice] = (counts[q.correctChoice] || 0) + 1;
  }

  const total = questions.length;
  const maxBias = ASSEMBLY_CONFIG.answerDistribution.maxPositionBias;

  // Check no position exceeds max bias
  const overrepresented = Object.entries(counts).filter(
    ([, count]) => count / total > maxBias
  );

  if (overrepresented.length > 0) {
    const [label, count] = overrepresented[0];
    const pct = Math.round((count / total) * 100);
    issues.push(`Answer "${label}" appears ${pct}% (max ${Math.round(maxBias * 100)}%)`);

    if (count / total > maxBias + 0.1) return "fail";
    return "review";
  }

  // Check all positions have minimum representation
  const underrepresented = Object.entries(counts).filter(
    ([, count]) => count < ASSEMBLY_CONFIG.answerDistribution.minPositionCount
  );

  if (underrepresented.length > 0 && total >= 8) {
    const labels = underrepresented.map(([l]) => l).join(", ");
    issues.push(`Answer positions ${labels} have no representation`);
    return "review";
  }

  return "pass";
}

function checkCategoryDiversity(
  questions: WorksheetQuestion[],
  issues: string[]
): "pass" | "fail" | "review" {
  if (questions.length === 0) return "fail";

  const categoryCounts: Record<string, number> = {};
  for (const q of questions) {
    categoryCounts[q.category] = (categoryCounts[q.category] || 0) + 1;
  }

  // Check max same category
  const overLimit = Object.entries(categoryCounts).filter(
    ([, count]) => count > ASSEMBLY_CONFIG.diversity.maxSameCategory
  );
  if (overLimit.length > 0) {
    issues.push(`Category "${overLimit[0][0]}" has ${overLimit[0][1]} questions (max ${ASSEMBLY_CONFIG.diversity.maxSameCategory})`);
    return "fail";
  }

  // Check minimum category spread
  const uniqueCategories = Object.keys(categoryCounts).length;
  if (uniqueCategories < ASSEMBLY_CONFIG.diversity.minCategorySpread && questions.length >= ASSEMBLY_CONFIG.diversity.minCategorySpread * 2) {
    issues.push(`Only ${uniqueCategories} categories (min ${ASSEMBLY_CONFIG.diversity.minCategorySpread})`);
    return "review";
  }

  return "pass";
}

function checkPatternDiversity(
  questions: WorksheetQuestion[],
  issues: string[]
): "pass" | "fail" | "review" {
  if (questions.length === 0) return "fail";

  const templateCounts: Record<string, number> = {};
  for (const q of questions) {
    const templateId = q.question.template_id || "none";
    templateCounts[templateId] = (templateCounts[templateId] || 0) + 1;
  }

  const overLimit = Object.entries(templateCounts).filter(
    ([, count]) => count > ASSEMBLY_CONFIG.diversity.maxSamePattern
  );
  if (overLimit.length > 0) {
    issues.push(`Template "${overLimit[0][0]}" used ${overLimit[0][1]} times (max ${ASSEMBLY_CONFIG.diversity.maxSamePattern})`);
    return "review";
  }

  return "pass";
}

function checkDuplicateQuestions(
  questions: WorksheetQuestion[],
  issues: string[]
): "pass" | "fail" | "review" {
  if (questions.length <= 1) return "pass";

  const contents: StructuredContent[] = questions.map((q) => ({
    passage: q.question.generated_passage || "",
    question: q.question.generated_question,
    choices: [
      q.question.choice_a,
      q.question.choice_b,
      q.question.choice_c,
      q.question.choice_d,
    ].filter(Boolean).join(" "),
  }));

  let maxSimilarity = 0;
  let similarPair = "";

  for (let i = 0; i < contents.length; i++) {
    for (let j = i + 1; j < contents.length; j++) {
      const sim = computeWeightedContentSimilarity(contents[i], contents[j]);
      if (sim > maxSimilarity) {
        maxSimilarity = sim;
        similarPair = `Q${questions[i].index}/Q${questions[j].index}`;
      }
    }
  }

  if (maxSimilarity >= ASSEMBLY_CONFIG.duplicate.maxQuestionSimilarity) {
    issues.push(`Duplicate pair ${similarPair} (similarity: ${Math.round(maxSimilarity * 100)}%)`);
    return "fail";
  }

  if (maxSimilarity >= ASSEMBLY_CONFIG.duplicate.maxQuestionSimilarity * 0.8) {
    issues.push(`Near-duplicate pair ${similarPair} (similarity: ${Math.round(maxSimilarity * 100)}%)`);
    return "review";
  }

  return "pass";
}
