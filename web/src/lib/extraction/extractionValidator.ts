import type {
  SectionExtractedData,
  RWExtractedData,
  MathExtractedData,
  PatternOutput,
  ExtractionValidationError,
  ExtractionValidationResult,
  ExtractionDecision,
  ApprovedQuestionRow,
  ExtractionConfidence,
} from "./types";

import { normalize } from "../dedup/fingerprint";

const APPROVED_STATUSES = new Set([
  "validation_passed",
  "approved",
  "parsed",
]);

// Confidence threshold below which extraction is auto-routed to review
const LOW_CONFIDENCE_THRESHOLD = 0.5;

export function validateSourceApproved(
  question: ApprovedQuestionRow
): ExtractionValidationError[] {
  const errors: ExtractionValidationError[] = [];

  if (!question.parsing_status || !APPROVED_STATUSES.has(question.parsing_status)) {
    errors.push({
      field: "parsing_status",
      reason: `Source question has parsing_status="${question.parsing_status}", not approved`,
      severity: "reject",
    });
  }

  if (question.analysis_status === "rejected") {
    errors.push({
      field: "analysis_status",
      reason: "Source question analysis_status is rejected",
      severity: "reject",
    });
  }

  return errors;
}

export function validateNoRealLeak(
  extractedData: SectionExtractedData,
  sourceQuestion: ApprovedQuestionRow
): ExtractionValidationError[] {
  const errors: ExtractionValidationError[] = [];

  const sourceTexts = [
    sourceQuestion.raw_passage,
    sourceQuestion.raw_question,
    sourceQuestion.choice_a,
    sourceQuestion.choice_b,
    sourceQuestion.choice_c,
    sourceQuestion.choice_d,
  ].filter(Boolean);

  const normalizedSources = sourceTexts.map((t) => normalize(t!));

  const extractedValues = Object.values(extractedData);

  for (const value of extractedValues) {
    if (typeof value !== "string" || !value) continue;

    for (const source of normalizedSources) {
      const sourceWords = source.split(" ");
      for (let i = 0; i <= sourceWords.length - 5; i++) {
        const window = sourceWords.slice(i, i + 5).join(" ");
        if (window.length > 20 && normalize(value).includes(window)) {
          errors.push({
            field: "extracted_data",
            reason: `Extracted value "${value}" contains 5+ consecutive words from source`,
            severity: "reject",
          });
          break;
        }
      }
    }
  }

  return errors;
}

export function validateLogicComplete(
  extractedData: SectionExtractedData
): ExtractionValidationError[] {
  const errors: ExtractionValidationError[] = [];

  for (const [key, value] of Object.entries(extractedData)) {
    if (!value || value === "" || value === "unknown") {
      errors.push({
        field: key,
        reason: `Field "${key}" is empty or unclassified`,
        severity: "review",
      });
    }
  }

  return errors;
}

export function validateNotDuplicate(
  extractedData: SectionExtractedData,
  section: string,
  existingPatterns: { type: string; reasoning_pattern: string | null; distractor_pattern: string | null }[]
): ExtractionValidationError[] {
  const errors: ExtractionValidationError[] = [];

  const newType = extractedData.question_type;
  const newReasoning =
    section === "RW"
      ? (extractedData as RWExtractedData).reasoning_category
      : (extractedData as MathExtractedData).math_domain;
  const newDistractor = extractedData.distractor_pattern;

  for (const existing of existingPatterns) {
    if (
      existing.type === newType &&
      existing.reasoning_pattern === newReasoning &&
      existing.distractor_pattern === newDistractor
    ) {
      errors.push({
        field: "classification_tuple",
        reason: `Pattern with type="${newType}", reasoning="${newReasoning}", distractor="${newDistractor}" already exists`,
        severity: "review",
      });
      break;
    }
  }

  return errors;
}

export function validateConfidence(
  confidence: ExtractionConfidence
): ExtractionValidationError[] {
  const errors: ExtractionValidationError[] = [];

  if (confidence.overall < LOW_CONFIDENCE_THRESHOLD) {
    errors.push({
      field: "extraction_confidence",
      reason: `Overall extraction confidence ${confidence.overall.toFixed(2)} below threshold ${LOW_CONFIDENCE_THRESHOLD}`,
      severity: "review",
    });
  }

  for (const field of confidence.low_confidence_fields) {
    errors.push({
      field: `confidence:${field}`,
      reason: `Field "${field}" has low classification confidence`,
      severity: "review",
    });
  }

  return errors;
}

export function validateExtraction(
  sourceQuestion: ApprovedQuestionRow,
  extractedData: SectionExtractedData,
  patternOutput: PatternOutput,
  confidence: ExtractionConfidence,
  existingPatterns: { type: string; reasoning_pattern: string | null; distractor_pattern: string | null }[] = []
): ExtractionValidationResult {
  const errors: ExtractionValidationError[] = [];

  errors.push(...validateSourceApproved(sourceQuestion));
  errors.push(...validateNoRealLeak(extractedData, sourceQuestion));
  errors.push(...validateLogicComplete(extractedData));
  errors.push(...validateNotDuplicate(extractedData, sourceQuestion.section, existingPatterns));
  errors.push(...validateConfidence(confidence));

  const hasReject = errors.some((e) => e.severity === "reject");
  const hasReview = errors.some((e) => e.severity === "review");

  let decision: ExtractionDecision;
  let reason: string;

  if (hasReject) {
    decision = "reject";
    reason = errors
      .filter((e) => e.severity === "reject")
      .map((e) => e.reason)
      .join("; ");
  } else if (hasReview) {
    decision = "review";
    reason = errors
      .filter((e) => e.severity === "review")
      .map((e) => e.reason)
      .join("; ");
  } else {
    decision = "approve";
    reason = "All validation checks passed";
  }

  return {
    valid: decision === "approve",
    decision,
    errors,
    reason,
  };
}
