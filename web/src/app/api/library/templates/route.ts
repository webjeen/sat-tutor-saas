import { NextRequest, NextResponse } from "next/server";
import { fetchTemplates } from "@/lib/supabase/fetchTemplates";
import { buildPatternLibrary } from "@/lib/library/libraryService";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const filters = {
    section: searchParams.get("section") || undefined,
    category: searchParams.get("category") || undefined,
    subcategory: searchParams.get("subcategory") || undefined,
    status: searchParams.get("status") || undefined,
    distractor_pattern: searchParams.get("distractor_pattern") || undefined,
    difficulty_band: searchParams.get("difficulty_band") || undefined,
    reasoning_depth: searchParams.get("reasoning_depth") || undefined,
    min_readiness: searchParams.get("min_readiness") ? parseFloat(searchParams.get("min_readiness")!) : undefined,
    query: searchParams.get("query") || undefined,
    limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : undefined,
    offset: searchParams.get("offset") ? parseInt(searchParams.get("offset")!, 10) : undefined,
  };

  const { data, error, total } = await fetchTemplates(filters);

  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ templates: data, total });
}

export async function POST(request: NextRequest) {
  let body: { section?: string; category?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const result = await buildPatternLibrary({
    section: body.section as import("@/lib/library/types").Section | undefined,
    category: body.category as import("@/lib/library/types").LibraryCategory | undefined,
  });

  return NextResponse.json(result);
}
