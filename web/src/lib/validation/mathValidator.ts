import { MathQuestion } from "../parser/types";
import { ValidationError, TagCheckResult } from "./types";

const VALID_ANSWERS_ABCD = new Set(["A", "B", "C", "D"]);
const REQUIRED_CHOICE_KEYS = ["A", "B", "C", "D"];

export function validateMathQuestion(
  q: MathQuestion,
  tagCheck: TagCheckResult
): ValidationError[] {
  const errors: ValidationError[] = [];
  const qid = q.questionId || "UNKNOWN";

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

  // Math answers can be A/B/C/D OR a numeric/expressed value (e.g. "5", "3/2")
  const isLetterChoice = VALID_ANSWERS_ABCD.has(q.answer);
  const isNumericAnswer = q.answer.trim().length > 0;

  if (!q.answer || (!isLetterChoice && !isNumericAnswer)) {
    errors.push({
      questionId: qid,
      field: "ANSWER",
      reason: "Missing ANSWER",
      severity: "reject",
    });
  }

  if (isLetterChoice && !(q.answer in q.choices)) {
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
