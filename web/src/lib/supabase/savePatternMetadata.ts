import { supabase } from "./client";
import type { PatternMetadata } from "../library/types";

export async function savePatternMetadata(
  metadata: Omit<PatternMetadata, "id" | "created_at" | "updated_at">
): Promise<{ success: boolean; metadataId?: string; error?: string }> {
  const row = {
    pattern_id: metadata.pattern_id,
    usage_count: metadata.usage_count,
    last_used_at: metadata.last_used_at,
    quality_score: metadata.quality_score,
    generation_success_rate: metadata.generation_success_rate,
    difficulty_calibration: metadata.difficulty_calibration,
    review_count: metadata.review_count,
    last_reviewed_at: metadata.last_reviewed_at,
    confidence_at_extraction: metadata.confidence_at_extraction,
    generation_readiness: metadata.generation_readiness,
    status: metadata.status,
    processing_stage: metadata.processing_stage,
    retry_count: metadata.retry_count,
    error_message: metadata.error_message,
    last_processed_at: metadata.last_processed_at,
  };

  const { data, error } = await supabase
    .from("pattern_metadata")
    .insert(row)
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, metadataId: data?.id };
}

export async function updatePatternMetadata(
  metadataId: string,
  updates: Partial<PatternMetadata>
): Promise<{ success: boolean; error?: string }> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (updates.usage_count !== undefined) row.usage_count = updates.usage_count;
  if (updates.last_used_at !== undefined) row.last_used_at = updates.last_used_at;
  if (updates.quality_score !== undefined) row.quality_score = updates.quality_score;
  if (updates.generation_readiness !== undefined) row.generation_readiness = updates.generation_readiness;
  if (updates.status !== undefined) row.status = updates.status;

  const { error } = await supabase
    .from("pattern_metadata")
    .update(row)
    .eq("id", metadataId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}
