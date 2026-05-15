import type {
  OutputProfile,
  WorksheetAssemblyResult,
} from "../assembly/types";

// -- Page layout --

export type PageSize = "A4";

export interface PageMargins {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface FontConfig {
  titleSize: number;
  bodySize: number;
  choiceSize: number;
  explanationSize: number;
  lineSpacing: number;
}

export interface PageLayout {
  size: PageSize;
  margins: PageMargins;
  fonts: FontConfig;
}

// -- Section layout types --

export type SectionType = "student_worksheet" | "answer_key" | "explanation_pack";

export interface SectionBreakRule {
  startOnNewPage: boolean;
  avoidSplitQuestion: boolean;
  avoidSplitPassage: boolean;
}

// -- Render content (validated, layout-ready) --

export interface RenderableStudentWorksheet {
  title: string;
  section: string;
  instructions: string;
  timeConstraintMinutes: number | null;
  questions: RenderableQuestion[];
}

export interface RenderableQuestion {
  number: number;
  passage: string | null;
  question: string;
  choices: { A: string; B: string; C: string; D: string };
  section: string;
  category: string;
}

export interface RenderableAnswerKey {
  title: string;
  answers: RenderableAnswerEntry[];
}

export interface RenderableAnswerEntry {
  number: number;
  correctChoice: string;
  category: string;
  difficultyLevel: string;
}

export interface RenderableExplanationPack {
  title: string;
  explanations: RenderableExplanationEntry[];
}

export interface RenderableExplanationEntry {
  number: number;
  correctChoice: string;
  category: string;
  tutorExplanation: string;
  studentExplanation: string;
  wrongChoiceAnalysis: { choice: string; text: string; strategy: string | null }[];
}

// -- Render document (assembled for PDF output) --

export interface RenderDocument {
  profile: OutputProfile;
  worksheetTitle: string;
  studentName: string | null;
  date: string;
  studentWorksheet: RenderableStudentWorksheet | null;
  answerKey: RenderableAnswerKey | null;
  explanationPack: RenderableExplanationPack | null;
}

// -- Layout validation --

export type LayoutValidationSeverity = "error" | "warning";

export interface LayoutValidationIssue {
  severity: LayoutValidationSeverity;
  check: string;
  message: string;
  questionNumber: number | null;
}

export interface LayoutValidationResult {
  passed: boolean;
  issues: LayoutValidationIssue[];
  blockedReasons: string[];
}

// -- Export job --

export type ExportJobStatus =
  | "pending"
  | "validating"
  | "rendering"
  | "success"
  | "failed";

export interface ExportJob {
  id: string;
  assemblyResult: WorksheetAssemblyResult;
  profile: OutputProfile;
  status: ExportJobStatus;
  renderDocument: RenderDocument | null;
  pdfBuffer: Buffer | null;
  validation: LayoutValidationResult | null;
  retryCount: number;
  maxRetries: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

// -- Export result --

export interface ExportResult {
  jobId: string;
  status: ExportJobStatus;
  pdfBuffer: Buffer | null;
  validation: LayoutValidationResult | null;
  errorMessage: string | null;
}

// -- Output profile definition --

export interface OutputProfileDefinition {
  profile: OutputProfile;
  includeStudentWorksheet: boolean;
  includeAnswerKey: boolean;
  includeExplanationPack: boolean;
  includeTutorNotes: boolean;
  includeStudentNotes: boolean;
}
