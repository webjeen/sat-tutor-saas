import type { TutorJob } from "./types";
import { TUTOR_CONFIG } from "./config";
import { isTerminalStatus } from "./stateMachine";
import { transitionJobStatus, getAllActiveJobs } from "./jobs";
import { auditStaleJobCleaned, auditConcurrencyLimitReached } from "./auditLog";

// -- Export concurrency control --

let activeExports = 0;

export function acquireExportSlot(jobId: string): { allowed: boolean; activeCount: number } {
  if (activeExports >= TUTOR_CONFIG.concurrency.maxConcurrentExports) {
    auditConcurrencyLimitReached(jobId, TUTOR_CONFIG.concurrency.maxConcurrentExports);
    return { allowed: false, activeCount: activeExports };
  }
  activeExports++;
  return { allowed: true, activeCount: activeExports };
}

export function releaseExportSlot(): void {
  activeExports = Math.max(0, activeExports - 1);
}

export function getActiveExportCount(): number {
  return activeExports;
}

// -- Job concurrency control --

export function checkJobConcurrency(): { allowed: boolean; activeCount: number } {
  const processing = getAllActiveJobs().filter(
    (j) => j.status === "processing" || j.status === "exporting"
  );
  return {
    allowed: processing.length < TUTOR_CONFIG.concurrency.maxConcurrentJobs,
    activeCount: processing.length,
  };
}

// -- Retry limit enforcement --

export function checkRetryLimit(job: TutorJob): { allowed: boolean; remaining: number } {
  const remaining = job.maxRetries - job.retryCount;
  return { allowed: remaining > 0, remaining };
}

// -- Stale job detection and cleanup --

export function findStaleJobs(): TutorJob[] {
  const now = Date.now();
  const maxAgeMs = TUTOR_CONFIG.staleJob.maxAgeMs;
  const timeoutMs = TUTOR_CONFIG.retry.staleJobTimeoutMs;

  return getAllActiveJobs().filter((job) => {
    if (isTerminalStatus(job.status) || job.status === "failed") return false;

    const lastProcessed = new Date(job.lastProcessedAt ?? job.updatedAt).getTime();
    const jobAge = now - new Date(job.createdAt).getTime();

    // Job is stale if it hasn't been processed within timeout OR exceeds max age
    const processingStale = (now - lastProcessed) > timeoutMs;
    const ageStale = jobAge > maxAgeMs;

    return processingStale || ageStale;
  });
}

export async function cleanupStaleJobs(): Promise<{ cleaned: number; errors: string[] }> {
  const staleJobs = findStaleJobs();
  const errors: string[] = [];
  let cleaned = 0;

  for (const job of staleJobs) {
    const age = Date.now() - new Date(job.createdAt).getTime();
    const ageMinutes = Math.round(age / 60000);

    const result = await transitionJobStatus(
      job.id,
      "failed",
      `Stale job auto-failed (age: ${ageMinutes}m, no activity for ${Math.round(TUTOR_CONFIG.retry.staleJobTimeoutMs / 60000)}m)`
    );

    if (result.success) {
      auditStaleJobCleaned(job.id, `${ageMinutes}m`);
      cleaned++;
    } else {
      errors.push(`Failed to clean stale job ${job.id}: ${result.error}`);
    }
  }

  return { cleaned, errors };
}

// -- Invalid state transition blocking --
// (Core logic is in stateMachine.ts; this adds operational guards)

export function validateJobAction(
  job: TutorJob,
  action: "retry" | "export" | "review" | "approve" | "reject"
): { allowed: boolean; reason: string } {
  switch (action) {
    case "retry":
      if (job.status !== "failed") {
        return { allowed: false, reason: `Retry only allowed on 'failed' jobs, current: '${job.status}'` };
      }
      if (job.retryCount >= job.maxRetries) {
        return { allowed: false, reason: `Max retries (${job.maxRetries}) exhausted` };
      }
      return { allowed: true, reason: "Retry allowed" };

    case "export":
      if (job.status !== "approved_for_export") {
        return { allowed: false, reason: `Export only allowed on 'approved_for_export' jobs, current: '${job.status}'` };
      }
      if (activeExports >= TUTOR_CONFIG.concurrency.maxConcurrentExports) {
        return { allowed: false, reason: `Export concurrency limit reached (${activeExports}/${TUTOR_CONFIG.concurrency.maxConcurrentExports})` };
      }
      return { allowed: true, reason: "Export allowed" };

    case "review":
      if (job.status !== "review_required") {
        return { allowed: false, reason: `Review only allowed on 'review_required' jobs, current: '${job.status}'` };
      }
      return { allowed: true, reason: "Review allowed" };

    case "approve":
      if (job.status !== "review_required" && job.status !== "draft") {
        return { allowed: false, reason: `Approve only allowed on 'review_required' or 'draft' jobs, current: '${job.status}'` };
      }
      return { allowed: true, reason: "Approve allowed" };

    case "reject":
      if (job.status !== "review_required") {
        return { allowed: false, reason: `Reject only allowed on 'review_required' jobs, current: '${job.status}'` };
      }
      return { allowed: true, reason: "Reject allowed" };
  }
}
