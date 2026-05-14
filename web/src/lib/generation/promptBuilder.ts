import type {
  ResolvedTemplate,
  PromptPayload,
  PromptSection,
  EnhancedPromptPayload,
  ReasoningChain,
  ChainAssemblyInput,
  SATConstraintSet,
  DistractorSynthesisInput,
  DistractorSynthesisPlan,
} from "./types";
import type { Section, LibraryCategory } from "../library/types";
import { getSystemMessage } from "./config";
import { assembleReasoningChain, formatChainForPrompt, isChainValidForDifficulty } from "./reasoningChain";
import {
  buildConstraintSet,
  formatConstraintsForPrompt,
  formatAntiLeakRules,
  formatStructuralOriginalityRules,
} from "./rhetoricalConstraints";
import {
  synthesizeDistractorPlan,
  formatDistractorPlanForPrompt,
} from "./distractorSynthesizer";
import { getAntiReconstructionPromptRules } from "./antiLeakSafeguards";
import { getPrerequisites } from "../library/reasoningTemplates";

// -- Main entry: build enhanced prompt with all Phase 2 layers --

export function buildEnhancedPrompt(
  resolved: ResolvedTemplate,
  section: Section,
  difficultyTarget: "easy" | "medium" | "hard"
): EnhancedPromptPayload {
  const { template, distractorCatalogEntries, reasoningFlowSteps } = resolved;

  // 1. Assemble reasoning chain
  const chainInput: ChainAssemblyInput = {
    templateSteps: reasoningFlowSteps,
    section,
    category: template.category as LibraryCategory,
    difficultyTarget,
    prerequisiteCategories: getPrerequisites(section, template.category as LibraryCategory),
  };
  const reasoningChain = assembleReasoningChain(chainInput);

  // 2. Build constraint set
  const constraintSet = buildConstraintSet(section, template.category as LibraryCategory);

  // 3. Synthesize distractor plan
  const distractorInput: DistractorSynthesisInput = {
    section,
    category: template.category as LibraryCategory,
    strategy: template.distractor_strategy,
    catalogEntries: distractorCatalogEntries,
    difficultyTarget,
    correctChoice: null,
  };
  const distractorPlan = synthesizeDistractorPlan(distractorInput);

  // 4. Anti-leak prompt rules
  const antiLeakRules = getAntiReconstructionPromptRules();

  // 5. Build sections
  const sections = buildPromptSections(
    template,
    reasoningChain,
    constraintSet,
    distractorPlan,
    antiLeakRules,
    section,
    difficultyTarget
  );

  // 6. Build system and user messages
  const system = getSystemMessage(section);
  const user = assembleUserMessage(sections);

  return {
    system,
    user,
    section,
    category: template.category as LibraryCategory,
    sections,
    reasoningChain,
    constraintSet,
    distractorPlan,
    antiLeakRules,
    generationScoreBaseline: null,
  };
}

// -- Legacy compatibility: buildPrompt delegates to buildEnhancedPrompt --

export function buildPrompt(
  resolved: ResolvedTemplate,
  section: Section,
  difficultyTarget: "easy" | "medium" | "hard"
): PromptPayload {
  return buildEnhancedPrompt(resolved, section, difficultyTarget);
}

// -- Section builders --

function buildPromptSections(
  template: ResolvedTemplate["template"],
  reasoningChain: ReasoningChain,
  constraintSet: SATConstraintSet,
  distractorPlan: DistractorSynthesisPlan,
  antiLeakRules: string[],
  section: Section,
  difficultyTarget: "easy" | "medium" | "hard"
): PromptSection[] {
  return [
    buildHeaderSection(template, section, difficultyTarget),
    buildAntiLeakSection(antiLeakRules, constraintSet),
    buildReasoningChainSection(reasoningChain),
    buildConstraintSection(constraintSet, section),
    buildDistractorSection(distractorPlan, section),
    buildDifficultySection(template, difficultyTarget),
    buildStructuralOriginalitySection(constraintSet),
    buildClosingSection(section, difficultyTarget),
  ];
}

function buildHeaderSection(
  template: ResolvedTemplate["template"],
  section: Section,
  difficultyTarget: "easy" | "medium" | "hard"
): PromptSection {
  const sectionLabel = section === "RW" ? "Reading & Writing" : "Math";
  const content = `Generate an SAT ${sectionLabel} question using this pattern template.

TEMPLATE: ${template.template_name}
Category: ${template.category}
Subcategory: ${template.subcategory || "none"}
Source pattern count: ${template.source_pattern_ids.length}
Difficulty target: ${difficultyTarget}`;

  return { heading: "HEADER", content, priority: 10 };
}

function buildAntiLeakSection(
  antiLeakRules: string[],
  constraintSet: SATConstraintSet
): PromptSection {
  const parts: string[] = [];
  parts.push(formatAntiLeakRules(antiLeakRules));
  parts.push("");
  parts.push(formatStructuralOriginalityRules(constraintSet.structuralOriginalityRules));

  return { heading: "ANTI-LEAK RULES", content: parts.join("\n"), priority: 9 };
}

function buildReasoningChainSection(reasoningChain: ReasoningChain): PromptSection {
  const content = formatChainForPrompt(reasoningChain);
  const validNote = isChainValidForDifficulty(reasoningChain, reasoningChain.category as "easy" | "medium" | "hard")
    ? "\n[Chain validated for target difficulty]"
    : "\n[WARNING: Chain cognitive load may not match difficulty target]";

  return { heading: "REASONING CHAIN", content: content + validNote, priority: 8 };
}

function buildConstraintSection(constraintSet: SATConstraintSet, section: Section): PromptSection {
  const content = formatConstraintsForPrompt(constraintSet, section);
  return { heading: "CONSTRAINTS", content, priority: 7 };
}

function buildDistractorSection(distractorPlan: DistractorSynthesisPlan, section: Section): PromptSection {
  const content = formatDistractorPlanForPrompt(distractorPlan, section);
  return { heading: "DISTRACTOR PLAN", content, priority: 6 };
}

function buildDifficultySection(
  template: ResolvedTemplate["template"],
  difficultyTarget: "easy" | "medium" | "hard"
): PromptSection {
  const diffParams = template.difficulty_parameters;
  const targetBand = diffParams.band_targets[difficultyTarget] ?? 55;

  const content = `DIFFICULTY TARGET: ${difficultyTarget} (score ~${targetBand})
Factor weights: complexity=${diffParams.factor_weights.complexity}, syntax=${diffParams.factor_weights.syntax}, reasoning=${diffParams.factor_weights.reasoning}, distractor=${diffParams.factor_weights.distractor}
Timing target: ${diffParams.timing_targets[difficultyTarget]}

CONSTRAINT RULES:
${template.constraint_rules
  .map((r) => `  [${r.type}] ${r.field} ${r.operator} ${JSON.stringify(r.value)}: ${r.description}`)
  .join("\n")}`;

  return { heading: "DIFFICULTY", content, priority: 5 };
}

function buildStructuralOriginalitySection(constraintSet: SATConstraintSet): PromptSection {
  const rules = constraintSet.structuralOriginalityRules;
  const content = rules.map((r, i) => `${i + 1}. ${r}`).join("\n");
  return { heading: "STRUCTURAL ORIGINALITY", content, priority: 4 };
}

function buildClosingSection(
  section: Section,
  difficultyTarget: "easy" | "medium" | "hard"
): PromptSection {
  const sectionNote = section === "RW"
    ? `Passage structure should be suitable for ${difficultyTarget}-difficulty SAT questions.
Produce exactly ONE question with 4 choices. The passage must be entirely original.`
    : `Problem should be at ${difficultyTarget} difficulty for SAT.
Produce exactly ONE question with 4 choices. Do NOT include a passage. The problem must be entirely original.`;

  return { heading: "OUTPUT", content: sectionNote, priority: 1 };
}

// -- Assemble sections into user message --

function assembleUserMessage(sections: PromptSection[]): string {
  const sorted = [...sections].sort((a, b) => b.priority - a.priority);
  return sorted
    .map((s) => `=== ${s.heading} ===\n${s.content}`)
    .join("\n\n");
}

// -- RW/Math specific entry points (maintain backward compatibility) --

export function buildRWPrompt(
  resolved: ResolvedTemplate,
  difficultyTarget: "easy" | "medium" | "hard"
): PromptPayload {
  return buildEnhancedPrompt(resolved, "RW", difficultyTarget);
}

export function buildMathPrompt(
  resolved: ResolvedTemplate,
  difficultyTarget: "easy" | "medium" | "hard"
): PromptPayload {
  return buildEnhancedPrompt(resolved, "Math", difficultyTarget);
}
