# ui-flow.md (v2 · FINAL · PDF-Driven · Agent-Ready)

---

## 0. Purpose

Defines full UI flow of SAT Tutor SaaS.

This connects:
Tutor selection → Generation → Validation → Preview → PDF Export

Must be used with:
- docs/output-selection-spec.md
- docs/pdf-layout-spec.md
- docs/output-ui-ux.md
- docs/output-design.md
- docs/quality-validation.md
- docs/auth-billing.md

---

## 1. Core Principle

UI must hide complexity.

Tutor flow:

intent → select → generate → review → export (PDF)

---

## 2. Screen List (MVP)

/dashboard  
/generator  
/preview/[worksheetId]  
/export/[worksheetId]  
/library  
/account  
/admin/review  

---

## 3. Dashboard

Purpose:
- quick start
- resume work

Components:
- Create Worksheet
- Recent Worksheets
- Usage Status
- Plan Info

---

## 4. Generator Screen

Route:
`/generator`

Purpose:
Tutor configures worksheet

---

## 5. Generator Layout

Left:
- section
- module
- skills
- question_count

Middle:
- purpose
- student_level
- difficulty
- style_mode
- time_constraint

Right:
- output_profile
- explanation_level
- export_format (PDF only)

Bottom:
- Generate Button

---

## 6. Pre-Generation Validation UI

States:

ready  
invalid_selection  
usage_blocked  
upgrade_required  

Display:

invalid → show missing option  
blocked → show upgrade CTA  

---

## 7. Generation Flow

Click Generate:

→ processing  
→ validation  
→ assembly  
→ ready  

States:

processing  
validation_failed  
review_required  
ready  

---

## 8. Preview Screen

Route:
`/preview/[id]`

Layout:

Left:
- question list

Center:
- question content
- choices
- answer toggle
- explanation toggle

Right:
- validation status

Actions:
- replace question
- remove question
- re-validate
- proceed to export

---

## 9. Replace Logic

replace  
→ regenerate  
→ validate  
→ insert  

duplicate → retry  
fail → review  

---

## 10. Validation UI

processing → loading  
failed → red  
review → yellow  
passed → green  

---

## 11. Export Screen (PDF 중심)

Route:
`/export/[id]`

Tabs:

Student Worksheet  
Answer Key  
Explanation Pack  

Preview shows PDF layout style

---

## 12. Export Rules

Export enabled only if:

validation_passed  
AND layout_ready  

---

## 13. PDF Behavior

- Student Worksheet = no answers  
- Answer Key = separate page  
- Explanation = separate section  
- follows pdf-layout-spec.md  

---

## 14. Library Screen

View:
- previous worksheets

Actions:
- open
- duplicate settings
- export again

---

## 15. Account Screen

Show:
- plan
- usage
- upgrade button

---

## 16. Admin Review

Route:
`/admin/review`

Purpose:
handle review_required

Actions:
- approve
- reject
- retry

---

## 17. State Machine

idle  
processing  
validation_failed  
review_required  
ready  
export_ready  
exported  

---

## 18. Error UX

technical → retry  
quality → regenerate  
review → admin  

---

## 19. Logging

generator_open  
selection_change  
generate_click  
validation_fail  
export_click  

---

## 20. Final Principle

Fast + Clear + Safe

Tutor must:
Generate → Print → Use immediately

---

END
