import type { ReviewDecision, ReviewEntry, ReviewQueueItem } from "./types";
import { transitionJobStatus, getJob } from "./jobs";
import { fetchReviewQueue, fetchReviewsForJob, saveReviewEntry } from "./persistence";
import { validateJobAction } from "./safety";
import { recordAuditEvent } from "./auditLog";

// -- Submit a review decision --

export async function submitReview(
  jobId: string,
  decision: ReviewDecision,
  notes: string,
  reviewerId: string | null = null
): Promise<{ success: boolean; error: string | null; newStatus: string }> {
  const job = await getJob(jobId);
  if (!job) return { success: false, error: "Job not found", newStatus: "unknown" };

  const actionValidation = validateJobAction(job, decision === "retry" ? "review" : decision);
  if (!actionValidation.allowed) {
    return { success: false, error: actionValidation.reason, newStatus: job.status };
  }

  const previousStatus = job.status;
  let newStatus: typeof job.status;

  switch (decision) {
    case "approve":
      newStatus = "approved_for_export";
      break;
    case "reject":
      newStatus = "rejected";
      break;
    case "retry":
      newStatus = "processing";
      break;
  }

  const transitionResult = await transitionJobStatus(jobId, newStatus, `Review: ${decision} — ${notes}`);
  if (!transitionResult.success) {
    return { success: false, error: transitionResult.error, newStatus: job.status };
  }

  // Save review entry
  const reviewEntry: Omit<ReviewEntry, "id" | "createdAt"> = {
    jobId,
    reviewerId,
    decision,
    notes,
    previousStatus,
    newStatus,
  };

  const { error: saveError } = await saveReviewEntry(reviewEntry);
  if (saveError) {
    recordAuditEvent(jobId, "review_submitted", `Review saved with DB error: ${saveError}`, { decision, notes });
  }

  recordAuditEvent(jobId, "review_submitted", `Review: ${decision}`, { decision, notes, previousStatus, newStatus });

  return { success: true, error: null, newStatus };
}

// -- Fetch review queue --

export async function getReviewQueue(): Promise<ReviewQueueItem[]> {
  const jobs = await fetchReviewQueue();

  const items: ReviewQueueItem[] = [];
  for (const job of jobs) {
    const reviews = await fetchReviewsForJob(job.id);
    const failedChecks = job.validationSnapshot?.worksheetValidation?.failedChecks ?? [];
    if (job.validationSnapshot?.generationValidation?.failedChecks) {
      failedChecks.push(...job.validationSnapshot.generationValidation.failedChecks);
    }

    items.push({
      jobId: job.id,
      type: job.type,
      title: job.config.title,
      status: job.status,
      stage: job.stage,
      failedChecks,
      retryCount: job.retryCount,
      createdAt: job.createdAt,
      reviewEntries: reviews,
    });
  }

  return items;
}
