import { supabase } from "../supabase/client";
import type {
  TutorJob,
  TutorJobStatus,
  TutorJobStage,
  ExportMetadata,
  ReviewEntry,
  ReviewDecision,
  ValidationSnapshot,
} from "./types";
import type { WorksheetConfig } from "../assembly/types";
import type { OutputProfile } from "../assembly/types";

// -- Tutor jobs --

export async function saveTutorJob(
  job: Omit<TutorJob, "id" | "createdAt" | "updatedAt" | "lastProcessedAt" | "exportedAt">
): Promise<{ id: string | null; error: string | null }> {
  const row = {
    type: job.type,
    status: job.status,
    stage: job.stage,
    config: job.config as unknown as Record<string, unknown>,
    retry_count: job.retryCount,
    max_retries: job.maxRetries,
    error_message: job.errorMessage,
    decision_reason: job.decisionReason,
    generation_job_id: job.generationJobId,
    worksheet_job_id: job.worksheetJobId,
    export_job_id: job.exportJobId,
    validation_snapshot: job.validationSnapshot as unknown as Record<string, unknown> | null,
  };

  const { data, error } = await supabase
    .from("tutor_jobs")
    .insert(row)
    .select("id")
    .single();

  if (error) return { id: null, error: error.message };
  return { id: data.id, error: null };
}

export async function updateTutorJob(
  id: string,
  updates: Partial<Pick<TutorJob, "status" | "stage" | "retryCount" | "errorMessage" | "decisionReason" | "generationJobId" | "worksheetJobId" | "exportJobId" | "validationSnapshot" | "lastProcessedAt" | "exportedAt">>
): Promise<{ success: boolean; error: string | null }> {
  const row: Record<string, unknown> = {
    ...Object.fromEntries(
      Object.entries({
        status: updates.status,
        stage: updates.stage,
        retry_count: updates.retryCount,
        error_message: updates.errorMessage,
        decision_reason: updates.decisionReason,
        generation_job_id: updates.generationJobId,
        worksheet_job_id: updates.worksheetJobId,
        export_job_id: updates.exportJobId,
        validation_snapshot: updates.validationSnapshot as unknown as Record<string, unknown> | null,
        last_processed_at: updates.lastProcessedAt,
        exported_at: updates.exportedAt,
        updated_at: new Date().toISOString(),
      }).filter(([, v]) => v !== undefined)
    ),
  };

  const { error } = await supabase
    .from("tutor_jobs")
    .update(row)
    .eq("id", id);

  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

export async function fetchTutorJob(id: string): Promise<TutorJob | null> {
  const { data, error } = await supabase
    .from("tutor_jobs")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return rowToTutorJob(data);
}

export async function fetchTutorJobs(filters?: {
  status?: TutorJobStatus;
  type?: string;
  limit?: number;
}): Promise<TutorJob[]> {
  let query = supabase
    .from("tutor_jobs")
    .select("*")
    .order("created_at", { ascending: false });

  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.type) query = query.eq("type", filters.type);
  if (filters?.limit) query = query.limit(filters.limit);

  const { data, error } = await query;
  if (error || !data) return [];
  return data.map(rowToTutorJob);
}

export async function fetchReviewQueue(): Promise<TutorJob[]> {
  const { data, error } = await supabase
    .from("tutor_jobs")
    .select("*")
    .eq("status", "review_required")
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  return data.map(rowToTutorJob);
}

// -- Export metadata --

export async function saveExportMetadata(meta: Omit<ExportMetadata, "id" | "createdAt">): Promise<{ id: string | null; error: string | null }> {
  const row = {
    job_id: meta.jobId,
    profile: meta.profile,
    pdf_size_bytes: meta.pdfSizeBytes,
    question_count: meta.questionCount,
    section: meta.section,
    categories: meta.categories,
    status: meta.status,
    error_message: meta.errorMessage,
  };

  const { data, error } = await supabase
    .from("tutor_exports")
    .insert(row)
    .select("id")
    .single();

  if (error) return { id: null, error: error.message };
  return { id: data.id, error: null };
}

export async function updateExportMetadata(
  id: string,
  updates: Partial<Pick<ExportMetadata, "pdfSizeBytes" | "status" | "errorMessage">>
): Promise<{ success: boolean; error: string | null }> {
  const row: Record<string, unknown> = {
    ...Object.fromEntries(
      Object.entries({
        pdf_size_bytes: updates.pdfSizeBytes,
        status: updates.status,
        error_message: updates.errorMessage,
      }).filter(([, v]) => v !== undefined)
    ),
  };

  const { error } = await supabase
    .from("tutor_exports")
    .update(row)
    .eq("id", id);

  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

export async function fetchExportHistory(limit: number = 20): Promise<ExportMetadata[]> {
  const { data, error } = await supabase
    .from("tutor_exports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data.map(rowToExportMetadata);
}

export async function fetchExportsForJob(jobId: string): Promise<ExportMetadata[]> {
  const { data, error } = await supabase
    .from("tutor_exports")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data.map(rowToExportMetadata);
}

// -- Review entries --

export async function saveReviewEntry(entry: Omit<ReviewEntry, "id" | "createdAt">): Promise<{ id: string | null; error: string | null }> {
  const row = {
    job_id: entry.jobId,
    reviewer_id: entry.reviewerId,
    decision: entry.decision,
    notes: entry.notes,
    previous_status: entry.previousStatus,
    new_status: entry.newStatus,
  };

  const { data, error } = await supabase
    .from("tutor_reviews")
    .insert(row)
    .select("id")
    .single();

  if (error) return { id: null, error: error.message };
  return { id: data.id, error: null };
}

export async function fetchReviewsForJob(jobId: string): Promise<ReviewEntry[]> {
  const { data, error } = await supabase
    .from("tutor_reviews")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  return data.map(rowToReviewEntry);
}

// -- Row mappers (snake_case DB → camelCase TS) --

function rowToTutorJob(row: Record<string, unknown>): TutorJob {
  return {
    id: row.id as string,
    type: row.type as TutorJob["type"],
    status: row.status as TutorJobStatus,
    stage: row.stage as TutorJobStage,
    config: row.config as WorksheetConfig,
    retryCount: (row.retry_count as number) ?? 0,
    maxRetries: (row.max_retries as number) ?? 3,
    errorMessage: (row.error_message as string) ?? null,
    decisionReason: (row.decision_reason as string) ?? null,
    generationJobId: (row.generation_job_id as string) ?? null,
    worksheetJobId: (row.worksheet_job_id as string) ?? null,
    exportJobId: (row.export_job_id as string) ?? null,
    validationSnapshot: row.validation_snapshot as ValidationSnapshot | null,
    createdAt: row.created_at as string,
    updatedAt: (row.updated_at as string) ?? row.created_at as string,
    lastProcessedAt: (row.last_processed_at as string) ?? null,
    exportedAt: (row.exported_at as string) ?? null,
  };
}

function rowToExportMetadata(row: Record<string, unknown>): ExportMetadata {
  return {
    id: row.id as string,
    jobId: row.job_id as string,
    profile: row.profile as OutputProfile,
    pdfSizeBytes: (row.pdf_size_bytes as number) ?? null,
    pdfBuffer: null, // not stored in DB
    questionCount: (row.question_count as number) ?? 0,
    section: (row.section as string) ?? "",
    categories: (row.categories as string[]) ?? [],
    status: (row.status as "pending" | "success" | "failed") ?? "pending",
    errorMessage: (row.error_message as string) ?? null,
    createdAt: row.created_at as string,
  };
}

function rowToReviewEntry(row: Record<string, unknown>): ReviewEntry {
  return {
    id: row.id as string,
    jobId: row.job_id as string,
    reviewerId: (row.reviewer_id as string) ?? null,
    decision: row.decision as ReviewDecision,
    notes: (row.notes as string) ?? "",
    previousStatus: row.previous_status as TutorJobStatus,
    newStatus: row.new_status as TutorJobStatus,
    createdAt: row.created_at as string,
  };
}
