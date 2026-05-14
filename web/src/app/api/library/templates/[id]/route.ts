import { NextRequest, NextResponse } from "next/server";
import { fetchTemplateById } from "@/lib/supabase/fetchTemplates";
import { fetchRelationships } from "@/lib/supabase/fetchRelationships";
import { fetchPatternMetadata } from "@/lib/supabase/fetchPatternMetadata";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: template, error: templateError } = await fetchTemplateById(id);
  if (templateError || !template) {
    return NextResponse.json({ error: templateError || "Template not found" }, { status: 404 });
  }

  const { data: relationships } = await fetchRelationships({
    source_id: id,
    source_type: "template",
    limit: 50,
  });

  const incomingRels = await fetchRelationships({
    target_id: id,
    target_type: "template",
    limit: 50,
  });

  const allRelationships = [
    ...(relationships || []),
    ...(incomingRels.data || []),
  ];

  // Fetch metadata for source patterns
  const metadataPromises = (template.source_pattern_ids || []).slice(0, 10).map(
    (pid: string) => fetchPatternMetadata(pid)
  );
  const metadataResults = await Promise.all(metadataPromises);
  const metadata = metadataResults
    .filter((r) => r.data !== null)
    .map((r) => r.data);

  return NextResponse.json({ template, relationships: allRelationships, metadata });
}
