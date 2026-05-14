import type { LibrarySearchFilters, PatternTemplate, RelationshipQueryFilters, PatternRelationship } from "./types";
import { fetchTemplates } from "../supabase/fetchTemplates";
import { fetchRelationships } from "../supabase/fetchRelationships";

export async function searchTemplates(
  filters: LibrarySearchFilters
): Promise<{ data: PatternTemplate[] | null; error: string | null; total?: number }> {
  return fetchTemplates(filters);
}

export async function searchRelationships(
  filters: RelationshipQueryFilters
): Promise<{ data: PatternRelationship[] | null; error: string | null }> {
  return fetchRelationships(filters);
}

export async function searchTemplatesByText(
  query: string,
  limit: number = 20
): Promise<{ data: PatternTemplate[] | null; error: string | null }> {
  return fetchTemplates({ query, limit });
}

export async function getTemplatesByCategory(
  section: string,
  category: string,
  subcategory?: string
): Promise<{ data: PatternTemplate[] | null; error: string | null }> {
  return fetchTemplates({ section, category, subcategory });
}

export async function getPrerequisiteChain(
  templateId: string
): Promise<{ data: PatternTemplate[] | null; error: string | null }> {
  // Fetch all relationships involving this template, then traverse upstream
  const { data: rels, error } = await fetchRelationships({
    source_type: "template",
    relationship_type: "prerequisite",
    limit: 100,
  });

  if (error || !rels) return { data: null, error };

  // Collect prerequisite template IDs by traversing
  const visited = new Set<string>();
  const templateIds: string[] = [];
  const queue = [templateId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const prereqRels = rels.filter((r) => r.source_id === currentId);
    for (const r of prereqRels) {
      if (!visited.has(r.target_id)) {
        templateIds.push(r.target_id);
        queue.push(r.target_id);
      }
    }
  }

  if (templateIds.length === 0) return { data: [], error: null };

  // Fetch the prerequisite templates
  const { data: templates, error: fetchError } = await fetchTemplates({
    status: "template_active",
    limit: 50,
  });

  if (fetchError || !templates) return { data: null, error: fetchError };

  const prereqTemplates = templates.filter((t) => templateIds.includes(t.id));
  return { data: prereqTemplates, error: null };
}

export async function getRelatedTemplates(
  templateId: string,
  relationshipTypes?: string[]
): Promise<{ data: PatternTemplate[] | null; error: string | null }> {
  const types = relationshipTypes || ["variant", "complement", "superset"];

  const { data: rels, error } = await fetchRelationships({
    source_id: templateId,
    source_type: "template",
    limit: 50,
  });

  if (error || !rels) return { data: null, error };

  const filtered = rels.filter((r) => types.includes(r.relationship_type));
  const relatedIds = filtered.map((r) => r.target_id);

  if (relatedIds.length === 0) return { data: [], error: null };

  const { data: templates, error: fetchError } = await fetchTemplates({
    status: "template_active",
    limit: 50,
  });

  if (fetchError || !templates) return { data: null, error: fetchError };

  const related = templates.filter((t) => relatedIds.includes(t.id));
  return { data: related, error: null };
}
