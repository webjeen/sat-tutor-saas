# SAT Tutor SaaS Pattern Taxonomy Guideline (FINAL · Agent-Ready)

---

## 0. Purpose

Defines pattern system.

Naming policy:
SAT = product / brand
DSAT = execution scope (MVP)
exam_family = DSAT

Must be used with:
- docs/agent-workflow.md
- docs/master-design.md
- docs/input-rw-spec.md
- docs/input-math-spec.md
- docs/data-quality-pipeline.md
- docs/quality-validation.md
- docs/difficulty-spec.md
- docs/duplicate-similarity-policy.md
- docs/legal-content-policy.md
- docs/db-schema.md

---

## 1. Core Principle

Pattern = reusable generation rule

---

## 2. Role

real_questions → pattern → generated_questions

---

## 3. Source Rule

allowed:
approved real_questions

forbidden:
review_required
rejected
raw input

---

## 4. Pattern Structure

id
exam_family
section
type
skill
structure
logic
trap
difficulty_range
version
active

---

## 5. Agent Loop

analyze
→ extract
→ validate
→ dedup
→ decide
→ approve/review/reject
→ version
→ log

---

## 6. State Model

pattern_candidate
pattern_review_required
pattern_approved
pattern_active
pattern_deprecated
pattern_rejected

---

## 7. Decision Engine

unapproved source → reject
missing logic → review
duplicate → review/reject
legal risk → reject
valid → approve

---

## 8. RW Patterns

Main-Idea
Function
Inference
Evidence
Vocabulary
Transition
Grammar
Rhetorical

---

## 9. Math Patterns

Algebra
Graph
Trigonometry
Statistics
WordProblem

---

## 10. Quality

clear logic
clear trap
difficulty range
reusable

---

## 11. Validation

source approved
no real leak
logic complete
trap complete
not duplicate

---

## 12. Versioning

every change → new version

---

## 13. Usage

select pattern
→ generate
→ validate
→ log

---

## 14. Worksheet Control

limit same pattern
mix skills
balance difficulty

---

## 15. Feedback

usage_count
rating
rejection_rate

---

## 16. Core Rule

Pattern = generation engine

---

END
