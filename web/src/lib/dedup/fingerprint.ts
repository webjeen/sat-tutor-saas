import { ParsedQuestion, RWQuestion, MathQuestion } from "../parser/types";
import { Fingerprint } from "./types";

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function simpleHash(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h = ((h << 5) - h + c) | 0;
  }
  return (h >>> 0).toString(36);
}

function hashText(q: ParsedQuestion): string {
  const parts: string[] = [];

  if (q.section === "RW") {
    const rw = q as RWQuestion;
    if (rw.passage) parts.push(normalize(rw.passage));
  }

  parts.push(normalize(q.question));

  return simpleHash(parts.join("|"));
}

function hashStructure(q: ParsedQuestion): string {
  const parts: string[] = [
    q.section,
    q.questionType || "",
    String(q.module),
  ];

  if (q.section === "Math") {
    const math = q as MathQuestion;
    if (math.formula) parts.push(normalize(math.formula));
  }

  return simpleHash(parts.join("|"));
}

function hashChoices(q: ParsedQuestion): string {
  const keys = Object.keys(q.choices).sort();
  const normalized = keys.map((k) => `${k}:${normalize(q.choices[k])}`);
  return simpleHash(normalized.join("|"));
}

function buildPatternSignature(q: ParsedQuestion): string {
  const parts: string[] = [
    q.section,
    q.questionType || "",
    String(Object.keys(q.choices).length),
  ];

  if (q.section === "RW") {
    const rw = q as RWQuestion;
    parts.push(String(rw.passage.length > 0));
  }

  if (q.section === "Math") {
    const math = q as MathQuestion;
    parts.push(String(math.graph.length > 0));
    parts.push(String(math.formula.length > 0));
  }

  return simpleHash(parts.join("|"));
}

export function fingerprint(q: ParsedQuestion): Fingerprint {
  return {
    textHash: hashText(q),
    structureHash: hashStructure(q),
    choiceHash: hashChoices(q),
    patternSignature: buildPatternSignature(q),
  };
}

export { normalize, simpleHash };
