import PDFDocument from "pdfkit";
import type { RenderDocument } from "./types";
import { DEFAULT_PAGE_LAYOUT } from "./config";
import {
  renderStudentWorksheet,
  renderAnswerKey,
  renderExplanationPack,
} from "./sectionLayouts";

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

      pdfDoc.end();
    } catch (err) {
      reject(err);
    }
  });
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
