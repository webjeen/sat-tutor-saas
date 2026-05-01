# SAT Tutor SaaS Auth & Billing Design Guideline (FINAL · Agent-Ready)

---

## 0. Purpose

Defines auth, billing, and usage control.

Naming policy:
SAT = product / brand
DSAT = execution scope (MVP)
exam_family = DSAT

Must be used with:
- docs/usage-logging-versioning.md
- docs/output-ui-ux.md
- docs/admin-internal-tool.md
- docs/db-schema.md
- docs/master-design.md

---

## 1. Core Principle

Auth = identity  
Billing = access  
Usage = control  

---

## 2. Flow

signup
→ login
→ check plan
→ check subscription
→ check usage
→ allow / block
→ log

---

## 3. Auth

Supabase Auth

Rules:
email verification required  
server-side validation required  
JWT required  

---

## 4. User Fields

id
email
plan
usage_today
last_reset_at
created_at
updated_at

---

## 5. Plans

free
pro
team

---

## 6. FREE

limit: 5/day  
export limited  

---

## 7. PRO

unlimited  
full export  

---

## 8. Paddle

handles:
billing
tax
subscription

---

## 9. Webhook

sync subscription
verify signature
update DB

---

## 10. Access Decision

unauthenticated → block  
past_due → block  
free limit exceeded → block  
free export → block  
pro active → allow  

---

## 11. Usage

check before generation  
reset daily (UTC)

---

## 12. Agent Loop

auth
→ plan
→ subscription
→ usage
→ decision
→ log

---

## 13. State Model

authenticated
unauthenticated
subscription_active
subscription_past_due
usage_allowed
usage_blocked

---

## 14. Logging

user_id
action
plan
usage
decision
timestamp

---

## 15. Security

no client trust  
server validation only  
no export without check  

---

## 16. Core Rule

No billing → no business  

---

END
