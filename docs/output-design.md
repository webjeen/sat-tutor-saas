# SAT Tutor SaaS Output Design Guideline (FINAL · Agent-Ready · UPDATED)

---

## 0. Purpose

Defines output product system.

Naming policy:
SAT = product / brand
DSAT = execution scope (MVP)
exam_family = DSAT

Must be used with:
- docs/output-ui-ux.md
- docs/output-selection-spec.md   # NEW
- docs/pdf-layout-spec.md         # NEW
- docs/ui-flow.md                 # NEW
- docs/data-quality-pipeline.md
- docs/quality-validation.md
- docs/duplicate-similarity-policy.md
- docs/db-schema.md
- docs/usage-logging-versioning.md
- docs/admin-internal-tool.md

---

## 1. Core Principle

Output = product, not file

Tutor receives:
→ ready-to-use worksheet package (PDF)

---

## 2. Agent Loop

Plan
→ Assemble
→ Validate
→ Detect Failure
→ Decide
→ Retry / Adjust / Reject
→ Log

---

## 3. Output Types

Student Worksheet
Answer Key
Explanation Pack
Full Review Pack  # NEW

---

## 4. Output Profiles (Connected to output-selection-spec)

Student Clean
Homework + Key
Full Review Pack
Tutor Compact
Test Mode  # NEW

---

## 5. Formats

PDF ONLY (MVP)

Future:
DOCX

---

## 6. Layout (Delegated)

Layout MUST follow:
docs/pdf-layout-spec.md

Do NOT define layout here.

---

## 7. Composition Rules

difficulty distribution
pattern limit
answer balance
pattern diversity  # NEW
skill weighting    # NEW

---

## 8. Decision Engine

validation fail → block
duplicate → rebuild
pattern overuse → adjust
answer bias → reshuffle

---

## 9. State Model

assembly_pending
assembling
validation_pending
validation_passed
validation_failed
ready_for_export
exported

---

## 10. Flow

selection (output-selection-spec)
→ assemble
→ apply profile
→ layout (pdf-layout-spec)
→ validate
→ export (PDF)

---

## 11. Validation

leak check
duplicate check
worksheet check
format check
layout check  # NEW

fail → block

---

## 12. Exposure Control

no repeat
no duplicate
no history reuse

---

## 13. Logging

worksheet_id
profile
status
decision
timestamp

---

## 14. Core Rule

No validation → no export  
No PDF layout → no export  # NEW

---

END
