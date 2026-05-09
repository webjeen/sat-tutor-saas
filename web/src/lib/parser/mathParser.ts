import {
  MathQuestion,
  ParseError,
  ExamFamily,
  ModuleNumber,
  ResponseType,
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

// Matches all known SAT Math choice formats:
//   A. ... | A) ... | (A) ... | A ...  (with trailing content)
// Also handles choices that span multiple lines (continuation indented).
function extractChoices(text: string): Record<string, string> {
  const choices: Record<string, string> = {};

  const CHOICE_START_RE = /^\s*\(?\s*([A-D])\s*[.)]\s*(.*)/;
  const CHOICE_BARE_RE = /^\s*([A-D])\s{2,}(.*)/;

  const lines = text.split("\n");
  let currentKey: string | null = null;
  let currentValue: string[] = [];

  const flush = () => {
    if (currentKey) {
      choices[currentKey] = currentValue.join(" ").trim();
    }
    currentKey = null;
    currentValue = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (currentKey) flush();
      continue;
    }

    let m = trimmed.match(CHOICE_START_RE);
    if (!m) m = trimmed.match(CHOICE_BARE_RE);

    if (m) {
      flush();
      currentKey = m[1];
      currentValue = [m[2]];
    } else if (currentKey) {
      currentValue.push(trimmed);
    }
  }

  flush();
  return choices;
}

// SPR detection: no A-D choices AND answer is not a letter choice
function detectResponseType(
  choices: Record<string, string>,
  answer: string
): ResponseType {
  const hasChoices = Object.keys(choices).length >= 2;
  if (hasChoices) return "mcq";

  const isLetterAnswer = /^[A-D]$/i.test(answer.trim());
  if (isLetterAnswer) return "mcq";

  return "spr";
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

  const responseType = detectResponseType(choices, answer);

  // Debug logging for SPR or partial-choice questions
  if (responseType === "spr") {
    console.log(`[MATH PARSE] Q${questionId} → SPR (grid-in) — no MCQ choices, answer="${answer}"`);
  } else if (Object.keys(choices).length < 4) {
    console.log(`[MATH PARSE] Q${questionId} MCQ partial choices: ${Object.keys(choices).join(",")}`);
    console.log(`[MATH PARSE] Q${questionId} RAW choicesText:\n${choicesText}`);
    // Line-by-line debug: show what each line matches
    const dbgRe1 = /^\s*\(?\s*([A-D])\s*[.)]\s*(.*)/;
    const dbgRe2 = /^\s*([A-D])\s{2,}(.*)/;
    for (const line of choicesText.split("\n")) {
      const t = line.trim();
      if (!t) { console.log(`  [BLANK]`); continue; }
      const m1 = t.match(dbgRe1);
      const m2 = t.match(dbgRe2);
      console.log(`  "${t}" → dot/paren:${m1 ? `YES(${m1[1]})` : "no"} bare:${m2 ? `YES(${m2[1]})` : "no"}`);
    }
  }

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

  // MCQ with no parsed choices is a problem; SPR with no choices is expected
  if (responseType === "mcq" && Object.keys(choices).length < 4) {
    const missing = ["A", "B", "C", "D"].filter((k) => !(k in choices));
    errors.push({
      questionId,
      field: "CHOICES",
      message: `MCQ missing choices: ${missing.join(", ")}`,
      severity: "review",
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
      responseType,
      unclear,
    },
    errors,
  };
}
