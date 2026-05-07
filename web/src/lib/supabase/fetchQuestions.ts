import { supabase } from "./client";

export interface StoredQuestion {
  id: number;
  question: string;
  passage: string | null;
  choices: Record<string, string>;
  answer: string;
}

export async function fetchQuestions(): Promise<{
  data: StoredQuestion[] | null;
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("exams")
    .select("id, question, passage, choices, answer");

  if (error) {
    return { data: null, error: error.message };
  }

  return { data, error: null };
}
