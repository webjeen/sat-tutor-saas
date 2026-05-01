# implementation-roadmap.md — SAT Tutor SaaS (FINAL · AGENT LOOP)

---

## CORE CHANGE

Agent execution roadmap.

Naming policy:
SAT = product / brand
DSAT = execution scope (MVP)
exam_family = DSAT

---

## GLOBAL EXECUTION MODEL

PLAN
→ EXECUTE
→ VALIDATE
→ DETECT FAILURE
→ DECIDE
→ RETRY / REVIEW / REGENERATE / REJECT
→ LOG
→ NEXT

---

## STATE MODEL

phase_status
retry_count
error_message
last_run_at
created_at
updated_at

---

## DECISION ENGINE

success → next  
fail → retry ≤ 3  
repeat fail → review  

---

## PHASES

1. Setup  
2. DB  
3. Types  
4. Parser  
5. Pattern  
6. Generation  
7. Validation  
8. Assembly  
9. Output  

---

## STRATEGY

read state
→ pick phase
→ execute
→ validate
→ loop

---

## FINAL RULE

Execution control system

---

END
