import type { TutorAuditEvent, TutorAuditEventType, TutorJobStatus, TutorJobStage } from "./types";
import { TUTOR_CONFIG } from "./config";

// -- In-memory audit log store --
// Supabase-backed persistence is in persistence.ts; this provides
// fast local access for operational queries within a session.

const auditStore: Map<string, TutorAuditEvent[]> = new Map();

export function recordAuditEvent(
  jobId: string,
  eventType: TutorAuditEventType,
  detail: string,
  metadata: Record<string, unknown> = {}
): TutorAuditEvent {
  const event: TutorAuditEvent = {
    id: `audit:${Date.now()}:${Math.random().toString(36).substring(2, 8)}`,
    jobId,
    eventType,
    detail,
    metadata,
    createdAt: new Date().toISOString(),
  };

  const events = auditStore.get(jobId) ?? [];

  // Enforce max events per job
  if (events.length >= TUTOR_CONFIG.audit.maxEventsPerJob) {
    events.shift();
  }

  events.push(event);
  auditStore.set(jobId, events);
  return event;
}

export function getAuditEvents(jobId: string): TutorAuditEvent[] {
  return auditStore.get(jobId) ?? [];
}

export function getRecentAuditEvents(limit: number = 50): TutorAuditEvent[] {
  const all: TutorAuditEvent[] = [];
  for (const events of auditStore.values()) {
    all.push(...events);
  }
  return all
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

// -- Convenience factories for common events --

export function auditJobCreated(jobId: string, type: string, config: Record<string, unknown>): TutorAuditEvent {
  return recordAuditEvent(jobId, "job_created", `Job created (type=${type})`, { type, config });
}

export function auditStatusChanged(jobId: string, from: TutorJobStatus, to: TutorJobStatus, reason: string): TutorAuditEvent {
  return recordAuditEvent(jobId, "status_changed", `Status: ${from} → ${to} — ${reason}`, { from, to, reason });
}

export function auditStageChanged(jobId: string, from: TutorJobStage, to: TutorJobStage): TutorAuditEvent {
  return recordAuditEvent(jobId, "stage_changed", `Stage: ${from} → ${to}`, { from, to });
}

export function auditRetryAttempted(jobId: string, retryCount: number, maxRetries: number): TutorAuditEvent {
  return recordAuditEvent(jobId, "retry_attempted", `Retry ${retryCount}/${maxRetries}`, { retryCount, maxRetries });
}

export function auditRetryExhausted(jobId: string, retryCount: number): TutorAuditEvent {
  return recordAuditEvent(jobId, "retry_exhausted", `All retries exhausted (${retryCount})`, { retryCount });
}

export function auditValidationFailed(jobId: string, failedChecks: string[]): TutorAuditEvent {
  return recordAuditEvent(jobId, "validation_failed", `Validation failed: [${failedChecks.join(", ")}]`, { failedChecks });
}

export function auditValidationPassed(jobId: string, stage: string): TutorAuditEvent {
  return recordAuditEvent(jobId, "validation_passed", `Validation passed at ${stage}`, { stage });
}

export function auditExportStarted(jobId: string, profile: string): TutorAuditEvent {
  return recordAuditEvent(jobId, "export_started", `Export started (profile=${profile})`, { profile });
}

export function auditExportCompleted(jobId: string, sizeBytes: number | null): TutorAuditEvent {
  return recordAuditEvent(jobId, "export_completed", `Export completed (${sizeBytes ?? 0} bytes)`, { sizeBytes });
}

export function auditExportFailed(jobId: string, error: string): TutorAuditEvent {
  return recordAuditEvent(jobId, "export_failed", `Export failed: ${error}`, { error });
}

export function auditTransitionBlocked(jobId: string, from: TutorJobStatus, to: TutorJobStatus, reason: string): TutorAuditEvent {
  return recordAuditEvent(jobId, "state_transition_blocked", `Blocked: ${from} → ${to} — ${reason}`, { from, to, reason });
}

export function auditStaleJobCleaned(jobId: string, age: string): TutorAuditEvent {
  return recordAuditEvent(jobId, "stale_job_cleaned", `Stale job cleaned (age=${age})`, { age });
}

export function auditConcurrencyLimitReached(jobId: string, limit: number): TutorAuditEvent {
  return recordAuditEvent(jobId, "concurrency_limit_reached", `Concurrency limit reached (${limit})`, { limit });
}
