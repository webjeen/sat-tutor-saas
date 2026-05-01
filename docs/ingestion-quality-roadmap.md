# SAT SaaS Data Ingestion & Quality Roadmap (FINAL · Agent Loop Integrated)

---

## 0. Purpose

This document extends `implementation-roadmap.md` and defines the COMPLETE ingestion quality pipeline.

Naming policy:

SAT = product / brand  
DSAT = execution scope (MVP)  
exam_family = DSAT  

This document must be used with:

- docs/input-rw-spec.md
- docs/input-math-spec.md
- docs/duplicate-similarity-policy.md
- docs/quality-validation.md
- docs/db-schema.md

---

## 1. Extended Phase Structure

Phase 4: Parser  
Phase 4.5: Input Validation  
Phase 4.6: Deduplication  
Phase 4.7: Review System  
Phase 4.8: Orchestration Layer  
Phase 5: Pattern Extraction  

---

## 2. Full Execution Flow

Upload  
→ Parser  
→ Input Validation  
→ Deduplication  
→ Decision Engine  
→ (Approve / Reject / Review)  
→ Approved real_questions  
→ Pattern Extraction  
→ Generation  
→ Validation  
→ Worksheet  

---

## 3. Agent Loop (CRITICAL)

Every stage must follow:

Plan  
→ Implement  
→ Run  
→ Validate  
→ Detect Failure  
→ Decide Next Action  
→ Retry / Route / Fix  
→ Re-run  

NO EXCEPTIONS.

---

## 4. State Machine (MANDATORY)

All entities must include:

status  
processing_stage  
retry_count  
error_message  
last_processed_at  
created_at  
updated_at  

---

## 5. Standard Status Values

pending  
processing  
validation_passed  
review_required  
rejected  
approved  

---

## 6. Phase 4 — Parser

Goal:
Convert .md / .docx into structured JSON.

Failure Rule:
parsing fail → retry(3) → review_queue

---

## 7. Phase 4.5 — Input Validation

Rules:

hard_fail → rejected  
soft_fail → review_required  
clean → validation_passed  

---

## 8. Phase 4.6 — Deduplication

Rules:

duplicate → rejected  
similar → review_required  
clean → pass  

---

## 9. Phase 4.7 — Review System

Rules:

review_required → queue  
approved → insert  
rejected → discard  

---

## 10. Phase 4.8 — Orchestration Layer

Decision Engine:

parsing fail → retry → review  
validation hard_fail → reject  
validation soft_fail → review  
duplicate → reject  
similar → review  
clean → approve  

---

## 11. DB Insert Rule

ONLY insert if:

validation_passed AND dedup_clean  
OR manually approved  

---

## 12. Phase 5 — Pattern Extraction

Only approved data allowed.

---

## 13. Final Summary

Validation + Dedup + Decision Engine = SAFE SYSTEM

---

END
