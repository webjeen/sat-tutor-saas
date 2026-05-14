import { NextRequest, NextResponse } from "next/server";
import { extractPatternsFromApprovedQuestions } from "@/lib/extraction/extractionService";
import type { Section } from "@/lib/extraction/types";

export async function POST(request: NextRequest) {
  const options: { section?: Section; limit?: number; skipAlreadyExtracted?: boolean } = {};

  try {
    const body = await request.json();
    if (body.section && (body.section === "RW" || body.section === "Math")) {
      options.section = body.section;
    }
    if (body.limit && typeof body.limit === "number") {
      options.limit = body.limit;
    }
    if (body.skipAlreadyExtracted !== undefined) {
      options.skipAlreadyExtracted = body.skipAlreadyExtracted;
    }
  } catch {
    // No body or invalid JSON — use defaults
  }

  const result = await extractPatternsFromApprovedQuestions(options);

  return NextResponse.json(result);
}
