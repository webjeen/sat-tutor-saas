import { supabase } from "./client";
import type {
  SectionExtractedData,
  PatternOutput,
  PatternStatus,
} from "../extraction/types";

export async function savePattern(
  sourceQuestionId: string,
  section: string,
  type: string,
  extractedData: SectionExtractedData,
  patternOutput: PatternOutput,
  status: PatternStatus
): Promise<{ success: boolean; patternId?: string; error?: string }> {
  const row = {
    source_question_id: sourceQuestionId,
    exam_family: "DSAT",
    section,
    type,
    extracted_data: extractedData as unknown as Record<string, unknown>,
    reasoning_pattern: patternOutput.reasoning_pattern,
    distractor_pattern: patternOutput.distractor_pattern,
    timing_complexity: patternOutput.timing_complexity,
    syntax_complexity: patternOutput.syntax_complexity,
    abstraction_level: patternOutput.abstraction_level,
    difficulty_band: patternOutput.difficulty_band || null,
    difficulty_level: patternOutput.difficulty_band || null,
    status,
    processing_stage: "extraction_complete",
    last_processed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("patterns")
    .insert(row)
    .select("id")
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, patternId: data?.id };
}
