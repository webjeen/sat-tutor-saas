# SAT Tutor SaaS Usage / Logging / Versioning Guideline (FINAL · Agent-Ready)

---

## 0. Purpose

Defines usage, logging, retry, and versioning layer.

Naming policy:
SAT = product / brand
DSAT = execution scope (MVP)
exam_family = DSAT

Must be used with:
- docs/agent-workflow.md
- docs/data-quality-pipeline.md
- docs/ingestion-review-workflow.md
- docs/duplicate-similarity-policy.md
- docs/quality-validation.md
- docs/output-ui-ux.md
- docs/auth-billing.md
- docs/admin-internal-tool.md
- docs/db-schema.md

---

## 1. Core Principle

No log → no execution  
No version → no trust  
No state → no recovery  

---

## 2. Usage Control

FREE → limited  
PRO → unlimited  

Fields:
usage_today
plan
last_reset_at

Rule:
daily reset (UTC)

---

## 3. Decision Flow

request
→ auth
→ subscription
→ usage check
→ allow / block
→ log

---

## 4. Logging Types

user_usage_logs  
pipeline_logs  
generation_logs  
validation_logs  
error_logs  
audit_logs  

---

## 5. Retry

retry_count  
max_retries  

Rule:
retry < max → retry  
else → review  

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

## 7. Status Set

pending  
processing  
success  
failed  
review_required  
approved  
rejected  

---

## 8. Versioning

patterns  
generation  
validation  
export  

Rule:
every change → new version  

---

## 9. Feedback

question_feedback  

---

## 10. Decision Engine

approve  
reject  
review  
retry  
regenerate  
discard  
rollback  

---

## 11. Core Rule

No logging → no system  

---

END
