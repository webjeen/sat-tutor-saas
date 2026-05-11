# Future Task — Observability System

## Purpose

Future SAT Tutor SaaS architecture will require observability and operational monitoring.

Current MVP already contains:

- validation logging
- ingestion logging
- dedup tracking
- review_required tracking

Long-term architecture should evolve into a centralized observability system.

---

## Future Goal

Track and monitor pipeline behavior across the entire SaaS.

---

## Expected Metrics

### Ingestion Metrics

- parser success rate
- validation failure rate
- dedup warning frequency
- OCR corruption trends

### Generation Metrics

- generation success rate
- repair frequency
- regeneration loops
- difficulty distribution

### SaaS Metrics

- worksheet generation count
- tutor usage trends
- export frequency
- latency statistics

---

## Long-Term Objectives

- operational dashboards
- pipeline analytics
- quality trend analysis
- orchestration visibility
- automated anomaly detection

---

## Important

Do NOT overbuild observability during current MVP phase.

Current priority remains:

```text
Pattern Extraction Engine
```
