# Intent Layer — Setup Guide

Complete guide to storing, viewing, and using the behavioral data your site collects.

---

## Step 1: Create a Supabase Database (10 minutes)

[Supabase](https://supabase.com) is a free hosted PostgreSQL database with a REST API. It's the fastest way to get started.

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Click **New Project** — give it a name like `intent-layer-data`
3. Set a database password (save it)
4. Select the region closest to your users
5. Wait ~2 minutes for the project to provision

### Create the tables

1. In your Supabase dashboard, go to **SQL Editor**
2. Paste the entire contents of `setup/supabase-schema.sql`
3. Click **Run**

This creates:
- `intent_events` — the main table storing every event
- `intent_sessions` — a view summarizing each visitor session
- `intent_section_engagement` — a view showing how long users spend in each section
- `intent_cta_interaction` — a view summarizing clicks on each CTA

### Get your API keys

1. Go to **Settings → API**
2. Copy the **Project URL** (looks like `https://abcdefgh.supabase.co`)
3. Copy the **anon public** key (safe to use in browser scripts)
4. Copy the **service_role** key (secret — only for your viewer dashboard)

---

## Step 2: Deploy the Cloudflare Worker (5 minutes)

The worker receives events from the browser and writes them to Supabase.

1. Go to [workers.cloudflare.com](https://workers.cloudflare.com)
2. Click **Create Worker**
3. Name it `intent-receiver`
4. Paste the contents of `setup/cloudflare-worker.js` into the editor
5. Click **Deploy**
6. Go to **Settings → Variables**
7. Add two environment variables:
   - `SUPABASE_URL` = your Supabase project URL
   - `SUPABASE_KEY` = your Supabase **anon** key
8. Click **Save and Deploy**

Your endpoint is now live at: `https://intent-receiver.your-subdomain.workers.dev`

---

## Step 3: Connect Your Site

Add the script and point it at your worker:

```html
<script defer src="https://cdn.jsdelivr.net/gh/szsoma/intent-layer@v0.1.0/dist/intent-layer.iife.js"></script>
<script>
  new IntentLayer({
    endpoint: 'https://intent-receiver.your-subdomain.workers.dev',
    dev: false,
  })
</script>
```

Mark your page sections with `data-intent` attributes (see the main README for details).

Open your site in a browser. Move your mouse, scroll, click around. Then check Supabase — events should appear in the `intent_events` table within seconds.

---

## Step 4: View Your Data

Open `setup/viewer.html` in your browser. It's a standalone HTML file — no server needed.

1. Enter your Supabase **Project URL**
2. Enter your **service_role** key (not the anon key — the viewer needs read access)
3. Click **Connect & Load**

You'll see:

- **Stats bar** — total sessions, today's sessions, total events, rage clicks
- **Sessions tab** — every visitor session, what pages they visited, how many clicks
- **Section Engagement tab** — bar chart showing how long users spend in each section
- **CTA Interaction tab** — which buttons get clicked, click confidence (hold duration), rage clicks
- **Raw Events tab** — the last 200 events for debugging

---

## Step 5: Analyze Your Data

After 7 days of data collection, run these queries in the Supabase **SQL Editor**.

### How many sessions and events have we collected?

```sql
select
  count(distinct session_id) as sessions,
  count(*) as events,
  min(received_at) as first_event,
  max(received_at) as last_event
from intent_events;
```

### Which sections hold attention the longest?

```sql
select
  data->>'section' as section,
  count(distinct session_id) as unique_visitors,
  round(avg((data->>'visibleMs')::int) / 1000.0, 1) as avg_dwell_seconds,
  round(max((data->>'visibleMs')::int) / 1000.0, 1) as max_dwell_seconds
from intent_events
where event_type = 'visibility'
  and data->>'section' != ''
group by data->>'section'
order by unique_visitors desc;
```

### Where are users getting frustrated?

```sql
select
  url,
  data->>'targetElement' as element,
  count(*) as rage_clicks,
  count(distinct session_id) as frustrated_sessions
from intent_events
where event_type = 'click'
  and (data->>'rage')::boolean = true
group by url, data->>'targetElement'
order by rage_clicks desc;
```

### Which pricing plan gets the most attention?

```sql
select
  data->>'targetElement' as plan,
  count(*) as interactions,
  count(distinct session_id) as unique_visitors,
  round(avg((data->>'holdMs')::int)) as avg_hold_ms
from intent_events
where event_type = 'click'
  and data->>'targetElement' like 'plan-%'
group by data->>'targetElement'
order by interactions desc;
```

### What's the average scroll depth per page?

```sql
select
  url,
  round(avg((data->>'scrollDepth')::int)) as avg_scroll_depth,
  round(max((data->>'scrollDepth')::int)) as max_scroll_depth,
  count(distinct session_id) as sessions
from intent_events
where event_type = 'scroll'
group by url
order by sessions desc;
```

### How fast are users scrolling? (Reading vs scanning)

```sql
select
  data->>'section' as section,
  round(avg(abs((data->>'velocity')::numeric)), 2) as avg_velocity,
  case
    when avg(abs((data->>'velocity')::numeric)) < 0.5 then 'Reading'
    when avg(abs((data->>'velocity')::numeric)) < 1.5 then 'Scanning'
    else 'Skimming'
  end as behavior
from intent_events
where event_type = 'scroll' and data->>'section' != ''
group by data->>'section'
order by avg_velocity;
```

### User journey — which pages do visitors go through?

```sql
select
  session_id,
  array_agg(distinct url order by min(received_at)) as journey,
  count(*) as events
from intent_events
group by session_id
order by events desc
limit 20;
```

---

## What You Can Do With This Data

### Immediate Wins (Week 1-2)

**1. Find and fix friction points**
- High rage-click count on an element? Something's broken or unclear — fix it
- Dead clicks on a non-interactive element? Users think it's a button — make it one
- Users scrolling fast past a section? Content isn't compelling — rewrite or remove it

**2. Validate your page hierarchy**
- If users spend 80% of their time in the features section but your CTA is at the bottom, move the CTA up
- If pricing page dwell time is very short, your plans might be confusing — simplify

**3. See which CTAs actually work**
- High click count + low hold duration (confident click) = effective CTA
- Low click count on a CTA surrounded by long dwell time = interested users who aren't convinced — add social proof nearby

### Medium-Term (Month 1-2)

**4. Score visitor intent**
After collecting enough data, you can start categorizing visitors:

```sql
-- High-intent sessions: visited pricing + clicked a CTA + returned more than once
select session_id
from intent_events
group by session_id
having
  count(*) filter (where url like '%pricing%') > 0
  and count(*) filter (where event_type = 'click' and data->>'targetElement' like 'cta-%') > 0
  and count(distinct date(received_at)) > 1;
```

**5. A/B test page layouts**
- Deploy version A for a week, collect data
- Deploy version B for a week, compare:
  - Scroll depth on key sections
  - CTA click rates
  - Rage click count
  - Section dwell time

**6. Identify your best-converting journey**
- Look at the journey of users who clicked a primary CTA
- What path did they take? Hero → features → pricing → CTA?
- Optimize the flow for other users to follow the same path

### Long-Term (Month 3+)

**7. Feed data into your CRM**
- When a known user (identified via form submission) has high behavioral intent, score them higher in HubSpot/Salesforce
- Use the Supabase webhook or Cloudflare Worker to push events to Segment/RudderStack

**8. Build agency benchmarks**
- After deploying across 5+ client sites, compare cross-site baselines:
  - "Your pricing page hesitator rate is 23% — average for SaaS sites your size is 15%"
  - "Your scroll depth is 2x higher than similar sites — your content is working"

**9. Feed into Layer 2 (Intent Scoring)**
- After validating that behavioral signals predict conversion, build the scoring engine
- Assign each session a 0-100 intent score
- Trigger actions: high-intent → SDR notification, low-intent → email nurture

---

## Architecture Overview

```
┌──────────────┐     POST /events     ┌──────────────────┐     INSERT     ┌───────────┐
│  Website     │ ──────────────────▶  │  Cloudflare      │ ─────────────▶ │ Supabase  │
│  (visitor    │  (batched every 5s)  │  Worker           │  (rows)        │ PostgreSQL│
│   browser)   │                      │  (receives +      │                │ (storage) │
│              │                      │   forwards)       │                │           │
│  intent-     │                      └──────────────────┘                │           │
│  layer.js    │                                                          │           │
│  (3.6KB)     │                                                          │           │
└──────────────┘                                                          └─────┬─────┘
                                                                                │
                                          ┌─────────────────────────────────────┘
                                          │
                                          ▼
                                  ┌──────────────┐
                                  │  viewer.html  │  (your browser — local file)
                                  │  Stats,       │
                                  │  sessions,    │
                                  │  sections,    │
                                  │  CTAs, events │
                                  └──────────────┘
```

**Cost**: Supabase free tier supports 500MB and 50K monthly rows. Cloudflare Workers free tier supports 100K daily requests. Both are free for most sites.

---

## Troubleshooting

### No events appearing in Supabase

1. Open browser DevTools → Network tab
2. Look for POST requests to your Cloudflare Worker URL
3. If no requests: check the script loaded (`new IntentLayer` should be defined)
4. If requests return errors: check Worker env vars (SUPABASE_URL, SUPABASE_KEY)
5. If requests return 200 but no data: check Supabase RLS policies (re-run the schema)

### Events are delayed

The SDK batches events and sends every 5 seconds. If the user closes the tab quickly, events are sent via `sendBeacon` on `visibilitychange`. Some events may arrive up to 5 seconds after they happen — this is normal.

### viewer.html shows "Connection failed"

- Make sure you're using the **service_role** key, not the anon key
- Make sure the Supabase URL is correct (including `https://`)
- Check that your IP isn't blocked by Supabase (rare)
