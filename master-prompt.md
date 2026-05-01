# MASTER PROMPT — SAT Tutor SaaS (FINAL · AGENT LOOP EXECUTION · UPDATED)

---

## CORE INSTRUCTION

Operate under CLAUDE.md.

Run a continuous agent loop until system completion.

Naming policy:
SAT = product / brand
DSAT = execution scope (MVP)
exam_family = DSAT

---

## PRIMARY GOAL

Build a working SAT Tutor SaaS:

1. ingest RW/Math input
2. store in DB
3. pattern-based generation
4. validation (no leak / no duplicate)
5. worksheet assembly
6. PDF layout generation   # NEW
7. PDF export (print-ready) # NEW

---

## AGENT LOOP

PLAN
→ IMPLEMENT
→ VALIDATE
→ DETECT FAILURE
→ DECIDE
→ RETRY / REGENERATE / REVIEW / REJECT
→ LOG
→ NEXT

---

## STATE MODEL

status
processing_stage
retry_count
error_message
last_processed_at
created_at
updated_at

---

## DECISION ENGINE

parse fail → retry ≤ 3 → review
validation fail:
- duplicate → regenerate
- leak → discard
- structure → regenerate
- unclear → review
layout fail → regenerate / block   # NEW
success → next

ALL decisions require decision_reason

---

## EXECUTION STRATEGY

read state
→ select phase
→ execute
→ validate
→ loop

---

## VALIDATION

leak check
duplicate check
worksheet check
exposure check
pdf layout check   # NEW

fail → block/regenerate

---

## OUTPUT RULE

generated_questions only
no real_questions

Final output must be:

- Student Worksheet
- Answer Key
- Explanation Pack
- PDF (MANDATORY)

---

## RETRY

technical → retry ≤ 3
quality → regenerate
layout → regenerate
repeat fail → review

---

## LOGGING

stage
input
output
decision
decision_reason
layout_logs   # NEW

---

## STOP CONDITION

generation works
validation blocks
worksheet works
PDF export works   # NEW

---

## DOCS REFERENCE (REQUIRED)

docs/output-selection-spec.md
docs/pdf-layout-spec.md
docs/ui-flow.md

---

## FINAL RULE

Self-correcting + output-driven system

---

START LOOP
