import { NextRequest, NextResponse } from "next/server";
import { fetchPatterns } from "@/lib/supabase/fetchPatterns";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const section = searchParams.get("section") || undefined;
  const type = searchParams.get("type") || undefined;
  const status = searchParams.get("status") || undefined;
  const limit = searchParams.get("limit")
    ? parseInt(searchParams.get("limit")!, 10)
    : undefined;
  const offset = searchParams.get("offset")
    ? parseInt(searchParams.get("offset")!, 10)
    : undefined;

  const { data, error } = await fetchPatterns({
    section,
    type,
    status,
    limit,
    offset,
  });

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json({ patterns: data });
}
