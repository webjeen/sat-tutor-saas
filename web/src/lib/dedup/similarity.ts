import { Fingerprint, StructuredContent } from "./types";

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

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const SAT_BOILERPLATE = [
  "which choice best",
  "which choice most",
  "which choice provides",
  "which choice describes",
  "which choice explains",
  "which choice completes",
  "which choice reflects",
  "which choice indicates",
  "which choice suggests",
  "which choice states",
  "based on the passage",
  "based on the text",
  "according to the passage",
  "according to the text",
  "as used in the passage",
  "as used in the text",
  "as used in line",
  "in context",
  "most nearly means",
  "most nearly",
  "the author",
  "the passage suggests",
  "the passage implies",
  "the passage indicates",
  "the text suggests",
  "the text implies",
  "the main idea",
  "the primary purpose",
  "the main purpose",
  "the passage primarily",
  "the text primarily",
  "is best supported",
  "is most strongly supported",
  "best illustrates",
  "best exemplifies",
  "best summarizes",
  "best represents",
  "best interprets",
  "closest in meaning",
];

const BOILERPLATE_NORMALIZED = SAT_BOILERPLATE.map(normalize);

function stripBoilerplate(text: string): string {
  let result = normalize(text);
  for (const phrase of BOILERPLATE_NORMALIZED) {
    result = result.replace(phrase, "");
  }
  return result.replace(/\s+/g, " ").trim();
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

export function computeWeightedContentSimilarity(
  a: StructuredContent,
  b: StructuredContent
): number {
  const qA = stripBoilerplate(a.question);
  const qB = stripBoilerplate(b.question);
  const cA = normalize(a.choices);
  const cB = normalize(b.choices);
  const pA = normalize(a.passage);
  const pB = normalize(b.passage);

  const questionScore = jaccardSimilarity(qA, qB);
  const choiceScore = jaccardSimilarity(cA, cB);
  const passageScore = jaccardSimilarity(pA, pB);

  const bothHavePassages = a.passage.length > 0 && b.passage.length > 0;

  if (bothHavePassages) {
    // Shared passage is normal context, not a duplicate signal.
    // Choices + specific question wording differentiate questions.
    return 0.15 * passageScore + 0.30 * questionScore + 0.55 * choiceScore;
  }

  // No passage (Math or short RW)
  return 0.45 * questionScore + 0.55 * choiceScore;
}

export function computeContentSimilarity(
  textA: string,
  textB: string
): number {
  return jaccardSimilarity(normalize(textA), normalize(textB));
}
