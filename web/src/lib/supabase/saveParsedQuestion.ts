import { supabase } from "./client";
import { ParsedQuestion, RWQuestion, MathQuestion } from "../parser/types";

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

export async function saveParsedQuestion(
  q: ParsedQuestion
): Promise<{ success: boolean; error?: string }> {
  const passage = q.section === "RW" ? (q as RWQuestion).passage : null;
  const responseType = q.section === "Math" ? (q as MathQuestion).responseType : null;
  const answer = isAnswerMissing(q.answer) ? null : q.answer;

  const row: Record<string, unknown> = {
    question: q.question,
    passage,
    choices: q.choices,
    answer,
  };

  if (responseType) {
    row.response_type = responseType;
  }

  const { error } = await supabase.from("exams").insert(row);

  if (error) {
    console.error("[DB] Insert error:", error.message);
    return { success: false, error: error.message };
  }

  console.log("[DB] Insert success");
  return { success: true };
}
