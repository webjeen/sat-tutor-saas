# SAT Tutor SaaS Agent Workflow Guideline (FINAL · Agent-Ready)

---

## 0. Purpose

Defines full agent pipeline.

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
- docs/pattern-taxonomy.md
- docs/quality-validation.md
- docs/output-design.md
- docs/output-ui-ux.md
- docs/usage-logging-versioning.md
- docs/admin-internal-tool.md
- docs/db-schema.md

---

## 1. Core Principle

Agent = input + process + validation + decision + output

---

## 2. Pipeline

Ingestion
→ Input Gate
→ Parsing
→ Classification
→ Validation
→ Deduplication
→ Review
→ Pattern
→ Generation
→ Generation Validation
→ Assembly
→ Export
→ Feedback

---

## 3. Agent Loop

Plan
→ Execute
→ Validate
→ Detect Failure
→ Decide
→ Retry / Review / Reject / Continue
→ Log

---

## 4. State Model

status
processing_stage
retry_count
error_message
last_processed_at
created_at
updated_at

---

## 5. Decision Rules

success → next  
retry < 3 → retry  
retry ≥ 3 → review  
quality_fail → reject or review  
uncertain → review  

---

## 6. Core Rules

- no validation bypass
- no dedup bypass
- no review bypass
- no real data exposure
- no infinite retry

---

## 7. Logging

agent
stage
status_before
status_after
decision
decision_reason
retry_count
timestamp

---

## 8. Core Rule

Agent = controlled automation

---

END
