import { supabase } from "./client";
import type { PatternMetadata } from "../library/types";

export async function fetchPatternMetadata(
  patternId: string
): Promise<{ data: PatternMetadata | null; error: string | null }> {
  const { data, error } = await supabase
    .from("pattern_metadata")
    .select("*")
    .eq("pattern_id", patternId)
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as PatternMetadata, error: null };
}

export async function fetchAllMetadata(
  minReadiness?: number
): Promise<{ data: PatternMetadata[] | null; error: string | null }> {
  let query = supabase
    .from("pattern_metadata")
    .select("*")
    .order("generation_readiness", { ascending: false });

  if (minReadiness) query = query.gte("generation_readiness", minReadiness);

  const { data, error } = await query;

  if (error) return { data: null, error: error.message };
  return { data: (data || []) as PatternMetadata[], error: null };
}
