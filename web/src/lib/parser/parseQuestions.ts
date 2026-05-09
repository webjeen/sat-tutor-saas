import { ParseResult, ParsedQuestion, ParseError } from "./types";
import { parseRWBlock } from "./rwParser";
import { parseMathBlock } from "./mathParser";
import { validateParsedQuestions } from "../validation/validate";
import { dedupQuestions, createFingerprintStore } from "../dedup/dedup";
import type { FingerprintStore } from "../dedup/types";

function splitBlocks(input: string): string[] {
  const blocks: string[] = [];
  const re = /\[QUESTION_START\]([\s\S]*?)\[QUESTION_END\]/g;
  let m;
  while ((m = re.exec(input)) !== null) {
    blocks.push(m[1].trim());
  }
  return blocks;
}

function detectSection(block: string): "RW" | "Math" | null {
  const m = block.match(/^Section:\s*(.+)$/m);
  const val = m?.[1]?.trim();
  if (val === "RW") return "RW";
  if (val === "Math") return "Math";
  return null;
}

export function parseQuestions(
  input: string,
  existingStore?: FingerprintStore
): ParseResult {
  const blocks = splitBlocks(input);

  if (blocks.length === 0) {
    return {
      status: "rejected",
      questions: [],
      errors: [
        {
          questionId: "GLOBAL",
          field: "input",
          message: "No [QUESTION_START]...[QUESTION_END] blocks found",
          severity: "reject",
        },
      ],
      decisionReason: "No parseable blocks in input",
    };
  }

  const questions: ParsedQuestion[] = [];
  const parseErrors: ParseError[] = [];
  const parsedBlocks: string[] = [];

  for (const block of blocks) {
    const section = detectSection(block);

    if (section === "RW") {
      const result = parseRWBlock(block);
      if (result.question) {
        questions.push(result.question);
        parsedBlocks.push(block);
      }
      parseErrors.push(...result.errors);
    } else if (section === "Math") {
      const result = parseMathBlock(block);
      if (result.question) {
        questions.push(result.question);
        parsedBlocks.push(block);
      }
      parseErrors.push(...result.errors);
    } else {
      const qidMatch = block.match(/^Question_ID:\s*(.+)$/m);
      parseErrors.push({
        questionId: qidMatch?.[1]?.trim() ?? "UNKNOWN",
        field: "Section",
        message: "Missing or unrecognized Section (expected RW or Math)",
        severity: "reject",
      });
    }
  }

  if (parseErrors.some((e) => e.severity === "reject")) {
    return {
      status: "rejected",
      questions: [],
      errors: parseErrors,
      decisionReason: "Parse-level errors prevented validation",
    };
  }

  const validation = validateParsedQuestions(questions, parsedBlocks);

  const allErrors: ParseError[] = [
    ...parseErrors,
    ...validation.errors.map((ve) => ({
      questionId: ve.questionId,
      field: ve.field,
      message: ve.reason,
      severity: ve.severity === "warning" ? ("review" as const) : ("reject" as const),
    })),
  ];

  if (validation.status === "reject") {
    return {
      status: "rejected",
      questions: [],
      errors: allErrors,
      decisionReason: "Validation rejected one or more questions",
    };
  }

  // Deduplication — runs after validation passes
  const { results: dedupResults, store } = dedupQuestions(questions, existingStore);

  const uniqueQuestions: ParsedQuestion[] = [];
  for (let i = 0; i < questions.length; i++) {
    const dr = dedupResults[i];

    if (dr.status === "duplicate") {
      allErrors.push({
        questionId: questions[i].questionId,
        field: "DEDUP",
        message: dr.reason,
        severity: "reject",
      });
      // Skip only this question, not the entire batch
    } else if (dr.status === "similar") {
      allErrors.push({
        questionId: questions[i].questionId,
        field: "DEDUP",
        message: dr.reason,
        severity: "review",
      });
      uniqueQuestions.push(questions[i]);
    } else {
      uniqueQuestions.push(questions[i]);
    }
  }

  // If all questions were duplicates, reject
  if (uniqueQuestions.length === 0 && allErrors.some((e) => e.severity === "reject")) {
    return {
      status: "rejected",
      questions: [],
      errors: allErrors,
      decisionReason: "All questions rejected by deduplication",
    };
  }

  const hasReview = allErrors.some((e) => e.severity === "review");
  const hasReject = allErrors.some((e) => e.severity === "reject");

  return {
    status: hasReview || hasReject ? "review_required" : "validation_passed",
    questions: uniqueQuestions,
    errors: allErrors,
    decisionReason: hasReject
      ? "Some questions rejected by dedup; remaining questions passed"
      : hasReview
        ? "Passed validation with warnings (dedup similarity or other)"
        : "All questions parsed, validated, and dedup-checked successfully",
  };
}

export { createFingerprintStore };
export type { FingerprintStore };
