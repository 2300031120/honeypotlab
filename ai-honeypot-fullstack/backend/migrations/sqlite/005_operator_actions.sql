create table if not exists operator_actions (
    id integer primary key autoincrement,
    user_id integer not null,
    actor_username text not null,
    action text not null,
    target_type text,
    target_id text,
    summary text not null,
    severity text not null default 'medium',
    source_ip text,
    metadata text not null default '{}',
    created_at text not null
);

create index if not exists idx_operator_actions_user_created_at
on operator_actions(user_id, created_at desc);
