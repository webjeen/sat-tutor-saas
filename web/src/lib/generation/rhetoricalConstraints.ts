import type {
  RhetoricalConstraint,
  MathConstraint,
  SATConstraintSet,
} from "./types";
import type { Section, LibraryCategory } from "../library/types";

// -- RW rhetorical constraint definitions per category --

const RW_CONSTRAINT_MAP: Record<string, RhetoricalConstraint[]> = {
  "Main-Idea": [
    { layer: "passage_structure", rule: "Passage must have a discernible thesis or central claim", enforcement: "hard", description: "The passage must present an arguable central thesis that is identifiable by careful reading" },
    { layer: "argument_pattern", rule: "Supporting points must develop the thesis, not merely repeat it", enforcement: "hard", description: "Each paragraph should advance a distinct aspect of the central argument" },
    { layer: "tone_register", rule: "Use academic or journalistic register appropriate to the topic", enforcement: "soft", description: "Tone should be consistent with published non-fiction SAT passages" },
    { layer: "evidence_type", rule: "The passage must include specific evidence, examples, or data", enforcement: "hard", description: "Abstract claims must be grounded with concrete support" },
    { layer: "vocabulary_level", rule: "Use SAT-appropriate vocabulary with contextual clues", enforcement: "soft", description: "Vocabulary should be accessible but include tier-2 academic terms" },
    { layer: "logical_structure", rule: "The correct answer must be the most comprehensive summary", enforcement: "hard", description: "Reject choices that are too narrow, too broad, or misrepresent scope" },
  ],
  "Inference": [
    { layer: "passage_structure", rule: "Passage must contain implicit information that requires synthesis", enforcement: "hard", description: "The passage should support an inference without stating it directly" },
    { layer: "argument_pattern", rule: "Evidence must be distributed across multiple locations", enforcement: "hard", description: "The correct inference requires connecting information from different parts of the passage" },
    { layer: "evidence_type", rule: "The correct inference must be the only one fully supported by the text", enforcement: "hard", description: "Other plausible inferences must have at least one piece of contradicting evidence" },
    { layer: "logical_structure", rule: "Distractors must represent over-extensions or under-extensions of the evidence", enforcement: "hard", description: "Common logical errors: going beyond what the text supports or stopping short" },
    { layer: "tone_register", rule: "Passage tone must be consistent enough to anchor inference direction", enforcement: "soft", description: "Tone shifts should not create ambiguity about the inference type" },
  ],
  "Transition": [
    { layer: "logical_structure", rule: "The blank must sit at a precise logical junction between ideas", enforcement: "hard", description: "The relationship before and after the blank must be clearly identifiable" },
    { layer: "argument_pattern", rule: "Both preceding and following context must be self-sufficient enough to determine the relationship", enforcement: "hard", description: "The transition word must be the ONLY element that completes the logic" },
    { layer: "evidence_type", rule: "Distractors must be transition words from a DIFFERENT logical category", enforcement: "hard", description: "Contrast words should not be plausible if the relationship is cause-effect" },
    { layer: "vocabulary_level", rule: "Use transition words at SAT frequency level", enforcement: "soft", description: "Avoid obscure transitions; include commonly tested ones" },
  ],
  "Function": [
    { layer: "passage_structure", rule: "The targeted text must serve a specific rhetorical role within the larger argument", enforcement: "hard", description: "The sentence must have a discernible function: introduce, support, qualify, transition, or conclude" },
    { layer: "argument_pattern", rule: "The passage must be structured so the targeted text's role is identifiable through context", enforcement: "hard", description: "The function should be derivable from surrounding sentences" },
    { layer: "evidence_type", rule: "The correct answer must describe the FUNCTION, not the content", enforcement: "hard", description: "Reject choices that summarize what the sentence says rather than what it does" },
    { layer: "logical_structure", rule: "Distractors must describe plausible but incorrect functions", enforcement: "hard", description: "A sentence that introduces evidence should not be plausibly described as concluding an argument" },
  ],
  "Boundaries": [
    { layer: "passage_structure", rule: "The passage must contain meaningful sentence or paragraph boundaries where meaning shifts", enforcement: "hard", description: "The boundary must be where a shift in topic, scope, or argument occurs" },
    { layer: "logical_structure", rule: "Understanding the boundary relationship is essential for comprehension", enforcement: "hard", description: "Misreading across the boundary must lead to a substantively different interpretation" },
    { layer: "evidence_type", rule: "The correct choice must describe what happens AT the boundary", enforcement: "hard", description: "Focus on the transition of meaning, not the content on either side alone" },
  ],
  "Rhetorical": [
    { layer: "passage_structure", rule: "The passage must employ identifiable rhetorical strategies", enforcement: "hard", description: "The author must use at least one recognizable technique (ethos, pathos, logos, analogy, etc.)" },
    { layer: "argument_pattern", rule: "The rhetorical strategy must serve a discernible persuasive purpose", enforcement: "hard", description: "The strategy must be intentionally deployed, not incidental" },
    { layer: "evidence_type", rule: "The correct answer must identify both the strategy AND its effect", enforcement: "hard", description: "Naming the strategy without explaining its purpose is insufficient" },
    { layer: "tone_register", rule: "Rhetorical effect must be consistent with the author's overall purpose", enforcement: "soft", description: "The rhetorical move should align with the passage's tone and aim" },
  ],
  "Evidence": [
    { layer: "passage_structure", rule: "The passage must contain multiple pieces of evidence supporting different aspects of a claim", enforcement: "hard", description: "There must be enough evidence to make the selection non-trivial" },
    { layer: "argument_pattern", rule: "A specific claim must be identifiable in the question stem", enforcement: "hard", description: "The question must reference a specific assertion that needs support" },
    { layer: "evidence_type", rule: "The correct answer must provide the MOST DIRECT support for the specific claim", enforcement: "hard", description: "Indirectly related evidence is a distractor, not the answer" },
    { layer: "logical_structure", rule: "Distractors must be evidence that supports a DIFFERENT claim or is tangentially related", enforcement: "hard", description: "Evidence that supports the general topic but not the specific claim should be a distractor" },
  ],
};

// -- Math constraint definitions per category --

const MATH_CONSTRAINT_MAP: Record<string, MathConstraint[]> = {
  "Linear": [
    { layer: "problem_framing", rule: "Frame in real-world context with constant rate or fixed relationship", enforcement: "soft", description: "Linear problems should involve constant rate of change, slope, or fixed intercept" },
    { layer: "notation_style", rule: "Use standard algebraic notation (y=mx+b or equivalent)", enforcement: "hard", description: "Avoid unconventional notation; use SAT-standard forms" },
    { layer: "solution_path", rule: "The solution must be reachable in 2-3 algebraic steps", enforcement: "soft", description: "Linear problems on SAT are typically straightforward" },
    { layer: "calculation_complexity", rule: "Arithmetic should involve manageable numbers", enforcement: "soft", description: "Avoid excessive computation that obscures the algebraic reasoning" },
    { layer: "context_type", rule: "Word problems must have realistic, SAT-style scenarios", enforcement: "hard", description: "Contexts should be practical: pricing, distance, rates, etc." },
  ],
  "Quadratic": [
    { layer: "problem_framing", rule: "Problem must involve a squared relationship, area, or projectile motion", enforcement: "hard", description: "The quadratic nature must emerge naturally from the problem context" },
    { layer: "notation_style", rule: "Present in standard, factored, or vertex form as appropriate", enforcement: "hard", description: "Choose the form that best matches the question being asked" },
    { layer: "solution_path", rule: "Must require factoring, completing the square, or quadratic formula", enforcement: "hard", description: "The problem must genuinely require quadratic methods" },
    { layer: "calculation_complexity", rule: "Discriminants should be perfect squares when factoring is expected", enforcement: "soft", description: "SAT quadratic problems typically have clean solutions" },
  ],
  "Exponential": [
    { layer: "problem_framing", rule: "Context must involve growth, decay, or repeated percentage change", enforcement: "hard", description: "Population growth, depreciation, or compound interest are typical" },
    { layer: "notation_style", rule: "Use y=a(b)^t form or equivalent", enforcement: "hard", description: "Exponential notation should clearly show base and exponent" },
    { layer: "solution_path", rule: "Must require identifying base/exponent or evaluating at a point", enforcement: "hard", description: "The solution should test understanding of exponential behavior" },
    { layer: "calculation_complexity", rule: "Values should allow mental estimation to verify reasonableness", enforcement: "soft", description: "Avoid calculations that require a calculator for verification" },
  ],
  "Systems": [
    { layer: "problem_framing", rule: "Must present two distinct conditions on shared variables", enforcement: "hard", description: "Two equations with two unknowns, or equivalent information" },
    { layer: "solution_path", rule: "Must be solvable by substitution or elimination", enforcement: "hard", description: "Both methods should be viable; one may be more efficient" },
    { layer: "calculation_complexity", rule: "Solutions should be integers or simple fractions", enforcement: "soft", description: "SAT systems problems typically have clean solutions" },
    { layer: "context_type", rule: "Real-world context should make the system structure natural", enforcement: "soft", description: "Pricing combinations, mixture problems, or constraint satisfaction" },
  ],
  "Geometry": [
    { layer: "problem_framing", rule: "Must describe or imply a specific geometric figure", enforcement: "hard", description: "The shape and known measurements must be clearly identifiable" },
    { layer: "notation_style", rule: "Use standard geometric notation and formulas", enforcement: "hard", description: "Follow SAT convention for angle, side, and area notation" },
    { layer: "solution_path", rule: "Must require applying a geometric theorem or formula", enforcement: "hard", description: "Pythagorean theorem, area/volume formulas, angle relationships, etc." },
    { layer: "calculation_complexity", rule: "Diagrams described verbally must be unambiguous", enforcement: "hard", description: "All necessary information must be provided or clearly inferrable" },
  ],
  "Trig": [
    { layer: "problem_framing", rule: "Must involve a right triangle or trigonometric relationship", enforcement: "hard", description: "The problem must require sin, cos, tan, or their inverses" },
    { layer: "notation_style", rule: "Use standard trig notation; specify degrees or radians", enforcement: "hard", description: "SAT typically uses degrees; be explicit about unit" },
    { layer: "solution_path", rule: "Must require selecting and applying a trig ratio", enforcement: "hard", description: "The solution path should involve SOH-CAH-TOA or unit circle" },
  ],
  "Statistics": [
    { layer: "problem_framing", rule: "Must present data in a realistic format (table, list, or description)", enforcement: "hard", description: "Data presentation should mirror SAT format" },
    { layer: "solution_path", rule: "Must require calculating or interpreting a statistical measure", enforcement: "hard", description: "Mean, median, range, standard deviation, or probability" },
    { layer: "calculation_complexity", rule: "Data sets should be small enough for manual calculation", enforcement: "soft", description: "Typically 5-12 data points on SAT" },
    { layer: "context_type", rule: "Scenarios should involve realistic data analysis situations", enforcement: "soft", description: "Surveys, experiments, or observational studies" },
  ],
  "AdvancedAlgebra": [
    { layer: "problem_framing", rule: "Must involve function composition, inverses, or transformations", enforcement: "hard", description: "The problem must genuinely require advanced algebraic manipulation" },
    { layer: "notation_style", rule: "Use standard function notation f(x), g(x)", enforcement: "hard", description: "Function notation must be clear and consistent" },
    { layer: "solution_path", rule: "Must require multiple algebraic steps with verification", enforcement: "hard", description: "The solution should involve more than one algebraic operation" },
    { layer: "calculation_complexity", rule: "Must test understanding of function behavior, not just computation", enforcement: "hard", description: "Domain, range, asymptotes, or transformation properties should be relevant" },
  ],
};

// -- Anti-leak prompt rules (injected into every prompt) --

const ANTI_LEAK_PROMPT_RULES = [
  "NEVER reproduce any text from real SAT exams, even from memory",
  "NEVER construct a passage that could be mistaken for a real SAT passage",
  "All passages must be 100% original content with unique sentence structure",
  "Do NOT use any recognizable phrases, arguments, or examples from published SAT material",
  "If you recognize a topic from a real SAT question, create an entirely different passage on that topic",
  "Question stems must use original phrasing — do not replicate SAT question wording patterns",
  "Correct answers must be defensible without any reference to external SAT material",
  "Distractors must be plausible through genuine logical error, not SAT-specific trick patterns",
];

// -- Structural originality rules --

const STRUCTURAL_ORIGINALITY_RULES = [
  "Each generated question must have a unique passage-question relationship",
  "No two generated questions should share the same argument structure",
  "Passage topics must vary across generation batches",
  "Question stems must differ in syntactic structure from any real SAT stem",
  "Choice ordering (A-D) must not follow predictable correct-answer patterns",
  "The correct answer position must vary — do not favor any letter",
];

// -- Public API --

export function buildConstraintSet(
  section: Section,
  category: LibraryCategory
): SATConstraintSet {
  const rwConstraints = section === "RW"
    ? (RW_CONSTRAINT_MAP[category] || RW_CONSTRAINT_MAP["Main-Idea"])
    : [];

  const mathConstraints = section === "Math"
    ? (MATH_CONSTRAINT_MAP[category] || MATH_CONSTRAINT_MAP["Linear"])
    : [];

  return {
    rwConstraints,
    mathConstraints,
    antiLeakPromptRules: ANTI_LEAK_PROMPT_RULES,
    structuralOriginalityRules: STRUCTURAL_ORIGINALITY_RULES,
  };
}

export function formatConstraintsForPrompt(
  constraintSet: SATConstraintSet,
  section: Section
): string {
  const lines: string[] = [];

  if (section === "RW" && constraintSet.rwConstraints.length > 0) {
    lines.push("RHETORICAL CONSTRAINTS (must be followed):");
    for (const c of constraintSet.rwConstraints) {
      const marker = c.enforcement === "hard" ? "[HARD]" : "[SOFT]";
      lines.push(`  ${marker} [${c.layer}] ${c.rule}`);
      lines.push(`    → ${c.description}`);
    }
  }

  if (section === "Math" && constraintSet.mathConstraints.length > 0) {
    lines.push("MATH CONSTRAINTS (must be followed):");
    for (const c of constraintSet.mathConstraints) {
      const marker = c.enforcement === "hard" ? "[HARD]" : "[SOFT]";
      lines.push(`  ${marker} [${c.layer}] ${c.rule}`);
      lines.push(`    → ${c.description}`);
    }
  }

  return lines.join("\n");
}

export function formatAntiLeakRules(rules: string[]): string {
  const lines: string[] = ["ANTI-LEAK RULES (absolute — violation means discard):"];
  for (let i = 0; i < rules.length; i++) {
    lines.push(`  ${i + 1}. ${rules[i]}`);
  }
  return lines.join("\n");
}

export function formatStructuralOriginalityRules(rules: string[]): string {
  const lines: string[] = ["STRUCTURAL ORIGINALITY RULES:"];
  for (const rule of rules) {
    lines.push(`  • ${rule}`);
  }
  return lines.join("\n");
}

export function getHardConstraints(
  constraintSet: SATConstraintSet,
  section: Section
): (RhetoricalConstraint | MathConstraint)[] {
  if (section === "RW") {
    return constraintSet.rwConstraints.filter((c) => c.enforcement === "hard");
  }
  return constraintSet.mathConstraints.filter((c) => c.enforcement === "hard");
}

export function countConstraints(
  constraintSet: SATConstraintSet,
  section: Section
): { hard: number; soft: number } {
  const constraints = section === "RW"
    ? constraintSet.rwConstraints
    : constraintSet.mathConstraints;

  return {
    hard: constraints.filter((c) => c.enforcement === "hard").length,
    soft: constraints.filter((c) => c.enforcement === "soft").length,
  };
}
