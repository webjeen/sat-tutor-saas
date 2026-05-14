import type {
  TimingComplexity,
  SyntaxComplexity,
  AbstractionLevel,
  RWReasoningCategory,
} from "./types";

import { normalize } from "../dedup/fingerprint";

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export function countSentences(text: string): number {
  const matches = text.match(/[.!?]+/g);
  return matches ? matches.length : 1;
}

export function avgSentenceLength(text: string): number {
  const words = countWords(text);
  const sentences = countSentences(text);
  return sentences > 0 ? Math.round(words / sentences) : words;
}

const EXTREME_WORDS = [
  "always", "never", "only", "must", "impossible",
  "cannot", "every", "all", "none", "entirely",
  "completely", "absolutely", "undoubtedly", "inevitably",
];

export function hasExtremeLanguage(text: string): boolean {
  const lower = normalize(text);
  return EXTREME_WORDS.some((w) => lower.includes(w));
}

const MATH_NOTATION_PATTERNS = [
  /\b\d+[xy]\b/,
  /\bf\s*\(\s*x\s*\)/,
  /\bg\s*\(\s*x\s*\)/,
  /\b[a-z]\s*=\s*/,
  /\b[a-z]\^2\b/,
  /\bsqrt\b/,
  /\bfrac\b/,
  /√/,
  /²/,
  /±/,
  /≤|≥|≠/,
  /\|.*\|/,
  /\d+\s*[+\-*/]\s*\d+/,
];

export function containsMathNotation(text: string): boolean {
  return MATH_NOTATION_PATTERNS.some((p) => p.test(text));
}

export function countVariables(text: string): number {
  const varMatches = text.match(/\b[a-z]\b/g);
  if (!varMatches) return 0;
  const excluded = new Set(["a", "i", "x"]);
  return new Set(varMatches.filter((v) => !excluded.has(v))).size;
}

export function classifySyntaxComplexity(text: string): SyntaxComplexity {
  const avgLen = avgSentenceLength(text);
  const hasExtreme = hasExtremeLanguage(text);
  const wordCount = countWords(text);

  if (avgLen > 25 || (hasExtreme && wordCount > 50)) return "complex";
  if (avgLen > 15 || wordCount > 30) return "moderate";
  return "simple";
}

export function classifyTimingComplexity(
  wordCount: number,
  reasoningDepth: string
): TimingComplexity {
  const depthMultiplier =
    reasoningDepth === "multi_step" || reasoningDepth === "chained_reasoning"
      ? 1.5
      : reasoningDepth === "two_step"
        ? 1.2
        : 1;

  const effective = wordCount * depthMultiplier;

  if (effective > 150) return "extended";
  if (effective > 60) return "moderate";
  return "quick";
}

export function classifyAbstractionLevel(
  reasoningCategory: RWReasoningCategory | string
): AbstractionLevel {
  const abstractCategories = new Set([
    "inferential_reasoning",
    "rhetorical_analysis",
    "structural_analysis",
  ]);
  const moderateCategories = new Set([
    "textual_evidence",
    "vocabulary_in_context",
  ]);

  if (abstractCategories.has(reasoningCategory)) return "abstract";
  if (moderateCategories.has(reasoningCategory)) return "moderate";
  return "concrete";
}

const DISCOURSE_MARKERS = {
  contrast: [
    "however", "nevertheless", "although", "though", "yet", "but",
    "conversely", "on the other hand", "despite", "in contrast",
    "nonetheless", "whereas", "while",
  ],
  cause_effect: [
    "therefore", "consequently", "thus", "hence", "because",
    "as a result", "since", "so", "accordingly", "due to",
  ],
  addition: [
    "furthermore", "moreover", "additionally", "also", "in addition",
    "likewise", "similarly", "besides",
  ],
  sequence: [
    "first", "second", "third", "finally", "then", "next",
    "subsequently", "previously", "before", "after",
  ],
  example: [
    "for example", "for instance", "such as", "namely",
    "to illustrate", "in particular",
  ],
};

export function detectDiscourseMarkers(
  text: string
): Record<string, number> {
  const lower = normalize(text);
  const counts: Record<string, number> = {};

  for (const [category, markers] of Object.entries(DISCOURSE_MARKERS)) {
    counts[category] = 0;
    for (const marker of markers) {
      const regex = new RegExp(`\\b${marker}\\b`, "gi");
      const matches = lower.match(regex);
      if (matches) counts[category] += matches.length;
    }
  }

  return counts;
}

export function countParagraphs(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  const paragraphs = trimmed.split(/\n\s*\n/).filter(Boolean);
  return Math.max(paragraphs.length, 1);
}
