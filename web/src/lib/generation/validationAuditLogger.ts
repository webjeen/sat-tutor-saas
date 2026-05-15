import type {
  AuditEventType,
  ValidationAuditEntry,
  GenerationValidationResult,
  DecisionResult,
  PreSaveValidationResult,
  PreExportValidationResult,
  EscalationEvent,
} from "./types";
import { supabase } from "../supabase/client";

export async function logValidationAudit(
  eventType: AuditEventType,
  targetId: string | null,
  targetType: "generated_question" | "worksheet" | "generation_job" | null,
  stage: string,
  options: {
    checkName?: string;
    result?: string | null;
    score?: number | null;
    decision?: string | null;
    decisionReason?: string | null;
    retryCount?: number;
    escalationLevel?: string | null;
    metadata?: Record<string, unknown>;
  } = {}
): Promise<void> {
  const entry: ValidationAuditEntry = {
    id: generateAuditId(),
    eventType,
    targetId,
    targetType,
    stage,
    checkName: options.checkName || null,
    result: options.result || null,
    score: options.score !== undefined ? options.score : null,
    decision: options.decision || null,
    decisionReason: options.decisionReason || null,
    retryCount: options.retryCount ?? 0,
    escalationLevel: options.escalationLevel || null,
    metadata: options.metadata || {},
    createdAt: new Date().toISOString(),
  };

  await persistAuditEntry(entry);
}

export async function logValidationChecks(
  questionId: string | null,
  stage: string,
  validation: GenerationValidationResult
): Promise<void> {
  const checks = [
    { name: "structure", result: validation.structure.result },
    { name: "leakage", result: validation.leakage.result, score: validation.leakage.maxSimilarity },
    { name: "difficulty", result: validation.difficulty.result, score: validation.difficulty.difficultyScore },
    { name: "distractor", result: validation.distractor.result },
    { name: "dedup", result: validation.dedup.result, score: Math.max(validation.dedup.maxRealSimilarity, validation.dedup.maxGeneratedSimilarity) },
    { name: "explanation_coherence", result: validation.explanationCoherence.result, score: validation.explanationCoherence.coherenceScore },
    { name: "sat_style", result: validation.satStyle.result },
    { name: "anti_leak_safeguard", result: validation.antiLeakSafeguard.result, score: validation.antiLeakSafeguard.ngramOverlapScore },
    { name: "generation_score", result: validation.generationScore.result, score: validation.generationScore.overallScore },
    { name: "structural_clone", result: validation.structuralClone.result, score: validation.structuralClone.maxCombinedScore },
  ];

  for (const check of checks) {
    await logValidationAudit(
      "validation_check",
      questionId,
      "generated_question",
      stage,
      {
        checkName: check.name,
        result: check.result,
        score: check.score ?? null,
      }
    );
  }
}

export async function logDecision(
  questionId: string | null,
  stage: string,
  decision: DecisionResult
): Promise<void> {
  await logValidationAudit(
    "decision_made",
    questionId,
    "generated_question",
    stage,
    {
      decision: decision.action,
      decisionReason: decision.reason,
      retryCount: decision.retryCount,
      metadata: {
        failedChecks: decision.failedChecks,
        suggestedTemplateId: decision.suggestedTemplateId,
      },
    }
  );
}

export async function logRetry(
  questionId: string | null,
  stage: string,
  retryCount: number,
  reason: string
): Promise<void> {
  await logValidationAudit(
    "retry_attempted",
    questionId,
    "generated_question",
    stage,
    {
      result: "retry",
      decisionReason: reason,
      retryCount,
    }
  );
}

export async function logEscalation(
  questionId: string | null,
  stage: string,
  event: EscalationEvent
): Promise<void> {
  await logValidationAudit(
    "escalation_triggered",
    questionId,
    "generated_question",
    stage,
    {
      result: event.toLevel,
      decisionReason: event.reason,
      retryCount: event.retryCount,
      escalationLevel: event.toLevel,
      metadata: {
        fromLevel: event.fromLevel,
        timestamp: event.timestamp,
      },
    }
  );
}

export async function logPreSaveGate(
  questionId: string | null,
  stage: string,
  preSaveResult: PreSaveValidationResult
): Promise<void> {
  await logValidationAudit(
    "pre_save_gate",
    questionId,
    "generated_question",
    stage,
    {
      result: preSaveResult.cleared ? "cleared" : "blocked",
      decisionReason: preSaveResult.blockedReasons.join("; ") || null,
      metadata: {
        checks: preSaveResult.checks.map((c) => ({
          name: c.name,
          passed: c.passed,
          reason: c.reason,
        })),
      },
    }
  );
}

export async function logPreExportGate(
  worksheetId: string | null,
  stage: string,
  preExportResult: PreExportValidationResult
): Promise<void> {
  await logValidationAudit(
    "pre_export_gate",
    worksheetId,
    "worksheet",
    stage,
    {
      result: preExportResult.cleared ? "cleared" : "blocked",
      decisionReason: preExportResult.blockedReasons.join("; ") || null,
      metadata: {
        checks: preExportResult.checks.map((c) => ({
          name: c.name,
          passed: c.passed,
          reason: c.reason,
        })),
      },
    }
  );
}

export async function logAntiLeakCheck(
  questionId: string | null,
  stage: string,
  ngramScore: number,
  structuralScore: number,
  passageScore: number,
  passed: boolean,
  criticalViolations: number
): Promise<void> {
  await logValidationAudit(
    "anti_leak_check",
    questionId,
    "generated_question",
    stage,
    {
      result: passed ? "pass" : "fail",
      metadata: {
        ngramOverlapScore: ngramScore,
        structuralLeakageScore: structuralScore,
        passageLeakageScore: passageScore,
        criticalViolations,
      },
    }
  );
}

export async function logStructuralCloneCheck(
  questionId: string | null,
  stage: string,
  result: "pass" | "fail" | "review",
  maxCombinedScore: number,
  matchesCount: number
): Promise<void> {
  await logValidationAudit(
    "structural_clone_check",
    questionId,
    "generated_question",
    stage,
    {
      checkName: "structural_clone",
      result,
      score: maxCombinedScore,
      metadata: { matchesCount },
    }
  );
}

async function persistAuditEntry(entry: ValidationAuditEntry): Promise<void> {
  try {
    await supabase.from("validation_audit_logs").insert({
      event_type: entry.eventType,
      target_id: entry.targetId,
      target_type: entry.targetType,
      stage: entry.stage,
      check_name: entry.checkName,
      result: entry.result,
      score: entry.score,
      decision: entry.decision,
      decision_reason: entry.decisionReason,
      retry_count: entry.retryCount,
      escalation_level: entry.escalationLevel,
      metadata: entry.metadata,
      created_at: entry.createdAt,
    });
  } catch {
    // Audit logging must not block the pipeline
  }
}

function generateAuditId(): string {
  return `audit:${Date.now()}:${Math.random().toString(36).substring(2, 8)}`;
}
