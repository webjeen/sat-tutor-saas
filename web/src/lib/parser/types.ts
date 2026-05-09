export type ExamFamily = "DSAT";
export type Section = "RW" | "Math";
export type ModuleNumber = 1 | 2;
export type ResponseType = "mcq" | "spr";

export type ParseStatus =
  | "uploaded"
  | "parsed"
  | "validation_passed"
  | "review_required"
  | "rejected";

export interface BaseQuestion {
  exam: ExamFamily;
  section: Section;
  module: ModuleNumber;
  questionId: string;
  questionType: string;
  question: string;
  choices: Record<string, string>;
  answer: string;
  unclear: string;
}

export interface RWQuestion extends BaseQuestion {
  section: "RW";
  passage: string;
}

export interface MathQuestion extends BaseQuestion {
  section: "Math";
  graph: string;
  formula: string;
  answerExplanation: string;
  responseType: ResponseType;
}

export type ParsedQuestion = RWQuestion | MathQuestion;

export interface ParseResult {
  status: ParseStatus;
  questions: ParsedQuestion[];
  errors: ParseError[];
  decisionReason?: string;
}

export interface ParseError {
  questionId: string;
  field: string;
  message: string;
  severity: "reject" | "review";
}
