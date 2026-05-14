import { NextRequest, NextResponse } from "next/server";
import { runGenerationPipeline } from "@/lib/generation/generationOrchestrator";
import type { Section, LibraryCategory } from "@/lib/library/types";
import { GENERATION_CONFIG } from "@/lib/generation/config";

export async function POST(request: NextRequest) {
  let body: {
    section?: string;
    category?: string;
    difficulty?: string;
    count?: number;
    templateId?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { section, category, difficulty, count, templateId } = body;

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

  const config = {
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
