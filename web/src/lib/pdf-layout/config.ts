import type {
  PageLayout,
  SectionBreakRule,
  OutputProfileDefinition,
} from "./types";

// -- Page layout (from pdf-layout-spec.md §2) --

export const DEFAULT_PAGE_LAYOUT: PageLayout = {
  size: "A4",
  margins: {
    top: 20,
    bottom: 20,
    left: 15,
    right: 15,
  },
  fonts: {
    titleSize: 16,
    bodySize: 12,
    choiceSize: 11,
    explanationSize: 11,
    lineSpacing: 1.4,
  },
};

// -- Section break rules (from pdf-layout-spec.md §8) --

export const SECTION_BREAK_RULES: Record<string, SectionBreakRule> = {
  student_worksheet: {
    startOnNewPage: false,
    avoidSplitQuestion: true,
    avoidSplitPassage: true,
  },
  answer_key: {
    startOnNewPage: true,
    avoidSplitQuestion: false,
    avoidSplitPassage: false,
  },
  explanation_pack: {
    startOnNewPage: true,
    avoidSplitQuestion: false,
    avoidSplitPassage: false,
  },
};

// -- Output profile definitions (from output-selection-spec.md §4) --

export const OUTPUT_PROFILE_DEFINITIONS: OutputProfileDefinition[] = [
  {
    profile: "student_clean",
    includeStudentWorksheet: true,
    includeAnswerKey: false,
    includeExplanationPack: false,
    includeTutorNotes: false,
    includeStudentNotes: false,
  },
  {
    profile: "homework_with_key",
    includeStudentWorksheet: true,
    includeAnswerKey: true,
    includeExplanationPack: false,
    includeTutorNotes: false,
    includeStudentNotes: false,
  },
  {
    profile: "tutor_compact",
    includeStudentWorksheet: true,
    includeAnswerKey: true,
    includeExplanationPack: false,
    includeTutorNotes: true,
    includeStudentNotes: false,
  },
  {
    profile: "full_review_pack",
    includeStudentWorksheet: true,
    includeAnswerKey: true,
    includeExplanationPack: true,
    includeTutorNotes: true,
    includeStudentNotes: true,
  },
  {
    profile: "test_mode",
    includeStudentWorksheet: true,
    includeAnswerKey: false,
    includeExplanationPack: false,
    includeTutorNotes: false,
    includeStudentNotes: false,
  },
];

// -- Export config --

export const EXPORT_CONFIG = {
  maxRetries: 3,
  renderTimeoutMs: 30000,
  maxQuestionsPerPage: 8,
  answerKeyColumns: 2,
  minBottomSpaceForQuestion: 120,
} as const;

export function getOutputProfileDefinition(
  profile: string
): OutputProfileDefinition | undefined {
  return OUTPUT_PROFILE_DEFINITIONS.find((p) => p.profile === profile);
}
