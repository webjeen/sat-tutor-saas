import { supabase } from "./client";
import type { PatternRelationship, RelationshipQueryFilters } from "../library/types";

export async function fetchRelationships(
  filters?: RelationshipQueryFilters
): Promise<{ data: PatternRelationship[] | null; error: string | null }> {
  let query = supabase
    .from("pattern_relationships")
    .select("*")
    .order("created_at", { ascending: false });

  if (filters?.source_id) query = query.eq("source_id", filters.source_id);
  if (filters?.source_type) query = query.eq("source_type", filters.source_type);
  if (filters?.target_id) query = query.eq("target_id", filters.target_id);
  if (filters?.target_type) query = query.eq("target_type", filters.target_type);
  if (filters?.relationship_type) query = query.eq("relationship_type", filters.relationship_type);
  if (filters?.min_strength) query = query.gte("strength", filters.min_strength);
  if (filters?.confirmed_only) query = query.eq("confirmed", true);
  if (filters?.limit) query = query.limit(filters.limit);
  if (filters?.offset) query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);

  const { data, error } = await query;

  if (error) return { data: null, error: error.message };
  return { data: (data || []) as PatternRelationship[], error: null };
}
