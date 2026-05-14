import { supabase } from "./client";
import type { GeneratedQuestion } from "../generation/types";

export interface GeneratedQuestionFilters {
  section?: string;
  category?: string;
  status?: string;
  difficulty_level?: string;
  approved_for_release?: boolean;
  template_id?: string;
  limit?: number;
  offset?: number;
}

export async function fetchGeneratedQuestions(
  filters?: GeneratedQuestionFilters
): Promise<{ data: GeneratedQuestion[] | null; total: number; error: string | null }> {
  let query = supabase
    .from("generated_questions")
    .select("*", { count: "exact" })
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (filters?.section) query = query.eq("section", filters.section);
  if (filters?.category) query = query.eq("category", filters.category);
  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.difficulty_level) query = query.eq("mapped_level", filters.difficulty_level);
  if (filters?.approved_for_release !== undefined) query = query.eq("approved_for_release", filters.approved_for_release);
  if (filters?.template_id) query = query.eq("template_id", filters.template_id);
  if (filters?.limit) query = query.limit(filters.limit);
  if (filters?.offset) query = query.range(filters.offset, filters.offset + (filters.limit || 20) - 1);

  const { data, count, error } = await query;

  if (error) return { data: null, total: 0, error: error.message };
  return { data: data as GeneratedQuestion[], total: count ?? 0, error: null };
}

export async function fetchGeneratedQuestionById(
  id: string
): Promise<{ data: GeneratedQuestion | null; error: string | null }> {
  const { data, error } = await supabase
    .from("generated_questions")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as GeneratedQuestion, error: null };
}
