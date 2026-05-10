# Task — Pattern Extraction Engine Phase 1

---

# CURRENT ACTIVE PHASE

Phase 2 — Pattern Extraction Engine

This phase begins AFTER:

- parser-v0.3-baseline freeze
- ingestion stabilization
- validation baseline stabilization
- dedup baseline stabilization

---

# PURPOSE

Build the first operational SAT Pattern Extraction system.

Goal:

```text
real SAT question
→ structural analysis
→ reasoning extraction
→ distractor extraction
→ pattern classification
→ reusable SAT pattern asset
```

This is the beginning of the SAT Intelligence Layer.

---

# REQUIRED REFERENCE DOCS

Before implementation, MUST read:

- docs/master-system-flow.md
- docs/pattern-taxonomy.md
- docs/quality-validation.md
- docs/difficulty-spec.md
- docs/duplicate-similarity-policy.md
- docs/agent-loop-orchestration.md

---

# CORE OBJECTIVE

Extract structured SAT intelligence from real SAT questions.

The system should identify:

- question type
- reasoning pattern
- distractor structure
- difficulty signals
- rhetorical structure
- grammar transformation type
- mathematical reasoning type
- abstraction level
- timing complexity

The goal is NOT generation yet.

The goal is:

```text
understanding SAT structure itself
```

---

# INPUT SOURCE

Source:

- validated real_questions table
- ingestion-approved SAT datasets
- parser-v0.3-baseline validated data

DO NOT use:
- generated questions
- low-confidence OCR
- rejected ingestion rows

---

# PHASE 1 SCOPE

Initial extraction scope ONLY.

Do NOT over-expand.

Phase 1 includes:

## RW Extraction

- Question category
- Reasoning category
- Passage structure
- Distractor pattern
- Transition structure
- Boundary logic
- Evidence reasoning

## Math Extraction

- Math domain
- Equation structure
- Problem-solving type
- Distractor logic
- Multi-step reasoning
- Symbolic complexity

---

# REQUIRED OUTPUT STRUCTURE

The extraction system should eventually produce structured fields such as:

```json
{
  "question_type": "",
  "reasoning_pattern": "",
  "difficulty_band": "",
  "distractor_pattern": "",
  "timing_complexity": "",
  "syntax_complexity": "",
  "abstraction_level": ""
}
```

This structure may evolve.

---

# PHASE 1 DELIVERABLES

Required outputs:

- pattern extraction schema
- extraction service
- extraction logic
- extracted pattern storage
- admin inspection capability
- extraction validation logging

Optional:
- simple admin UI
- extraction preview

---

# VALIDATION REQUIREMENTS

Pattern extraction MUST preserve:

- no real SAT exposure
- no output leakage
- no destructive transformation
- traceable extraction logs
- rollback-safe operation

Every extraction MUST remain auditable.

---

# IMPORTANT RESTRICTIONS

DO NOT:

- build generation engine yet
- build autonomous orchestration
- build queue system
- build repair agent
- build retry engine
- weaken validation logic
- bypass dedup checks

These belong to future architecture phases.

---

# ARCHITECTURE PRINCIPLE

Pattern Extraction exists to create:

```text
SAT Pattern Intelligence
```

NOT:

```text
simple SAT tagging
```

The system must evolve toward reusable SAT reasoning assets.

---

# SUCCESS CONDITION

Phase 1 is successful if:

- SAT question structures become extractable
- patterns become queryable
- reasoning structures become reusable
- future generation becomes possible
- extraction remains validation-safe

---

# FINAL PRINCIPLE

Do NOT generate yet.

First:

```text
Understand SAT deeply.
```
