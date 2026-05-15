import { supabase } from "./client";
import type { WorksheetJob } from "../assembly/types";

export async function saveWorksheetJob(
  job: Omit<WorksheetJob, "id" | "created_at" | "updated_at">
): Promise<{ id: string | null; error: string | null }> {
  const row: Record<string, unknown> = {
    title: job.title,
    section: job.section,
    categories: job.categories,
    question_count: job.question_count,
    difficulty_mode: job.difficulty_mode,
    purpose: job.purpose,
    output_profile: job.output_profile,
    status: job.status,
    processing_stage: job.processing_stage,
    validation_result: job.validation_result,
    error_message: job.error_message,
    retry_count: job.retry_count,
    last_processed_at: job.last_processed_at,
  };

  const { data, error } = await supabase
    .from("worksheet_jobs")
    .insert(row)
    .select("id")
    .single();

  if (error) return { id: null, error: error.message };
  return { id: data.id, error: null };
}

export async function updateWorksheetJob(
  id: string,
  updates: Partial<WorksheetJob>
): Promise<{ success: boolean; error: string | null }> {
  const row: Record<string, unknown> = {
    ...updates,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("worksheet_jobs")
    .update(row)
    .eq("id", id);

  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}
