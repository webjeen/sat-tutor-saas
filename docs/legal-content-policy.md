# SAT Tutor SaaS Legal / Content Policy (FINAL · Agent-Ready)

---

## 0. Purpose

Defines legal and content safety policy.

Naming policy:
SAT = product / brand
DSAT = execution scope (MVP)
exam_family = DSAT

Must be used with:
- docs/data-quality-pipeline.md
- docs/duplicate-similarity-policy.md
- docs/quality-validation.md
- docs/output-design.md
- docs/db-schema.md
- docs/admin-internal-tool.md

---

## 1. Core Principle

Real = internal  
Generated = product  
Never mix  

---

## 2. Data Separation

real_questions → internal only  
generated_questions → external only  

Forbidden:
real reuse  
partial reuse  
paraphrase reuse  

---

## 3. Agent Loop

Plan  
→ Generate/Ingest  
→ Validate  
→ Detect Risk  
→ Decide  
→ Reject / Regenerate / Review  
→ Log  

---

## 4. Real Usage

Allowed:
analysis  
pattern extraction  

Forbidden:
text reuse  
choice reuse  

---

## 5. Generated Policy

Must be:
independent  
new  
non-derivative  

---

## 6. Similarity

≥0.80 → reject  
≥0.75 embedding → reject  
≥0.70 structure → review  

---

## 7. Validation

leak check  
duplicate check  
worksheet check  
exposure check  

fail → discard  

---

## 8. Access Control

internal only:
real_questions  

external:
generated_questions only  

---

## 9. Decision Engine

leak → discard  
duplicate → regenerate  
similar → review  
uncertain → review  

---

## 10. State Model

validation_pending  
validation_passed  
validation_failed  
review_required  
approved_for_release  
rejected  

---

## 11. Logging

content_id  
stage  
violation  
score  
decision  
reason  
timestamp  

---

## 12. Core Rule

No legal safety → no product  

---

END
