import { NextRequest, NextResponse } from "next/server";
import { submitExportJob } from "@/lib/pdf-layout/exportOrchestrator";
import type { WorksheetAssemblyResult, OutputProfile } from "@/lib/assembly/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { assemblyResult, profile, studentName } = body as {
      assemblyResult: WorksheetAssemblyResult;
      profile: OutputProfile;
      studentName?: string;
    };

    if (!assemblyResult || !profile) {
      return NextResponse.json(
        { error: "Missing required fields: assemblyResult, profile" },
        { status: 400 }
      );
    }

    if (!assemblyResult.validation?.allPassed) {
      return NextResponse.json(
        { error: "Assembly validation has not passed — cannot export" },
        { status: 422 }
      );
    }

    const result = await submitExportJob(
      assemblyResult,
      profile,
      studentName ?? null
    );

    if (result.status === "failed") {
      return NextResponse.json(
        {
          error: "Export failed",
          jobId: result.jobId,
          errorMessage: result.errorMessage,
          validation: result.validation,
        },
        { status: 500 }
      );
    }

    if (result.pdfBuffer) {
      return new NextResponse(new Uint8Array(result.pdfBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${assemblyResult.config.title.replace(/\s+/g, "_")}.pdf"`,
        },
      });
    }

    return NextResponse.json(
      { error: "Export produced no PDF output", jobId: result.jobId },
      { status: 500 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown export error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
