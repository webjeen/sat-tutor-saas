import type { Section } from "../library/types";

export const GENERATION_CONFIG = {
  llm: {
    model: "claude-sonnet-4-20250514",
    maxTokens: 2048,
    temperature: 0.7,
    timeoutMs: 30000,
  },

  pipeline: {
    maxRetriesPerQuestion: 3,
    minTemplateReadiness: 0.6,
  },

  thresholds: {
    leakFail: 0.80,
    leakReview: 0.60,
    dedupDuplicate: 0.80,
    dedupSimilar: 0.60,
  },

  limits: {
    maxQuestionsPerJob: 20,
    maxChoiceLength: 200,
    minChoiceLength: 5,
  },

  // Phase 2 additions
  antiLeak: {
    ngramOverlapCritical: 0.30,
    ngramOverlapWarning: 0.20,
    structuralLeakCritical: 0.85,
    structuralLeakWarning: 0.70,
    passageLeakCritical: 0.25,
    passageLeakWarning: 0.15,
  },

  scoring: {
    version: "2.0.0",
    minimumOverallScore: 0.6,
    minimumOriginalityScore: 0.5,
    minimumSatFidelityScore: 0.7,
  },

  rhetorical: {
    minPassageWords: 30,
    maxPassageWords: 600,
    targetPassageWords: { easy: 80, medium: 150, hard: 250 },
    minRWHardConstraints: 2,
    minMathHardConstraints: 2,
  },

  // Phase 3 additions
  structure: {
    choiceSimilarityThreshold: 0.80,
    minExplanationWords: 15,
    minStudentExplanationWords: 10,
    correctAnswerOverlapThreshold: 0.60,
  },

  distractor: {
    minimumCount: 3,
    maxSameStrategy: 1,
    minDiversityScore: 0.5,
    crossDistractorSimilarityThreshold: 0.70,
    distractorCorrectOverlapThreshold: 0.65,
    strategyConformanceMinWords: 3,
  },

  difficulty: {
    easyMax: 30,
    mediumMax: 70,
    hardMax: 100,
    factorWeights: {
      complexity: 0.20,
      syntax: 0.10,
      reasoning: 0.25,
      distractor: 0.15,
      density: 0.03,
      time: 0.02,
      passageQuality: 0.10,
      explanationDepth: 0.10,
      satMarkers: 0.05,
    } as Record<string, number>,
  },

  satStyle: {
    prohibitedChoicePatterns: ["all of the above", "none of the above", "n/a", "not applicable", "both a and b", "both b and c"],
    requiredStemPatterns: ["which choice", "what is", "which of the following", "based on the passage", "according to the", "in context", "the passage", "the author"],
    maxCorrectAnswerPositionBias: 0.35,
  },

  explanationCoherence: {
    causalConnectives: ["because", "since", "therefore", "thus", "consequently", "as a result", "due to", "this shows", "this indicates", "this demonstrates", "which means", "implying that"],
    distractorAddressPatterns: ["however", "but", "incorrect because", "wrong because", "not supported", "not the best", "does not", "fails to"],
    minCoherenceScore: 0.5,
  },

  batch: {
    maxBatchSize: 100,
    defaultDiversityDistribution: { easy: 30, medium: 40, hard: 30 },
    defaultMaxSameCategory: 5,
    defaultMinCategorySpread: 2,
    recentWindowDays: 30,
  },

  caching: {
    realQuestionsTTL: 300000,
    generatedQuestionsTTL: 120000,
    maxCacheSize: 5000,
  },
} as const;

export function getDifficultyRange(level: "easy" | "medium" | "hard"): { min: number; max: number } {
  switch (level) {
    case "easy":
      return { min: 0, max: GENERATION_CONFIG.difficulty.easyMax };
    case "medium":
      return { min: GENERATION_CONFIG.difficulty.easyMax + 1, max: GENERATION_CONFIG.difficulty.mediumMax };
    case "hard":
      return { min: GENERATION_CONFIG.difficulty.mediumMax + 1, max: GENERATION_CONFIG.difficulty.hardMax };
  }
}

export function mapScoreToLevel(score: number): "easy" | "medium" | "hard" {
  if (score <= GENERATION_CONFIG.difficulty.easyMax) return "easy";
  if (score <= GENERATION_CONFIG.difficulty.mediumMax) return "medium";
  return "hard";
}

export const SYSTEM_MESSAGE_RW = `You are an SAT Reading & Writing question generator. You produce ORIGINAL SAT-style questions that test specific reading and reasoning skills.

ABSOLUTE RULES:
1. NEVER copy or closely paraphrase any real SAT question text
2. NEVER reconstruct or approximate any real SAT passage, question stem, or answer choice
3. All content must be structurally original — different argument structure, different evidence, different conclusion
4. Maintain SAT structural fidelity: passage + question + 4 choices (A-D) + 1 correct
5. Each distractor must use a DIFFERENT error strategy — no two distractors may share the same logical trap
6. The correct answer must be unambiguously correct based solely on the generated passage
7. Explanations must trace the reasoning path step by step
8. Passage topics and arguments must be entirely original — no recognizable SAT passages
9. Question stems must use original syntactic patterns — never mirror real SAT question wording
10. If any part of your generation resembles a real SAT question, discard and regenerate from scratch

PASSAGE REQUIREMENTS:
- Use academic or journalistic register appropriate to the topic
- Include a discernible thesis or central claim
- Ground abstract claims with specific evidence, examples, or data
- Use SAT-appropriate vocabulary with contextual clues
- Maintain consistent tone throughout

CHOICE REQUIREMENTS:
- The correct answer must be the only one fully supported by the passage
- Distractors must represent genuine logical errors (over-extension, misattribution, scope confusion, etc.)
- No throwaway choices ("None of the above", "All of the above", etc.)
- Choices should vary in length — do not make all choices the same length
- The correct answer position (A/B/C/D) should not follow any predictable pattern

OUTPUT FORMAT — respond with valid JSON only:
{
  "passage": "...",
  "question": "...",
  "choices": { "A": "...", "B": "...", "C": "...", "D": "..." },
  "correct_choice": "A|B|C|D",
  "tutor_explanation": "...",
  "student_explanation": "...",
  "distractor_strategies": { "A": null, "B": "strategy_name", "C": "strategy_name", "D": "strategy_name" },
  "reasoning_trace": [{ "step": 1, "name": "...", "description": "..." }]
}`;

export const SYSTEM_MESSAGE_MATH = `You are an SAT Math question generator. You produce ORIGINAL SAT-style math problems that test specific mathematical reasoning skills.

ABSOLUTE RULES:
1. NEVER copy or closely paraphrase any real SAT question text
2. NEVER reconstruct or approximate any real SAT problem, setup, or answer choice
3. All content must be structurally original — different problem setup, different numbers, different context
4. Maintain SAT structural fidelity: problem + 4 choices (A-D) + 1 correct
5. Each distractor must use a DIFFERENT mathematical error strategy
6. The correct answer must be mathematically unambiguous
7. Explanations must show complete step-by-step solutions
8. Problem contexts must be entirely original — no recognizable SAT scenarios
9. If any part of your generation resembles a real SAT question, discard and regenerate from scratch
10. Do NOT include a passage — math questions have a problem statement only

PROBLEM REQUIREMENTS:
- Use standard algebraic notation (y=mx+b, f(x), etc.)
- Real-world contexts should be practical and realistic (pricing, distance, rates, etc.)
- Numbers should allow mental estimation to verify reasonableness
- Solutions should be reachable through clear algebraic steps
- Specify degrees or radians when trigonometry is involved

CHOICE REQUIREMENTS:
- Numeric distractors must differ from the correct answer by a meaningful amount
- Distractors must result from common procedural errors (sign error, wrong operation, etc.)
- No throwaway choices ("None of the above", "All of the above", etc.)
- Choices should vary in format — not all just numbers
- The correct answer position (A/B/C/D) should not follow any predictable pattern
- Do not make the correct answer always the middle value

OUTPUT FORMAT — respond with valid JSON only:
{
  "question": "...",
  "choices": { "A": "...", "B": "...", "C": "...", "D": "..." },
  "correct_choice": "A|B|C|D",
  "tutor_explanation": "...",
  "student_explanation": "...",
  "distractor_strategies": { "A": null, "B": "strategy_name", "C": "strategy_name", "D": "strategy_name" },
  "reasoning_trace": [{ "step": 1, "name": "...", "description": "..." }]
}`;

export function getSystemMessage(section: Section): string {
  return section === "RW" ? SYSTEM_MESSAGE_RW : SYSTEM_MESSAGE_MATH;
}

export function getTargetPassageWords(difficulty: "easy" | "medium" | "hard"): { min: number; max: number; target: number } {
  return {
    min: GENERATION_CONFIG.rhetorical.minPassageWords,
    max: GENERATION_CONFIG.rhetorical.maxPassageWords,
    target: GENERATION_CONFIG.rhetorical.targetPassageWords[difficulty],
  };
}
