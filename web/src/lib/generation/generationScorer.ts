import type {
  GenerationScore,
  GenerationScoreMetadata,
  ParsedGeneration,
  GenerationValidationResult,
  AntiLeakSafeguardResult,
} from "./types";
import type { Section, LibraryCategory } from "../library/types";

const SCORING_VERSION = "2.0.0";

// Score weights for overall calculation
const OVERALL_WEIGHTS = {
  structuralQuality: 0.15,
  rhetoricalFidelity: 0.15,
  difficultyAlignment: 0.15,
  originality: 0.20,
  satFidelity: 0.15,
  distractorQuality: 0.10,
  reasoningCompleteness: 0.10,
};

export function scoreGeneration(
  parsed: ParsedGeneration,
  validation: GenerationValidationResult,
  antiLeakResult: AntiLeakSafeguardResult | null,
  section: Section,
  category: LibraryCategory,
  difficultyTarget: "easy" | "medium" | "hard",
  templateId: string
): GenerationScore {
  const structuralQuality = computeStructuralQuality(parsed, validation);
  const rhetoricalFidelity = computeRhetoricalFidelity(parsed, section, category);
  const difficultyAlignment = computeDifficultyAlignment(validation);
  const originality = computeOriginality(antiLeakResult, validation);
  const satFidelity = computeSATFidelity(parsed, section);
  const distractorQuality = computeDistractorQuality(validation);
  const reasoningCompleteness = computeReasoningCompleteness(parsed);

  const overallScore = computeOverallScore({
    structuralQuality,
    rhetoricalFidelity,
    difficultyAlignment,
    originality,
    satFidelity,
    distractorQuality,
    reasoningCompleteness,
  });

  const metadata: GenerationScoreMetadata = {
    section,
    category,
    difficultyTarget,
    templateId,
    scoringVersion: SCORING_VERSION,
    scoredAt: new Date().toISOString(),
  };

  return {
    structuralQuality,
    rhetoricalFidelity,
    difficultyAlignment,
    originality,
    satFidelity,
    distractorQuality,
    reasoningCompleteness,
    overallScore,
    metadata,
  };
}

function computeStructuralQuality(
  parsed: ParsedGeneration,
  validation: GenerationValidationResult
): number {
  let score = 1.0;

  if (validation.structure.result === "fail") score -= 0.5;
  else if (validation.structure.result === "review") score -= 0.2;

  if (!validation.structure.hasPassage && parsed.passage === null && parsed.question.length > 0) {
    // Math question — passage not expected, no penalty
  } else if (!validation.structure.hasPassage) {
    score -= 0.2;
  }

  if (!validation.structure.hasExplanation) score -= 0.15;
  if (!validation.structure.hasAllChoices) score -= 0.15;

  // Choice length variance: some variance is good (not all same length)
  const variance = validation.structure.choiceLengthVariance;
  if (variance > 0 && variance < 0.01) {
    score -= 0.05; // All choices nearly identical length — suspicious
  }

  return clampScore(score);
}

function computeRhetoricalFidelity(
  parsed: ParsedGeneration,
  section: Section,
  category: LibraryCategory
): number {
  if (section === "Math") {
    return computeMathRhetoricalFidelity(parsed, category);
  }
  return computeRWRhetoricalFidelity(parsed, category);
}

function computeRWRhetoricalFidelity(parsed: ParsedGeneration, _category: LibraryCategory): number {
  let score = 0.5; // Base score

  // Passage quality indicators
  if (parsed.passage) {
    const passageWords = parsed.passage.split(/\s+/).length;
    if (passageWords >= 50 && passageWords <= 500) score += 0.15;
    else if (passageWords >= 30 && passageWords <= 600) score += 0.05;

    // Multiple paragraphs indicate structure
    const paragraphs = parsed.passage.split(/\n\n+/).filter((p) => p.trim().length > 0);
    if (paragraphs.length >= 2) score += 0.1;

    // Academic vocabulary presence
    const academicWords = countAcademicWords(parsed.passage);
    if (academicWords >= 3) score += 0.1;
    else if (academicWords >= 1) score += 0.05;
  }

  // Question quality
  if (parsed.question.length > 10) score += 0.05;
  if (parsed.question.endsWith("?")) score += 0.05;

  return clampScore(score);
}

function computeMathRhetoricalFidelity(parsed: ParsedGeneration, _category: LibraryCategory): number {
  let score = 0.5;

  // Math questions should not have passages
  if (!parsed.passage) score += 0.1;

  // Should contain numbers/mathematical notation
  if (/\d/.test(parsed.question)) score += 0.1;

  // Should have variables or mathematical terms
  if (/[xyz]=|equation|function|graph|solve|calculate|find/i.test(parsed.question)) score += 0.1;

  // Choices should include numbers or expressions
  const choicesText = Object.values(parsed.choices).join(" ");
  if (/\d/.test(choicesText)) score += 0.1;

  // Explanation should show steps
  if (parsed.tutorExplanation.length > 50) score += 0.1;

  return clampScore(score);
}

function computeDifficultyAlignment(validation: GenerationValidationResult): number {
  if (validation.difficulty.result === "pass") return 1.0;
  if (validation.difficulty.result === "review") return 0.5;
  return 0.0;
}

function computeOriginality(
  antiLeakResult: AntiLeakSafeguardResult | null,
  validation: GenerationValidationResult
): number {
  let score = 1.0;

  // Dedup check result
  if (validation.dedup.result === "fail") return 0.0;
  if (validation.dedup.result === "review") score -= 0.3;

  // Leakage check result
  if (validation.leakage.result === "fail") return 0.0;
  if (validation.leakage.result === "review") score -= 0.3;

  // Anti-leak safeguard scores
  if (antiLeakResult) {
    score -= antiLeakResult.ngramOverlapScore * 0.3;
    score -= antiLeakResult.structuralLeakageScore * 0.2;
    score -= antiLeakResult.passageLeakageScore * 0.2;

    // Critical violations are disqualifying
    const criticalViolations = antiLeakResult.violations.filter(
      (v) => v.severity === "critical"
    );
    if (criticalViolations.length > 0) return 0.0;
  }

  return clampScore(score);
}

function computeSATFidelity(parsed: ParsedGeneration, _section: Section): number {
  let score = 0.5;

  // 4 choices (A-D)
  const choiceKeys = Object.keys(parsed.choices);
  if (choiceKeys.length === 4 && ["A", "B", "C", "D"].every((k) => choiceKeys.includes(k))) {
    score += 0.15;
  }

  // Single correct answer
  if (["A", "B", "C", "D"].includes(parsed.correctChoice)) {
    score += 0.1;
  }

  // Explanation present
  if (parsed.tutorExplanation.trim().length > 0) score += 0.1;
  if (parsed.studentExplanation.trim().length > 0) score += 0.05;

  // Reasoning trace present
  if (parsed.reasoningTrace.length >= 2) score += 0.1;

  return clampScore(score);
}

function computeDistractorQuality(validation: GenerationValidationResult): number {
  if (validation.distractor.result === "pass") return 1.0;

  let score = 0.7;

  if (validation.distractor.diversityScore < 0.5) score -= 0.3;
  else if (validation.distractor.diversityScore < 0.7) score -= 0.1;

  if (!validation.distractor.primaryPatternCovered) score -= 0.2;

  const throwawayCount = validation.distractor.perDistractor.filter((d) => d.isThrowaway).length;
  if (throwawayCount > 0) score -= 0.3;

  const lowPlaus = validation.distractor.perDistractor.filter((d) => d.plausibility === "low").length;
  if (lowPlaus > 1) score -= 0.2;

  return clampScore(score);
}

function computeReasoningCompleteness(parsed: ParsedGeneration): number {
  if (parsed.reasoningTrace.length === 0) return 0.0;
  if (parsed.reasoningTrace.length === 1) return 0.3;
  if (parsed.reasoningTrace.length === 2) return 0.6;
  if (parsed.reasoningTrace.length === 3) return 0.9;
  return 1.0;
}

function computeOverallScore(scores: Record<keyof typeof OVERALL_WEIGHTS, number>): number {
  let total = 0;
  for (const [key, weight] of Object.entries(OVERALL_WEIGHTS)) {
    total += (scores[key as keyof typeof OVERALL_WEIGHTS] || 0) * weight;
  }
  return clampScore(total);
}

function clampScore(value: number): number {
  return Math.round(Math.max(0, Math.min(1, value)) * 1000) / 1000;
}

function countAcademicWords(text: string): number {
  const academicTerms = new Set([
    "furthermore", "moreover", "consequently", "nevertheless", "notwithstanding",
    "subsequently", "hypothesis", "phenomenon", "correlation", "implication",
    "paradigm", "empirical", "theoretical", "methodology", "assertion",
    "contention", "premise", "proposition", "inference", "synthesis",
    "analysis", "evaluation", "significance", "perspective", "framework",
  ]);

  const words = text.toLowerCase().split(/\s+/);
  return words.filter((w) => academicTerms.has(w.replace(/[^a-z]/g, ""))).length;
}

export function formatScoreForLog(score: GenerationScore): string {
  return [
    `Score v${score.metadata.scoringVersion}:`,
    `  structural=${score.structuralQuality}`,
    `  rhetorical=${score.rhetoricalFidelity}`,
    `  difficulty=${score.difficultyAlignment}`,
    `  originality=${score.originality}`,
    `  satFidelity=${score.satFidelity}`,
    `  distractor=${score.distractorQuality}`,
    `  reasoning=${score.reasoningCompleteness}`,
    `  OVERALL=${score.overallScore}`,
  ].join("\n");
}
