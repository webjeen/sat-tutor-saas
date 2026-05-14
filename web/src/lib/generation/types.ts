import type { PatternTemplate, ReasoningStep, Section, LibraryCategory, DistractorGenerationStrategy } from "../library/types";
import type { Fingerprint, DedupMatch } from "../dedup/types";

// -- Generation state machine (from agent-loop-orchestration.md §5.3) --

export type GenerationStatus =
  | "generation_pending"
  | "generation_processing"
  | "generation_success"
  | "generation_failed"
  | "validation_pending"
  | "validation_passed"
  | "validation_failed"
  | "approved_for_release"
  | "rejected";

export type GenerationDecision = "approve" | "regenerate" | "review" | "discard";

export type GenerationStage =
  | "resolve_template"
  | "build_prompt"
  | "llm_call"
  | "parse_response"
  | "validate"
  | "dedup"
  | "store";

// -- Check result types --

export type CheckResult = "pass" | "fail" | "review";

export interface StructureCheckResult {
  result: CheckResult;
  issues: string[];
  hasPassage: boolean;
  hasQuestion: boolean;
  hasAllChoices: boolean;
  hasCorrectChoice: boolean;
  hasExplanation: boolean;
  choiceLengthVariance: number;
}

export interface LeakCheckResult {
  result: CheckResult;
  maxSimilarity: number;
  matchedRealQuestionIds: string[];
  fingerprint: Fingerprint;
}

export interface DifficultyCheckResult {
  result: CheckResult;
  difficultyScore: number;
  mappedLevel: "easy" | "medium" | "hard";
  factors: DifficultyFactors;
  targetBand: string;
  mismatch: boolean;
}

export interface DifficultyFactors {
  complexity: number;
  syntax: number;
  reasoning: number;
  distractor: number;
  density: number;
  time: number;
}

export interface DistractorCheckResult {
  result: CheckResult;
  distractorCount: number;
  strategiesUsed: string[];
  primaryPatternCovered: boolean;
  diversityScore: number;
  perDistractor: PerDistractorAnalysis[];
}

export interface PerDistractorAnalysis {
  label: string;
  text: string;
  strategy: string | null;
  plausibility: "high" | "medium" | "low";
  isThrowaway: boolean;
}

export interface DuplicateCheckResult {
  result: CheckResult;
  realQuestionMatches: DedupMatch[];
  generatedQuestionMatches: DedupMatch[];
  maxRealSimilarity: number;
  maxGeneratedSimilarity: number;
  fingerprint: Fingerprint;
}

// -- Aggregated validation result --

export interface GenerationValidationResult {
  structure: StructureCheckResult;
  leakage: LeakCheckResult;
  difficulty: DifficultyCheckResult;
  distractor: DistractorCheckResult;
  dedup: DuplicateCheckResult;
  allPassed: boolean;
  failedChecks: string[];
}

// -- Decision engine output --

export interface DecisionResult {
  action: GenerationDecision;
  reason: string;
  failedChecks: string[];
  retryCount: number;
  suggestedTemplateId: string | null;
}

// -- Template resolution --

export interface ResolvedTemplate {
  template: PatternTemplate;
  distractorCatalogEntries: DistractorCatalogEntry[];
  reasoningFlowSteps: ReasoningStep[];
}

export interface DistractorCatalogEntry {
  distractor_type: string;
  section: string;
  strategy_description: string;
  generation_guidance: {
    rw_rules?: string[];
    math_rules?: string[];
    avoidance_rules?: string[];
  };
  quality_criteria: string[];
  example_signals: string[];
  effectiveness_rating: number;
}

// -- LLM interaction --

export interface PromptPayload {
  system: string;
  user: string;
  section: Section;
  category: string;
}

export interface LLMResponse {
  rawText: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

// -- Parsed generation output --

export interface ParsedGeneration {
  passage: string | null;
  question: string;
  choices: Record<string, string>;
  correctChoice: string;
  tutorExplanation: string;
  studentExplanation: string;
  distractorStrategies: Record<string, string | null>;
  reasoningTrace: { step: number; name: string; description: string; guidance?: string }[];
}

export interface ParseError {
  stage: "json_parse" | "field_validation" | "choice_validation";
  message: string;
  rawText: string;
}

// -- DB row types --

export interface GeneratedQuestion {
  id: string;
  template_id: string | null;
  pattern_id: string | null;
  section: string;
  category: string;
  question_type: string;
  generated_passage: string | null;
  generated_question: string;
  choice_a: string | null;
  choice_b: string | null;
  choice_c: string | null;
  choice_d: string | null;
  correct_choice: string;
  tutor_explanation: string | null;
  student_explanation: string | null;
  difficulty_score: number | null;
  mapped_level: string | null;
  difficulty_factors: Record<string, number>;
  distractor_analysis: Record<string, unknown>;
  reasoning_trace: { step: number; name: string; description: string; guidance?: string }[];
  status: GenerationStatus;
  processing_stage: string | null;
  retry_count: number;
  error_message: string | null;
  last_processed_at: string | null;
  fingerprint_text: string | null;
  fingerprint_structure: string | null;
  fingerprint_choice: string | null;
  pattern_signature: string | null;
  version: number;
  is_active: boolean;
  approved_for_release: boolean;
  created_at: string;
  updated_at: string;
}

export interface GenerationJob {
  id: string;
  template_id: string | null;
  section: string | null;
  category: string | null;
  difficulty_target: string | null;
  question_count_requested: number;
  question_count_generated: number;
  question_count_approved: number;
  status: string;
  processing_stage: string | null;
  retry_count: number;
  error_message: string | null;
  last_processed_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GenerationLog {
  id: string;
  generation_job_id: string | null;
  generated_question_id: string | null;
  template_id: string | null;
  section: string | null;
  category: string | null;
  stage: GenerationStage;
  status: string;
  decision: GenerationDecision | null;
  decision_reason: string | null;
  validation_results: Record<string, unknown>;
  error_message: string | null;
  retry_count: number;
  llm_model: string | null;
  llm_tokens_used: number | null;
  generation_duration_ms: number | null;
  fingerprint_text: string | null;
  fingerprint_structure: string | null;
  created_at: string;
}

export interface ValidationResultRow {
  id: string;
  generated_question_id: string | null;
  generation_log_id: string | null;
  template_id: string | null;
  leak_check_result: string | null;
  leak_check_score: number | null;
  duplicate_check_result: string | null;
  duplicate_check_score: number | null;
  structure_check_result: string | null;
  difficulty_check_result: string | null;
  distractor_check_result: string | null;
  difficulty_score: number | null;
  mapped_level: string | null;
  all_checks_passed: boolean;
  decision: string | null;
  decision_reason: string | null;
  status: string;
  created_at: string;
}

// -- Pipeline I/O --

export interface GenerationJobConfig {
  section: Section;
  category: LibraryCategory;
  difficulty: "easy" | "medium" | "hard";
  count: number;
  templateId?: string;
}

export interface QuestionGenerationResult {
  question: GeneratedQuestion | null;
  validation: GenerationValidationResult;
  decision: DecisionResult;
  logs: string[];
}

export interface GenerationResult {
  jobId: string;
  totalRequested: number;
  totalGenerated: number;
  totalApproved: number;
  results: QuestionGenerationResult[];
  errors: string[];
}

// ============================================================
// Phase 2 — Prompt Intelligence + SAT-style Constraint System
// ============================================================

// -- Reasoning chain assembly --

export interface ReasoningChain {
  steps: ReasoningChainStep[];
  cognitiveLoad: number;
  prerequisiteChains: string[];
  chainId: string;
  section: Section;
  category: LibraryCategory;
}

export interface ReasoningChainStep {
  step: number;
  name: string;
  description: string;
  guidance: string;
  cognitiveWeight: number;
  prerequisiteSteps: number[];
  validationHint: string;
}

export interface ChainAssemblyInput {
  templateSteps: ReasoningStep[];
  section: Section;
  category: LibraryCategory;
  difficultyTarget: "easy" | "medium" | "hard";
  prerequisiteCategories: string[];
}

// -- SAT rhetorical constraint layers --

export type RhetoricalConstraintLayer =
  | "passage_structure"
  | "argument_pattern"
  | "evidence_type"
  | "tone_register"
  | "vocabulary_level"
  | "logical_structure";

export type MathConstraintLayer =
  | "problem_framing"
  | "notation_style"
  | "solution_path"
  | "context_type"
  | "calculation_complexity";

export interface RhetoricalConstraint {
  layer: RhetoricalConstraintLayer;
  rule: string;
  enforcement: "hard" | "soft";
  description: string;
}

export interface MathConstraint {
  layer: MathConstraintLayer;
  rule: string;
  enforcement: "hard" | "soft";
  description: string;
}

export interface SATConstraintSet {
  rwConstraints: RhetoricalConstraint[];
  mathConstraints: MathConstraint[];
  antiLeakPromptRules: string[];
  structuralOriginalityRules: string[];
}

// -- Distractor synthesis --

export interface DistractorSynthesisInput {
  section: Section;
  category: LibraryCategory;
  strategy: DistractorGenerationStrategy;
  catalogEntries: DistractorCatalogEntry[];
  difficultyTarget: "easy" | "medium" | "hard";
  correctChoice: string | null;
}

export interface DistractorSynthesisPlan {
  distractors: DistractorPlanEntry[];
  crossChoiceConstraints: string[];
  difficultyComplexity: number;
  sectionSpecificGuidance: string;
}

export interface DistractorPlanEntry {
  label: string;
  strategy: string;
  plausibilityLevel: "high" | "medium" | "low";
  guidance: string;
  avoidanceRules: string[];
  complexityHint: number;
}

// -- Anti-leak safeguards --

export interface AntiLeakSafeguardResult {
  ngramOverlapScore: number;
  structuralLeakageScore: number;
  passageLeakageScore: number;
  passed: boolean;
  violations: AntiLeakViolation[];
  promptRules: string[];
}

export interface AntiLeakViolation {
  type: "ngram_overlap" | "structural_leakage" | "passage_leakage" | "phrase_reconstruction";
  severity: "critical" | "warning";
  description: string;
  matchedText: string;
  source: "real_question" | "pattern";
}

// -- Generation scoring metadata --

export interface GenerationScore {
  structuralQuality: number;
  rhetoricalFidelity: number;
  difficultyAlignment: number;
  originality: number;
  satFidelity: number;
  distractorQuality: number;
  reasoningCompleteness: number;
  overallScore: number;
  metadata: GenerationScoreMetadata;
}

export interface GenerationScoreMetadata {
  section: Section;
  category: LibraryCategory;
  difficultyTarget: "easy" | "medium" | "hard";
  templateId: string;
  scoringVersion: string;
  scoredAt: string;
}

// -- Enhanced prompt payload (Phase 2) --

export interface PromptSection {
  heading: string;
  content: string;
  priority: number;
}

export interface EnhancedPromptPayload extends PromptPayload {
  sections: PromptSection[];
  reasoningChain: ReasoningChain;
  constraintSet: SATConstraintSet;
  distractorPlan: DistractorSynthesisPlan;
  antiLeakRules: string[];
  generationScoreBaseline: GenerationScore | null;
}
