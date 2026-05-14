export type { Section } from "../parser/types";
import type { Section } from "../parser/types";
export type { PatternRecord } from "../extraction/types";

// -- Library categories (broader than extraction types) --
// Per master-system-flow.md Stage 3 specification

export type RWCategory =
  | "Main-Idea"
  | "Inference"
  | "Transition"
  | "Function"
  | "Boundaries"
  | "Rhetorical"
  | "Evidence";

export type MathCategory =
  | "Linear"
  | "Quadratic"
  | "Exponential"
  | "Systems"
  | "Geometry"
  | "Trig"
  | "Statistics"
  | "AdvancedAlgebra";

export type LibraryCategory = RWCategory | MathCategory;

// -- Template status state machine --

export type TemplateStatus =
  | "template_draft"
  | "template_review_required"
  | "template_approved"
  | "template_active"
  | "template_deprecated"
  | "template_rejected";

export const TEMPLATE_TRANSITIONS: Record<TemplateStatus, TemplateStatus[]> = {
  template_draft: ["template_review_required", "template_rejected"],
  template_review_required: ["template_approved", "template_rejected"],
  template_approved: ["template_active", "template_deprecated"],
  template_active: ["template_deprecated"],
  template_deprecated: [],
  template_rejected: [],
};

// -- Reasoning flow --

export interface ReasoningStep {
  step: number;
  name: string;
  description: string;
  guidance: string;
}

// -- Distractor strategy --

export interface DistractorGenerationStrategy {
  primary_patterns: string[];
  secondary_patterns: string[];
  generation_guidance: Record<string, string>;
  minimum_distractors: number;
  quality_criteria: string[];
}

// -- Difficulty parameters --

export interface DifficultyParameters {
  score_range: { min: number; max: number };
  band_targets: { easy: number; medium: number; hard: number };
  factor_weights: Record<string, number>;
  timing_targets: { easy: string; medium: string; hard: string };
}

// -- Constraint rules --

export interface ConstraintRule {
  type: "hard" | "soft";
  field: string;
  operator: "eq" | "neq" | "in" | "not_in" | "range" | "exists";
  value: unknown;
  description: string;
}

// -- Pattern template record (maps to DB row) --

export interface PatternTemplate {
  id: string;
  section: Section;
  category: string;
  subcategory: string | null;
  source_pattern_ids: string[];
  reasoning_flow: ReasoningStep[];
  distractor_strategy: DistractorGenerationStrategy;
  difficulty_parameters: DifficultyParameters;
  constraint_rules: ConstraintRule[];
  distractor_patterns: string[];
  difficulty_bands: string[];
  reasoning_depth: string | null;
  template_name: string;
  template_description: string | null;
  generation_readiness: number;
  status: TemplateStatus;
  processing_stage: string | null;
  retry_count: number;
  error_message: string | null;
  last_processed_at: string | null;
  version: number;
  is_active: boolean;
  supersedes_id: string | null;
  created_at: string;
  updated_at: string;
}

// -- Distractor catalog entry --

export interface DistractorCatalogEntry {
  id: string;
  distractor_type: string;
  section: "RW" | "Math" | "both";
  strategy_description: string;
  generation_guidance: {
    rw_rules?: string[];
    math_rules?: string[];
    avoidance_rules?: string[];
  };
  quality_criteria: string[];
  example_signals: string[];
  effectiveness_rating: number;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

// -- Reasoning template record --

export interface ReasoningTemplate {
  id: string;
  section: Section;
  category: string;
  subcategory: string | null;
  template_name: string;
  flow_steps: ReasoningStep[];
  prerequisite_categories: string[];
  description: string | null;
  estimated_difficulty_band: string | null;
  cognitive_load: number;
  status: TemplateStatus;
  processing_stage: string | null;
  retry_count: number;
  error_message: string | null;
  last_processed_at: string | null;
  version: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// -- Pattern relationship --

export type RelationshipType = "prerequisite" | "variant" | "complement" | "superset";
export type RelationshipEntityType = "pattern" | "template";

export interface PatternRelationship {
  id: string;
  source_id: string;
  source_type: RelationshipEntityType;
  target_id: string;
  target_type: RelationshipEntityType;
  relationship_type: RelationshipType;
  strength: number;
  evidence: Record<string, unknown>;
  auto_detected: boolean;
  confirmed: boolean;
  created_at: string;
  updated_at: string;
}

// -- Pattern metadata --

export type MetadataStatus =
  | "metadata_pending"
  | "metadata_computed"
  | "metadata_review_required"
  | "metadata_active";

export interface PatternMetadata {
  id: string;
  pattern_id: string;
  usage_count: number;
  last_used_at: string | null;
  quality_score: number;
  generation_success_rate: number;
  difficulty_calibration: number;
  review_count: number;
  last_reviewed_at: string | null;
  confidence_at_extraction: number;
  generation_readiness: number;
  status: MetadataStatus;
  processing_stage: string | null;
  retry_count: number;
  error_message: string | null;
  last_processed_at: string | null;
  created_at: string;
  updated_at: string;
}

// -- Library search/filter --

export interface LibrarySearchFilters {
  section?: string;
  category?: string;
  subcategory?: string;
  status?: string;
  distractor_pattern?: string;
  difficulty_band?: string;
  reasoning_depth?: string;
  min_readiness?: number;
  query?: string;
  limit?: number;
  offset?: number;
}

export interface RelationshipQueryFilters {
  source_id?: string;
  source_type?: RelationshipEntityType;
  target_id?: string;
  target_type?: RelationshipEntityType;
  relationship_type?: RelationshipType;
  min_strength?: number;
  confirmed_only?: boolean;
  limit?: number;
  offset?: number;
}

// -- Template builder input/output --

export interface TemplateBuilderInput {
  sourcePatterns: import("../extraction/types").PatternRecord[];
  category: LibraryCategory;
  section: Section;
  subcategory?: string;
}

export interface TemplateBuilderResult {
  template: PatternTemplate;
  relationships: PatternRelationship[];
  metadata: PatternMetadata[];
  builderStats: {
    patternsConsumed: number;
    reasoningFlowSteps: number;
    distractorPatternsCovered: string[];
    averageConfidence: number;
  };
}

// -- Library build result --

export interface LibraryBuildResult {
  success: boolean;
  templatesCreated: number;
  relationshipsCreated: number;
  metadataComputed: number;
  errors: string[];
  durationMs: number;
}
