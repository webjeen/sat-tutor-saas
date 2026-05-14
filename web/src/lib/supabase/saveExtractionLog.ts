import { supabase } from "./client";
import type { ExtractionLogRecord } from "../extraction/types";

export async function saveExtractionLog(
  log: ExtractionLogRecord
): Promise<{ success: boolean; error?: string }> {
  const row = {
    source_question_id: log.source_question_id,
    pattern_id: log.pattern_id,
    section: log.section,
    extraction_stage: log.extraction_stage,
    status: log.status,
    decision: log.decision,
    decision_reason: log.decision_reason,
    validation_results: log.validation_results,
    error_message: log.error_message,
    retry_count: log.retry_count,
    extraction_duration_ms: log.extraction_duration_ms,
    fingerprint_text: log.fingerprint_text,
    fingerprint_structure: log.fingerprint_structure,
  };

  const { error } = await supabase
    .from("extraction_logs")
    .insert(row);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
