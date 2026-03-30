create table if not exists users (
    id integer primary key autoincrement,
    username text unique not null,
    email text unique,
    password_hash text not null,
    role text not null default 'admin',
    created_at text not null
);

create table if not exists sites (
    id integer primary key autoincrement,
    user_id integer not null,
    name text not null,
    domain text not null,
    api_key text not null,
    created_at text not null,
    updated_at text not null
);

create table if not exists events (
    id integer primary key autoincrement,
    site_id integer,
    session_id text,
    event_type text not null,
    severity text not null,
    score real not null,
    ip text,
    geo text,
    url_path text,
    http_method text,
    cmd text,
    attacker_type text,
    reputation integer default 0,
    mitre_tactic text,
    mitre_technique text,
    policy_strategy text,
    policy_risk_score real default 0,
    captured_data text,
    created_at text not null
);

create table if not exists blocked_ips (
    id integer primary key autoincrement,
    ip text unique not null,
    reason text,
    created_at text not null
);

create table if not exists leads (
    id integer primary key autoincrement,
    request_type text not null,
    name text not null,
    email text not null,
    organization text not null,
    use_case text not null,
    message text not null,
    status text not null default 'new',
    assigned_to text,
    spam_score integer default 0,
    is_repeat integer default 0,
    source_page text,
    campaign text,
    utm_source text,
    utm_medium text,
    utm_campaign text,
    notification_sent_at text,
    notification_error text,
    notification_channel_status text,
    first_response_at text,
    created_at text not null,
    updated_at text not null
);

create table if not exists lead_notes (
    id integer primary key autoincrement,
    lead_id integer not null,
    author_username text not null,
    note_text text not null,
    created_at text not null
);

create table if not exists lead_status_history (
    id integer primary key autoincrement,
    lead_id integer not null,
    old_status text,
    new_status text not null,
    changed_by_username text not null,
    changed_at text not null
);

create table if not exists analytics_events (
    id integer primary key autoincrement,
    name text not null,
    page_path text,
    payload text,
    created_at text not null
);

create table if not exists runtime_settings (
    key text primary key,
    value text not null,
    updated_at text not null
);

create table if not exists canary_tokens (
    id integer primary key autoincrement,
    token text unique not null,
    label text not null,
    token_type text not null default 'URL',
    relative_path text not null,
    triggered integer not null default 0,
    triggered_at text,
    triggered_ip text,
    created_at text not null,
    updated_at text not null
);
