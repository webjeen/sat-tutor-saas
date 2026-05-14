# Claude Bootstrap Prompt — SAT Tutor SaaS

## Purpose

Standard startup bootstrap prompt for Claude Code sessions.

Use this when:
- starting a new Claude Code session
- after context reset
- after terminal restart
- when operational context may be lost

---

# STANDARD BOOTSTRAP PROMPT

```text
Read CLAUDE.md first.
Read docs/master-system-flow.md.
Follow repository operational memory architecture.
Check current project phase before implementation.
Follow tasks/ documents when available.
Do not skip validation, orchestration, or workflow constraints.
```

---

# CURRENT ACTIVE PHASE (CURRENT)

## Pattern Extraction Engine Refinement Phase

```text
Continue Pattern Extraction Engine refinement phase.

Focus on:
- extraction quality calibration
- taxonomy refinement
- distractor classification refinement
- reasoning category tuning
- extraction scoring
- review workflow stabilization
- false classification reduction
- batch extraction reliability

Do not start Pattern Library phase yet.
```

---

# USAGE RULE

## New Claude Session

Use:
- STANDARD BOOTSTRAP PROMPT
- CURRENT ACTIVE PHASE prompt

Together.

---

## Existing Active Session

If the Claude session is already active and repository context is already loaded:

Only send:
- current phase instruction
- current refinement direction

No need to repeat full bootstrap prompt.

---

# LONG-TERM FUTURE DIRECTION

Future architecture goal:

- automatic CLAUDE.md loading
- startup orchestration
- automatic phase detection
- task auto-routing
- repository-aware initialization

Reference:
- tasks/future-claude-autoload.md

---

# FINAL PRINCIPLE

Repository memory > conversation memory

The repository itself is the operational memory system.
