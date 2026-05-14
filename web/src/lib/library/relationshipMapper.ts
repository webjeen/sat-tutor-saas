import type { PatternRecord, RWExtractedData, MathExtractedData } from "../extraction/types";
import type { PatternRelationship, RelationshipType, RelationshipEntityType } from "./types";
import { PREREQUISITE_MAP } from "./reasoningTemplates";

export function discoverRelationships(
  patterns: PatternRecord[]
): PatternRelationship[] {
  const relationships: PatternRelationship[] = [];

  relationships.push(...detectPrerequisites(patterns));
  relationships.push(...detectVariants(patterns));
  relationships.push(...detectComplements(patterns));
  relationships.push(...detectSupersets(patterns));

  return dedupRelationships(relationships);
}

export function detectPrerequisites(
  patterns: PatternRecord[]
): PatternRelationship[] {
  const relationships: PatternRelationship[] = [];

  // Group patterns by their type/domain
  const byCategory: Record<string, PatternRecord[]> = {};
  for (const p of patterns) {
    const key = getCategoryKey(p);
    if (!byCategory[key]) byCategory[key] = [];
    byCategory[key].push(p);
  }

  // For each category, check if its prerequisites exist in the pattern set
  for (const [category, categoryPatterns] of Object.entries(byCategory)) {
    const prereqs = PREREQUISITE_MAP[category] || [];
    for (const prereq of prereqs) {
      const prereqPatterns = byCategory[prereq];
      if (prereqPatterns) {
        // Link each pattern to at least one prerequisite pattern
        for (const p of categoryPatterns.slice(0, 3)) {
          const target = prereqPatterns[0];
          relationships.push({
            id: "",
            source_id: p.id,
            source_type: "pattern",
            target_id: target.id,
            target_type: "pattern",
            relationship_type: "prerequisite",
            strength: 0.9,
            evidence: { prerequisite_category: prereq, source_category: category },
            auto_detected: true,
            confirmed: false,
            created_at: "",
            updated_at: "",
          });
        }
      }
    }
  }

  return relationships;
}

export function detectVariants(
  patterns: PatternRecord[]
): PatternRelationship[] {
  const relationships: PatternRelationship[] = [];

  // Group by type + reasoning_pattern
  const byTypeReasoning: Record<string, PatternRecord[]> = {};
  for (const p of patterns) {
    const key = `${p.type}|${p.reasoning_pattern}`;
    if (!byTypeReasoning[key]) byTypeReasoning[key] = [];
    byTypeReasoning[key].push(p);
  }

  // Within each group, find pairs with different difficulty/distractor
  for (const group of Object.values(byTypeReasoning)) {
    if (group.length < 2) continue;

    for (let i = 0; i < group.length - 1; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];

        const differentDifficulty = a.difficulty_band !== b.difficulty_band;
        const differentDistractor = a.distractor_pattern !== b.distractor_pattern;

        if (differentDifficulty || differentDistractor) {
          relationships.push({
            id: "",
            source_id: a.id,
            source_type: "pattern",
            target_id: b.id,
            target_type: "pattern",
            relationship_type: "variant",
            strength: computeRelationshipStrength(a, b, "variant"),
            evidence: {
              shared_type: a.type,
              shared_reasoning: a.reasoning_pattern,
              diff_difficulty: differentDifficulty,
              diff_distractor: differentDistractor,
            },
            auto_detected: true,
            confirmed: false,
            created_at: "",
            updated_at: "",
          });
        }
      }
    }
  }

  return relationships;
}

export function detectComplements(
  patterns: PatternRecord[]
): PatternRelationship[] {
  const relationships: PatternRelationship[] = [];

  // Complements: different type but same passage structure (RW) or domain context (Math)
  for (let i = 0; i < patterns.length; i++) {
    for (let j = i + 1; j < patterns.length; j++) {
      const a = patterns[i];
      const b = patterns[j];

      if (a.section !== b.section) continue;
      if (a.type === b.type) continue; // Same type = not complement

      let isComplement = false;
      let evidence: Record<string, unknown> = {};

      if (a.section === "RW") {
        const aData = a.extracted_data as RWExtractedData;
        const bData = b.extracted_data as RWExtractedData;
        if (aData.passage_structure === bData.passage_structure) {
          isComplement = true;
          evidence = { shared_passage_structure: aData.passage_structure };
        }
      } else {
        const aData = a.extracted_data as MathExtractedData;
        const bData = b.extracted_data as MathExtractedData;
        if (aData.math_domain === bData.math_domain && aData.problem_solving_type !== bData.problem_solving_type) {
          isComplement = true;
          evidence = { shared_domain: aData.math_domain, different_approach: true };
        }
      }

      if (isComplement) {
        relationships.push({
          id: "",
          source_id: a.id,
          source_type: "pattern",
          target_id: b.id,
          target_type: "pattern",
          relationship_type: "complement",
          strength: computeRelationshipStrength(a, b, "complement"),
          evidence,
          auto_detected: true,
          confirmed: false,
          created_at: "",
          updated_at: "",
        });
      }
    }
  }

  return relationships;
}

export function detectSupersets(
  patterns: PatternRecord[]
): PatternRelationship[] {
  const relationships: PatternRelationship[] = [];

  // Superset: broader category contains narrower one
  // e.g., "Algebra" superset of "Linear"
  const supersets: Record<string, string[]> = {
    "AdvancedAlgebra": ["Quadratic", "Exponential", "Linear"],
    "Systems": ["Linear"],
    "Geometry": ["Linear"],
  };

  const byCategory: Record<string, PatternRecord[]> = {};
  for (const p of patterns) {
    const key = getCategoryKey(p);
    if (!byCategory[key]) byCategory[key] = [];
    byCategory[key].push(p);
  }

  for (const [superset, subsets] of Object.entries(supersets)) {
    const supersetPatterns = byCategory[superset];
    if (!supersetPatterns) continue;

    for (const subset of subsets) {
      const subsetPatterns = byCategory[subset];
      if (!subsetPatterns) continue;

      // Link representative patterns
      relationships.push({
        id: "",
        source_id: supersetPatterns[0].id,
        source_type: "pattern",
        target_id: subsetPatterns[0].id,
        target_type: "pattern",
        relationship_type: "superset",
        strength: 0.8,
        evidence: { superset_category: superset, subset_category: subset },
        auto_detected: true,
        confirmed: false,
        created_at: "",
        updated_at: "",
      });
    }
  }

  return relationships;
}

export function computeRelationshipStrength(
  patternA: PatternRecord,
  patternB: PatternRecord,
  _type: RelationshipType
): number {
  let overlap = 0;
  let fields = 0;

  if (patternA.section === patternB.section) overlap++;
  fields++;

  if (patternA.type === patternB.type) overlap++;
  fields++;

  if (patternA.reasoning_pattern === patternB.reasoning_pattern) overlap++;
  fields++;

  if (patternA.distractor_pattern === patternB.distractor_pattern) overlap++;
  fields++;

  return fields > 0 ? Math.round((overlap / fields) * 100) / 100 : 0;
}

export function getRelationshipsForEntity(
  entityId: string,
  entityType: RelationshipEntityType,
  allRelationships: PatternRelationship[]
): { outgoing: PatternRelationship[]; incoming: PatternRelationship[] } {
  const outgoing = allRelationships.filter(
    (r) => r.source_id === entityId && r.source_type === entityType
  );
  const incoming = allRelationships.filter(
    (r) => r.target_id === entityId && r.target_type === entityType
  );
  return { outgoing, incoming };
}

export function traverseGraph(
  startId: string,
  direction: "upstream" | "downstream",
  relationshipTypes: RelationshipType[],
  allRelationships: PatternRelationship[],
  maxDepth: number = 5
): PatternRelationship[] {
  const visited = new Set<string>();
  const result: PatternRelationship[] = [];
  const queue: { id: string; depth: number }[] = [{ id: startId, depth: 0 }];

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    if (depth >= maxDepth || visited.has(id)) continue;
    visited.add(id);

    const relevant = direction === "upstream"
      ? allRelationships.filter((r) => r.target_id === id && relationshipTypes.includes(r.relationship_type))
      : allRelationships.filter((r) => r.source_id === id && relationshipTypes.includes(r.relationship_type));

    for (const r of relevant) {
      if (!visited.has(r.source_id) || !visited.has(r.target_id)) {
        result.push(r);
        const nextId = direction === "upstream" ? r.source_id : r.target_id;
        queue.push({ id: nextId, depth: depth + 1 });
      }
    }
  }

  return result;
}

function getCategoryKey(pattern: PatternRecord): string {
  if (pattern.section === "RW") {
    return (pattern.extracted_data as RWExtractedData).question_type;
  }
  return (pattern.extracted_data as MathExtractedData).math_domain;
}

function dedupRelationships(relationships: PatternRelationship[]): PatternRelationship[] {
  const seen = new Set<string>();
  return relationships.filter((r) => {
    const key = `${r.source_id}|${r.source_type}|${r.target_id}|${r.target_type}|${r.relationship_type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
