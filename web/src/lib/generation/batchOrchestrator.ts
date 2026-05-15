import type {
  BatchGenerationConfig,
  BatchGenerationResult,
  BatchValidationSummary,
  IntraBatchDedupResult,
  BatchDiversityReport,
  GenerationResult,
  QuestionGenerationResult,
} from "./types";
import { GENERATION_CONFIG } from "./config";
import { runGenerationPipeline, BatchContext } from "./generationOrchestrator";

export async function runBatchGenerationPipeline(
  config: BatchGenerationConfig
): Promise<BatchGenerationResult> {
  const batchId = generateBatchId();
  const errors: string[] = [];

  // 1. Validate batch config
  const configErrors = validateBatchConfig(config);
  if (configErrors.length > 0) {
    return {
      batchId,
      totalRequested: config.maxTotalQuestions,
      totalGenerated: 0,
      totalApproved: 0,
      totalReview: 0,
      totalDiscarded: 0,
      jobResults: [],
      batchValidation: { overallPassRate: 0, checkFailureCounts: {}, averageGenerationScore: 0 },
      intraBatchDedup: { duplicatePairsFound: 0, duplicatePairs: [], questionsRegenerated: 0 },
      diversityReport: { categoryDistribution: {}, difficultyDistribution: {}, meetsDiversityRules: false, violations: configErrors },
      errors: configErrors,
    };
  }

  // 2. Initialize batch tracking
  const batchContext: BatchContext = {
    fingerprints: [],
    recentCorrectPositions: [],
  };

  const intraBatchDedupPairs: IntraBatchDedupResult["duplicatePairs"] = [];
  let questionsRegenerated = 0;

  // 3. Execute individual generation jobs
  const jobResults: GenerationResult[] = [];
  let totalApproved = 0;
  let totalGenerated = 0;
  let totalReview = 0;
  let totalDiscarded = 0;

  for (const request of config.requests) {
    const result = await runGenerationPipeline(request, batchContext);
    jobResults.push(result);

    totalGenerated += result.totalGenerated;
    totalApproved += result.totalApproved;

    for (const qr of result.results) {
      if (qr.decision.action === "review") totalReview++;
      if (qr.decision.action === "discard") totalDiscarded++;
      if (qr.decision.reason.includes("Intra-batch duplicate")) {
        questionsRegenerated++;
      }
    }

    errors.push(...result.errors);
  }

  // 4. Compute batch validation summary
  const batchValidation = computeBatchValidationSummary(jobResults);

  // 5. Compute diversity report
  const diversityReport = computeDiversityReport(jobResults, config.diversityRules);

  return {
    batchId,
    totalRequested: config.maxTotalQuestions,
    totalGenerated,
    totalApproved,
    totalReview,
    totalDiscarded,
    jobResults,
    batchValidation,
    intraBatchDedup: {
      duplicatePairsFound: intraBatchDedupPairs.length,
      duplicatePairs: intraBatchDedupPairs,
      questionsRegenerated,
    },
    diversityReport,
    errors,
  };
}

function validateBatchConfig(config: BatchGenerationConfig): string[] {
  const errors: string[] = [];

  if (config.maxTotalQuestions > GENERATION_CONFIG.batch.maxBatchSize) {
    errors.push(`Batch size ${config.maxTotalQuestions} exceeds max ${GENERATION_CONFIG.batch.maxBatchSize}`);
  }

  const totalRequested = config.requests.reduce((sum, r) => sum + r.count, 0);
  if (totalRequested > config.maxTotalQuestions) {
    errors.push(`Total requested (${totalRequested}) exceeds maxTotalQuestions (${config.maxTotalQuestions})`);
  }

  if (config.requests.length === 0) {
    errors.push("Batch must contain at least one request");
  }

  const dist = config.diversityRules.difficultyDistribution;
  const distTotal = dist.easy + dist.medium + dist.hard;
  if (distTotal !== 100) {
    errors.push(`Difficulty distribution must sum to 100, got ${distTotal}`);
  }

  return errors;
}

function computeBatchValidationSummary(
  jobResults: GenerationResult[]
): BatchValidationSummary {
  const allResults: QuestionGenerationResult[] = [];
  for (const jr of jobResults) {
    allResults.push(...jr.results);
  }

  const generated = allResults.filter((r) => r.question !== null);
  const approved = allResults.filter((r) => r.question?.approved_for_release);

  const overallPassRate = generated.length > 0 ? approved.length / generated.length : 0;

  const checkFailureCounts: Record<string, number> = {};
  for (const r of allResults) {
    for (const check of r.validation.failedChecks) {
      checkFailureCounts[check] = (checkFailureCounts[check] || 0) + 1;
    }
  }

  const scores = allResults
    .map((r) => {
      const logEntry = r.logs.find((l) => l.startsWith("Score v"));
      if (!logEntry) return null;
      const match = logEntry.match(/OVERALL=(\d+\.?\d*)/);
      return match ? parseFloat(match[1]) : null;
    })
    .filter((s): s is number => s !== null);

  const averageGenerationScore = scores.length > 0
    ? scores.reduce((a, b) => a + b, 0) / scores.length
    : 0;

  return {
    overallPassRate: Math.round(overallPassRate * 1000) / 1000,
    checkFailureCounts,
    averageGenerationScore: Math.round(averageGenerationScore * 1000) / 1000,
  };
}

function computeDiversityReport(
  jobResults: GenerationResult[],
  rules: BatchGenerationConfig["diversityRules"]
): BatchDiversityReport {
  const categoryDistribution: Record<string, number> = {};
  const difficultyDistribution: Record<string, number> = {};
  const violations: string[] = [];

  for (const jr of jobResults) {
    for (const qr of jr.results) {
      if (!qr.question) continue;

      const cat = qr.question.category;
      categoryDistribution[cat] = (categoryDistribution[cat] || 0) + 1;

      const diff = qr.question.mapped_level || "unknown";
      difficultyDistribution[diff] = (difficultyDistribution[diff] || 0) + 1;
    }
  }

  // Check max same category
  for (const [cat, count] of Object.entries(categoryDistribution)) {
    if (count > rules.maxSameCategory) {
      violations.push(`Category "${cat}" has ${count} questions (max ${rules.maxSameCategory})`);
    }
  }

  // Check category spread
  if (rules.requireCategorySpread) {
    const uniqueCategories = Object.keys(categoryDistribution).length;
    if (uniqueCategories < rules.minCategorySpread) {
      violations.push(`Only ${uniqueCategories} categories (min ${rules.minCategorySpread})`);
    }
  }

  // Check difficulty distribution
  const totalWithDifficulty = Object.values(difficultyDistribution).reduce((a, b) => a + b, 0);
  if (totalWithDifficulty > 0) {
    const easyPct = ((difficultyDistribution["easy"] || 0) / totalWithDifficulty) * 100;
    const mediumPct = ((difficultyDistribution["medium"] || 0) / totalWithDifficulty) * 100;
    const hardPct = ((difficultyDistribution["hard"] || 0) / totalWithDifficulty) * 100;

    const tolerance = 20; // 20% tolerance on distribution targets
    if (Math.abs(easyPct - rules.difficultyDistribution.easy) > tolerance) {
      violations.push(`Easy difficulty ${Math.round(easyPct)}% (target ${rules.difficultyDistribution.easy}%)`);
    }
    if (Math.abs(mediumPct - rules.difficultyDistribution.medium) > tolerance) {
      violations.push(`Medium difficulty ${Math.round(mediumPct)}% (target ${rules.difficultyDistribution.medium}%)`);
    }
    if (Math.abs(hardPct - rules.difficultyDistribution.hard) > tolerance) {
      violations.push(`Hard difficulty ${Math.round(hardPct)}% (target ${rules.difficultyDistribution.hard}%)`);
    }
  }

  return {
    categoryDistribution,
    difficultyDistribution,
    meetsDiversityRules: violations.length === 0,
    violations,
  };
}

function generateBatchId(): string {
  return `batch:${Date.now()}:${Math.random().toString(36).substring(2, 8)}`;
}
