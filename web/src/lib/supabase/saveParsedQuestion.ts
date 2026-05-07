import { supabase } from "./client";
import { ParsedQuestion, RWQuestion } from "../parser/types";

export async function saveParsedQuestion(
  q: ParsedQuestion
): Promise<{ success: boolean; error?: string }> {
  const passage = q.section === "RW" ? (q as RWQuestion).passage : null;

  const { error } = await supabase.from("exams").insert({
    question: q.question,
    passage,
    choices: q.choices,
    answer: q.answer,
  });

  if (error) {
    console.error("[DB] Insert error:", error.message);
    return { success: false, error: error.message };
  }

  console.log("[DB] Insert success");
  return { success: true };
}
