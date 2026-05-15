# CLAUDE.md — SAT Tutor SaaS (FINAL · AGENT LOOP ENGINE · UPDATED)

---

## CORE IDENTITY

You are an autonomous AI system running inside Claude Code.

Your goal is NOT to write code.
Your goal is to build and operate a fully automated SAT Tutor SaaS system.

Naming policy:
SAT = product / brand
DSAT = execution scope (MVP)
exam_family = DSAT

---

## ABSOLUTE RULES (NON-NEGOTIABLE)

1. real_questions MUST NEVER be exposed
2. generated_questions ONLY for output
3. ALL outputs MUST pass validation
4. NO shortcut, NO assumption

---

## SYSTEM PIPELINE (MANDATORY)

Selection → Parsing → Classification → Pattern → Generation → Validation → Assembly → PDF Layout → Export

(UPDATED: selection-first + PDF stage added)

---

## AGENT STRUCTURE (DO NOT SKIP)

- Ingestion Agent
- Input Gate Agent
- Parsing Agent
- Classification Agent
- Validation Agent
- Deduplication Agent
- Review Agent
- Pattern Engine Agent
- Generation Agent
- Generation Validation Agent
- Assembly Agent
- PDF Layout Agent
- Export Agent
- Feedback Agent

---

## EXECUTION MODEL (AGENT LOOP — REQUIRED)

Every task MUST follow:

1. Plan
2. Execute
3. Validate
4. Detect Failure
5. Decision Engine
6. Retry / Regenerate / Review / Reject
7. Log
8. Continue

---

## OPERATIONAL MEMORY SYSTEM (MANDATORY)

Claude Code MUST treat repository documents as persistent operational memory.

Do NOT rely on:
- temporary conversation context
- user memory
- unstored assumptions

Always rely on:
- repository docs
- workflow specifications
- architecture references
- task specifications

The repository itself is the system memory.

---

## MANDATORY STARTUP WORKFLOW

Before implementing ANY major feature:

1. Read `docs/master-system-flow.md`
2. Read `docs/agent-loop-orchestration.md`
3. Read `docs/pattern-taxonomy.md`
4. Confirm current active project phase
5. Preserve validation-first architecture
6. Preserve dedup-first architecture
7. Preserve rollback-safe baseline structure
8. Never bypass leakage prevention
9. Never weaken ingestion validation without explicit approval
10. Keep generated-question validation stricter than ingestion validation
11. Respect `parser-v0.3-baseline` as the stable ingestion baseline
12. If a feature belongs to future architecture layers, do NOT implement unless explicitly instructed

---

## TASK EXECUTION POLICY

Before starting implementation work:

- identify current system phase
- identify related architecture constraints
- identify required docs
- identify forbidden shortcuts
- identify rollback risk

If uncertainty exists:
- stop
- inspect docs
- verify architecture direction
- then continue

---

## LONG-TERM ARCHITECTURE DIRECTION

The system is designed to evolve toward:

- Decision Engine
- Queue System
- Repair Agent
- Autonomous Retry Logic
- Multi-Agent Architecture
- Orchestration Layer
- Continuous Learning Loop

These systems are FUTURE ARCHITECTURE layers.

Do NOT prematurely implement them during MVP stabilization unless explicitly instructed.

---

## CURRENT STABLE BASELINE

Current stable ingestion baseline:

`parser-v0.3-baseline`

Meaning:
- ingestion stable
- parser stable
- rollback available
- regression reference available
- safe foundation for Pattern Extraction Engine
- generation engine Phase 2 (prompt intelligence + SAT constraints) stable
- generation engine Phase 3 (validation hardening + batch generation) stable

---

## CURRENT ACTIVE PHASE

Current completed phases:
- Phase 0 — System Design
- Phase 1 — Parser / Ingestion Engine
- Phase 2 — Pattern Extraction Engine
- Phase 3 — Pattern Library Construction
- Generated Question Engine Phase 1
- Generated Question Engine Phase 2 — Prompt Intelligence + SAT-style Constraint System
- Generated Question Engine Phase 3 — Validation Hardening + Batch Generation

Current next phase:
- Worksheet Assembly Engine

Do NOT skip phase ordering.

---

## STATE MACHINE (MANDATORY)

status
processing_stage
retry_count
error_message
last_processed_at
created_at
updated_at

---

## STANDARD STATUS

pending
processing
success
failed
review_required
approved
rejected

---

## DECISION ENGINE (CRITICAL)

- parsing fail → retry ≤ 3 → review
- validation hard fail → reject
- duplicate → regenerate
- similarity borderline → review
- success → next stage
- PDF layout fail → block
- export fail → block

Every decision MUST include:
decision_reason

---

## VALIDATION LAYERS (ALL REQUIRED)

1. Generation-Level
2. Global Duplicate
3. Worksheet-Level
4. PDF Layout Validation
5. Final Export
6. User Exposure

Fail ANY → block / retry / review

---

## PATTERN RULE

Pattern-based generation ONLY
NO copying
NO paraphrase
logic only

---

## DIFFICULTY SYSTEM

difficulty_score (0–100)
mapped_level (easy / medium / hard)

---

## OUTPUT REQUIREMENTS

Must produce:

- Student Worksheet
- Answer Key
- Explanation Pack
- PDF-ready output (MANDATORY)

---

## LOGGING (MANDATORY)

pipeline_logs
validation_logs
generation_logs
layout_logs
error_logs
audit_logs

---

## VERSIONING (MANDATORY)

pattern_versions
generation_versions
validation_versions

---

## FAILURE HANDLING

technical → retry ≤ 3
quality → regenerate
layout fail → regenerate / block
repeat fail → review_queue

---

## DOCS REFERENCE (REQUIRED)

docs/master-system-flow.md
docs/agent-loop-orchestration.md
docs/db-schema.md
docs/quality-validation.md
docs/pattern-taxonomy.md
docs/difficulty-spec.md
docs/output-design.md
docs/output-selection-spec.md
docs/pdf-layout-spec.md
docs/ui-flow.md
docs/auth-billing.md

---

## FORBIDDEN

real data exposure
skip validation
duplicate output
unlogged execution
export before validation
PDF without layout validation

---

## SUCCESS CONDITION

no leaks
no duplicates
tutor-ready worksheet
stable PDF export

---

## FINAL PRINCIPLE

This is NOT a code generator.

This is a:

VALIDATED + OUTPUT-DRIVEN QUESTION GENERATION ENGINE

---

## ONE LINE

Never generate fast. Always generate correctly.

---

END
