import { NextRequest, NextResponse } from "next/server";
import { runBatchGenerationPipeline } from "@/lib/generation/batchOrchestrator";
import type { GenerationJobConfig, BatchGenerationConfig } from "@/lib/generation/types";
import { GENERATION_CONFIG } from "@/lib/generation/config";

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { requests, diversityRules, maxTotalQuestions } = body as {
    requests?: GenerationJobConfig[];
    diversityRules?: BatchGenerationConfig["diversityRules"];
    maxTotalQuestions?: number;
  };

  if (!Array.isArray(requests) || requests.length === 0) {
    return NextResponse.json({ error: "requests must be a non-empty array of generation configs" }, { status: 400 });
  }

  // Validate each request
  for (let i = 0; i < requests.length; i++) {
    const r = requests[i];
    if (!r.section || !["RW", "Math"].includes(r.section)) {
      return NextResponse.json({ error: `Request ${i}: Invalid section (must be RW or Math)` }, { status: 400 });
    }
    if (!r.category) {
      return NextResponse.json({ error: `Request ${i}: Missing category` }, { status: 400 });
    }
    if (!r.difficulty || !["easy", "medium", "hard"].includes(r.difficulty)) {
      return NextResponse.json({ error: `Request ${i}: Invalid difficulty (must be easy, medium, or hard)` }, { status: 400 });
    }
    if (!r.count || r.count < 1) {
      return NextResponse.json({ error: `Request ${i}: count must be >= 1` }, { status: 400 });
    }
  }

  const totalRequested = requests.reduce((sum, r) => sum + r.count, 0);
  if (totalRequested > GENERATION_CONFIG.batch.maxBatchSize) {
    return NextResponse.json({ error: `Total requested (${totalRequested}) exceeds max batch size (${GENERATION_CONFIG.batch.maxBatchSize})` }, { status: 400 });
  }

  const batchConfig: BatchGenerationConfig = {
    requests,
    diversityRules: diversityRules || {
      maxSameCategory: GENERATION_CONFIG.batch.defaultMaxSameCategory,
      difficultyDistribution: GENERATION_CONFIG.batch.defaultDiversityDistribution,
      requireCategorySpread: true,
      minCategorySpread: GENERATION_CONFIG.batch.defaultMinCategorySpread,
    },
    maxTotalQuestions: maxTotalQuestions || totalRequested,
  };

  try {
    const result = await runBatchGenerationPipeline(batchConfig);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Batch generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
