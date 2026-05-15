import type {
  GenerationJobConfig,
  GenerationResult,
  QuestionGenerationResult,
  GenerationValidationResult,
  GeneratedQuestion,
  GenerationStage,
  AntiLeakSafeguardCheckResult,
  GenerationScoreCheckResult,
} from "./types";
import type { Section, LibraryCategory } from "../library/types";
import { GENERATION_CONFIG } from "./config";
import { resolveTemplates } from "./templateResolver";
import { buildEnhancedPrompt } from "./promptBuilder";
import { callLLM } from "./llmClient";
import { parseResponse } from "./responseParser";
import { validateStructure } from "./validators/structureValidator";
import { detectLeakage, clearLeakageCache } from "./validators/leakageDetector";
import { scoreDifficulty } from "./validators/difficultyScorer";
import { validateDistractors } from "./validators/distractorValidator";
import { checkGenerationDedup, checkIntraBatchDedup, clearDedupCaches } from "./validators/generationDedup";
import { validateExplanationCoherence } from "./validators/explanationCoherenceValidator";
import { validateSATStyle } from "./validators/satStyleValidator";
import { decideGenerationAction } from "./decisionEngine";
import { checkAntiLeakSafeguards } from "./antiLeakSafeguards";
import { scoreGeneration, formatScoreForLog } from "./generationScorer";
import { saveGenerationJob, updateGenerationJob } from "../supabase/saveGenerationJob";
import { saveGeneratedQuestion } from "../supabase/saveGeneratedQuestion";
import { saveGenerationLog } from "../supabase/saveGenerationLog";
import { saveValidationResult } from "../supabase/saveValidationResult";
import type { Fingerprint, StructuredContent } from "../dedup/types";

export interface BatchContext {
  fingerprints: { id: string; fingerprint: Fingerprint; content: StructuredContent }[];
  recentCorrectPositions: string[];
}

export async function runGenerationPipeline(
  config: GenerationJobConfig,
  batchContext?: BatchContext
): Promise<GenerationResult> {
  const { section, category, difficulty, count } = config;
  const errors: string[] = [];
  const results: QuestionGenerationResult[] = [];

  // 1. Create generation job
  const { id: jobId, error: jobError } = await saveGenerationJob({
    template_id: config.templateId || null,
    section,
    category,
    difficulty_target: difficulty,
    question_count_requested: count,
    question_count_generated: 0,
    question_count_approved: 0,
    status: "processing",
    processing_stage: "resolve_template",
    retry_count: 0,
    error_message: null,
    last_processed_at: new Date().toISOString(),
    started_at: new Date().toISOString(),
    completed_at: null,
  });

  if (jobError || !jobId) {
    return {
      jobId: "",
      totalRequested: count,
      totalGenerated: 0,
      totalApproved: 0,
      results: [],
      errors: [`Failed to create generation job: ${jobError}`],
    };
  }

  // 2. Resolve templates
  const { templates, error: resolveError } = await resolveTemplates(config);
  if (resolveError || templates.length === 0) {
    await updateGenerationJob(jobId, {
      status: "failed",
      error_message: resolveError || "No templates available",
      completed_at: new Date().toISOString(),
    });
    return {
      jobId,
      totalRequested: count,
      totalGenerated: 0,
      totalApproved: 0,
      results: [],
      errors: [resolveError || "No templates available"],
    };
  }

  await logStage(jobId, null, templates[0].template.id, section, category, "resolve_template", "success", null);

  const templateIds = templates.map((t) => t.template.id);
  let currentTemplateIndex = 0;
  let totalGenerated = 0;
  let totalApproved = 0;

  // 3. Generate each question
  for (let i = 0; i < count; i++) {
    let retryCount = 0;
    let questionResult: QuestionGenerationResult | null = null;

    while (retryCount < GENERATION_CONFIG.pipeline.maxRetriesPerQuestion) {
      const resolved = templates[currentTemplateIndex % templates.length];

      try {
        questionResult = await generateSingleQuestion(
          jobId,
          resolved,
          section,
          category,
          difficulty,
          retryCount,
          batchContext
        );

        if (questionResult.decision.action === "approve" || questionResult.decision.action === "review" || questionResult.decision.action === "discard") {
          break;
        }

        // regenerate — rotate template
        if (questionResult.decision.suggestedTemplateId) {
          const nextIdx = templateIds.indexOf(questionResult.decision.suggestedTemplateId);
          if (nextIdx >= 0) currentTemplateIndex = nextIdx;
          else currentTemplateIndex = (currentTemplateIndex + 1) % templates.length;
        } else {
          currentTemplateIndex = (currentTemplateIndex + 1) % templates.length;
        }

        retryCount++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        errors.push(`Question ${i + 1} attempt ${retryCount + 1}: ${msg}`);
        await logStage(jobId, null, resolved.template.id, section, category, "llm_call", "failed", msg);
        retryCount++;
      }
    }

    if (questionResult) {
      results.push(questionResult);
      if (questionResult.question) totalGenerated++;
      if (questionResult.question && questionResult.question.approved_for_release) totalApproved++;
    } else {
      results.push({
        question: null,
        validation: emptyValidation(),
        decision: { action: "discard", reason: "Max retries exceeded", failedChecks: [], retryCount, suggestedTemplateId: null },
        logs: [`Question ${i + 1}: failed after ${retryCount} retries`],
      });
    }
  }

  // 4. Update job
  await updateGenerationJob(jobId, {
    question_count_generated: totalGenerated,
    question_count_approved: totalApproved,
    status: totalApproved > 0 ? "success" : "failed",
    completed_at: new Date().toISOString(),
    processing_stage: "complete",
  });

  // 5. Clear caches
  clearLeakageCache();
  clearDedupCaches();

  return {
    jobId,
    totalRequested: count,
    totalGenerated,
    totalApproved,
    results,
    errors,
  };
}

async function generateSingleQuestion(
  jobId: string,
  resolved: { template: { id: string; section: Section; category: string; difficulty_parameters: import("../library/types").DifficultyParameters; distractor_strategy: import("../library/types").DistractorGenerationStrategy }; distractorCatalogEntries: import("./types").DistractorCatalogEntry[]; reasoningFlowSteps: import("../library/types").ReasoningStep[] },
  section: Section,
  category: LibraryCategory,
  difficulty: "easy" | "medium" | "hard",
  retryCount: number,
  batchContext?: BatchContext
): Promise<QuestionGenerationResult> {
  const logs: string[] = [];
  const templateId = resolved.template.id;

  // Build enhanced prompt (Phase 2)
  const prompt = buildEnhancedPrompt(resolved as import("./types").ResolvedTemplate, section, difficulty);
  await logStage(jobId, null, templateId, section, category, "build_prompt", "success", null);

  // Call LLM
  const llmStart = Date.now();
  const llmResponse = await callLLM(prompt);
  const llmDuration = Date.now() - llmStart;
  await logStage(jobId, null, templateId, section, category, "llm_call", "success", null, {
    model: llmResponse.model,
    tokens: llmResponse.inputTokens + llmResponse.outputTokens,
    duration_ms: llmDuration,
  });

  // Parse response
  const { data: parsed, error: parseError } = parseResponse(llmResponse.rawText);
  if (parseError || !parsed) {
    await logStage(jobId, null, templateId, section, category, "parse_response", "failed", parseError?.message || "Parse failed");
    return {
      question: null,
      validation: emptyValidation(),
      decision: { action: "regenerate", reason: `Parse failed: ${parseError?.message}`, failedChecks: ["parse"], retryCount, suggestedTemplateId: null },
      logs: [`Parse error: ${parseError?.message}`],
    };
  }

  await logStage(jobId, null, templateId, section, category, "parse_response", "success", null);

  // Intra-batch dedup (Phase 3)
  if (batchContext && batchContext.fingerprints.length > 0) {
    const batchDedup = checkIntraBatchDedup(parsed, section, batchContext.fingerprints);
    if (batchDedup.isDuplicate) {
      logs.push(`Intra-batch duplicate detected (similarity: ${batchDedup.similarity}, matching: ${batchDedup.matchingItemId})`);
      return {
        question: null,
        validation: emptyValidation(),
        decision: { action: "regenerate", reason: `Intra-batch duplicate (similarity: ${batchDedup.similarity})`, failedChecks: ["intra_batch_dedup"], retryCount, suggestedTemplateId: null },
        logs,
      };
    }
  }

  // Run validators (Phase 1 + Phase 3 hardened)
  const structureResult = validateStructure(parsed, section, difficulty);
  const leakageResult = await detectLeakage(parsed, section);
  const difficultyResult = scoreDifficulty(parsed, resolved.template.difficulty_parameters, difficulty, section);
  const distractorResult = validateDistractors(parsed, resolved.template.distractor_strategy);
  const dedupResult = await checkGenerationDedup(parsed, section);

  // Phase 3: New validators
  const explanationCoherenceResult = validateExplanationCoherence(parsed, section);
  const satStyleResult = validateSATStyle(parsed, section, batchContext?.recentCorrectPositions);

  // Phase 2: Anti-leak safeguards
  const realQuestionTexts = await loadRealQuestionTexts(section);
  const antiLeakResult = checkAntiLeakSafeguards(parsed, realQuestionTexts);

  if (!antiLeakResult.passed) {
    logs.push(`Anti-leak safeguard FAILED: ngram=${antiLeakResult.ngramOverlapScore}, structural=${antiLeakResult.structuralLeakageScore}, passage=${antiLeakResult.passageLeakageScore}`);
  }

  // Phase 2: Generation scoring
  const generationScore = scoreGeneration(
    parsed,
    { structure: structureResult, leakage: leakageResult, difficulty: difficultyResult, distractor: distractorResult, dedup: dedupResult, explanationCoherence: explanationCoherenceResult, satStyle: satStyleResult, antiLeakSafeguard: toAntiLeakCheckResult(antiLeakResult), generationScore: { result: "pass", overallScore: 0, failedMinimums: [] }, allPassed: false, failedChecks: [] },
    antiLeakResult,
    section,
    category,
    difficulty,
    templateId
  );
  logs.push(formatScoreForLog(generationScore));

  // Wrap Phase 2 outputs as check results
  const antiLeakCheckResult = toAntiLeakCheckResult(antiLeakResult);
  const generationScoreCheckResult = toGenerationScoreCheckResult(generationScore.overallScore);

  // Aggregate validation
  const validation: GenerationValidationResult = {
    structure: structureResult,
    leakage: leakageResult,
    difficulty: difficultyResult,
    distractor: distractorResult,
    dedup: dedupResult,
    explanationCoherence: explanationCoherenceResult,
    satStyle: satStyleResult,
    antiLeakSafeguard: antiLeakCheckResult,
    generationScore: generationScoreCheckResult,
    allPassed: structureResult.result === "pass"
      && leakageResult.result === "pass"
      && difficultyResult.result === "pass"
      && distractorResult.result === "pass"
      && dedupResult.result === "pass"
      && antiLeakCheckResult.result === "pass"
      && generationScoreCheckResult.result === "pass"
      && explanationCoherenceResult.result === "pass"
      && satStyleResult.result === "pass"
      && generationScore.overallScore >= GENERATION_CONFIG.scoring.minimumOverallScore,
    failedChecks: [
      ...(structureResult.result !== "pass" ? ["structure"] : []),
      ...(leakageResult.result !== "pass" ? ["leakage"] : []),
      ...(difficultyResult.result !== "pass" ? ["difficulty"] : []),
      ...(distractorResult.result !== "pass" ? ["distractor"] : []),
      ...(dedupResult.result !== "pass" ? ["dedup"] : []),
      ...(!antiLeakResult.passed ? ["anti_leak_safeguard"] : []),
      ...(generationScore.overallScore < GENERATION_CONFIG.scoring.minimumOverallScore ? ["generation_score"] : []),
      ...(explanationCoherenceResult.result !== "pass" ? ["explanation_coherence"] : []),
      ...(satStyleResult.result !== "pass" ? ["sat_style"] : []),
    ],
  };

  await logStage(jobId, null, templateId, section, category, "validate", "success", null, { validation });

  // Decision
  const availableTemplateIds = [templateId];
  const decision = decideGenerationAction(validation, retryCount, availableTemplateIds, templateId);

  // Store question if not discarded
  let question: GeneratedQuestion | null = null;
  if (decision.action !== "discard") {
    const status = decision.action === "approve" ? "approved_for_release" : decision.action === "review" ? "generation_pending" : "generation_failed";
    const approved = decision.action === "approve";

    const { id: qId, error: saveError } = await saveGeneratedQuestion({
      template_id: templateId,
      pattern_id: null,
      section,
      category: category as string,
      question_type: "mcq",
      generated_passage: parsed.passage,
      generated_question: parsed.question,
      choice_a: parsed.choices["A"] || null,
      choice_b: parsed.choices["B"] || null,
      choice_c: parsed.choices["C"] || null,
      choice_d: parsed.choices["D"] || null,
      correct_choice: parsed.correctChoice,
      tutor_explanation: parsed.tutorExplanation,
      student_explanation: parsed.studentExplanation,
      difficulty_score: difficultyResult.difficultyScore,
      mapped_level: difficultyResult.mappedLevel,
      difficulty_factors: { ...difficultyResult.factors },
      distractor_analysis: { perDistractor: distractorResult.perDistractor, strategies: distractorResult.strategiesUsed },
      reasoning_trace: parsed.reasoningTrace,
      status,
      processing_stage: "validation_complete",
      retry_count: retryCount,
      error_message: decision.action !== "approve" ? decision.reason : null,
      last_processed_at: new Date().toISOString(),
      fingerprint_text: leakageResult.fingerprint.textHash,
      fingerprint_structure: leakageResult.fingerprint.structureHash,
      fingerprint_choice: leakageResult.fingerprint.choiceHash,
      pattern_signature: leakageResult.fingerprint.patternSignature,
      version: 1,
      is_active: true,
      approved_for_release: approved,
    });

    if (qId && !saveError) {
      question = {
        id: qId,
        template_id: templateId,
        pattern_id: null,
        section,
        category: category as string,
        question_type: "mcq",
        generated_passage: parsed.passage,
        generated_question: parsed.question,
        choice_a: parsed.choices["A"] || null,
        choice_b: parsed.choices["B"] || null,
        choice_c: parsed.choices["C"] || null,
        choice_d: parsed.choices["D"] || null,
        correct_choice: parsed.correctChoice,
        tutor_explanation: parsed.tutorExplanation,
        student_explanation: parsed.studentExplanation,
        difficulty_score: difficultyResult.difficultyScore,
        mapped_level: difficultyResult.mappedLevel,
        difficulty_factors: { ...difficultyResult.factors },
        distractor_analysis: { perDistractor: distractorResult.perDistractor, strategies: distractorResult.strategiesUsed },
        reasoning_trace: parsed.reasoningTrace,
        status,
        processing_stage: "validation_complete",
        retry_count: retryCount,
        error_message: decision.action !== "approve" ? decision.reason : null,
        last_processed_at: new Date().toISOString(),
        fingerprint_text: leakageResult.fingerprint.textHash,
        fingerprint_structure: leakageResult.fingerprint.structureHash,
        fingerprint_choice: leakageResult.fingerprint.choiceHash,
        pattern_signature: leakageResult.fingerprint.patternSignature,
        version: 1,
        is_active: true,
        approved_for_release: approved,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Add to batch context if provided
      if (batchContext) {
        batchContext.fingerprints.push({
          id: qId,
          fingerprint: leakageResult.fingerprint,
          content: { passage: parsed.passage || "", question: parsed.question, choices: Object.values(parsed.choices).join(" ") },
        });
        batchContext.recentCorrectPositions.push(parsed.correctChoice);
      }

      // Save validation result
      const checkSummary = `structure:${structureResult.result},leakage:${leakageResult.result},difficulty:${difficultyResult.result},distractor:${distractorResult.result},dedup:${dedupResult.result},anti_leak:${antiLeakCheckResult.result},gen_score:${generationScoreCheckResult.result},explanation:${explanationCoherenceResult.result},sat_style:${satStyleResult.result}`;

      await saveValidationResult({
        generated_question_id: qId,
        generation_log_id: null,
        template_id: templateId,
        leak_check_result: leakageResult.result,
        leak_check_score: leakageResult.maxSimilarity,
        duplicate_check_result: dedupResult.result,
        duplicate_check_score: Math.max(dedupResult.maxRealSimilarity, dedupResult.maxGeneratedSimilarity),
        structure_check_result: structureResult.result,
        difficulty_check_result: difficultyResult.result,
        distractor_check_result: distractorResult.result,
        difficulty_score: difficultyResult.difficultyScore,
        mapped_level: difficultyResult.mappedLevel,
        all_checks_passed: validation.allPassed,
        decision: decision.action,
        decision_reason: `${decision.reason} [${checkSummary}]`,
        status: "validation_complete",
      });
    }
  }

  return { question, validation, decision, logs };
}

// -- Phase 2 result wrappers --

function toAntiLeakCheckResult(result: import("./types").AntiLeakSafeguardResult): AntiLeakSafeguardCheckResult {
  const criticalViolations = result.violations.filter((v) => v.severity === "critical").length;
  const warningViolations = result.violations.filter((v) => v.severity === "warning").length;

  let checkResult: "pass" | "fail" | "review";
  if (!result.passed) {
    checkResult = criticalViolations > 0 ? "fail" : "review";
  } else if (warningViolations > 0) {
    checkResult = "review";
  } else {
    checkResult = "pass";
  }

  return {
    result: checkResult,
    ngramOverlapScore: result.ngramOverlapScore,
    structuralLeakageScore: result.structuralLeakageScore,
    passageLeakageScore: result.passageLeakageScore,
    criticalViolations,
    warningViolations,
  };
}

function toGenerationScoreCheckResult(overallScore: number): GenerationScoreCheckResult {
  const failedMinimums: string[] = [];
  if (overallScore < GENERATION_CONFIG.scoring.minimumOverallScore) {
    failedMinimums.push("overall");
  }
  if (overallScore < GENERATION_CONFIG.scoring.minimumOriginalityScore) {
    failedMinimums.push("originality");
  }

  let result: "pass" | "fail" | "review";
  if (failedMinimums.includes("overall") && overallScore < GENERATION_CONFIG.scoring.minimumOverallScore * 0.8) {
    result = "fail";
  } else if (failedMinimums.length > 0) {
    result = "review";
  } else {
    result = "pass";
  }

  return {
    result,
    overallScore: Math.round(overallScore * 1000) / 1000,
    failedMinimums,
  };
}

// -- Helpers --

async function loadRealQuestionTexts(
  section: "RW" | "Math"
): Promise<{ id: string; passage: string; question: string; choices: string }[]> {
  try {
    const { supabase } = await import("../supabase/client");
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

async function logStage(
  jobId: string,
  questionId: string | null,
  templateId: string | null,
  section: string | null,
  category: string | null,
  stage: GenerationStage,
  status: string,
  errorMessage: string | null,
  extra?: { model?: string; tokens?: number; duration_ms?: number; validation?: GenerationValidationResult }
): Promise<void> {
  await saveGenerationLog({
    generation_job_id: jobId,
    generated_question_id: questionId,
    template_id: templateId,
    section,
    category,
    stage,
    status,
    decision: null,
    decision_reason: null,
    validation_results: extra?.validation ? { validation: extra.validation } : {},
    error_message: errorMessage,
    retry_count: 0,
    llm_model: extra?.model || null,
    llm_tokens_used: extra?.tokens || null,
    generation_duration_ms: extra?.duration_ms || null,
    fingerprint_text: null,
    fingerprint_structure: null,
  });
}

function emptyValidation(): GenerationValidationResult {
  return {
    structure: {
      result: "fail", issues: ["No question generated"], hasPassage: false, hasQuestion: false,
      hasAllChoices: false, hasCorrectChoice: false, hasExplanation: false, choiceLengthVariance: 0,
      passageWordCount: 0, passageWordCountInRange: false,
      choiceDeduplication: { hasDuplicates: false, duplicatePairs: [] },
      explanationQuality: { result: "fail", wordCount: 0, meetsMinimum: false, containsReasoning: false },
      studentExplanationPresent: false,
      correctAnswerConsistency: { result: "pass", embeddedInQuestion: false, overlappingPhrases: [] },
    },
    leakage: { result: "pass", maxSimilarity: 0, matchedRealQuestionIds: [], fingerprint: { textHash: "", structureHash: "", choiceHash: "", patternSignature: "" } },
    difficulty: { result: "fail", difficultyScore: 0, mappedLevel: "easy", factors: { complexity: 0, syntax: 0, reasoning: 0, distractor: 0, density: 0, time: 0, passageQuality: 0, explanationDepth: 0, satMarkers: 0 }, targetBand: "easy", mismatch: true },
    distractor: {
      result: "fail", distractorCount: 0, strategiesUsed: [], primaryPatternCovered: false, diversityScore: 0, perDistractor: [],
      crossDistractorSimilarity: { result: "pass", similarPairs: [] },
      distractorCorrectOverlap: { result: "pass", overlappingDistractors: [] },
      strategyConformance: { result: "pass", nonConformingDistractors: [] },
    },
    dedup: { result: "pass", realQuestionMatches: [], generatedQuestionMatches: [], maxRealSimilarity: 0, maxGeneratedSimilarity: 0, fingerprint: { textHash: "", structureHash: "", choiceHash: "", patternSignature: "" } },
    explanationCoherence: { result: "fail", referencesCorrectChoice: false, explainsWhy: false, addressesDistractors: false, coherenceScore: 0 },
    satStyle: { result: "fail", questionStemFormat: "fail", choiceFormat: "fail", noProhibitedContent: "pass", correctAnswerDistribution: "pass", issues: ["No question generated"] },
    antiLeakSafeguard: { result: "pass", ngramOverlapScore: 0, structuralLeakageScore: 0, passageLeakageScore: 0, criticalViolations: 0, warningViolations: 0 },
    generationScore: { result: "pass", overallScore: 0, failedMinimums: [] },
    allPassed: false,
    failedChecks: ["structure", "difficulty", "distractor"],
  };
}
