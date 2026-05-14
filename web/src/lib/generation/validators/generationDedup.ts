import { supabase } from "../../supabase/client";
import { normalize, simpleHash } from "../../dedup/fingerprint";
import { computeWeightedContentSimilarity } from "../../dedup/similarity";
import type { Fingerprint, StructuredContent, DedupMatch } from "../../dedup/types";
import type { DuplicateCheckResult, ParsedGeneration } from "../types";
import { GENERATION_CONFIG } from "../config";

export async function checkGenerationDedup(
  parsed: ParsedGeneration,
  section: "RW" | "Math",
  excludeQuestionId?: string
): Promise<DuplicateCheckResult> {
  const fingerprint = generateFingerprint(parsed, section);
  const content = toStructuredContent(parsed);

  const realMatches = await checkAgainstRealQuestions(fingerprint, content);
  const generatedMatches = await checkAgainstGeneratedQuestions(fingerprint, content, excludeQuestionId);

  const maxRealSimilarity = realMatches.length > 0
    ? Math.max(...realMatches.map((m) => m.score))
    : 0;
  const maxGeneratedSimilarity = generatedMatches.length > 0
    ? Math.max(...generatedMatches.map((m) => m.score))
    : 0;

  const maxSimilarity = Math.max(maxRealSimilarity, maxGeneratedSimilarity);

  let result: "pass" | "fail" | "review";
  if (fingerprint.textHash === "" || maxSimilarity >= GENERATION_CONFIG.thresholds.dedupDuplicate) {
    result = "fail";
  } else if (maxSimilarity >= GENERATION_CONFIG.thresholds.dedupSimilar) {
    result = "review";
  } else {
    result = "pass";
  }

  return {
    result,
    realQuestionMatches: realMatches,
    generatedQuestionMatches: generatedMatches,
    maxRealSimilarity: Math.round(maxRealSimilarity * 10000) / 10000,
    maxGeneratedSimilarity: Math.round(maxGeneratedSimilarity * 10000) / 10000,
    fingerprint,
  };
}

async function checkAgainstRealQuestions(
  fingerprint: Fingerprint,
  content: StructuredContent
): Promise<DedupMatch[]> {
  const matches: DedupMatch[] = [];

  const { data } = await supabase
    .from("real_questions")
    .select("id, raw_passage, raw_question, choice_a, choice_b, choice_c, choice_d, fingerprint_text")
    .in("parsing_status", ["validation_passed", "approved", "parsed"]);

  if (!data) return matches;

  for (const rq of data) {
    if (fingerprint.textHash === rq.fingerprint_text) {
      matches.push({ questionId: rq.id, score: 1.0, matchType: "exact" });
      continue;
    }

    const realContent: StructuredContent = {
      passage: rq.raw_passage || "",
      question: rq.raw_question || "",
      choices: [rq.choice_a, rq.choice_b, rq.choice_c, rq.choice_d].filter(Boolean).join(" "),
    };

    const similarity = computeWeightedContentSimilarity(content, realContent);
    if (similarity >= GENERATION_CONFIG.thresholds.dedupSimilar) {
      matches.push({
        questionId: rq.id,
        score: similarity,
        matchType: similarity >= GENERATION_CONFIG.thresholds.dedupDuplicate ? "near" : "similar",
      });
    }
  }

  return matches;
}

async function checkAgainstGeneratedQuestions(
  fingerprint: Fingerprint,
  content: StructuredContent,
  excludeId?: string
): Promise<DedupMatch[]> {
  const matches: DedupMatch[] = [];

  let query = supabase
    .from("generated_questions")
    .select("id, generated_passage, generated_question, choice_a, choice_b, choice_c, choice_d, fingerprint_text")
    .eq("is_active", true);

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { data } = await query;
  if (!data) return matches;

  for (const gq of data) {
    if (fingerprint.textHash === gq.fingerprint_text) {
      matches.push({ questionId: gq.id, score: 1.0, matchType: "exact" });
      continue;
    }

    const gqContent: StructuredContent = {
      passage: gq.generated_passage || "",
      question: gq.generated_question,
      choices: [gq.choice_a, gq.choice_b, gq.choice_c, gq.choice_d].filter(Boolean).join(" "),
    };

    const similarity = computeWeightedContentSimilarity(content, gqContent);
    if (similarity >= GENERATION_CONFIG.thresholds.dedupSimilar) {
      matches.push({
        questionId: gq.id,
        score: similarity,
        matchType: similarity >= GENERATION_CONFIG.thresholds.dedupDuplicate ? "near" : "similar",
      });
    }
  }

  return matches;
}

function generateFingerprint(parsed: ParsedGeneration, section: "RW" | "Math"): Fingerprint {
  const parts: string[] = [];
  if (section === "RW" && parsed.passage) {
    parts.push(normalize(parsed.passage));
  }
  parts.push(normalize(parsed.question));

  const textHash = simpleHash(parts.join("|"));
  const choiceKeys = Object.keys(parsed.choices).sort();
  const normalizedChoices = choiceKeys.map((k) => `${k}:${normalize(parsed.choices[k])}`);
  const choiceHash = simpleHash(normalizedChoices.join("|"));
  const patternSignature = simpleHash([section, String(choiceKeys.length), String(!!parsed.passage)].join("|"));

  return {
    textHash,
    structureHash: simpleHash([section].join("|")),
    choiceHash,
    patternSignature,
  };
}

function toStructuredContent(parsed: ParsedGeneration): StructuredContent {
  return {
    passage: parsed.passage || "",
    question: parsed.question,
    choices: Object.values(parsed.choices).join(" "),
  };
}
