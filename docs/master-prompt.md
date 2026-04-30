# MASTER BUILD PROMPT — SAT Tutor Worksheet Generator SaaS (Terminal Clean)

You are operating under the rules defined in CLAUDE.md.

Your task is to build an MVP of the SAT Tutor Worksheet Generator SaaS from scratch.

---

## PRIMARY GOAL

Build a working system that:

1. Accepts structured SAT RW input data
2. Stores and manages data in Supabase
3. Generates SAT-style questions based on patterns
4. Validates generated questions (no leak, no duplicates)
5. Assembles worksheets
6. Exports output (initially JSON, later PDF/DOCX)

---

## CRITICAL RULES (MANDATORY)

- Follow CLAUDE.md rules strictly
- `real_questions` must never be exposed
- Only `generated_questions` can be used for user output
- All validation layers must be implemented
- If validation fails, regenerate.
- **Do not skip validation under any condition.**

---

## MVP SCOPE (STRICT)

Focus only on:

**Section:**

- DSAT Reading and Writing

**Skills (limit to 3–5):**

- Main-Idea
- Inference
- Transition
- Grammar-Agreement

**Output:**

- Student Worksheet (JSON)
- Answer Key (JSON)
- Explanation Pack (JSON)

**Do not build:**

- Math
- Team features
- Payment integration
- Advanced UI

---

## STEP-BY-STEP EXECUTION PLAN

### STEP 1 — PROJECT STRUCTURE

Create folders:

- `app` or `src`
- `lib`
- `db`
- `agents`
- `validation`
- `generation`
- `assembly`

### STEP 2 — SUPABASE SETUP

Create tables:

- `users`
- `real_questions` (internal only)
- `patterns`
- `generated_questions`
- `generation_jobs`
- `validation_results`
- `worksheets`
- `worksheet_questions`

Include status fields, retry_count, and version tracking.

### STEP 3 — INPUT PARSING (RW ONLY)

Implement parser for `[QUESTION_START]` format.

Output structured JSON:

- `passage`
- `question`
- `choices`
- `answer`
- `type`

Do not infer missing data.

### STEP 4 — PATTERN ENGINE (BASIC)

Create pattern structure:

- `pattern_id`
- `type`
- `logic`
- `trap`
- `difficulty_range`

Implement basic pattern extraction or manual seed patterns.

### STEP 5 — GENERATION MODULE

Create generation pipeline.

**Input:**

- `pattern`
- `difficulty`
- `skill`

**Output:**

- generated question object

Must include:

- `passage`
- `question`
- `choices`
- `correct answer`
- `explanations`

### STEP 6 — VALIDATION SYSTEM (CRITICAL)

Implement all validation layers:

1. Real leak check (compare with `real_questions`)
2. Duplicate check (compare with `generated_questions`)
3. Worksheet validation (pattern diversity and answer distribution)
4. User exposure check (prevent repetition)

If any validation fails, discard and regenerate.

### STEP 7 — WORKSHEET ASSEMBLY

Build:

- worksheet creator
- question selection logic
- ordering and grouping

### STEP 8 — OUTPUT SYSTEM

Generate:

1. Student Worksheet (JSON)
2. Answer Key (JSON)
3. Explanation Pack (JSON)

### STEP 9 — LOGGING AND STATUS

Track:

- generation logs
- validation logs
- errors
- retries

---

## EXECUTION MODEL

For every step:

1. Implement
2. Run or simulate
3. Validate output
4. Fix issues
5. Continue

Repeat until stable.

---

## COMPLETION CONDITION

Do not stop until:

- generation works
- validation blocks invalid outputs
- worksheet assembles correctly
- JSON output is usable

---

## FINAL WARNING

Do not:

- skip steps
- assume correctness
- generate without validation
- expose real SAT data

---

**START**

Begin with STEP 1: project structure creation.
Proceed sequentially.
Do not skip steps.
