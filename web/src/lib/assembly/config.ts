export const ASSEMBLY_CONFIG = {
  limits: {
    maxQuestionsPerWorksheet: 40,
    minQuestionsPerWorksheet: 5,
    defaultQuestionCount: 10,
  },

  difficulty: {
    defaultDistribution: { easy: 30, medium: 40, hard: 30 },
    progressiveDistribution: { easy: 40, medium: 35, hard: 25 },
    // For progressive mode, easy questions come first
  },

  diversity: {
    maxSameCategory: 5,
    maxSamePattern: 3,
    minCategorySpread: 2,
  },

  answerDistribution: {
    maxPositionBias: 0.35,
    minPositionCount: 1,
  },

  duplicate: {
    maxQuestionSimilarity: 0.60,
    maxPassageSimilarity: 0.50,
  },

  selection: {
    batchSize: 50,
    maxSelectionRetries: 3,
  },

  output: {
    version: 1,
  },
} as const;

export function getDifficultyDistribution(
  mode: import("./types").DifficultyMode,
  custom?: { easy: number; medium: number; hard: number }
): { easy: number; medium: number; hard: number } {
  if (custom) return custom;

  switch (mode) {
    case "easy":
      return { easy: 70, medium: 25, hard: 5 };
    case "medium":
      return { easy: 20, medium: 60, hard: 20 };
    case "hard":
      return { easy: 5, medium: 25, hard: 70 };
    case "progressive":
      return ASSEMBLY_CONFIG.difficulty.progressiveDistribution;
    case "mixed":
    default:
      return ASSEMBLY_CONFIG.difficulty.defaultDistribution;
  }
}
