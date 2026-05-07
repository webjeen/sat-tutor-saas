export type ValidationSeverity = "warning" | "reject";

export interface ValidationError {
  questionId: string;
  field: string;
  reason: string;
  severity: ValidationSeverity;
}

export interface ValidationResult {
  status: "success" | "reject";
  errors: ValidationError[];
}

export interface TagCheckResult {
  malformedTags: string[];
  missingRequiredTags: string[];
}
