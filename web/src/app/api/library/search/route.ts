import { NextRequest, NextResponse } from "next/server";
import { searchTemplatesByText } from "@/lib/library/librarySearch";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const query = searchParams.get("query");

  if (!query) {
    return NextResponse.json({ error: "Missing required param: query" }, { status: 400 });
  }

  const section = searchParams.get("section") || undefined;
  const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 20;

  const { data, error } = await searchTemplatesByText(query, limit);
  if (error) return NextResponse.json({ error }, { status: 500 });

  // Filter by section if specified
  const filtered = section ? (data || []).filter((t) => t.section === section) : data;

  return NextResponse.json({ templates: filtered });
}
