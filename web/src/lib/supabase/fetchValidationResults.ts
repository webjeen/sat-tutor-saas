import { supabase } from "./client";
import type { ValidationResultRow } from "../generation/types";

export interface ValidationResultFilters {
  generated_question_id?: string;
  template_id?: string;
  status?: string;
  all_checks_passed?: boolean;
  limit?: number;
}

export async function fetchValidationResults(
  filters?: ValidationResultFilters
): Promise<{ data: ValidationResultRow[] | null; error: string | null }> {
  let query = supabase
    .from("validation_results")
    .select("*")
    .order("created_at", { ascending: false });

  if (filters?.generated_question_id) query = query.eq("generated_question_id", filters.generated_question_id);
  if (filters?.template_id) query = query.eq("template_id", filters.template_id);
  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.all_checks_passed !== undefined) query = query.eq("all_checks_passed", filters.all_checks_passed);
  if (filters?.limit) query = query.limit(filters.limit);

  const { data, error } = await query;

  if (error) return { data: null, error: error.message };
  return { data: data as ValidationResultRow[], error: null };
}
