# SAT SaaS Implementation Roadmap

Claude Code 기준 실행 로드맵

---

## Phase 0. 현재 완료 상태

### 완료된 것:

1. 14개 지침서 업로드 완료
2. CLAUDE.md 작성 완료
3. Master Prompt 작성 완료
4. Supabase 프로젝트 생성 완료
5. Supabase DB 테이블 생성 완료

### 현재 위치:

개발 시작 직전

---

## Phase 1. 프로젝트 기본 세팅

**목표:** Claude Code가 실제 개발할 프로젝트 뼈대를 만든다.

**작업:**

- Next.js 프로젝트 생성
- TypeScript 적용
- Tailwind CSS 적용
- Supabase client 설정
- 환경변수 파일 준비

**산출물:**

- `package.json`
- `.env.local`
- `src/`
- `lib/supabase.ts`

**완료 기준:**

- `npm run dev` 실행 성공
- 기본 페이지 렌더링 성공
- Supabase 연결 코드 존재

---

## Phase 2. Supabase 연결

**목표:** 웹앱이 Supabase DB와 연결되는지 확인한다.

**작업:**

- Supabase URL 설정
- anon key 설정
- Supabase client 생성
- 테스트 쿼리 작성
- users 또는 patterns 테이블 읽기 테스트

**완료 기준:**

- Supabase 연결 성공
- 콘솔 에러 없음
- DB 읽기 테스트 성공

---

## Phase 3. 내부 데이터 구조 코드화

**목표:** DB 테이블과 앱 코드의 타입을 맞춘다.

**작업:**

- `real_questions` 타입 정의
- `patterns` 타입 정의
- `generated_questions` 타입 정의
- `worksheets` 타입 정의
- `validation_results` 타입 정의

**산출물:**

- `src/types/database.ts`
- `src/types/question.ts`
- `src/types/worksheet.ts`

**완료 기준:**

- TypeScript 에러 없음
- DB 컬럼과 타입 구조 일치

---

## Phase 4. RW 입력 파서 구현

**목표:** SAT RW 입력 지침서 형식의 텍스트를 JSON으로 변환한다.

**작업:**

- `[QUESTION_START]` 기준 문제 분리
- PASSAGE 추출
- QUESTION 추출
- CHOICES 추출
- ANSWER 추출
- UNCLEAR 추출
- JSON 변환

**산출물:**

- `src/lib/parser/rwParser.ts`

**완료 기준:**

- 입력 → JSON 변환 성공
- 누락 필드 UNCLEAR 처리
- 추측 없이 파싱

---

## Phase 5. Pattern Engine 기본 구현

**목표:** 생성 문제의 기반이 되는 패턴 구조 구현

**작업:**

- pattern 타입 정의
- seed pattern 작성
  - Main-Idea
  - Inference
  - Transition
  - Grammar-Agreement 패턴 추가

**산출물:**

- `src/lib/patterns/`
- `seedPatterns.ts`

**완료 기준:**

- 최소 4개 패턴 존재
- logic / trap / difficulty 포함

---

## Phase 6. Question Generation 구현

**목표:** 패턴 기반 문제 생성

**작업:**

- pattern 선택
- skill 선택
- difficulty 설정
- passage 생성
- question 생성
- choices 생성
- correct answer 생성
- explanation 생성

**산출물:**

- `src/lib/generation/questionGenerator.ts`

**완료 기준:**

- `generated_question` 객체 생성
- `pattern_id` 포함
- `explanation` 포함

---

## Phase 7. Validation Pipeline 구현

**목표:** 생성 문제 검증 시스템 구축

**작업:**

- real leak check
- duplicate check
- worksheet validation
- user exposure check
- validation 결과 저장

**산출물:**

- `src/lib/validation/`

**완료 기준:**

- validation 실패 시 차단
- validation 성공 시 승인

---

## Phase 8. Worksheet Assembly 구현

**목표:** 검증된 문제 조립

**작업:**

- 승인된 문제만 선택
- `question_count` 기준 선택
- order 설정
- worksheet 생성

**산출물:**

- `src/lib/assembly/worksheetBuilder.ts`

**완료 기준:**

- worksheet 생성 성공
- 매핑 정상

---

## Phase 9. Output JSON 생성

**목표:** 출력 구조 생성

**작업:**

- Student Worksheet
- Answer Key
- Explanation Pack

**산출물:**

- `src/lib/output/`

**완료 기준:**

- 출력 구조 정상

---

## Phase 10. MVP UI 구현

**목표:** 생성 → 출력 흐름 확인

**화면:**

- Dashboard
- Generator
- Preview
- Output Viewer

**완료 기준:**

- 버튼 클릭으로 생성 가능

---

## Phase 11. Auth 연결

**목표:** 사용자 시스템 구축

**작업:**

- 로그인
- 세션 관리
- `user_id` 연결

**완료 기준:**

- 로그인 가능

---

## Phase 12. Usage 제한

**목표:** FREE/PRO 구조 구현

**작업:**

- `usage_today` 증가
- 제한 체크

**완료 기준:**

- FREE 제한 작동

---

## Phase 13. Admin 최소 기능

**목표:** 내부 관리 기능

**작업:**

- 데이터 조회
- validation 확인

**완료 기준:**

- 내부 데이터 확인 가능

---

## Phase 14. Export 확장 준비

**목표:** PDF/DOCX 확장 구조 준비

**완료 기준:**

- 확장 가능한 구조

---

## Phase 15. Billing (후순위)

**조건:**

- 시스템 안정 후 진행

---

## 전체 개발 순서 요약

1. Project scaffold
2. Supabase connection
3. Type definitions
4. RW parser
5. Pattern engine
6. Generation
7. Validation
8. Assembly
9. Output
10. UI
11. Auth
12. Usage
13. Admin
14. Export
15. Billing

---

## Claude Code 실행 방식

**한 번에 전체 구현 금지**

**단계별 실행:**

- Phase 1 구현 → 테스트
- Phase 2 구현 → 테스트
- 반복

---

## 현재 다음 단계

1. Claude Code 실행
2. Master Prompt 입력
3. Phase 1부터 시작

---

## 핵심 원칙

- 단계별 구현
- 항상 실행 후 검증
- 구조 변경 최소화

---

한 줄 정리: **설계는 끝났다. 이제 순서대로 만들면 된다.**
