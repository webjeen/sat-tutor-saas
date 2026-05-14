import { NextRequest, NextResponse } from "next/server";
import { fetchTemplateById, updateTemplateStatus } from "@/lib/supabase/fetchTemplates";
import { TEMPLATE_TRANSITIONS } from "@/lib/library/types";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let body: { status?: string; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const newStatus = body.status;
  const reason = body.reason || "";

  if (!newStatus) {
    return NextResponse.json({ error: "Missing required field: status" }, { status: 400 });
  }

  // Fetch current status to validate transition
  const { data: template, error: fetchError } = await fetchTemplateById(id);
  if (fetchError || !template) {
    return NextResponse.json({ error: fetchError || "Template not found" }, { status: 404 });
  }

  const currentStatus = template.status as keyof typeof TEMPLATE_TRANSITIONS;
  const allowedTargets = TEMPLATE_TRANSITIONS[currentStatus];

  if (!allowedTargets) {
    return NextResponse.json(
      { error: `No transitions allowed from status "${currentStatus}"` },
      { status: 400 }
    );
  }

  if (!allowedTargets.includes(newStatus as typeof allowedTargets[number])) {
    return NextResponse.json(
      {
        error: `Invalid transition: "${currentStatus}" → "${newStatus}". Allowed: [${allowedTargets.join(", ")}]`,
        currentStatus,
        allowedTargets,
      },
      { status: 400 }
    );
  }

  const { success, error } = await updateTemplateStatus(id, newStatus, reason);
  if (!success) return NextResponse.json({ error }, { status: 500 });

  return NextResponse.json({
    success: true,
    templateId: id,
    previousStatus: currentStatus,
    newStatus,
  });
}
