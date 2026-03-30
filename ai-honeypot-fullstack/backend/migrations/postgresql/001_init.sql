create table if not exists users (
    id bigserial primary key,
    username text unique not null,
    email text unique,
    password_hash text not null,
    role text not null default 'admin',
    created_at timestamptz not null
);

create table if not exists sites (
    id bigserial primary key,
    user_id bigint not null,
    name text not null,
    domain text not null,
    api_key text not null,
    created_at timestamptz not null,
    updated_at timestamptz not null
);

create table if not exists events (
    id bigserial primary key,
    site_id bigint,
    session_id text,
    event_type text not null,
    severity text not null,
    score double precision not null,
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
    policy_risk_score double precision default 0,
    captured_data text,
    created_at timestamptz not null
);

create table if not exists blocked_ips (
    id bigserial primary key,
    ip text unique not null,
    reason text,
    created_at timestamptz not null
);

create table if not exists leads (
    id bigserial primary key,
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
    notification_sent_at timestamptz,
    notification_error text,
    notification_channel_status text,
    first_response_at timestamptz,
    created_at timestamptz not null,
    updated_at timestamptz not null
);

create table if not exists lead_notes (
    id bigserial primary key,
    lead_id bigint not null,
    author_username text not null,
    note_text text not null,
    created_at timestamptz not null
);

create table if not exists lead_status_history (
    id bigserial primary key,
    lead_id bigint not null,
    old_status text,
    new_status text not null,
    changed_by_username text not null,
    changed_at timestamptz not null
);

create table if not exists analytics_events (
    id bigserial primary key,
    name text not null,
    page_path text,
    payload text,
    created_at timestamptz not null
);

create table if not exists runtime_settings (
    key text primary key,
    value text not null,
    updated_at timestamptz not null
);

create table if not exists canary_tokens (
    id bigserial primary key,
    token text unique not null,
    label text not null,
    token_type text not null default 'URL',
    relative_path text not null,
    triggered integer not null default 0,
    triggered_at timestamptz,
    triggered_ip text,
    created_at timestamptz not null,
    updated_at timestamptz not null
);
