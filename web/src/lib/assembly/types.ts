import type { Section } from "../library/types";
import type { GeneratedQuestion } from "../generation/types";

// -- Output profiles (from output-selection-spec) --

export type OutputProfile =
  | "student_clean"
  | "homework_with_key"
  | "full_review_pack"
  | "tutor_compact"
  | "test_mode";

export type DifficultyMode = "easy" | "medium" | "hard" | "mixed" | "progressive";

export type Purpose = "homework" | "in_class_practice" | "test" | "review" | "diagnostic";

// -- Worksheet assembly config (tutor input) --

export interface WorksheetConfig {
  title: string;
  section: Section;
  categories: string[];
  questionCount: number;
  difficultyMode: DifficultyMode;
  difficultyDistribution?: { easy: number; medium: number; hard: number };
  purpose: Purpose;
  outputProfile: OutputProfile;
  timeConstraintMinutes?: number;
  studentName?: string;
}

// -- Selected question within a worksheet --

export interface WorksheetQuestion {
  index: number;
  question: GeneratedQuestion;
  section: Section;
  category: string;
  difficultyLevel: "easy" | "medium" | "hard";
  correctChoice: string;
}

// -- Worksheet-level validation result --

export type WorksheetCheckResult = "pass" | "fail" | "review";

export interface WorksheetValidationResult {
  difficultyProgression: WorksheetCheckResult;
  answerDistribution: WorksheetCheckResult;
  categoryDiversity: WorksheetCheckResult;
  patternDiversity: WorksheetCheckResult;
  duplicateCheck: WorksheetCheckResult;
  allPassed: boolean;
  failedChecks: string[];
  issues: string[];
}

// -- Output structures --

export interface StudentWorksheet {
  title: string;
  section: Section;
  instructions: string;
  timeConstraintMinutes: number | null;
  questions: StudentQuestion[];
}

export interface StudentQuestion {
  number: number;
  passage: string | null;
  question: string;
  choices: { A: string; B: string; C: string; D: string };
}

export interface AnswerKey {
  title: string;
  answers: AnswerEntry[];
}

export interface AnswerEntry {
  number: number;
  correctChoice: string;
  category: string;
  difficultyLevel: string;
}

export interface ExplanationPack {
  title: string;
  explanations: ExplanationEntry[];
}

export interface ExplanationEntry {
  number: number;
  correctChoice: string;
  category: string;
  tutorExplanation: string;
  studentExplanation: string;
  distractorAnalysis: Record<string, unknown>;
  reasoningTrace: { step: number; name: string; description: string }[];
  wrongChoiceAnalysis: { choice: string; text: string; strategy: string | null }[];
}

// -- Assembly result --

export interface WorksheetAssemblyResult {
  worksheetId: string;
  config: WorksheetConfig;
  questions: WorksheetQuestion[];
  studentWorksheet: StudentWorksheet;
  answerKey: AnswerKey;
  explanationPack: ExplanationPack;
  validation: WorksheetValidationResult;
  metadata: WorksheetMetadata;
}

export interface WorksheetMetadata {
  totalQuestions: number;
  section: Section;
  categories: string[];
  difficultyDistribution: { easy: number; medium: number; hard: number };
  answerDistribution: Record<string, number>;
  assembledAt: string;
  version: number;
}

// -- Worksheet job (DB row) --

export interface WorksheetJob {
  id: string;
  title: string;
  section: string;
  categories: string[];
  question_count: number;
  difficulty_mode: string;
  purpose: string;
  output_profile: string;
  status: string;
  processing_stage: string | null;
  validation_result: Record<string, unknown> | null;
  error_message: string | null;
  retry_count: number;
  last_processed_at: string | null;
  created_at: string;
  updated_at: string;
}
