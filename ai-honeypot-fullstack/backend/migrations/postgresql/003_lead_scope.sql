alter table leads add column if not exists user_id bigint;
alter table leads add column if not exists site_id bigint;

create index if not exists idx_leads_user_id on leads(user_id);
create index if not exists idx_leads_site_id on leads(site_id);
create index if not exists idx_lead_notes_lead_id on lead_notes(lead_id);
create index if not exists idx_lead_status_history_lead_id on lead_status_history(lead_id);

update leads
set user_id = (select id from users order by id asc limit 1)
where user_id is null
  and (select count(*) from users) = 1;

update leads
set site_id = (select id from sites order by id asc limit 1),
    user_id = coalesce(user_id, (select user_id from sites order by id asc limit 1))
where site_id is null
  and (select count(*) from sites) = 1;
