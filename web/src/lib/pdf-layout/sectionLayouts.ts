import PDFDocument from "pdfkit";
import type {
  RenderableStudentWorksheet,
  RenderableQuestion,
  RenderableAnswerKey,
  RenderableExplanationPack,
  RenderableExplanationEntry,
} from "./types";
import { DEFAULT_PAGE_LAYOUT, SECTION_BREAK_RULES, EXPORT_CONFIG } from "./config";

type Doc = InstanceType<typeof PDFDocument>;

// -- Student Worksheet Layout --
// From pdf-layout-spec.md §4

export function renderStudentWorksheet(doc: Doc, ws: RenderableStudentWorksheet): void {
  const { fonts } = DEFAULT_PAGE_LAYOUT;

  // Header
  doc.fontSize(fonts.titleSize).font("Helvetica-Bold").text(ws.title, { align: "center" });
  doc.moveDown(0.5);

  // Name / Date / Time lines
  doc.fontSize(fonts.bodySize).font("Helvetica");
  doc.text(`Name: ________________________     Date: ________________`, { align: "left" });
  if (ws.timeConstraintMinutes) {
    doc.text(`Time Limit: ${ws.timeConstraintMinutes} minutes`, { align: "left" });
  }
  doc.moveDown(0.3);

  // Section label
  const sectionLabel = ws.section === "RW" ? "Reading & Writing" : "Math";
  doc.fontSize(fonts.bodySize).font("Helvetica-Bold").text(`${sectionLabel} Section`, { align: "left" });
  doc.moveDown(0.3);

  // Instructions
  doc.fontSize(fonts.bodySize).font("Helvetica").text(ws.instructions, { align: "left" });
  doc.moveDown(0.8);

  // Questions
  for (const q of ws.questions) {
    renderStudentQuestion(doc, q);
  }
}

function renderStudentQuestion(doc: Doc, q: RenderableQuestion): void {
  const { fonts } = DEFAULT_PAGE_LAYOUT;
  const minSpace = EXPORT_CONFIG.minBottomSpaceForQuestion;

  // Check if enough space for question + at least first choice
  if (doc.y > doc.page.height - doc.page.margins.bottom - minSpace) {
    doc.addPage();
  }

  // Passage (RW questions)
  if (q.passage) {
    doc.fontSize(fonts.bodySize - 1).font("Helvetica-Oblique");
    const passageHeight = doc.heightOfString(q.passage, { width: doc.page.width - doc.page.margins.left - doc.page.margins.right });

    if (doc.y + passageHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
    }

    doc.text(q.passage, { lineGap: 2 });
    doc.moveDown(0.4);
  }

  // Question number + text
  doc.fontSize(fonts.bodySize).font("Helvetica-Bold");
  doc.text(`${q.number}.`, { continued: true });
  doc.font("Helvetica").text(` ${q.question}`, { lineGap: 2 });
  doc.moveDown(0.3);

  // Choices
  const choiceLabels: (keyof typeof q.choices)[] = ["A", "B", "C", "D"];
  const choiceIndent = 24;

  for (const label of choiceLabels) {
    const choiceText = q.choices[label];
    if (!choiceText) continue;

    // Check space for this choice line
    if (doc.y > doc.page.height - doc.page.margins.bottom - 20) {
      doc.addPage();
    }

    doc.fontSize(fonts.choiceSize).font("Helvetica");
    doc.text(`${label})  ${choiceText}`, choiceIndent, undefined, {
      lineGap: 1,
      width: doc.page.width - doc.page.margins.left - doc.page.margins.right - choiceIndent,
    });
  }

  doc.moveDown(0.8);
}

// -- Answer Key Layout --
// From pdf-layout-spec.md §5

export function renderAnswerKey(doc: Doc, ak: RenderableAnswerKey): void {
  const { fonts } = DEFAULT_PAGE_LAYOUT;
  const rules = SECTION_BREAK_RULES.answer_key;

  if (rules.startOnNewPage) {
    doc.addPage();
  }

  doc.fontSize(fonts.titleSize).font("Helvetica-Bold").text(ak.title, { align: "center" });
  doc.moveDown(1);

  // Two-column compact layout
  const columnWidth = (doc.page.width - doc.page.margins.left - doc.page.margins.right) / EXPORT_CONFIG.answerKeyColumns;
  const leftX = doc.page.margins.left;
  const startY = doc.y;

  const halfIdx = Math.ceil(ak.answers.length / EXPORT_CONFIG.answerKeyColumns);

  for (let col = 0; col < EXPORT_CONFIG.answerKeyColumns; col++) {
    const colAnswers = ak.answers.slice(col * halfIdx, (col + 1) * halfIdx);
    const x = leftX + col * columnWidth;

    doc.x = x;
    doc.y = startY;

    for (const a of colAnswers) {
      doc.fontSize(fonts.choiceSize).font("Helvetica-Bold");
      doc.text(`Q${a.number}`, x, undefined, { continued: true, width: columnWidth - 10 });
      doc.font("Helvetica").text(`   ${a.correctChoice}`, { width: columnWidth - 10 });
    }
  }

  // Reset y below both columns
  const rightColBottom = doc.y;
  const leftColAnswers = ak.answers.slice(0, halfIdx);
  const leftColHeight = leftColAnswers.length * (fonts.choiceSize + 4);
  doc.y = Math.max(rightColBottom, startY + leftColHeight);
  doc.x = doc.page.margins.left;
}

// -- Explanation Pack Layout --
// From pdf-layout-spec.md §6

export function renderExplanationPack(doc: Doc, ep: RenderableExplanationPack): void {
  const { fonts } = DEFAULT_PAGE_LAYOUT;
  const rules = SECTION_BREAK_RULES.explanation_pack;

  if (rules.startOnNewPage) {
    doc.addPage();
  }

  doc.fontSize(fonts.titleSize).font("Helvetica-Bold").text(ep.title, { align: "center" });
  doc.moveDown(1);

  for (const e of ep.explanations) {
    renderExplanationEntry(doc, e);
  }
}

function renderExplanationEntry(doc: Doc, e: RenderableExplanationEntry): void {
  const { fonts } = DEFAULT_PAGE_LAYOUT;

  if (doc.y > doc.page.height - doc.page.margins.bottom - 80) {
    doc.addPage();
  }

  // Question number + correct answer
  doc.fontSize(fonts.bodySize).font("Helvetica-Bold");
  doc.text(`Q${e.number}`, { continued: true });
  doc.text(`   Correct Answer: ${e.correctChoice}`);
  doc.moveDown(0.3);

  // Tutor explanation
  if (e.tutorExplanation) {
    doc.fontSize(fonts.explanationSize).font("Helvetica-Bold");
    doc.text("Explanation:", { continued: true });
    doc.font("Helvetica").text(` ${e.tutorExplanation}`, { lineGap: 2 });
    doc.moveDown(0.3);
  }

  // Wrong choice analysis
  if (e.wrongChoiceAnalysis && e.wrongChoiceAnalysis.length > 0) {
    doc.fontSize(fonts.explanationSize - 1).font("Helvetica-Bold");
    doc.text("Wrong Choice Analysis:");
    doc.moveDown(0.2);

    for (const wca of e.wrongChoiceAnalysis) {
      if (doc.y > doc.page.height - doc.page.margins.bottom - 30) {
        doc.addPage();
      }

      doc.fontSize(fonts.explanationSize - 1).font("Helvetica-Bold");
      doc.text(`${wca.choice}:`, 24, undefined, { continued: true });
      doc.font("Helvetica");
      const analysisText = wca.strategy
        ? ` ${wca.text} (Strategy: ${wca.strategy})`
        : ` ${wca.text}`;
      doc.text(analysisText, {
        lineGap: 1,
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right - 24,
      });
      doc.moveDown(0.1);
    }
  }

  doc.moveDown(0.8);
}
