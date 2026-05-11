# Future Task — State Machine System

## Purpose

Current SAT Tutor SaaS already contains early workflow states:

- validation states
- review_required
- retry concept
- ingestion separation
- pipeline stages

Long-term architecture should evolve into a full workflow state machine system.

---

## Future Goal

Implement centralized workflow state management.

Example:

```text
PENDING
RUNNING
FAILED
RETRYING
REVIEW_REQUIRED
COMPLETED
```

---

## Expected Areas

### Ingestion Pipeline

- upload_status
- parsing_status
- validation_status
- dedup_status
- insert_status

### Generation Pipeline

- generation_status
- repair_status
- export_status
- scoring_status

---

## Long-Term Objectives

- deterministic workflow transitions
- retry orchestration
- failure isolation
- queue coordination
- observability integration

---

## Important

Do NOT implement during current Pattern Extraction phase unless architecture requires it.

Current priority remains:

```text
Pattern Extraction Engine
```
