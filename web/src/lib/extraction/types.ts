export type { Section } from "../parser/types";
import type { Section } from "../parser/types";

// -- Pattern state model (pattern-taxonomy.md section 6) --
export type PatternStatus =
  | "pattern_candidate"
  | "pattern_review_required"
  | "pattern_approved"
  | "pattern_active"
  | "pattern_deprecated"
  | "pattern_rejected";

// -- Extraction stages --
export type ExtractionStage =
  | "fetch"
  | "extract"
  | "validate"
  | "dedup_check"
  | "store"
  | "complete";

export type ExtractionStatus =
  | "success"
  | "failed"
  | "review_required"
  | "skipped";

export type ExtractionDecision =
  | "approve"
  | "reject"
  | "review";

// -- Difficulty (difficulty-spec.md) --
export type DifficultyBand = "easy" | "medium" | "hard";

// -- RW Pattern Types (pattern-taxonomy.md section 8) --
export type RWPatternType =
  | "Main-Idea"
  | "Function"
  | "Inference"
  | "Evidence"
  | "Vocabulary"
  | "Transition"
  | "Grammar"
  | "Rhetorical";

export type RWReasoningCategory =
  | "literal_comprehension"
  | "inferential_reasoning"
  | "textual_evidence"
  | "rhetorical_analysis"
  | "vocabulary_in_context"
  | "structural_analysis";

export type PassageStructure =
  | "narrative"
  | "argumentative"
  | "expository"
  | "paired_passage"
  | "literary";

export type DistractorPattern =
  | "opposite"
  | "partial_truth"
  | "out_of_scope"
  | "extreme_language"
  | "misleading_association"
  | "sound_alike"
  | "conceptual_confusion";

export type TransitionStructure =
  | "contrast"
  | "cause_effect"
  | "addition"
  | "sequence"
  | "example"
  | "none";

export type BoundaryLogic =
  | "paragraph_boundary"
  | "sentence_boundary"
  | "phrase_boundary"
  | "cross_paragraph";

export type EvidenceReasoning =
  | "direct_quote"
  | "paraphrase"
  | "implication"
  | "synthesis"
  | "negation";

// -- Math Pattern Types (pattern-taxonomy.md section 9) --
export type MathPatternType =
  | "Algebra"
  | "Graph"
  | "Trigonometry"
  | "Statistics"
  | "WordProblem";

export type MathDomain =
  | "linear_equations"
  | "systems_of_equations"
  | "quadratic"
  | "exponential"
  | "polynomial"
  | "rational_expressions"
  | "geometry"
  | "trigonometry"
  | "statistics_probability"
  | "advanced_math";

export type EquationStructure =
  | "single_variable"
  | "multi_variable"
  | "system"
  | "inequality"
  | "function"
  | "none";

export type ProblemSolvingType =
  | "direct_calculation"
  | "setup_and_solve"
  | "interpretation"
  | "modeling"
  | "estimation";

export type MultiStepReasoning =
  | "single_step"
  | "two_step"
  | "multi_step"
  | "chained_reasoning";

export type SymbolicComplexity =
  | "numeric_only"
  | "single_variable"
  | "multi_variable"
  | "abstract_notation";

// -- Shared complexity types --
export type TimingComplexity = "quick" | "moderate" | "extended";

export type SyntaxComplexity = "simple" | "moderate" | "complex";

export type AbstractionLevel = "concrete" | "moderate" | "abstract";

// -- Confidence scoring --
export type ConfidenceLevel = "high" | "medium" | "low";

export interface FieldConfidence {
  field: string;
  value: string;
  confidence: number;       // 0–1
  confidence_level: ConfidenceLevel;
  method: "tag" | "keyword" | "heuristic" | "fallback";
  signals: string[];        // what triggered this classification
}

export interface ExtractionConfidence {
  overall: number;          // 0–1, weighted average of field confidences
  overall_level: ConfidenceLevel;
  fields: FieldConfidence[];
  low_confidence_fields: string[];
}

// -- RW Extracted Pattern Data --
export interface RWExtractedData {
  question_type: RWPatternType;
  reasoning_category: RWReasoningCategory;
  passage_structure: PassageStructure;
  distractor_pattern: DistractorPattern;
  transition_structure: TransitionStructure;
  boundary_logic: BoundaryLogic;
  evidence_reasoning: EvidenceReasoning;
}

// -- Math Extracted Pattern Data --
export interface MathExtractedData {
  question_type: MathPatternType;
  math_domain: MathDomain;
  equation_structure: EquationStructure;
  problem_solving_type: ProblemSolvingType;
  distractor_pattern: DistractorPattern;
  multi_step_reasoning: MultiStepReasoning;
  symbolic_complexity: SymbolicComplexity;
}

// -- Unified extracted data union --
export type SectionExtractedData = RWExtractedData | MathExtractedData;

// -- Required output structure (task spec) --
export interface PatternOutput {
  question_type: string;
  reasoning_pattern: string;
  difficulty_band: string;
  distractor_pattern: string;
  timing_complexity: string;
  syntax_complexity: string;
  abstraction_level: string;
}

// -- Pattern record (maps to DB row) --
export interface PatternRecord {
  id: string;
  source_question_id: string | null;
  exam_family: string;
  section: Section;
  type: string;
  skill: string | null;
  difficulty_band: string | null;
  extracted_data: SectionExtractedData;
  reasoning_pattern: string | null;
  distractor_pattern: string | null;
  timing_complexity: string | null;
  syntax_complexity: string | null;
  abstraction_level: string | null;
  structure: string | null;
  logic: string | null;
  trap: string | null;
  difficulty_level: string | null;
  status: PatternStatus;
  processing_stage: string | null;
  retry_count: number;
  error_message: string | null;
  last_processed_at: string | null;
  version: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// -- Extraction validation --
export interface ExtractionValidationError {
  field: string;
  reason: string;
  severity: "reject" | "review";
}

export interface ExtractionValidationResult {
  valid: boolean;
  decision: ExtractionDecision;
  errors: ExtractionValidationError[];
  reason: string;
}

// -- Extraction results --
export interface ExtractionResult {
  questionId: string;
  section: Section;
  extractedData: SectionExtractedData;
  patternOutput: PatternOutput;
  confidence: ExtractionConfidence;
  validation: ExtractionValidationResult;
}

export interface BatchExtractionResult {
  success: boolean;
  extracted: number;
  failed: number;
  reviewRequired: number;
  skipped: number;
  results: ExtractionResult[];
  errors: ExtractionResult[];
  batchStats: BatchExtractionStats;
}

export interface BatchExtractionStats {
  totalProcessed: number;
  averageConfidence: number;
  lowConfidenceCount: number;
  tagBasedCount: number;
  keywordBasedCount: number;
  fallbackCount: number;
  sectionBreakdown: Record<string, { count: number; avgConfidence: number }>;
  durationMs: number;
}

// -- Extraction log record (maps to DB row) --
export interface ExtractionLogRecord {
  id?: string;
  source_question_id: string;
  pattern_id: string | null;
  section: Section;
  extraction_stage: ExtractionStage;
  status: ExtractionStatus;
  decision: ExtractionDecision | null;
  decision_reason: string | null;
  validation_results: Record<string, unknown>;
  error_message: string | null;
  retry_count: number;
  extraction_duration_ms: number | null;
  fingerprint_text: string | null;
  fingerprint_structure: string | null;
}

// -- DB row shape for approved real_questions --
export interface ApprovedQuestionRow {
  id: string;
  exam: string;
  section: string;
  module: number;
  question_number: number;
  raw_passage: string | null;
  raw_question: string;
  choice_a: string | null;
  choice_b: string | null;
  choice_c: string | null;
  choice_d: string | null;
  correct_choice: string | null;
  parsing_status: string;
  analysis_status: string;
  fingerprint_text: string | null;
  fingerprint_structure: string | null;
  question_type: string | null;
}

// -- Extraction options --
export interface ExtractionOptions {
  section?: Section;
  limit?: number;
  skipAlreadyExtracted?: boolean;
}

// -- Pattern query filters --
export interface PatternFilters {
  section?: string;
  type?: string;
  status?: string;
  limit?: number;
  offset?: number;
}
