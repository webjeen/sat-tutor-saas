import { supabase } from "../../supabase/client";
import { normalize, simpleHash } from "../../dedup/fingerprint";
import { computeWeightedContentSimilarity } from "../../dedup/similarity";
import type { Fingerprint, StructuredContent, DedupMatch } from "../../dedup/types";
import type { DuplicateCheckResult, ParsedGeneration } from "../types";
import { GENERATION_CONFIG } from "../config";

// -- Caching --

interface CacheEntry<T> {
  data: T[];
  fetchedAt: number;
  section: string;
}

let realQuestionsCache: CacheEntry<RealQuestionRow> | null = null;
let generatedQuestionsCache: CacheEntry<GeneratedQuestionRow> | null = null;

export function clearDedupCaches(): void {
  realQuestionsCache = null;
  generatedQuestionsCache = null;
}

// -- DB row types --

interface RealQuestionRow {
  id: string;
  raw_passage: string | null;
  raw_question: string | null;
  choice_a: string | null;
  choice_b: string | null;
  choice_c: string | null;
  choice_d: string | null;
  fingerprint_text: string | null;
}

interface GeneratedQuestionRow {
  id: string;
  generated_passage: string | null;
  generated_question: string | null;
  choice_a: string | null;
  choice_b: string | null;
  choice_c: string | null;
  choice_d: string | null;
  fingerprint_text: string | null;
}

// -- Main dedup check --

export async function checkGenerationDedup(
  parsed: ParsedGeneration,
  section: "RW" | "Math",
  excludeQuestionId?: string
): Promise<DuplicateCheckResult> {
  const fingerprint = generateFingerprint(parsed, section);
  const content = toStructuredContent(parsed);

  const realMatches = await checkAgainstRealQuestions(fingerprint, content, section);
  const generatedMatches = await checkAgainstGeneratedQuestions(fingerprint, content, section, excludeQuestionId);

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

// -- Intra-batch dedup (no DB, checks against in-memory batch) --

export function checkIntraBatchDedup(
  parsed: ParsedGeneration,
  section: "RW" | "Math",
  batchItems: { id: string; fingerprint: Fingerprint; content: StructuredContent }[]
): { isDuplicate: boolean; matchingItemId: string | null; similarity: number } {
  const content = toStructuredContent(parsed);
  const fingerprint = generateFingerprint(parsed, section);

  for (const item of batchItems) {
    if (fingerprint.textHash === item.fingerprint.textHash) {
      return { isDuplicate: true, matchingItemId: item.id, similarity: 1.0 };
    }

    const similarity = computeWeightedContentSimilarity(content, item.content);
    if (similarity >= GENERATION_CONFIG.thresholds.dedupDuplicate) {
      return { isDuplicate: true, matchingItemId: item.id, similarity };
    }
  }

  return { isDuplicate: false, matchingItemId: null, similarity: 0 };
}

// -- DB queries with caching and filtering --

async function checkAgainstRealQuestions(
  fingerprint: Fingerprint,
  content: StructuredContent,
  section: "RW" | "Math"
): Promise<DedupMatch[]> {
  const matches: DedupMatch[] = [];
  const data = await fetchRealQuestions(section);

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
  section: "RW" | "Math",
  excludeId?: string
): Promise<DedupMatch[]> {
  const matches: DedupMatch[] = [];
  const data = await fetchGeneratedQuestions(section);

  for (const gq of data) {
    if (excludeId && gq.id === excludeId) continue;

    if (fingerprint.textHash === gq.fingerprint_text) {
      matches.push({ questionId: gq.id, score: 1.0, matchType: "exact" });
      continue;
    }

    const gqContent: StructuredContent = {
      passage: gq.generated_passage || "",
      question: gq.generated_question || "",
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

async function fetchRealQuestions(section: "RW" | "Math"): Promise<RealQuestionRow[]> {
  const now = Date.now();
  const ttl = GENERATION_CONFIG.caching.realQuestionsTTL;

  if (realQuestionsCache && realQuestionsCache.section === section && (now - realQuestionsCache.fetchedAt) < ttl) {
    return realQuestionsCache.data;
  }

  const { data } = await supabase
    .from("real_questions")
    .select("id, raw_passage, raw_question, choice_a, choice_b, choice_c, choice_d, fingerprint_text")
    .eq("section", section)
    .in("parsing_status", ["validation_passed", "approved", "parsed"]);

  const rows = (data || []) as RealQuestionRow[];
  realQuestionsCache = { data: rows, fetchedAt: now, section };
  return rows;
}

async function fetchGeneratedQuestions(section: "RW" | "Math"): Promise<GeneratedQuestionRow[]> {
  const now = Date.now();
  const ttl = GENERATION_CONFIG.caching.generatedQuestionsTTL;

  if (generatedQuestionsCache && generatedQuestionsCache.section === section && (now - generatedQuestionsCache.fetchedAt) < ttl) {
    return generatedQuestionsCache.data;
  }

  const recentCutoff = new Date(
    now - GENERATION_CONFIG.batch.recentWindowDays * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data } = await supabase
    .from("generated_questions")
    .select("id, generated_passage, generated_question, choice_a, choice_b, choice_c, choice_d, fingerprint_text")
    .eq("section", section)
    .eq("is_active", true)
    .gte("created_at", recentCutoff);

  const rows = (data || []) as GeneratedQuestionRow[];
  generatedQuestionsCache = { data: rows, fetchedAt: now, section };
  return rows;
}

// -- Fingerprint generation (local) --

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
