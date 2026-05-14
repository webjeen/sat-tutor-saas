import type {
  Section,
  SectionExtractedData,
  ExtractionResult,
  BatchExtractionResult,
  ExtractionOptions,
  ExtractionLogRecord,
  ExtractionStage,
  ExtractionStatus,
  ExtractionDecision,
  PatternStatus,
  ApprovedQuestionRow,
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
  errorMsg: string | null
): Promise<void> {
  const log: ExtractionLogRecord = {
    source_question_id: questionId,
    pattern_id: patternId,
    section,
    extraction_stage: stage,
    status,
    decision,
    decision_reason: decisionReason,
    validation_results: {},
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
}> {
  if (question.section === "RW") {
    const extractedData = extractRWPattern(question);
    const patternOutput = computePatternOutput(
      extractedData,
      question.raw_passage || "",
      question.raw_question || ""
    );
    return { extractedData, patternOutput };
  }

  if (question.section === "Math") {
    const extractedData = extractMathPattern(question);
    const patternOutput = computeMathPatternOutput(
      extractedData,
      question.raw_question || ""
    );
    return { extractedData, patternOutput };
  }

  throw new Error(`Unknown section: ${question.section}`);
}

export async function extractPatternFromQuestion(
  questionId: string
): Promise<ExtractionResult> {
  const section: Section = "RW"; // default, overridden below

  // Fetch the specific question
  const { data: questions, error: fetchError } = await fetchApprovedQuestions(
    undefined,
    1,
    false
  );

  if (fetchError || !questions || questions.length === 0) {
    // Try to find the specific question
    const { supabase } = await import("../supabase/client");
    const { data, error } = await supabase
      .from("real_questions")
      .select("id, exam, section, module, question_number, raw_passage, raw_question, choice_a, choice_b, choice_c, choice_d, correct_choice, parsing_status, analysis_status, fingerprint_text, fingerprint_structure, question_type")
      .eq("id", questionId)
      .single();

    if (error || !data) {
      return {
        questionId,
        section,
        extractedData: {} as SectionExtractedData,
        patternOutput: {} as import("./types").PatternOutput,
        validation: {
          valid: false,
          decision: "reject",
          errors: [{ field: "fetch", reason: error?.message || "Question not found", severity: "reject" }],
          reason: "Failed to fetch source question",
        },
      };
    }

    const question = data as ApprovedQuestionRow;
    return processQuestion(question);
  }

  const question = questions.find((q) => q.id === questionId);
  if (!question) {
    return {
      questionId,
      section,
      extractedData: {} as SectionExtractedData,
      patternOutput: {} as import("./types").PatternOutput,
      validation: {
        valid: false,
        decision: "reject",
        errors: [{ field: "fetch", reason: "Question not found in approved list", severity: "reject" }],
        reason: "Question not found",
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

  try {
    const result = await runExtraction(question);
    extractedData = result.extractedData;
    patternOutput = result.patternOutput;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Extraction failed";
    await logStage(questionId, null, section, "extract", "failed", "reject", errMsg, Date.now() - startMs, errMsg);

    return {
      questionId,
      section,
      extractedData: {} as SectionExtractedData,
      patternOutput: {} as import("./types").PatternOutput,
      validation: {
        valid: false,
        decision: "reject",
        errors: [{ field: "extraction", reason: errMsg, severity: "reject" }],
        reason: errMsg,
      },
    };
  }

  await logStage(questionId, null, section, "extract", "success", null, "Pattern extracted", Date.now() - startMs, null);

  // Stage: validate (includes dedup check)
  const { data: existingPatterns } = await fetchPatterns({ section, status: "pattern_active" });
  const patternTupleList = (existingPatterns || []).map((p) => ({
    type: p.type,
    reasoning_pattern: p.reasoning_pattern,
    distractor_pattern: p.distractor_pattern,
  }));

  const validation = validateExtraction(question, extractedData, patternOutput, patternTupleList);

  // Run dedup check
  const dedupResult = checkPatternDuplicate(extractedData, section, existingPatterns || []);
  if (dedupResult.isDuplicate && dedupResult.matchType === "exact") {
    validation.valid = false;
    validation.decision = "reject";
    validation.errors.push({
      field: "pattern_dedup",
      reason: `Exact duplicate pattern found: ${dedupResult.matchedPatternId}`,
      severity: "reject",
    });
    validation.reason = validation.errors.map((e) => e.reason).join("; ");
  }

  await logStage(
    questionId,
    null,
    section,
    "validate",
    validation.valid ? "success" : "review_required",
    validation.decision,
    validation.reason,
    Date.now() - startMs,
    null
  );

  // Stage: store
  const patternStatus = statusFromDecision(validation.decision);
  const storeResult = await savePattern(
    questionId,
    section,
    extractedData.question_type,
    extractedData,
    patternOutput,
    patternStatus
  );

  if (!storeResult.success) {
    await logStage(questionId, null, section, "store", "failed", "reject", storeResult.error || "Store failed", Date.now() - startMs, storeResult.error || null);

    return {
      questionId,
      section,
      extractedData,
      patternOutput,
      validation: {
        valid: false,
        decision: "reject",
        errors: [{ field: "store", reason: storeResult.error || "Failed to save pattern", severity: "reject" }],
        reason: storeResult.error || "Failed to save pattern",
      },
    };
  }

  await logStage(
    questionId,
    storeResult.patternId || null,
    section,
    "store",
    "success",
    validation.decision,
    validation.reason,
    Date.now() - startMs,
    null
  );

  // Stage: complete
  await logStage(
    questionId,
    storeResult.patternId || null,
    section,
    "complete",
    "success",
    validation.decision,
    "Extraction pipeline complete",
    Date.now() - startMs,
    null
  );

  return {
    questionId,
    section,
    extractedData,
    patternOutput,
    validation,
  };
}

export async function extractPatternsFromApprovedQuestions(
  options?: ExtractionOptions
): Promise<BatchExtractionResult> {
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
      results: [],
      errors: [],
    };
  }

  const results: ExtractionResult[] = [];
  const errors: ExtractionResult[] = [];
  let extracted = 0;
  let failed = 0;
  let reviewRequired = 0;

  for (const question of questions) {
    const result = await processQuestion(question);

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
  }

  return {
    success: failed === 0,
    extracted,
    failed,
    reviewRequired,
    results,
    errors,
  };
}
