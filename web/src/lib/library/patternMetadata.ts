import type { PatternMetadata } from "./types";
import type { PatternRecord } from "../extraction/types";
import type { PatternRelationship } from "./types";

export function computePatternMetadata(
  pattern: PatternRecord
): PatternMetadata {
  const completeness = computeCompleteness(pattern);
  const validationScore = computeValidationScore(pattern);
  const confidence = 0.7; // Default — would come from extraction confidence in production

  return {
    id: "",
    pattern_id: pattern.id,
    usage_count: 0,
    last_used_at: null,
    quality_score: Math.round((completeness * 0.6 + validationScore * 0.4) * 100) / 100,
    generation_success_rate: 0,
    difficulty_calibration: 0,
    review_count: 0,
    last_reviewed_at: null,
    confidence_at_extraction: confidence,
    generation_readiness: Math.round((completeness * 0.30 + confidence * 0.30 + validationScore * 0.25 + 0 * 0.15) * 100) / 100,
    status: "metadata_computed",
    processing_stage: null,
    retry_count: 0,
    error_message: null,
    last_processed_at: null,
    created_at: "",
    updated_at: "",
  };
}

export function computeGenerationReadiness(
  pattern: PatternRecord,
  relationships: PatternRelationship[]
): number {
  const completeness = computeCompleteness(pattern);
  const confidence = 0.7;
  const validationScore = computeValidationScore(pattern);
  const relationshipCoverage = computeRelationshipCoverage(relationships);

  return Math.min(1, Math.round(
    (completeness * 0.30 + confidence * 0.30 + validationScore * 0.25 + relationshipCoverage * 0.15) * 100
  ) / 100);
}

export function computeCompleteness(
  pattern: PatternRecord
): number {
  const data = pattern.extracted_data;
  const values = Object.values(data);
  const total = values.length;
  if (total === 0) return 0;

  const populated = values.filter((v) => v && v !== "" && v !== "unknown").length;
  return Math.round((populated / total) * 100) / 100;
}

export function computeValidationScore(
  pattern: PatternRecord
): number {
  // Auto-approved from candidate: high score
  // Approved after review: moderate score
  // Currently under review or other: low score
  if (pattern.status === "pattern_active") return 1.0;
  if (pattern.status === "pattern_approved") return 0.85;
  if (pattern.status === "pattern_review_required") return 0.5;
  if (pattern.status === "pattern_candidate") return 0.3;
  return 0.1;
}

export function computeRelationshipCoverage(
  relationships: PatternRelationship[]
): number {
  let score = 0;
  const types = new Set(relationships.map((r) => r.relationship_type));

  if (types.has("prerequisite")) score += 0.3;
  if (types.has("variant")) score += 0.3;
  if (types.has("complement")) score += 0.2;
  if (types.has("superset")) score += 0.2;

  return Math.min(1, score);
}

export function batchComputeMetadata(
  patterns: PatternRecord[]
): PatternMetadata[] {
  return patterns.map(computePatternMetadata);
}
