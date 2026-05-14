import type { ReasoningStep, ReasoningTemplate, LibraryCategory, Section } from "./types";

// -- Prerequisite dependency graph --

export const PREREQUISITE_MAP: Record<string, string[]> = {
  // RW: simpler types are prerequisites for harder ones
  "Main-Idea": [],
  "Inference": ["Main-Idea"],
  "Evidence": ["Inference"],
  "Vocabulary": [],
  "Transition": ["Vocabulary"],
  "Function": ["Main-Idea", "Inference"],
  "Boundaries": ["Function"],
  "Rhetorical": ["Function", "Inference"],

  // Math: foundational domains are prerequisites
  "Linear": [],
  "Systems": ["Linear"],
  "Quadratic": ["Linear"],
  "Exponential": ["Linear"],
  "Geometry": ["Linear"],
  "Trig": ["Geometry"],
  "Statistics": [],
  "AdvancedAlgebra": ["Quadratic", "Exponential"],
};

// -- RW reasoning flows --

export const RW_REASONING_FLOWS: Record<string, ReasoningStep[]> = {
  "Main-Idea": [
    { step: 1, name: "identify_claim", description: "Identify the central claim or thesis", guidance: "Look for thesis statement or topic sentence in first/last paragraph" },
    { step: 2, name: "evaluate_scope", description: "Evaluate the scope of the claim", guidance: "Distinguish between specific and general claims" },
    { step: 3, name: "eliminate_extremes", description: "Eliminate extreme or narrow options", guidance: "Reject answers with absolute language or overly narrow scope" },
  ],
  "Inference": [
    { step: 1, name: "gather_evidence", description: "Gather textual evidence relevant to the question", guidance: "Identify all passage sections that relate to the question topic" },
    { step: 2, name: "synthesize_implication", description: "Synthesize what the evidence implies", guidance: "Determine what must be true based on the evidence, not what could be true" },
    { step: 3, name: "verify_bounds", description: "Verify the inference stays within passage bounds", guidance: "Ensure the inference does not go beyond what the text supports" },
  ],
  "Transition": [
    { step: 1, name: "analyze_context", description: "Analyze the context before and after the blank", guidance: "Identify the logical relationship between preceding and following ideas" },
    { step: 2, name: "identify_relationship", description: "Identify the logical relationship type", guidance: "Classify as contrast, cause-effect, addition, sequence, or example" },
    { step: 3, name: "select_transition", description: "Select the transition that best completes the logic", guidance: "Match the transition word to the identified relationship type" },
  ],
  "Function": [
    { step: 1, name: "identify_target", description: "Identify the targeted sentence or phrase", guidance: "Locate the referenced text within the passage" },
    { step: 2, name: "analyze_role", description: "Analyze the rhetorical role of the target", guidance: "Determine whether it introduces, supports, contrasts, transitions, or concludes" },
    { step: 3, name: "match_purpose", description: "Match the identified role to answer choices", guidance: "Select the choice that most precisely describes the function" },
  ],
  "Boundaries": [
    { step: 1, name: "locate_boundary", description: "Locate the referenced text boundary", guidance: "Identify the line, sentence, or paragraph referenced" },
    { step: 2, name: "read_across_boundary", description: "Read across the boundary for meaning", guidance: "Understand how ideas connect across the identified boundary" },
    { step: 3, name: "evaluate_claim", description: "Evaluate which choice correctly describes the boundary", guidance: "Match the boundary relationship to the answer choices" },
  ],
  "Rhetorical": [
    { step: 1, name: "identify_strategy", description: "Identify the rhetorical strategy used", guidance: "Classify the technique: appeal to emotion, authority, logic, etc." },
    { step: 2, name: "analyze_effect", description: "Analyze the intended effect on the reader", guidance: "Determine the author's purpose in using this strategy" },
    { step: 3, name: "evaluate_choice", description: "Evaluate which choice captures the rhetorical effect", guidance: "Select the most precise description of the rhetorical strategy and effect" },
  ],
  "Evidence": [
    { step: 1, name: "identify_claim", description: "Identify the claim that needs support", guidance: "Pinpoint the specific assertion in the question" },
    { step: 2, name: "evaluate_support", description: "Evaluate which evidence best supports the claim", guidance: "Check each option for direct, relevant support" },
    { step: 3, name: "verify_relevance", description: "Verify the evidence is relevant and sufficient", guidance: "Ensure the selected evidence directly supports the specific claim" },
  ],
};

// -- Math reasoning flows --

export const MATH_REASONING_FLOWS: Record<string, ReasoningStep[]> = {
  "Linear": [
    { step: 1, name: "identify_relationship", description: "Identify the linear relationship", guidance: "Look for slope, intercept, or rate of change language" },
    { step: 2, name: "formulate_equation", description: "Formulate or interpret the equation", guidance: "Express the relationship in y = mx + b or equivalent form" },
    { step: 3, name: "solve_or_interpret", description: "Solve the equation or interpret the result", guidance: "Perform the required calculation or explain what the result means" },
  ],
  "Quadratic": [
    { step: 1, name: "identify_quadratic_form", description: "Identify the quadratic relationship", guidance: "Look for squared terms, vertex, or parabola language" },
    { step: 2, name: "apply_method", description: "Apply factoring, completing the square, or quadratic formula", guidance: "Choose the most efficient method for the given form" },
    { step: 3, name: "interpret_roots", description: "Interpret the roots or vertex in context", guidance: "Determine what the solutions mean for the problem context" },
  ],
  "Exponential": [
    { step: 1, name: "identify_growth_decay", description: "Identify exponential growth or decay", guidance: "Look for doubling, halving, percentage change, or compound language" },
    { step: 2, name: "set_up_model", description: "Set up the exponential model", guidance: "Use y = a(b)^t or equivalent form" },
    { step: 3, name: "compute_value", description: "Compute the value at the specified time", guidance: "Substitute and evaluate, interpreting the result in context" },
  ],
  "Systems": [
    { step: 1, name: "identify_equations", description: "Identify the system of equations", guidance: "Find two or more equations with shared variables" },
    { step: 2, name: "choose_method", description: "Choose substitution or elimination", guidance: "Select the method that minimizes computation complexity" },
    { step: 3, name: "solve_verify", description: "Solve the system and verify the solution", guidance: "Check the solution satisfies both original equations" },
  ],
  "Geometry": [
    { step: 1, name: "identify_shape", description: "Identify the geometric figure and known values", guidance: "Determine the shape, given measurements, and what needs to be found" },
    { step: 2, name: "select_formula", description: "Select the appropriate formula or theorem", guidance: "Choose from area, volume, Pythagorean theorem, or angle relationships" },
    { step: 3, name: "calculate_result", description: "Calculate and verify the result", guidance: "Apply the formula, check units, and verify reasonableness" },
  ],
  "Trig": [
    { step: 1, name: "identify_triangle", description: "Identify the right triangle and known values", guidance: "Determine which sides and angles are known or needed" },
    { step: 2, name: "select_ratio", description: "Select the appropriate trigonometric ratio", guidance: "Choose sin, cos, or tan based on known and needed values" },
    { step: 3, name: "compute_angle_side", description: "Compute the unknown angle or side length", guidance: "Apply the ratio and solve, converting between radians and degrees as needed" },
  ],
  "Statistics": [
    { step: 1, name: "identify_data", description: "Identify the data set or distribution", guidance: "Determine what data is given and what measure is needed" },
    { step: 2, name: "apply_measure", description: "Apply the appropriate statistical measure", guidance: "Calculate mean, median, standard deviation, or probability" },
    { step: 3, name: "interpret_result", description: "Interpret the result in context", guidance: "Explain what the measure reveals about the data or situation" },
  ],
  "AdvancedAlgebra": [
    { step: 1, name: "identify_structure", description: "Identify the function structure and operations", guidance: "Determine if the function is composite, inverse, or involves transformations" },
    { step: 2, name: "apply_operation", description: "Apply the required algebraic operation", guidance: "Perform composition, find inverse, or identify transformations" },
    { step: 3, name: "verify_behavior", description: "Verify the function behavior matches expectations", guidance: "Check domain, range, asymptotes, and transformation correctness" },
  ],
};

// -- Seed data for reasoning_templates table --

export const SEED_REASONING_TEMPLATES: Omit<ReasoningTemplate, "id" | "created_at" | "updated_at">[] = [
  ...Object.entries(RW_REASONING_FLOWS).map(([category, flow_steps]) => ({
    section: "RW" as Section,
    category,
    subcategory: null,
    template_name: `${category} Reasoning`,
    flow_steps,
    prerequisite_categories: PREREQUISITE_MAP[category] || [],
    description: `Standard reasoning flow for ${category} questions`,
    estimated_difficulty_band: category === "Vocabulary" || category === "Main-Idea" ? "easy" : "medium",
    cognitive_load: ["Rhetorical", "Boundaries", "Evidence"].includes(category) ? 0.7 : 0.5,
    status: "template_active" as const,
    processing_stage: null,
    retry_count: 0,
    error_message: null,
    last_processed_at: null,
    version: 1,
    is_active: true,
  })),
  ...Object.entries(MATH_REASONING_FLOWS).map(([category, flow_steps]) => ({
    section: "Math" as Section,
    category,
    subcategory: null,
    template_name: `${category} Reasoning`,
    flow_steps,
    prerequisite_categories: PREREQUISITE_MAP[category] || [],
    description: `Standard reasoning flow for ${category} problems`,
    estimated_difficulty_band: ["Linear", "Statistics"].includes(category) ? "easy" : "medium",
    cognitive_load: ["Systems", "AdvancedAlgebra", "Trig"].includes(category) ? 0.7 : 0.5,
    status: "template_active" as const,
    processing_stage: null,
    retry_count: 0,
    error_message: null,
    last_processed_at: null,
    version: 1,
    is_active: true,
  })),
];

// -- Lookup functions --

export function getReasoningFlow(
  section: Section,
  category: LibraryCategory
): ReasoningStep[] {
  if (section === "RW") {
    return RW_REASONING_FLOWS[category] || RW_REASONING_FLOWS["Main-Idea"];
  }
  return MATH_REASONING_FLOWS[category] || MATH_REASONING_FLOWS["Linear"];
}

export function getPrerequisites(
  section: Section,
  category: LibraryCategory
): LibraryCategory[] {
  return (PREREQUISITE_MAP[category] || []) as LibraryCategory[];
}
