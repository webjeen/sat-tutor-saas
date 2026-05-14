import { supabase } from "./client";
import { SEED_REASONING_TEMPLATES } from "../library/reasoningTemplates";

export async function seedReasoningTemplates(): Promise<{ success: boolean; error?: string }> {
  const rows = SEED_REASONING_TEMPLATES.map((entry) => ({
    section: entry.section,
    category: entry.category,
    subcategory: entry.subcategory,
    template_name: entry.template_name,
    flow_steps: entry.flow_steps,
    prerequisite_categories: entry.prerequisite_categories,
    description: entry.description,
    estimated_difficulty_band: entry.estimated_difficulty_band,
    cognitive_load: entry.cognitive_load,
    status: entry.status,
    version: entry.version,
    is_active: entry.is_active,
  }));

  const { error } = await supabase
    .from("reasoning_templates")
    .insert(rows);

  if (error) return { success: false, error: error.message };
  return { success: true };
}
