import { NextRequest, NextResponse } from "next/server";
import { fetchExtractionLogs } from "@/lib/supabase/fetchExtractionLogs";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const sourceQuestionId = searchParams.get("sourceQuestionId") || undefined;
  const patternId = searchParams.get("patternId") || undefined;
  const status = searchParams.get("status") || undefined;
  const limit = searchParams.get("limit")
    ? parseInt(searchParams.get("limit")!, 10)
    : undefined;
  const offset = searchParams.get("offset")
    ? parseInt(searchParams.get("offset")!, 10)
    : undefined;

  const { data, error } = await fetchExtractionLogs({
    sourceQuestionId,
    patternId,
    status,
    limit,
    offset,
  });

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json({ logs: data });
}
