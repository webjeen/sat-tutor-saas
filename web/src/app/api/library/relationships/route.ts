import { NextRequest, NextResponse } from "next/server";
import { fetchRelationships } from "@/lib/supabase/fetchRelationships";
import { discoverRelationships } from "@/lib/library/relationshipMapper";
import { saveRelationships } from "@/lib/supabase/saveRelationship";
import { fetchPatterns } from "@/lib/supabase/fetchPatterns";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const filters = {
    source_id: searchParams.get("source_id") || undefined,
    source_type: searchParams.get("source_type") as import("@/lib/library/types").RelationshipEntityType | undefined,
    target_id: searchParams.get("target_id") || undefined,
    target_type: searchParams.get("target_type") as import("@/lib/library/types").RelationshipEntityType | undefined,
    relationship_type: searchParams.get("relationship_type") as import("@/lib/library/types").RelationshipType | undefined,
    min_strength: searchParams.get("min_strength") ? parseFloat(searchParams.get("min_strength")!) : undefined,
    confirmed_only: searchParams.get("confirmed_only") === "true",
    limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : undefined,
    offset: searchParams.get("offset") ? parseInt(searchParams.get("offset")!, 10) : undefined,
  };

  const { data, error } = await fetchRelationships(filters);
  if (error) return NextResponse.json({ error }, { status: 500 });

  return NextResponse.json({ relationships: data });
}

export async function POST() {
  const { data: patterns } = await fetchPatterns({ status: "pattern_active" });
  if (!patterns || patterns.length === 0) {
    return NextResponse.json({ created: 0, error: "No active patterns" });
  }

  const relationships = discoverRelationships(patterns);
  if (relationships.length === 0) {
    return NextResponse.json({ created: 0 });
  }

  const result = await saveRelationships(relationships);
  if (!result.success) {
    return NextResponse.json({ created: 0, error: result.error }, { status: 500 });
  }

  return NextResponse.json({ created: result.count });
}
