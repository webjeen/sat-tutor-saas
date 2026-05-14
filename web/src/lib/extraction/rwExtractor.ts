import type {
  RWPatternType,
  RWReasoningCategory,
  PassageStructure,
  DistractorPattern,
  TransitionStructure,
  BoundaryLogic,
  EvidenceReasoning,
  RWExtractedData,
  PatternOutput,
} from "./types";
import type { ApprovedQuestionRow } from "./types";
import {
  countWords,
  countParagraphs,
  hasExtremeLanguage,
  classifySyntaxComplexity,
  classifyTimingComplexity,
  classifyAbstractionLevel,
  detectDiscourseMarkers,
} from "./textAnalysis";
import { normalize } from "../dedup/fingerprint";

// -- Question type classification --

const QUESTION_TYPE_KEYWORDS: Record<RWPatternType, string[]> = {
  "Main-Idea": [
    "main idea", "main point", "primary purpose", "main purpose",
    "primarily concerned", "central claim", "main argument",
    "primary focus", "overall message",
  ],
  Function: [
    "function", "purpose of", "role of", "serve", "primarily serve",
    "main purpose of", "intended effect",
  ],
  Inference: [
    "imply", "suggest", "infer", "inference", "implied",
    "suggests that", "implies that", "would agree", "most likely",
    "can be inferred", "can be concluded",
  ],
  Evidence: [
    "evidence", "support", "best support", "provide evidence",
    "which choice provides", "most strongly supported",
    "best illustrates", "best exemplifies", "cited as evidence",
    "command of evidence",
  ],
  Vocabulary: [
    "most nearly means", "closest in meaning", "as used in",
    "as used in line", "in context", "meaning of",
    "closest in meaning to",
  ],
  Transition: [
    "transition", "most logically", "most effectively",
    "which choice completes", "most logically follows",
    "most logically completes",
  ],
  Grammar: [
    "which choice", "grammar", "punctuation", "sentence structure",
    "verb tense", "pronoun", "subject-verb", "comma", "semicolon",
    "which of the following",
  ],
  Rhetorical: [
    "rhetorical", "rhetorical choice", "rhetorical strategy",
    "rhetorical effect", "stylistic choice", "stylistic effect",
    "author's strategy", "persuasive technique",
  ],
};

export function classifyRWQuestionType(
  questionText: string,
  questionType: string | null
): RWPatternType {
  // Primary: use parsed Question_Type tag if available
  if (questionType) {
    const lower = questionType.toLowerCase();
    if (lower.includes("main idea") || lower.includes("central")) return "Main-Idea";
    if (lower.includes("function") || lower.includes("purpose")) return "Function";
    if (lower.includes("inference") || lower.includes("imply") || lower.includes("suggest")) return "Inference";
    if (lower.includes("evidence") || lower.includes("support")) return "Evidence";
    if (lower.includes("vocab") || lower.includes("meaning") || lower.includes("context")) return "Vocabulary";
    if (lower.includes("transition") || lower.includes("complete")) return "Transition";
    if (lower.includes("grammar") || lower.includes("punctuation") || lower.includes("sentence")) return "Grammar";
    if (lower.includes("rhetorical") || lower.includes("style") || lower.includes("strategy")) return "Rhetorical";
  }

  // Fallback: keyword analysis of question text
  const lower = normalize(questionText);
  let bestMatch: RWPatternType = "Inference";
  let bestScore = 0;

  for (const [type, keywords] of Object.entries(QUESTION_TYPE_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      if (lower.includes(normalize(kw))) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = type as RWPatternType;
    }
  }

  return bestMatch;
}

// -- Reasoning category --

export function classifyReasoningCategory(
  questionType: RWPatternType,
  questionText: string
): RWReasoningCategory {
  const mapping: Partial<Record<RWPatternType, RWReasoningCategory>> = {
    "Main-Idea": "literal_comprehension",
    Vocabulary: "vocabulary_in_context",
    Evidence: "textual_evidence",
    Rhetorical: "rhetorical_analysis",
    Transition: "structural_analysis",
  };

  if (mapping[questionType]) return mapping[questionType]!;

  // Inference and Function need deeper analysis
  if (questionType === "Inference") {
    const lower = normalize(questionText);
    if (lower.includes("suggest") || lower.includes("imply")) return "inferential_reasoning";
    return "literal_comprehension";
  }

  if (questionType === "Function") return "rhetorical_analysis";
  if (questionType === "Grammar") return "structural_analysis";

  return "literal_comprehension";
}

// -- Passage structure --

export function classifyPassageStructure(passage: string): PassageStructure {
  if (!passage) return "expository";

  const paragraphs = countParagraphs(passage);
  const markers = detectDiscourseMarkers(passage);

  // Paired passage: typically 2+ distinct sections with different topics
  if (passage.includes("Passage 1") || passage.includes("Passage 2")) {
    return "paired_passage";
  }

  // Narrative: storytelling markers
  const narrativeMarkers = ["i ", "me ", "my ", "we ", "she ", "he ", "they "];
  const lower = passage.toLowerCase();
  const narrativeScore = narrativeMarkers.filter((m) => lower.includes(m)).length;

  // Argumentative: strong discourse markers
  const argScore = (markers.contrast || 0) + (markers.cause_effect || 0);

  // Literary: longer, fewer explicit discourse markers
  if (narrativeScore >= 3 && paragraphs <= 3 && argScore <= 1) return "narrative";
  if (narrativeScore >= 3 && argScore <= 2) return "literary";
  if (argScore >= 3) return "argumentative";

  return "expository";
}

// -- Distractor pattern --

export function classifyDistractorPattern(
  choices: Record<string, string>,
  correctChoice: string
): DistractorPattern {
  const correct = choices[correctChoice];
  if (!correct) return "conceptual_confusion";

  const incorrectKeys = Object.keys(choices).filter((k) => k !== correctChoice);
  const incorrectTexts = incorrectKeys.map((k) => normalize(choices[k] || ""));
  const correctNorm = normalize(correct);

  // Check for opposite: incorrect choices negate the correct
  const oppositeIndicators = ["not", "opposite", "never", "no"];
  const hasOpposite = incorrectTexts.some((t) =>
    oppositeIndicators.some((ind) => t.includes(ind) && !correctNorm.includes(ind))
  );

  // Check for extreme language in distractors
  const hasExtreme = incorrectTexts.some((t) => hasExtremeLanguage(t));

  // Check for out-of-scope: distractors mention concepts not in correct answer
  const correctWords = new Set(correctNorm.split(" "));
  const outOfScopeCount = incorrectTexts.filter((t) => {
    const words = new Set(t.split(" "));
    let overlap = 0;
    for (const w of words) {
      if (correctWords.has(w)) overlap++;
    }
    return overlap / Math.max(words.size, 1) < 0.3;
  }).length;

  // Check for partial truth: distractors share significant words with correct
  const partialTruthCount = incorrectTexts.filter((t) => {
    const words = new Set(t.split(" "));
    let overlap = 0;
    for (const w of words) {
      if (correctWords.has(w)) overlap++;
    }
    return overlap / Math.max(words.size, 1) >= 0.3 && overlap / Math.max(words.size, 1) < 0.6;
  }).length;

  if (hasOpposite) return "opposite";
  if (hasExtreme) return "extreme_language";
  if (outOfScopeCount >= 2) return "out_of_scope";
  if (partialTruthCount >= 2) return "partial_truth";

  return "misleading_association";
}

// -- Transition structure --

export function classifyTransitionStructure(
  passage: string,
  questionText: string
): TransitionStructure {
  const lower = normalize(questionText);

  // If the question is about transitions, analyze the passage
  if (!lower.includes("transition") && !lower.includes("completes")) {
    return "none";
  }

  const markers = detectDiscourseMarkers(passage);
  const maxCategory = Object.entries(markers).reduce(
    (best, [cat, count]) => (count > best.count ? { category: cat, count } : best),
    { category: "addition", count: 0 }
  );

  const categoryMap: Record<string, TransitionStructure> = {
    contrast: "contrast",
    cause_effect: "cause_effect",
    addition: "addition",
    sequence: "sequence",
    example: "example",
  };

  return categoryMap[maxCategory.category] || "addition";
}

// -- Boundary logic --

export function classifyBoundaryLogic(
  questionText: string,
  passage: string
): BoundaryLogic {
  const lower = normalize(questionText);

  // Line references indicate phrase/sentence boundary
  if (lower.includes("line") || lower.includes("lines")) {
    if (lower.includes("paragraph")) return "cross_paragraph";
    return "sentence_boundary";
  }

  // Paragraph-specific questions
  if (lower.includes("paragraph") || lower.includes("first paragraph") || lower.includes("second paragraph")) {
    if (passage.includes("Passage 1") || passage.includes("Passage 2")) {
      return "cross_paragraph";
    }
    return "paragraph_boundary";
  }

  // Specific phrase reference
  if (lower.includes("as used in") || lower.includes("in context")) {
    return "phrase_boundary";
  }

  // Default for passage-level questions
  const paragraphs = countParagraphs(passage);
  if (paragraphs > 2) return "cross_paragraph";
  return "paragraph_boundary";
}

// -- Evidence reasoning --

export function classifyEvidenceReasoning(
  questionType: RWPatternType,
  questionText: string
): EvidenceReasoning {
  const lower = normalize(questionText);

  if (questionType === "Evidence") {
    if (lower.includes("direct") || lower.includes("quote") || lower.includes("cited")) {
      return "direct_quote";
    }
    if (lower.includes("paraphrase") || lower.includes("restates")) {
      return "paraphrase";
    }
    if (lower.includes("imply") || lower.includes("suggest")) {
      return "implication";
    }
    if (lower.includes("synthesize") || lower.includes("combine")) {
      return "synthesis";
    }
    return "direct_quote";
  }

  if (questionType === "Inference") {
    if (lower.includes("not") || lower.includes("except")) return "negation";
    return "implication";
  }

  if (questionType === "Main-Idea") return "paraphrase";
  if (questionType === "Vocabulary") return "direct_quote";

  return "paraphrase";
}

// -- Main extraction entry point --

export function extractRWPattern(
  question: ApprovedQuestionRow
): RWExtractedData {
  const questionText = question.raw_question || "";
  const passage = question.raw_passage || "";
  const choices: Record<string, string> = {};
  if (question.choice_a) choices["A"] = question.choice_a;
  if (question.choice_b) choices["B"] = question.choice_b;
  if (question.choice_c) choices["C"] = question.choice_c;
  if (question.choice_d) choices["D"] = question.choice_d;

  const questionType = classifyRWQuestionType(questionText, question.question_type);
  const reasoningCategory = classifyReasoningCategory(questionType, questionText);
  const passageStructure = classifyPassageStructure(passage);
  const distractorPattern = classifyDistractorPattern(choices, question.correct_choice || "");
  const transitionStructure = classifyTransitionStructure(passage, questionText);
  const boundaryLogic = classifyBoundaryLogic(questionText, passage);
  const evidenceReasoning = classifyEvidenceReasoning(questionType, questionText);

  return {
    question_type: questionType,
    reasoning_category: reasoningCategory,
    passage_structure: passageStructure,
    distractor_pattern: distractorPattern,
    transition_structure: transitionStructure,
    boundary_logic: boundaryLogic,
    evidence_reasoning: evidenceReasoning,
  };
}

// -- Compute unified PatternOutput --

export function computePatternOutput(
  extracted: RWExtractedData,
  passage: string,
  questionText: string
): PatternOutput {
  const wordCount = countWords(passage) + countWords(questionText);
  const syntaxComplexity = classifySyntaxComplexity(passage || questionText);
  const abstractionLevel = classifyAbstractionLevel(extracted.reasoning_category);
  const timingComplexity = classifyTimingComplexity(
    wordCount,
    extracted.reasoning_category === "inferential_reasoning" ? "two_step" : "single_step"
  );

  return {
    question_type: extracted.question_type,
    reasoning_pattern: extracted.reasoning_category,
    difficulty_band: "", // assigned by difficulty module later
    distractor_pattern: extracted.distractor_pattern,
    timing_complexity: timingComplexity,
    syntax_complexity: syntaxComplexity,
    abstraction_level: abstractionLevel,
  };
}
