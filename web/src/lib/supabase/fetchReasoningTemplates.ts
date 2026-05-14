import { supabase } from "./client";
import type { ReasoningTemplate } from "../library/types";

export async function fetchReasoningTemplates(
  section?: string,
  category?: string
): Promise<{ data: ReasoningTemplate[] | null; error: string | null }> {
  let query = supabase
    .from("reasoning_templates")
    .select("*")
    .order("category");

  if (section) query = query.eq("section", section);
  if (category) query = query.eq("category", category);

  const { data, error } = await query;

  if (error) return { data: null, error: error.message };
  return { data: (data || []) as ReasoningTemplate[], error: null };
}

export async function fetchReasoningTemplateById(
  templateId: string
): Promise<{ data: ReasoningTemplate | null; error: string | null }> {
  const { data, error } = await supabase
    .from("reasoning_templates")
    .select("*")
    .eq("id", templateId)
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as ReasoningTemplate, error: null };
}
