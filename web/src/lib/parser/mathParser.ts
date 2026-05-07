import {
  MathQuestion,
  ParseError,
  ExamFamily,
  ModuleNumber,
} from "./types";

const EXAM_RE = /^Exam:\s*(.+)$/m;
const MODULE_RE = /^Module:\s*(\d+)$/m;
const QUESTION_ID_RE = /^Question_ID:\s*(.+)$/m;
const QUESTION_TYPE_RE = /^Question_Type:\s*(.+)$/m;

function extractSection(text: string, tag: string): string {
  const re = new RegExp(
    `\\[${tag}\\][^\\n]*\\n([\\s\\S]*?)(?=\\n\\s*\\[|$)`
  );
  const m = text.match(re);
  return m ? m[1].trim() : "";
}

function extractChoices(text: string): Record<string, string> {
  const choices: Record<string, string> = {};
  const lines = text.split("\n");
  const re = /^([A-D])\.\s*(.+)$/;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const m = trimmed.match(re);
    if (m) {
      choices[m[1]] = m[2].trim();
    }
  }
  return choices;
}

export function parseMathBlock(block: string): {
  question: MathQuestion | null;
  errors: ParseError[];
} {
  const errors: ParseError[] = [];

  const examMatch = block.match(EXAM_RE);
  const moduleMatch = block.match(MODULE_RE);
  const qidMatch = block.match(QUESTION_ID_RE);
  const qtypeMatch = block.match(QUESTION_TYPE_RE);

  const exam = (examMatch?.[1]?.trim() ?? "") as ExamFamily;
  const moduleNum = Number(moduleMatch?.[1]) as ModuleNumber;
  const questionId = qidMatch?.[1]?.trim() ?? "";
  const questionType = qtypeMatch?.[1]?.trim() ?? "";

  const question = extractSection(block, "QUESTION");
  const choicesText = extractSection(block, "CHOICES");
  const choices = extractChoices(choicesText);
  const answer = extractSection(block, "ANSWER");
  const graph = extractSection(block, "GRAPH");
  const formula = extractSection(block, "FORMULA");
  const answerExplanation = extractSection(block, "ANSWER_EXPLANATION");
  const unclear = extractSection(block, "UNCLEAR");

  // Only structural parse errors — validation is handled by the validation layer
  if (!questionId) {
    errors.push({
      questionId: "UNKNOWN",
      field: "Question_ID",
      message: "Missing Question_ID",
      severity: "reject",
    });
    return { question: null, errors };
  }

  if (exam !== "DSAT") {
    errors.push({
      questionId,
      field: "Exam",
      message: `Expected DSAT, got "${exam}"`,
      severity: "reject",
    });
  }

  if (moduleNum !== 1 && moduleNum !== 2) {
    errors.push({
      questionId,
      field: "Module",
      message: `Module must be 1 or 2, got "${moduleMatch?.[1]}"`,
      severity: "reject",
    });
  }

  const hasReject = errors.some((e) => e.severity === "reject");
  if (hasReject) {
    return { question: null, errors };
  }

  return {
    question: {
      exam: "DSAT",
      section: "Math",
      module: moduleNum,
      questionId,
      questionType,
      question,
      choices,
      answer,
      graph,
      formula,
      answerExplanation,
      unclear,
    },
    errors,
  };
}
