import { Fingerprint, DedupMatch, FingerprintStore } from "./types";
import { computeSimilarity, computeContentSimilarity } from "./similarity";

const EXACT_THRESHOLD = 1;
const NEAR_THRESHOLD = 0.9;
const SIMILAR_THRESHOLD = 0.8;
const CONTENT_NEAR_THRESHOLD = 0.9;
const CONTENT_SIMILAR_THRESHOLD = 0.8;

export function createFingerprintStore(): FingerprintStore {
  const store = new Map<string, Fingerprint>();
  const contentTexts = new Map<string, string>();

  return {
    add(questionId: string, fingerprint: Fingerprint, contentText?: string) {
      store.set(questionId, fingerprint);
      if (contentText) contentTexts.set(questionId, contentText);
    },

    findMatches(fp: Fingerprint, candidateContentText?: string): DedupMatch[] {
      const matches: DedupMatch[] = [];

      for (const [existingId, existingFp] of store) {
        const fingerprintScore = computeSimilarity(fp, existingFp);

        // Exact fingerprint match — definitive duplicate
        if (fingerprintScore >= EXACT_THRESHOLD) {
          matches.push({
            questionId: existingId,
            score: 1,
            matchType: "exact",
          });
          continue;
        }

        // For non-exact matches, use content-level Jaccard similarity
        const existingContent = contentTexts.get(existingId);
        if (candidateContentText && existingContent) {
          const contentScore = computeContentSimilarity(
            candidateContentText,
            existingContent
          );

          if (contentScore >= CONTENT_NEAR_THRESHOLD) {
            matches.push({
              questionId: existingId,
              score: contentScore,
              matchType: "near",
            });
          } else if (contentScore >= CONTENT_SIMILAR_THRESHOLD) {
            matches.push({
              questionId: existingId,
              score: contentScore,
              matchType: "similar",
            });
          }
        } else {
          // No content text available — fall back to fingerprint score
          if (fingerprintScore >= SIMILAR_THRESHOLD) {
            matches.push({
              questionId: existingId,
              score: fingerprintScore,
              matchType: "similar",
            });
          }
        }
      }

      return matches.sort((a, b) => b.score - a.score);
    },

    getAll() {
      return new Map(store);
    },
  };
}
