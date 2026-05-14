import { NextRequest, NextResponse } from "next/server";
import { fetchGeneratedQuestionById } from "@/lib/supabase/fetchGeneratedQuestions";
import { validateStructure } from "@/lib/generation/validators/structureValidator";
import { detectLeakage } from "@/lib/generation/validators/leakageDetector";
import { scoreDifficulty } from "@/lib/generation/validators/difficultyScorer";
import { validateDistractors } from "@/lib/generation/validators/distractorValidator";
import { checkGenerationDedup } from "@/lib/generation/validators/generationDedup";
import { fetchTemplateById } from "@/lib/supabase/fetchTemplates";
import { saveValidationResult } from "@/lib/supabase/saveValidationResult";
import type { ParsedGeneration } from "@/lib/generation/types";

export async function POST(request: NextRequest) {
  let body: { question_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { question_id } = body;
  if (!question_id) {
    return NextResponse.json({ error: "Missing required field: question_id" }, { status: 400 });
  }

  const { data: question, error: fetchError } = await fetchGeneratedQuestionById(question_id);
  if (fetchError || !question) {
    return NextResponse.json({ error: fetchError || "Question not found" }, { status: 404 });
  }

  const parsed: ParsedGeneration = {
    passage: question.generated_passage,
    question: question.generated_question,
    choices: {
      A: question.choice_a || "",
      B: question.choice_b || "",
      C: question.choice_c || "",
      D: question.choice_d || "",
    },
    correctChoice: question.correct_choice,
    tutorExplanation: question.tutor_explanation || "",
    studentExplanation: question.student_explanation || "",
    distractorStrategies: (question.distractor_analysis as Record<string, string | null>)?.perDistractor
      ? Object.fromEntries(
          ((question.distractor_analysis as Record<string, unknown>).perDistractor as { label: string; strategy: string | null }[]).map((d) => [d.label, d.strategy])
        )
      : {},
    reasoningTrace: question.reasoning_trace || [],
  };

  const section = question.section as "RW" | "Math";

  const [structureResult, leakageResult, dedupResult] = await Promise.all([
    Promise.resolve(validateStructure(parsed, section)),
    detectLeakage(parsed, section),
    checkGenerationDedup(parsed, section, question_id),
  ]);

  let difficultyResult, distractorResult;
  if (question.template_id) {
    const { data: template } = await fetchTemplateById(question.template_id);
    if (template) {
      difficultyResult = scoreDifficulty(parsed, template.difficulty_parameters, (question.mapped_level || "medium") as "easy" | "medium" | "hard");
      distractorResult = validateDistractors(parsed, template.distractor_strategy);
    }
  }

  if (!difficultyResult) {
    difficultyResult = { result: "review", difficultyScore: question.difficulty_score || 0, mappedLevel: (question.mapped_level || "medium") as "easy" | "medium" | "hard", factors: question.difficulty_factors as Record<string, number>, targetBand: question.mapped_level || "medium", mismatch: false };
  }
  if (!distractorResult) {
    distractorResult = { result: "review", distractorCount: 3, strategiesUsed: [], primaryPatternCovered: false, diversityScore: 0, perDistractor: [] };
  }

  const allPassed = structureResult.result === "pass" && leakageResult.result === "pass" && difficultyResult.result === "pass" && distractorResult.result === "pass" && dedupResult.result === "pass";

  const validation = {
    structure: structureResult,
    leakage: leakageResult,
    difficulty: difficultyResult,
    distractor: distractorResult,
    dedup: dedupResult,
    allPassed,
    failedChecks: [
      ...(structureResult.result !== "pass" ? ["structure"] : []),
      ...(leakageResult.result !== "pass" ? ["leakage"] : []),
      ...(difficultyResult.result !== "pass" ? ["difficulty"] : []),
      ...(distractorResult.result !== "pass" ? ["distractor"] : []),
      ...(dedupResult.result !== "pass" ? ["dedup"] : []),
    ],
  };

  await saveValidationResult({
    generated_question_id: question_id,
    generation_log_id: null,
    template_id: question.template_id,
    leak_check_result: leakageResult.result,
    leak_check_score: leakageResult.maxSimilarity,
    duplicate_check_result: dedupResult.result,
    duplicate_check_score: Math.max(dedupResult.maxRealSimilarity, dedupResult.maxGeneratedSimilarity),
    structure_check_result: structureResult.result,
    difficulty_check_result: difficultyResult.result,
    distractor_check_result: distractorResult.result,
    difficulty_score: difficultyResult.difficultyScore,
    mapped_level: difficultyResult.mappedLevel,
    all_checks_passed: allPassed,
    decision: allPassed ? "approve" : "regenerate",
    decision_reason: allPassed ? "All checks passed" : `Failed: [${validation.failedChecks.join(", ")}]`,
    status: "validation_complete",
  });

  return NextResponse.json({ validation });
}
