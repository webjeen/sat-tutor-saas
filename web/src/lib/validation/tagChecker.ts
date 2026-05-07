import { TagCheckResult } from "./types";

const VALID_TAGS = [
  "QUESTION_START",
  "QUESTION_END",
  "PASSAGE",
  "QUESTION",
  "CHOICES",
  "ANSWER",
  "ANSWER_EXPLANATION",
  "GRAPH",
  "FORMULA",
  "UNCLEAR",
];

const TAG_RE = /\[([A-Z_]+)\]/g;

export function checkTags(rawBlock: string): TagCheckResult {
  const malformedTags: string[] = [];
  const found = new Set<string>();

  let match: RegExpExecArray | null;
  while ((match = TAG_RE.exec(rawBlock)) !== null) {
    const tag = match[1];
    found.add(tag);
    if (!VALID_TAGS.includes(tag)) {
      malformedTags.push(tag);
    }
  }

  const requiredTags = ["QUESTION"];
  const missingRequiredTags = requiredTags.filter((t) => !found.has(t));

  return { malformedTags, missingRequiredTags };
}
