import type { DistractorCatalogEntry } from "./types";
import type { DistractorPattern } from "../extraction/types";

export const DISTRACTOR_CATALOG_SEED: Omit<DistractorCatalogEntry, "id" | "created_at" | "updated_at">[] = [
  {
    distractor_type: "opposite",
    section: "both",
    strategy_description: "Presents a statement that directly contradicts the correct answer or reverses a key relationship",
    generation_guidance: {
      rw_rules: [
        "Negate the central claim using opposite qualifiers or reversed causation",
        "Present the inverse of the author's stated position",
      ],
      math_rules: [
        "Flip the sign of the correct numerical answer",
        "Use the inverse operation result (e.g., division instead of multiplication)",
      ],
      avoidance_rules: [
        "Do not make the negation too obvious with simple word substitution",
        "Ensure the opposite claim still sounds plausible within context",
      ],
    },
    quality_criteria: [
      "The opposite claim must be derivable from content with a logical error",
      "Must not be trivially detectable by looking for negation words alone",
      "Should require understanding of the full reasoning to eliminate",
    ],
    example_signals: ["negation_in_distractor", "sign_flip", "reversed_relationship"],
    effectiveness_rating: 0.75,
    usage_count: 0,
  },
  {
    distractor_type: "partial_truth",
    section: "both",
    strategy_description: "Contains elements that are factually correct from the source but do not fully answer the question",
    generation_guidance: {
      rw_rules: [
        "Select a statement that is factually true from the passage but does not address the question",
        "Include enough passage vocabulary to sound correct",
      ],
      math_rules: [
        "Compute a partial result from the correct calculation path",
        "Use an intermediate value as if it were the final answer",
        "Report the result of only the first step in a multi-step problem",
      ],
      avoidance_rules: [
        "Do not make the partial answer obviously incomplete",
        "The partial truth must be verifiable from the given information",
      ],
    },
    quality_criteria: [
      "At least one factual element must be verifiably true from the source",
      "The incomplete portion must not be obvious without careful analysis",
      "Should require distinguishing between partial and complete answers",
    ],
    example_signals: ["word_overlap_30-60%", "half_double", "off_by_one", "intermediate_value"],
    effectiveness_rating: 0.85,
    usage_count: 0,
  },
  {
    distractor_type: "out_of_scope",
    section: "both",
    strategy_description: "References topics or concepts mentioned in the source but irrelevant to the specific question being asked",
    generation_guidance: {
      rw_rules: [
        "Reference a topic mentioned in the passage but unrelated to the question's scope",
        "Use vocabulary from the passage in a context that doesn't answer the question",
      ],
      math_rules: [
        "Include a number or formula from the problem that isn't needed for the solution",
        "Reference a variable or quantity that exists but isn't relevant to the asked quantity",
      ],
      avoidance_rules: [
        "The out-of-scope content must still be connected to the passage or problem",
        "Do not use completely random or fabricated information",
      ],
    },
    quality_criteria: [
      "Must be tangentially related to the source material",
      "Should not be eliminable by simple keyword matching",
      "Requires understanding of what the question is actually asking",
    ],
    example_signals: ["low_word_overlap", "unrelated_nums", "tangential_topic"],
    effectiveness_rating: 0.70,
    usage_count: 0,
  },
  {
    distractor_type: "extreme_language",
    section: "both",
    strategy_description: "Uses absolute or extreme language (always, never, must, impossible) that goes beyond what the source supports",
    generation_guidance: {
      rw_rules: [
        "Replace a qualified claim with an absolute version using 'always', 'never', or 'must'",
        "Take a conditional statement and present it as universal",
      ],
      math_rules: [
        "State that a relationship always holds when it only holds under specific conditions",
        "Use absolute bounds where the problem implies a range",
      ],
      avoidance_rules: [
        "Do not overuse this pattern — SAT typically avoids extreme answers",
        "The extreme version should still relate to the source material",
      ],
    },
    quality_criteria: [
      "The extreme claim must be a plausible exaggeration of a true claim",
      "Should be eliminable by identifying the absolute qualifier",
      "Must not be obviously wrong on its face without reference to the source",
    ],
    example_signals: ["extreme_language_detected", "absolute_qualifier", "universal_claim"],
    effectiveness_rating: 0.60,
    usage_count: 0,
  },
  {
    distractor_type: "misleading_association",
    section: "both",
    strategy_description: "Creates a plausible-sounding connection between concepts that is actually incorrect upon careful analysis",
    generation_guidance: {
      rw_rules: [
        "Associate two concepts that appear together in the passage but are not causally linked",
        "Create a cause-effect relationship that sounds logical but isn't supported by the text",
      ],
      math_rules: [
        "Mix up the order of operations in a way that produces a plausible number",
        "Apply a correct formula to the wrong variables in the problem",
      ],
      avoidance_rules: [
        "The association must sound logical at first glance",
        "Do not create obviously nonsensical connections",
      ],
    },
    quality_criteria: [
      "The association must be superficially plausible",
      "Requires careful analysis to identify the logical gap",
      "Should exploit common misconceptions or surface-level reasoning",
    ],
    example_signals: ["moderate_word_overlap", "plausible_but_wrong_causal", "mixed_operations"],
    effectiveness_rating: 0.80,
    usage_count: 0,
  },
  {
    distractor_type: "sound_alike",
    section: "RW",
    strategy_description: "Uses a word that sounds similar to a key term but has a different meaning, exploiting vocabulary confusion",
    generation_guidance: {
      rw_rules: [
        "Replace a key word with a homophone or near-homophone that changes the meaning",
        "Use a commonly confused word pair (affect/effect, principal/principle, etc.)",
      ],
      avoidance_rules: [
        "The confused word must be a real word with its own valid meaning",
        "Do not use obscure or fabricated words",
      ],
    },
    quality_criteria: [
      "The confused word must be a real English word",
      "The confusion must be a commonly tested vocabulary distinction",
      "Both words should be plausible in the given context",
    ],
    example_signals: ["affect/effect", "principle/principal", "complement/compliment", "discrete/discreet"],
    effectiveness_rating: 0.65,
    usage_count: 0,
  },
  {
    distractor_type: "conceptual_confusion",
    section: "both",
    strategy_description: "Mixes up related but distinct concepts, exploiting superficial similarity between ideas that differ in important ways",
    generation_guidance: {
      rw_rules: [
        "Substitute a related concept for the correct one (e.g., 'imply' vs 'state')",
        "Confuse the author's attitude with the passage's content",
      ],
      math_rules: [
        "Confuse dependent and independent variables",
        "Mix up mean and median, or slope and y-intercept",
        "Treat correlation as causation in a statistics context",
      ],
      avoidance_rules: [
        "The confused concept must be genuinely related to the correct one",
        "Do not confuse concepts that are obviously unrelated",
      ],
    },
    quality_criteria: [
      "The confused concept must be from the same domain as the correct answer",
      "Should exploit a genuine, common conceptual misunderstanding",
      "Requires understanding of the distinction between the concepts",
    ],
    example_signals: ["high_word_overlap", "related_concept_swap", "variable_confusion"],
    effectiveness_rating: 0.78,
    usage_count: 0,
  },
];

export function getCatalogEntry(
  distractorType: DistractorPattern
): Omit<DistractorCatalogEntry, "id" | "created_at" | "updated_at"> | undefined {
  return DISTRACTOR_CATALOG_SEED.find((e) => e.distractor_type === distractorType);
}

export function getCatalogForSection(
  section: "RW" | "Math"
): Omit<DistractorCatalogEntry, "id" | "created_at" | "updated_at">[] {
  return DISTRACTOR_CATALOG_SEED.filter(
    (e) => e.section === section || e.section === "both"
  );
}

export function getDistractorGuidance(
  distractorType: DistractorPattern,
  section: "RW" | "Math"
): { rules: string[]; avoidance: string[] } {
  const entry = getCatalogEntry(distractorType);
  if (!entry) return { rules: [], avoidance: [] };

  const rules = section === "RW"
    ? entry.generation_guidance.rw_rules || []
    : entry.generation_guidance.math_rules || [];

  return {
    rules,
    avoidance: entry.generation_guidance.avoidance_rules || [],
  };
}

export function validateDistractorQuality(
  distractorType: DistractorPattern,
  _distractorText: string,
  _correctText: string,
  _section: "RW" | "Math"
): { passes: boolean; failedCriteria: string[] } {
  const entry = getCatalogEntry(distractorType);
  if (!entry) return { passes: false, failedCriteria: ["Unknown distractor type"] };

  // Quality validation against criteria is a placeholder —
  // the actual content analysis will be implemented when the generation engine exists.
  return { passes: true, failedCriteria: [] };
}
