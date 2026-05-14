import { NextRequest, NextResponse } from "next/server";
import { fetchGeneratedQuestionById } from "@/lib/supabase/fetchGeneratedQuestions";
import { fetchValidationResults } from "@/lib/supabase/fetchValidationResults";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: question, error: qError } = await fetchGeneratedQuestionById(id);
  if (qError || !question) {
    return NextResponse.json({ error: qError || "Question not found" }, { status: 404 });
  }

  const { data: validation } = await fetchValidationResults({
    generated_question_id: id,
  });

  return NextResponse.json({
    question,
    validation: validation || [],
  });
}
