import { ParsedQuestion, RWQuestion, MathQuestion } from "../parser/types";
import { ValidationResult, ValidationError } from "./types";
import { checkTags } from "./tagChecker";
import { validateRWQuestion } from "./rwValidator";
import { validateMathQuestion } from "./mathValidator";

export function validateQuestion(
  q: ParsedQuestion,
  rawBlock: string
): ValidationError[] {
  const tagCheck = checkTags(rawBlock);

  switch (q.section) {
    case "RW":
      return validateRWQuestion(q as RWQuestion, tagCheck);
    case "Math":
      return validateMathQuestion(q as MathQuestion, tagCheck);
    default: {
      const sec = (q as { section: string }).section;
      return [
        {
          questionId: (q as { questionId: string }).questionId || "UNKNOWN",
          field: "Section",
          reason: `Unrecognized section: "${sec}"`,
          severity: "reject",
        },
      ];
    }
  }
}

export function validateParsedQuestions(
  questions: ParsedQuestion[],
  rawBlocks: string[]
): ValidationResult {
  const errors: ValidationError[] = [];

  for (let i = 0; i < questions.length; i++) {
    const rawBlock = rawBlocks[i] ?? "";
    const qErrors = validateQuestion(questions[i], rawBlock);
    errors.push(...qErrors);
  }

  const hasReject = errors.some((e) => e.severity === "reject");

  return {
    status: hasReject ? "reject" : "success",
    errors,
  };
}
