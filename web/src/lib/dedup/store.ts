import { Fingerprint, DedupMatch, FingerprintStore, StructuredContent } from "./types";
import { computeSimilarity, computeWeightedContentSimilarity } from "./similarity";

const EXACT_THRESHOLD = 1;
// Corpus-building: only reject on exact fingerprint match or near-certainty
const NEAR_THRESHOLD = 0.995;
const SIMILAR_THRESHOLD = 0.75;

export function createFingerprintStore(): FingerprintStore {
  const store = new Map<string, Fingerprint>();
  const contentMap = new Map<string, StructuredContent>();

  return {
    add(questionId: string, fingerprint: Fingerprint, content?: StructuredContent) {
      store.set(questionId, fingerprint);
      if (content) contentMap.set(questionId, content);
    },

    findMatches(fp: Fingerprint, candidateContent?: StructuredContent): DedupMatch[] {
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

        // For non-exact matches, use weighted content similarity
        const existingContent = contentMap.get(existingId);
        if (candidateContent && existingContent) {
          const contentScore = computeWeightedContentSimilarity(
            candidateContent,
            existingContent
          );

          if (contentScore >= NEAR_THRESHOLD) {
            matches.push({
              questionId: existingId,
              score: contentScore,
              matchType: "near",
            });
          } else if (contentScore >= SIMILAR_THRESHOLD) {
            matches.push({
              questionId: existingId,
              score: contentScore,
              matchType: "similar",
            });
          }
        } else {
          // No content available — fall back to fingerprint score
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
