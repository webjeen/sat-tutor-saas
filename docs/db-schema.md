# SAT Tutor SaaS DB Schema Guideline (FINAL · Agent-Ready)

---

## 0. Purpose

Database design for ingestion → validation/dedup → pattern → generation → worksheet → export → logging.

Naming policy:
SAT = product / brand
DSAT = execution scope (MVP)
exam_family = DSAT

---

## 1. Core Principle

Exam → Section → Module → Real Question → Pattern → Generated Question → Worksheet → Export

All pipeline tables MUST include:
status
processing_stage
retry_count
error_message
last_processed_at
created_at
updated_at

---

## 2. Naming Policy

exam_family ENUM:
DSAT, ACT, AP

Do NOT hardcode DSAT-only logic.

---

## 3. Input Mapping (1:1)

Exam → exams.exam_family
Section → sections.name
Module → modules.module_number
Question_ID → real_questions.question_number
Question_Type → real_questions.question_type

---

## 4. Core Separation

real_questions = internal only
generated_questions = user-facing only

---

## 5. Decision Integration

validation = rejected → DO NOT insert real_questions
validation = review_required → insert review_queue
validation_passed AND dedup_clean → allow insert

generated fails validation → not approved_for_release
worksheet validation fails → block export

---

## 6. Agent Loop Writes

read state → write → validate → update status → log decision → continue/retry/review/reject

No silent writes.

---

## 7. Dedup / Leak Fields

fingerprint_text
fingerprint_structure
fingerprint_choice
pattern_signature

Checks:
real↔real, real↔generated, generated↔generated, worksheet-level, user exposure

---

## 8. Security

Never expose real_questions
No review_required into pattern extraction

---

## 9. Indexes

real_questions(fingerprint_text)
generated_questions(fingerprint_text)
validation_results(target_type, target_id)
review_queue(status)
generation_jobs(status)

---

## 10. Non-Negotiable

No real exposure
No unvalidated insert
No review bypass
No export before validation
Version all pattern edits

---

## 11. Final

DB = execution engine

---

END
