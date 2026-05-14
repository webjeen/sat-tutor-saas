import { supabase } from "./client";
import type { GenerationLog } from "../generation/types";

export interface GenerationLogFilters {
  job_id?: string;
  template_id?: string;
  stage?: string;
  status?: string;
  limit?: number;
}

export async function fetchGenerationLogs(
  filters?: GenerationLogFilters
): Promise<{ data: GenerationLog[] | null; error: string | null }> {
  let query = supabase
    .from("generation_logs")
    .select("*")
    .order("created_at", { ascending: false });

  if (filters?.job_id) query = query.eq("generation_job_id", filters.job_id);
  if (filters?.template_id) query = query.eq("template_id", filters.template_id);
  if (filters?.stage) query = query.eq("stage", filters.stage);
  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.limit) query = query.limit(filters.limit);

  const { data, error } = await query;

  if (error) return { data: null, error: error.message };
  return { data: data as GenerationLog[], error: null };
}
