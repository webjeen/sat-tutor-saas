import { supabase } from "./client";
import type { PatternTemplate } from "../library/types";

export async function saveTemplate(
  template: Omit<PatternTemplate, "id" | "created_at" | "updated_at">
): Promise<{ success: boolean; templateId?: string; error?: string }> {
  const row = {
    section: template.section,
    category: template.category,
    subcategory: template.subcategory,
    source_pattern_ids: template.source_pattern_ids,
    reasoning_flow: template.reasoning_flow as unknown as Record<string, unknown>[],
    distractor_strategy: template.distractor_strategy as unknown as Record<string, unknown>,
    difficulty_parameters: template.difficulty_parameters as unknown as Record<string, unknown>,
    constraint_rules: template.constraint_rules as unknown as Record<string, unknown>[],
    distractor_patterns: template.distractor_patterns,
    difficulty_bands: template.difficulty_bands,
    reasoning_depth: template.reasoning_depth,
    template_name: template.template_name,
    template_description: template.template_description,
    generation_readiness: template.generation_readiness,
    status: template.status,
    processing_stage: template.processing_stage,
    retry_count: template.retry_count,
    error_message: template.error_message,
    last_processed_at: template.last_processed_at,
    version: template.version,
    is_active: template.is_active,
    supersedes_id: template.supersedes_id,
  };

  const { data, error } = await supabase
    .from("pattern_templates")
    .insert(row)
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, templateId: data?.id };
}

export async function updateTemplate(
  templateId: string,
  updates: Partial<PatternTemplate>
): Promise<{ success: boolean; error?: string }> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (updates.status !== undefined) row.status = updates.status;
  if (updates.template_name !== undefined) row.template_name = updates.template_name;
  if (updates.template_description !== undefined) row.template_description = updates.template_description;
  if (updates.generation_readiness !== undefined) row.generation_readiness = updates.generation_readiness;
  if (updates.reasoning_flow !== undefined) row.reasoning_flow = updates.reasoning_flow;
  if (updates.distractor_strategy !== undefined) row.distractor_strategy = updates.distractor_strategy;
  if (updates.difficulty_parameters !== undefined) row.difficulty_parameters = updates.difficulty_parameters;
  if (updates.processing_stage !== undefined) row.processing_stage = updates.processing_stage;
  if (updates.error_message !== undefined) row.error_message = updates.error_message;

  const { error } = await supabase
    .from("pattern_templates")
    .update(row)
    .eq("id", templateId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}
