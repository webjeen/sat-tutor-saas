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

  difficulty: {
    easyMax: 30,
    mediumMax: 70,
    hardMax: 100,
    factorWeights: {
      complexity: 0.25,
      syntax: 0.15,
      reasoning: 0.30,
      distractor: 0.20,
      density: 0.05,
      time: 0.05,
    } as Record<string, number>,
  },

  distractor: {
    minimumCount: 3,
    maxSameStrategy: 1,
    minDiversityScore: 0.5,
  },

  limits: {
    maxQuestionsPerJob: 20,
    maxChoiceLength: 200,
    minChoiceLength: 5,
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
2. All content must be structurally original
3. Maintain SAT structural fidelity: passage + question + 4 choices (A-D) + 1 correct
4. Each distractor must use a DIFFERENT strategy
5. The correct answer must be unambiguously correct based on the passage
6. Explanations must trace the reasoning path step by step

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
2. All content must be structurally original
3. Maintain SAT structural fidelity: problem + 4 choices (A-D) + 1 correct
4. Each distractor must use a DIFFERENT strategy
5. The correct answer must be mathematically unambiguous
6. Explanations must show complete step-by-step solutions

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
