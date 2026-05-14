import { NextRequest, NextResponse } from "next/server";
import { fetchGeneratedQuestions } from "@/lib/supabase/fetchGeneratedQuestions";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const filters = {
    section: searchParams.get("section") || undefined,
    category: searchParams.get("category") || undefined,
    status: searchParams.get("status") || undefined,
    difficulty_level: searchParams.get("difficulty_level") || undefined,
    approved_for_release: searchParams.get("approved") === "true" ? true : undefined,
    template_id: searchParams.get("template_id") || undefined,
    limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 20,
    offset: searchParams.get("offset") ? parseInt(searchParams.get("offset")!) : undefined,
  };

  const { data, total, error } = await fetchGeneratedQuestions(filters);

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json({ questions: data, total });
}
