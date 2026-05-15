-- Tutor SaaS Layer tables
-- Migration 004

-- =============================================
-- tutor_jobs: Main job tracking table
-- =============================================
CREATE TABLE IF NOT EXISTS tutor_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('generation', 'worksheet_export', 'review')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'draft', 'review_required', 'approved_for_export', 'exporting', 'exported', 'failed', 'rejected')),
  stage TEXT NOT NULL DEFAULT 'intake' CHECK (stage IN ('intake', 'generating', 'validating', 'assembling', 'assembly_validation', 'layout_validation', 'rendering', 'complete', 'failed')),
  config JSONB NOT NULL DEFAULT '{}',
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  error_message TEXT,
  decision_reason TEXT,
  generation_job_id TEXT,
  worksheet_job_id TEXT,
  export_job_id TEXT,
  validation_snapshot JSONB,
  last_processed_at TIMESTAMPTZ,
  exported_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tutor_jobs_status ON tutor_jobs(status);
CREATE INDEX idx_tutor_jobs_type ON tutor_jobs(type);
CREATE INDEX idx_tutor_jobs_created_at ON tutor_jobs(created_at DESC);

-- =============================================
-- tutor_exports: Export metadata tracking
-- =============================================
CREATE TABLE IF NOT EXISTS tutor_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES tutor_jobs(id) ON DELETE CASCADE,
  profile TEXT NOT NULL,
  pdf_size_bytes INTEGER,
  question_count INTEGER NOT NULL DEFAULT 0,
  section TEXT NOT NULL DEFAULT '',
  categories TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tutor_exports_job_id ON tutor_exports(job_id);
CREATE INDEX idx_tutor_exports_created_at ON tutor_exports(created_at DESC);

-- =============================================
-- tutor_reviews: Review decisions log
-- =============================================
CREATE TABLE IF NOT EXISTS tutor_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES tutor_jobs(id) ON DELETE CASCADE,
  reviewer_id TEXT,
  decision TEXT NOT NULL CHECK (decision IN ('approve', 'reject', 'retry')),
  notes TEXT NOT NULL DEFAULT '',
  previous_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tutor_reviews_job_id ON tutor_reviews(job_id);
CREATE INDEX idx_tutor_reviews_decision ON tutor_reviews(decision);

-- =============================================
-- tutor_audit_events: Operational audit trail
-- =============================================
CREATE TABLE IF NOT EXISTS tutor_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tutor_audit_events_job_id ON tutor_audit_events(job_id);
CREATE INDEX idx_tutor_audit_events_event_type ON tutor_audit_events(event_type);
CREATE INDEX idx_tutor_audit_events_created_at ON tutor_audit_events(created_at DESC);
