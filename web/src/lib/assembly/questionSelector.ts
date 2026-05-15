import { supabase } from "../supabase/client";
import type { GeneratedQuestion } from "../generation/types";
import type { Section } from "../library/types";
import type { WorksheetConfig, WorksheetQuestion } from "./types";
import { ASSEMBLY_CONFIG, getDifficultyDistribution } from "./config";

export async function selectQuestions(
  config: WorksheetConfig
): Promise<{ questions: WorksheetQuestion[]; error: string | null }> {
  const distribution = getDifficultyDistribution(config.difficultyMode, config.difficultyDistribution);
  const targetCounts = computeTargetCounts(config.questionCount, distribution);

  const selected: WorksheetQuestion[] = [];
  const usedIds = new Set<string>();
  const categoryCounts: Record<string, number> = {};

  for (const [level, count] of Object.entries(targetCounts)) {
    if (count === 0) continue;

    const candidates = await fetchApprovedQuestions(
      config.section,
      config.categories,
      level as "easy" | "medium" | "hard",
      ASSEMBLY_CONFIG.selection.batchSize
    );

    const picked = pickWithDiversity(
      candidates,
      count,
      usedIds,
      categoryCounts,
      config.categories
    );

    for (const q of picked) {
      selected.push({
        index: selected.length + 1,
        question: q,
        section: q.section as Section,
        category: q.category,
        difficultyLevel: (q.mapped_level || "medium") as "easy" | "medium" | "hard",
        correctChoice: q.correct_choice,
      });
    }
  }

  // Sort by difficulty progression for progressive/mixed modes
  if (config.difficultyMode === "progressive" || config.difficultyMode === "mixed") {
    selected.sort((a, b) => {
      const order: Record<string, number> = { easy: 0, medium: 1, hard: 2 };
      return (order[a.difficultyLevel] ?? 1) - (order[b.difficultyLevel] ?? 1);
    });
    // Re-index after sort
    selected.forEach((q, i) => { q.index = i + 1; });
  }

  if (selected.length < config.questionCount) {
    return {
      questions: selected,
      error: `Only ${selected.length}/${config.questionCount} approved questions available`,
    };
  }

  return { questions: selected, error: null };
}

function computeTargetCounts(
  total: number,
  distribution: { easy: number; medium: number; hard: number }
): Record<string, number> {
  const easyCount = Math.round(total * distribution.easy / 100);
  const hardCount = Math.round(total * distribution.hard / 100);
  const mediumCount = total - easyCount - hardCount;

  return { easy: easyCount, medium: mediumCount, hard: hardCount };
}

async function fetchApprovedQuestions(
  section: Section,
  categories: string[],
  difficultyLevel: "easy" | "medium" | "hard",
  limit: number
): Promise<GeneratedQuestion[]> {
  let query = supabase
    .from("generated_questions")
    .select("*")
    .eq("section", section)
    .eq("is_active", true)
    .eq("approved_for_release", true)
    .eq("mapped_level", difficultyLevel);

  if (categories.length > 0) {
    query = query.in("category", categories);
  }

  query = query.order("created_at", { ascending: false }).limit(limit);

  const { data } = await query;
  return (data || []) as GeneratedQuestion[];
}

function pickWithDiversity(
  candidates: GeneratedQuestion[],
  count: number,
  usedIds: Set<string>,
  categoryCounts: Record<string, number>,
  _allowedCategories: string[]
): GeneratedQuestion[] {
  const picked: GeneratedQuestion[] = [];
  const shuffled = shuffleArray(candidates.filter((q) => !usedIds.has(q.id)));

  for (const q of shuffled) {
    if (picked.length >= count) break;

    // Enforce max same category
    const catCount = categoryCounts[q.category] || 0;
    if (catCount >= ASSEMBLY_CONFIG.diversity.maxSameCategory) continue;

    picked.push(q);
    usedIds.add(q.id);
    categoryCounts[q.category] = catCount + 1;
  }

  return picked;
}

function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
