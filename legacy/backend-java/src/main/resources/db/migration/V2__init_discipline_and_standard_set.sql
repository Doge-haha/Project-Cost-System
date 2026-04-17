create table if not exists discipline_type (
    id uuid primary key,
    discipline_code varchar(64) not null,
    discipline_name varchar(128) not null,
    discipline_group varchar(64) not null,
    gb08_code varchar(32),
    gb13_code varchar(32),
    source_field_code varchar(32),
    source_markup varchar(64),
    source_system varchar(64),
    status varchar(32) not null default 'active',
    created_at timestamp not null default now(),
    updated_at timestamp not null default now()
);

create unique index if not exists uk_discipline_type_code
    on discipline_type(discipline_code);

create table if not exists standard_set (
    id uuid primary key,
    standard_set_code varchar(64) not null,
    standard_set_name varchar(255) not null,
    discipline_code varchar(64) not null,
    region_code varchar(32),
    standard_year integer,
    standard_type varchar(64) not null,
    source_system varchar(64),
    status varchar(32) not null default 'active',
    created_at timestamp not null default now(),
    updated_at timestamp not null default now()
);

create unique index if not exists uk_standard_set_code
    on standard_set(standard_set_code);

create table if not exists project_discipline (
    id uuid primary key,
    project_id uuid not null references project(id),
    discipline_code varchar(64) not null,
    standard_set_code varchar(64),
    sort_order integer not null default 0,
    enabled boolean not null default true,
    created_at timestamp not null default now(),
    updated_at timestamp not null default now()
);

create unique index if not exists uk_project_discipline_project_code
    on project_discipline(project_id, discipline_code);

insert into discipline_type (
    id,
    discipline_code,
    discipline_name,
    discipline_group,
    gb08_code,
    gb13_code,
    source_field_code,
    source_markup,
    source_system
)
values
    ('00000000-0000-0000-0000-000000000101', 'building', '建筑工程', '建安', 'AB', '01B', 'ZY', '1', 'xindian_jiangsu'),
    ('00000000-0000-0000-0000-000000000102', 'decoration', '装饰工程', '建安', 'BB', '01B', 'ZY', '2', 'xindian_jiangsu'),
    ('00000000-0000-0000-0000-000000000103', 'installation', '安装工程', '建安', 'CB', '03B', 'ZY', '3', 'xindian_jiangsu'),
    ('00000000-0000-0000-0000-000000000104', 'municipal', '市政工程', '市政', 'DB', '04B', 'ZY', '4', 'xindian_jiangsu'),
    ('00000000-0000-0000-0000-000000000105', 'landscape', '园林绿化工程', '园林', 'EB', '05B', 'ZY', '5', 'xindian_jiangsu')
on conflict do nothing;

insert into standard_set (
    id,
    standard_set_code,
    standard_set_name,
    discipline_code,
    region_code,
    standard_year,
    standard_type,
    source_system
)
values
    ('00000000-0000-0000-0000-000000000201', '012013tj', '2013土建工程', 'building', 'JS', 2013, 'quota', 'xindian_jiangsu'),
    ('00000000-0000-0000-0000-000000000202', '012002zs', '2002装饰工程', 'decoration', 'JS', 2002, 'quota', 'xindian_jiangsu'),
    ('00000000-0000-0000-0000-000000000203', '012013az', '2013安装工程', 'installation', 'JS', 2013, 'quota', 'xindian_jiangsu'),
    ('00000000-0000-0000-0000-000000000204', '012021sz', '2021市政工程', 'municipal', 'JS', 2021, 'quota', 'xindian_jiangsu'),
    ('00000000-0000-0000-0000-000000000205', '012017ylyh', '2017园林绿化', 'landscape', 'JS', 2017, 'quota', 'xindian_jiangsu')
on conflict do nothing;
