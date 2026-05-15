import type {
  WorksheetAssemblyResult,
  StudentWorksheet,
  AnswerKey,
  ExplanationPack,
} from "../assembly/types";
import type {
  RenderDocument,
  RenderableStudentWorksheet,
  RenderableAnswerKey,
  RenderableExplanationPack,
} from "./types";
import { getOutputProfileDefinition } from "./config";

// -- Modular output profile builders --
// From output-selection-spec.md §4 + output-design.md §4

export function buildRenderDocument(
  assembly: WorksheetAssemblyResult,
  studentName: string | null
): RenderDocument {
  const profile = assembly.config.outputProfile;
  const definition = getOutputProfileDefinition(profile);

  if (!definition) {
    throw new Error(`Unknown output profile: ${profile}`);
  }

  const renderableWs = definition.includeStudentWorksheet
    ? toRenderableStudentWorksheet(assembly.studentWorksheet, assembly)
    : null;

  const renderableAk = definition.includeAnswerKey
    ? toRenderableAnswerKey(assembly.answerKey)
    : null;

  const renderableEp = definition.includeExplanationPack
    ? toRenderableExplanationPack(assembly.explanationPack, definition.includeTutorNotes, definition.includeStudentNotes)
    : null;

  return {
    profile,
    worksheetTitle: assembly.config.title,
    studentName,
    date: new Date().toISOString().split("T")[0],
    studentWorksheet: renderableWs,
    answerKey: renderableAk,
    explanationPack: renderableEp,
  };
}

// -- Conversion helpers --

function toRenderableStudentWorksheet(
  ws: StudentWorksheet,
  assembly: WorksheetAssemblyResult
): RenderableStudentWorksheet {
  return {
    title: ws.title,
    section: ws.section,
    instructions: ws.instructions,
    timeConstraintMinutes: ws.timeConstraintMinutes,
    questions: ws.questions.map((q, i) => {
      const aq = assembly.questions[i];
      return {
        number: q.number,
        passage: q.passage,
        question: q.question,
        choices: q.choices,
        section: aq?.section ?? ws.section,
        category: aq?.category ?? "",
      };
    }),
  };
}

function toRenderableAnswerKey(ak: AnswerKey): RenderableAnswerKey {
  return {
    title: ak.title,
    answers: ak.answers.map((a) => ({
      number: a.number,
      correctChoice: a.correctChoice,
      category: a.category,
      difficultyLevel: a.difficultyLevel,
    })),
  };
}

function toRenderableExplanationPack(
  ep: ExplanationPack,
  includeTutorNotes: boolean,
  includeStudentNotes: boolean
): RenderableExplanationPack {
  return {
    title: ep.title,
    explanations: ep.explanations.map((e) => ({
      number: e.number,
      correctChoice: e.correctChoice,
      category: e.category,
      tutorExplanation: includeTutorNotes ? e.tutorExplanation : "",
      studentExplanation: includeStudentNotes ? e.studentExplanation : "",
      wrongChoiceAnalysis: e.wrongChoiceAnalysis.map((wca) => ({
        choice: wca.choice,
        text: wca.text,
        strategy: wca.strategy,
      })),
    })),
  };
}
