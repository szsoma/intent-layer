# Intent Layer — Risk Mitigation & Validation Sprint

**Date**: 2026-06-05
**Purpose**: Neutralize the two highest-risk threats before committing to the full build
**Duration**: 4 weeks
**Outcome**: Go/no-go decision with real data

---

## The Two Risks

### Risk 5: "Science Project" Trap
Building for months without shipping. Billable work takes priority. Project dies at 80%.

### Risk 6: Data Doesn't Support Claims
Behavioral signals don't predict conversion any better than "did they visit the pricing page?" Everything built on top is worthless.

**Both risks share one solution**: Ship the thinnest useful data-collection layer on a real client site as fast as possible, then evaluate honestly.

---

## Week 1: Build the Sensor (Layer 1 Only)

**Goal**: A working script that collects behavioral signals on a real website.

### What to build

```
intent-sdk/
├── src/
│   ├── core/
│   │   ├── sdk.ts              # Entry point, initializes all trackers
│   │   ├── event-bus.ts        # Internal event emitter
│   │   └── types.ts            # All type definitions
│   ├── trackers/
│   │   ├── pointer.ts          # Mouse movement (throttled 150ms)
│   │   ├── scroll.ts           # Scroll velocity + section dwell
│   │   ├── click.ts            # Click confidence + rage/dead clicks
│   │   ├── visibility.ts       # IntersectionObserver per [data-intent] element
│   │   └── navigation.ts       # Route changes, page sequence
│   ├── transport/
│   │   ├── buffer.ts           # In-memory queue (max 50 events)
│   │   ├── beacon.ts           # sendBeacon + fetch keepalive fallback
│   │   └── logger.ts           # Console logger (dev mode)
│   └── privacy/
│       ├── session.ts          # Session-scoped hash, 24h rotation
│       └── consent.ts          # DNT check, optional CMP integration
├── package.json
├── tsconfig.json
└── vite.config.ts              # Build to ESM + IIFE (script tag)
```

### Build constraints
- **Zero dependencies** in the core
- **< 5KB gzip** total
- **No scoring, no prediction, no IAL** — just raw signal collection + transport
- Output: ESM module + standalone IIFE bundle (for `<script>` tag embedding)

### What gets collected per event
```typescript
interface BehavioralEvent {
  sessionId: string        // rotating 24h hash
  timestamp: number        // performance.now()
  type: string             // 'pointer' | 'scroll' | 'click' | 'visibility' | 'navigation'
  url: string              // current page path
  data: Record<string, number | string | boolean>  // signal-specific payload
}
```

### Deliverable by Friday Week 1
A script tag you can drop into any site that starts collecting and buffering behavioral events. Events log to console in dev mode, POST to an endpoint in prod.

---

## Week 2: Ship on a Real Client Site

**Goal**: Real data flowing from real visitors on a real website.

### Site selection criteria
Pick the client site with:
- **Highest traffic** (more data, faster validation)
- **A pricing page** (the most valuable page for intent signals)
- **A conversion event** (form submit, trial signup, demo request — something to correlate against)

### Deployment checklist
1. Add `<script src="intent-layer.js">` to the site's `<head>` with `defer`
2. Add `data-intent` attributes to key elements:
   ```html
   <section data-intent="hero">...</section>
   <section data-intent="features">...</section>
   <div data-intent="pricing">...</div>
   <button data-intent="cta-primary">Get Started</button>
   <form data-intent="demo-form">...</form>
   ```
3. Point transport to a simple endpoint (even a Google Sheet via webhook, or a Supabase table)
4. Add a `visibilitychange` flush so no data is lost on page exit

### What you need collecting by end of Week 2
| Signal | Example event |
|--------|--------------|
| Mouse velocity near CTAs | `{ type: 'pointer', data: { velocity: 340, targetDistance: 22 } }` |
| Scroll velocity per section | `{ type: 'scroll', data: { section: 'pricing', velocity: 120, dwell: 4500 } }` |
| Click with confidence | `{ type: 'click', data: { target: 'cta-primary', holdMs: 89, approachDecel: true } }` |
| Section visibility duration | `{ type: 'visibility', data: { section: 'features', visibleMs: 3200 } }` |
| Rage clicks | `{ type: 'click', data: { target: 'nav-link', rage: true, count: 4 } }` |

### Parallel: Build a minimal data viewer
A single HTML page that reads from your endpoint and shows:
- Event count by type (last 7 days)
- Raw event stream (latest 100 events)
- This is NOT the client dashboard — this is YOUR debugging tool

**Week 2 checkpoint**: Real behavioral events flowing from real visitors into a storage layer. If this doesn't work, nothing else matters.

---

## Week 3: Collect Data, Run the Validation Test

**Goal**: Answer the question: "Do behavioral signals predict conversion better than page views?"

### Data collection period
Let the sensor run for **7 full days** on the client site. Don't touch it. Let real visitors generate real behavioral data.

### The Validation Query

After 7 days, run this analysis against your collected data:

**Question 1: Separation**
For visitors who converted vs visitors who didn't:
- What was the average scroll dwell time on the pricing section? (converted vs not)
- What was the average mouse velocity near the CTA? (converted vs not)
- What was the click hold duration on the CTA? (converted vs not)
- How many had rage clicks? (converted vs not)
- How many showed exit-intent before converting? (converted vs not)

If the behavioral signals show **clear separation** between converters and non-converters, the data supports the claims.

**Question 2: Lift over page views**
Build two simple predictive models:
- **Model A (baseline)**: "Did the user visit the pricing page?" (yes/no → predict conversion)
- **Model B (behavioral)**: Composite of top 3 behavioral signals → predict conversion

Compare: Does Model B predict conversion significantly better than Model A?

**Question 3: Signal richness**
On pages with no clear conversion event (blog posts, about pages, landing pages), do behavioral signals reveal anything useful that page views don't? (engagement quality, confusion, content interest)

### Go/No-Go Criteria

| Result | Decision |
|--------|----------|
| Behavioral signals show clear separation (converters vs non-converters differ by 2x+ on key metrics) | **GO** — Build Layer 2 (Brain) and Layer 3 (Action) |
| Marginal separation (some signals differ, but weak) | **CONDITIONAL GO** — Simplify. Drop weak signals. Build scoring on the 2-3 signals that work. Skip IAL until proven. |
| No meaningful separation (behavioral signals don't predict any better than page views) | **NO GO** — Kill the intent scoring. Pivot to using the sensor as a lightweight analytics alternative (heatmaps, scroll maps) without prediction. Still useful, but different product. |

### If NO GO: The Pivot Option
The sensor layer itself is still valuable. A 5KB script that gives your clients:
- Click heatmaps (where people clicked)
- Scroll depth maps (how far they scrolled)
- Rage click detection (where they got frustrated)
- Section engagement (what they actually read)

...is still a competitive advantage over shipping GA4 on every site. You just don't build the prediction/adaptive layers. The "Agency Intelligence Network" (cross-site baselines for basic metrics) still works and still creates lock-in.

---

## Week 4: Decide and Commit

### If GO: Plan the full build
- Week 5-6: Layer 2 (Brain) — composite scoring, pattern detectors, self-calibration
- Week 7-8: Layer 3 (Action) — IAL engine, dashboard API, client dashboard
- Week 9-10: Polish, second client deployment, dashboard v1

### If CONDITIONAL GO: Build narrow
- Week 5-6: Scoring engine using only the 2-3 validated signals
- Week 7-8: Simple dashboard showing those specific signals
- Skip IAL until you have more data
- Deploy on 2-3 more sites to strengthen the dataset

### If NO GO: Pivot to lightweight analytics
- Week 5-6: Build heatmap visualization + rage click detection
- Week 7-8: Client dashboard with weekly email reports
- Market as "privacy-first analytics baked into every site we build"
- Still differentiated from GA4 (lighter, privacy-first, agency-branded)

---

## Why This Plan Solves Both Risks

**Risk 5 (Science Project)**: You're not building for 4 months. You're building a sensor in 1 week, deploying in week 2, and evaluating in week 3. Maximum time invested before you know if it works: 3 weeks. If it doesn't work, you lost 3 weeks — not 4 months.

**Risk 6 (Data Doesn't Support Claims)**: Week 3's validation query is the explicit test. You're not guessing. You're comparing behavioral signals against simple page-view tracking on real data from real visitors. The data tells you whether to proceed, simplify, or pivot.

---

## Anti-Patterns to Avoid During This Sprint

1. **Don't build Layer 2 (Brain) in weeks 1-3**. Scoring without validated signals is wasted work.
2. **Don't build the dashboard yet**. A Google Sheet or Supabase table is enough for validation.
3. **Don't wait for "enough data"**. 500+ sessions with 10+ conversions is sufficient for the validation query. If the client site doesn't hit that in 7 days, pick a higher-traffic site.
4. **Don't skip the NO GO decision**. The hardest part of this plan is killing the project if the data says to. Commit to the decision now, before you're emotionally invested.
5. **Don't let billable work push this to "next week"**. Block 10-15 hours per week for this sprint. Treat it as a client project with a deadline.
