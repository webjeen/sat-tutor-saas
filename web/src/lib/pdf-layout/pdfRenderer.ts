import PDFDocument from "pdfkit";
import type { RenderDocument } from "./types";
import { DEFAULT_PAGE_LAYOUT, HEADER_CONFIG, FOOTER_CONFIG } from "./config";
import {
  renderStudentWorksheet,
  renderAnswerKey,
  renderExplanationPack,
} from "./sectionLayouts";

type Doc = InstanceType<typeof PDFDocument>;

// -- Core PDF renderer --
// Takes a validated RenderDocument and produces a PDF Buffer

export async function renderPdf(doc: RenderDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pdfDoc = new PDFDocument({
      size: pageSizeToPdfkit(DEFAULT_PAGE_LAYOUT.size),
      margins: {
        top: mmToPoints(DEFAULT_PAGE_LAYOUT.margins.top),
        bottom: mmToPoints(DEFAULT_PAGE_LAYOUT.margins.bottom),
        left: mmToPoints(DEFAULT_PAGE_LAYOUT.margins.left),
        right: mmToPoints(DEFAULT_PAGE_LAYOUT.margins.right),
      },
      bufferPages: true,
    });

    const chunks: Buffer[] = [];
    pdfDoc.on("data", (chunk: Buffer) => chunks.push(chunk));
    pdfDoc.on("error", reject);
    pdfDoc.on("end", () => resolve(Buffer.concat(chunks)));

    try {
      // 1. Student Worksheet
      if (doc.studentWorksheet) {
        renderStudentWorksheet(pdfDoc, doc.studentWorksheet);
      }

      // 2. Answer Key
      if (doc.answerKey) {
        renderAnswerKey(pdfDoc, doc.answerKey);
      }

      // 3. Explanation Pack
      if (doc.explanationPack) {
        renderExplanationPack(pdfDoc, doc.explanationPack);
      }

      // 4. Headers and footers (post-render pass using buffered pages)
      addHeadersAndFooters(pdfDoc, doc);

      pdfDoc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// -- Post-render header/footer pass --
// Must temporarily suppress page-break logic for margin-area text.

function addHeadersAndFooters(pdfDoc: Doc, doc: RenderDocument): void {
  const range = pdfDoc.bufferedPageRange();

  for (let i = range.start; i < range.start + range.count; i++) {
    pdfDoc.switchToPage(i);

    // Suppress page-break triggers while writing in margin area
    const origBottom = pdfDoc.page.margins.bottom;
    pdfDoc.page.margins.bottom = 0;

    // Header — worksheet title (skip page 1, title already visible)
    if (i > 0) {
      pdfDoc.save();
      pdfDoc.fontSize(HEADER_CONFIG.fontSize).font("Helvetica").fillColor(HEADER_CONFIG.color);
      pdfDoc.text(
        doc.worksheetTitle,
        pdfDoc.page.margins.left,
        mmToPoints(HEADER_CONFIG.yOffsetMm),
        {
          width: pdfDoc.page.width - pdfDoc.page.margins.left - pdfDoc.page.margins.right,
          align: "left",
          lineBreak: false,
        }
      );
      pdfDoc.restore();
    }

    // Footer — page number on all pages
    pdfDoc.save();
    pdfDoc.fontSize(FOOTER_CONFIG.fontSize).font("Helvetica").fillColor(FOOTER_CONFIG.color);
    pdfDoc.text(
      `Page ${i + 1} of ${range.count}`,
      pdfDoc.page.margins.left,
      pdfDoc.page.height - mmToPoints(FOOTER_CONFIG.yOffsetMm) - FOOTER_CONFIG.fontSize,
      {
        width: pdfDoc.page.width - pdfDoc.page.margins.left - pdfDoc.page.margins.right,
        align: "center",
        lineBreak: false,
      }
    );
    pdfDoc.restore();

    // Restore original bottom margin
    pdfDoc.page.margins.bottom = origBottom;
  }
}

// -- Unit helpers --

function mmToPoints(mm: number): number {
  return mm * 2.83465;
}

function pageSizeToPdfkit(size: string): "A4" | "LETTER" {
  switch (size) {
    case "A4":
      return "A4";
    default:
      return "A4";
  }
}
