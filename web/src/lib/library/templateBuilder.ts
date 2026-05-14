import type {
  Section,
  LibraryCategory,
  RWCategory,
  MathCategory,
  PatternTemplate,
  ReasoningStep,
  DistractorGenerationStrategy,
  DifficultyParameters,
  ConstraintRule,
  TemplateBuilderInput,
  TemplateBuilderResult,
} from "./types";
import type {
  PatternRecord,
  RWExtractedData,
  MathExtractedData,
} from "../extraction/types";
import { getReasoningFlow } from "./reasoningTemplates";
import { getDistractorGuidance } from "./distractorCatalog";

// -- Category mapping from extraction types to library categories --

const RW_TYPE_TO_CATEGORY: Record<string, RWCategory> = {
  "Main-Idea": "Main-Idea",
  "Function": "Function",
  "Inference": "Inference",
  "Evidence": "Evidence",
  "Vocabulary": "Inference", // Vocabulary maps to Inference (closest library category)
  "Transition": "Transition",
  "Grammar": "Boundaries", // Grammar maps to Boundaries (phrase/sentence boundary analysis)
  "Rhetorical": "Rhetorical",
};

const MATH_DOMAIN_TO_CATEGORY: Record<string, MathCategory> = {
  "linear_equations": "Linear",
  "systems_of_equations": "Systems",
  "quadratic": "Quadratic",
  "exponential": "Exponential",
  "polynomial": "AdvancedAlgebra",
  "rational_expressions": "AdvancedAlgebra",
  "geometry": "Geometry",
  "trigonometry": "Trig",
  "statistics_probability": "Statistics",
  "advanced_math": "AdvancedAlgebra",
};

export function classifyCategory(
  patterns: PatternRecord[],
  section: Section
): LibraryCategory {
  if (section === "RW") {
    const typeCounts: Record<string, number> = {};
    for (const p of patterns) {
      const data = p.extracted_data as RWExtractedData;
      const category = RW_TYPE_TO_CATEGORY[data.question_type];
      if (category) typeCounts[category] = (typeCounts[category] || 0) + 1;
    }
    const sorted = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
    return (sorted[0]?.[0] || "Main-Idea") as RWCategory;
  }

  const domainCounts: Record<string, number> = {};
  for (const p of patterns) {
    const data = p.extracted_data as MathExtractedData;
    const category = MATH_DOMAIN_TO_CATEGORY[data.math_domain];
    if (category) domainCounts[category] = (domainCounts[category] || 0) + 1;
  }
  const sorted = Object.entries(domainCounts).sort((a, b) => b[1] - a[1]);
  return (sorted[0]?.[0] || "Linear") as MathCategory;
}

export function classifySubcategory(
  patterns: PatternRecord[],
  section: Section
): string | null {
  if (section === "RW") {
    const structureCounts: Record<string, number> = {};
    for (const p of patterns) {
      const data = p.extracted_data as RWExtractedData;
      if (data.passage_structure) {
        structureCounts[data.passage_structure] = (structureCounts[data.passage_structure] || 0) + 1;
      }
    }
    const sorted = Object.entries(structureCounts).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0 && sorted[0][1] > patterns.length * 0.5) {
      return sorted[0][0];
    }
    return null;
  }

  const solvingCounts: Record<string, number> = {};
  for (const p of patterns) {
    const data = p.extracted_data as MathExtractedData;
    if (data.problem_solving_type) {
      solvingCounts[data.problem_solving_type] = (solvingCounts[data.problem_solving_type] || 0) + 1;
    }
  }
  const sorted = Object.entries(solvingCounts).sort((a, b) => b[1] - a[1]);
  if (sorted.length > 0 && sorted[0][1] > patterns.length * 0.5) {
    return sorted[0][0];
  }
  return null;
}

export function buildReasoningFlow(
  patterns: PatternRecord[],
  category: LibraryCategory,
  section: Section
): ReasoningStep[] {
  const baseFlow = getReasoningFlow(section, category);

  // Refine: if patterns show a consistent sub-pattern, add a sub-step
  if (section === "RW") {
    const evidenceTypes = new Set<string>();
    for (const p of patterns) {
      const data = p.extracted_data as RWExtractedData;
      if (data.evidence_reasoning) evidenceTypes.add(data.evidence_reasoning);
    }

    if (category === "Inference" && evidenceTypes.has("negation")) {
      return [
        ...baseFlow.slice(0, 2),
        { step: 3, name: "check_negation", description: "Check if the question asks what is NOT supported", guidance: "Identify negation cues (except, not, LEAST) and reverse the elimination logic" },
        { step: 4, name: "verify_bounds", description: "Verify the inference stays within passage bounds", guidance: "Ensure the inference does not go beyond what the text supports" },
      ];
    }
  }

  if (section === "Math") {
    const multiStepCount = patterns.filter((p) => {
      const data = p.extracted_data as MathExtractedData;
      return data.multi_step_reasoning === "multi_step" || data.multi_step_reasoning === "chained_reasoning";
    }).length;

    if (multiStepCount > patterns.length * 0.6) {
      return [
        baseFlow[0],
        { step: 2, name: "identify_intermediate", description: "Identify the intermediate value or step needed", guidance: "Determine what must be computed first before reaching the final answer" },
        ...baseFlow.slice(1).map((s) => ({ ...s, step: s.step + 1 })),
      ];
    }
  }

  return baseFlow;
}

export function buildDistractorStrategy(
  patterns: PatternRecord[],
  section: Section
): DistractorGenerationStrategy {
  const patternCounts: Record<string, number> = {};
  for (const p of patterns) {
    const data = p.extracted_data as RWExtractedData | MathExtractedData;
    if (data.distractor_pattern) {
      patternCounts[data.distractor_pattern] = (patternCounts[data.distractor_pattern] || 0) + 1;
    }
  }

  const sorted = Object.entries(patternCounts).sort((a, b) => b[1] - a[1]);
  const primary = sorted.slice(0, 2).map(([type]) => type);
  const secondary = sorted.slice(2, 4).map(([type]) => type);

  const generationGuidance: Record<string, string> = {};
  for (const type of [...primary, ...secondary]) {
    const guidance = getDistractorGuidance(type as import("../extraction/types").DistractorPattern, section);
    if (guidance.rules.length > 0) {
      generationGuidance[type] = guidance.rules[0];
    }
  }

  return {
    primary_patterns: primary,
    secondary_patterns: secondary,
    generation_guidance: generationGuidance,
    minimum_distractors: 3,
    quality_criteria: [
      "Each distractor must sound plausible",
      "At least one must relate to passage/problem content",
      "No two distractors should use the same strategy",
    ],
  };
}

export function buildDifficultyParameters(
  _patterns: PatternRecord[],
  _section: Section
): DifficultyParameters {
  // Default difficulty parameters — will be refined when real pattern data is available
  return {
    score_range: { min: 15, max: 90 },
    band_targets: { easy: 25, medium: 55, hard: 80 },
    factor_weights: {
      complexity: 0.25,
      syntax: 0.15,
      reasoning: 0.30,
      distractor: 0.20,
      density: 0.05,
      time: 0.05,
    },
    timing_targets: { easy: "quick", medium: "moderate", hard: "extended" },
  };
}

export function buildConstraintRules(
  _patterns: PatternRecord[],
  _category: LibraryCategory,
  _section: Section
): ConstraintRule[] {
  return [
    { type: "hard", field: "choice_count", operator: "eq", value: 4, description: "Must have exactly 4 answer choices" },
    { type: "hard", field: "correct_answer", operator: "exists", value: true, description: "Must have a correct answer" },
    { type: "hard", field: "no_real_leak", operator: "eq", value: true, description: "Must not contain real SAT text" },
    { type: "soft", field: "syntax_complexity", operator: "in", value: ["simple", "moderate"], description: "Prefer simple to moderate syntax complexity" },
    { type: "soft", field: "distractor_diversity", operator: "eq", value: true, description: "Distractors should use different strategies" },
  ];
}

export function computeGenerationReadiness(
  template: PatternTemplate,
  sourcePatterns: PatternRecord[]
): number {
  // Completeness: are all reasoning flow steps populated?
  const flowComplete = template.reasoning_flow.length >= 3 ? 1 : template.reasoning_flow.length / 3;

  // Confidence: average extraction confidence from source patterns
  const avgConfidence = sourcePatterns.length > 0
    ? sourcePatterns.reduce((sum, _p) => sum + 0.7, 0) / sourcePatterns.length // Default 0.7 if confidence not accessible
    : 0.3;

  // Validation score: simplified — templates from more patterns are more validated
  const validationScore = sourcePatterns.length >= 5 ? 1.0 : sourcePatterns.length >= 3 ? 0.7 : 0.4;

  // Coverage: does the template cover multiple distractor patterns?
  const coverage = template.distractor_strategy.primary_patterns.length >= 2 ? 1.0 : 0.5;

  return Math.min(1, Math.round(
    (flowComplete * 0.30 + avgConfidence * 0.30 + validationScore * 0.25 + coverage * 0.15) * 100
  ) / 100);
}

export function buildTemplate(
  input: TemplateBuilderInput
): TemplateBuilderResult {
  const { sourcePatterns, category, section, subcategory } = input;

  const resolvedSubcategory = subcategory || classifySubcategory(sourcePatterns, section);
  const reasoningFlow = buildReasoningFlow(sourcePatterns, category, section);
  const distractorStrategy = buildDistractorStrategy(sourcePatterns, section);
  const difficultyParameters = buildDifficultyParameters(sourcePatterns, section);
  const constraintRules = buildConstraintRules(sourcePatterns, category, section);

  const distractorPatterns = [
    ...distractorStrategy.primary_patterns,
    ...distractorStrategy.secondary_patterns,
  ];

  const reasoningDepths = new Set<string>();
  for (const p of sourcePatterns) {
    const data = p.extracted_data as RWExtractedData | MathExtractedData;
    if ("multi_step_reasoning" in data && data.multi_step_reasoning) {
      reasoningDepths.add(data.multi_step_reasoning);
    }
  }

  const subcategoryLabel = resolvedSubcategory ? ` (${resolvedSubcategory})` : "";
  const templateName = `${category}${subcategoryLabel} — ${section}`;

  const template: PatternTemplate = {
    id: "",
    section,
    category,
    subcategory: resolvedSubcategory,
    source_pattern_ids: sourcePatterns.map((p) => p.id),
    reasoning_flow: reasoningFlow,
    distractor_strategy: distractorStrategy,
    difficulty_parameters: difficultyParameters,
    constraint_rules: constraintRules,
    distractor_patterns: distractorPatterns,
    difficulty_bands: ["easy", "medium", "hard"],
    reasoning_depth: reasoningDepths.size === 1 ? [...reasoningDepths][0] : "multi_step",
    template_name: templateName,
    template_description: `Generation-ready template for ${category} questions in ${section} section`,
    generation_readiness: 0,
    status: "template_draft",
    processing_stage: null,
    retry_count: 0,
    error_message: null,
    last_processed_at: null,
    version: 1,
    is_active: true,
    supersedes_id: null,
    created_at: "",
    updated_at: "",
  };

  template.generation_readiness = computeGenerationReadiness(template, sourcePatterns);

  return {
    template,
    relationships: [],
    metadata: [],
    builderStats: {
      patternsConsumed: sourcePatterns.length,
      reasoningFlowSteps: reasoningFlow.length,
      distractorPatternsCovered: distractorPatterns,
      averageConfidence: 0.7,
    },
  };
}
