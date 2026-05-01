# SAT Tutor Worksheet Generator SaaS Master Design (FINAL · LOCKED · Agent-Ready · UPDATED)

---

## 0. Purpose

Top-level system design. All documents must align with this.

Naming policy:
SAT = product / brand
DSAT = execution scope (MVP)
exam_family = DSAT

---

## 1. Product Definition

Agent-driven tutor SaaS:

selection → generate → validate → assemble → export (PDF)

(UPDATED: selection-first architecture)

---

## 2. Core Value

Real pattern understanding  
→ safe generation  
→ tutor-ready worksheets  
→ print-ready PDF output  # NEW

---

## 3. System Layers

A. Source  
B. Intelligence  
C. Generation  
D. Validation  
E. Product  
F. Feedback  

+ G. UI Layer (NEW)
+ H. Output Packaging Layer (NEW)

---

## 4. Pipeline

Upload
→ Input Gate
→ Parsing
→ Validation
→ Dedup
→ Review
→ Pattern
→ Generation
→ Validation
→ Assembly
→ Layout (PDF)      # NEW
→ Export
→ Feedback

---

## 5. Agent Loop

Plan
→ Execute
→ Validate
→ Detect Failure
→ Decide
→ Retry / Review / Reject
→ Log

---

## 6. State Model

status
processing_stage
retry_count
error_message
last_processed_at
created_at
updated_at

---

## 7. Decision Engine

parse fail → retry ≤3 → review  
validation fail → reject/review  
duplicate → reject  
similar → review  
clean → approve  

---

## 8. Data Separation

real_questions = internal  
generated_questions = external  

---

## 9. UI & Output Integration (NEW)

Must integrate:

- docs/output-selection-spec.md
- docs/pdf-layout-spec.md
- docs/ui-flow.md

System now driven by:

selection → engine → PDF output

---

## 10. Core Rule

No validation → no output  
No PDF layout → no export  # NEW

---

## 11. Final

Validation-driven + Output-driven generation system

---

END
