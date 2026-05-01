# output-selection-spec.md (v3 · FINAL · Agent-Ready)

---

## 0. Purpose

Defines tutor-facing output selection model.
This is the bridge between tutor intent and generation engine.

Must integrate with:
- docs/output-design.md
- docs/output-ui-ux.md
- docs/quality-validation.md
- docs/pdf-layout-spec.md
- docs/ui-flow.md

---

## 1. Core Principle

Tutor does NOT generate questions.
Tutor configures a learning package.

---

## 2. Selection Structure

### [기본]
section
module
skills
question_count

### [핵심]
purpose
student_level
difficulty_mode
difficulty_curve
style_mode
time_constraint

### [출력 설정]
output_profile
explanation_level
explanation_style
export_format (PDF only in MVP)

### [출력 구성물]
student_questions
answer_key
correct_answer_explanation
wrong_answer_explanation
mistake_note
skill_summary
difficulty_summary
tutor_teaching_notes
student_review_notes

### [운영]
assignment_mode
assignment_title
student_name
due_time

### [템플릿]
template_mode

### [고급]
answer_distribution
distractor_strength
pattern_diversity
skill_weighting

### [시스템]
error_tolerance_mode

---

## 3. Purpose (핵심 필드)

Homework
In-Class Practice
Test
Review
Diagnostic

---

## 4. Output Profile Mapping

Student Clean
= student_questions

Homework + Key
= student_questions + answer_key

Full Review Pack
= student_questions + answer_key + correct_answer_explanation + wrong_answer_explanation + student_review_notes

Tutor Compact
= student_questions + answer_key + tutor_teaching_notes

Test Mode
= student_questions only (answers hidden)

---

## 5. Export Rule

export_format = PDF

Rules:
- must pass validation
- must use pdf-layout-spec
- no real_questions

---

## 6. Validation Before Generation

Check:
- required fields exist
- skill count valid
- difficulty valid
- usage allowed
- output_profile allowed

Fail → block

---

## 7. Payload Mapping (Example)

{
  "section": "RW",
  "skills": ["Main-Idea"],
  "purpose": "Homework",
  "difficulty_mode": "Medium",
  "question_count": 10,
  "output_profile": "Homework + Key",
  "export_format": "PDF"
}

---

## 8. Final Rule

Output selection defines product quality.

---

END
