# pdf-layout-spec.md (FINAL · Agent-Ready)

---

## 0. Purpose

Defines PDF output layout for SAT Tutor SaaS.

This document ensures:
- print-ready quality
- consistent formatting
- tutor-usable worksheets

Must be used with:
- docs/output-selection-spec.md
- docs/output-design.md
- docs/quality-validation.md

---

## 1. Core Principle

PDF = final product

Bad layout = unusable product

---

## 2. Page Setup

Page Size:
- A4 (default)
- Letter (future)

Margins:
- Top: 20mm
- Bottom: 20mm
- Left: 15mm
- Right: 15mm

Font:
- Title: 16pt bold
- Body: 11~12pt
- Choice: 11pt
- Explanation: 10~11pt

Line spacing:
- 1.3 ~ 1.5

---

## 3. Output Types

1. Student Worksheet
2. Answer Key
3. Explanation Pack
4. Full Review Pack

---

## 4. Student Worksheet Layout

Header:
- Title
- Name line
- Date line
- Time limit (if exists)

Body:
- Passage (if RW)
- Question
- Choices (A–D)

Rules:
- No answers
- No explanations
- Keep passage + question together
- Avoid page break inside question block

---

## 5. Answer Key Layout

New page required

Format:
Q1  A
Q2  C
Q3  B

Rules:
- compact
- easy scan
- aligned vertically

---

## 6. Explanation Pack Layout

New page required

For each question:

Q1
Correct Answer: B

Correct Explanation:
...

Wrong Choice Analysis:
A: ...
C: ...
D: ...

Optional:
- mistake note
- tutor note
- student note

---

## 7. Full Review Pack

Combination:

Student Worksheet
→ Answer Key
→ Explanation Pack

Each section starts on new page

---

## 8. Page Break Rules

Must NOT:
- split question and choices
- split passage mid-paragraph

Must:
- start Answer Key on new page
- start Explanation on new page

---

## 9. Visual Hierarchy

Use:
- bold for question number
- spacing between questions
- indentation for choices

Avoid:
- clutter
- dense text blocks

---

## 10. Validation Before Export

Check:
- no real_questions
- all questions validated
- no duplicate
- layout integrity

Fail → block export

---

## 11. Export Rule

PDF only (MVP)

Future:
- DOCX

---

## 12. Final Principle

Readable > Beautiful

Tutor must print and use immediately.

---

END
