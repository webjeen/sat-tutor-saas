# SAT Tutor SaaS Input Gate & Validation Guideline (FINAL · Agent-Ready)

---

## 0. Purpose

This document defines the Input Gate and Validation rules for SAT real question ingestion.

Naming policy:

SAT = product / brand  
DSAT = execution scope (MVP)  
exam_family = DSAT  

This document must be used with:

- docs/agent-loop-orchestration.md
- docs/ingestion-quality-roadmap.md
- docs/input-rw-spec.md
- docs/input-math-spec.md
- docs/duplicate-similarity-policy.md
- docs/ingestion-review-workflow.md
- docs/data-quality-pipeline.md

---

## 1. Core Purpose of Input Gate

The Input Gate is the first protection layer of the ingestion pipeline.

It prevents:

- malformed input
- incomplete blocks
- OCR-damaged data
- uncertain content
- duplicate contamination
- unsafe real question insertion

---

## 2. Global Pipeline Position

Upload  
→ Input Gate  
→ Parser  
→ Input Validation  
→ Deduplication  
→ Decision Engine  
→ Review / Approved / Rejected  

---

## 3. Agent Loop Requirement

Every input must follow:

Receive  
→ Structure Check  
→ Validate Fields  
→ Detect Uncertainty  
→ Decision  
→ Retry / Reject / Review / Continue  

---

## 4. Required Fields

Exam  
Section  
Module  
Question_ID  
Question_Type  
QUESTION  
CHOICES  
ANSWER  
UNCLEAR  

---

## 5. Hard Fail

missing structure  
missing required fields  
invalid ANSWER  
multiple questions  

→ rejected  

---

## 6. Soft Fail

missing choices  
duplicate choices  
UNCLEAR not NONE  
OCR issues  
ambiguous content  

→ review_required  

---

## 7. Clean

all fields valid  
no uncertainty  
valid format  

→ validation_passed  

---

## 8. Standard Status

pending  
processing  
validation_passed  
review_required  
rejected  
approved  

---

## 9. Decision Engine

hard_fail → reject  
soft_fail → review  
clean → pass  

---

## 10. State Machine

uploaded  
→ input_gate_processing  
→ validation_passed  
→ deduplication_pending  

OR  

→ review_required  
→ in_review  
→ approved / rejected  

---

## 11. Retry Policy

retry ≤ 3 (technical only)  

else → review_queue  

---

## 12. DB Rule

Insert ONLY if:

validation_passed AND dedup_clean  

---

## 13. Core Principle

No clean input → no safe generation.

---

END
