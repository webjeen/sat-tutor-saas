import type { ParsedGeneration, StructuralCloneResult, StructuralCloneMatch } from "../types";
import { normalize, simpleHash } from "../../dedup/fingerprint";
import { supabase } from "../../supabase/client";
import { GENERATION_CONFIG } from "../config";

const STRUCTURAL_CLONE_THRESHOLD = 0.85;
const STRUCTURAL_CLONE_REVIEW = 0.70;

export async function detectStructuralClones(
  parsed: ParsedGeneration,
  section: "RW" | "Math",
  excludeQuestionId?: string
): Promise<StructuralCloneResult> {
  const profile = extractStructuralProfile(parsed, section);
  const generatedQuestions = await fetchGeneratedQuestions(section);

  const matches: StructuralCloneMatch[] = [];

  for (const gq of generatedQuestions) {
    if (excludeQuestionId && gq.id === excludeQuestionId) continue;

    const gqProfile = extractDBRowProfile(gq);
    const similarity = computeStructuralSimilarity(profile, gqProfile);

    if (similarity >= STRUCTURAL_CLONE_REVIEW) {
      // Also check reasoning flow similarity if available
      const reasoningSimilarity = computeReasoningFlowSimilarity(
        parsed.reasoningTrace,
        gq.reasoning_trace || []
      );

      const combinedScore = (similarity * 0.6) + (reasoningSimilarity * 0.4);

      if (combinedScore >= STRUCTURAL_CLONE_REVIEW) {
        matches.push({
          matchedQuestionId: gq.id,
          structuralSimilarity: Math.round(similarity * 10000) / 10000,
          reasoningFlowSimilarity: Math.round(reasoningSimilarity * 10000) / 10000,
          combinedScore: Math.round(combinedScore * 10000) / 10000,
        });
      }
    }
  }

  const maxScore = matches.length > 0
    ? Math.max(...matches.map((m) => m.combinedScore))
    : 0;

  let result: "pass" | "fail" | "review";
  if (maxScore >= STRUCTURAL_CLONE_THRESHOLD) {
    result = "fail";
  } else if (maxScore >= STRUCTURAL_CLONE_REVIEW) {
    result = "review";
  } else {
    result = "pass";
  }

  return {
    result,
    matches,
    maxCombinedScore: Math.round(maxScore * 10000) / 10000,
    profile,
  };
}

interface StructuralProfile {
  patternSignature: string;
  section: string;
  hasPassage: boolean;
  passageLengthBand: "short" | "medium" | "long" | "none";
  questionStemHash: string;
  choiceCount: number;
  choiceStructureHash: string;
  correctPosition: string;
  distractorStrategySet: string;
  reasoningStepCount: number;
  reasoningStepNameHash: string;
}

function extractStructuralProfile(
  parsed: ParsedGeneration,
  section: "RW" | "Math"
): StructuralProfile {
  const hasPassage = !!parsed.passage && parsed.passage.trim().length > 0;
  const passageWords = parsed.passage
    ? parsed.passage.split(/\s+/).filter((w) => w.length > 0).length
    : 0;

  let passageLengthBand: StructuralProfile["passageLengthBand"] = "none";
  if (hasPassage) {
    if (passageWords < 80) passageLengthBand = "short";
    else if (passageWords < 200) passageLengthBand = "medium";
    else passageLengthBand = "long";
  }

  const questionStemHash = simpleHash(
    normalize(parsed.question).replace(/\s+/g, " ").split(" ").slice(0, 5).join(" ")
  );

  const choiceKeys = Object.keys(parsed.choices).sort();
  const choiceLengths = choiceKeys.map((k) => String(parsed.choices[k]?.length || 0));
  const choiceStructureHash = simpleHash(choiceLengths.join("|"));

  const strategies = Object.entries(parsed.distractorStrategies)
    .filter(([, s]) => s !== null)
    .map(([, s]) => s as string)
    .sort()
    .join(",");
  const distractorStrategySet = simpleHash(strategies);

  const reasoningStepNames = parsed.reasoningTrace
    .map((s) => normalize(s.name))
    .sort()
    .join("|");
  const reasoningStepNameHash = simpleHash(reasoningStepNames);

  const patternSignature = simpleHash([
    section,
    String(hasPassage),
    passageLengthBand,
    String(choiceKeys.length),
    parsed.correctChoice,
  ].join("|"));

  return {
    patternSignature,
    section,
    hasPassage,
    passageLengthBand,
    questionStemHash,
    choiceCount: choiceKeys.length,
    choiceStructureHash,
    correctPosition: parsed.correctChoice,
    distractorStrategySet,
    reasoningStepCount: parsed.reasoningTrace.length,
    reasoningStepNameHash,
  };
}

interface DBRowProfile {
  id: string;
  section: string;
  hasPassage: boolean;
  passageLengthBand: "short" | "medium" | "long" | "none";
  choiceStructureHash: string;
  correctPosition: string;
  distractorStrategySet: string;
  reasoningStepCount: number;
  reasoningStepNameHash: string;
  reasoning_trace: { step: number; name: string; description: string }[];
  distractor_analysis: Record<string, unknown>;
  generated_passage: string | null;
}

function extractDBRowProfile(gq: DBGeneratedQuestion): DBRowProfile {
  const hasPassage = !!gq.generated_passage && gq.generated_passage.trim().length > 0;
  const passageWords = gq.generated_passage
    ? gq.generated_passage.split(/\s+/).filter((w) => w.length > 0).length
    : 0;

  let passageLengthBand: DBRowProfile["passageLengthBand"] = "none";
  if (hasPassage) {
    if (passageWords < 80) passageLengthBand = "short";
    else if (passageWords < 200) passageLengthBand = "medium";
    else passageLengthBand = "long";
  }

  const choiceLengths = [
    String((gq.choice_a || "").length),
    String((gq.choice_b || "").length),
    String((gq.choice_c || "").length),
    String((gq.choice_d || "").length),
  ];
  const choiceStructureHash = simpleHash(choiceLengths.join("|"));

  const distractorAnalysis = gq.distractor_analysis || {};
  const strategies = (distractorAnalysis.strategies as string[] || []).sort().join(",");
  const distractorStrategySet = simpleHash(strategies);

  const reasoningTrace = gq.reasoning_trace || [];
  const reasoningStepNames = reasoningTrace
    .map((s) => normalize(s.name))
    .sort()
    .join("|");
  const reasoningStepNameHash = simpleHash(reasoningStepNames);

  return {
    id: gq.id,
    section: gq.section,
    hasPassage,
    passageLengthBand,
    choiceStructureHash,
    correctPosition: gq.correct_choice,
    distractorStrategySet,
    reasoningStepCount: reasoningTrace.length,
    reasoningStepNameHash,
    reasoning_trace: reasoningTrace,
    distractor_analysis: gq.distractor_analysis,
    generated_passage: gq.generated_passage,
  };
}

function computeStructuralSimilarity(
  a: StructuralProfile | DBRowProfile,
  b: StructuralProfile | DBRowProfile
): number {
  let matches = 0;
  let total = 0;

  if (a.section === b.section) matches++; total++;
  if (a.hasPassage === b.hasPassage) matches++; total++;
  if (a.passageLengthBand === b.passageLengthBand) matches++; total++;
  if (a.correctPosition === b.correctPosition) matches++; total++;
  if (a.choiceStructureHash === b.choiceStructureHash) matches++; total++;
  if (a.distractorStrategySet === b.distractorStrategySet) matches++; total++;
  if (a.reasoningStepNameHash === b.reasoningStepNameHash) matches++; total++;

  const stepDiff = Math.abs(a.reasoningStepCount - b.reasoningStepCount);
  if (stepDiff === 0) matches++;
  else if (stepDiff === 1) matches += 0.5;
  total++;

  return total > 0 ? matches / total : 0;
}

function computeReasoningFlowSimilarity(
  a: { step: number; name: string; description: string }[],
  b: { step: number; name: string; description: string }[]
): number {
  if (a.length === 0 && b.length === 0) return 0.5;
  if (a.length === 0 || b.length === 0) return 0;

  const aNames = a.map((s) => normalize(s.name));
  const bNames = b.map((s) => normalize(s.name));

  const aSet = new Set(aNames);
  const bSet = new Set(bNames);

  let intersection = 0;
  for (const name of aSet) {
    if (bSet.has(name)) intersection++;
  }

  const union = new Set([...aNames, ...bNames]).size;
  if (union === 0) return 0;

  const jaccard = intersection / union;

  // Also check ordering similarity
  const minLen = Math.min(aNames.length, bNames.length);
  let orderMatches = 0;
  for (let i = 0; i < minLen; i++) {
    if (aNames[i] === bNames[i]) orderMatches++;
  }
  const orderScore = minLen > 0 ? orderMatches / minLen : 0;

  return (jaccard * 0.5) + (orderScore * 0.5);
}

interface DBGeneratedQuestion {
  id: string;
  section: string;
  generated_passage: string | null;
  generated_question: string | null;
  choice_a: string | null;
  choice_b: string | null;
  choice_c: string | null;
  choice_d: string | null;
  correct_choice: string;
  distractor_analysis: Record<string, unknown>;
  reasoning_trace: { step: number; name: string; description: string }[];
  fingerprint_text: string | null;
}

async function fetchGeneratedQuestions(section: "RW" | "Math"): Promise<DBGeneratedQuestion[]> {
  const recentCutoff = new Date(
    Date.now() - GENERATION_CONFIG.batch.recentWindowDays * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data } = await supabase
    .from("generated_questions")
    .select("id, section, generated_passage, generated_question, choice_a, choice_b, choice_c, choice_d, correct_choice, distractor_analysis, reasoning_trace, fingerprint_text")
    .eq("section", section)
    .eq("is_active", true)
    .gte("created_at", recentCutoff);

  return (data || []) as DBGeneratedQuestion[];
}
