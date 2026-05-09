import { ParsedQuestion, RWQuestion } from "../parser/types";
import { DedupResult, StructuredContent } from "./types";
import { fingerprint } from "./fingerprint";
import { createFingerprintStore } from "./store";
import type { FingerprintStore } from "./types";

const DUPLICATE_THRESHOLD = 0.995;
const SIMILAR_THRESHOLD = 0.75;

function buildStructuredContent(q: ParsedQuestion): StructuredContent {
  const passage = q.section === "RW" ? (q as RWQuestion).passage || "" : "";
  const question = q.question;
  const choices = Object.keys(q.choices)
    .sort()
    .map((k) => q.choices[k])
    .join(" ");
  return { passage, question, choices };
}

export function dedupQuestion(
  q: ParsedQuestion,
  store: FingerprintStore
): DedupResult {
  const fp = fingerprint(q);
  const content = buildStructuredContent(q);
  const matches = store.findMatches(fp, content);

  const bestMatch = matches[0];

  if (!bestMatch) {
    return {
      status: "unique",
      fingerprint: fp,
      matches: [],
      reason: "No matches found against existing store",
    };
  }

  // Only reject on exact fingerprint or near-certainty
  if (bestMatch.matchType === "exact" || bestMatch.score >= DUPLICATE_THRESHOLD) {
    return {
      status: "duplicate",
      fingerprint: fp,
      matches,
      reason: `Duplicate detected: score ${bestMatch.score.toFixed(4)} with question ${bestMatch.questionId} (${bestMatch.matchType})`,
    };
  }

  // Similar → warning only, does NOT block insert
  if (bestMatch.score >= SIMILAR_THRESHOLD) {
    return {
      status: "similar",
      fingerprint: fp,
      matches,
      reason: `Similar question (warning only): score ${bestMatch.score.toFixed(4)} with question ${bestMatch.questionId}`,
    };
  }

  return {
    status: "unique",
    fingerprint: fp,
    matches,
    reason: "Below similarity threshold — considered unique",
  };
}

export function dedupQuestions(
  questions: ParsedQuestion[],
  existingStore?: FingerprintStore
): { results: DedupResult[]; store: FingerprintStore } {
  const store = existingStore ?? createFingerprintStore();

  const results: DedupResult[] = [];

  for (const q of questions) {
    const result = dedupQuestion(q, store);
    results.push(result);

    if (result.status === "unique") {
      store.add(q.questionId, result.fingerprint, buildStructuredContent(q));
    }
  }

  return { results, store };
}

export { createFingerprintStore };
