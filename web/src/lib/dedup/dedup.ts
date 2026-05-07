import { ParsedQuestion, RWQuestion } from "../parser/types";
import { DedupResult, DedupMatch, FingerprintStore } from "./types";
import { fingerprint } from "./fingerprint";
import { createFingerprintStore } from "./store";

const NEAR_THRESHOLD = 0.9;
const SIMILAR_THRESHOLD = 0.8;

function questionContentText(q: ParsedQuestion): string {
  const parts: string[] = [];
  if (q.section === "RW") {
    const rw = q as RWQuestion;
    if (rw.passage) parts.push(rw.passage);
  }
  parts.push(q.question);
  Object.keys(q.choices)
    .sort()
    .forEach((k) => parts.push(q.choices[k]));
  return parts.join(" ");
}

export function dedupQuestion(
  q: ParsedQuestion,
  store: FingerprintStore
): DedupResult {
  const fp = fingerprint(q);
  const content = questionContentText(q);
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

  if (bestMatch.matchType === "exact" || bestMatch.score >= NEAR_THRESHOLD) {
    return {
      status: "duplicate",
      fingerprint: fp,
      matches,
      reason: `Duplicate detected: score ${bestMatch.score.toFixed(2)} with question ${bestMatch.questionId} (${bestMatch.matchType})`,
    };
  }

  if (bestMatch.score >= SIMILAR_THRESHOLD) {
    return {
      status: "similar",
      fingerprint: fp,
      matches,
      reason: `Similar question detected: score ${bestMatch.score.toFixed(2)} with question ${bestMatch.questionId}`,
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
      store.add(q.questionId, result.fingerprint, questionContentText(q));
    }
  }

  return { results, store };
}

export { createFingerprintStore };
