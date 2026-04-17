create table if not exists bill_version (
    id uuid primary key,
    project_id uuid not null references project(id),
    stage_code varchar(32) not null,
    discipline_code varchar(64) not null,
    business_identity varchar(64),
    version_no integer not null,
    version_type varchar(32) not null default 'initial',
    version_status varchar(32) not null default 'editable',
    lock_status varchar(32) not null default 'unlocked',
    source_stage_code varchar(32),
    source_version_id uuid,
    created_at timestamp not null default now(),
    updated_at timestamp not null default now()
);

create unique index if not exists uk_bill_version_project_stage_no
    on bill_version(project_id, stage_code, version_no);

create table if not exists bill_item (
    id uuid primary key,
    bill_version_id uuid not null references bill_version(id),
    parent_id uuid references bill_item(id),
    item_level integer not null,
    sort_order integer not null,
    item_code varchar(128) not null,
    item_name varchar(255) not null,
    unit varchar(64) not null,
    source_bill_id varchar(64),
    source_sequence integer,
    source_level_code varchar(128),
    is_measure_item boolean not null default false,
    quantity numeric(18,4) not null default 0,
    feature_rule_text text,
    source_reference_price numeric(18,4),
    source_fee_id varchar(64),
    measure_category varchar(64),
    measure_fee_flag varchar(64),
    measure_category_subtype varchar(64),
    system_unit_price numeric(18,4),
    manual_unit_price numeric(18,4),
    final_unit_price numeric(18,4),
    system_amount numeric(18,4),
    final_amount numeric(18,4),
    tax_rate numeric(10,4),
    source_version_label varchar(128),
    lock_status varchar(32) not null default 'unlocked',
    validation_status varchar(32) not null default 'normal',
    remark varchar(512),
    created_at timestamp not null default now(),
    updated_at timestamp not null default now()
);

create index if not exists idx_bill_item_version_sort
    on bill_item(bill_version_id, sort_order);

create table if not exists bill_item_work_item (
    id uuid primary key,
    bill_item_id uuid not null references bill_item(id),
    source_spec_code varchar(64),
    source_bill_id varchar(64),
    sort_order integer not null,
    work_content text not null,
    created_at timestamp not null default now(),
    updated_at timestamp not null default now()
);

create unique index if not exists uk_bill_item_work_item_order
    on bill_item_work_item(bill_item_id, sort_order);
