import { supabase } from "./client";
import type { GeneratedQuestion } from "../generation/types";

export async function saveGeneratedQuestion(
  question: Omit<GeneratedQuestion, "id" | "created_at" | "updated_at">
): Promise<{ id: string | null; error: string | null }> {
  const row: Record<string, unknown> = {
    template_id: question.template_id,
    pattern_id: question.pattern_id,
    section: question.section,
    category: question.category,
    question_type: question.question_type,
    generated_passage: question.generated_passage,
    generated_question: question.generated_question,
    choice_a: question.choice_a,
    choice_b: question.choice_b,
    choice_c: question.choice_c,
    choice_d: question.choice_d,
    correct_choice: question.correct_choice,
    tutor_explanation: question.tutor_explanation,
    student_explanation: question.student_explanation,
    difficulty_score: question.difficulty_score,
    mapped_level: question.mapped_level,
    difficulty_factors: question.difficulty_factors,
    distractor_analysis: question.distractor_analysis,
    reasoning_trace: question.reasoning_trace,
    status: question.status,
    processing_stage: question.processing_stage,
    retry_count: question.retry_count,
    error_message: question.error_message,
    last_processed_at: question.last_processed_at,
    fingerprint_text: question.fingerprint_text,
    fingerprint_structure: question.fingerprint_structure,
    fingerprint_choice: question.fingerprint_choice,
    pattern_signature: question.pattern_signature,
    version: question.version,
    is_active: question.is_active,
    approved_for_release: question.approved_for_release,
  };

  const { data, error } = await supabase
    .from("generated_questions")
    .insert(row)
    .select("id")
    .single();

  if (error) return { id: null, error: error.message };
  return { id: data.id, error: null };
}

export async function updateGeneratedQuestion(
  id: string,
  updates: Partial<GeneratedQuestion>
): Promise<{ success: boolean; error: string | null }> {
  const { error } = await supabase
    .from("generated_questions")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}
