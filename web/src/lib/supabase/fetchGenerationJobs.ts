import { supabase } from "./client";
import type { GenerationJob } from "../generation/types";

export interface GenerationJobFilters {
  status?: string;
  section?: string;
  category?: string;
  limit?: number;
}

export async function fetchGenerationJobs(
  filters?: GenerationJobFilters
): Promise<{ data: GenerationJob[] | null; error: string | null }> {
  let query = supabase
    .from("generation_jobs")
    .select("*")
    .order("created_at", { ascending: false });

  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.section) query = query.eq("section", filters.section);
  if (filters?.category) query = query.eq("category", filters.category);
  if (filters?.limit) query = query.limit(filters.limit);

  const { data, error } = await query;

  if (error) return { data: null, error: error.message };
  return { data: data as GenerationJob[], error: null };
}

export async function fetchGenerationJobById(
  id: string
): Promise<{ data: GenerationJob | null; error: string | null }> {
  const { data, error } = await supabase
    .from("generation_jobs")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as GenerationJob, error: null };
}
