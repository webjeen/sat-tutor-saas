import { supabase } from "./client";
import { DISTRACTOR_CATALOG_SEED } from "../library/distractorCatalog";

export async function seedDistractorCatalog(): Promise<{ success: boolean; error?: string }> {
  const rows = DISTRACTOR_CATALOG_SEED.map((entry) => ({
    distractor_type: entry.distractor_type,
    section: entry.section,
    strategy_description: entry.strategy_description,
    generation_guidance: entry.generation_guidance,
    quality_criteria: entry.quality_criteria,
    example_signals: entry.example_signals,
    effectiveness_rating: entry.effectiveness_rating,
    usage_count: entry.usage_count,
  }));

  const { error } = await supabase
    .from("distractor_catalog")
    .upsert(rows, { onConflict: "distractor_type" });

  if (error) return { success: false, error: error.message };
  return { success: true };
}
