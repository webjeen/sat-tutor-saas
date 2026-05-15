import type {
  TutorJob,
  TutorJobStatus,
  TutorJobStage,
  TutorJobType,
  CreateTutorJobRequest,
} from "./types";
import { TUTOR_CONFIG } from "./config";
import { validateTransition, canRetry } from "./stateMachine";
import { saveTutorJob, updateTutorJob, fetchTutorJob, fetchTutorJobs } from "./persistence";
import {
  auditJobCreated,
  auditStatusChanged,
  auditStageChanged,
  auditRetryAttempted,
  auditRetryExhausted,
  auditTransitionBlocked,
} from "./auditLog";

// -- In-memory job store for active session --
// Supplements Supabase persistence for fast operational access.

const activeJobs = new Map<string, TutorJob>();

export function getActiveJob(id: string): TutorJob | undefined {
  return activeJobs.get(id);
}

export function getAllActiveJobs(): TutorJob[] {
  return Array.from(activeJobs.values());
}

// -- Create a new tutor job --

export async function createTutorJob(request: CreateTutorJobRequest): Promise<{ job: TutorJob | null; error: string | null }> {
  const now = new Date().toISOString();
  const job: TutorJob = {
    id: `tutor:${Date.now()}:${Math.random().toString(36).substring(2, 8)}`,
    type: request.type ?? "generation",
    status: "pending",
    stage: "intake",
    config: request.config,
    retryCount: 0,
    maxRetries: TUTOR_CONFIG.retry.maxRetries,
    errorMessage: null,
    decisionReason: null,
    generationJobId: null,
    worksheetJobId: null,
    exportJobId: null,
    validationSnapshot: null,
    createdAt: now,
    updatedAt: now,
    lastProcessedAt: now,
    exportedAt: null,
  };

  const { id: dbId, error: dbError } = await saveTutorJob({
    type: job.type,
    status: job.status,
    stage: job.stage,
    config: job.config,
    retryCount: job.retryCount,
    maxRetries: job.maxRetries,
    errorMessage: job.errorMessage,
    decisionReason: job.decisionReason,
    generationJobId: job.generationJobId,
    worksheetJobId: job.worksheetJobId,
    exportJobId: job.exportJobId,
    validationSnapshot: job.validationSnapshot,
  });

  if (dbError || !dbId) {
    return { job: null, error: `Failed to persist job: ${dbError}` };
  }

  job.id = dbId;
  activeJobs.set(job.id, job);
  auditJobCreated(job.id, job.type, job.config as unknown as Record<string, unknown>);

  return { job, error: null };
}

// -- Transition job status --

export async function transitionJobStatus(
  jobId: string,
  newStatus: TutorJobStatus,
  reason: string
): Promise<{ success: boolean; error: string | null }> {
  const job = activeJobs.get(jobId) ?? await fetchTutorJob(jobId);
  if (!job) return { success: false, error: "Job not found" };

  const transition = validateTransition(job.status, newStatus);
  if (!transition.allowed) {
    auditTransitionBlocked(jobId, job.status, newStatus, transition.reason);
    return { success: false, error: transition.reason };
  }

  const previousStatus = job.status;
  job.status = newStatus;
  job.decisionReason = reason;
  job.updatedAt = new Date().toISOString();

  if (newStatus === "exported") {
    job.exportedAt = new Date().toISOString();
  }

  activeJobs.set(job.id, job);

  await updateTutorJob(job.id, {
    status: newStatus,
    decisionReason: reason,
    exportedAt: job.exportedAt,
  });

  auditStatusChanged(jobId, previousStatus, newStatus, reason);
  return { success: true, error: null };
}

// -- Transition job stage --

export async function transitionJobStage(
  jobId: string,
  newStage: TutorJobStage
): Promise<{ success: boolean; error: string | null }> {
  const job = activeJobs.get(jobId);
  if (!job) return { success: false, error: "Job not found in active session" };

  const previousStage = job.stage;
  job.stage = newStage;
  job.lastProcessedAt = new Date().toISOString();
  job.updatedAt = new Date().toISOString();

  activeJobs.set(job.id, job);

  await updateTutorJob(job.id, {
    stage: newStage,
    lastProcessedAt: job.lastProcessedAt,
  });

  auditStageChanged(jobId, previousStage, newStage);
  return { success: true, error: null };
}

// -- Update job fields --

export async function updateJob(
  jobId: string,
  updates: Partial<Pick<TutorJob, "generationJobId" | "worksheetJobId" | "exportJobId" | "validationSnapshot" | "errorMessage">>
): Promise<{ success: boolean; error: string | null }> {
  const job = activeJobs.get(jobId);
  if (!job) return { success: false, error: "Job not found in active session" };

  if (updates.generationJobId !== undefined) job.generationJobId = updates.generationJobId;
  if (updates.worksheetJobId !== undefined) job.worksheetJobId = updates.worksheetJobId;
  if (updates.exportJobId !== undefined) job.exportJobId = updates.exportJobId;
  if (updates.validationSnapshot !== undefined) job.validationSnapshot = updates.validationSnapshot;
  if (updates.errorMessage !== undefined) job.errorMessage = updates.errorMessage;

  job.updatedAt = new Date().toISOString();
  activeJobs.set(job.id, job);

  await updateTutorJob(job.id, updates);
  return { success: true, error: null };
}

// -- Retry a failed job --

export async function retryJob(
  jobId: string
): Promise<{ job: TutorJob | null; error: string | null }> {
  const job = activeJobs.get(jobId) ?? await fetchTutorJob(jobId);
  if (!job) return { job: null, error: "Job not found" };

  if (!canRetry(job.status)) {
    return { job: null, error: `Job status '${job.status}' is not retryable` };
  }

  if (job.retryCount >= job.maxRetries) {
    auditRetryExhausted(jobId, job.retryCount);
    return { job: null, error: `Max retries (${job.maxRetries}) already exhausted` };
  }

  job.retryCount++;
  auditRetryAttempted(jobId, job.retryCount, job.maxRetries);

  const transitionResult = await transitionJobStatus(jobId, "processing", `Retry attempt ${job.retryCount}`);
  if (!transitionResult.success) {
    return { job: null, error: transitionResult.error };
  }

  // Reset pipeline stage
  await transitionJobStage(jobId, "intake");
  job.errorMessage = null;
  job.validationSnapshot = null;

  await updateTutorJob(job.id, {
    retryCount: job.retryCount,
    errorMessage: null,
    validationSnapshot: null,
  });

  activeJobs.set(job.id, job);
  return { job, error: null };
}

// -- Get job (from memory or DB) --

export async function getJob(jobId: string): Promise<TutorJob | null> {
  const cached = activeJobs.get(jobId);
  if (cached) return cached;

  const dbJob = await fetchTutorJob(jobId);
  if (dbJob) {
    activeJobs.set(dbJob.id, dbJob);
  }
  return dbJob;
}

// -- List jobs --

export async function listJobs(filters?: {
  status?: TutorJobStatus;
  type?: TutorJobType;
  limit?: number;
}): Promise<TutorJob[]> {
  return fetchTutorJobs(filters);
}

// -- Remove from active session --

export function removeActiveJob(jobId: string): void {
  activeJobs.delete(jobId);
}
