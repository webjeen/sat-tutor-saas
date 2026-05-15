import type {
  StudentWorksheet,
  AnswerKey,
  ExplanationPack,
} from "../assembly/types";
import type {
  LayoutValidationResult,
  LayoutValidationIssue,
} from "./types";

// -- Pre-render validation gates --
// From pdf-layout-spec.md §10 + CLAUDE.md validation layers

export function validateLayoutForExport(
  studentWorksheet: StudentWorksheet | null,
  answerKey: AnswerKey | null,
  explanationPack: ExplanationPack | null
): LayoutValidationResult {
  const issues: LayoutValidationIssue[] = [];
  const blockedReasons: string[] = [];

  // 1. Student worksheet validation
  if (studentWorksheet) {
    validateStudentWorksheet(studentWorksheet, issues, blockedReasons);
  }

  // 2. Answer key validation
  if (answerKey) {
    validateAnswerKey(answerKey, issues, blockedReasons);
  }

  // 3. Explanation pack validation
  if (explanationPack) {
    validateExplanationPack(explanationPack, issues, blockedReasons);
  }

  // 4. Cross-section consistency
  validateCrossSectionConsistency(
    studentWorksheet,
    answerKey,
    explanationPack,
    issues,
    blockedReasons
  );

  const passed = blockedReasons.length === 0;

  return { passed, issues, blockedReasons };
}

function validateStudentWorksheet(
  ws: StudentWorksheet,
  issues: LayoutValidationIssue[],
  blockedReasons: string[]
): void {
  if (ws.questions.length === 0) {
    addError(issues, blockedReasons, "empty_worksheet", "Student worksheet has no questions", null);
    return;
  }

  for (const q of ws.questions) {
    // No null/empty question text
    if (!q.question || q.question.trim().length === 0) {
      addError(issues, blockedReasons, "null_question_field", `Q${q.number} has empty question text`, q.number);
    }

    // No null/empty choices
    const choices = q.choices;
    const choiceLabels: (keyof typeof choices)[] = ["A", "B", "C", "D"];
    for (const label of choiceLabels) {
      if (!choices[label] || choices[label].trim().length === 0) {
        addError(issues, blockedReasons, "malformed_choice", `Q${q.number} choice ${label} is empty`, q.number);
      }
    }

    // No real SAT text leakage check
    checkForRealSATText(q.question, "question", q.number, issues, blockedReasons);
    for (const label of choiceLabels) {
      checkForRealSATText(choices[label], `choice_${label}`, q.number, issues, blockedReasons);
    }
    if (q.passage) {
      checkForRealSATText(q.passage, "passage", q.number, issues, blockedReasons);
    }

    // Hidden metadata leakage
    checkForHiddenMetadata(q.question, "question", q.number, issues, blockedReasons);
    for (const label of choiceLabels) {
      checkForHiddenMetadata(choices[label], `choice_${label}`, q.number, issues, blockedReasons);
    }
    if (q.passage) {
      checkForHiddenMetadata(q.passage, "passage", q.number, issues, blockedReasons);
    }
  }
}

function validateAnswerKey(
  ak: AnswerKey,
  issues: LayoutValidationIssue[],
  blockedReasons: string[]
): void {
  if (ak.answers.length === 0) {
    addWarning(issues, "empty_answer_key", "Answer key has no entries", null);
    return;
  }

  for (const a of ak.answers) {
    if (!a.correctChoice || !["A", "B", "C", "D"].includes(a.correctChoice)) {
      addError(issues, blockedReasons, "invalid_correct_choice", `Q${a.number} has invalid correct choice: "${a.correctChoice}"`, a.number);
    }
  }
}

function validateExplanationPack(
  ep: ExplanationPack,
  issues: LayoutValidationIssue[],
  _blockedReasons: string[]
): void {
  if (ep.explanations.length === 0) {
    addWarning(issues, "empty_explanation_pack", "Explanation pack has no entries", null);
    return;
  }

  for (const e of ep.explanations) {
    if (!e.tutorExplanation || e.tutorExplanation.trim().length === 0) {
      addWarning(issues, "missing_tutor_explanation", `Q${e.number} has no tutor explanation`, e.number);
    }

    if (e.wrongChoiceAnalysis) {
      for (const wca of e.wrongChoiceAnalysis) {
        if (!wca.text || wca.text.trim().length === 0) {
          addWarning(issues, "empty_wrong_choice_analysis", `Q${e.number} wrong choice ${wca.choice} has no text`, e.number);
        }
      }
    }
  }
}

function validateCrossSectionConsistency(
  ws: StudentWorksheet | null,
  ak: AnswerKey | null,
  ep: ExplanationPack | null,
  issues: LayoutValidationIssue[],
  blockedReasons: string[]
): void {
  if (!ws) return;

  const wsNumbers = new Set(ws.questions.map((q) => q.number));

  if (ak) {
    for (const a of ak.answers) {
      if (!wsNumbers.has(a.number)) {
        addError(issues, blockedReasons, "answer_key_mismatch", `Answer key Q${a.number} not in worksheet`, a.number);
      }
    }
  }

  if (ep) {
    for (const e of ep.explanations) {
      if (!wsNumbers.has(e.number)) {
        addError(issues, blockedReasons, "explanation_mismatch", `Explanation Q${e.number} not in worksheet`, e.number);
      }
    }
  }
}

// -- Real SAT text detection --
// Checks for known indicators of leaked real SAT content

const REAL_SAT_INDICATORS = [
  /college\s*board/i,
  /official\s*sat/i,
  /sat\s*practice\s*test\s*#\d/i,
  /question\s*id/i,
  /test\s*form/i,
  /section\s*\d+\s*.*\d+.*minutes/i,
];

function checkForRealSATText(
  text: string,
  field: string,
  questionNumber: number,
  issues: LayoutValidationIssue[],
  blockedReasons: string[]
): void {
  if (!text) return;

  for (const pattern of REAL_SAT_INDICATORS) {
    if (pattern.test(text)) {
      addError(
        issues,
        blockedReasons,
        "real_sat_text_detected",
        `Q${questionNumber} ${field} contains potential real SAT reference: "${pattern.source}"`,
        questionNumber
      );
    }
  }
}

// -- Hidden metadata leakage detection --
// Checks for embedded metadata that should not appear in output

const METADATA_INDICATORS = [
  /fingerprint/i,
  /template_id/i,
  /pattern_id/i,
  /generation_job/i,
  /internal_note/i,
  /\bid:[a-f0-9]{8,}\b/i,
  /ws:\d{10,}:/,
];

function checkForHiddenMetadata(
  text: string,
  field: string,
  questionNumber: number,
  issues: LayoutValidationIssue[],
  blockedReasons: string[]
): void {
  if (!text) return;

  for (const pattern of METADATA_INDICATORS) {
    if (pattern.test(text)) {
      addError(
        issues,
        blockedReasons,
        "hidden_metadata_leak",
        `Q${questionNumber} ${field} contains internal metadata: "${pattern.source}"`,
        questionNumber
      );
    }
  }
}

// -- Helpers --

function addError(
  issues: LayoutValidationIssue[],
  blockedReasons: string[],
  check: string,
  message: string,
  questionNumber: number | null
): void {
  issues.push({ severity: "error", check, message, questionNumber });
  blockedReasons.push(message);
}

function addWarning(
  issues: LayoutValidationIssue[],
  check: string,
  message: string,
  questionNumber: number | null
): void {
  issues.push({ severity: "warning", check, message, questionNumber });
}
