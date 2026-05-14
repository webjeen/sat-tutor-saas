import { supabase } from "./client";
import type { DistractorCatalogEntry } from "../library/types";

export async function fetchDistractorCatalog(
  section?: string
): Promise<{ data: DistractorCatalogEntry[] | null; error: string | null }> {
  let query = supabase
    .from("distractor_catalog")
    .select("*")
    .order("distractor_type");

  if (section) {
    query = query.or(`section.eq.${section},section.eq.both`);
  }

  const { data, error } = await query;

  if (error) return { data: null, error: error.message };
  return { data: (data || []) as DistractorCatalogEntry[], error: null };
}

export async function fetchDistractorByType(
  distractorType: string
): Promise<{ data: DistractorCatalogEntry | null; error: string | null }> {
  const { data, error } = await supabase
    .from("distractor_catalog")
    .select("*")
    .eq("distractor_type", distractorType)
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as DistractorCatalogEntry, error: null };
}
