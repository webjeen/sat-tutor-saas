import { supabase } from "./client";
import type { GenerationJob } from "../generation/types";

export async function saveGenerationJob(
  job: Omit<GenerationJob, "id" | "created_at" | "updated_at">
): Promise<{ id: string | null; error: string | null }> {
  const row: Record<string, unknown> = {
    template_id: job.template_id,
    section: job.section,
    category: job.category,
    difficulty_target: job.difficulty_target,
    question_count_requested: job.question_count_requested,
    question_count_generated: job.question_count_generated,
    question_count_approved: job.question_count_approved,
    status: job.status,
    processing_stage: job.processing_stage,
    retry_count: job.retry_count,
    error_message: job.error_message,
    last_processed_at: job.last_processed_at,
    started_at: job.started_at,
    completed_at: job.completed_at,
  };

  const { data, error } = await supabase
    .from("generation_jobs")
    .insert(row)
    .select("id")
    .single();

  if (error) return { id: null, error: error.message };
  return { id: data.id, error: null };
}

export async function updateGenerationJob(
  id: string,
  updates: Partial<GenerationJob>
): Promise<{ success: boolean; error: string | null }> {
  const { error } = await supabase
    .from("generation_jobs")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}
