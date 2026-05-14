import type {
  DistractorSynthesisInput,
  DistractorSynthesisPlan,
  DistractorPlanEntry,
  DistractorCatalogEntry,
} from "./types";
import type { Section, LibraryCategory, DistractorGenerationStrategy } from "../library/types";

// Difficulty-to-complexity mapping for distractors
const DIFFICULTY_COMPLEXITY: Record<string, number> = {
  easy: 0.3,
  medium: 0.6,
  hard: 0.9,
};

// RW-specific distractor guidance by category
const RW_DISTRACTOR_GUIDANCE: Record<string, string> = {
  "Main-Idea": "Distractors should represent: (a) a too-narrow interpretation, (b) a too-broad generalization, (c) a misattribution of scope. Each must sound plausible from a surface reading.",
  "Inference": "Distractors should represent: (a) an over-extension beyond what the text supports, (b) a reasonable but unsupported assumption, (c) a true statement that does not answer the question. Each must be defensible from partial evidence.",
  "Transition": "Distractors must be transition words from DIFFERENT logical categories. If the correct answer is a contrast word, distractors should include cause-effect, addition, and sequence transitions.",
  "Function": "Distractors should describe: (a) what the sentence says (content summary), (b) a different but plausible function, (c) an adjacent but incorrect rhetorical role. Each must be technically possible from a careless reading.",
  "Boundaries": "Distractors should describe: (a) the content before the boundary only, (b) the content after the boundary only, (c) a misidentified boundary relationship. Each must be partially correct to seem plausible.",
  "Rhetorical": "Distractors should: (a) identify the correct strategy but wrong effect, (b) identify the wrong strategy but plausible effect, (c) describe the content rather than the strategy. Each must demonstrate understanding of rhetorical terminology.",
  "Evidence": "Distractors should be: (a) evidence supporting a different claim, (b) tangentially related evidence, (c) evidence that supports the general topic but not the specific claim. Each must appear relevant on a surface reading.",
};

// Math-specific distractor guidance by category
const MATH_DISTRACTOR_GUIDANCE: Record<string, string> = {
  "Linear": "Distractors should include: (a) wrong slope sign, (b) swapped intercept values, (c) incorrect rate interpretation. Each must result from a common algebraic error.",
  "Quadratic": "Distractors should include: (a) sign error in factoring, (b) wrong root selection, (c) vertex confusion. Each must result from a procedural mistake.",
  "Exponential": "Distractors should include: (a) using addition instead of multiplication for growth, (b) confusing growth and decay, (c) wrong exponent application. Each must be a recognizable exponential error pattern.",
  "Systems": "Distractors should include: (a) solving only one equation, (b) arithmetic error in elimination, (c) sign error in substitution. Each must look like a reasonable calculation result.",
  "Geometry": "Distractors should include: (a) wrong formula application, (b) unit confusion, (c) incorrect dimensional reasoning. Each must be geometrically plausible at a glance.",
  "Trig": "Distractors should include: (a) wrong ratio selection, (b) degree/radian confusion, (c) complementary angle error. Each must result from a common trig mistake.",
  "Statistics": "Distractors should include: (a) mean/median confusion, (b) range misinterpretation, (c) probability calculation error. Each must be a statistically plausible value.",
  "AdvancedAlgebra": "Distractors should include: (a) wrong function operation order, (b) domain/range error, (c) transformation misapplication. Each must follow from a logical algebraic step gone wrong.",
};

export function synthesizeDistractorPlan(
  input: DistractorSynthesisInput
): DistractorSynthesisPlan {
  const { section, category, strategy, catalogEntries, difficultyTarget } = input;

  const wrongLabels = ["A", "B", "C", "D"].filter(
    (l) => l !== input.correctChoice
  );

  const distractors = assignDistractorStrategies(
    wrongLabels,
    strategy,
    catalogEntries,
    difficultyTarget,
    section,
    category
  );

  const crossChoiceConstraints = buildCrossChoiceConstraints(section, category, difficultyTarget);
  const difficultyComplexity = DIFFICULTY_COMPLEXITY[difficultyTarget];
  const sectionSpecificGuidance = section === "RW"
    ? (RW_DISTRACTOR_GUIDANCE[category] || RW_DISTRACTOR_GUIDANCE["Main-Idea"])
    : (MATH_DISTRACTOR_GUIDANCE[category] || MATH_DISTRACTOR_GUIDANCE["Linear"]);

  return {
    distractors,
    crossChoiceConstraints,
    difficultyComplexity,
    sectionSpecificGuidance,
  };
}

function assignDistractorStrategies(
  wrongLabels: string[],
  strategy: DistractorGenerationStrategy,
  catalogEntries: DistractorCatalogEntry[],
  difficultyTarget: "easy" | "medium" | "hard",
  section: Section,
  _category: LibraryCategory
): DistractorPlanEntry[] {
  const availableStrategies = selectAvailableStrategies(strategy, catalogEntries, section);
  const assignedStrategies = pickNonOverlappingStrategies(
    availableStrategies,
    wrongLabels.length,
    difficultyTarget
  );

  return wrongLabels.map((label, i) => {
    const strategyName = assignedStrategies[i] || `generic_error_type_${i + 1}`;
    const catalogEntry = catalogEntries.find((e) => e.distractor_type === strategyName);

    const plausibilityLevel = derivePlausibilityLevel(difficultyTarget, i);
    const complexityHint = deriveComplexityHint(difficultyTarget, i);
    const guidance = catalogEntry
      ? catalogEntry.strategy_description
      : `Create a distractor that represents a ${strategyName} error`;
    const avoidanceRules = catalogEntry?.generation_guidance.avoidance_rules || [
      "Do not make the distractor obviously wrong",
      "Do not repeat content from the correct answer",
    ];

    return {
      label,
      strategy: strategyName,
      plausibilityLevel,
      guidance,
      avoidanceRules,
      complexityHint,
    };
  });
}

function selectAvailableStrategies(
  strategy: DistractorGenerationStrategy,
  catalogEntries: DistractorCatalogEntry[],
  section: Section
): string[] {
  const primary = [...strategy.primary_patterns];
  const secondary = [...strategy.secondary_patterns];

  // Add catalog strategies that aren't already listed
  const catalogTypes = catalogEntries
    .filter((e) => e.section === section || e.section === "both")
    .map((e) => e.distractor_type);

  const all = [...primary, ...secondary];
  for (const ct of catalogTypes) {
    if (!all.includes(ct)) {
      all.push(ct);
    }
  }

  // Primary strategies come first, then secondary, then catalog
  return [...new Set([...primary, ...secondary, ...catalogTypes])];
}

function pickNonOverlappingStrategies(
  available: string[],
  count: number,
  difficultyTarget: "easy" | "medium" | "hard"
): string[] {
  const picked: string[] = [];
  const remaining = [...available];

  for (let i = 0; i < count && remaining.length > 0; i++) {
    const idx = difficultyTarget === "easy"
      ? 0 // Easy: use most common strategies
      : Math.min(i, remaining.length - 1); // Medium/Hard: rotate

    picked.push(remaining[idx]);
    remaining.splice(idx, 1);
  }

  return picked;
}

function derivePlausibilityLevel(
  difficultyTarget: "easy" | "medium" | "hard",
  distractorIndex: number
): "high" | "medium" | "low" {
  if (difficultyTarget === "hard") {
    return "high"; // All distractors must be highly plausible for hard questions
  }
  if (difficultyTarget === "easy" && distractorIndex >= 2) {
    return "low"; // Last distractor can be less plausible for easy questions
  }
  return distractorIndex === 0 ? "high" : "medium";
}

function deriveComplexityHint(
  difficultyTarget: "easy" | "medium" | "hard",
  distractorIndex: number
): number {
  const base = DIFFICULTY_COMPLEXITY[difficultyTarget];
  // First distractor is usually the most sophisticated
  const offset = distractorIndex === 0 ? 0.1 : 0;
  return Math.min(1, Math.round((base + offset) * 100) / 100);
}

function buildCrossChoiceConstraints(
  section: Section,
  _category: LibraryCategory,
  _difficultyTarget: "easy" | "medium" | "hard"
): string[] {
  const constraints: string[] = [
    "No two distractors may use the same error strategy",
    "Distractors must not give away the correct answer by elimination",
    "All distractors must be grammatically consistent with the question stem",
  ];

  if (section === "RW") {
    constraints.push("Distractors must not be logically dependent on each other");
    constraints.push("Each distractor must be independently evaluable against the passage");
  } else {
    constraints.push("Numeric distractors must differ from the correct answer by a meaningful amount");
    constraints.push("No distractor should be the negative of the correct answer unless that is a common error pattern");
  }

  return constraints;
}

export function formatDistractorPlanForPrompt(plan: DistractorSynthesisPlan, _section: Section): string {
  const lines: string[] = [];

  lines.push("DISTRACTOR SYNTHESIS PLAN:");
  lines.push(`  Section-specific guidance: ${plan.sectionSpecificGuidance}`);
  lines.push(`  Target complexity: ${plan.difficultyComplexity}`);

  lines.push("");
  lines.push("  DISTRACTOR ASSIGNMENTS:");
  for (const d of plan.distractors) {
    lines.push(`  Choice ${d.label}:`);
    lines.push(`    Strategy: ${d.strategy}`);
    lines.push(`    Plausibility: ${d.plausibilityLevel}`);
    lines.push(`    Guidance: ${d.guidance}`);
    lines.push(`    Complexity: ${d.complexityHint}`);
    if (d.avoidanceRules.length > 0) {
      lines.push(`    Avoid: ${d.avoidanceRules.join("; ")}`);
    }
  }

  lines.push("");
  lines.push("  CROSS-CHOICE CONSTRAINTS:");
  for (const c of plan.crossChoiceConstraints) {
    lines.push(`    • ${c}`);
  }

  return lines.join("\n");
}
