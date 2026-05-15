import type {
  ParsedGeneration,
  LeakCheckResult,
  AntiLeakSafeguardCheckResult,
  StructuralCloneResult,
  PreSaveCheck,
} from "./types";
import { checkAntiLeakSafeguards, getAntiReconstructionPromptRules } from "./antiLeakSafeguards";
import { detectLeakage } from "./validators/leakageDetector";
import { detectStructuralClones } from "./validators/structuralCloneDetector";

export interface GenerationTimeAntiLeakResult {
  cleared: boolean;
  promptRulesInjected: boolean;
  leakageCleared: boolean;
  antiLeakSafeguardsCleared: boolean;
  structuralCloneCleared: boolean;
  combinedLeakScore: number;
  blockedReasons: string[];
  details: {
    leakage: LeakCheckResult | null;
    antiLeakSafeguard: AntiLeakSafeguardCheckResult | null;
    structuralClone: StructuralCloneResult | null;
  };
}

export function verifyPromptRulesInjected(promptText: string): boolean {
  const rules = getAntiReconstructionPromptRules();
  return rules.some((rule) => promptText.includes(rule));
}

export async function runGenerationTimeAntiLeak(
  parsed: ParsedGeneration,
  section: "RW" | "Math",
  promptText?: string
): Promise<GenerationTimeAntiLeakResult> {
  const blockedReasons: string[] = [];

  const promptRulesInjected = promptText ? verifyPromptRulesInjected(promptText) : true;
  if (promptText && !promptRulesInjected) {
    blockedReasons.push("Anti-reconstruction prompt rules not detected in generation prompt");
  }

  const leakage = await detectLeakage(parsed, section);
  const leakageCleared = leakage.result !== "fail";
  if (!leakageCleared) {
    blockedReasons.push(`Leakage check failed: similarity ${leakage.maxSimilarity}`);
  }

  const realQuestionTexts = await loadRealQuestionTexts(section);
  const antiLeakRaw = checkAntiLeakSafeguards(parsed, realQuestionTexts);

  const criticalViolations = antiLeakRaw.violations.filter((v) => v.severity === "critical").length;
  const warningViolations = antiLeakRaw.violations.filter((v) => v.severity === "warning").length;

  let antiLeakSafeguardResult: AntiLeakSafeguardCheckResult;
  if (!antiLeakRaw.passed) {
    antiLeakSafeguardResult = {
      result: criticalViolations > 0 ? "fail" : "review",
      ngramOverlapScore: antiLeakRaw.ngramOverlapScore,
      structuralLeakageScore: antiLeakRaw.structuralLeakageScore,
      passageLeakageScore: antiLeakRaw.passageLeakageScore,
      criticalViolations,
      warningViolations,
    };
  } else if (warningViolations > 0) {
    antiLeakSafeguardResult = {
      result: "review",
      ngramOverlapScore: antiLeakRaw.ngramOverlapScore,
      structuralLeakageScore: antiLeakRaw.structuralLeakageScore,
      passageLeakageScore: antiLeakRaw.passageLeakageScore,
      criticalViolations: 0,
      warningViolations,
    };
  } else {
    antiLeakSafeguardResult = {
      result: "pass",
      ngramOverlapScore: antiLeakRaw.ngramOverlapScore,
      structuralLeakageScore: antiLeakRaw.structuralLeakageScore,
      passageLeakageScore: antiLeakRaw.passageLeakageScore,
      criticalViolations: 0,
      warningViolations: 0,
    };
  }

  const antiLeakSafeguardsCleared = antiLeakSafeguardResult.result !== "fail";
  if (!antiLeakSafeguardsCleared) {
    blockedReasons.push(
      `Anti-leak safeguard failed: ngram=${antiLeakSafeguardResult.ngramOverlapScore}, structural=${antiLeakSafeguardResult.structuralLeakageScore}, passage=${antiLeakSafeguardResult.passageLeakageScore}`
    );
  }

  const structuralClone = await detectStructuralClones(parsed, section);
  const structuralCloneCleared = structuralClone.result !== "fail";
  if (!structuralCloneCleared) {
    blockedReasons.push(
      `Structural clone detected: max combined score ${structuralClone.maxCombinedScore}`
    );
  }

  const leakScores = [leakage.maxSimilarity];
  if (antiLeakSafeguardResult.result !== "pass") {
    leakScores.push(
      antiLeakSafeguardResult.ngramOverlapScore,
      antiLeakSafeguardResult.structuralLeakageScore,
      antiLeakSafeguardResult.passageLeakageScore
    );
  }
  if (structuralClone.result !== "pass") {
    leakScores.push(structuralClone.maxCombinedScore);
  }
  const combinedLeakScore = leakScores.length > 0 ? Math.max(...leakScores) : 0;

  const cleared = leakageCleared && antiLeakSafeguardsCleared && structuralCloneCleared;

  return {
    cleared,
    promptRulesInjected,
    leakageCleared,
    antiLeakSafeguardsCleared,
    structuralCloneCleared,
    combinedLeakScore: Math.round(combinedLeakScore * 10000) / 10000,
    blockedReasons,
    details: {
      leakage,
      antiLeakSafeguard: antiLeakSafeguardResult,
      structuralClone,
    },
  };
}

export function toPreSaveChecks(result: GenerationTimeAntiLeakResult): PreSaveCheck[] {
  return [
    {
      name: "prompt_rules_injected",
      passed: result.promptRulesInjected,
      reason: result.promptRulesInjected ? null : "Anti-reconstruction rules not in prompt",
    },
    {
      name: "leakage_check",
      passed: result.leakageCleared,
      reason: result.leakageCleared ? null : `Leakage similarity ${result.details.leakage?.maxSimilarity}`,
    },
    {
      name: "anti_leak_safeguard",
      passed: result.antiLeakSafeguardsCleared,
      reason: result.antiLeakSafeguardsCleared ? null : `Anti-leak critical violations detected`,
    },
    {
      name: "structural_clone",
      passed: result.structuralCloneCleared,
      reason: result.structuralCloneCleared ? null : `Structural clone score ${result.details.structuralClone?.maxCombinedScore}`,
    },
  ];
}

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
