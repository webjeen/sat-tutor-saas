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
import { normalize } from "../dedup/fingerprint";

// -- Math domain classification --

const MATH_DOMAIN_KEYWORDS: Record<MathDomain, string[]> = {
  linear_equations: [
    "slope", "intercept", "linear", "y-intercept", "x-intercept",
    "rate of change", "constant rate", "direct variation",
  ],
  systems_of_equations: [
    "system", "simultaneous", "two equations", "both equations",
    "solution to the system",
  ],
  quadratic: [
    "quadratic", "parabola", "vertex", "axis of symmetry",
    "roots", "discriminant", "completing the square",
  ],
  exponential: [
    "exponential", "growth", "decay", "doubling", "half-life",
    "compound", "percent increase", "percent decrease",
  ],
  polynomial: [
    "polynomial", "factor", "remainder", "zero of",
    "root of", "coefficient",
  ],
  rational_expressions: [
    "rational", "denominator", "fraction", "ratio",
    "proportional", "inverse variation",
  ],
  geometry: [
    "area", "perimeter", "volume", "circle", "triangle",
    "rectangle", "square", "radius", "diameter", "circumference",
    "right triangle", "pythagorean", "angle", "parallel",
    "congruent", "similar triangles",
  ],
  trigonometry: [
    "sin", "cos", "tan", "sine", "cosine", "tangent",
    "angle of elevation", "angle of depression", "radian",
    "unit circle",
  ],
  statistics_probability: [
    "mean", "median", "mode", "standard deviation", "variance",
    "probability", "random", "sample", "population", "outlier",
    "interquartile", "range", "frequency", "distribution",
    "expected value", "independent events",
  ],
  advanced_math: [
    "function", "composite", "inverse function", "domain",
    "range", "asymptote", "transformation", "translation",
    "reflection", "dilation", "logarithm", "log",
  ],
};

export function classifyMathDomain(
  questionType: string | null,
  questionText: string,
  choices: Record<string, string>
): MathDomain {
  // Primary: parsed Question_Type tag
  if (questionType) {
    const lower = questionType.toLowerCase();
    if (lower.includes("linear")) return "linear_equations";
    if (lower.includes("system")) return "systems_of_equations";
    if (lower.includes("quadratic") || lower.includes("parabola")) return "quadratic";
    if (lower.includes("exponential") || lower.includes("growth")) return "exponential";
    if (lower.includes("polynomial") || lower.includes("factor")) return "polynomial";
    if (lower.includes("rational")) return "rational_expressions";
    if (lower.includes("geometry") || lower.includes("area") || lower.includes("triangle")) return "geometry";
    if (lower.includes("trig") || lower.includes("trigonometry")) return "trigonometry";
    if (lower.includes("statistic") || lower.includes("probability")) return "statistics_probability";
    if (lower.includes("advanced") || lower.includes("function")) return "advanced_math";
  }

  // Fallback: keyword scan across question + choices
  const allText = normalize(questionText + " " + Object.values(choices).join(" "));
  let bestDomain: MathDomain = "linear_equations";
  let bestScore = 0;

  for (const [domain, keywords] of Object.entries(MATH_DOMAIN_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      if (allText.includes(normalize(kw))) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestDomain = domain as MathDomain;
    }
  }

  return bestDomain;
}

// -- Equation structure --

export function classifyEquationStructure(
  questionText: string,
  choices: Record<string, string>
): EquationStructure {
  const allText = questionText + " " + Object.values(choices).join(" ");
  const lower = allText.toLowerCase();

  // Detect inequality
  if (/[≥≤]|greater than|less than|at least|at most|inequality/.test(lower)) {
    return "inequality";
  }

  // Detect function notation
  if (/f\s*\(|g\s*\(|h\s*\(/.test(allText)) {
    return "function";
  }

  // Detect system
  if (/system|simultaneous|both equations/i.test(allText)) {
    return "system";
  }

  // Count variables
  const varCount = countVariables(allText);
  if (varCount >= 2) return "multi_variable";
  if (varCount === 1) return "single_variable";

  return "none";
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
): ProblemSolvingType {
  const lower = normalize(questionText);
  const hasWordProblemSignals = WORD_PROBLEM_INDICATORS.some((ind) =>
    lower.includes(ind)
  );

  if (hasWordProblemSignals) return "setup_and_solve";

  if (mathDomain === "geometry" || mathDomain === "trigonometry") {
    if (lower.includes("interpret") || lower.includes("represent")) return "interpretation";
    return "direct_calculation";
  }

  if (mathDomain === "statistics_probability") {
    if (lower.includes("estimate") || lower.includes("approximate")) return "estimation";
    return "interpretation";
  }

  if (lower.includes("interpret") || lower.includes("represent") || lower.includes("model")) {
    return "modeling";
  }

  if (lower.includes("estimate") || lower.includes("approximate")) return "estimation";

  return "direct_calculation";
}

// -- Math distractor pattern --

export function classifyMathDistractorPattern(
  choices: Record<string, string>,
  correctChoice: string
): DistractorPattern {
  const correct = choices[correctChoice];
  if (!correct) return "conceptual_confusion";

  const correctNorm = normalize(correct);
  const correctNums = new Set(correctNorm.match(/-?\d+\.?\d*/g) || []);
  const correctWords = new Set(correctNorm.split(" "));

  const incorrectKeys = Object.keys(choices).filter((k) => k !== correctChoice);

  // Check for sign error distractors (common in math)
  const signFlips = incorrectKeys.filter((k) => {
    const nums = normalize(choices[k]).match(/-?\d+\.?\d*/g) || [];
    return nums.some((n) => {
      const flipped = n.startsWith("-") ? n.slice(1) : `-${n}`;
      return correctNums.has(flipped);
    });
  });

  if (signFlips.length >= 1) return "opposite";

  // Check for computational error distractors (partial truth)
  const partialMatches = incorrectKeys.filter((k) => {
    const words = new Set(normalize(choices[k]).split(" "));
    let overlap = 0;
    for (const w of words) {
      if (correctWords.has(w)) overlap++;
    }
    return overlap / Math.max(words.size, 1) >= 0.4;
  });

  if (partialMatches.length >= 2) return "partial_truth";

  // Check for extreme language
  const hasExtreme = incorrectKeys.some((k) =>
    hasExtremeLanguage(choices[k])
  );
  if (hasExtreme) return "extreme_language";

  // Check for out-of-scope answers (unrelated numbers)
  const outOfScope = incorrectKeys.filter((k) => {
    const nums = normalize(choices[k]).match(/-?\d+\.?\d*/g) || [];
    return nums.length === 0 || !nums.some((n) => correctNums.has(n));
  });

  if (outOfScope.length >= 2) return "out_of_scope";

  return "misleading_association";
}

// -- Multi-step reasoning --

export function classifyMultiStepReasoning(
  questionText: string,
  mathDomain: MathDomain
): MultiStepReasoning {
  const lower = normalize(questionText);

  // Multi-step indicators
  const multiStepIndicators = [
    "then", "after", "first", "second", "next",
    "another", "also", "both", "combined", "total",
  ];

  const chainedIndicators = [
    "given that", "if", "suppose", "assume", "assuming",
    "such that", "where",
  ];

  let stepScore = 0;
  for (const ind of multiStepIndicators) {
    if (lower.includes(ind)) stepScore++;
  }

  let chainScore = 0;
  for (const ind of chainedIndicators) {
    if (lower.includes(ind)) chainScore++;
  }

  // Domain-based defaults
  const multiStepDomains = new Set([
    "systems_of_equations",
    "geometry",
    "statistics_probability",
    "advanced_math",
  ]);

  if (chainScore >= 1) return "chained_reasoning";
  if (stepScore >= 2 || multiStepDomains.has(mathDomain)) return "multi_step";
  if (stepScore >= 1) return "two_step";

  return "single_step";
}

// -- Symbolic complexity --

export function classifySymbolicComplexity(
  questionText: string,
  choices: Record<string, string>
): SymbolicComplexity {
  const allText = questionText + " " + Object.values(choices).join(" ");

  // Detect function notation
  if (/f\s*\(|g\s*\(|h\s*\(/.test(allText)) return "abstract_notation";

  // Count variables
  const varCount = countVariables(allText);
  if (varCount >= 2) return "multi_variable";
  if (varCount === 1) return "single_variable";

  // Check if purely numeric
  if (!containsMathNotation(allText)) return "numeric_only";

  return "numeric_only";
}

// -- Main extraction entry point --

export function extractMathPattern(
  question: ApprovedQuestionRow
): MathExtractedData {
  const questionText = question.raw_question || "";
  const choices: Record<string, string> = {};
  if (question.choice_a) choices["A"] = question.choice_a;
  if (question.choice_b) choices["B"] = question.choice_b;
  if (question.choice_c) choices["C"] = question.choice_c;
  if (question.choice_d) choices["D"] = question.choice_d;

  const mathDomain = classifyMathDomain(question.question_type, questionText, choices);
  const equationStructure = classifyEquationStructure(questionText, choices);
  const problemSolvingType = classifyProblemSolvingType(questionText, mathDomain);
  const distractorPattern = classifyMathDistractorPattern(choices, question.correct_choice || "");
  const multiStepReasoning = classifyMultiStepReasoning(questionText, mathDomain);
  const symbolicComplexity = classifySymbolicComplexity(questionText, choices);

  // Map domain to pattern type
  const domainToType: Partial<Record<MathDomain, MathPatternType>> = {
    linear_equations: "Algebra",
    systems_of_equations: "Algebra",
    quadratic: "Algebra",
    exponential: "Algebra",
    polynomial: "Algebra",
    rational_expressions: "Algebra",
    geometry: "Graph",
    trigonometry: "Trigonometry",
    statistics_probability: "Statistics",
    advanced_math: "Algebra",
  };

  const questionType: MathPatternType =
    problemSolvingType === "setup_and_solve" &&
    mathDomain !== "statistics_probability" &&
    mathDomain !== "trigonometry"
      ? "WordProblem"
      : domainToType[mathDomain] ?? "Algebra";

  return {
    question_type: questionType,
    math_domain: mathDomain,
    equation_structure: equationStructure,
    problem_solving_type: problemSolvingType,
    distractor_pattern: distractorPattern,
    multi_step_reasoning: multiStepReasoning,
    symbolic_complexity: symbolicComplexity,
  };
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
