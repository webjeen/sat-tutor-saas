# SAT Tutor SaaS Quality & Validation Guideline (FINAL · Agent-Ready)

---

## 0. Purpose

Defines multi-layer validation system.

Naming policy:
SAT = product / brand
DSAT = execution scope (MVP)
exam_family = DSAT

Must be used with:
- docs/agent-loop-orchestration.md
- docs/data-quality-pipeline.md
- docs/duplicate-similarity-policy.md
- docs/output-design.md
- docs/output-ui-ux.md
- docs/db-schema.md

---

## 1. Core Principle

Validation = system, not step

All layers must pass.

---

## 2. Agent Loop

Plan
→ Execute
→ Validate
→ Detect Failure
→ Decide
→ Retry / Reject / Review / Continue
→ Log

---

## 3. Validation Layers

1. Generation
2. Global Duplicate
3. Worksheet
4. Final Export
5. User Exposure

---

## 4. Generation Validation

leak → discard
duplicate → regenerate
borderline → review
pass → next

---

## 5. Global Dedup

duplicate → reject
similar → reject
structure clone → review

---

## 6. Worksheet Validation

pattern repeat → reject
answer bias → adjust
difficulty imbalance → adjust

---

## 7. Final Export

fail → block
pass → export

---

## 8. User Exposure

same → reject
similar repeat → limit

---

## 9. Fingerprint

text_hash
structure_hash
embedding_vector
pattern_id

---

## 10. Decision Engine

leak → discard
duplicate → regenerate
fail → reject
borderline → review
pass → continue

---

## 11. State Model

validation_pending
validation_passed
validation_failed
review_required
approved_for_release
rejected

---

## 12. Retry

technical → retry ≤ 3
quality → no blind retry
repeat fail → review

---

## 13. Logging

question_id
stage
result
reason
score
decision
timestamp

---

## 14. Core Rule

No validation → no output

---

END
