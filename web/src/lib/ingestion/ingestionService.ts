import { parseQuestions } from "../parser/parseQuestions";
import { createFingerprintStore } from "../dedup/dedup";
import type { FingerprintStore } from "../dedup/types";
import { saveParsedQuestion } from "../supabase/saveParsedQuestion";
import type { ParsedQuestion, ParseError } from "../parser/types";

export interface IngestionStats {
  totalParsed: number;
  validQuestions: number;
  validationErrors: number;
  validationWarnings: number;
  answerMissing: number;
  dedupWarnings: number;
  dedupDuplicates: number;
  insertedCount: number;
  insertFailures: number;
  reviewRequired: number;
}

export interface IngestionError {
  questionId: string;
  stage: "parse" | "validation" | "dedup" | "insert";
  field: string;
  message: string;
  severity: "reject" | "review" | "warning";
  code?: string;
}

export interface IngestionResult {
  success: boolean;
  stats: IngestionStats;
  errors: IngestionError[];
  insertedIds: string[];
}

export async function ingestMarkdown(
  markdown: string,
  existingStore?: FingerprintStore
): Promise<IngestionResult> {
  const store = existingStore ?? createFingerprintStore();

  const parseResult = parseQuestions(markdown, store);

  const stats: IngestionStats = {
    totalParsed: 0,
    validQuestions: 0,
    validationErrors: 0,
    validationWarnings: 0,
    answerMissing: 0,
    dedupWarnings: 0,
    dedupDuplicates: 0,
    insertedCount: 0,
    insertFailures: 0,
    reviewRequired: 0,
  };

  const errors: IngestionError[] = [];
  const insertedIds: string[] = [];

  // Count total blocks that were attempted
  const blockCount = (markdown.match(/\[QUESTION_START\]/g) || []).length;
  stats.totalParsed = blockCount;

  // Map parse errors to ingestion errors
  for (const e of parseResult.errors) {
    const stage: IngestionError["stage"] =
      e.field === "DEDUP" ? "dedup" :
      e.field === "input" || e.field === "Section" ? "parse" : "validation";

    // Map severity: parser uses "review", validation uses "warning" — both are non-fatal
    const severity: IngestionError["severity"] =
      e.severity === "reject" ? "reject" : "review";

    errors.push({
      questionId: e.questionId,
      stage,
      field: e.field,
      message: e.message,
      severity,
      code: stage === "validation" ? e.field === "ANSWER" ? "ANSWER_MISSING" : undefined : undefined,
    });

    if (stage === "validation" && severity === "reject") stats.validationErrors++;
    if (stage === "validation" && severity === "review") stats.validationWarnings++;
    if (e.field === "ANSWER" && severity === "review") stats.answerMissing++;
    if (stage === "dedup" && severity === "review") stats.dedupWarnings++;
    if (stage === "dedup" && severity === "reject") stats.dedupDuplicates++;
  }

  // If parse fully rejected, no questions to insert
  if (parseResult.status === "rejected") {
    stats.validQuestions = 0;
    return { success: false, stats, errors, insertedIds };
  }

  stats.validQuestions = parseResult.questions.length;
  stats.reviewRequired = parseResult.status === "review_required"
    ? parseResult.questions.length
    : 0;

  // Insert valid questions one by one (partial failure safe)
  for (const q of parseResult.questions) {
    try {
      const { success, error } = await saveParsedQuestion(q);

      if (success) {
        stats.insertedCount++;
        insertedIds.push(q.questionId);
      } else {
        stats.insertFailures++;
        errors.push({
          questionId: q.questionId,
          stage: "insert",
          field: "db",
          message: error ?? "Unknown insert error",
          severity: "reject",
        });
      }
    } catch (err) {
      stats.insertFailures++;
      errors.push({
        questionId: q.questionId,
        stage: "insert",
        field: "db",
        message: err instanceof Error ? err.message : "Insert threw",
        severity: "reject",
      });
    }
  }

  const hasRejections = errors.some((e) => e.severity === "reject");
  return {
    success: !hasRejections,
    stats,
    errors,
    insertedIds,
  };
}
