# Claude Code Execution Prompt — SAT SaaS Ingestion & Quality Pipeline (FINAL · Agent-Ready)

---

## 0. Role

You are operating inside Claude Code as an autonomous software engineer for the SAT Tutor Worksheet Generator SaaS project.

This prompt is the execution prompt for the ingestion quality layer.

Naming policy:

```text
SAT = product / brand
DSAT = current MVP execution scope
exam_family = DSAT
```

You must follow these exact project files and documentation references:

- `CLAUDE.md`
- `master-prompt.md`
- `implementation-roadmap.md`
- `docs/agent-loop-orchestration.md`
- `docs/ingestion-quality-roadmap.md`
- `docs/input-rw-spec.md`
- `docs/input-math-spec.md`
- `docs/input-gate-validation.md`
- `docs/duplicate-similarity-policy.md`
- `docs/ingestion-review-workflow.md`
- `docs/data-quality-pipeline.md`
- `docs/pattern-taxonomy.md`
- `docs/quality-validation.md`
- `docs/difficulty-spec.md`
- `docs/output-ui-ux.md`
- `docs/output-design.md`
- `docs/db-schema.md`
- `docs/usage-logging-versioning.md`
- `docs/agent-workflow.md`
- `docs/admin-internal-tool.md`
- `docs/legal-content-policy.md`
- `docs/auth-billing.md`
- `docs/master-design.md`

Your job is to implement the ingestion quality layer before pattern extraction.

---

## 1. Core Goal

Build the operational data quality pipeline for SAT real question ingestion.

Execution scope:

```text
exam_family = DSAT
sections = RW, Math
```

The system must accept `.md` or `.docx` files that follow the SAT RW / Math input specifications, parse them into structured JSON, validate them, detect duplicates, route suspicious items to review, and insert only approved questions into `real_questions`.

This phase is not a generation phase.

It is the protected ingestion and quality-control phase.

---

## 2. Absolute Rules

1. Do not expose `real_questions` externally.
2. Do not insert raw uploaded data directly into `real_questions`.
3. Do not skip validation.
4. Do not skip deduplication.
5. Do not allow `review_required` or `rejected` questions to be used for pattern extraction.
6. Only approved questions may become pattern extraction inputs.
7. Never infer missing SAT data.
8. If a problem contains uncertainty, route it to review.
9. Do not continue after failure without a state-based decision.
10. Do not retry forever.
11. Do not mark a phase complete without tests passing.

---

## 3. Required Agent Loop

Every implementation task must follow this loop:

```text
Plan
→ Implement
→ Run
→ Validate
→ Detect Failure
→ Decide Next Action
→ Fix / Retry / Route to Review
→ Re-run
→ Log
→ Continue only when stable
```

The human operator is the PM.

Claude Code + GLM must handle implementation, testing, error detection, safe retry, and refactoring.

---

## 4. Implementation Scope

Implement the following phases:

```text
Phase 4: Parser
Phase 4.5: Input Validation
Phase 4.6: Deduplication
Phase 4.7: Review System
Phase 4.8: Orchestration Layer
```

Do not implement full question generation until the ingestion quality layer is stable.

---

## 5. Phase 4 — Parser

### Goal

Parse `.md` files in the standard `[QUESTION_START]` format.

### Supported Sections

```text
DSAT RW
DSAT Math
```

### Required Files

```text
src/lib/parser/rwParser.ts
src/lib/parser/mathParser.ts
src/lib/parser/types.ts
src/lib/parser/parseQuestions.ts
```

### Required Type

```ts
type ParsedQuestion = {
  exam: 'DSAT';
  section: 'RW' | 'Math';
  module: number;
  questionId: string;
  questionType: string;
  passage?: string;
  question: string;
  choices: {
    A?: string;
    B?: string;
    C?: string;
    D?: string;
  };
  answer: 'A' | 'B' | 'C' | 'D' | 'NONE' | string;
  graph?: string;
  formula?: string;
  answerExplanation?: string;
  unclear?: string;
  rawBlock: string;
};
```

### Parser Requirements

- Split by `[QUESTION_START]` and `[QUESTION_END]`.
- Extract RW fields: `PASSAGE`, `QUESTION`, `CHOICES`, `ANSWER`, `UNCLEAR`.
- Extract Math fields: `QUESTION`, `CHOICES`, `GRAPH`, `FORMULA`, `ANSWER`, `ANSWER_EXPLANATION`, `UNCLEAR`.
- Do not infer missing fields.
- Missing or unreadable fields must be passed to validation, not silently repaired.

---

## 6. Phase 4.5 — Input Validation

### Goal

Validate parsed questions before DB insertion.

### Required Files

```text
src/lib/validation/inputValidator.ts
src/lib/validation/inputValidationTypes.ts
```

### Required Type

```ts
type InputValidationResult = {
  status: 'validation_passed' | 'review_required' | 'rejected';
  severity: 'clean' | 'soft_fail' | 'hard_fail';
  issues: string[];
  confidenceScore: number;
};
```

### Hard Fail → rejected

```text
missing [QUESTION_START] / [QUESTION_END]
missing Exam
missing Section
missing Module
missing Question_ID
missing Question_Type
missing QUESTION
invalid ANSWER value
```

### Soft Fail → review_required

```text
missing choices
empty choice A/B/C/D
UNCLEAR is not NONE
contains likely / inferred / maybe / assuming / probably
choice duplication
broken OCR-looking text
incomplete table or graph
underlined span described only in UNCLEAR
```

### Clean → validation_passed

Clean data may proceed to deduplication.

---

## 7. Phase 4.6 — Deduplication

### Goal

Detect exact duplicates, near duplicates, and suspicious variations before approval.

### Required Files

```text
src/lib/dedup/fingerprint.ts
src/lib/dedup/dedupChecker.ts
src/lib/dedup/dedupTypes.ts
```

### Fingerprint Fields

```text
text_hash
structure_hash
choice_hash
pattern_signature
```

Use deterministic hashing first.

Embedding similarity can be stubbed for now with TODO comments.

### Required Type

```ts
type DedupResult = {
  status: 'dedup_clean' | 'duplicate' | 'similar';
  matchedQuestionId?: string;
  similarityScore?: number;
  issues: string[];
};
```

### Decision

```text
exact duplicate → rejected
near duplicate → review_required
similar structure → review_required
clean → dedup_clean
```

---

## 8. Phase 4.7 — Review System

### Goal

Route suspicious or failed questions to review instead of inserting them directly into `real_questions`.

### Required Files

```text
src/lib/review/reviewRouter.ts
src/lib/review/reviewTypes.ts
app/admin/review/page.tsx
app/api/review/route.ts
```

### Review Status

```ts
type ReviewStatus =
  | 'review_required'
  | 'in_review'
  | 'approved'
  | 'rejected';
```

### Review Queue Table

If `review_queue` table does not exist in `schema.sql`, add a migration or SQL block.

```sql
create table if not exists review_queue (
    id uuid primary key default uuid_generate_v4(),
    source_kind text not null,
    raw_block text,
    parsed_json jsonb,
    issues jsonb,
    status text default 'review_required',
    reviewer_notes text,
    created_at timestamp default now(),
    updated_at timestamp default now(),
    reviewed_at timestamp
);
```

---

## 9. Phase 4.8 — Orchestration Layer

### Goal

Implement a state-driven execution layer so ingestion does not become a manual bug-fixing loop.

### Required Files

```text
src/lib/orchestration/stateMachine.ts
src/lib/orchestration/decisionEngine.ts
src/lib/orchestration/pipelineRunner.ts
src/lib/orchestration/retryPolicy.ts
src/lib/orchestration/logPipelineEvent.ts
```

### Required State Fields

Every major entity must support:

```text
status
processing_stage
retry_count
error_message
last_processed_at
created_at
updated_at
```

### Standard Decision Rules

```text
IF parsing fails:
  retry up to 3 times
  else route to review_queue

IF validation hard_fail:
  reject

IF validation soft_fail:
  route to review_queue

IF dedup duplicate:
  reject

IF dedup similar:
  route to review_queue

IF validation passed AND dedup clean:
  approve
```

---

## 10. DB Insert Rule

Only insert into `real_questions` if:

```text
input validation = validation_passed
AND dedup = dedup_clean
```

or:

```text
human reviewer manually approves
```

Never insert rejected items.

Never insert review_required items without approval.

---

## 11. Required Pipeline Function

Create one high-level function:

```text
src/lib/ingestion/ingestQuestions.ts
```

It must implement this logic:

```ts
async function ingestQuestions(inputText: string) {
  const parsed = parseQuestions(inputText);

  for (const question of parsed) {
    const validation = validateInputQuestion(question);
    const fingerprint = generateFingerprint(question);
    const dedup = await checkDuplicate(fingerprint);

    const decision = decideIngestionNextAction({
      validation,
      dedup,
      retryCount: question.retryCount ?? 0,
    });

    if (decision.action === 'approve') {
      await insertRealQuestion(question, fingerprint);
      await logPipelineEvent(question, decision);
      continue;
    }

    if (decision.action === 'review') {
      await insertReviewQueue(question, validation, dedup, decision);
      await logPipelineEvent(question, decision);
      continue;
    }

    if (decision.action === 'reject') {
      await logRejectedQuestion(question, validation, dedup, decision);
      await logPipelineEvent(question, decision);
      continue;
    }

    if (decision.action === 'retry') {
      await retryPipelineStep(question, decision);
      await logPipelineEvent(question, decision);
      continue;
    }
  }
}
```

---

## 12. Required Tests

Create tests or test scripts for:

```text
1. valid RW question parses correctly
2. valid Math question parses correctly
3. missing choice routes to review_required
4. UNCLEAR not NONE routes to review_required
5. invalid answer rejects
6. exact duplicate rejects
7. clean question can be approved
8. parser failure retries and then routes to review_queue
9. review_required items are not inserted into real_questions
```

Suggested files:

```text
tests/parser.test.ts
tests/inputValidation.test.ts
tests/dedup.test.ts
tests/ingestionPipeline.test.ts
```

---

## 13. Implementation Order

Work sequentially inside this ingestion phase:

```text
1. Create parser types
2. Implement parseQuestions
3. Implement rwParser
4. Implement mathParser
5. Implement inputValidator
6. Implement fingerprint generator
7. Implement dedupChecker
8. Implement reviewRouter
9. Implement orchestration layer
10. Implement ingestQuestions
11. Add tests
12. Run build and tests
13. Fix errors
14. Re-run until stable
```

Do not jump ahead.

---

## 14. Completion Criteria

The phase is complete only when:

```text
npm run build passes
parser tests pass
validation tests pass
dedup tests pass
ingestion pipeline tests pass
review_required items are not inserted into real_questions
approved-only insert rule is enforced
retry logic works
review routing works
```

---

## 15. Final Reminder

This pipeline protects the project from corrupted real SAT data.

Do not optimize for speed.

Optimize for correctness, traceability, and legal safety.

Start with Phase 4 Parser implementation now.

---

END
