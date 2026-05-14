import type {
  ReasoningChain,
  ReasoningChainStep,
  ChainAssemblyInput,
} from "./types";
import type { ReasoningStep, Section, LibraryCategory } from "../library/types";
import { getReasoningFlow } from "../library/reasoningTemplates";

// Cognitive weight per step by difficulty target
const COGNITIVE_WEIGHT_MAP: Record<string, number[]> = {
  easy: [0.3, 0.3, 0.2],
  medium: [0.4, 0.4, 0.3],
  hard: [0.5, 0.5, 0.5],
};

export function assembleReasoningChain(
  input: ChainAssemblyInput
): ReasoningChain {
  const { templateSteps, section, category, difficultyTarget, prerequisiteCategories } = input;

  const steps = buildChainSteps(templateSteps, difficultyTarget);
  const cognitiveLoad = computeCognitiveLoad(steps);
  const prerequisiteChains = resolvePrerequisiteChains(section, prerequisiteCategories);
  const chainId = generateChainId(section, category, difficultyTarget);

  return {
    steps,
    cognitiveLoad,
    prerequisiteChains,
    chainId,
    section,
    category,
  };
}

function buildChainSteps(
  templateSteps: ReasoningStep[],
  difficultyTarget: "easy" | "medium" | "hard"
): ReasoningChainStep[] {
  const weights = COGNITIVE_WEIGHT_MAP[difficultyTarget] || COGNITIVE_WEIGHT_MAP.medium;

  return templateSteps.map((step, i) => {
    const cognitiveWeight = weights[Math.min(i, weights.length - 1)];

    // Build prerequisite links: each step may depend on prior steps
    const prerequisiteSteps: number[] = [];
    if (i > 0) {
      prerequisiteSteps.push(i);
    }
    if (i > 1 && difficultyTarget === "hard") {
      // Hard questions may require chaining back to step 1
      prerequisiteSteps.push(1);
    }

    const validationHint = deriveValidationHint(step, difficultyTarget);

    return {
      step: step.step,
      name: step.name,
      description: step.description,
      guidance: step.guidance,
      cognitiveWeight,
      prerequisiteSteps,
      validationHint,
    };
  });
}

function computeCognitiveLoad(steps: ReasoningChainStep[]): number {
  if (steps.length === 0) return 0;
  const totalWeight = steps.reduce((sum, s) => sum + s.cognitiveWeight, 0);
  return Math.round((totalWeight / steps.length) * 100) / 100;
}

function resolvePrerequisiteChains(
  section: Section,
  prerequisiteCategories: string[]
): string[] {
  const chains: string[] = [];
  for (const cat of prerequisiteCategories) {
    const flow = getReasoningFlow(section, cat as LibraryCategory);
    if (flow.length > 0) {
      chains.push(`${cat}:${flow.map((s) => s.name).join("→")}`);
    }
  }
  return chains;
}

function deriveValidationHint(
  step: ReasoningStep,
  difficultyTarget: "easy" | "medium" | "hard"
): string {
  const base = step.guidance;
  if (difficultyTarget === "hard") {
    return `${base}; verify the reasoning is non-obvious and requires synthesis`;
  }
  if (difficultyTarget === "easy") {
    return `${base}; the correct path should be direct and identifiable`;
  }
  return `${base}; the reasoning should be clear but require one inferential step`;
}

function generateChainId(
  section: Section,
  category: LibraryCategory,
  difficulty: string
): string {
  return `chain:${section}:${category}:${difficulty}:${Date.now()}`;
}

export function formatChainForPrompt(chain: ReasoningChain): string {
  const lines: string[] = [];

  lines.push(`REASONING CHAIN [${chain.section}/${chain.category}] (cognitive load: ${chain.cognitiveLoad})`);

  for (const step of chain.steps) {
    const prereqs = step.prerequisiteSteps.length > 0
      ? ` (requires step${step.prerequisiteSteps.length > 1 ? "s" : ""} ${step.prerequisiteSteps.join(", ")})`
      : "";
    lines.push(`  Step ${step.step}: ${step.name}${prereqs}`);
    lines.push(`    Task: ${step.description}`);
    lines.push(`    Guide: ${step.guidance}`);
    lines.push(`    Validate: ${step.validationHint}`);
    lines.push(`    Weight: ${step.cognitiveWeight}`);
  }

  if (chain.prerequisiteChains.length > 0) {
    lines.push(`PREREQUISITE CHAINS:`);
    for (const pc of chain.prerequisiteChains) {
      lines.push(`  ${pc}`);
    }
  }

  return lines.join("\n");
}

export function getChainStepCount(chain: ReasoningChain): number {
  return chain.steps.length;
}

export function isChainValidForDifficulty(
  chain: ReasoningChain,
  target: "easy" | "medium" | "hard"
): boolean {
  if (target === "hard" && chain.cognitiveLoad < 0.4) return false;
  if (target === "easy" && chain.cognitiveLoad > 0.5) return false;
  return true;
}
