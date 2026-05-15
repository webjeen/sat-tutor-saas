import { NextRequest, NextResponse } from "next/server";
import { fetchGeneratedQuestionById } from "@/lib/supabase/fetchGeneratedQuestions";
import { validateStructure } from "@/lib/generation/validators/structureValidator";
import { detectLeakage } from "@/lib/generation/validators/leakageDetector";
import { scoreDifficulty } from "@/lib/generation/validators/difficultyScorer";
import { validateDistractors } from "@/lib/generation/validators/distractorValidator";
import { checkGenerationDedup } from "@/lib/generation/validators/generationDedup";
import { validateExplanationCoherence } from "@/lib/generation/validators/explanationCoherenceValidator";
import { validateSATStyle } from "@/lib/generation/validators/satStyleValidator";
import { checkAntiLeakSafeguards } from "@/lib/generation/antiLeakSafeguards";
import { scoreGeneration } from "@/lib/generation/generationScorer";
import { fetchTemplateById } from "@/lib/supabase/fetchTemplates";
import { saveValidationResult } from "@/lib/supabase/saveValidationResult";
import type { ParsedGeneration, AntiLeakSafeguardCheckResult, GenerationScoreCheckResult } from "@/lib/generation/types";
import { GENERATION_CONFIG } from "@/lib/generation/config";

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
  const difficulty = (question.mapped_level || "medium") as "easy" | "medium" | "hard";

  // Run all validators in parallel where possible
  const [structureResult, leakageResult, dedupResult, explanationCoherenceResult, satStyleResult] = await Promise.all([
    Promise.resolve(validateStructure(parsed, section, difficulty)),
    detectLeakage(parsed, section),
    checkGenerationDedup(parsed, section, question_id),
    Promise.resolve(validateExplanationCoherence(parsed, section)),
    Promise.resolve(validateSATStyle(parsed, section)),
  ]);

  let difficultyResult, distractorResult;
  if (question.template_id) {
    const { data: template } = await fetchTemplateById(question.template_id);
    if (template) {
      difficultyResult = scoreDifficulty(parsed, template.difficulty_parameters, difficulty, section);
      distractorResult = validateDistractors(parsed, template.distractor_strategy);
    }
  }

  if (!difficultyResult) {
    const existingFactors = question.difficulty_factors as Record<string, number>;
    difficultyResult = {
      result: "review" as const,
      difficultyScore: question.difficulty_score || 0,
      mappedLevel: difficulty,
      factors: {
        complexity: existingFactors?.complexity ?? 0,
        syntax: existingFactors?.syntax ?? 0,
        reasoning: existingFactors?.reasoning ?? 0,
        distractor: existingFactors?.distractor ?? 0,
        density: existingFactors?.density ?? 0,
        time: existingFactors?.time ?? 0,
        passageQuality: existingFactors?.passageQuality ?? 0,
        explanationDepth: existingFactors?.explanationDepth ?? 0,
        satMarkers: existingFactors?.satMarkers ?? 0,
      },
      targetBand: difficulty,
      mismatch: false,
    };
  }
  if (!distractorResult) {
    distractorResult = { result: "review" as const, distractorCount: 3, strategiesUsed: [], primaryPatternCovered: false, diversityScore: 0, perDistractor: [], crossDistractorSimilarity: { result: "pass" as const, similarPairs: [] }, distractorCorrectOverlap: { result: "pass" as const, overlappingDistractors: [] }, strategyConformance: { result: "pass" as const, nonConformingDistractors: [] } };
  }

  // Anti-leak safeguards
  const realQuestionTexts = await loadRealQuestionTexts(section);
  const antiLeakResult = checkAntiLeakSafeguards(parsed, realQuestionTexts);
  const antiLeakCheckResult: AntiLeakSafeguardCheckResult = {
    result: antiLeakResult.passed ? "pass" : (antiLeakResult.violations.some((v) => v.severity === "critical") ? "fail" : "review"),
    ngramOverlapScore: antiLeakResult.ngramOverlapScore,
    structuralLeakageScore: antiLeakResult.structuralLeakageScore,
    passageLeakageScore: antiLeakResult.passageLeakageScore,
    criticalViolations: antiLeakResult.violations.filter((v) => v.severity === "critical").length,
    warningViolations: antiLeakResult.violations.filter((v) => v.severity === "warning").length,
  };

  // Generation scoring
  const generationScore = scoreGeneration(
    parsed,
    { structure: structureResult, leakage: leakageResult, difficulty: difficultyResult, distractor: distractorResult, dedup: dedupResult, explanationCoherence: explanationCoherenceResult, satStyle: satStyleResult, antiLeakSafeguard: antiLeakCheckResult, generationScore: { result: "pass", overallScore: 0, failedMinimums: [] }, allPassed: false, failedChecks: [] },
    antiLeakResult,
    section,
    (question.category as import("@/lib/library/types").LibraryCategory),
    difficulty,
    question.template_id || ""
  );

  const generationScoreCheckResult: GenerationScoreCheckResult = {
    result: generationScore.overallScore >= GENERATION_CONFIG.scoring.minimumOverallScore ? "pass" : "review",
    overallScore: generationScore.overallScore,
    failedMinimums: generationScore.overallScore < GENERATION_CONFIG.scoring.minimumOverallScore ? ["overall"] : [],
  };

  const allPassed = structureResult.result === "pass"
    && leakageResult.result === "pass"
    && difficultyResult.result === "pass"
    && distractorResult.result === "pass"
    && dedupResult.result === "pass"
    && antiLeakCheckResult.result === "pass"
    && generationScoreCheckResult.result === "pass"
    && explanationCoherenceResult.result === "pass"
    && satStyleResult.result === "pass";

  const validation = {
    structure: structureResult,
    leakage: leakageResult,
    difficulty: difficultyResult,
    distractor: distractorResult,
    dedup: dedupResult,
    explanationCoherence: explanationCoherenceResult,
    satStyle: satStyleResult,
    antiLeakSafeguard: antiLeakCheckResult,
    generationScore: generationScoreCheckResult,
    allPassed,
    failedChecks: [
      ...(structureResult.result !== "pass" ? ["structure"] : []),
      ...(leakageResult.result !== "pass" ? ["leakage"] : []),
      ...(difficultyResult.result !== "pass" ? ["difficulty"] : []),
      ...(distractorResult.result !== "pass" ? ["distractor"] : []),
      ...(dedupResult.result !== "pass" ? ["dedup"] : []),
      ...(antiLeakCheckResult.result !== "pass" ? ["anti_leak_safeguard"] : []),
      ...(generationScoreCheckResult.result !== "pass" ? ["generation_score"] : []),
      ...(explanationCoherenceResult.result !== "pass" ? ["explanation_coherence"] : []),
      ...(satStyleResult.result !== "pass" ? ["sat_style"] : []),
    ],
  };

  const checkSummary = `structure:${structureResult.result},leakage:${leakageResult.result},difficulty:${difficultyResult.result},distractor:${distractorResult.result},dedup:${dedupResult.result},anti_leak:${antiLeakCheckResult.result},gen_score:${generationScoreCheckResult.result},explanation:${explanationCoherenceResult.result},sat_style:${satStyleResult.result}`;

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
    decision_reason: allPassed ? "All checks passed" : `Failed: [${validation.failedChecks.join(", ")}] [${checkSummary}]`,
    status: "validation_complete",
  });

  return NextResponse.json({ validation });
}

async function loadRealQuestionTexts(
  section: "RW" | "Math"
): Promise<{ id: string; passage: string; question: string; choices: string }[]> {
  try {
    const { supabase } = await import("@/lib/supabase/client");
    const { data } = await supabase
      .from("real_questions")
      .select("id, raw_passage, raw_question, choice_a, choice_b, choice_c, choice_d")
      .eq("section", section)
      .in("parsing_status", ["validation_passed", "approved", "parsed"]);

    if (!data) return [];

    return data.map((rq: Record<string, unknown>) => ({
      id: rq.id as string,
      passage: (rq.raw_passage as string) || "",
      question: (rq.raw_question as string) || "",
      choices: [rq.choice_a, rq.choice_b, rq.choice_c, rq.choice_d].filter(Boolean).join(" "),
    }));
  } catch {
    return [];
  }
}
