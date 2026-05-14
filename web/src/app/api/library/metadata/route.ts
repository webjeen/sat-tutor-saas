import { NextRequest, NextResponse } from "next/server";
import { fetchAllMetadata } from "@/lib/supabase/fetchPatternMetadata";
import { refreshPatternMetadata } from "@/lib/library/libraryService";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const minReadiness = searchParams.get("min_readiness")
    ? parseFloat(searchParams.get("min_readiness")!)
    : undefined;

  const { data, error } = await fetchAllMetadata(minReadiness);
  if (error) return NextResponse.json({ error }, { status: 500 });

  return NextResponse.json({ metadata: data });
}

export async function POST() {
  const result = await refreshPatternMetadata();
  return NextResponse.json(result);
}
