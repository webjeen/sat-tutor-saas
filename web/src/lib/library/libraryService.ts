import type {
  Section,
  LibraryCategory,
  PatternTemplate,
  PatternRelationship,
  PatternMetadata,
  TemplateBuilderResult,
  LibraryBuildResult,
} from "./types";
import type { PatternRecord, RWExtractedData, MathExtractedData } from "../extraction/types";
import { buildTemplate, classifyCategory } from "./templateBuilder";
import { discoverRelationships } from "./relationshipMapper";
import { computePatternMetadata, computeGenerationReadiness } from "./patternMetadata";
import { fetchPatterns } from "../supabase/fetchPatterns";
import { saveTemplate } from "../supabase/saveTemplate";
import { saveRelationships } from "../supabase/saveRelationship";
import { savePatternMetadata } from "../supabase/savePatternMetadata";
import { seedDistractorCatalog } from "../supabase/saveDistractorCatalog";
import { seedReasoningTemplates } from "../supabase/saveReasoningTemplate";

export async function buildPatternLibrary(
  options?: { section?: Section; category?: LibraryCategory }
): Promise<LibraryBuildResult> {
  const startMs = Date.now();
  const errors: string[] = [];
  let templatesCreated = 0;
  let relationshipsCreated = 0;
  let metadataComputed = 0;

  // Fetch all pattern_active patterns
  const { data: patterns, error: fetchError } = await fetchPatterns({
    status: "pattern_active",
    section: options?.section,
  });

  if (fetchError || !patterns || patterns.length === 0) {
    return {
      success: false,
      templatesCreated: 0,
      relationshipsCreated: 0,
      metadataComputed: 0,
      errors: [fetchError || "No active patterns found"],
      durationMs: Date.now() - startMs,
    };
  }

  // Group patterns by section + category
  const groups = groupPatterns(patterns, options?.category);

  // Build templates for each group
  const allTemplates: PatternTemplate[] = [];
  const allRelationships: PatternRelationship[] = [];
  const allMetadata: PatternMetadata[] = [];

  for (const [groupKey, groupPatterns] of Object.entries(groups)) {
    try {
      const [section, category] = groupKey.split("|") as [Section, LibraryCategory];
      const result = buildTemplate({
        sourcePatterns: groupPatterns,
        category,
        section,
      });

      // Save template
      const saveResult = await saveTemplate(result.template);
      if (!saveResult.success) {
        errors.push(`Template save failed for ${groupKey}: ${saveResult.error}`);
        continue;
      }

      result.template.id = saveResult.templateId || "";
      allTemplates.push(result.template);
      templatesCreated++;

      // Save metadata for source patterns
      for (const p of groupPatterns) {
        try {
          const metadata = computePatternMetadata(p);
          metadata.pattern_id = p.id;
          const metaResult = await savePatternMetadata(metadata);
          if (metaResult.success) {
            metadata.id = metaResult.metadataId || "";
            allMetadata.push(metadata);
            metadataComputed++;
          } else {
            errors.push(`Metadata save failed for pattern ${p.id}: ${metaResult.error}`);
          }
        } catch (err) {
          errors.push(`Metadata computation failed for pattern ${p.id}: ${err}`);
        }
      }
    } catch (err) {
      errors.push(`Template build failed for ${groupKey}: ${err}`);
    }
  }

  // Discover relationships across all patterns
  try {
    const relationships = discoverRelationships(patterns);
    if (relationships.length > 0) {
      const relResult = await saveRelationships(relationships);
      if (relResult.success) {
        allRelationships.push(...relationships);
        relationshipsCreated = relResult.count || 0;
      } else {
        errors.push(`Relationship save failed: ${relResult.error}`);
      }
    }
  } catch (err) {
    errors.push(`Relationship discovery failed: ${err}`);
  }

  // Update generation readiness with relationship coverage
  for (const template of allTemplates) {
    if (!template.id) continue;
    const relsForTemplate = allRelationships.filter(
      (r) => r.source_id === template.id || r.target_id === template.id
    );
    if (relsForTemplate.length > 0) {
      // Re-compute readiness with relationship coverage
      const sourcePatterns = patterns.filter((p) =>
        template.source_pattern_ids.includes(p.id)
      );
      const newReadiness = computeGenerationReadiness(sourcePatterns[0], relsForTemplate);
      if (newReadiness > template.generation_readiness) {
        const { updateTemplate } = await import("../supabase/saveTemplate");
        await updateTemplate(template.id, { generation_readiness: newReadiness });
      }
    }
  }

  return {
    success: errors.length === 0,
    templatesCreated,
    relationshipsCreated,
    metadataComputed,
    errors,
    durationMs: Date.now() - startMs,
  };
}

export async function buildTemplatesForCategory(
  section: Section,
  category: LibraryCategory
): Promise<TemplateBuilderResult[]> {
  const { data: patterns } = await fetchPatterns({
    section,
    status: "pattern_active",
  });

  if (!patterns || patterns.length === 0) return [];

  const filtered = patterns.filter((p) => {
    if (section === "RW") {
      const data = p.extracted_data as RWExtractedData;
      return data.question_type === category;
    }
    const data = p.extracted_data as MathExtractedData;
    return data.math_domain === (category as string);
  });

  if (filtered.length === 0) return [];

  const result = buildTemplate({
    sourcePatterns: filtered,
    category,
    section,
  });

  return [result];
}

export async function seedLibraryData(): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];

  const catalogResult = await seedDistractorCatalog();
  if (!catalogResult.success) errors.push(`Distractor catalog: ${catalogResult.error}`);

  const reasoningResult = await seedReasoningTemplates();
  if (!reasoningResult.success) errors.push(`Reasoning templates: ${reasoningResult.error}`);

  return { success: errors.length === 0, errors };
}

export async function refreshPatternMetadata(): Promise<{ updated: number; errors: string[] }> {
  const errors: string[] = [];
  let updated = 0;

  const { data: patterns } = await fetchPatterns({ status: "pattern_active" });
  if (!patterns) return { updated: 0, errors: ["No active patterns found"] };

  for (const p of patterns) {
    try {
      const metadata = computePatternMetadata(p);
      const result = await savePatternMetadata(metadata);
      if (result.success) updated++;
      else errors.push(`Pattern ${p.id}: ${result.error}`);
    } catch (err) {
      errors.push(`Pattern ${p.id}: ${err}`);
    }
  }

  return { updated, errors };
}

function groupPatterns(
  patterns: PatternRecord[],
  targetCategory?: LibraryCategory
): Record<string, PatternRecord[]> {
  const groups: Record<string, PatternRecord[]> = {};

  for (const p of patterns) {
    const category = classifyCategory([p], p.section as Section);
    if (targetCategory && category !== targetCategory) continue;

    const key = `${p.section}|${category}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  }

  return groups;
}
