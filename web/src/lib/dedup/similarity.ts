import { Fingerprint } from "./types";
import { normalize } from "./fingerprint";

export function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(a.split(" ").filter(Boolean));
  const setB = new Set(b.split(" ").filter(Boolean));

  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const word of setA) {
    if (setB.has(word)) intersection++;
  }

  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function textSimilarity(a: Fingerprint, b: Fingerprint): number {
  if (a.textHash === b.textHash) return 1;
  return 0;
}

export function structureSimilarity(a: Fingerprint, b: Fingerprint): number {
  let score = 0;
  let weight = 0;

  if (a.structureHash === b.structureHash) {
    score += 0.5;
  }
  weight += 0.5;

  if (a.patternSignature === b.patternSignature) {
    score += 0.3;
  }
  weight += 0.3;

  if (a.choiceHash === b.choiceHash) {
    score += 0.2;
  }
  weight += 0.2;

  return weight > 0 ? score / weight : 0;
}

export function computeSimilarity(a: Fingerprint, b: Fingerprint): number {
  const textScore = textSimilarity(a, b);
  if (textScore >= 1) return 1;

  const structScore = structureSimilarity(a, b);
  return 0.6 * textScore + 0.4 * structScore;
}

export function computeContentSimilarity(
  textA: string,
  textB: string
): number {
  return jaccardSimilarity(normalize(textA), normalize(textB));
}
