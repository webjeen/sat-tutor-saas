import { supabase } from "../supabase/client";
import type { PatternTemplate } from "../library/types";
import type { ResolvedTemplate, DistractorCatalogEntry, GenerationJobConfig } from "./types";
import { GENERATION_CONFIG } from "./config";
import { getReasoningFlow } from "../library/reasoningTemplates";

export async function resolveTemplates(
  config: GenerationJobConfig
): Promise<{ templates: ResolvedTemplate[]; error: string | null }> {
  const { section, category, templateId } = config;

  let query = supabase
    .from("pattern_templates")
    .select("*")
    .eq("section", section)
    .eq("category", category)
    .eq("status", "template_active")
    .eq("is_active", true)
    .gte("generation_readiness", GENERATION_CONFIG.pipeline.minTemplateReadiness)
    .order("generation_readiness", { ascending: false });

  if (templateId) {
    query = query.eq("id", templateId);
  }

  const { data, error } = await query;

  if (error) {
    return { templates: [], error: `Failed to query templates: ${error.message}` };
  }

  if (!data || data.length === 0) {
    return {
      templates: [],
      error: `No active templates found for ${section}/${category} with readiness >= ${GENERATION_CONFIG.pipeline.minTemplateReadiness}`,
    };
  }

  const resolved: ResolvedTemplate[] = [];
  for (const row of data) {
    const template = row as PatternTemplate;
    const entries = await loadDistractorCatalogEntries(template.distractor_patterns);
    const reasoningFlowSteps = getReasoningFlow(section, category);

    resolved.push({
      template,
      distractorCatalogEntries: entries,
      reasoningFlowSteps,
    });
  }

  return { templates: resolved, error: null };
}

export function rotateTemplate(
  templates: ResolvedTemplate[],
  previousTemplateId: string | null
): ResolvedTemplate | null {
  if (templates.length === 0) return null;
  if (!previousTemplateId) return templates[0];

  const currentIndex = templates.findIndex(
    (t) => t.template.id === previousTemplateId
  );
  const nextIndex = (currentIndex + 1) % templates.length;
  return templates[nextIndex];
}

async function loadDistractorCatalogEntries(
  distractorPatterns: string[]
): Promise<DistractorCatalogEntry[]> {
  if (distractorPatterns.length === 0) return [];

  const { data, error } = await supabase
    .from("distractor_catalog")
    .select("*")
    .in("distractor_type", distractorPatterns);

  if (error || !data) return [];

  return data.map((row) => row as DistractorCatalogEntry);
}
