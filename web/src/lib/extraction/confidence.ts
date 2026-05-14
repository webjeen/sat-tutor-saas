import type {
  FieldConfidence,
  ExtractionConfidence,
  ConfidenceLevel,
} from "./types";

const LOW_CONFIDENCE_THRESHOLD = 0.5;
const MEDIUM_CONFIDENCE_THRESHOLD = 0.75;

export function classifyConfidence(score: number): ConfidenceLevel {
  if (score >= MEDIUM_CONFIDENCE_THRESHOLD) return "high";
  if (score >= LOW_CONFIDENCE_THRESHOLD) return "medium";
  return "low";
}

export function buildFieldConfidence(
  field: string,
  value: string,
  confidence: number,
  method: FieldConfidence["method"],
  signals: string[] = []
): FieldConfidence {
  return {
    field,
    value,
    confidence: Math.min(1, Math.max(0, confidence)),
    confidence_level: classifyConfidence(confidence),
    method,
    signals,
  };
}

// Weighted average: question_type and reasoning get double weight
const FIELD_WEIGHTS: Record<string, number> = {
  question_type: 2.0,
  reasoning_category: 2.0,
  math_domain: 2.0,
  distractor_pattern: 1.5,
  passage_structure: 1.0,
  transition_structure: 1.0,
  boundary_logic: 1.0,
  evidence_reasoning: 1.0,
  equation_structure: 1.5,
  problem_solving_type: 1.0,
  multi_step_reasoning: 1.0,
  symbolic_complexity: 1.0,
};

export function computeExtractionConfidence(
  fields: FieldConfidence[]
): ExtractionConfidence {
  let totalWeight = 0;
  let weightedSum = 0;

  for (const f of fields) {
    const weight = FIELD_WEIGHTS[f.field] ?? 1.0;
    weightedSum += f.confidence * weight;
    totalWeight += weight;
  }

  const overall = totalWeight > 0 ? weightedSum / totalWeight : 0;
  const lowConfidenceFields = fields
    .filter((f) => f.confidence_level === "low")
    .map((f) => f.field);

  return {
    overall: Math.round(overall * 1000) / 1000,
    overall_level: classifyConfidence(overall),
    fields,
    low_confidence_fields: lowConfidenceFields,
  };
}

// Tag-based classification is most confident, keyword less so, fallback least
export function tagConfidence(hasTag: boolean, tagMatched: boolean): number {
  if (hasTag && tagMatched) return 0.95;
  if (hasTag && !tagMatched) return 0.4;
  return 0;
}

export function keywordConfidence(
  matchCount: number,
  totalKeywords: number,
  secondBestCount: number
): number {
  if (matchCount === 0) return 0.15;
  const coverage = matchCount / totalKeywords;
  const gap = matchCount - secondBestCount;
  const dominance = gap >= 2 ? 0.15 : gap >= 1 ? 0.05 : 0;
  return Math.min(0.85, 0.4 + coverage * 0.3 + dominance);
}

export function heuristicConfidence(signals: number, minSignals: number): number {
  if (signals >= minSignals * 2) return 0.85;
  if (signals >= minSignals) return 0.65;
  if (signals > 0) return 0.4;
  return 0.2;
}

export function fallbackConfidence(): number {
  return 0.15;
}
