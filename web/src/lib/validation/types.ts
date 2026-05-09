export type ValidationSeverity = "warning" | "reject";

export type ValidationCode =
  | "ANSWER_MISSING"
  | "MISSING_PASSAGE"
  | "MISSING_QUESTION"
  | "MISSING_CHOICES"
  | "MALFORMED_CHOICES"
  | "ANSWER_MISMATCH"
  | "MALFORMED_TAG"
  | "MISSING_TAG"
  | "OTHER";

export interface ValidationError {
  questionId: string;
  field: string;
  reason: string;
  severity: ValidationSeverity;
  code?: ValidationCode;
}

export interface ValidationResult {
  status: "success" | "reject";
  errors: ValidationError[];
}

export interface TagCheckResult {
  malformedTags: string[];
  missingRequiredTags: string[];
}
