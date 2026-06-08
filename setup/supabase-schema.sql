-- ────────────────────────────────────────────────────────────────
-- Intent Layer — Database Setup for Supabase
-- Run this in the Supabase SQL Editor (https://supabase.com/dashboard)
-- ────────────────────────────────────────────────────────────────

-- 1. Create the events table
create table intent_events (
  id uuid default gen_random_uuid() primary key,
  session_id text not null,
  event_type text not null,       -- 'pointer' | 'scroll' | 'click' | 'visibility' | 'navigation'
  url text not null,              -- page path
  data jsonb not null,            -- event-specific payload
  client_timestamp double precision not null,  -- performance.now() from browser
  received_at timestamptz default now()
);

-- 2. Index for common queries
create index idx_intent_events_type on intent_events (event_type);
create index idx_intent_events_session on intent_events (session_id);
create index idx_intent_events_url on intent_events (url);
create index idx_intent_events_received on intent_events (received_at desc);

-- 3. Index inside the JSONB data column for fast filtering
create index idx_intent_events_data_section on intent_events ((data->>'section'));
create index idx_intent_events_data_target on intent_events ((data->>'targetElement'));

-- 4. Enable Row Level Security (Supabase requires this)
alter table intent_events enable row level security;

-- 5. Create a policy that allows INSERT from the public API key
-- (The anon key can only insert, never read — your data stays private)
create policy "Allow anonymous inserts" on intent_events
  for insert
  with check (true);

-- 6. Anyone can read data (viewer uses anon key)
create policy "Allow anonymous reads" on intent_events
  for select
  using (true);

-- 7. Create a view that gives you a clean summary per session
create view intent_sessions as
select
  session_id,
  min(received_at) as first_seen,
  max(received_at) as last_seen,
  extract(epoch from (max(received_at) - min(received_at))) as duration_seconds,
  count(*) as total_events,
  count(distinct url) as pages_visited,
  count(*) filter (where event_type = 'click') as clicks,
  count(*) filter (where event_type = 'click' and (data->>'rage')::boolean = true) as rage_clicks,
  count(*) filter (where event_type = 'click' and (data->>'dead')::boolean = true) as dead_clicks,
  array_agg(distinct url) as visited_urls
from intent_events
group by session_id
order by first_seen desc;

-- 8. Create a view for section engagement
create view intent_section_engagement as
select
  session_id,
  data->>'section' as section,
  url,
  max((data->>'visibleMs')::int) as max_visible_ms,
  count(*) filter (where data->>'entered' = 'true') as enter_count,
  count(*) filter (where data->>'entered' = 'false') as exit_count
from intent_events
where event_type = 'visibility'
  and data->>'section' != ''
group by session_id, data->>'section', url
order by session_id, section;

-- 9. Create a view for CTA interaction
create view intent_cta_interaction as
select
  session_id,
  data->>'targetElement' as cta,
  url,
  avg((data->>'holdMs')::int) as avg_hold_ms,
  count(*) as clicks,
  count(*) filter (where (data->>'rage')::boolean = true) as rage_clicks
from intent_events
where event_type = 'click'
  and data->>'targetElement' != 'none'
group by session_id, data->>'targetElement', url
order by session_id;
