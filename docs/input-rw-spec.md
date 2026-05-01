# SAT RW Input Data Specification (FINAL · LOCKED · Agent-Ready)

---

## 0. Purpose

Defines strict RW input format.

Naming policy:
SAT = product / brand
DSAT = execution scope (MVP)
exam_family = DSAT

---

## 1. Core Rules

no guessing  
no summarization  
fixed structure  
one question per block  

---

## 2. Agent Loop

receive
→ validate
→ detect uncertainty
→ decide
→ log

---

## 3. Template (LOCKED)

[QUESTION_START]

Exam: DSAT  
Section: RW  
Module: [1 or 2]  
Question_ID: [id]  
Question_Type: [Category-Detail]

[PASSAGE]  
...

[QUESTION]  
...

[CHOICES]  
A. ...  
B. ...  
C. ...  
D. ...

[ANSWER]  
A/B/C/D

[UNCLEAR]  
...

[QUESTION_END]

---

## 4. Validation

missing → reject  
uncertain → review  
valid → pass  

---

## 5. State

uploaded
→ parsed
→ validation_passed / review_required / rejected

---

## 6. Core Rule

structure only, no interpretation

---

END
