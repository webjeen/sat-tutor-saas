import { supabase } from "./client";
import type { ValidationResultRow } from "../generation/types";

export async function saveValidationResult(
  result: Omit<ValidationResultRow, "id" | "created_at">
): Promise<{ id: string | null; error: string | null }> {
  const row: Record<string, unknown> = {
    generated_question_id: result.generated_question_id,
    generation_log_id: result.generation_log_id,
    template_id: result.template_id,
    leak_check_result: result.leak_check_result,
    leak_check_score: result.leak_check_score,
    duplicate_check_result: result.duplicate_check_result,
    duplicate_check_score: result.duplicate_check_score,
    structure_check_result: result.structure_check_result,
    difficulty_check_result: result.difficulty_check_result,
    distractor_check_result: result.distractor_check_result,
    difficulty_score: result.difficulty_score,
    mapped_level: result.mapped_level,
    all_checks_passed: result.all_checks_passed,
    decision: result.decision,
    decision_reason: result.decision_reason,
    status: result.status,
  };

  const { data, error } = await supabase
    .from("validation_results")
    .insert(row)
    .select("id")
    .single();

  if (error) return { id: null, error: error.message };
  return { id: data.id, error: null };
}
