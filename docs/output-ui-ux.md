# SAT Tutor SaaS Output UI/UX Guideline (FINAL · Agent-Ready · UPDATED)

---

## 0. Purpose

Defines UI/UX principles.

Naming policy:
SAT = product / brand
DSAT = execution scope (MVP)
exam_family = DSAT

Must be used with:
- docs/output-design.md
- docs/output-selection-spec.md   # NEW
- docs/pdf-layout-spec.md         # NEW
- docs/ui-flow.md                 # NEW
- docs/data-quality-pipeline.md
- docs/quality-validation.md
- docs/duplicate-similarity-policy.md
- docs/auth-billing.md
- docs/usage-logging-versioning.md
- docs/agent-loop-orchestration.md

---

## 1. Core Principle

UI shows questions  
UX sells time saved  

---

## 2. UX Goals

- ≤3 clicks generation
- immediate preview
- print-ready PDF output   # UPDATED
- validation-safe export
- clear upgrade path

---

## 3. User

SAT tutor

Needs:
- speed
- realism
- clean output
- ready-to-print worksheet

---

## 4. Flow

Dashboard
→ Generator (selection-driven)
→ Validation
→ Preview
→ Adjust
→ Final Validation
→ Export (PDF)
→ Library

---

## 5. Status (UI MUST MATCH SYSTEM)

pending
processing
validation_failed
review_required
approved
ready_to_export
exported

---

## 6. Generator

Controls (must follow output-selection-spec.md):

- Section
- Module
- Skills
- Question Count

Core Controls:
- Purpose
- Student Level
- Difficulty
- Style Mode
- Time Constraint

Output Controls:
- Output Profile
- Explanation Level
- Export Format (PDF only)

Rule:
default = 1-click generation

---

## 7. Generator State

idle
generating
validating
review_required
ready
failed

Decision:
fail → retry
invalid → block
valid → preview

---

## 8. Preview

Left:
- list
- type
- difficulty
- status

Right:
- content
- choices
- answer toggle
- explanation toggle

Must reflect PDF layout structure (see pdf-layout-spec.md)

---

## 9. Replace Logic

replace → validate → dedup → insert

duplicate → regenerate  
fail → review  

---

## 10. Export Rule

Export only if:

validation_passed  
AND final_export_validation_passed  

AND PDF layout valid

---

## 11. PDF Behavior (NEW)

- Student Worksheet = no answers
- Answer Key = separate page
- Explanation = separate section
- must follow pdf-layout-spec.md

---

## 12. Library

Must prevent:
- duplicate worksheet
- repeated exposure

---

## 13. Billing UX

Show:
- plan
- usage
- limits

Trigger upgrade:
- limit reached
- export locked

---

## 14. Validation Visibility

Show:
- checking
- ready
- needs review
- regenerating

---

## 15. Error Rule

technical → retry  
quality → regenerate  
uncertain → review  

---

## 16. Logging

log:
- generation
- validation
- replace
- export
- upgrade

---

## 17. Core Rule

No validation → no export

---

END
