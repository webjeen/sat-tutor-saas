import { supabase } from "./client";
import type { ApprovedQuestionRow } from "../extraction/types";

export async function fetchApprovedQuestions(
  section?: string,
  limit?: number,
  skipAlreadyExtracted?: boolean
): Promise<{ data: ApprovedQuestionRow[] | null; error: string | null }> {
  let query = supabase
    .from("real_questions")
    .select("id, exam, section, module, question_number, raw_passage, raw_question, choice_a, choice_b, choice_c, choice_d, correct_choice, parsing_status, analysis_status, fingerprint_text, fingerprint_structure, question_type")
    .in("parsing_status", ["validation_passed", "approved", "parsed"])
    .order("created_at", { ascending: true });

  if (section) {
    query = query.eq("section", section);
  }

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) {
    return { data: null, error: error.message };
  }

  if (!data || data.length === 0) {
    return { data: [], error: null };
  }

  // Skip already-extracted: filter out questions that have a pattern
  if (skipAlreadyExtracted !== false) {
    const questionIds = data.map((q) => q.id);

    const { data: existingPatterns, error: patternError } = await supabase
      .from("patterns")
      .select("source_question_id")
      .in("source_question_id", questionIds);

    if (patternError) {
      return { data: null, error: patternError.message };
    }

    const extractedIds = new Set(
      (existingPatterns || []).map((p) => p.source_question_id)
    );

    const filtered = data.filter((q) => !extractedIds.has(q.id));
    return { data: filtered, error: null };
  }

  return { data, error: null };
}
