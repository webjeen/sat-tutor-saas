# SAT Tutor SaaS Duplicate & Similarity Policy (FINAL · Agent-Ready)

---

## 0. Purpose

Defines duplicate and similarity control.

Naming policy:
SAT = product / brand
DSAT = execution scope (MVP)
exam_family = DSAT

Must be used with:
- docs/agent-loop-orchestration.md
- docs/data-quality-pipeline.md
- docs/ingestion-review-workflow.md
- docs/input-gate-validation.md
- docs/ingestion-quality-roadmap.md
- docs/pattern-taxonomy.md

---

## 1. Core Principles

No duplicate in real_questions  
No duplicate in generated_questions  
No real ↔ generated leakage  
No repeated user exposure  

---

## 2. Agent Loop

Generate / Ingest
→ Fingerprint
→ Compare
→ Similarity
→ Decide
→ Reject / Review / Accept
→ Log

---

## 3. State & Status

status  
processing_stage  
retry_count  
decision_reason  

Statuses:

dedup_clean  
duplicate  
similar  
review_required  
rejected  
approved  

---

## 4. Duplicate Types

Exact → reject  
Near (≥0.90) → reject  
0.80–0.90 → review  
Pattern duplicate → review  
Variation → 제한  

---

## 5. Similarity

Text → embedding  
Structure → type/flow  
Choice → distractor pattern  

---

## 6. Fingerprint

textHash  
structureHash  
choiceHash  
patternSignature  

---

## 7. Decision Engine

exact → reject  
≥0.90 → reject  
0.80–0.90 → review  
pattern duplicate → review  
clean → dedup_clean  

---

## 8. Integration

Ingestion ✔  
Generation ✔  
Worksheet ✔  
User delivery ✔  

---

## 9. Retry

technical only  
max_retries = 3  

---

## 10. Logging

question_id  
similarity_score  
matched_id  
decision  
decision_reason  
timestamp  

---

## 11. Core Rule

No dedup → no system

---

END
