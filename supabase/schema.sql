-- =========================================
-- EXTENSIONS
-- =========================================
create extension if not exists "uuid-ossp";

-- =========================================
-- USERS
-- =========================================
create table users (
    id uuid primary key default uuid_generate_v4(),
    email text unique not null,
    plan text default 'free',
    usage_today int default 0,
    created_at timestamp default now(),
    last_active timestamp
);

-- =========================================
-- REAL QUESTIONS (INTERNAL ONLY)
-- =========================================
create table real_questions (
    id uuid primary key default uuid_generate_v4(),

    exam text,
    section text,
    module int,
    question_number int,

    raw_passage text,
    raw_question text,

    choice_a text,
    choice_b text,
    choice_c text,
    choice_d text,

    correct_choice text,

    parsing_status text default 'pending',
    analysis_status text default 'pending',

    fingerprint_text text,
    fingerprint_structure text,

    created_at timestamp default now()
);

-- =========================================
-- PATTERNS (CORE ENGINE)
-- =========================================
create table patterns (
    id uuid primary key default uuid_generate_v4(),

    type text,
    skill text,

    structure text,
    logic text,
    trap text,

    difficulty_level text,

    version int default 1,
    is_active boolean default true,

    created_at timestamp default now()
);

-- =========================================
-- GENERATED QUESTIONS (USER CONTENT)
-- =========================================
create table generated_questions (
    id uuid primary key default uuid_generate_v4(),

    pattern_id uuid references patterns(id),

    generated_passage text,
    generated_question text,

    choice_a text,
    choice_b text,
    choice_c text,
    choice_d text,

    correct_choice text,

    tutor_explanation text,
    student_explanation text,

    difficulty_level text,

    validation_status text default 'pending',
    approved_for_release boolean default false,

    fingerprint_text text,
    fingerprint_structure text,

    created_at timestamp default now()
);

-- =========================================
-- GENERATION JOBS
-- =========================================
create table generation_jobs (
    id uuid primary key default uuid_generate_v4(),

    user_id uuid references users(id),

    section text,
    skill text,
    difficulty text,

    count_requested int,

    status text default 'pending',
    error_log text,

    created_at timestamp default now(),
    completed_at timestamp
);

-- =========================================
-- VALIDATION RESULTS
-- =========================================
create table validation_results (
    id uuid primary key default uuid_generate_v4(),

    generated_question_id uuid references generated_questions(id),

    real_leak_check boolean,
    duplicate_check boolean,
    worksheet_check boolean,
    user_exposure_check boolean,

    final_status text,

    created_at timestamp default now()
);

-- =========================================
-- WORKSHEETS
-- =========================================
create table worksheets (
    id uuid primary key default uuid_generate_v4(),

    user_id uuid references users(id),

    title text,
    section text,
    difficulty text,

    question_count int,

    created_at timestamp default now()
);

-- =========================================
-- WORKSHEET QUESTIONS (MAPPING)
-- =========================================
create table worksheet_questions (
    id uuid primary key default uuid_generate_v4(),

    worksheet_id uuid references worksheets(id),
    generated_question_id uuid references generated_questions(id),

    order_no int
);

-- =========================================
-- INDEXES (IMPORTANT FOR PERFORMANCE)
-- =========================================
create index idx_generated_questions_pattern
on generated_questions(pattern_id);

create index idx_validation_results_question
on validation_results(generated_question_id);

create index idx_worksheet_questions_ws
on worksheet_questions(worksheet_id);
