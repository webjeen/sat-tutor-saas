# SAT Tutor SaaS Difficulty Specification (FINAL · Agent-Ready)

---

## 0. Purpose

Defines difficulty system.

Naming policy:
SAT = product / brand
DSAT = execution scope (MVP)
exam_family = DSAT

Must be used with:
- docs/quality-validation.md
- docs/data-quality-pipeline.md
- docs/output-design.md
- docs/output-ui-ux.md
- docs/usage-logging-versioning.md
- docs/db-schema.md

---

## 1. Core Principle

Difficulty = controlled experience

---

## 2. Levels

easy
medium
hard

Score:
0–100

Mapping:
0–30 easy
31–70 medium
71–100 hard

---

## 3. Required Fields

difficulty_score
mapped_level
difficulty_factors

---

## 4. Factors

complexity
syntax
reasoning
distractor
density
time

---

## 5. Generation Rules

pattern defines:
difficulty_range

generation:
target → adjust structure → adjust distractor → assign score

---

## 6. Decision Engine

easy but score > 50 → review
hard but score < 60 → regenerate
missing score → reject

---

## 7. Validation

score exists
level matches
structure matches difficulty

---

## 8. Worksheet Curve

easy → medium → hard

avoid repetition
avoid spikes

---

## 9. State Model

difficulty_pending
difficulty_assigned
difficulty_validated
difficulty_mismatch
difficulty_review_required

---

## 10. Feedback

correct_rate
solve_time
feedback

adjust difficulty

---

## 11. Core Rule

No difficulty control → no learning quality

---

END
