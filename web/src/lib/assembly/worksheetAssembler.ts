import type {
  WorksheetConfig,
  WorksheetAssemblyResult,
  AnswerKey,
  ExplanationPack,
} from "./types";
import { selectQuestions } from "./questionSelector";
import { validateWorksheet } from "./worksheetValidator";
import {
  buildStudentWorksheet,
  buildAnswerKey,
  buildExplanationPack,
  buildMetadata,
  shouldIncludeAnswerKey,
  shouldIncludeExplanations,
} from "./outputBuilder";
import { ASSEMBLY_CONFIG } from "./config";

export async function assembleWorksheet(
  config: WorksheetConfig
): Promise<WorksheetAssemblyResult> {
  // 1. Select approved questions
  const { questions, error: selectError } = await selectQuestions(config);

  if (selectError && questions.length === 0) {
    return buildFailedResult(config, selectError);
  }

  // 2. Validate worksheet-level constraints
  const validation = validateWorksheet(questions);

  // 3. Build output structures
  const studentWorksheet = buildStudentWorksheet(questions, config);
  const answerKey = shouldIncludeAnswerKey(config.outputProfile)
    ? buildAnswerKey(questions, config)
    : emptyAnswerKey(config);
  const explanationPack = shouldIncludeExplanations(config.outputProfile)
    ? buildExplanationPack(questions, config)
    : emptyExplanationPack(config);

  // 4. Build metadata
  const metadata = buildMetadata(questions, config);

  // 5. Pre-output validation gate
  if (!validation.allPassed) {
    // Validation failed — still return assembled result but mark as not ready
    return {
      worksheetId: generateWorksheetId(),
      config,
      questions,
      studentWorksheet,
      answerKey,
      explanationPack,
      validation,
      metadata,
    };
  }

  return {
    worksheetId: generateWorksheetId(),
    config,
    questions,
    studentWorksheet,
    answerKey,
    explanationPack,
    validation,
    metadata,
  };
}

export function isReadyForExport(result: WorksheetAssemblyResult): boolean {
  return result.validation.allPassed && result.questions.length >= result.config.questionCount;
}

function buildFailedResult(
  config: WorksheetConfig,
  error: string
): WorksheetAssemblyResult {
  return {
    worksheetId: generateWorksheetId(),
    config,
    questions: [],
    studentWorksheet: {
      title: config.title,
      section: config.section,
      instructions: "",
      timeConstraintMinutes: null,
      questions: [],
    },
    answerKey: { title: `${config.title} — Answer Key`, answers: [] },
    explanationPack: { title: `${config.title} — Explanation Pack`, explanations: [] },
    validation: {
      difficultyProgression: "fail",
      answerDistribution: "fail",
      categoryDiversity: "fail",
      patternDiversity: "fail",
      duplicateCheck: "fail",
      allPassed: false,
      failedChecks: ["selection_failed"],
      issues: [error],
    },
    metadata: {
      totalQuestions: 0,
      section: config.section,
      categories: [],
      difficultyDistribution: { easy: 0, medium: 0, hard: 0 },
      answerDistribution: {},
      assembledAt: new Date().toISOString(),
      version: ASSEMBLY_CONFIG.output.version,
    },
  };
}

function emptyAnswerKey(config: WorksheetConfig): AnswerKey {
  return { title: `${config.title} — Answer Key`, answers: [] };
}

function emptyExplanationPack(config: WorksheetConfig): ExplanationPack {
  return { title: `${config.title} — Explanation Pack`, explanations: [] };
}

function generateWorksheetId(): string {
  return `ws:${Date.now()}:${Math.random().toString(36).substring(2, 8)}`;
}
