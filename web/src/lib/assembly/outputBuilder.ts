import type {
  WorksheetQuestion,
  WorksheetConfig,
  StudentWorksheet,
  StudentQuestion,
  AnswerKey,
  AnswerEntry,
  ExplanationPack,
  ExplanationEntry,
  OutputProfile,
  WorksheetMetadata,
} from "./types";
import { ASSEMBLY_CONFIG } from "./config";

export function buildStudentWorksheet(
  questions: WorksheetQuestion[],
  config: WorksheetConfig
): StudentWorksheet {
  return {
    title: config.title,
    section: config.section,
    instructions: getInstructions(config),
    timeConstraintMinutes: config.timeConstraintMinutes ?? null,
    questions: questions.map((q) => toStudentQuestion(q)),
  };
}

export function buildAnswerKey(
  questions: WorksheetQuestion[],
  config: WorksheetConfig
): AnswerKey {
  return {
    title: `${config.title} — Answer Key`,
    answers: questions.map((q) => toAnswerEntry(q)),
  };
}

export function buildExplanationPack(
  questions: WorksheetQuestion[],
  config: WorksheetConfig
): ExplanationPack {
  return {
    title: `${config.title} — Explanation Pack`,
    explanations: questions.map((q) => toExplanationEntry(q)),
  };
}

export function buildMetadata(
  questions: WorksheetQuestion[],
  config: WorksheetConfig
): WorksheetMetadata {
  const difficultyDistribution = { easy: 0, medium: 0, hard: 0 };
  const answerDistribution: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
  const categories: string[] = [];

  for (const q of questions) {
    difficultyDistribution[q.difficultyLevel]++;
    answerDistribution[q.correctChoice] = (answerDistribution[q.correctChoice] || 0) + 1;
    if (!categories.includes(q.category)) categories.push(q.category);
  }

  return {
    totalQuestions: questions.length,
    section: config.section,
    categories,
    difficultyDistribution,
    answerDistribution,
    assembledAt: new Date().toISOString(),
    version: ASSEMBLY_CONFIG.output.version,
  };
}

export function shouldIncludeAnswerKey(profile: OutputProfile): boolean {
  return profile !== "student_clean" && profile !== "test_mode";
}

export function shouldIncludeExplanations(profile: OutputProfile): boolean {
  return profile === "full_review_pack" || profile === "tutor_compact";
}

// -- Private helpers --

function toStudentQuestion(q: WorksheetQuestion): StudentQuestion {
  return {
    number: q.index,
    passage: q.question.generated_passage,
    question: q.question.generated_question,
    choices: {
      A: q.question.choice_a || "",
      B: q.question.choice_b || "",
      C: q.question.choice_c || "",
      D: q.question.choice_d || "",
    },
  };
}

function toAnswerEntry(q: WorksheetQuestion): AnswerEntry {
  return {
    number: q.index,
    correctChoice: q.correctChoice,
    category: q.category,
    difficultyLevel: q.difficultyLevel,
  };
}

function toExplanationEntry(q: WorksheetQuestion): ExplanationEntry {
  const gq = q.question;
  const wrongChoices = Object.entries({
    A: gq.choice_a,
    B: gq.choice_b,
    C: gq.choice_c,
    D: gq.choice_d,
  }).filter(([key]) => key !== q.correctChoice);

  const distractorAnalysis = (gq.distractor_analysis || {}) as Record<string, unknown>;
  const perDistractor = (distractorAnalysis.perDistractor || []) as { label: string; strategy: string | null; text?: string }[];

  const wrongChoiceAnalysis = wrongChoices.map(([choice, text]) => {
    const distractorInfo = perDistractor.find((d) => d.label === choice);
    return {
      choice,
      text: text || "",
      strategy: distractorInfo?.strategy || null,
    };
  });

  return {
    number: q.index,
    correctChoice: q.correctChoice,
    category: q.category,
    tutorExplanation: gq.tutor_explanation || "",
    studentExplanation: gq.student_explanation || "",
    distractorAnalysis,
    reasoningTrace: gq.reasoning_trace || [],
    wrongChoiceAnalysis,
  };
}

function getInstructions(config: WorksheetConfig): string {
  const sectionLabel = config.section === "RW" ? "Reading & Writing" : "Math";

  const base = `Complete all ${config.questionCount} ${sectionLabel} questions. Choose the best answer for each question.`;

  if (config.timeConstraintMinutes) {
    return `${base} Time allowed: ${config.timeConstraintMinutes} minutes.`;
  }
  return base;
}
