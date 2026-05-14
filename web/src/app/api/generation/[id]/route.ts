import { NextRequest, NextResponse } from "next/server";
import { fetchGenerationJobById } from "@/lib/supabase/fetchGenerationJobs";
import { fetchGeneratedQuestions } from "@/lib/supabase/fetchGeneratedQuestions";
import { fetchValidationResults } from "@/lib/supabase/fetchValidationResults";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: job, error: jobError } = await fetchGenerationJobById(id);
  if (jobError || !job) {
    return NextResponse.json({ error: jobError || "Job not found" }, { status: 404 });
  }

  const { data: questions } = await fetchGeneratedQuestions({
    template_id: job.template_id || undefined,
    limit: job.question_count_requested,
  });

  const jobQuestions = questions?.filter((q) => q.template_id === job.template_id) || [];

  const validationPromises = jobQuestions.map((q) =>
    fetchValidationResults({ generated_question_id: q.id, limit: 1 })
  );
  const validationResults = await Promise.all(validationPromises);

  const questionsWithValidation = jobQuestions.map((q, i) => ({
    ...q,
    validation: validationResults[i]?.data?.[0] || null,
  }));

  return NextResponse.json({
    job,
    questions: questionsWithValidation,
  });
}
