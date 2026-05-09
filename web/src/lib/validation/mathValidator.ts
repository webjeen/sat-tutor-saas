import { MathQuestion } from "../parser/types";
import { ValidationError, TagCheckResult } from "./types";

const VALID_ANSWERS_ABCD = new Set(["A", "B", "C", "D"]);

const MISSING_ANSWER_VALUES = new Set([
  "",
  "unknown",
  "(not provided)",
  "not provided",
  "n/a",
  "na",
  "-",
  "—",
]);

function isAnswerMissing(answer: string): boolean {
  if (!answer) return true;
  return MISSING_ANSWER_VALUES.has(answer.trim().toLowerCase());
}

export function validateMathQuestion(
  q: MathQuestion,
  tagCheck: TagCheckResult
): ValidationError[] {
  const errors: ValidationError[] = [];
  const qid = q.questionId || "UNKNOWN";

  // Fatal: missing question text
  if (!q.question) {
    errors.push({
      questionId: qid,
      field: "QUESTION",
      reason: "Missing QUESTION content",
      severity: "reject",
      code: "MISSING_QUESTION",
    });
  }

  const isSPR = q.responseType === "spr";

  if (isSPR) {
    // SPR: no choices required
    // Answer missing → warning (not fatal at ingestion)
    if (isAnswerMissing(q.answer)) {
      errors.push({
        questionId: qid,
        field: "ANSWER",
        reason: "SPR answer missing — requires review before generation",
        severity: "warning",
        code: "ANSWER_MISSING",
      });
    }

    if (Object.keys(q.choices).length > 0) {
      errors.push({
        questionId: qid,
        field: "CHOICES",
        reason: "SPR question has choices — may be misclassified",
        severity: "warning",
        code: "MALFORMED_CHOICES",
      });
    }
  } else {
    // MCQ: must have 4 choices A-D (fatal)
    const choiceKeys = Object.keys(q.choices);
    if (choiceKeys.length < 4) {
      const missing = ["A", "B", "C", "D"].filter((k) => !(k in q.choices));
      errors.push({
        questionId: qid,
        field: "CHOICES",
        reason: `MCQ must have 4 choices (A–D). Missing: ${missing.join(", ")}`,
        severity: "reject",
        code: "MISSING_CHOICES",
      });
    }

    for (const [key, val] of Object.entries(q.choices)) {
      if (!val.trim()) {
        errors.push({
          questionId: qid,
          field: `CHOICES.${key}`,
          reason: `Choice ${key} is empty`,
          severity: "warning",
          code: "MALFORMED_CHOICES",
        });
      }
    }

    // MCQ answer: missing → warning; invalid letter → fatal
    if (isAnswerMissing(q.answer)) {
      errors.push({
        questionId: qid,
        field: "ANSWER",
        reason: "Answer missing — requires review before generation",
        severity: "warning",
        code: "ANSWER_MISSING",
      });
    } else {
      const isLetterChoice = VALID_ANSWERS_ABCD.has(q.answer);
      if (isLetterChoice && !(q.answer in q.choices)) {
        errors.push({
          questionId: qid,
          field: "ANSWER",
          reason: `Answer "${q.answer}" does not match any provided choice`,
          severity: "reject",
          code: "ANSWER_MISMATCH",
        });
      }
      // Non-letter answers (e.g. numeric) are valid for MCQ too
    }
  }

  for (const tag of tagCheck.malformedTags) {
    errors.push({
      questionId: qid,
      field: "TAG",
      reason: `Malformed or unrecognized tag: [${tag}]`,
      severity: "warning",
      code: "MALFORMED_TAG",
    });
  }

  for (const tag of tagCheck.missingRequiredTags) {
    errors.push({
      questionId: qid,
      field: "TAG",
      reason: `Missing required tag: [${tag}]`,
      severity: "reject",
      code: "MISSING_TAG",
    });
  }

  if (!q.answerExplanation) {
    errors.push({
      questionId: qid,
      field: "ANSWER_EXPLANATION",
      reason: "Missing ANSWER_EXPLANATION for Math question",
      severity: "warning",
    });
  }

  if (!q.questionType) {
    errors.push({
      questionId: qid,
      field: "Question_Type",
      reason: "Missing Question_Type",
      severity: "warning",
    });
  }

  return errors;
}
