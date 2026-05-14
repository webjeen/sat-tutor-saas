import { NextRequest, NextResponse } from "next/server";
import { fetchDistractorCatalog } from "@/lib/supabase/fetchDistractorCatalog";
import { seedDistractorCatalog } from "@/lib/supabase/saveDistractorCatalog";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const section = searchParams.get("section") || undefined;

  const { data, error } = await fetchDistractorCatalog(section);
  if (error) return NextResponse.json({ error }, { status: 500 });

  return NextResponse.json({ catalog: data });
}

export async function POST() {
  const result = await seedDistractorCatalog();
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 });

  return NextResponse.json({ success: true, message: "Distractor catalog seeded" });
}
