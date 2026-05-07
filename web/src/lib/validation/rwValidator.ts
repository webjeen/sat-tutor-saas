import { RWQuestion } from "../parser/types";
import { ValidationError, TagCheckResult } from "./types";

const VALID_ANSWERS = new Set(["A", "B", "C", "D"]);
const REQUIRED_CHOICE_KEYS = ["A", "B", "C", "D"];

export function validateRWQuestion(
  q: RWQuestion,
  tagCheck: TagCheckResult
): ValidationError[] {
  const errors: ValidationError[] = [];
  const qid = q.questionId || "UNKNOWN";

  if (!q.passage) {
    errors.push({
      questionId: qid,
      field: "PASSAGE",
      reason: "RW question must have a PASSAGE",
      severity: "reject",
    });
  }

  if (!q.question) {
    errors.push({
      questionId: qid,
      field: "QUESTION",
      reason: "Missing QUESTION content",
      severity: "reject",
    });
  }

  const choiceKeys = Object.keys(q.choices);
  if (choiceKeys.length < 4) {
    const missing = REQUIRED_CHOICE_KEYS.filter((k) => !(k in q.choices));
    errors.push({
      questionId: qid,
      field: "CHOICES",
      reason: `Must have 4 choices (A–D). Missing: ${missing.join(", ")}`,
      severity: "reject",
    });
  }

  for (const [key, val] of Object.entries(q.choices)) {
    if (!val.trim()) {
      errors.push({
        questionId: qid,
        field: `CHOICES.${key}`,
        reason: `Choice ${key} is empty`,
        severity: "warning",
      });
    }
  }

  if (!q.answer || !VALID_ANSWERS.has(q.answer)) {
    errors.push({
      questionId: qid,
      field: "ANSWER",
      reason: `ANSWER must be one of A/B/C/D, got "${q.answer}"`,
      severity: "reject",
    });
  }

  if (q.answer && VALID_ANSWERS.has(q.answer) && !(q.answer in q.choices)) {
    errors.push({
      questionId: qid,
      field: "ANSWER",
      reason: `Answer "${q.answer}" does not match any provided choice`,
      severity: "reject",
    });
  }

  for (const tag of tagCheck.malformedTags) {
    errors.push({
      questionId: qid,
      field: "TAG",
      reason: `Malformed or unrecognized tag: [${tag}]`,
      severity: "warning",
    });
  }

  for (const tag of tagCheck.missingRequiredTags) {
    errors.push({
      questionId: qid,
      field: "TAG",
      reason: `Missing required tag: [${tag}]`,
      severity: "reject",
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
