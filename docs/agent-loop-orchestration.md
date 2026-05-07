Agent Loop Orchestration — SAT Tutor SaaS (FINAL)

---

## 0. Purpose

This document defines the state-driven agent loop architecture for the SAT Tutor Worksheet Generator SaaS.

The goal is to prevent manual bug-fixing loops by making Claude Code + GLM operate as an autonomous execution system that can:

* detect failure
* decide the next action
* retry safely
* route uncertain cases to review
* continue the pipeline only when validation passes

This project is not a simple code generation project.
It is a loop-based, validated content production system.

---

## 1. PM / Agent Role Separation

Human PM

Primary responsibilities:

* provide SAT source data
* define business priorities
* approve or reject review-required cases
* verify final product direction
* make high-level decisions

ChatGPT

* system architect
* planning assistant
* validation reviewer
* prompt designer
* documentation controller

Claude Code + GLM

* code executor
* implementation agent
* test runner
* error detector
* retry operator
* refactoring agent

---

## 2. Core Agent Loop

Plan
→ Implement
→ Run
→ Validate
→ Detect Failure
→ Decide Next Action
→ Fix / Retry / Route to Review
→ Re-run
→ Continue only when stable

---

## 3. System-Level Pipeline Loop

Upload
→ Parsing
→ Normalization
→ Input Validation
→ Deduplication
→ Review Queue
→ Approved Real Questions
→ Pattern Extraction
→ Generation
→ Generation Validation
→ Worksheet Assembly
→ Final Export Validation
→ Export
→ Feedback Learning

---

## 4. State Machine Requirement

Required fields:

status
processing_stage
retry_count
error_message
last_processed_at
created_at
updated_at

---

## 5. Standard Status Values

5.1 Base Processing Status

```ts
type ProcessingStatus =
  | 'pending'
  | 'processing'
  | 'success'
  | 'failed'
  | 'review_required'
  | 'approved'
  | 'rejected';
```
5.2 Ingestion Workflow Status

```ts
type IngestionStatus =
  | 'uploaded'
  | 'parsed'
  | 'validation_passed'
  | 'validation_failed'
  | 'dedup_clean'
  | 'duplicate'
  | 'similar'
  | 'in_review'
  | 'approved'
  | 'rejected';
```

5.3 Generation Workflow Status

```ts
type GenerationStatus =
  | 'generation_pending'
  | 'generation_processing'
  | 'generation_success'
  | 'generation_failed'
  | 'validation_pending'
  | 'validation_passed'
  | 'validation_failed'
  | 'approved_for_release'
  | 'rejected';
```
---

## 6. Decision Engine

Must act only from:

* state
* validation result
* issue type
* retry count

---

## 7. Decision Rules — Ingestion

IF parsing failed → retry (max 3) → else review_queue
IF validation hard_fail → reject
IF validation soft_fail → review_queue
IF duplicate → reject
IF similar → review_queue
IF clean → continue

---

## 8. Decision Rules — Generation

IF generation failed → retry → else review_queue
IF validation fails (duplicate) → regenerate
IF validation fails (logic) → discard
IF validation fails repeatedly → review_queue
IF validation success → approve

---

## 9. Validation Layers

* Real leak check
* Duplicate check
* Similarity check
* SAT style check
* Difficulty check
* Answer validity
* Explanation coherence
* User exposure

---

## 10. Retry Policy

Safe to retry:

* parsing error
* generation error
* API error

Not safe:

* ambiguous data
* unclear graph
* logic conflict

---

## 11. Rollback Policy

Generated question fails → remove
Worksheet fails → rebuild
Export fails → block
Pattern fails → revert

---

## 12. Review Queue

Used when AI cannot safely decide.

Includes:

* raw data
* parsed data
* issues
* recommended action

---

## 13. Logging

action
stage
status_before
status_after
error
retry_count

---

## 14. Orchestration Layer

src/lib/orchestration/

Files:

stateMachine.ts
decisionEngine.ts
pipelineRunner.ts
retryPolicy.ts

---

## 15. Ingestion Orchestration

```ts
async function runIngestionPipeline(fileInput) {
  const source = await registerUpload(fileInput);
  const parsed = await runWithRetry({
    stage: 'parsing',
    task: () => parseQuestions(source),
    maxRetries: 3,
  });
  for (const question of parsed.questions) {
    const validation = validateInputQuestion(question);
    const fingerprint = generateFingerprint(question);
    const dedup = await checkDuplicate(fingerprint);
    const decision = decideIngestionNextAction({
      validation,
      dedup,
      retryCount: question.retry_count,
    });
    if (decision.action === 'approve') {
      await insertRealQuestion(question, fingerprint);
    }
    if (decision.action === 'review') {
      await insertReviewQueue(question, validation, dedup);
    }
    if (decision.action === 'reject') {
      await logRejectedQuestion(question, validation, dedup);
    }
  }
}
```
---

## 16. Generation Orchestration

```ts
async function runGenerationPipeline(job) {
  while (job.retry_count < job.max_retries) {
    const generated = await generateQuestion(job.pattern, job.difficulty);
    const validation = await validateGeneratedQuestion(generated);
    const decision = decideGenerationNextAction(validation);
    if (decision.action === 'approve') {
      await markApprovedForRelease(generated);
      return generated;
    }
    if (decision.action === 'regenerate') {
      job.retry_count += 1;
      continue;
    }
    if (decision.action === 'review') {
      await insertReviewQueue(generated, validation);
      return null;
    }
    if (decision.action === 'discard') {
      await discardGeneratedQuestion(generated);
      return null;
    }
  }
  await markJobFailed(job);
}
```

---

## 17. Implementation Priority

Phase A:

* stateMachine
* decisionEngine
* retryPolicy

Phase B:

* generation loop
* validation loop

Phase C:

* export validation
* feedback system

---

## 18. Non-Negotiable Rules

* no failure bypass
* no infinite retry
* no unvalidated output
* no real data exposure

---

## 19. Success Criteria

* no crash on failure
* no duplicate leak
* safe retry
* review routing works

---

## 20. Final Principle

SAT Tutor SaaS is not a question generator.
It is a validation-loop-based production system.