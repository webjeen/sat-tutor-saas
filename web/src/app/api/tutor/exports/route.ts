import { NextRequest, NextResponse } from "next/server";
import { fetchExportHistory, fetchExportsForJob } from "@/lib/tutor/persistence";

// GET /api/tutor/exports — Fetch export history
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");
  const limit = parseInt(searchParams.get("limit") ?? "20", 10);

  if (jobId) {
    const exports = await fetchExportsForJob(jobId);
    return NextResponse.json({ exports });
  }

  const exports = await fetchExportHistory(Math.min(limit, 100));
  return NextResponse.json({ exports });
}
