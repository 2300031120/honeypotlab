alter table canary_tokens add column if not exists user_id bigint;
alter table canary_tokens add column if not exists site_id bigint;
create index if not exists idx_canary_tokens_user_id on canary_tokens(user_id);
create index if not exists idx_canary_tokens_site_id on canary_tokens(site_id);

create table runtime_settings_v2 (
    id bigserial primary key,
    user_id bigint,
    key text not null,
    value text not null,
    updated_at timestamptz not null
);

insert into runtime_settings_v2 (user_id, key, value, updated_at)
select null, key, value, updated_at from runtime_settings
on conflict do nothing;

drop table runtime_settings;
alter table runtime_settings_v2 rename to runtime_settings;
create unique index if not exists idx_runtime_settings_user_key on runtime_settings(user_id, key);

alter table blocked_ips add column if not exists user_id bigint;
do $$
begin
    if exists (
        select 1
        from information_schema.table_constraints
        where table_name = 'blocked_ips'
          and constraint_type = 'UNIQUE'
          and constraint_name = 'blocked_ips_ip_key'
    ) then
        alter table blocked_ips drop constraint blocked_ips_ip_key;
    end if;
end $$;

create unique index if not exists idx_blocked_ips_user_ip on blocked_ips(user_id, ip);
