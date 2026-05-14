-- =========================================
-- MIGRATION 002: Pattern Library Construction
-- =========================================
-- Converts extracted pattern intelligence into
-- reusable, generation-ready template assets.
-- =========================================

-- Required for fuzzy text search
create extension if not exists pg_trgm;

-- =========================================
-- PATTERN TEMPLATES (CORE ASSET)
-- =========================================
create table pattern_templates (
    id uuid primary key default uuid_generate_v4(),

    -- Classification
    section text not null,
    category text not null,
    subcategory text,

    -- Source patterns that contributed to this template
    source_pattern_ids uuid[] not null default '{}',

    -- Generation-ready content
    reasoning_flow jsonb not null default '[]',
    distractor_strategy jsonb not null default '{}',
    difficulty_parameters jsonb not null default '{}',
    constraint_rules jsonb not null default '[]',

    -- Denormalized for query
    distractor_patterns text[] not null default '{}',
    difficulty_bands text[] not null default '{}',
    reasoning_depth text,

    -- Template metadata
    template_name text not null,
    template_description text,
    generation_readiness numeric(3,2) default 0,

    -- State machine
    status text not null default 'template_draft',
    processing_stage text,
    retry_count int default 0,
    error_message text,
    last_processed_at timestamp,

    -- Versioning
    version int not null default 1,
    is_active boolean default true,
    supersedes_id uuid references pattern_templates(id),

    created_at timestamp default now(),
    updated_at timestamp default now()
);

-- =========================================
-- DISTRACTOR CATALOG (REFERENCE)
-- =========================================
create table distractor_catalog (
    id uuid primary key default uuid_generate_v4(),

    distractor_type text unique not null,
    section text not null default 'both',

    -- Reference content
    strategy_description text not null,
    generation_guidance jsonb not null default '{}',
    quality_criteria jsonb not null default '[]',
    example_signals jsonb not null default '[]',

    -- Metadata
    effectiveness_rating numeric(3,2) default 0,
    usage_count int default 0,

    created_at timestamp default now(),
    updated_at timestamp default now()
);

-- =========================================
-- REASONING TEMPLATES
-- =========================================
create table reasoning_templates (
    id uuid primary key default uuid_generate_v4(),

    section text not null,
    category text not null,
    subcategory text,

    -- Template content
    template_name text not null,
    flow_steps jsonb not null default '[]',
    prerequisite_categories text[] default '{}',

    -- Metadata
    description text,
    estimated_difficulty_band text,
    cognitive_load numeric(3,2) default 0.5,

    -- State machine
    status text not null default 'template_draft',
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
-- PATTERN RELATIONSHIPS (GRAPH)
-- =========================================
create table pattern_relationships (
    id uuid primary key default uuid_generate_v4(),

    source_id uuid not null,
    source_type text not null,
    target_id uuid not null,
    target_type text not null,

    relationship_type text not null,
    strength numeric(3,2) default 1.0,
    evidence jsonb default '{}',

    auto_detected boolean default false,
    confirmed boolean default false,

    created_at timestamp default now(),
    updated_at timestamp default now(),

    constraint uq_relationship unique (source_id, source_type, target_id, target_type, relationship_type)
);

-- =========================================
-- PATTERN METADATA
-- =========================================
create table pattern_metadata (
    id uuid primary key default uuid_generate_v4(),

    pattern_id uuid unique references patterns(id),

    -- Usage tracking
    usage_count int default 0,
    last_used_at timestamp,

    -- Quality metrics
    quality_score numeric(3,2) default 0,
    generation_success_rate numeric(3,2) default 0,
    difficulty_calibration numeric(3,2) default 0,

    -- Validation tracking
    review_count int default 0,
    last_reviewed_at timestamp,
    confidence_at_extraction numeric(3,2) default 0,

    -- Computed
    generation_readiness numeric(3,2) default 0,

    -- State machine
    status text not null default 'metadata_pending',
    processing_stage text,
    retry_count int default 0,
    error_message text,
    last_processed_at timestamp,

    created_at timestamp default now(),
    updated_at timestamp default now()
);

-- =========================================
-- INDEXES
-- =========================================

-- pattern_templates
create index idx_templates_section on pattern_templates(section);
create index idx_templates_category on pattern_templates(category);
create index idx_templates_status on pattern_templates(status);
create index idx_templates_version on pattern_templates(version);
create index idx_templates_readiness on pattern_templates(generation_readiness);
create index idx_templates_reasoning_flow on pattern_templates using gin(reasoning_flow);
create index idx_templates_distractor_strategy on pattern_templates using gin(distractor_strategy);
create index idx_templates_distractor_patterns on pattern_templates using gin(distractor_patterns);
create index idx_templates_difficulty_bands on pattern_templates using gin(difficulty_bands);
create index idx_templates_subcategory on pattern_templates(subcategory) where subcategory is not null;
create index idx_templates_name_trgm on pattern_templates using gin(template_name gin_trgm_ops);

-- reasoning_templates
create index idx_reasoning_section on reasoning_templates(section);
create index idx_reasoning_category on reasoning_templates(category);
create index idx_reasoning_status on reasoning_templates(status);

-- pattern_relationships
create index idx_rel_source on pattern_relationships(source_id, source_type);
create index idx_rel_target on pattern_relationships(target_id, target_type);
create index idx_rel_type on pattern_relationships(relationship_type);

-- pattern_metadata
create index idx_metadata_pattern on pattern_metadata(pattern_id);
create index idx_metadata_quality on pattern_metadata(quality_score);
create index idx_metadata_readiness on pattern_metadata(generation_readiness);
create index idx_metadata_usage on pattern_metadata(usage_count);

-- distractor_catalog
create index idx_catalog_type on distractor_catalog(distractor_type);
create index idx_catalog_section on distractor_catalog(section);
