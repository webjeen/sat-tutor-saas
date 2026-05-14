import { NextRequest, NextResponse } from "next/server";
import { fetchPatternById } from "@/lib/supabase/fetchPatterns";
import { fetchExtractionLogs } from "@/lib/supabase/fetchExtractionLogs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: pattern, error: patternError } = await fetchPatternById(id);

  if (patternError || !pattern) {
    return NextResponse.json(
      { error: patternError || "Pattern not found" },
      { status: 404 }
    );
  }

  const { data: logs } = await fetchExtractionLogs({
    patternId: id,
    limit: 50,
  });

  return NextResponse.json({ pattern, logs });
}
