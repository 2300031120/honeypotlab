pragma foreign_keys = off;

alter table canary_tokens add column user_id integer;
alter table canary_tokens add column site_id integer;
create index if not exists idx_canary_tokens_user_id on canary_tokens(user_id);
create index if not exists idx_canary_tokens_site_id on canary_tokens(site_id);

create table blocked_ips_v2 (
    id integer primary key autoincrement,
    user_id integer,
    ip text not null,
    reason text,
    created_at text not null
);

insert into blocked_ips_v2 (id, user_id, ip, reason, created_at)
select id, null, ip, reason, created_at from blocked_ips;

drop table blocked_ips;
alter table blocked_ips_v2 rename to blocked_ips;
create unique index idx_blocked_ips_user_ip on blocked_ips(user_id, ip);

create table runtime_settings_v2 (
    id integer primary key autoincrement,
    user_id integer,
    key text not null,
    value text not null,
    updated_at text not null
);

insert into runtime_settings_v2 (user_id, key, value, updated_at)
select null, key, value, updated_at from runtime_settings;

drop table runtime_settings;
alter table runtime_settings_v2 rename to runtime_settings;
create unique index idx_runtime_settings_user_key on runtime_settings(user_id, key);

pragma foreign_keys = on;
