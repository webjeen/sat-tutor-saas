# SAT Tutor SaaS — Master System Flow

## Project Identity

SAT Tutor SaaS is NOT a simple question storage system.

The real objective is:

```text
DSAT real exam data
→ structure analysis
→ SAT reasoning extraction
→ pattern assetization
→ SAT-style generation
→ tutor-ready worksheet automation
→ SaaS monetization
```

In other words:

```text
SAT Intelligence SaaS
```

---

# Core Philosophy

The long-term architecture direction is:

```text
AI
+
Rules
+
Validation
+
State Machine
+
Orchestration
```

NOT:

```text
"Just generate SAT questions with GPT"
```

The system is designed as an operational AI system, not a toy AI generator.

---

# Current Architecture Philosophy

The project already follows:

- Validation-first architecture
- Dedup-first architecture
- Leakage prevention
- State tracking
- Retry awareness
- Workflow separation
- Logging/versioning
- Orchestration awareness

This is intentionally designed for long-term scalability.

---

# 0 Stage — System Design Completed

Completed design areas:

- DB schema design
- Ingestion architecture
- Parser architecture
- Validation architecture
- Dedup architecture
- Logging architecture
- Difficulty modeling
- Pattern taxonomy
- Legal/content policy
- Output architecture
- Agent workflow
- Admin/internal tools
- Auth/billing architecture
- Roadmap / CLAUDE.md / master-prompt structure

Meaning:

```text
Entire SaaS system skeleton completed
```

---

# 1 Stage — Parser / Ingestion Engine

Current stable completed stage.

## Role

```text
File Upload
→ Parser
→ Validation
→ Dedup
→ DB Insert
→ Logging
```

## Implemented Features

### RW Parser
- RW parser
- MCQ support
- validation pipeline
- answer validation
- warning/reject separation
- dedup pipeline

### Math Parser
- Math parser
- MCQ support
- SPR(grid-in) support
- answer validation
- warning/reject separation

### System Layer
- Supabase insert
- ingestion logging
- file upload UI
- ingestion result UI
- review_required structure
- answer_missing structure
- Google Sheet registry logging

---

# Current Stable Baseline

```text
parser-v0.3-baseline
```

## Meaning

- Stable ingestion baseline secured
- Rollback possible
- Regression reference point created
- Ingestion stability secured
- Future parser comparison possible

Meaning:

```text
Safe SAT data ingestion system completed
```

---

# 2 Stage — Pattern Extraction Engine

## Current Active Phase

This is the REAL SaaS brain starting point.

## Goal

```text
real SAT question
→ pattern extraction
→ distractor analysis
→ reasoning analysis
→ structure analysis
→ skill taxonomy mapping
→ difficulty mapping
→ reusable generation pattern creation
```

## Core Objectives

- SAT structure analysis
- Distractor analysis
- Reasoning flow analysis
- Sentence structure analysis
- Skill taxonomy classification
- Generation pattern assetization

Meaning:

Before:
```text
Store SAT questions
```

Now:
```text
Understand SAT itself
```

---

# 3 Stage — Pattern Library Construction

Convert extracted SAT intelligence into reusable assets.

## RW Categories

- Main Idea
- Inference
- Transition
- Function
- Boundaries
- Rhetorical Synthesis
- Command of Evidence

## Math Categories

- Linear
- Quadratic
- Exponential
- Systems
- Geometry
- Trig
- Statistics
- Advanced Algebra

## Additional Structures

- distractor patterns
- reasoning templates
- difficulty bands
- trap taxonomy
- timing estimation
- syntax complexity

Meaning:

```text
SAT Pattern Knowledge Base
```

---

# 4 Stage — Generated Question Engine

Core monetization engine.

## Flow

```text
pattern library
→ SAT-style generation
→ validation
→ leakage detection
→ dedup
→ quality scoring
```

## Core Requirements

- Maintain real SAT style
- Never copy real SAT text
- Fully original questions
- Preserve reasoning structure
- Tutor-grade output quality

Meaning:

```text
SAT-style original question generation engine
```

---

# 5 Stage — Worksheet Assembly Engine

Tutor-ready automation layer.

## Outputs

- Worksheet PDF
- DOCX export
- Homework sets
- Timed sets
- Skill sets
- Difficulty mix sets
- Answer keys
- Explanation sheets
- Multi-version sets

Meaning:

```text
Tutor-ready classroom automation
```

---

# 6 Stage — Tutor SaaS Layer

Final monetization SaaS layer.

## Includes

- Auth
- Billing
- Dashboard
- Usage tracking
- Saved worksheets
- Generation history
- Export UI
- Admin tools
- Tutor account system
- Subscription system
- Credit / usage system

Meaning:

```text
Production SaaS monetization layer
```

---

# Long-Term Future Architecture Direction

IMPORTANT:

These are future architecture directions.
NOT immediate implementation targets.

Current priority remains:

```text
Parser stability
→ Pattern Extraction
→ Validation precision
→ Dedup precision
→ Generation quality
```

---

# Future Expansion Concepts

## 1. Decision Engine

System-level decision brain.

Example:

```python
if validation_score < 0.92:
    regenerate_question()

if duplicate_score > threshold:
    reject_output()

if parser_confidence < 0.85:
    send_to_review_queue()
```

Role:
- Read system state
- Decide next action
- Automate workflow transitions

---

## 2. Queue System

Future async orchestration layer.

Potential queues:

- INGESTION_QUEUE
- PARSING_QUEUE
- VALIDATION_QUEUE
- GENERATION_QUEUE
- REPAIR_QUEUE
- EXPORT_QUEUE

Benefits:
- Async processing
- Parallel processing
- Retry isolation
- Scalability

NOTE:
Not needed during MVP stabilization stage.

---

## 3. Repair Agent

Instead of full regeneration:

```text
Failure analysis
→ Partial repair
→ Revalidation
```

Examples:
- distractor repair
- explanation repair
- grammar repair
- difficulty adjustment

Benefits:
- Cost reduction
- Faster stabilization
- Better consistency

---

## 4. Autonomous Retry Logic

Future autonomous recovery layer.

```text
Failure detection
→ Auto retry
→ Fallback parser
→ Alternate model
→ Human review only if final failure
```

---

## 5. Multi-Agent Architecture

Future role separation.

| Agent | Role |
|---|---|
| Parser Agent | SAT structure analysis |
| Pattern Agent | Pattern extraction |
| Generation Agent | New SAT question generation |
| Validation Agent | SAT quality validation |
| Dedup Agent | Leakage detection |
| Repair Agent | Failure repair |
| Export Agent | Worksheet generation |

---

## 6. Continuous Learning Loop

Future tutor-feedback learning loop.

```text
Tutor Feedback
→ Wrong Answer Analysis
→ Distractor Quality Update
→ Difficulty Calibration
→ Generation Policy Update
```

Long-term outcome:
- Better SAT difficulty calibration
- Better distractor quality
- Better timing estimation

---

## 7. Orchestration Layer

Central AI workflow controller.

Responsibilities:
- Agent coordination
- Retry orchestration
- Workflow routing
- State management
- Model selection
- Validation policy control

---

# Current Project Position

## Completed

```text
0 Stage completed
1 Stage completed
(parser-v0.3-baseline freeze complete)
```

## Current Active Phase

```text
2 Stage — Pattern Extraction Engine
```

---

# Most Important Principle

The project should evolve toward:

```text
Self-Orchestrating AI System
```

BUT:

Current focus MUST remain:

```text
MVP stabilization first
```

Correct order:

```text
1. Parser stabilization
2. Pattern Extraction
3. Validation strengthening
4. Dedup strengthening
5. Generation quality
6. Tutor workflow
7. Real usage data
8. Agent loop expansion
```

---

# Final Identity

This project is NOT:

```text
Simple SAT question generator
```

It is:

```text
AI-driven SAT intelligence infrastructure
```
