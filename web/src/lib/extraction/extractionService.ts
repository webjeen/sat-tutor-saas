import type {
  Section,
  SectionExtractedData,
  ExtractionResult,
  BatchExtractionResult,
  BatchExtractionStats,
  ExtractionOptions,
  ExtractionLogRecord,
  ExtractionStage,
  ExtractionStatus,
  ExtractionDecision,
  PatternStatus,
  ApprovedQuestionRow,
  ExtractionConfidence,
} from "./types";

import { extractRWPattern, computePatternOutput } from "./rwExtractor";
import { extractMathPattern, computeMathPatternOutput } from "./mathExtractor";
import { validateExtraction } from "./extractionValidator";
import { checkPatternDuplicate } from "./patternDedup";
import { fetchApprovedQuestions } from "../supabase/fetchApprovedQuestions";
import { savePattern } from "../supabase/savePattern";
import { saveExtractionLog } from "../supabase/saveExtractionLog";
import { fetchPatterns } from "../supabase/fetchPatterns";

function statusFromDecision(decision: ExtractionDecision): PatternStatus {
  switch (decision) {
    case "approve":
      return "pattern_candidate";
    case "review":
      return "pattern_review_required";
    case "reject":
      return "pattern_rejected";
  }
}

async function logStage(
  questionId: string,
  patternId: string | null,
  section: Section,
  stage: ExtractionStage,
  status: ExtractionStatus,
  decision: ExtractionDecision | null,
  decisionReason: string | null,
  durationMs: number | null,
  errorMsg: string | null,
  validationResults?: Record<string, unknown>
): Promise<void> {
  const log: ExtractionLogRecord = {
    source_question_id: questionId,
    pattern_id: patternId,
    section,
    extraction_stage: stage,
    status,
    decision,
    decision_reason: decisionReason,
    validation_results: validationResults || {},
    error_message: errorMsg,
    retry_count: 0,
    extraction_duration_ms: durationMs,
    fingerprint_text: null,
    fingerprint_structure: null,
  };

  await saveExtractionLog(log);
}

async function runExtraction(
  question: ApprovedQuestionRow
): Promise<{
  extractedData: SectionExtractedData;
  patternOutput: import("./types").PatternOutput;
  confidence: ExtractionConfidence;
}> {
  if (question.section === "RW") {
    const { data, confidence } = extractRWPattern(question);
    const patternOutput = computePatternOutput(data, question.raw_passage || "", question.raw_question || "");
    return { extractedData: data, patternOutput, confidence };
  }

  if (question.section === "Math") {
    const { data, confidence } = extractMathPattern(question);
    const patternOutput = computeMathPatternOutput(data, question.raw_question || "");
    return { extractedData: data, patternOutput, confidence };
  }

  throw new Error(`Unknown section: ${question.section}`);
}

async function fetchSingleQuestion(
  questionId: string
): Promise<ApprovedQuestionRow | null> {
  const { supabase } = await import("../supabase/client");
  const { data, error } = await supabase
    .from("real_questions")
    .select("id, exam, section, module, question_number, raw_passage, raw_question, choice_a, choice_b, choice_c, choice_d, correct_choice, parsing_status, analysis_status, fingerprint_text, fingerprint_structure, question_type")
    .eq("id", questionId)
    .single();

  if (error || !data) return null;
  return data as ApprovedQuestionRow;
}

export async function extractPatternFromQuestion(
  questionId: string
): Promise<ExtractionResult> {
  const question = await fetchSingleQuestion(questionId);

  if (!question) {
    return {
      questionId,
      section: "RW",
      extractedData: {} as SectionExtractedData,
      patternOutput: {} as import("./types").PatternOutput,
      confidence: {
        overall: 0,
        overall_level: "low",
        fields: [],
        low_confidence_fields: ["fetch"],
      },
      validation: {
        valid: false,
        decision: "reject",
        errors: [{ field: "fetch", reason: "Question not found", severity: "reject" }],
        reason: "Failed to fetch source question",
      },
    };
  }

  return processQuestion(question);
}

async function processQuestion(
  question: ApprovedQuestionRow
): Promise<ExtractionResult> {
  const questionId = question.id;
  const section = question.section as Section;
  const startMs = Date.now();

  // Stage: fetch
  await logStage(questionId, null, section, "fetch", "success", null, "Question loaded", Date.now() - startMs, null);

  // Stage: extract
  let extractedData: SectionExtractedData;
  let patternOutput: import("./types").PatternOutput;
  let confidence: ExtractionConfidence;

  try {
    const result = await runExtraction(question);
    extractedData = result.extractedData;
    patternOutput = result.patternOutput;
    confidence = result.confidence;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Extraction failed";
    await logStage(questionId, null, section, "extract", "failed", "reject", errMsg, Date.now() - startMs, errMsg);

    return {
      questionId,
      section,
      extractedData: {} as SectionExtractedData,
      patternOutput: {} as import("./types").PatternOutput,
      confidence: { overall: 0, overall_level: "low", fields: [], low_confidence_fields: ["extraction"] },
      validation: {
        valid: false,
        decision: "reject",
        errors: [{ field: "extraction", reason: errMsg, severity: "reject" }],
        reason: errMsg,
      },
    };
  }

  await logStage(
    questionId, null, section, "extract", "success", null,
    `Extracted: confidence=${confidence.overall.toFixed(2)}`,
    Date.now() - startMs, null,
    { confidence: confidence.overall, low_fields: confidence.low_confidence_fields }
  );

  // Stage: validate (includes dedup check against candidate + active patterns)
  const { data: existingCandidate } = await fetchPatterns({ section, status: "pattern_candidate" });
  const { data: existingActive } = await fetchPatterns({ section, status: "pattern_active" });
  const { data: existingReview } = await fetchPatterns({ section, status: "pattern_review_required" });

  const allExisting = [...(existingCandidate || []), ...(existingActive || []), ...(existingReview || [])];
  const patternTupleList = allExisting.map((p) => ({
    type: p.type,
    reasoning_pattern: p.reasoning_pattern,
    distractor_pattern: p.distractor_pattern,
  }));

  const validation = validateExtraction(question, extractedData, patternOutput, confidence, patternTupleList);

  // Run dedup check
  const dedupResult = checkPatternDuplicate(extractedData, section, allExisting);
  if (dedupResult.isDuplicate && dedupResult.matchType === "exact") {
    validation.valid = false;
    validation.decision = "reject";
    validation.errors.push({
      field: "pattern_dedup",
      reason: `Exact duplicate pattern found: ${dedupResult.matchedPatternId}`,
      severity: "reject",
    });
    validation.reason = validation.errors.map((e) => e.reason).join("; ");
  } else if (dedupResult.isDuplicate && dedupResult.matchType === "near") {
    validation.errors.push({
      field: "pattern_dedup",
      reason: `Near-duplicate pattern (score=${dedupResult.matchScore.toFixed(2)}): ${dedupResult.matchedPatternId}`,
      severity: "review",
    });
    if (validation.decision === "approve") {
      validation.decision = "review";
      validation.valid = false;
    }
    validation.reason = validation.errors.map((e) => e.reason).join("; ");
  }

  await logStage(
    questionId, null, section, "validate",
    validation.valid ? "success" : "review_required",
    validation.decision, validation.reason,
    Date.now() - startMs, null,
    { confidence: confidence.overall, dedup: dedupResult.matchType }
  );

  // Stage: store
  const patternStatus = statusFromDecision(validation.decision);
  const storeResult = await savePattern(
    questionId, section, extractedData.question_type,
    extractedData, patternOutput, patternStatus
  );

  if (!storeResult.success) {
    await logStage(questionId, null, section, "store", "failed", "reject", storeResult.error || "Store failed", Date.now() - startMs, storeResult.error || null);

    return {
      questionId, section, extractedData, patternOutput, confidence,
      validation: {
        valid: false,
        decision: "reject",
        errors: [{ field: "store", reason: storeResult.error || "Failed to save pattern", severity: "reject" }],
        reason: storeResult.error || "Failed to save pattern",
      },
    };
  }

  await logStage(
    questionId, storeResult.patternId || null, section, "store", "success",
    validation.decision, validation.reason,
    Date.now() - startMs, null
  );

  // Stage: complete
  await logStage(
    questionId, storeResult.patternId || null, section, "complete", "success",
    validation.decision, "Extraction pipeline complete",
    Date.now() - startMs, null
  );

  return {
    questionId, section, extractedData, patternOutput, confidence, validation,
  };
}

export async function extractPatternsFromApprovedQuestions(
  options?: ExtractionOptions
): Promise<BatchExtractionResult> {
  const batchStart = Date.now();

  const { data: questions, error } = await fetchApprovedQuestions(
    options?.section,
    options?.limit,
    options?.skipAlreadyExtracted !== false
  );

  if (error || !questions) {
    return {
      success: false,
      extracted: 0,
      failed: 0,
      reviewRequired: 0,
      skipped: 0,
      results: [],
      errors: [],
      batchStats: emptyBatchStats(0),
    };
  }

  const results: ExtractionResult[] = [];
  const errors: ExtractionResult[] = [];
  let extracted = 0;
  let failed = 0;
  let reviewRequired = 0;
  let skipped = 0;

  // Track classification methods
  let tagBasedCount = 0;
  let keywordBasedCount = 0;
  let fallbackCount = 0;
  const sectionCounts: Record<string, { count: number; totalConfidence: number }> = {};

  for (const question of questions) {
    try {
      const result = await processQuestion(question);

      // Track classification method from confidence data
      const primaryMethod = result.confidence.fields[0]?.method;
      if (primaryMethod === "tag") tagBasedCount++;
      else if (primaryMethod === "keyword") keywordBasedCount++;
      else fallbackCount++;

      // Track section stats
      const sec = result.section;
      if (!sectionCounts[sec]) sectionCounts[sec] = { count: 0, totalConfidence: 0 };
      sectionCounts[sec].count++;
      sectionCounts[sec].totalConfidence += result.confidence.overall;

      if (result.validation.decision === "approve") {
        extracted++;
        results.push(result);
      } else if (result.validation.decision === "review") {
        reviewRequired++;
        results.push(result);
      } else {
        failed++;
        errors.push(result);
      }
    } catch (err) {
      // Per-question error isolation: don't let one failure kill the batch
      failed++;
      skipped++;
      const errMsg = err instanceof Error ? err.message : "Unknown error";

      errors.push({
        questionId: question.id,
        section: question.section as Section,
        extractedData: {} as SectionExtractedData,
        patternOutput: {} as import("./types").PatternOutput,
        confidence: { overall: 0, overall_level: "low", fields: [], low_confidence_fields: [] },
        validation: {
          valid: false,
          decision: "reject",
          errors: [{ field: "batch_error", reason: errMsg, severity: "reject" }],
          reason: `Batch processing error: ${errMsg}`,
        },
      });
    }
  }

  const totalProcessed = results.length + errors.length;
  const allResults = [...results, ...errors];
  const avgConfidence = totalProcessed > 0
    ? allResults.reduce((sum, r) => sum + r.confidence.overall, 0) / totalProcessed
    : 0;
  const lowConfidenceCount = allResults.filter((r) => r.confidence.overall_level === "low").length;

  const sectionBreakdown: Record<string, { count: number; avgConfidence: number }> = {};
  for (const [sec, data] of Object.entries(sectionCounts)) {
    sectionBreakdown[sec] = {
      count: data.count,
      avgConfidence: data.count > 0 ? data.totalConfidence / data.count : 0,
    };
  }

  const batchStats: BatchExtractionStats = {
    totalProcessed,
    averageConfidence: Math.round(avgConfidence * 1000) / 1000,
    lowConfidenceCount,
    tagBasedCount,
    keywordBasedCount,
    fallbackCount,
    sectionBreakdown,
    durationMs: Date.now() - batchStart,
  };

  return {
    success: failed === 0,
    extracted,
    failed,
    reviewRequired,
    skipped,
    results,
    errors,
    batchStats,
  };
}

function emptyBatchStats(totalProcessed: number): BatchExtractionStats {
  return {
    totalProcessed,
    averageConfidence: 0,
    lowConfidenceCount: 0,
    tagBasedCount: 0,
    keywordBasedCount: 0,
    fallbackCount: 0,
    sectionBreakdown: {},
    durationMs: 0,
  };
}
