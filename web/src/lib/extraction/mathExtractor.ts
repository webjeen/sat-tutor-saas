import type {
  MathPatternType,
  MathDomain,
  EquationStructure,
  ProblemSolvingType,
  DistractorPattern,
  MultiStepReasoning,
  SymbolicComplexity,
  MathExtractedData,
  PatternOutput,
  FieldConfidence,
  ExtractionConfidence,
} from "./types";
import type { ApprovedQuestionRow } from "./types";
import {
  countWords,
  hasExtremeLanguage,
  containsMathNotation,
  countVariables,
  classifySyntaxComplexity,
  classifyTimingComplexity,
} from "./textAnalysis";
import {
  buildFieldConfidence,
  computeExtractionConfidence,
  keywordConfidence,
  fallbackConfidence,
} from "./confidence";
import { normalize } from "../dedup/fingerprint";

// -- Math domain classification --
// Weighted keywords with specificity levels

interface DomainKeyword {
  phrase: string;
  weight: number;
}

const MATH_DOMAIN_KEYWORDS: Record<MathDomain, DomainKeyword[]> = {
  linear_equations: [
    { phrase: "slope", weight: 3 },
    { phrase: "intercept", weight: 3 },
    { phrase: "linear", weight: 2 },
    { phrase: "y-intercept", weight: 3 },
    { phrase: "x-intercept", weight: 3 },
    { phrase: "rate of change", weight: 2 },
    { phrase: "constant rate", weight: 2 },
    { phrase: "direct variation", weight: 2 },
  ],
  systems_of_equations: [
    { phrase: "system of equations", weight: 3 },
    { phrase: "system", weight: 1 },
    { phrase: "simultaneous", weight: 3 },
    { phrase: "two equations", weight: 2 },
    { phrase: "both equations", weight: 2 },
    { phrase: "solution to the system", weight: 3 },
  ],
  quadratic: [
    { phrase: "quadratic", weight: 3 },
    { phrase: "parabola", weight: 3 },
    { phrase: "vertex", weight: 2 },
    { phrase: "axis of symmetry", weight: 3 },
    { phrase: "roots", weight: 1 },
    { phrase: "discriminant", weight: 3 },
    { phrase: "completing the square", weight: 3 },
  ],
  exponential: [
    { phrase: "exponential", weight: 3 },
    { phrase: "growth", weight: 1 },
    { phrase: "decay", weight: 2 },
    { phrase: "doubling", weight: 2 },
    { phrase: "half-life", weight: 3 },
    { phrase: "compound interest", weight: 3 },
    { phrase: "percent increase", weight: 1 },
    { phrase: "percent decrease", weight: 1 },
  ],
  polynomial: [
    { phrase: "polynomial", weight: 3 },
    { phrase: "factor", weight: 1 },
    { phrase: "remainder theorem", weight: 3 },
    { phrase: "zero of", weight: 2 },
    { phrase: "root of the equation", weight: 2 },
    { phrase: "coefficient", weight: 1 },
  ],
  rational_expressions: [
    { phrase: "rational expression", weight: 3 },
    { phrase: "denominator", weight: 2 },
    { phrase: "fraction", weight: 1 },
    { phrase: "ratio", weight: 1 },
    { phrase: "proportional", weight: 2 },
    { phrase: "inverse variation", weight: 3 },
  ],
  geometry: [
    { phrase: "area of", weight: 2 },
    { phrase: "perimeter", weight: 3 },
    { phrase: "volume", weight: 3 },
    { phrase: "circle", weight: 2 },
    { phrase: "triangle", weight: 2 },
    { phrase: "rectangle", weight: 2 },
    { phrase: "radius", weight: 3 },
    { phrase: "diameter", weight: 3 },
    { phrase: "circumference", weight: 3 },
    { phrase: "right triangle", weight: 3 },
    { phrase: "pythagorean", weight: 3 },
    { phrase: "angle", weight: 1 },
    { phrase: "parallel", weight: 1 },
    { phrase: "congruent", weight: 2 },
    { phrase: "similar triangles", weight: 3 },
  ],
  trigonometry: [
    { phrase: "sine", weight: 3 },
    { phrase: "cosine", weight: 3 },
    { phrase: "tangent", weight: 3 },
    { phrase: "angle of elevation", weight: 3 },
    { phrase: "angle of depression", weight: 3 },
    { phrase: "radian", weight: 3 },
    { phrase: "unit circle", weight: 3 },
    { phrase: "sin", weight: 2 },
    { phrase: "cos", weight: 2 },
    { phrase: "tan", weight: 2 },
  ],
  statistics_probability: [
    { phrase: "mean", weight: 2 },
    { phrase: "median", weight: 2 },
    { phrase: "mode", weight: 2 },
    { phrase: "standard deviation", weight: 3 },
    { phrase: "variance", weight: 3 },
    { phrase: "probability", weight: 3 },
    { phrase: "random sample", weight: 2 },
    { phrase: "population", weight: 1 },
    { phrase: "outlier", weight: 2 },
    { phrase: "interquartile", weight: 3 },
    { phrase: "range", weight: 1 },
    { phrase: "frequency", weight: 1 },
    { phrase: "distribution", weight: 1 },
    { phrase: "expected value", weight: 3 },
    { phrase: "independent events", weight: 3 },
    { phrase: "scatterplot", weight: 2 },
  ],
  advanced_math: [
    { phrase: "function", weight: 1 },
    { phrase: "composite function", weight: 3 },
    { phrase: "inverse function", weight: 3 },
    { phrase: "domain and range", weight: 2 },
    { phrase: "asymptote", weight: 3 },
    { phrase: "transformation", weight: 2 },
    { phrase: "translation", weight: 2 },
    { phrase: "reflection", weight: 2 },
    { phrase: "dilation", weight: 2 },
    { phrase: "logarithm", weight: 3 },
    { phrase: "log", weight: 1 },
    { phrase: "nonlinear", weight: 2 },
  ],
};

export function classifyMathDomain(
  questionType: string | null,
  questionText: string,
  choices: Record<string, string>
): { domain: MathDomain; confidence: FieldConfidence } {
  const signals: string[] = [];

  // Primary: parsed Question_Type tag
  if (questionType) {
    const tagLower = questionType.toLowerCase();
    const tagMap: [RegExp, MathDomain][] = [
      [/linear/, "linear_equations"],
      [/system/, "systems_of_equations"],
      [/quadratic|parabola/, "quadratic"],
      [/exponential|growth|decay/, "exponential"],
      [/polynomial|factor/, "polynomial"],
      [/rational/, "rational_expressions"],
      [/geometry|area|triangle|circle|volume/, "geometry"],
      [/trig/, "trigonometry"],
      [/statistic|probability/, "statistics_probability"],
      [/advanced|nonlinear/, "advanced_math"],
    ];

    for (const [regex, domain] of tagMap) {
      if (regex.test(tagLower)) {
        signals.push(`tag:${questionType}`);
        return {
          domain,
          confidence: buildFieldConfidence("math_domain", domain, 0.93, "tag", signals),
        };
      }
    }

    signals.push(`tag_unmatched:${questionType}`);
  }

  // Fallback: weighted keyword scan
  const allText = normalize(questionText + " " + Object.values(choices).join(" "));

  const scores: Record<string, { total: number; matchCount: number; signals: string[] }> = {};

  for (const [domain, keywords] of Object.entries(MATH_DOMAIN_KEYWORDS)) {
    let total = 0;
    let matchCount = 0;
    const matchSignals: string[] = [];

    for (const kw of keywords) {
      if (allText.includes(normalize(kw.phrase))) {
        total += kw.weight;
        matchCount++;
        matchSignals.push(kw.phrase);
      }
    }

    scores[domain] = { total, matchCount, signals: matchSignals };
  }

  const sorted = Object.entries(scores)
    .sort((a, b) => {
      if (b[1].total !== a[1].total) return b[1].total - a[1].total;
      // Tie-break: prefer domain with more high-weight keyword matches
      const aHighWeight = (MATH_DOMAIN_KEYWORDS[a[0] as MathDomain] || [])
        .filter((kw) => kw.weight >= 3 && allText.includes(normalize(kw.phrase))).length;
      const bHighWeight = (MATH_DOMAIN_KEYWORDS[b[0] as MathDomain] || [])
        .filter((kw) => kw.weight >= 3 && allText.includes(normalize(kw.phrase))).length;
      return bHighWeight - aHighWeight;
    });

  const best = sorted[0];
  const secondBest = sorted[1];
  const isTied = best[1].total > 0 && secondBest && secondBest[1].total === best[1].total;

  if (!best || best[1].total === 0) {
    signals.push("no_keyword_match");
    return {
      domain: "linear_equations",
      confidence: buildFieldConfidence("math_domain", "linear_equations", fallbackConfidence(), "fallback", signals),
    };
  }

  signals.push(...best[1].signals);
  let conf = keywordConfidence(
    best[1].matchCount,
    MATH_DOMAIN_KEYWORDS[best[0] as MathDomain].length,
    secondBest ? secondBest[1].total : 0
  );

  // Tie penalty: equal scores mean higher misclassification risk
  if (isTied) {
    conf = Math.min(conf, 0.45);
    signals.push("tied_with:" + (secondBest ? secondBest[0] : "unknown"));
  }

  return {
    domain: best[0] as MathDomain,
    confidence: buildFieldConfidence("math_domain", best[0], conf, "keyword", signals),
  };
}

// -- Equation structure --

export function classifyEquationStructure(
  questionText: string,
  choices: Record<string, string>
): { structure: EquationStructure; confidence: FieldConfidence } {
  const allText = questionText + " " + Object.values(choices).join(" ");
  const lower = allText.toLowerCase();
  const signals: string[] = [];

  if (/[≥≤]|greater than|less than|at least|at most|inequality/.test(lower)) {
    signals.push("inequality_detected");
    return {
      structure: "inequality",
      confidence: buildFieldConfidence("equation_structure", "inequality", 0.9, "keyword", signals),
    };
  }

  if (/f\s*\(|g\s*\(|h\s*\(/.test(allText)) {
    signals.push("function_notation");
    return {
      structure: "function",
      confidence: buildFieldConfidence("equation_structure", "function", 0.9, "keyword", signals),
    };
  }

  if (/system|simultaneous|both equations/i.test(allText)) {
    signals.push("system_detected");
    return {
      structure: "system",
      confidence: buildFieldConfidence("equation_structure", "system", 0.9, "keyword", signals),
    };
  }

  const varCount = countVariables(allText);
  if (varCount >= 2) {
    signals.push(`vars:${varCount}`);
    return {
      structure: "multi_variable",
      confidence: buildFieldConfidence("equation_structure", "multi_variable", 0.7, "heuristic", signals),
    };
  }
  if (varCount === 1) {
    signals.push("single_var");
    return {
      structure: "single_variable",
      confidence: buildFieldConfidence("equation_structure", "single_variable", 0.7, "heuristic", signals),
    };
  }

  signals.push("no_equation_structure");
  return {
    structure: "none",
    confidence: buildFieldConfidence("equation_structure", "none", 0.6, "heuristic", signals),
  };
}

// -- Problem solving type --

const WORD_PROBLEM_INDICATORS = [
  "$", "dollar", "cent", "cost", "price", "profit",
  "miles", "hours", "minutes", "speed", "distance",
  "per", "each", "total", "amount",
];

export function classifyProblemSolvingType(
  questionText: string,
  mathDomain: MathDomain
): { type: ProblemSolvingType; confidence: FieldConfidence } {
  const lower = normalize(questionText);
  const signals: string[] = [];

  const wordProblemHits = WORD_PROBLEM_INDICATORS.filter((ind) => lower.includes(ind));
  if (wordProblemHits.length >= 2) {
    signals.push(...wordProblemHits);
    return {
      type: "setup_and_solve",
      confidence: buildFieldConfidence("problem_solving_type", "setup_and_solve", 0.85, "keyword", signals),
    };
  }

  if (mathDomain === "geometry" || mathDomain === "trigonometry") {
    if (lower.includes("interpret") || lower.includes("represent")) {
      signals.push("interpret");
      return {
        type: "interpretation",
        confidence: buildFieldConfidence("problem_solving_type", "interpretation", 0.75, "keyword", signals),
      };
    }
    signals.push("geometry/trig_default");
    return {
      type: "direct_calculation",
      confidence: buildFieldConfidence("problem_solving_type", "direct_calculation", 0.7, "heuristic", signals),
    };
  }

  if (mathDomain === "statistics_probability") {
    if (lower.includes("estimate") || lower.includes("approximate")) {
      signals.push("estimate");
      return {
        type: "estimation",
        confidence: buildFieldConfidence("problem_solving_type", "estimation", 0.75, "keyword", signals),
      };
    }
    signals.push("stats_default");
    return {
      type: "interpretation",
      confidence: buildFieldConfidence("problem_solving_type", "interpretation", 0.7, "heuristic", signals),
    };
  }

  if (lower.includes("interpret") || lower.includes("represent") || lower.includes("model")) {
    signals.push("modeling_keyword");
    return {
      type: "modeling",
      confidence: buildFieldConfidence("problem_solving_type", "modeling", 0.75, "keyword", signals),
    };
  }

  if (lower.includes("estimate") || lower.includes("approximate")) {
    signals.push("estimate");
    return {
      type: "estimation",
      confidence: buildFieldConfidence("problem_solving_type", "estimation", 0.75, "keyword", signals),
    };
  }

  signals.push("default:direct_calculation");
  return {
    type: "direct_calculation",
    confidence: buildFieldConfidence("problem_solving_type", "direct_calculation", 0.5, "heuristic", signals),
  };
}

// -- Math distractor pattern --
// Multi-signal weighted scoring (shared approach with RW, with math-specific signals)

export function classifyMathDistractorPattern(
  choices: Record<string, string>,
  correctChoice: string
): { pattern: DistractorPattern; confidence: FieldConfidence } {
  const correct = choices[correctChoice];
  if (!correct) {
    return {
      pattern: "conceptual_confusion",
      confidence: buildFieldConfidence("distractor_pattern", "conceptual_confusion", fallbackConfidence(), "fallback", ["no_correct_choice"]),
    };
  }

  const correctNorm = normalize(correct);
  const correctNums = new Set(correctNorm.match(/-?\d+\.?\d*/g) || []);
  const correctWords = new Set(correctNorm.split(" "));
  const incorrectKeys = Object.keys(choices).filter((k) => k !== correctChoice);

  const patternScores: Record<string, { score: number; signals: string[] }> = {
    opposite: { score: 0, signals: [] },
    partial_truth: { score: 0, signals: [] },
    out_of_scope: { score: 0, signals: [] },
    extreme_language: { score: 0, signals: [] },
    sound_alike: { score: 0, signals: [] },
    conceptual_confusion: { score: 0, signals: [] },
    misleading_association: { score: 0, signals: [] },
  };

  for (const key of incorrectKeys) {
    const incText = choices[key] || "";
    const incNorm = normalize(incText);
    const incNums = incNorm.match(/-?\d+\.?\d*/g) || [];
    const incWords = new Set(incNorm.split(" "));

    // Word overlap
    let overlap = 0;
    for (const w of incWords) {
      if (correctWords.has(w)) overlap++;
    }
    const overlapRatio = overlap / Math.max(incWords.size, 1);

    // Sign error (opposite): same number, flipped sign
    for (const n of incNums) {
      const flipped = n.startsWith("-") ? n.slice(1) : `-${n}`;
      if (correctNums.has(flipped)) {
        patternScores.opposite.score += 3;
        patternScores.opposite.signals.push(`sign_flip:${n}/${key}`);
      }
    }

    // Computation error (partial truth): distractor is a plausible miscalculation
    // e.g., correct = 12, distractor = 6 (half), 24 (double), 144 (squared)
    for (const n of incNums) {
      const num = parseFloat(n);
      if (isNaN(num)) continue;
      for (const cn of correctNums) {
        const correctNum = parseFloat(cn);
        if (isNaN(correctNum)) continue;
        if (num === correctNum / 2 || num === correctNum * 2) {
          patternScores.partial_truth.score += 2;
          patternScores.partial_truth.signals.push(`half_double:${correctNum}->${num}_${key}`);
        }
        if (num === correctNum * correctNum) {
          patternScores.partial_truth.score += 2;
          patternScores.partial_truth.signals.push(`squared:${correctNum}->${num}_${key}`);
        }
        if (Math.abs(num - correctNum) === 1) {
          patternScores.partial_truth.score += 1.5;
          patternScores.partial_truth.signals.push(`off_by_one:${correctNum}->${num}_${key}`);
        }
      }
    }

    // Partial truth: word overlap 0.3–0.6
    if (overlapRatio >= 0.3 && overlapRatio < 0.6) {
      patternScores.partial_truth.score += 1;
      patternScores.partial_truth.signals.push(`word_overlap:${Math.round(overlapRatio * 100)}%_${key}`);
    }

    // Out of scope: numbers not related to correct answer
    if (incNums.length > 0 && !incNums.some((n) => correctNums.has(n))) {
      patternScores.out_of_scope.score += 1.5;
      patternScores.out_of_scope.signals.push(`unrelated_nums_${key}`);
    }
    if (overlapRatio < 0.2 && incWords.size > 3) {
      patternScores.out_of_scope.score += 1;
      patternScores.out_of_scope.signals.push(`low_overlap_${key}`);
    }

    // Extreme language
    if (hasExtremeLanguage(incText)) {
      patternScores.extreme_language.score += 2;
      patternScores.extreme_language.signals.push(`extreme_${key}`);
    }

    // Conceptual confusion: high overlap, plausible but wrong
    if (overlapRatio >= 0.5) {
      patternScores.conceptual_confusion.score += 1;
      patternScores.conceptual_confusion.signals.push(`high_overlap_${key}`);
    }

    // Misleading association: moderate overlap
    if (overlapRatio >= 0.2 && overlapRatio < 0.4) {
      patternScores.misleading_association.score += 1;
      patternScores.misleading_association.signals.push(`moderate_overlap_${key}`);
    }
  }

  const sorted = Object.entries(patternScores)
    .sort((a, b) => b[1].score - a[1].score);

  const best = sorted[0];

  if (!best || best[1].score === 0) {
    return {
      pattern: "misleading_association",
      confidence: buildFieldConfidence("distractor_pattern", "misleading_association", fallbackConfidence(), "fallback", ["no_matching_signals"]),
    };
  }

  const secondBestScore = sorted[1] ? sorted[1][1].score : 0;
  const gap = best[1].score - secondBestScore;
  const conf = gap >= 3 ? 0.85 : gap >= 1.5 ? 0.7 : 0.5;

  return {
    pattern: best[0] as DistractorPattern,
    confidence: buildFieldConfidence("distractor_pattern", best[0], conf, "heuristic", best[1].signals),
  };
}

// -- Multi-step reasoning --
// Improved: domain-aware step estimation with operation counting

export function classifyMultiStepReasoning(
  questionText: string,
  mathDomain: MathDomain
): { reasoning: MultiStepReasoning; confidence: FieldConfidence } {
  const lower = normalize(questionText);
  const signals: string[] = [];

  // Chained reasoning: conditional/dependency language
  const chainedSignals = ["given that", "suppose", "assume", "assuming", "such that", "where"];
  let chainCount = 0;
  for (const s of chainedSignals) {
    if (lower.includes(s)) {
      chainCount++;
      signals.push(s);
    }
  }

  if (chainCount >= 1) {
    return {
      reasoning: "chained_reasoning",
      confidence: buildFieldConfidence("multi_step_reasoning", "chained_reasoning", 0.85, "keyword", signals),
    };
  }

  // Multi-step indicators
  const multiStepSignals = [
    "then", "after", "first", "second", "next",
    "another", "also", "both", "combined", "total",
    "how many more", "how much more", "what is the sum",
  ];
  let stepCount = 0;
  for (const s of multiStepSignals) {
    if (lower.includes(s)) {
      stepCount++;
      signals.push(s);
    }
  }

  // Domain-based defaults: some domains are inherently multi-step
  const inherentlyMultiStep = new Set<MathDomain>([
    "systems_of_equations",
    "geometry",
    "statistics_probability",
    "advanced_math",
  ]);

  if (stepCount >= 2) {
    return {
      reasoning: "multi_step",
      confidence: buildFieldConfidence("multi_step_reasoning", "multi_step", 0.8, "keyword", signals),
    };
  }

  if (stepCount >= 1 && inherentlyMultiStep.has(mathDomain)) {
    signals.push("domain_inherently_multi_step");
    return {
      reasoning: "multi_step",
      confidence: buildFieldConfidence("multi_step_reasoning", "multi_step", 0.75, "heuristic", signals),
    };
  }

  if (inherentlyMultiStep.has(mathDomain)) {
    signals.push("domain_default:multi_step");
    return {
      reasoning: "multi_step",
      confidence: buildFieldConfidence("multi_step_reasoning", "multi_step", 0.6, "heuristic", signals),
    };
  }

  if (stepCount >= 1) {
    return {
      reasoning: "two_step",
      confidence: buildFieldConfidence("multi_step_reasoning", "two_step", 0.7, "keyword", signals),
    };
  }

  signals.push("default:single_step");
  return {
    reasoning: "single_step",
    confidence: buildFieldConfidence("multi_step_reasoning", "single_step", 0.55, "heuristic", signals),
  };
}

// -- Symbolic complexity --

export function classifySymbolicComplexity(
  questionText: string,
  choices: Record<string, string>
): { complexity: SymbolicComplexity; confidence: FieldConfidence } {
  const allText = questionText + " " + Object.values(choices).join(" ");
  const signals: string[] = [];

  if (/f\s*\(|g\s*\(|h\s*\(/.test(allText)) {
    signals.push("function_notation_detected");
    return {
      complexity: "abstract_notation",
      confidence: buildFieldConfidence("symbolic_complexity", "abstract_notation", 0.9, "keyword", signals),
    };
  }

  const varCount = countVariables(allText);
  if (varCount >= 2) {
    signals.push(`vars:${varCount}`);
    return {
      complexity: "multi_variable",
      confidence: buildFieldConfidence("symbolic_complexity", "multi_variable", 0.7, "heuristic", signals),
    };
  }
  if (varCount === 1) {
    signals.push("single_variable");
    return {
      complexity: "single_variable",
      confidence: buildFieldConfidence("symbolic_complexity", "single_variable", 0.7, "heuristic", signals),
    };
  }

  if (!containsMathNotation(allText)) {
    signals.push("no_math_notation");
    return {
      complexity: "numeric_only",
      confidence: buildFieldConfidence("symbolic_complexity", "numeric_only", 0.6, "heuristic", signals),
    };
  }

  signals.push("default:numeric_only");
  return {
    complexity: "numeric_only",
    confidence: buildFieldConfidence("symbolic_complexity", "numeric_only", 0.5, "heuristic", signals),
  };
}

// -- Main extraction entry point --

export function extractMathPattern(
  question: ApprovedQuestionRow
): { data: MathExtractedData; confidence: ExtractionConfidence } {
  const questionText = question.raw_question || "";
  const choices: Record<string, string> = {};
  if (question.choice_a) choices["A"] = question.choice_a;
  if (question.choice_b) choices["B"] = question.choice_b;
  if (question.choice_c) choices["C"] = question.choice_c;
  if (question.choice_d) choices["D"] = question.choice_d;

  const domainResult = classifyMathDomain(question.question_type, questionText, choices);
  const equationResult = classifyEquationStructure(questionText, choices);
  const solvingResult = classifyProblemSolvingType(questionText, domainResult.domain);
  const distractorResult = classifyMathDistractorPattern(choices, question.correct_choice || "");
  const stepResult = classifyMultiStepReasoning(questionText, domainResult.domain);
  const symbolicResult = classifySymbolicComplexity(questionText, choices);

  // Map domain to pattern type — fixed: geometry maps to Algebra (calculation-focused), not Graph
  // Graph type is for coordinate-plane / graphical interpretation questions
  const domainToType: Partial<Record<MathDomain, MathPatternType>> = {
    linear_equations: "Algebra",
    systems_of_equations: "Algebra",
    quadratic: "Algebra",
    exponential: "Algebra",
    polynomial: "Algebra",
    rational_expressions: "Algebra",
    geometry: "Algebra",
    trigonometry: "Trigonometry",
    statistics_probability: "Statistics",
    advanced_math: "Algebra",
  };

  const questionType: MathPatternType =
    solvingResult.type === "setup_and_solve" &&
    domainResult.domain !== "statistics_probability" &&
    domainResult.domain !== "trigonometry"
      ? "WordProblem"
      : domainToType[domainResult.domain] ?? "Algebra";

  const data: MathExtractedData = {
    question_type: questionType,
    math_domain: domainResult.domain,
    equation_structure: equationResult.structure,
    problem_solving_type: solvingResult.type,
    distractor_pattern: distractorResult.pattern,
    multi_step_reasoning: stepResult.reasoning,
    symbolic_complexity: symbolicResult.complexity,
  };

  const confidence = computeExtractionConfidence([
    domainResult.confidence,
    equationResult.confidence,
    solvingResult.confidence,
    distractorResult.confidence,
    stepResult.confidence,
    symbolicResult.confidence,
  ]);

  return { data, confidence };
}

// -- Compute unified PatternOutput --

export function computeMathPatternOutput(
  extracted: MathExtractedData,
  questionText: string
): PatternOutput {
  const wordCount = countWords(questionText);
  const syntaxComplexity = classifySyntaxComplexity(questionText);

  const stepToDepth: Record<MultiStepReasoning, string> = {
    single_step: "single_step",
    two_step: "two_step",
    multi_step: "multi_step",
    chained_reasoning: "chained_reasoning",
  };

  const timingComplexity = classifyTimingComplexity(
    wordCount,
    stepToDepth[extracted.multi_step_reasoning]
  );

  const abstractionLevel =
    extracted.symbolic_complexity === "abstract_notation"
      ? "abstract"
      : extracted.symbolic_complexity === "multi_variable"
        ? "moderate"
        : "concrete";

  return {
    question_type: extracted.question_type,
    reasoning_pattern: extracted.math_domain,
    difficulty_band: "",
    distractor_pattern: extracted.distractor_pattern,
    timing_complexity: timingComplexity,
    syntax_complexity: syntaxComplexity,
    abstraction_level: abstractionLevel,
  };
}
