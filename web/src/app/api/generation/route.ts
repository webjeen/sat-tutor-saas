import { NextRequest, NextResponse } from "next/server";
import { runGenerationPipeline } from "@/lib/generation/generationOrchestrator";
import { runBatchGenerationPipeline } from "@/lib/generation/batchOrchestrator";
import type { Section, LibraryCategory } from "@/lib/library/types";
import type { GenerationJobConfig, BatchGenerationConfig } from "@/lib/generation/types";
import { GENERATION_CONFIG } from "@/lib/generation/config";

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Batch generation path
  if (Array.isArray(body.requests)) {
    return handleBatchGeneration(body);
  }

  // Single generation path (backward compatible)
  return handleSingleGeneration(body);
}

async function handleSingleGeneration(body: Record<string, unknown>) {
  const { section, category, difficulty, count, templateId } = body as {
    section?: string;
    category?: string;
    difficulty?: string;
    count?: number;
    templateId?: string;
  };

  if (!section || !["RW", "Math"].includes(section)) {
    return NextResponse.json({ error: "Invalid or missing section (must be RW or Math)" }, { status: 400 });
  }

  if (!category) {
    return NextResponse.json({ error: "Missing required field: category" }, { status: 400 });
  }

  if (!difficulty || !["easy", "medium", "hard"].includes(difficulty)) {
    return NextResponse.json({ error: "Invalid or missing difficulty (must be easy, medium, or hard)" }, { status: 400 });
  }

  const questionCount = Math.min(
    Math.max(count || 1, 1),
    GENERATION_CONFIG.limits.maxQuestionsPerJob
  );

  const config: GenerationJobConfig = {
    section: section as Section,
    category: category as LibraryCategory,
    difficulty: difficulty as "easy" | "medium" | "hard",
    count: questionCount,
    templateId,
  };

  try {
    const result = await runGenerationPipeline(config);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function handleBatchGeneration(body: Record<string, unknown>) {
  const requests = body.requests as GenerationJobConfig[];
  const diversityRules = body.diversityRules as BatchGenerationConfig["diversityRules"];
  const maxTotalQuestions = (body.maxTotalQuestions as number) || requests.reduce((sum, r) => sum + r.count, 0);

  // Validate each request
  for (let i = 0; i < requests.length; i++) {
    const r = requests[i];
    if (!r.section || !["RW", "Math"].includes(r.section)) {
      return NextResponse.json({ error: `Request ${i}: Invalid section` }, { status: 400 });
    }
    if (!r.category) {
      return NextResponse.json({ error: `Request ${i}: Missing category` }, { status: 400 });
    }
    if (!r.difficulty || !["easy", "medium", "hard"].includes(r.difficulty)) {
      return NextResponse.json({ error: `Request ${i}: Invalid difficulty` }, { status: 400 });
    }
  }

  const batchConfig: BatchGenerationConfig = {
    requests,
    diversityRules: diversityRules || {
      maxSameCategory: GENERATION_CONFIG.batch.defaultMaxSameCategory,
      difficultyDistribution: GENERATION_CONFIG.batch.defaultDiversityDistribution,
      requireCategorySpread: true,
      minCategorySpread: GENERATION_CONFIG.batch.defaultMinCategorySpread,
    },
    maxTotalQuestions,
  };

  try {
    const result = await runBatchGenerationPipeline(batchConfig);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Batch generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
