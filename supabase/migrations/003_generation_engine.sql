-- =========================================
-- MIGRATION 003: Generated Question Engine
-- =========================================
-- Template-driven SAT question generation pipeline.
-- Tables: generated_questions, generation_jobs,
--         generation_logs, validation_results
-- =========================================

-- =========================================
-- GENERATED QUESTIONS (USER-FACING OUTPUT)
-- =========================================
create table generated_questions (
    id uuid primary key default uuid_generate_v4(),

    -- Source tracking
    template_id uuid references pattern_templates(id),
    pattern_id uuid references patterns(id),

    -- Classification
    section text not null,
    category text not null,
    question_type text not null default 'mcq',

    -- Generated content
    generated_passage text,
    generated_question text not null,
    choice_a text,
    choice_b text,
    choice_c text,
    choice_d text,
    correct_choice text not null,

    -- Explanations
    tutor_explanation text,
    student_explanation text,

    -- Difficulty
    difficulty_score int,
    mapped_level text,
    difficulty_factors jsonb default '{}',

    -- Analysis
    distractor_analysis jsonb default '{}',
    reasoning_trace jsonb default '[]',

    -- State machine
    status text not null default 'generation_pending',
    processing_stage text,
    retry_count int default 0,
    error_message text,
    last_processed_at timestamp,

    -- Fingerprint (dedup + leakage detection)
    fingerprint_text text,
    fingerprint_structure text,
    fingerprint_choice text,
    pattern_signature text,

    -- Versioning
    version int not null default 1,
    is_active boolean default true,
    approved_for_release boolean default false,

    created_at timestamp default now(),
    updated_at timestamp default now()
);

-- =========================================
-- GENERATION JOBS
-- =========================================
create table generation_jobs (
    id uuid primary key default uuid_generate_v4(),

    template_id uuid references pattern_templates(id),
    section text,
    category text,
    difficulty_target text,

    question_count_requested int default 1,
    question_count_generated int default 0,
    question_count_approved int default 0,

    -- State machine
    status text not null default 'pending',
    processing_stage text,
    retry_count int default 0,
    error_message text,
    last_processed_at timestamp,

    started_at timestamp,
    completed_at timestamp,
    created_at timestamp default now(),
    updated_at timestamp default now()
);

-- =========================================
-- GENERATION LOGS
-- =========================================
create table generation_logs (
    id uuid primary key default uuid_generate_v4(),

    generation_job_id uuid references generation_jobs(id),
    generated_question_id uuid references generated_questions(id),
    template_id uuid references pattern_templates(id),

    section text,
    category text,

    stage text not null,
    status text not null,
    decision text,
    decision_reason text,

    validation_results jsonb default '{}',
    error_message text,
    retry_count int default 0,

    llm_model text,
    llm_tokens_used int,
    generation_duration_ms int,

    fingerprint_text text,
    fingerprint_structure text,

    created_at timestamp default now()
);

-- =========================================
-- VALIDATION RESULTS
-- =========================================
create table validation_results (
    id uuid primary key default uuid_generate_v4(),

    generated_question_id uuid references generated_questions(id),
    generation_log_id uuid references generation_logs(id),
    template_id uuid references pattern_templates(id),

    leak_check_result text,
    leak_check_score numeric(6,4),

    duplicate_check_result text,
    duplicate_check_score numeric(6,4),

    structure_check_result text,
    difficulty_check_result text,
    distractor_check_result text,

    difficulty_score int,
    mapped_level text,

    all_checks_passed boolean default false,
    decision text,
    decision_reason text,

    status text not null default 'validation_pending',
    created_at timestamp default now()
);

-- =========================================
-- INDEXES
-- =========================================

-- generated_questions
create index idx_gq_fingerprint_text on generated_questions(fingerprint_text);
create index idx_gq_fingerprint_structure on generated_questions(fingerprint_structure);
create index idx_gq_template on generated_questions(template_id);
create index idx_gq_status on generated_questions(status);
create index idx_gq_section on generated_questions(section);
create index idx_gq_category on generated_questions(category);
create index idx_gq_difficulty on generated_questions(difficulty_score);
create index idx_gq_approved on generated_questions(approved_for_release);

-- generation_jobs
create index idx_gj_template on generation_jobs(template_id);
create index idx_gj_status on generation_jobs(status);
create index idx_gj_created on generation_jobs(created_at);

-- generation_logs
create index idx_gl_job on generation_logs(generation_job_id);
create index idx_gl_template on generation_logs(template_id);
create index idx_gl_stage on generation_logs(stage);
create index idx_gl_status on generation_logs(status);
create index idx_gl_created on generation_logs(created_at);

-- validation_results
create index idx_vr_question on validation_results(generated_question_id);
create index idx_vr_template on validation_results(template_id);
create index idx_vr_status on validation_results(status);
create index idx_vr_passed on validation_results(all_checks_passed);
