// PDF Layout Engine — Public API

export { renderPdf } from "./pdfRenderer";
export { validateLayoutForExport } from "./layoutValidator";
export { buildRenderDocument } from "./outputProfiles";
export {
  submitExportJob,
  getExportJob,
  getExportLogs,
} from "./exportOrchestrator";
export { getOutputProfileDefinition } from "./config";
export {
  renderStudentWorksheet,
  renderAnswerKey,
  renderExplanationPack,
} from "./sectionLayouts";

export type {
  PageLayout,
  PageSize,
  PageMargins,
  FontConfig,
  SectionType,
  SectionBreakRule,
  RenderableStudentWorksheet,
  RenderableQuestion,
  RenderableAnswerKey,
  RenderableAnswerEntry,
  RenderableExplanationPack,
  RenderableExplanationEntry,
  RenderDocument,
  LayoutValidationResult,
  LayoutValidationIssue,
  LayoutValidationSeverity,
  ExportJob,
  ExportJobStatus,
  ExportResult,
  OutputProfileDefinition,
} from "./types";
