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
  FieldConfidence,
  ExtractionConfidence,
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
import {
  buildFieldConfidence,
  computeExtractionConfidence,
  keywordConfidence,
  heuristicConfidence,
  fallbackConfidence,
} from "./confidence";
import { normalize } from "../dedup/fingerprint";

// -- Question type classification --
// Keywords weighted by specificity: high-specificity phrases get more weight

interface KeywordEntry {
  phrase: string;
  weight: number;
  specificity: "high" | "medium" | "low";
}

const QUESTION_TYPE_KEYWORDS: Record<RWPatternType, KeywordEntry[]> = {
  "Main-Idea": [
    { phrase: "main idea", weight: 3, specificity: "high" },
    { phrase: "main point", weight: 3, specificity: "high" },
    { phrase: "primary purpose", weight: 3, specificity: "high" },
    { phrase: "main purpose", weight: 3, specificity: "high" },
    { phrase: "primarily concerned", weight: 3, specificity: "high" },
    { phrase: "central claim", weight: 2, specificity: "high" },
    { phrase: "main argument", weight: 2, specificity: "high" },
    { phrase: "primary focus", weight: 2, specificity: "medium" },
    { phrase: "overall message", weight: 2, specificity: "medium" },
  ],
  Function: [
    { phrase: "function of", weight: 3, specificity: "high" },
    { phrase: "purpose of the sentence", weight: 3, specificity: "high" },
    { phrase: "purpose of the paragraph", weight: 3, specificity: "high" },
    { phrase: "role of", weight: 2, specificity: "high" },
    { phrase: "primarily serve", weight: 3, specificity: "high" },
    { phrase: "intended effect", weight: 2, specificity: "medium" },
    { phrase: "purpose of", weight: 1, specificity: "low" },
  ],
  Inference: [
    { phrase: "can be inferred", weight: 3, specificity: "high" },
    { phrase: "can be concluded", weight: 3, specificity: "high" },
    { phrase: "imply", weight: 2, specificity: "medium" },
    { phrase: "suggest", weight: 1, specificity: "low" },
    { phrase: "inference", weight: 3, specificity: "high" },
    { phrase: "implied", weight: 2, specificity: "medium" },
    { phrase: "would agree", weight: 2, specificity: "high" },
    { phrase: "most likely", weight: 1, specificity: "low" },
  ],
  Evidence: [
    { phrase: "evidence", weight: 2, specificity: "medium" },
    { phrase: "best support", weight: 3, specificity: "high" },
    { phrase: "provide evidence", weight: 3, specificity: "high" },
    { phrase: "most strongly supported", weight: 3, specificity: "high" },
    { phrase: "best illustrates", weight: 2, specificity: "medium" },
    { phrase: "best exemplifies", weight: 2, specificity: "medium" },
    { phrase: "cited as evidence", weight: 3, specificity: "high" },
    { phrase: "command of evidence", weight: 3, specificity: "high" },
  ],
  Vocabulary: [
    { phrase: "most nearly means", weight: 3, specificity: "high" },
    { phrase: "closest in meaning", weight: 3, specificity: "high" },
    { phrase: "as used in line", weight: 3, specificity: "high" },
    { phrase: "as used in the passage", weight: 3, specificity: "high" },
    { phrase: "as used in the text", weight: 3, specificity: "high" },
    { phrase: "in context, the word", weight: 3, specificity: "high" },
    { phrase: "meaning of", weight: 1, specificity: "low" },
  ],
  Transition: [
    { phrase: "most logically completes", weight: 3, specificity: "high" },
    { phrase: "most logically follows", weight: 3, specificity: "high" },
    { phrase: "most effectively", weight: 2, specificity: "medium" },
    { phrase: "which choice completes the text", weight: 3, specificity: "high" },
  ],
  Grammar: [
    { phrase: "which choice completes the text so that", weight: 1, specificity: "low" },
    { phrase: "grammar", weight: 2, specificity: "medium" },
    { phrase: "punctuation", weight: 2, specificity: "medium" },
    { phrase: "verb tense", weight: 3, specificity: "high" },
    { phrase: "pronoun", weight: 3, specificity: "high" },
    { phrase: "subject-verb agreement", weight: 3, specificity: "high" },
    { phrase: "comma splice", weight: 3, specificity: "high" },
    { phrase: "semicolon", weight: 2, specificity: "medium" },
    { phrase: "dangling modifier", weight: 3, specificity: "high" },
    { phrase: "sentence boundary", weight: 3, specificity: "high" },
    { phrase: "run-on", weight: 3, specificity: "high" },
  ],
  Rhetorical: [
    { phrase: "rhetorical choice", weight: 3, specificity: "high" },
    { phrase: "rhetorical strategy", weight: 3, specificity: "high" },
    { phrase: "rhetorical effect", weight: 3, specificity: "high" },
    { phrase: "stylistic choice", weight: 3, specificity: "high" },
    { phrase: "stylistic effect", weight: 2, specificity: "medium" },
    { phrase: "persuasive technique", weight: 2, specificity: "medium" },
    { phrase: "author's strategy", weight: 2, specificity: "medium" },
  ],
};

export function classifyRWQuestionType(
  questionText: string,
  questionType: string | null
): { type: RWPatternType; confidence: FieldConfidence } {
  const lower = normalize(questionText);
  const signals: string[] = [];

  // Primary: use parsed Question_Type tag if available
  if (questionType) {
    const tagLower = questionType.toLowerCase();
    const tagMap: [RegExp, RWPatternType][] = [
      [/main.?idea|central/, "Main-Idea"],
      [/\bfunction\b|\bpurpose\b/, "Function"],
      [/\binferr|\bimpl(y|ied)|\bsuggest/, "Inference"],
      [/\bevidence|\bsupport/, "Evidence"],
      [/\bvocab|\bmeaning|\bcontext/, "Vocabulary"],
      [/\btransition|\bcomplete/, "Transition"],
      [/\bgrammar|\bpunctuat|\bsentence\b/, "Grammar"],
      [/\brhetoric|\bstyle|\bstrategy/, "Rhetorical"],
    ];

    for (const [regex, type] of tagMap) {
      if (regex.test(tagLower)) {
        signals.push(`tag:${questionType}`);
        return {
          type,
          confidence: buildFieldConfidence(
            "question_type", type, 0.93, "tag", signals
          ),
        };
      }
    }

    // Tag exists but didn't match any known pattern
    signals.push(`tag_unmatched:${questionType}`);
  }

  // Fallback: weighted keyword analysis
  const scores: Record<string, { total: number; matches: string[] }> = {};

  for (const [type, keywords] of Object.entries(QUESTION_TYPE_KEYWORDS)) {
    let total = 0;
    const matches: string[] = [];

    for (const kw of keywords) {
      if (lower.includes(normalize(kw.phrase))) {
        total += kw.weight;
        matches.push(kw.phrase);
      }
    }

    scores[type] = { total, matches };
  }

  // Sort by total weight, then by high-specificity match count for tie-breaking
  const sorted = Object.entries(scores)
    .sort((a, b) => {
      if (b[1].total !== a[1].total) return b[1].total - a[1].total;
      // Tie-break: prefer type with more high-specificity matches
      const aHighSpec = (QUESTION_TYPE_KEYWORDS[a[0] as RWPatternType] || [])
        .filter((kw) => kw.specificity === "high" && lower.includes(normalize(kw.phrase))).length;
      const bHighSpec = (QUESTION_TYPE_KEYWORDS[b[0] as RWPatternType] || [])
        .filter((kw) => kw.specificity === "high" && lower.includes(normalize(kw.phrase))).length;
      return bHighSpec - aHighSpec;
    });

  const best = sorted[0];
  const secondBest = sorted[1];
  const isTied = best[1].total > 0 && secondBest && secondBest[1].total === best[1].total;

  if (!best || best[1].total === 0) {
    // No keyword match at all — low confidence, default to Inference with fallback
    signals.push("no_keyword_match");
    return {
      type: "Inference",
      confidence: buildFieldConfidence(
        "question_type", "Inference", fallbackConfidence(), "fallback", signals
      ),
    };
  }

  const matchCount = best[1].matches.length;
  const totalKeywords = QUESTION_TYPE_KEYWORDS[best[0] as RWPatternType].length;
  const secondBestCount = secondBest ? secondBest[1].total : 0;
  let conf = keywordConfidence(matchCount, totalKeywords, secondBestCount);

  // Tie penalty: equal scores mean higher misclassification risk
  if (isTied) {
    conf = Math.min(conf, 0.45);
    signals.push("tied_with:" + (secondBest ? secondBest[0] : "unknown"));
  }

  signals.push(...best[1].matches);

  return {
    type: best[0] as RWPatternType,
    confidence: buildFieldConfidence(
      "question_type", best[0], conf, "keyword", signals
    ),
  };
}

// -- Reasoning category --
// Now with text-signal depth analysis instead of pure type mapping

export function classifyReasoningCategory(
  questionType: RWPatternType,
  questionText: string
): { category: RWReasoningCategory; confidence: FieldConfidence } {
  const lower = normalize(questionText);
  const signals: string[] = [];

  // Direct type → category mappings (high confidence)
  const directMap: Record<RWPatternType, RWReasoningCategory> = {
    "Main-Idea": "literal_comprehension",
    Vocabulary: "vocabulary_in_context",
    Evidence: "textual_evidence",
    Rhetorical: "rhetorical_analysis",
    Transition: "structural_analysis",
    Grammar: "structural_analysis",
    Inference: "inferential_reasoning",
    Function: "rhetorical_analysis",
  };

  const baseCategory = directMap[questionType];
  signals.push(`type:${questionType}`);

  // Inference sub-classification: check for suggest/imply depth
  if (questionType === "Inference") {
    const inferentialSignals = ["suggest", "imply", "infer", "would agree", "most likely", "can be concluded"];
    const literalSignals = ["according to", "states", "mentions", "describes", "indicates"];

    const inferScore = inferentialSignals.filter((s) => lower.includes(s)).length;
    const litScore = literalSignals.filter((s) => lower.includes(s)).length;

    if (inferScore > litScore) {
      signals.push(...inferentialSignals.filter((s) => lower.includes(s)));
      return {
        category: "inferential_reasoning",
        confidence: buildFieldConfidence(
          "reasoning_category", "inferential_reasoning",
          heuristicConfidence(inferScore, 1), "keyword", signals
        ),
      };
    }

    if (litScore > 0) {
      signals.push(...literalSignals.filter((s) => lower.includes(s)));
      return {
        category: "literal_comprehension",
        confidence: buildFieldConfidence(
          "reasoning_category", "literal_comprehension",
          heuristicConfidence(litScore, 1), "keyword", signals
        ),
      };
    }

    // Default for Inference type: inferential (it's an inference question)
    return {
      category: "inferential_reasoning",
      confidence: buildFieldConfidence(
        "reasoning_category", "inferential_reasoning", 0.7, "heuristic", signals
      ),
    };
  }

  // Function sub-classification: structural vs rhetorical function
  if (questionType === "Function") {
    const structuralSignals = ["introduces", "transition", "concludes", "sets up", "shift", "provides context"];
    const rhetoricalSignals = ["emphasize", "highlight", "underscore", "illustrate", "reinforce"];

    const structScore = structuralSignals.filter((s) => lower.includes(s)).length;
    const rhetScore = rhetoricalSignals.filter((s) => lower.includes(s)).length;

    if (structScore > rhetScore) {
      signals.push(...structuralSignals.filter((s) => lower.includes(s)));
      return {
        category: "structural_analysis",
        confidence: buildFieldConfidence(
          "reasoning_category", "structural_analysis",
          heuristicConfidence(structScore, 1), "keyword", signals
        ),
      };
    }

    signals.push("default:rhetorical_analysis");
    return {
      category: "rhetorical_analysis",
      confidence: buildFieldConfidence(
        "reasoning_category", "rhetorical_analysis", 0.65, "heuristic", signals
      ),
    };
  }

  // Direct mappings
  return {
    category: baseCategory,
    confidence: buildFieldConfidence(
      "reasoning_category", baseCategory, 0.9, "tag", signals
    ),
  };
}

// -- Passage structure --

export function classifyPassageStructure(passage: string): { structure: PassageStructure; confidence: FieldConfidence } {
  if (!passage) {
    return {
      structure: "expository",
      confidence: buildFieldConfidence("passage_structure", "expository", fallbackConfidence(), "fallback", ["no_passage"]),
    };
  }

  const markers = detectDiscourseMarkers(passage);
  const signals: string[] = [];

  // Paired passage detection
  if (passage.includes("Passage 1") || passage.includes("Passage 2") || passage.includes("Passage A") || passage.includes("Passage B")) {
    signals.push("paired_passage_markers");
    return {
      structure: "paired_passage",
      confidence: buildFieldConfidence("passage_structure", "paired_passage", 0.95, "keyword", signals),
    };
  }

  const lower = passage.toLowerCase();

  // Narrative: first-person and storytelling markers
  const narrativeMarkers = ["i ", "me ", "my ", "we ", "she ", "he ", "they ", "said ", "told ", "felt ", "remembered "];
  const narrativeScore = narrativeMarkers.filter((m) => lower.includes(m)).length;

  // Argumentative: strong discourse markers
  const argScore = (markers.contrast || 0) + (markers.cause_effect || 0);

  // Literary: narrative + longer passages with dialogue
  const dialogueScore = (lower.match(/[""][^""]*[""]/g) || []).length;

  if (narrativeScore >= 4 && dialogueScore >= 3) {
    signals.push(`narrative:${narrativeScore}`, `dialogue:${dialogueScore}`);
    return {
      structure: "literary",
      confidence: buildFieldConfidence("passage_structure", "literary", 0.85, "heuristic", signals),
    };
  }

  if (narrativeScore >= 3 && argScore <= 1) {
    signals.push(`narrative:${narrativeScore}`);
    return {
      structure: "narrative",
      confidence: buildFieldConfidence("passage_structure", "narrative", 0.8, "heuristic", signals),
    };
  }

  if (argScore >= 3) {
    signals.push(`argumentative:${argScore}`);
    return {
      structure: "argumentative",
      confidence: buildFieldConfidence("passage_structure", "argumentative", 0.8, "heuristic", signals),
    };
  }

  if (narrativeScore >= 2 && argScore <= 2) {
    signals.push(`narrative:${narrativeScore}`, `weak_arg:${argScore}`);
    return {
      structure: "literary",
      confidence: buildFieldConfidence("passage_structure", "literary", 0.6, "heuristic", signals),
    };
  }

  signals.push("default:expository");
  return {
    structure: "expository",
    confidence: buildFieldConfidence("passage_structure", "expository", 0.55, "heuristic", signals),
  };
}

// -- Distractor pattern --
// Now with multi-signal weighted scoring and sound_alike detection

export function classifyDistractorPattern(
  choices: Record<string, string>,
  correctChoice: string,
  section: "RW" | "Math" = "RW"
): { pattern: DistractorPattern; confidence: FieldConfidence } {
  const correct = choices[correctChoice];
  if (!correct) {
    return {
      pattern: "conceptual_confusion",
      confidence: buildFieldConfidence("distractor_pattern", "conceptual_confusion", fallbackConfidence(), "fallback", ["no_correct_choice"]),
    };
  }

  const incorrectKeys = Object.keys(choices).filter((k) => k !== correctChoice);
  const incorrectTexts = incorrectKeys.map((k) => choices[k] || "");
  const correctNorm = normalize(correct);
  const correctWords = new Set(correctNorm.split(" "));

  // Score each distractor pattern type
  const patternScores: Record<string, { score: number; signals: string[] }> = {
    opposite: { score: 0, signals: [] },
    partial_truth: { score: 0, signals: [] },
    out_of_scope: { score: 0, signals: [] },
    extreme_language: { score: 0, signals: [] },
    sound_alike: { score: 0, signals: [] },
    conceptual_confusion: { score: 0, signals: [] },
    misleading_association: { score: 0, signals: [] },
  };

  for (let i = 0; i < incorrectTexts.length; i++) {
    const incNorm = normalize(incorrectTexts[i]);
    const incWords = new Set(incNorm.split(" "));

    // Word overlap calculation
    let overlap = 0;
    for (const w of incWords) {
      if (correctWords.has(w)) overlap++;
    }
    const overlapRatio = overlap / Math.max(incWords.size, 1);

    // Opposite: negation or direct contradiction
    const oppositeIndicators = ["not", "opposite", "never", "no", "cannot", "neither"];
    if (oppositeIndicators.some((ind) => incNorm.includes(ind) && !correctNorm.includes(ind))) {
      patternScores.opposite.score += 2;
      patternScores.opposite.signals.push(`negation_in_choice_${incorrectKeys[i]}`);
    }

    // Partial truth: significant word overlap (0.3–0.6)
    if (overlapRatio >= 0.3 && overlapRatio < 0.6) {
      patternScores.partial_truth.score += 1.5;
      patternScores.partial_truth.signals.push(`overlap_${Math.round(overlapRatio * 100)}%_choice_${incorrectKeys[i]}`);
    }

    // Out of scope: very low overlap
    if (overlapRatio < 0.2 && incWords.size > 3) {
      patternScores.out_of_scope.score += 1.5;
      patternScores.out_of_scope.signals.push(`low_overlap_${Math.round(overlapRatio * 100)}%_choice_${incorrectKeys[i]}`);
    }

    // Extreme language in distractors
    if (hasExtremeLanguage(incorrectTexts[i])) {
      patternScores.extreme_language.score += 2;
      patternScores.extreme_language.signals.push(`extreme_in_choice_${incorrectKeys[i]}`);
    }

    // Sound-alike: phonetic similarity (common SAT trap for vocabulary)
    if (section === "RW") {
      const soundAlikePairs = [
        ["affect", "effect"], ["principle", "principal"], ["stationary", "stationery"],
        ["complement", "compliment"], ["discrete", "discreet"], ["elicit", "illicit"],
        ["council", "counsel"], ["allusion", "illusion"], ["ambivalent", "ambiguous"],
      ];
      for (const [word1, word2] of soundAlikePairs) {
        if ((correctNorm.includes(word1) && incNorm.includes(word2)) ||
            (correctNorm.includes(word2) && incNorm.includes(word1))) {
          patternScores.sound_alike.score += 3;
          patternScores.sound_alike.signals.push(`${word1}/${word2}_pair`);
        }
      }
    }

    // Conceptual confusion: topic overlap but wrong relationship
    if (overlapRatio >= 0.4 && overlapRatio < 0.7) {
      const topicWords = correctWords.intersection(incWords);
      if (topicWords.size >= 2) {
        patternScores.conceptual_confusion.score += 1;
        patternScores.conceptual_confusion.signals.push(`topic_overlap_choice_${incorrectKeys[i]}`);
      }
    }

    // Misleading association: moderate overlap with plausible but wrong connection
    if (overlapRatio >= 0.2 && overlapRatio < 0.4) {
      patternScores.misleading_association.score += 1;
      patternScores.misleading_association.signals.push(`misleading_overlap_choice_${incorrectKeys[i]}`);
    }
  }

  // Pick highest scoring pattern
  const sorted = Object.entries(patternScores)
    .sort((a, b) => b[1].score - a[1].score);

  const best = sorted[0];

  if (!best || best[1].score === 0) {
    return {
      pattern: "misleading_association",
      confidence: buildFieldConfidence(
        "distractor_pattern", "misleading_association",
        fallbackConfidence(), "fallback", ["no_matching_signals"]
      ),
    };
  }

  const secondBestScore = sorted[1] ? sorted[1][1].score : 0;
  const gap = best[1].score - secondBestScore;
  const conf = gap >= 2 ? 0.85 : gap >= 1 ? 0.7 : 0.5;

  return {
    pattern: best[0] as DistractorPattern,
    confidence: buildFieldConfidence(
      "distractor_pattern", best[0], conf, "heuristic", best[1].signals
    ),
  };
}

// -- Transition structure --

export function classifyTransitionStructure(
  passage: string,
  questionText: string
): { structure: TransitionStructure; confidence: FieldConfidence } {
  const lower = normalize(questionText);
  const signals: string[] = [];

  if (!lower.includes("transition") && !lower.includes("completes") && !lower.includes("logically follows")) {
    return {
      structure: "none",
      confidence: buildFieldConfidence("transition_structure", "none", 0.9, "heuristic", ["not_transition_question"]),
    };
  }

  signals.push("transition_question");

  const markers = detectDiscourseMarkers(passage);
  const maxCategory = Object.entries(markers)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])[0];

  const categoryMap: Record<string, TransitionStructure> = {
    contrast: "contrast",
    cause_effect: "cause_effect",
    addition: "addition",
    sequence: "sequence",
    example: "example",
  };

  if (!maxCategory || maxCategory[1] === 0) {
    signals.push("no_discourse_markers_found");
    return {
      structure: "addition",
      confidence: buildFieldConfidence("transition_structure", "addition", fallbackConfidence(), "fallback", signals),
    };
  }

  const structure = categoryMap[maxCategory[0]] || "addition";
  signals.push(`${maxCategory[0]}:${maxCategory[1]}`);

  return {
    structure,
    confidence: buildFieldConfidence(
      "transition_structure", structure,
      heuristicConfidence(maxCategory[1], 1), "keyword", signals
    ),
  };
}

// -- Boundary logic --

export function classifyBoundaryLogic(
  questionText: string,
  passage: string
): { logic: BoundaryLogic; confidence: FieldConfidence } {
  const lower = normalize(questionText);
  const signals: string[] = [];

  // Line references indicate phrase/sentence boundary
  if (/line\s+\d/i.test(questionText)) {
    if (lower.includes("paragraph")) {
      signals.push("line_ref+paragraph");
      return {
        logic: "cross_paragraph",
        confidence: buildFieldConfidence("boundary_logic", "cross_paragraph", 0.85, "keyword", signals),
      };
    }
    signals.push("line_reference");
    return {
      logic: "sentence_boundary",
      confidence: buildFieldConfidence("boundary_logic", "sentence_boundary", 0.85, "keyword", signals),
    };
  }

  if (lower.includes("paragraph")) {
    if (passage.includes("Passage 1") || passage.includes("Passage 2")) {
      signals.push("paragraph_ref+paired");
      return {
        logic: "cross_paragraph",
        confidence: buildFieldConfidence("boundary_logic", "cross_paragraph", 0.8, "keyword", signals),
      };
    }
    signals.push("paragraph_reference");
    return {
      logic: "paragraph_boundary",
      confidence: buildFieldConfidence("boundary_logic", "paragraph_boundary", 0.85, "keyword", signals),
    };
  }

  if (lower.includes("as used in") || lower.includes("in context")) {
    signals.push("phrase_reference");
    return {
      logic: "phrase_boundary",
      confidence: buildFieldConfidence("boundary_logic", "phrase_boundary", 0.8, "keyword", signals),
    };
  }

  const paragraphCount = countParagraphs(passage);
  if (paragraphCount > 2) {
    signals.push(`multi_paragraph:${paragraphCount}`);
    return {
      logic: "cross_paragraph",
      confidence: buildFieldConfidence("boundary_logic", "cross_paragraph", 0.5, "heuristic", signals),
    };
  }

  signals.push("default:paragraph_boundary");
  return {
    logic: "paragraph_boundary",
    confidence: buildFieldConfidence("boundary_logic", "paragraph_boundary", 0.5, "heuristic", signals),
  };
}

// -- Evidence reasoning --

export function classifyEvidenceReasoning(
  questionType: RWPatternType,
  questionText: string
): { reasoning: EvidenceReasoning; confidence: FieldConfidence } {
  const lower = normalize(questionText);
  const signals: string[] = [];

  if (questionType === "Evidence") {
    const evidenceSignals: [string, EvidenceReasoning][] = [
      ["direct", "direct_quote"],
      ["quote", "direct_quote"],
      ["cited", "direct_quote"],
      ["paraphrase", "paraphrase"],
      ["restates", "paraphrase"],
      ["imply", "implication"],
      ["suggest", "implication"],
      ["synthesize", "synthesis"],
      ["combine", "synthesis"],
    ];

    for (const [signal, reasoning] of evidenceSignals) {
      if (lower.includes(signal)) {
        signals.push(signal);
        return {
          reasoning,
          confidence: buildFieldConfidence(
            "evidence_reasoning", reasoning, 0.8, "keyword", signals
          ),
        };
      }
    }

    // Default for Evidence type: direct_quote
    signals.push("default:direct_quote");
    return {
      reasoning: "direct_quote",
      confidence: buildFieldConfidence("evidence_reasoning", "direct_quote", 0.6, "heuristic", signals),
    };
  }

  if (questionType === "Inference") {
    if (lower.includes("not") || lower.includes("except")) {
      signals.push("negation");
      return {
        reasoning: "negation",
        confidence: buildFieldConfidence("evidence_reasoning", "negation", 0.8, "keyword", signals),
      };
    }
    signals.push("default:implication");
    return {
      reasoning: "implication",
      confidence: buildFieldConfidence("evidence_reasoning", "implication", 0.7, "heuristic", signals),
    };
  }

  const typeDefaults: Record<RWPatternType, EvidenceReasoning> = {
    "Main-Idea": "paraphrase",
    Vocabulary: "direct_quote",
    Function: "paraphrase",
    Transition: "paraphrase",
    Grammar: "direct_quote",
    Rhetorical: "implication",
    Evidence: "direct_quote",
    Inference: "implication",
  };

  const reasoning = typeDefaults[questionType];
  signals.push(`default:${reasoning}`);
  return {
    reasoning,
    confidence: buildFieldConfidence("evidence_reasoning", reasoning, 0.65, "heuristic", signals),
  };
}

// -- Main extraction entry point --

export function extractRWPattern(
  question: ApprovedQuestionRow
): { data: RWExtractedData; confidence: ExtractionConfidence } {
  const questionText = question.raw_question || "";
  const passage = question.raw_passage || "";
  const choices: Record<string, string> = {};
  if (question.choice_a) choices["A"] = question.choice_a;
  if (question.choice_b) choices["B"] = question.choice_b;
  if (question.choice_c) choices["C"] = question.choice_c;
  if (question.choice_d) choices["D"] = question.choice_d;

  const typeResult = classifyRWQuestionType(questionText, question.question_type);
  const reasoningResult = classifyReasoningCategory(typeResult.type, questionText);
  const passageResult = classifyPassageStructure(passage);
  const distractorResult = classifyDistractorPattern(choices, question.correct_choice || "", "RW");
  const transitionResult = classifyTransitionStructure(passage, questionText);
  const boundaryResult = classifyBoundaryLogic(questionText, passage);
  const evidenceResult = classifyEvidenceReasoning(typeResult.type, questionText);

  const data: RWExtractedData = {
    question_type: typeResult.type,
    reasoning_category: reasoningResult.category,
    passage_structure: passageResult.structure,
    distractor_pattern: distractorResult.pattern,
    transition_structure: transitionResult.structure,
    boundary_logic: boundaryResult.logic,
    evidence_reasoning: evidenceResult.reasoning,
  };

  const confidence = computeExtractionConfidence([
    typeResult.confidence,
    reasoningResult.confidence,
    passageResult.confidence,
    distractorResult.confidence,
    transitionResult.confidence,
    boundaryResult.confidence,
    evidenceResult.confidence,
  ]);

  return { data, confidence };
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
    difficulty_band: "",
    distractor_pattern: extracted.distractor_pattern,
    timing_complexity: timingComplexity,
    syntax_complexity: syntaxComplexity,
    abstraction_level: abstractionLevel,
  };
}
