import { supabase } from "../../supabase/client";
import { normalize, simpleHash } from "../../dedup/fingerprint";
import { computeWeightedContentSimilarity } from "../../dedup/similarity";
import type { Fingerprint, StructuredContent } from "../../dedup/types";
import type { LeakCheckResult, ParsedGeneration } from "../types";
import { GENERATION_CONFIG } from "../config";

interface CacheEntry {
  data: RealQuestionRow[];
  fetchedAt: number;
  section: string;
}

interface RealQuestionRow {
  id: string;
  raw_passage: string | null;
  raw_question: string | null;
  choice_a: string | null;
  choice_b: string | null;
  choice_c: string | null;
  choice_d: string | null;
  fingerprint_text: string | null;
  fingerprint_structure: string | null;
}

let cache: CacheEntry | null = null;

export function clearLeakageCache(): void {
  cache = null;
}

export async function detectLeakage(
  parsed: ParsedGeneration,
  section: "RW" | "Math"
): Promise<LeakCheckResult> {
  const fingerprint = generateFingerprint(parsed, section);
  const content = toStructuredContent(parsed, section);

  const realQuestions = await fetchRealQuestions(section);

  let maxSimilarity = 0;
  const matchedIds: string[] = [];

  if (realQuestions.length > 0) {
    for (const rq of realQuestions) {
      if (fingerprint.textHash === rq.fingerprint_text) {
        maxSimilarity = 1.0;
        matchedIds.push(rq.id);
        continue;
      }

      const realContent: StructuredContent = {
        passage: rq.raw_passage || "",
        question: rq.raw_question || "",
        choices: [rq.choice_a, rq.choice_b, rq.choice_c, rq.choice_d].filter(Boolean).join(" "),
      };

      const similarity = computeWeightedContentSimilarity(content, realContent);
      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
      }
      if (similarity >= GENERATION_CONFIG.thresholds.leakReview) {
        matchedIds.push(rq.id);
      }
    }
  }

  let result: "pass" | "fail" | "review";
  if (maxSimilarity >= GENERATION_CONFIG.thresholds.leakFail) {
    result = "fail";
  } else if (maxSimilarity >= GENERATION_CONFIG.thresholds.leakReview) {
    result = "review";
  } else {
    result = "pass";
  }

  return {
    result,
    maxSimilarity: Math.round(maxSimilarity * 10000) / 10000,
    matchedRealQuestionIds: matchedIds,
    fingerprint,
  };
}

async function fetchRealQuestions(section: "RW" | "Math"): Promise<RealQuestionRow[]> {
  const now = Date.now();
  const ttl = GENERATION_CONFIG.caching.realQuestionsTTL;

  if (cache && cache.section === section && (now - cache.fetchedAt) < ttl) {
    return cache.data;
  }

  const { data } = await supabase
    .from("real_questions")
    .select("id, raw_passage, raw_question, choice_a, choice_b, choice_c, choice_d, fingerprint_text, fingerprint_structure")
    .eq("section", section)
    .in("parsing_status", ["validation_passed", "approved", "parsed"]);

  const rows = (data || []) as RealQuestionRow[];

  cache = { data: rows, fetchedAt: now, section };

  return rows;
}

function generateFingerprint(parsed: ParsedGeneration, section: "RW" | "Math"): Fingerprint {
  const parts: string[] = [];
  if (section === "RW" && parsed.passage) {
    parts.push(normalize(parsed.passage));
  }
  parts.push(normalize(parsed.question));

  const textHash = simpleHash(parts.join("|"));

  const structParts = [section];
  const choiceKeys = Object.keys(parsed.choices).sort();
  const normalizedChoices = choiceKeys.map((k) => `${k}:${normalize(parsed.choices[k])}`);
  const choiceHash = simpleHash(normalizedChoices.join("|"));
  const patternSignature = simpleHash([section, String(choiceKeys.length), String(!!parsed.passage)].join("|"));

  return {
    textHash,
    structureHash: simpleHash(structParts.join("|")),
    choiceHash,
    patternSignature,
  };
}

function toStructuredContent(parsed: ParsedGeneration, _section: "RW" | "Math"): StructuredContent {
  return {
    passage: parsed.passage || "",
    question: parsed.question,
    choices: Object.values(parsed.choices).join(" "),
  };
}
