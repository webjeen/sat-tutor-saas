# SAT Math Input Data Specification (FINAL · LOCKED · Agent-Ready)

---

## 0. Purpose

Defines strict Math input format.

Naming policy:
SAT = product / brand
DSAT = execution scope (MVP)
exam_family = DSAT

---

## 1. Core Rules

no guessing  
no summarization  
record facts only  
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
Section: Math  
Module: [1 or 2]  
Question_ID: [id]  
Question_Type: [Domain-Subdomain-Detail]

[QUESTION]  
...

[CHOICES]  
A. ...  
B. ...  
C. ...  
D. ...

[GRAPH]  
...

[FORMULA]  
...

[ANSWER]  
...

[ANSWER_EXPLANATION]  
...

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
