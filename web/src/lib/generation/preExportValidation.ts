import type {
  PreExportValidationResult,
  PreExportCheck,
} from "./types";
import type { WorksheetValidationResult } from "../assembly/types";
import { supabase } from "../supabase/client";

export async function runPreExportValidation(
  questionIds: string[],
  worksheetValidation: WorksheetValidationResult | null
): Promise<PreExportValidationResult> {
  const checks: PreExportCheck[] = [];
  const blockedReasons: string[] = [];

  // 1. All questions must be approved_for_release
  const approvalCheck = await checkAllQuestionsApproved(questionIds);
  checks.push(approvalCheck);
  if (!approvalCheck.passed && approvalCheck.reason) {
    blockedReasons.push(approvalCheck.reason);
  }

  // 2. Worksheet validation must have passed
  const worksheetGate = checkWorksheetValidation(worksheetValidation);
  checks.push(worksheetGate);
  if (!worksheetGate.passed && worksheetGate.reason) {
    blockedReasons.push(worksheetGate.reason);
  }

  // 3. No real data exposure in output (check generated questions don't match real questions)
  const exposureCheck = await checkNoRealDataExposure(questionIds);
  checks.push(exposureCheck);
  if (!exposureCheck.passed && exposureCheck.reason) {
    blockedReasons.push(exposureCheck.reason);
  }

  // 4. All fingerprints must be unique within the set
  const fingerprintUniqueness = await checkFingerprintUniqueness(questionIds);
  checks.push(fingerprintUniqueness);
  if (!fingerprintUniqueness.passed && fingerprintUniqueness.reason) {
    blockedReasons.push(fingerprintUniqueness.reason);
  }

  // 5. All questions must have validation results recorded
  const validationResultsExist = await checkValidationResultsExist(questionIds);
  checks.push(validationResultsExist);
  if (!validationResultsExist.passed && validationResultsExist.reason) {
    blockedReasons.push(validationResultsExist.reason);
  }

  // 6. No question in review_required state
  const noReviewRequired = await checkNoReviewRequired(questionIds);
  checks.push(noReviewRequired);
  if (!noReviewRequired.passed && noReviewRequired.reason) {
    blockedReasons.push(noReviewRequired.reason);
  }

  const cleared = blockedReasons.length === 0;

  return { cleared, checks, blockedReasons };
}

async function checkAllQuestionsApproved(
  questionIds: string[]
): Promise<PreExportCheck> {
  if (questionIds.length === 0) {
    return {
      name: "all_questions_approved",
      passed: false,
      reason: "No questions provided for export",
    };
  }

  const { data } = await supabase
    .from("generated_questions")
    .select("id, approved_for_release, status")
    .in("id", questionIds);

  if (!data || data.length !== questionIds.length) {
    return {
      name: "all_questions_approved",
      passed: false,
      reason: `Only ${data?.length || 0}/${questionIds.length} questions found in DB`,
    };
  }

  const notApproved = data.filter(
    (q: Record<string, unknown>) => !q.approved_for_release
  );
  if (notApproved.length > 0) {
    const ids = notApproved.map((q: Record<string, unknown>) => q.id).join(", ");
    return {
      name: "all_questions_approved",
      passed: false,
      reason: `${notApproved.length} question(s) not approved: ${ids}`,
    };
  }

  return { name: "all_questions_approved", passed: true, reason: null };
}

function checkWorksheetValidation(
  validation: WorksheetValidationResult | null
): PreExportCheck {
  if (!validation) {
    return {
      name: "worksheet_validation",
      passed: false,
      reason: "Worksheet validation result not provided",
    };
  }

  if (!validation.allPassed) {
    return {
      name: "worksheet_validation",
      passed: false,
      reason: `Worksheet validation failed: [${validation.failedChecks.join(", ")}]`,
    };
  }

  return { name: "worksheet_validation", passed: true, reason: null };
}

async function checkNoRealDataExposure(
  questionIds: string[]
): Promise<PreExportCheck> {
  if (questionIds.length === 0) {
    return { name: "no_real_data_exposure", passed: true, reason: null };
  }

  const { data: generated } = await supabase
    .from("generated_questions")
    .select("id, fingerprint_text")
    .in("id", questionIds);

  if (!generated || generated.length === 0) {
    return { name: "no_real_data_exposure", passed: true, reason: null };
  }

  const fingerprints = generated
    .map((q: Record<string, unknown>) => q.fingerprint_text as string | null)
    .filter((f): f is string => f !== null && f.length > 0);

  if (fingerprints.length === 0) {
    return { name: "no_real_data_exposure", passed: true, reason: null };
  }

  const { data: realMatches } = await supabase
    .from("real_questions")
    .select("id, fingerprint_text")
    .in("fingerprint_text", fingerprints);

  if (realMatches && realMatches.length > 0) {
    return {
      name: "no_real_data_exposure",
      passed: false,
      reason: `${realMatches.length} generated question(s) have fingerprints matching real questions`,
    };
  }

  return { name: "no_real_data_exposure", passed: true, reason: null };
}

async function checkFingerprintUniqueness(
  questionIds: string[]
): Promise<PreExportCheck> {
  if (questionIds.length <= 1) {
    return { name: "fingerprint_uniqueness", passed: true, reason: null };
  }

  const { data } = await supabase
    .from("generated_questions")
    .select("id, fingerprint_text")
    .in("id", questionIds);

  if (!data) {
    return { name: "fingerprint_uniqueness", passed: true, reason: null };
  }

  const fingerprintCounts: Record<string, number> = {};
  for (const q of data) {
    const fp = (q as Record<string, unknown>).fingerprint_text as string | null;
    if (fp) {
      fingerprintCounts[fp] = (fingerprintCounts[fp] || 0) + 1;
    }
  }

  const duplicates = Object.entries(fingerprintCounts).filter(
    ([, count]) => count > 1
  );
  if (duplicates.length > 0) {
    return {
      name: "fingerprint_uniqueness",
      passed: false,
      reason: `${duplicates.length} duplicate fingerprint(s) found in export set`,
    };
  }

  return { name: "fingerprint_uniqueness", passed: true, reason: null };
}

async function checkValidationResultsExist(
  questionIds: string[]
): Promise<PreExportCheck> {
  if (questionIds.length === 0) {
    return { name: "validation_results_exist", passed: true, reason: null };
  }

  const { data } = await supabase
    .from("validation_results")
    .select("generated_question_id")
    .in("generated_question_id", questionIds);

  const validatedIds = new Set(
    (data || []).map((r: Record<string, unknown>) => r.generated_question_id as string)
  );

  const missing = questionIds.filter((id) => !validatedIds.has(id));
  if (missing.length > 0) {
    return {
      name: "validation_results_exist",
      passed: false,
      reason: `${missing.length} question(s) have no validation results recorded`,
    };
  }

  return { name: "validation_results_exist", passed: true, reason: null };
}

async function checkNoReviewRequired(
  questionIds: string[]
): Promise<PreExportCheck> {
  if (questionIds.length === 0) {
    return { name: "no_review_required", passed: true, reason: null };
  }

  const { data } = await supabase
    .from("generated_questions")
    .select("id, status")
    .in("id", questionIds);

  if (!data) {
    return { name: "no_review_required", passed: true, reason: null };
  }

  const inReview = data.filter(
    (q: Record<string, unknown>) => q.status === "review_required" || q.status === "generation_pending"
  );
  if (inReview.length > 0) {
    const ids = inReview.map((q: Record<string, unknown>) => q.id).join(", ");
    return {
      name: "no_review_required",
      passed: false,
      reason: `${inReview.length} question(s) still in review: ${ids}`,
    };
  }

  return { name: "no_review_required", passed: true, reason: null };
}
