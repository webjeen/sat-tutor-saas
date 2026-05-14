-- =========================================
-- MIGRATION 001: Pattern Extraction Engine
-- =========================================
-- Expands patterns table for full extraction output.
-- Adds extraction_logs, pattern_dedup_log tables.
-- Adds state machine fields to real_questions.
-- =========================================

-- =========================================
-- DROP OLD PATTERNS TABLE (replaced)
-- =========================================
DROP TABLE IF EXISTS patterns CASCADE;

-- =========================================
-- PATTERNS (EXPANDED)
-- =========================================
create table patterns (
    id uuid primary key default uuid_generate_v4(),

    -- Source tracking
    source_question_id uuid references real_questions(id),
    exam_family text not null default 'DSAT',
    section text not null,

    -- Pattern classification
    type text not null,
    skill text,
    difficulty_band text,

    -- Structured extraction output (JSONB for flexible schema)
    extracted_data jsonb not null default '{}',

    -- Denormalized query columns (from extracted_data)
    reasoning_pattern text,
    distractor_pattern text,
    timing_complexity text,
    syntax_complexity text,
    abstraction_level text,

    -- Legacy/compat fields (preserved for generated_questions FK)
    structure text,
    logic text,
    trap text,
    difficulty_level text,

    -- State machine
    status text not null default 'pattern_candidate',
    processing_stage text,
    retry_count int default 0,
    error_message text,
    last_processed_at timestamp,

    -- Versioning
    version int not null default 1,
    is_active boolean default true,

    created_at timestamp default now(),
    updated_at timestamp default now()
);

-- =========================================
-- EXTRACTION LOGS
-- =========================================
create table extraction_logs (
    id uuid primary key default uuid_generate_v4(),

    source_question_id uuid references real_questions(id),
    pattern_id uuid references patterns(id),

    section text not null,
    extraction_stage text not null,
    status text not null,

    decision text,
    decision_reason text,

    validation_results jsonb default '{}',

    error_message text,
    retry_count int default 0,

    extraction_duration_ms int,
    fingerprint_text text,
    fingerprint_structure text,

    created_at timestamp default now()
);

-- =========================================
-- PATTERN DEDUP LOG
-- =========================================
create table pattern_dedup_log (
    id uuid primary key default uuid_generate_v4(),

    new_pattern_id uuid references patterns(id),
    existing_pattern_id uuid references patterns(id),

    similarity_score numeric(6,4) not null,
    match_type text not null,
    decision text not null,
    decision_reason text,

    created_at timestamp default now()
);

-- =========================================
-- ADD STATE MACHINE FIELDS TO REAL_QUESTIONS
-- =========================================
ALTER TABLE real_questions ADD COLUMN IF NOT EXISTS question_type text;
ALTER TABLE real_questions ADD COLUMN IF NOT EXISTS fingerprint_choice text;
ALTER TABLE real_questions ADD COLUMN IF NOT EXISTS pattern_signature text;
ALTER TABLE real_questions ADD COLUMN IF NOT EXISTS processing_stage text;
ALTER TABLE real_questions ADD COLUMN IF NOT EXISTS retry_count int DEFAULT 0;
ALTER TABLE real_questions ADD COLUMN IF NOT EXISTS error_message text;
ALTER TABLE real_questions ADD COLUMN IF NOT EXISTS last_processed_at timestamp;
ALTER TABLE real_questions ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();

-- =========================================
-- INDEXES
-- =========================================
create index idx_patterns_source_question on patterns(source_question_id);
create index idx_patterns_section on patterns(section);
create index idx_patterns_type on patterns(type);
create index idx_patterns_status on patterns(status);
create index idx_patterns_version on patterns(version);
create index idx_patterns_extracted_data on patterns using gin(extracted_data);
create index idx_patterns_difficulty_band on patterns(difficulty_band);

create index idx_extraction_logs_source on extraction_logs(source_question_id);
create index idx_extraction_logs_pattern on extraction_logs(pattern_id);
create index idx_extraction_logs_status on extraction_logs(status);
create index idx_extraction_logs_stage on extraction_logs(extraction_stage);
create index idx_extraction_logs_created on extraction_logs(created_at);

create index idx_pattern_dedup_new on pattern_dedup_log(new_pattern_id);
create index idx_pattern_dedup_existing on pattern_dedup_log(existing_pattern_id);
