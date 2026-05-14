import type {
  AntiLeakSafeguardResult,
  AntiLeakViolation,
} from "./types";
import type { ParsedGeneration } from "./types";
import { normalize, simpleHash } from "../dedup/fingerprint";

// N-gram sizes to check
const NGRAM_SIZES = [3, 4, 5];

// Thresholds for anti-leak safeguard checks
const NGRAM_OVERLAP_CRITICAL = 0.30;
const NGRAM_OVERLAP_WARNING = 0.20;
const STRUCTURAL_LEAK_CRITICAL = 0.85;
const STRUCTURAL_LEAK_WARNING = 0.70;
const PASSAGE_LEAK_CRITICAL = 0.25;
const PASSAGE_LEAK_WARNING = 0.15;

// Prompt-level anti-reconstruction rules injected into every generation call
const ANTI_RECONSTRUCTION_PROMPT_RULES = [
  "You must NOT reconstruct or approximate any real SAT question text",
  "If you recognize a topic from an actual SAT exam, you MUST create entirely new content on that topic",
  "Do not use memorized phrasing from any standardized test material",
  "Your passage must be structurally distinct from any real SAT passage — different argument structure, different evidence, different conclusion",
  "Question stems must use original syntactic patterns — never mirror real SAT question wording",
  "Correct answers must be defensible purely from your generated passage, not from any external knowledge of SAT content",
  "If any part of your generation resembles a real SAT question, discard that portion and regenerate from scratch",
];

export function getAntiReconstructionPromptRules(): string[] {
  return ANTI_RECONSTRUCTION_PROMPT_RULES;
}

export function checkAntiLeakSafeguards(
  parsed: ParsedGeneration,
  realQuestionTexts: { id: string; passage: string; question: string; choices: string }[]
): AntiLeakSafeguardResult {
  const violations: AntiLeakViolation[] = [];

  // 1. N-gram overlap detection
  const ngramOverlapScore = checkNgramOverlap(parsed, realQuestionTexts, violations);

  // 2. Structural leakage detection
  const structuralLeakageScore = checkStructuralLeakage(parsed, realQuestionTexts, violations);

  // 3. Passage-level leakage detection (RW only)
  const passageLeakageScore = parsed.passage
    ? checkPassageLeakage(parsed.passage, realQuestionTexts, violations)
    : 0;

  const passed = violations.every((v) => v.severity !== "critical")
    && ngramOverlapScore < NGRAM_OVERLAP_CRITICAL
    && structuralLeakageScore < STRUCTURAL_LEAK_CRITICAL
    && passageLeakageScore < PASSAGE_LEAK_CRITICAL;

  return {
    ngramOverlapScore: Math.round(ngramOverlapScore * 10000) / 10000,
    structuralLeakageScore: Math.round(structuralLeakageScore * 10000) / 10000,
    passageLeakageScore: Math.round(passageLeakageScore * 10000) / 10000,
    passed,
    violations,
    promptRules: ANTI_RECONSTRUCTION_PROMPT_RULES,
  };
}

function checkNgramOverlap(
  parsed: ParsedGeneration,
  realQuestions: { id: string; passage: string; question: string; choices: string }[],
  violations: AntiLeakViolation[]
): number {
  const generatedTexts = [
    parsed.question,
    ...Object.values(parsed.choices),
    parsed.passage || "",
  ].filter((t) => t.length > 0);

  let maxOverlap = 0;

  for (const rq of realQuestions) {
    const realTexts = [rq.question, rq.choices, rq.passage].filter((t) => t.length > 0);

    for (const genText of generatedTexts) {
      for (const realText of realTexts) {
        for (const n of NGRAM_SIZES) {
          const overlap = computeNgramOverlap(genText, realText, n);
          if (overlap > maxOverlap) {
            maxOverlap = overlap;
          }

          if (overlap >= NGRAM_OVERLAP_CRITICAL) {
            violations.push({
              type: "ngram_overlap",
              severity: "critical",
              description: `${n}-gram overlap ${Math.round(overlap * 100)}% with real question ${rq.id}`,
              matchedText: genText.substring(0, 80),
              source: "real_question",
            });
          } else if (overlap >= NGRAM_OVERLAP_WARNING) {
            violations.push({
              type: "ngram_overlap",
              severity: "warning",
              description: `${n}-gram overlap ${Math.round(overlap * 100)}% with real question ${rq.id}`,
              matchedText: genText.substring(0, 80),
              source: "real_question",
            });
          }
        }
      }
    }
  }

  return maxOverlap;
}

function checkStructuralLeakage(
  parsed: ParsedGeneration,
  realQuestions: { id: string; passage: string; question: string; choices: string }[],
  violations: AntiLeakViolation[]
): number {
  const genStructure = extractStructure(parsed);
  let maxSimilarity = 0;

  for (const rq of realQuestions) {
    const realStructure = extractRealStructure(rq);
    const similarity = computeStructureSimilarity(genStructure, realStructure);

    if (similarity > maxSimilarity) {
      maxSimilarity = similarity;
    }

    if (similarity >= STRUCTURAL_LEAK_CRITICAL) {
      violations.push({
        type: "structural_leakage",
        severity: "critical",
        description: `Structural similarity ${Math.round(similarity * 100)}% with real question ${rq.id}`,
        matchedText: `structure:${genStructure.pattern}`,
        source: "real_question",
      });
    } else if (similarity >= STRUCTURAL_LEAK_WARNING) {
      violations.push({
        type: "structural_leakage",
        severity: "warning",
        description: `Structural similarity ${Math.round(similarity * 100)}% with real question ${rq.id}`,
        matchedText: `structure:${genStructure.pattern}`,
        source: "real_question",
      });
    }
  }

  return maxSimilarity;
}

function checkPassageLeakage(
  passage: string,
  realQuestions: { id: string; passage: string; question: string; choices: string }[],
  violations: AntiLeakViolation[]
): number {
  const passageNgrams = new Set(extractNgrams(passage, 4));
  if (passageNgrams.size === 0) return 0;

  let maxOverlap = 0;

  for (const rq of realQuestions) {
    if (!rq.passage) continue;
    const realNgrams = new Set(extractNgrams(rq.passage, 4));
    if (realNgrams.size === 0) continue;

    let overlap = 0;
    for (const ng of passageNgrams) {
      if (realNgrams.has(ng)) overlap++;
    }

    const ratio = overlap / Math.min(passageNgrams.size, realNgrams.size);
    if (ratio > maxOverlap) maxOverlap = ratio;

    if (ratio >= PASSAGE_LEAK_CRITICAL) {
      violations.push({
        type: "passage_leakage",
        severity: "critical",
        description: `Passage 4-gram overlap ${Math.round(ratio * 100)}% with real question ${rq.id}`,
        matchedText: passage.substring(0, 80),
        source: "real_question",
      });
    } else if (ratio >= PASSAGE_LEAK_WARNING) {
      violations.push({
        type: "passage_leakage",
        severity: "warning",
        description: `Passage 4-gram overlap ${Math.round(ratio * 100)}% with real question ${rq.id}`,
        matchedText: passage.substring(0, 80),
        source: "real_question",
      });
    }
  }

  return maxOverlap;
}

// -- Utility functions --

function computeNgramOverlap(textA: string, textB: string, n: number): number {
  const ngramsA = new Set(extractNgrams(textA, n));
  const ngramsB = new Set(extractNgrams(textB, n));

  if (ngramsA.size === 0 || ngramsB.size === 0) return 0;

  let overlap = 0;
  for (const ng of ngramsA) {
    if (ngramsB.has(ng)) overlap++;
  }

  return overlap / Math.min(ngramsA.size, ngramsB.size);
}

function extractNgrams(text: string, n: number): string[] {
  const words = normalize(text).split(/\s+/).filter((w) => w.length > 0);
  if (words.length < n) return [];

  const ngrams: string[] = [];
  for (let i = 0; i <= words.length - n; i++) {
    ngrams.push(words.slice(i, i + n).join(" "));
  }
  return ngrams;
}

interface StructureProfile {
  pattern: string;
  choiceCount: number;
  hasPassage: boolean;
  questionLength: number;
  avgChoiceLength: number;
  sentenceCount: number;
}

function extractStructure(parsed: ParsedGeneration): StructureProfile {
  const choiceValues = Object.values(parsed.choices);
  const avgChoiceLength = choiceValues.length > 0
    ? choiceValues.reduce((sum, c) => sum + c.length, 0) / choiceValues.length
    : 0;

  const sentenceCount = parsed.question.split(/[.!?]+/).filter((s) => s.trim().length > 0).length;

  return {
    pattern: simpleHash([
      String(!!parsed.passage),
      String(choiceValues.length),
      String(sentenceCount),
    ].join("|")),
    choiceCount: choiceValues.length,
    hasPassage: !!parsed.passage,
    questionLength: parsed.question.length,
    avgChoiceLength: Math.round(avgChoiceLength),
    sentenceCount,
  };
}

function extractRealStructure(rq: { passage: string; question: string; choices: string }): StructureProfile {
  const sentenceCount = rq.question.split(/[.!?]+/).filter((s) => s.trim().length > 0).length;

  return {
    pattern: simpleHash([
      String(!!rq.passage),
      String(rq.choices.split(/\s+/).length > 10),
      String(sentenceCount),
    ].join("|")),
    choiceCount: 4,
    hasPassage: !!rq.passage,
    questionLength: rq.question.length,
    avgChoiceLength: rq.choices.length / 4,
    sentenceCount,
  };
}

function computeStructureSimilarity(a: StructureProfile, b: StructureProfile): number {
  let matches = 0;
  let total = 0;

  if (a.hasPassage === b.hasPassage) matches++; total++;
  if (a.choiceCount === b.choiceCount) matches++; total++;
  if (Math.abs(a.sentenceCount - b.sentenceCount) <= 1) matches++; total++;

  const lenDiff = Math.abs(a.questionLength - b.questionLength);
  const maxLen = Math.max(a.questionLength, b.questionLength);
  if (maxLen > 0 && lenDiff / maxLen < 0.3) matches++;
  total++;

  const choiceDiff = Math.abs(a.avgChoiceLength - b.avgChoiceLength);
  const maxChoice = Math.max(a.avgChoiceLength, b.avgChoiceLength);
  if (maxChoice > 0 && choiceDiff / maxChoice < 0.3) matches++;
  total++;

  return total > 0 ? matches / total : 0;
}

export function formatAntiLeakSafeguardResult(result: AntiLeakSafeguardResult): string {
  const lines: string[] = [];
  lines.push(`Anti-leak safeguards: ${result.passed ? "PASSED" : "FAILED"}`);
  lines.push(`  N-gram overlap: ${result.ngramOverlapScore}`);
  lines.push(`  Structural leakage: ${result.structuralLeakageScore}`);
  lines.push(`  Passage leakage: ${result.passageLeakageScore}`);

  if (result.violations.length > 0) {
    lines.push(`  Violations (${result.violations.length}):`);
    for (const v of result.violations) {
      lines.push(`    [${v.severity}] ${v.type}: ${v.description}`);
    }
  }

  return lines.join("\n");
}
