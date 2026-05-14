import type {
  SectionExtractedData,
  RWExtractedData,
  MathExtractedData,
  PatternRecord,
} from "./types";

export interface PatternDedupResult {
  isDuplicate: boolean;
  matchScore: number;
  matchedPatternId: string | null;
  matchType: "exact" | "near" | "similar" | "none";
}

export function checkPatternDuplicate(
  extractedData: SectionExtractedData,
  section: string,
  existingPatterns: PatternRecord[]
): PatternDedupResult {
  const newType = extractedData.question_type;
  const newDistractor = extractedData.distractor_pattern;

  const newReasoning =
    section === "RW"
      ? (extractedData as RWExtractedData).reasoning_category
      : (extractedData as MathExtractedData).math_domain;

  const newSecondary =
    section === "RW"
      ? (extractedData as RWExtractedData).evidence_reasoning
      : (extractedData as MathExtractedData).equation_structure;

  for (const existing of existingPatterns) {
    const existingData = existing.extracted_data;
    let score = 0;
    let fields = 0;

    // Type match (most important)
    fields++;
    if (existing.type === newType) score++;

    // Reasoning match
    fields++;
    if (existing.reasoning_pattern === newReasoning) score++;

    // Distractor match
    fields++;
    if (existing.distractor_pattern === newDistractor) score++;

    // Secondary match
    fields++;
    if (section === "RW" && "evidence_reasoning" in existingData) {
      if ((existingData as RWExtractedData).evidence_reasoning === newSecondary) score++;
    } else if (section === "Math" && "equation_structure" in existingData) {
      if ((existingData as MathExtractedData).equation_structure === newSecondary) score++;
    }

    const matchScore = fields > 0 ? score / fields : 0;

    if (matchScore >= 1.0) {
      return {
        isDuplicate: true,
        matchScore,
        matchedPatternId: existing.id,
        matchType: "exact",
      };
    }

    if (matchScore >= 0.75) {
      return {
        isDuplicate: true,
        matchScore,
        matchedPatternId: existing.id,
        matchType: "near",
      };
    }

    if (matchScore >= 0.5) {
      return {
        isDuplicate: false,
        matchScore,
        matchedPatternId: existing.id,
        matchType: "similar",
      };
    }
  }

  return {
    isDuplicate: false,
    matchScore: 0,
    matchedPatternId: null,
    matchType: "none",
  };
}
