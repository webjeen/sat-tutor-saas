import { NextRequest, NextResponse } from "next/server";
import { fetchGenerationJobById } from "@/lib/supabase/fetchGenerationJobs";
import { updateGenerationJob } from "@/lib/supabase/saveGenerationJob";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let body: { status?: string; error_message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { status } = body;
  if (!status) {
    return NextResponse.json({ error: "Missing required field: status" }, { status: 400 });
  }

  const { data: job, error: fetchError } = await fetchGenerationJobById(id);
  if (fetchError || !job) {
    return NextResponse.json({ error: fetchError || "Job not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = { status };
  if (body.error_message) updates.error_message = body.error_message;

  const { success, error: updateError } = await updateGenerationJob(id, updates);
  if (!success) {
    return NextResponse.json({ error: updateError }, { status: 500 });
  }

  return NextResponse.json({ success: true, jobId: id, newStatus: status });
}
