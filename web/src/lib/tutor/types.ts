import type { WorksheetConfig, WorksheetValidationResult, OutputProfile } from "../assembly/types";
import type { GenerationValidationResult, GenerationDecision, EscalationLevel } from "../generation/types";
import type { LayoutValidationResult } from "../pdf-layout/types";

// -- Tutor job types --

export type TutorJobType = "generation" | "worksheet_export" | "review";

export type TutorJobStatus =
  | "pending"
  | "processing"
  | "draft"
  | "review_required"
  | "approved_for_export"
  | "exporting"
  | "exported"
  | "failed"
  | "rejected";

export type TutorJobStage =
  | "intake"
  | "generating"
  | "validating"
  | "assembling"
  | "assembly_validation"
  | "layout_validation"
  | "rendering"
  | "complete"
  | "failed";

// -- State transition --

export interface StateTransition {
  from: TutorJobStatus;
  to: TutorJobStatus;
  reason: string;
  timestamp: string;
}

// -- Tutor job --

export interface TutorJob {
  id: string;
  type: TutorJobType;
  status: TutorJobStatus;
  stage: TutorJobStage;
  config: WorksheetConfig;
  retryCount: number;
  maxRetries: number;
  errorMessage: string | null;
  decisionReason: string | null;
  generationJobId: string | null;
  worksheetJobId: string | null;
  exportJobId: string | null;
  validationSnapshot: ValidationSnapshot | null;
  createdAt: string;
  updatedAt: string;
  lastProcessedAt: string | null;
  exportedAt: string | null;
}

// -- Validation snapshot (captures state at each validation layer) --

export interface ValidationSnapshot {
  generationValidation: GenerationValidationResult | null;
  worksheetValidation: WorksheetValidationResult | null;
  layoutValidation: LayoutValidationResult | null;
  preExportCleared: boolean;
  snapshotAt: string;
}

// -- Export metadata --

export interface ExportMetadata {
  id: string;
  jobId: string;
  profile: OutputProfile;
  pdfSizeBytes: number | null;
  pdfBuffer: Buffer | null;
  questionCount: number;
  section: string;
  categories: string[];
  status: "pending" | "success" | "failed";
  errorMessage: string | null;
  createdAt: string;
}

// -- Review --

export type ReviewDecision = "approve" | "reject" | "retry";

export interface ReviewEntry {
  id: string;
  jobId: string;
  reviewerId: string | null;
  decision: ReviewDecision;
  notes: string;
  previousStatus: TutorJobStatus;
  newStatus: TutorJobStatus;
  createdAt: string;
}

// -- Audit --

export type TutorAuditEventType =
  | "job_created"
  | "job_updated"
  | "stage_changed"
  | "status_changed"
  | "retry_attempted"
  | "retry_exhausted"
  | "review_submitted"
  | "export_started"
  | "export_completed"
  | "export_failed"
  | "validation_failed"
  | "validation_passed"
  | "state_transition_blocked"
  | "stale_job_cleaned"
  | "concurrency_limit_reached";

export interface TutorAuditEvent {
  id: string;
  jobId: string;
  eventType: TutorAuditEventType;
  detail: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

// -- Create job request --

export interface CreateTutorJobRequest {
  config: WorksheetConfig;
  type?: TutorJobType;
}

// -- Job result --

export interface TutorJobResult {
  jobId: string;
  status: TutorJobStatus;
  stage: TutorJobStage;
  worksheetId: string | null;
  exportMetadata: ExportMetadata | null;
  validationSnapshot: ValidationSnapshot | null;
  errorMessage: string | null;
}

// -- Review queue item --

export interface ReviewQueueItem {
  jobId: string;
  type: TutorJobType;
  title: string;
  status: TutorJobStatus;
  stage: TutorJobStage;
  failedChecks: string[];
  retryCount: number;
  createdAt: string;
  reviewEntries: ReviewEntry[];
}

// -- State machine result --

export interface TransitionResult {
  allowed: boolean;
  reason: string;
  newStatus: TutorJobStatus;
}

// -- Pipeline step result --

export interface PipelineStepResult {
  success: boolean;
  stage: TutorJobStage;
  error: string | null;
  nextStage: TutorJobStage | null;
  decision?: GenerationDecision;
  escalationLevel?: EscalationLevel;
}
