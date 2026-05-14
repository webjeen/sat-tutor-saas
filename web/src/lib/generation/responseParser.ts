import type { ParsedGeneration, ParseError } from "./types";

export function parseResponse(rawText: string): { data: ParsedGeneration | null; error: ParseError | null } {
  let json: Record<string, unknown>;

  try {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { data: null, error: { stage: "json_parse", message: "No JSON object found in response", rawText } };
    }
    json = JSON.parse(jsonMatch[0]);
  } catch (e) {
    return { data: null, error: { stage: "json_parse", message: `JSON parse error: ${e instanceof Error ? e.message : "unknown"}`, rawText } };
  }

  const question = extractString(json, ["question", "question_text", "stem"]);
  if (!question) {
    return { data: null, error: { stage: "field_validation", message: "Missing required field: question", rawText } };
  }

  const choices = extractChoices(json);
  if (!choices) {
    return { data: null, error: { stage: "choice_validation", message: "Missing or invalid choices (need A-D)", rawText } };
  }

  const correctChoice = extractString(json, ["correct_choice", "correct_answer", "answer"]);
  if (!correctChoice || !["A", "B", "C", "D"].includes(correctChoice.toUpperCase())) {
    return { data: null, error: { stage: "choice_validation", message: "Missing or invalid correct_choice (must be A/B/C/D)", rawText } };
  }

  const passage = extractString(json, ["passage", "passage_text"]) || null;
  const tutorExplanation = extractString(json, ["tutor_explanation", "explanation", "detailed_explanation"]) || "";
  const studentExplanation = extractString(json, ["student_explanation", "simple_explanation"]) || "";

  const distractorStrategies = extractDistractorStrategies(json);
  const reasoningTrace = extractReasoningTrace(json);

  return {
    data: {
      passage,
      question,
      choices,
      correctChoice: correctChoice.toUpperCase(),
      tutorExplanation,
      studentExplanation,
      distractorStrategies,
      reasoningTrace,
    },
    error: null,
  };
}

function extractString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === "string" && val.trim().length > 0) {
      return val.trim();
    }
  }
  return null;
}

function extractChoices(json: Record<string, unknown>): Record<string, string> | null {
  const choicesData = json["choices"];
  if (!choicesData || typeof choicesData !== "object") return null;

  const choices: Record<string, string> = {};
  const choiceObj = choicesData as Record<string, unknown>;

  for (const key of ["A", "B", "C", "D"]) {
    const val = choiceObj[key];
    if (typeof val === "string" && val.trim().length > 0) {
      choices[key] = val.trim();
    }
  }

  if (Object.keys(choices).length !== 4) return null;
  return choices;
}

function extractDistractorStrategies(json: Record<string, unknown>): Record<string, string | null> {
  const strategies: Record<string, string | null> = {};
  const data = json["distractor_strategies"];
  if (!data || typeof data !== "object") return strategies;

  const obj = data as Record<string, unknown>;
  for (const key of ["A", "B", "C", "D"]) {
    const val = obj[key];
    strategies[key] = typeof val === "string" ? val : null;
  }
  return strategies;
}

function extractReasoningTrace(json: Record<string, unknown>): { step: number; name: string; description: string }[] {
  const data = json["reasoning_trace"];
  if (!Array.isArray(data)) return [];

  return data
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item, i) => ({
      step: typeof item["step"] === "number" ? item["step"] : i + 1,
      name: typeof item["name"] === "string" ? item["name"] : `step_${i + 1}`,
      description: typeof item["description"] === "string" ? item["description"] : "",
      guidance: typeof item["guidance"] === "string" ? item["guidance"] : "",
    }));
}
