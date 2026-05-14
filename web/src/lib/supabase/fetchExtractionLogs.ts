import { supabase } from "./client";
import type { ExtractionLogRecord } from "../extraction/types";

interface ExtractionLogFilters {
  sourceQuestionId?: string;
  patternId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export async function fetchExtractionLogs(
  filters?: ExtractionLogFilters
): Promise<{ data: ExtractionLogRecord[] | null; error: string | null }> {
  let query = supabase
    .from("extraction_logs")
    .select("*")
    .order("created_at", { ascending: false });

  if (filters?.sourceQuestionId) {
    query = query.eq("source_question_id", filters.sourceQuestionId);
  }
  if (filters?.patternId) {
    query = query.eq("pattern_id", filters.patternId);
  }
  if (filters?.status) {
    query = query.eq("status", filters.status);
  }
  if (filters?.limit) {
    query = query.limit(filters.limit);
  }
  if (filters?.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
  }

  const { data, error } = await query;

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: (data || []) as ExtractionLogRecord[], error: null };
}
