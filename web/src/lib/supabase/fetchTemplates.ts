import { supabase } from "./client";
import type { PatternTemplate, LibrarySearchFilters } from "../library/types";

export async function fetchTemplates(
  filters?: LibrarySearchFilters
): Promise<{ data: PatternTemplate[] | null; error: string | null; total?: number }> {
  let query = supabase
    .from("pattern_templates")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (filters?.section) query = query.eq("section", filters.section);
  if (filters?.category) query = query.eq("category", filters.category);
  if (filters?.subcategory) query = query.eq("subcategory", filters.subcategory);
  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.reasoning_depth) query = query.eq("reasoning_depth", filters.reasoning_depth);
  if (filters?.min_readiness) query = query.gte("generation_readiness", filters.min_readiness);
  if (filters?.distractor_pattern) query = query.contains("distractor_patterns", [filters.distractor_pattern]);
  if (filters?.difficulty_band) query = query.contains("difficulty_bands", [filters.difficulty_band]);
  if (filters?.query) query = query.textSearch("template_name", filters.query);
  if (filters?.limit) query = query.limit(filters.limit);
  if (filters?.offset) query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);

  const { data, error, count } = await query;

  if (error) return { data: null, error: error.message };
  return { data: (data || []) as PatternTemplate[], error: null, total: count || 0 };
}

export async function fetchTemplateById(
  templateId: string
): Promise<{ data: PatternTemplate | null; error: string | null }> {
  const { data, error } = await supabase
    .from("pattern_templates")
    .select("*")
    .eq("id", templateId)
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as PatternTemplate, error: null };
}

export async function updateTemplateStatus(
  templateId: string,
  newStatus: string,
  decisionReason?: string
): Promise<{ success: boolean; error?: string }> {
  const updateData: Record<string, unknown> = {
    status: newStatus,
    last_processed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (decisionReason) updateData.error_message = decisionReason;

  const { error } = await supabase
    .from("pattern_templates")
    .update(updateData)
    .eq("id", templateId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}
