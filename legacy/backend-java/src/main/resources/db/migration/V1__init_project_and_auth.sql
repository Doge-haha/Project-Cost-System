create table if not exists project (
    id uuid primary key,
    project_code varchar(64) not null,
    project_name varchar(255) not null,
    project_type varchar(128) not null,
    template_name varchar(128) not null,
    project_status varchar(32) not null default 'draft',
    owner_user_id uuid not null,
    default_price_version_id uuid,
    default_fee_template_id uuid,
    client_name varchar(255),
    location_code varchar(64),
    location_text varchar(255),
    building_area numeric(18,2),
    structure_type varchar(128),
    description text,
    created_at timestamp not null default now(),
    updated_at timestamp not null default now()
);

create unique index if not exists uk_project_project_code on project(project_code);

create table if not exists project_stage (
    id uuid primary key,
    project_id uuid not null references project(id),
    stage_code varchar(32) not null,
    stage_name varchar(128) not null,
    stage_order integer not null,
    stage_status varchar(32) not null default 'not_started',
    enabled boolean not null default true,
    owner_user_id uuid,
    reviewer_user_id uuid,
    ai_enabled boolean not null default false,
    auto_flow_mode varchar(32) not null default 'manual_confirm',
    created_at timestamp not null default now(),
    updated_at timestamp not null default now()
);

create unique index if not exists uk_project_stage_project_stage_code
    on project_stage(project_id, stage_code);

create table if not exists project_member (
    id uuid primary key,
    project_id uuid not null references project(id),
    user_id uuid not null,
    platform_role varchar(64) not null,
    business_identity varchar(64),
    member_status varchar(32) not null default 'active',
    created_at timestamp not null default now(),
    updated_at timestamp not null default now()
);

create unique index if not exists uk_project_member_project_user
    on project_member(project_id, user_id);

create table if not exists project_role_scope (
    id uuid primary key,
    project_member_id uuid not null references project_member(id),
    scope_type varchar(32) not null,
    scope_code varchar(64) not null,
    created_at timestamp not null default now()
);
