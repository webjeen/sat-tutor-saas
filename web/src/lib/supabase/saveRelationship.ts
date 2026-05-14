import { supabase } from "./client";
import type { PatternRelationship } from "../library/types";

export async function saveRelationship(
  relationship: Omit<PatternRelationship, "id" | "created_at" | "updated_at">
): Promise<{ success: boolean; relationshipId?: string; error?: string }> {
  const row = {
    source_id: relationship.source_id,
    source_type: relationship.source_type,
    target_id: relationship.target_id,
    target_type: relationship.target_type,
    relationship_type: relationship.relationship_type,
    strength: relationship.strength,
    evidence: relationship.evidence,
    auto_detected: relationship.auto_detected,
    confirmed: relationship.confirmed,
  };

  const { data, error } = await supabase
    .from("pattern_relationships")
    .insert(row)
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, relationshipId: data?.id };
}

export async function saveRelationships(
  relationships: Array<Omit<PatternRelationship, "id" | "created_at" | "updated_at">>
): Promise<{ success: boolean; count?: number; error?: string }> {
  if (relationships.length === 0) return { success: true, count: 0 };

  const rows = relationships.map((r) => ({
    source_id: r.source_id,
    source_type: r.source_type,
    target_id: r.target_id,
    target_type: r.target_type,
    relationship_type: r.relationship_type,
    strength: r.strength,
    evidence: r.evidence,
    auto_detected: r.auto_detected,
    confirmed: r.confirmed,
  }));

  const { error } = await supabase
    .from("pattern_relationships")
    .insert(rows);

  if (error) return { success: false, error: error.message };
  return { success: true, count: rows.length };
}
