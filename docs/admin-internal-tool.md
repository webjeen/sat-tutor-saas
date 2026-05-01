# SAT Tutor SaaS Admin / Internal Tool Guideline (FINAL · Agent-Ready)

---

## 0. Purpose

Defines internal admin control system.

Naming policy:
SAT = product / brand
DSAT = execution scope (MVP)
exam_family = DSAT

Must be used with:
- docs/agent-loop-orchestration.md
- docs/ingestion-quality-roadmap.md
- docs/input-gate-validation.md
- docs/data-quality-pipeline.md
- docs/ingestion-review-workflow.md
- docs/duplicate-similarity-policy.md
- docs/quality-validation.md
- docs/pattern-taxonomy.md
- docs/output-design.md
- docs/output-ui-ux.md
- docs/usage-logging-versioning.md
- docs/auth-billing.md
- docs/db-schema.md

---

## 1. Core Principle

Automation without admin control = system risk

---

## 2. Core Responsibilities

- ingestion monitoring
- parsing review
- validation handling
- dedup review
- pattern control
- generation monitoring
- export validation
- user monitoring
- audit logging

---

## 3. Workflow

Upload
→ Input Gate
→ Parsing
→ Validation
→ Deduplication
→ Review
→ Approval / Reject
→ Pattern
→ Generation
→ Export

---

## 4. State Machine

status  
processing_stage  
retry_count  
error_message  
last_processed_at  
created_at  
updated_at  

---

## 5. Status Set

uploaded  
processing  
parsed  
validation_passed  
validation_failed  
dedup_clean  
duplicate  
similar  
review_required  
in_review  
approved  
rejected  
generation_processing  
generation_failed  
export_ready  
export_failed  

---

## 6. Decision Engine

approve  
reject  
retry  
review  
regenerate  
discard  
rollback  

---

## 7. Modules

1. Ingestion  
2. Parsing Review  
3. Review Queue  
4. Question DB  
5. Pattern  
6. Validation  
7. Generation  
8. Export  
9. Users  
10. Audit  

---

## 8. Rules

- no validation bypass  
- no dedup bypass  
- no review bypass  
- no real data exposure  
- no export before validation  
- no unlogged admin action  

---

## 9. Logging

admin_user_id  
action  
target  
status_before  
status_after  
decision_reason  
timestamp  

---

## 10. RBAC

Admin / Editor / Viewer  

Admin only:
- override decision engine  

---

## 11. Retry / Rollback

retry ≤ 3  
rollback required on failure  

---

## 12. Core Rule

Admin = control tower

---

END
