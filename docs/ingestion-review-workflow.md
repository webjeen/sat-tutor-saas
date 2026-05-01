# SAT Tutor SaaS Ingestion & Review Workflow (FINAL · Agent-Ready)

---

## 0. Purpose

Defines end-to-end ingestion workflow.

Naming policy:
SAT = product / brand
DSAT = execution scope (MVP)
exam_family = DSAT

Must be used with:
- docs/agent-loop-orchestration.md
- docs/ingestion-quality-roadmap.md
- docs/input-gate-validation.md
- docs/duplicate-similarity-policy.md
- docs/data-quality-pipeline.md
- docs/input-rw-spec.md
- docs/input-math-spec.md
- docs/db-schema.md

---

## 1. Workflow

Upload
→ Input Gate
→ Parser
→ Validation
→ Deduplication
→ Decision Engine
→ Review / Reject / Approve
→ DB Insert

---

## 2. Agent Loop

Receive
→ Execute
→ Validate
→ Detect Failure
→ Decide
→ Retry / Review / Continue
→ Log

---

## 3. State Machine

status
processing_stage
retry_count
error_message
last_processed_at
created_at
updated_at

Flow:

uploaded
→ input_gate_processing
→ parsed
→ validation_passed / validation_failed
→ dedup_clean / duplicate / similar
→ review_required
→ in_review
→ approved / rejected

---

## 4. Decision Engine

validation_failed → reject
duplicate → reject
review_required → review
similar → review
validation_passed + dedup_clean → approve
retry < 3 → retry
retry ≥ 3 → review

---

## 5. Retry Policy

technical error only
max_retries = 3
else → review_queue

---

## 6. DB Rule

Insert ONLY if:
validation_passed AND dedup_clean
OR manual approval

---

## 7. Logging

timestamp
stage
status_before
status_after
decision
decision_reason
retry_count

---

## 8. Core Rule

No validation → no insert

---

END
