import { supabase } from "./client";
import type { PatternRecord, PatternFilters } from "../extraction/types";

export async function fetchPatterns(
  filters?: PatternFilters
): Promise<{ data: PatternRecord[] | null; error: string | null }> {
  let query = supabase
    .from("patterns")
    .select("*")
    .order("created_at", { ascending: false });

  if (filters?.section) {
    query = query.eq("section", filters.section);
  }
  if (filters?.type) {
    query = query.eq("type", filters.type);
  }
  if (filters?.status) {
    query = query.eq("status", filters.status);
  }
  if (filters?.limit) {
    query = query.limit(filters.limit);
  }
  if (filters?.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
  }

  const { data, error } = await query;

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: (data || []) as PatternRecord[], error: null };
}

export async function fetchPatternById(
  patternId: string
): Promise<{ data: PatternRecord | null; error: string | null }> {
  const { data, error } = await supabase
    .from("patterns")
    .select("*")
    .eq("id", patternId)
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: data as PatternRecord, error: null };
}

export async function updatePatternStatus(
  patternId: string,
  newStatus: string,
  decisionReason?: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("patterns")
    .update({
      status: newStatus,
      last_processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", patternId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
