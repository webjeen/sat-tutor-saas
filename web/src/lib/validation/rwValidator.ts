import { RWQuestion } from "../parser/types";
import { ValidationError, TagCheckResult } from "./types";

const VALID_ANSWERS = new Set(["A", "B", "C", "D"]);
const REQUIRED_CHOICE_KEYS = ["A", "B", "C", "D"];

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

export function validateRWQuestion(
  q: RWQuestion,
  tagCheck: TagCheckResult
): ValidationError[] {
  const errors: ValidationError[] = [];
  const qid = q.questionId || "UNKNOWN";

  // Fatal: missing passage
  if (!q.passage) {
    errors.push({
      questionId: qid,
      field: "PASSAGE",
      reason: "RW question must have a PASSAGE",
      severity: "reject",
      code: "MISSING_PASSAGE",
    });
  }

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

  // Fatal: missing A-D choices for MCQ
  const choiceKeys = Object.keys(q.choices);
  if (choiceKeys.length < 4) {
    const missing = REQUIRED_CHOICE_KEYS.filter((k) => !(k in q.choices));
    errors.push({
      questionId: qid,
      field: "CHOICES",
      reason: `Must have 4 choices (A–D). Missing: ${missing.join(", ")}`,
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

  // Answer validation — missing answer is a warning at ingestion stage, not fatal
  if (isAnswerMissing(q.answer)) {
    errors.push({
      questionId: qid,
      field: "ANSWER",
      reason: "Answer missing or unavailable — requires review before generation",
      severity: "warning",
      code: "ANSWER_MISSING",
    });
  } else if (!VALID_ANSWERS.has(q.answer)) {
    errors.push({
      questionId: qid,
      field: "ANSWER",
      reason: `ANSWER must be one of A/B/C/D, got "${q.answer}"`,
      severity: "reject",
      code: "ANSWER_MISMATCH",
    });
  } else if (!(q.answer in q.choices)) {
    errors.push({
      questionId: qid,
      field: "ANSWER",
      reason: `Answer "${q.answer}" does not match any provided choice`,
      severity: "reject",
      code: "ANSWER_MISMATCH",
    });
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
