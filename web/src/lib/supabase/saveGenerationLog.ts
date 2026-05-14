import { supabase } from "./client";
import type { GenerationLog } from "../generation/types";

export async function saveGenerationLog(
  log: Omit<GenerationLog, "id" | "created_at">
): Promise<{ id: string | null; error: string | null }> {
  const row: Record<string, unknown> = {
    generation_job_id: log.generation_job_id,
    generated_question_id: log.generated_question_id,
    template_id: log.template_id,
    section: log.section,
    category: log.category,
    stage: log.stage,
    status: log.status,
    decision: log.decision,
    decision_reason: log.decision_reason,
    validation_results: log.validation_results,
    error_message: log.error_message,
    retry_count: log.retry_count,
    llm_model: log.llm_model,
    llm_tokens_used: log.llm_tokens_used,
    generation_duration_ms: log.generation_duration_ms,
    fingerprint_text: log.fingerprint_text,
    fingerprint_structure: log.fingerprint_structure,
  };

  const { data, error } = await supabase
    .from("generation_logs")
    .insert(row)
    .select("id")
    .single();

  if (error) return { id: null, error: error.message };
  return { id: data.id, error: null };
}
