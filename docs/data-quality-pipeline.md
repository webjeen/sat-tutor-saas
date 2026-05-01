# SAT Tutor SaaS Data Quality Pipeline Guideline (FINAL · Agent-Ready)

---

## 0. Purpose

Defines the backend execution logic for the ingestion data quality pipeline.

Naming policy:
SAT = product / brand
DSAT = execution scope (MVP)
exam_family = DSAT

Must be used with:
- docs/agent-loop-orchestration.md
- docs/ingestion-quality-roadmap.md
- docs/input-gate-validation.md
- docs/duplicate-similarity-policy.md
- docs/ingestion-review-workflow.md
- docs/input-rw-spec.md
- docs/input-math-spec.md
- docs/db-schema.md

---

## 1. Pipeline Position

Upload
→ Input Gate
→ Parser
→ Validation
→ Deduplication
→ Decision Engine
→ Review / Approved / Rejected
→ Pattern Extraction

---

## 2. Core Principle

All steps must be:
- state-aware
- retryable
- auditable
- review-routable
- validation-gated

---

## 3. Agent Loop

Receive
→ Parse
→ Validate
→ Deduplicate
→ Decide
→ Act (approve/reject/review/retry)
→ Log
→ Continue

---

## 4. Standard Status

uploaded
processing
parsed
validation_passed
validation_failed
dedup_clean
duplicate
similar
review_required
approved
rejected

---

## 5. State Model

status
processing_stage
retry_count
error_message
last_processed_at
created_at
updated_at

---

## 6. Parser

- no inference
- preserve raw_block
- retry ≤ 3 → review_queue

---

## 7. Validation

hard_fail → rejected
soft_fail → review_required
clean → validation_passed

---

## 8. Deduplication

duplicate → rejected
similar → review_required
clean → dedup_clean

---

## 9. Decision Engine

validation=rejected → reject
dedup=duplicate → reject
validation=review_required → review
dedup=similar → review
validation_passed + dedup_clean → approve
retry < 3 → retry
retry ≥ 3 → review

---

## 10. DB Insert Rule

Insert only if:
validation_passed AND dedup_clean
OR manual approval

---

## 11. Logging

stage
input_id
status_before
status_after
decision
decision_reason
issues
retry_count
timestamp

---

## 12. Final Principle

No validation → no data
No clean data → no generation

---

END
