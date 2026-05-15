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

// Rough height estimate for page-break decisions.
// Avoids doc.heightOfString() to prevent document-state side effects.

function estimateQuestionHeight(q: RenderableQuestion): number {
  const { fonts } = DEFAULT_PAGE_LAYOUT;
  const bodyLH = fonts.bodySize * fonts.lineSpacing;
  const choiceLH = fonts.choiceSize * fonts.lineSpacing;
  const passageLH = (fonts.bodySize - 1) * fonts.lineSpacing;
  const charsPerLine = 75; // conservative for Helvetica at body size on A4

  let height = 0;

  if (q.passage) {
    const lines = Math.max(Math.ceil(q.passage.length / charsPerLine), 1);
    height += lines * passageLH;
    height += bodyLH * 0.4; // moveDown(0.4)
  }

  const qText = `${q.number}. ${q.question}`;
  const qLines = Math.max(Math.ceil(qText.length / charsPerLine), 1);
  height += qLines * bodyLH;
  height += bodyLH * 0.3; // moveDown(0.3)

  for (const label of ["A", "B", "C", "D"] as const) {
    const ct = q.choices[label];
    if (!ct) continue;
    const cLines = Math.max(Math.ceil(ct.length / (charsPerLine - 3)), 1);
    height += cLines * choiceLH;
  }

  height += bodyLH * 0.8; // moveDown(0.8)

  return height;
}

function renderStudentQuestion(doc: Doc, q: RenderableQuestion): void {
  const { fonts } = DEFAULT_PAGE_LAYOUT;

  const availableSpace = doc.page.height - doc.page.margins.bottom - doc.y;
  const fullPageSpace = doc.page.height - doc.page.margins.top - doc.page.margins.bottom;
  const estimatedHeight = estimateQuestionHeight(q);

  // If the whole block fits on a fresh page but not here, start fresh
  if (estimatedHeight > availableSpace && estimatedHeight <= fullPageSpace) {
    doc.addPage();
  }

  // Passage (RW questions)
  if (q.passage) {
    doc.fontSize(fonts.bodySize - 1).font("Helvetica-Oblique");
    const passageHeight = doc.heightOfString(q.passage, {
      width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
    });

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

  // Choices — margin-relative indentation
  const choiceLabels: (keyof typeof q.choices)[] = ["A", "B", "C", "D"];
  const choiceX = doc.page.margins.left + EXPORT_CONFIG.choiceIndentPt;

  for (const label of choiceLabels) {
    const choiceText = q.choices[label];
    if (!choiceText) continue;

    if (doc.y > doc.page.height - doc.page.margins.bottom - 20) {
      doc.addPage();
    }

    doc.fontSize(fonts.choiceSize).font("Helvetica");
    doc.text(`${label})  ${choiceText}`, choiceX, undefined, {
      lineGap: 1,
      width: doc.page.width - choiceX - doc.page.margins.right,
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

  // Light rule under title
  const ruleY = doc.y;
  doc.strokeColor("#cccccc").lineWidth(0.5)
    .moveTo(doc.page.margins.left, ruleY)
    .lineTo(doc.page.width - doc.page.margins.right, ruleY)
    .stroke();
  doc.moveDown(0.5);

  // Two-column compact layout
  const columnWidth = (doc.page.width - doc.page.margins.left - doc.page.margins.right) / EXPORT_CONFIG.answerKeyColumns;
  const leftX = doc.page.margins.left;
  const startY = doc.y;
  const halfIdx = Math.ceil(ak.answers.length / EXPORT_CONFIG.answerKeyColumns);

  const columnBottoms: number[] = [];

  for (let col = 0; col < EXPORT_CONFIG.answerKeyColumns; col++) {
    const colAnswers = ak.answers.slice(col * halfIdx, (col + 1) * halfIdx);
    const x = leftX + col * columnWidth;

    doc.x = x;
    doc.y = startY;

    for (const a of colAnswers) {
      doc.fontSize(fonts.choiceSize).font("Helvetica-Bold");
      doc.text(`Q${a.number}`, x, undefined, { continued: true, width: columnWidth - 10 });
      doc.font("Helvetica").text(`  ${a.correctChoice}  (${a.difficultyLevel})`, { width: columnWidth - 10 });
    }

    columnBottoms.push(doc.y);
  }

  doc.y = Math.max(...columnBottoms);
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

  for (let i = 0; i < ep.explanations.length; i++) {
    renderExplanationEntry(doc, ep.explanations[i], i > 0);
  }
}

function renderExplanationEntry(doc: Doc, e: RenderableExplanationEntry, showSeparator: boolean): void {
  const { fonts } = DEFAULT_PAGE_LAYOUT;

  if (doc.y > doc.page.height - doc.page.margins.bottom - 80) {
    doc.addPage();
  }

  // Separator line between entries
  if (showSeparator) {
    const sepY = doc.y;
    doc.strokeColor("#dddddd").lineWidth(0.5)
      .moveTo(doc.page.margins.left, sepY)
      .lineTo(doc.page.width - doc.page.margins.right, sepY)
      .stroke();
    doc.moveDown(0.4);
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

  // Wrong choice analysis — margin-relative indentation
  if (e.wrongChoiceAnalysis && e.wrongChoiceAnalysis.length > 0) {
    doc.fontSize(fonts.explanationSize - 1).font("Helvetica-Bold");
    doc.text("Wrong Choice Analysis:");
    doc.moveDown(0.2);

    const wcaX = doc.page.margins.left + EXPORT_CONFIG.choiceIndentPt;

    for (const wca of e.wrongChoiceAnalysis) {
      if (doc.y > doc.page.height - doc.page.margins.bottom - 30) {
        doc.addPage();
      }

      doc.fontSize(fonts.explanationSize - 1).font("Helvetica-Bold");
      doc.text(`${wca.choice}:`, wcaX, undefined, { continued: true });
      doc.font("Helvetica");
      const analysisText = wca.strategy
        ? ` ${wca.text} (Strategy: ${wca.strategy})`
        : ` ${wca.text}`;
      doc.text(analysisText, {
        lineGap: 1,
        width: doc.page.width - wcaX - doc.page.margins.right,
      });
      doc.moveDown(0.1);
    }
  }

  doc.moveDown(0.8);
}
