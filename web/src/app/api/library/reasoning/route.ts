import { NextRequest, NextResponse } from "next/server";
import { fetchReasoningTemplates } from "@/lib/supabase/fetchReasoningTemplates";
import { seedReasoningTemplates } from "@/lib/supabase/saveReasoningTemplate";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const section = searchParams.get("section") || undefined;
  const category = searchParams.get("category") || undefined;

  const { data, error } = await fetchReasoningTemplates(section, category);
  if (error) return NextResponse.json({ error }, { status: 500 });

  return NextResponse.json({ templates: data });
}

export async function POST() {
  const result = await seedReasoningTemplates();
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 });

  return NextResponse.json({ success: true, message: "Reasoning templates seeded" });
}
