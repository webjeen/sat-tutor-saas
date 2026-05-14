import type { ResolvedTemplate, PromptPayload } from "./types";
import type { Section, LibraryCategory } from "../library/types";
import { getSystemMessage } from "./config";

export function buildRWPrompt(
  resolved: ResolvedTemplate,
  difficultyTarget: "easy" | "medium" | "hard"
): PromptPayload {
  const { template, distractorCatalogEntries, reasoningFlowSteps } = resolved;

  const system = getSystemMessage("RW");

  const reasoningSteps = reasoningFlowSteps
    .map((s) => `  Step ${s.step}: ${s.name} — ${s.description} (${s.guidance})`)
    .join("\n");

  const distractorGuidance = distractorCatalogEntries
    .map((e) => {
      const rwRules = e.generation_guidance.rw_rules?.join("; ") || "N/A";
      const avoid = e.generation_guidance.avoidance_rules?.join("; ") || "N/A";
      return `  ${e.distractor_type}: ${e.strategy_description}\n    RW rules: ${rwRules}\n    Avoid: ${avoid}`;
    })
    .join("\n");

  const constraints = template.constraint_rules
    .map((r) => `  [${r.type}] ${r.field} ${r.operator} ${JSON.stringify(r.value)}: ${r.description}`)
    .join("\n");

  const diffParams = template.difficulty_parameters;
  const targetBand = diffParams.band_targets[difficultyTarget] ?? 55;

  const user = `Generate an SAT Reading & Writing question using this pattern template.

TEMPLATE: ${template.template_name}
Category: ${template.category}
Subcategory: ${template.subcategory || "none"}
Source pattern count: ${template.source_pattern_ids.length}

REASONING FLOW (the question must test these steps):
${reasoningSteps}

DISTRACTOR STRATEGY:
Primary patterns: ${template.distractor_strategy.primary_patterns.join(", ")}
Secondary patterns: ${template.distractor_strategy.secondary_patterns.join(", ")}
Minimum distractors: ${template.distractor_strategy.minimum_distractors}

DISTRACTOR CATALOG:
${distractorGuidance}

DIFFICULTY TARGET: ${difficultyTarget} (score ~${targetBand})
Factor weights: complexity=${diffParams.factor_weights.complexity}, syntax=${diffParams.factor_weights.syntax}, reasoning=${diffParams.factor_weights.reasoning}, distractor=${diffParams.factor_weights.distractor}

CONSTRAINT RULES:
${constraints}

Passage structure should be suitable for ${template.category} questions.
Produce exactly ONE question with 4 choices.`;

  return { system, user, section: "RW", category: template.category as LibraryCategory };
}

export function buildMathPrompt(
  resolved: ResolvedTemplate,
  difficultyTarget: "easy" | "medium" | "hard"
): PromptPayload {
  const { template, distractorCatalogEntries, reasoningFlowSteps } = resolved;

  const system = getSystemMessage("Math");

  const reasoningSteps = reasoningFlowSteps
    .map((s) => `  Step ${s.step}: ${s.name} — ${s.description} (${s.guidance})`)
    .join("\n");

  const distractorGuidance = distractorCatalogEntries
    .map((e) => {
      const mathRules = e.generation_guidance.math_rules?.join("; ") || "N/A";
      const avoid = e.generation_guidance.avoidance_rules?.join("; ") || "N/A";
      return `  ${e.distractor_type}: ${e.strategy_description}\n    Math rules: ${mathRules}\n    Avoid: ${avoid}`;
    })
    .join("\n");

  const constraints = template.constraint_rules
    .map((r) => `  [${r.type}] ${r.field} ${r.operator} ${JSON.stringify(r.value)}: ${r.description}`)
    .join("\n");

  const diffParams = template.difficulty_parameters;
  const targetBand = diffParams.band_targets[difficultyTarget] ?? 55;

  const user = `Generate an SAT Math question using this pattern template.

TEMPLATE: ${template.template_name}
Category: ${template.category}
Subcategory: ${template.subcategory || "none"}
Source pattern count: ${template.source_pattern_ids.length}

REASONING FLOW (the question must test these steps):
${reasoningSteps}

DISTRACTOR STRATEGY:
Primary patterns: ${template.distractor_strategy.primary_patterns.join(", ")}
Secondary patterns: ${template.distractor_strategy.secondary_patterns.join(", ")}
Minimum distractors: ${template.distractor_strategy.minimum_distractors}

DISTRACTOR CATALOG:
${distractorGuidance}

DIFFICULTY TARGET: ${difficultyTarget} (score ~${targetBand})
Factor weights: complexity=${diffParams.factor_weights.complexity}, syntax=${diffParams.factor_weights.syntax}, reasoning=${diffParams.factor_weights.reasoning}, distractor=${diffParams.factor_weights.distractor}

CONSTRAINT RULES:
${constraints}

Produce exactly ONE question with 4 choices. Do NOT include a passage.`;

  return { system, user, section: "Math", category: template.category as LibraryCategory };
}

export function buildPrompt(
  resolved: ResolvedTemplate,
  section: Section,
  difficultyTarget: "easy" | "medium" | "hard"
): PromptPayload {
  return section === "RW"
    ? buildRWPrompt(resolved, difficultyTarget)
    : buildMathPrompt(resolved, difficultyTarget);
}
