# Intent Prediction Library for SaaS/B2B — Research Report

**Date**: 2025-06-05
**Scope**: Framework-agnostic JS library for predicting user intent on SaaS/B2B sites
**Use case**: Internal use across agency client projects
**128 pages reviewed across 4 parallel research subagents**

---

## Table of Contents

1. [The Opportunity](#1-the-opportunity)
2. [What Data to Collect](#2-what-data-to-collect)
3. [Collection Architecture](#3-collection-architecture)
4. [Prediction Approaches (ROI-Tiered)](#4-prediction-approaches)
5. [Marketing & Sales Applications](#5-marketing--sales-applications)
6. [Competitive Landscape](#6-competitive-landscape)
7. [Market Gaps Your Library Can Fill](#7-market-gaps-your-library-can-fill)
8. [Recommended Architecture](#8-recommended-architecture)
9. [Sources](#9-sources)

---

## 1. The Opportunity

The core insight from this research: **up to 88% of B2B buyers never visit the pricing page** (Boomi/Lift AI case study). Page-based targeting misses the majority of real buying intent. A behavioral scoring approach that evaluates cumulative patterns across all pages dramatically outperforms page-specific routing rules.

Meanwhile, **77% of Boomi's traffic was anonymous** but generated **58% of their pipeline**. A JS library that scores anonymous visitors on buying intent (0-100) based on real-time behavioral signals fills a gap that no firmographic or third-party intent data can address.

### Proven ROI

| Company | Technique | Result |
|---------|-----------|--------|
| Boomi (100K+ monthly visitors) | Behavioral intent scoring + SDR routing | SDR conversion 3.66% → 8.72% (+138%), **15x ROI**, +21.74% monthly pipeline |
| Payscale | Anonymous visitor intent scoring | **9x increase** in Drift conversion rate; 54% of pipeline from anonymous visitors |
| Fluke Health | Intent-scored playbooks | **+246% revenue per conversation**, **+345% revenue per site visitor** |
| Campaign Monitor | Dynamic text matching search intent | 58% uplift in conversion rate |
| Health brand (Troopod) | 5-segment dynamic homepage | **+133% revenue, +132% conversion, -53% bounce** |
| TaxplanIQ | Behavioral segmentation + personalization | **102% MRR increase** |
| Newton Baby | AI-optimized cross-sell timing | **+125-188% revenue per user** |

---

## 2. What Data to Collect

### 2.1 Mouse/Pointer Signals (Strongest Intent Indicators)

| Signal | Intent Meaning | Collection Method |
|--------|---------------|-------------------|
| Cursor velocity (px/ms) | Attention proxy — 84% correlation with gaze direction | `mousemove` throttled to 100-200ms |
| Cursor deceleration | Approaching a target element — strong click predictor | Linear regression on velocity samples |
| Trajectory direction/angle | Heading toward CTA, nav, or exit | Vector math on last N positions |
| Pre-click dwell time | Hesitation before action (91ms discrimination) | Time between cursor arrival and mousedown |
| Approach distance | Total cursor travel before click | Cumulative distance calculation |
| Rage clicks | Rapid clicks on same element = friction | Detect 3+ clicks within 500ms on same element |
| Dead clicks | Clicks on non-interactive elements = confusion | Compare click target against clickable elements list |
| Exit trajectory | Mouse heading toward address bar/back button | Detect movement toward top of viewport |

### 2.2 Scroll Signals

| Signal | Intent Meaning | Collection Method |
|--------|---------------|-------------------|
| Scroll velocity | Fast = scanning, slow = reading; 92.4% accuracy for interest inference | `scroll` event throttled to 200ms |
| Scroll reversal | Re-reading = interest or confusion | Detect direction changes |
| Section dwell time | Time spent per content block = engagement per topic | `IntersectionObserver` per section |
| Scroll depth | How far user went (but not HOW they got there) | Track viewport position |

**Key insight**: Threshold-based scroll tracking (25%/50%/75%) tells you WHERE the user reached but not HOW they got there. Scroll velocity and dwell time per section are independent signals that predict interest with significantly higher accuracy.

### 2.3 Keyboard Signals (Privacy-Safe)

| Signal | Intent Meaning | Collection Method |
|--------|---------------|-------------------|
| Input hesitation | Time between focus and first keypress = confusion | Track focus-to-keydown delay |
| Input velocity | Keystrokes/second = confidence vs uncertainty | Measure keydown intervals |
| Tab navigation | Keyboard accessibility usage | Track focus order |
| Field dwell time | Time in each form field | Track focus/blur timing |

**Privacy rule**: NEVER capture form field values. Track THAT a field was interacted with, not WHAT was typed.

### 2.4 Session & Context Signals

| Signal | Intent Meaning |
|--------|---------------|
| Page sequence | Order of pages visited (pricing → features → pricing = high intent) |
| Return visits | Multiple sessions in one week = active evaluation |
| Time on page | Active vs idle time (use `visibilitychange`) |
| UTM parameters | Campaign attribution for intent source |
| Referrer | Traffic source (organic, paid, referral, direct) |
| Device/viewport | Desktop vs mobile (B2B buyers 70%+ desktop) |

### 2.5 Web Vitals (Performance as Intent Proxy)

| Signal | Why It Matters |
|--------|---------------|
| INP (Interaction to Next Paint) | High INP = frustration = lower conversion |
| CLS (Cumulative Layout Shift) | Visual instability = trust erosion |
| LCP (Largest Contentful Paint) | Slow load = higher bounce = lost intent |

---

## 3. Collection Architecture

### Size Budget (Critical for Adoption)

| Component | Target Size |
|-----------|------------|
| Core (event collection + buffering) | < 5 KB gzip |
| All tracker modules | < 10 KB gzip |
| ML inference module (optional) | < 50 KB gzip |

**Context**: GA4 alone is ~45 KB. Full GTM stack is 400-600 KB. Your library at 5-10 KB is 40-100x lighter.

### Performance Rules

1. **Throttle everything**: 100-200ms for mouse/scroll, never unthrottled
2. **Batch and defer**: 5-10 second flush interval, sendBeacon on page exit
3. **Use `fetchLater()`** (Chrome 130+) with polyfill for older browsers
4. **Never block main thread**: Consider Web Worker for heavy processing (Partytown pattern)
5. **Auto-pause on `visibilitychange`**: Stop collection when tab is hidden

### Transport Chain

```
1. fetchLater() with activateAfter  — Chrome 130+, auto-sends on page exit
2. sendBeacon()                     — Survives page unload, ~64KB limit
3. fetch() with keepalive: true     — Supports custom headers, ~64KB limit
4. fetch() (normal)                 — Standard fallback
5. IndexedDB                        — Offline persistence, retry on reconnect
```

### Offline / Retry Strategy

```
Collect → In-memory queue (max 100 events)
  → Try send every 5s or when queue hits 20 events
  → On failure: save to IndexedDB
  → On 'online' or next page load: retry from IndexedDB
  → Exponential backoff: 1s, 2s, 4s (max 3 retries)
```

### Privacy Model (No Consent Banner Needed)

| Practice | Implementation |
|----------|---------------|
| No persistent identifiers | Session-scoped random hashes, rotate every 24h |
| No IP storage | Hash then discard |
| No cross-session tracking | 24-hour rotating hashes |
| No fingerprinting for identification | Avoid canvas/WebGL fingerprinting |
| DNT respect | Check `navigator.doNotTrack` |
| Data minimization | Collect only behavioral signals, never form values |

**Result**: Cookieless, no consent banner required under GDPR, CCPA, PECR, or ePrivacy. This is a massive competitive advantage — cookie consent banners cause 40-50% of EU visitors to leave before being tracked.

---

## 4. Prediction Approaches (ROI-Tiered)

### Tier 1: Rule-Based Heuristics (Build First, 80% of Value)

**Effort**: Low | **Bundle cost**: 2-32 KB | **Latency**: <10ms

- Mouse trajectory prediction using velocity vectors (ForesightJS approach)
- Exit intent detection (cursor moving toward address bar)
- Hesitation detection (dwell time on CTAs, pricing elements)
- Scroll velocity patterns (reading vs scanning)
- Rage click detection

**Libraries to study**: ForesightJS (~32KB), ClickSense (2KB, zero deps), PassiveIntent (~11KB gzip)

### Tier 2: Statistical Models (Add Second, +15% Value)

**Effort**: Medium | **Bundle cost**: 5-15 KB | **Latency**: <20ms

- Markov chain transition probabilities between pages
- Z-score self-calibration against site-specific behavioral baselines
- Entropy scoring for navigation confusion
- Composite intent scoring from weighted signal fusion

**Example**: PassiveIntent uses Markov chains + entropy scoring + dwell-time analysis, all client-side, ~11KB gzip.

### Tier 3: Light Client-Side ML (Add If Justified, +5% Value)

**Effort**: High | **Bundle cost**: 50-200 KB | **Latency**: 10-50ms (WebGPU), 100-500ms (CPU)

- Pre-trained ONNX model for multi-signal fusion
- TensorFlow.js model for conversion probability
- Runs via WebGPU > WebGL > WASM > CPU fallback chain

**When to use**: Only for high-value predictions where multi-signal fusion beats heuristics (e.g., "will convert vs will bounce" in real-time to trigger intervention).

### Tier 4: Server-Side ML (Optional Add-On)

**Effort**: Very High | **Bundle cost**: 0 KB client | **Latency**: 350ms+

- Cross-session learning with full historical data
- CRM/billing/support ticket enrichment
- Churn risk, expansion propensity, lifecycle scoring

**Recommendation**: Provide a clean API for pushing signals to your own server, but never require it. Let users self-host the server component.

### ROI Recommendation

Start with Tier 1 + Tier 2. This covers ~95% of the value at < 15 KB bundle with zero ML infrastructure. Add Tier 3 only when you have enough data to prove it outperforms heuristics on your specific sites.

---

## 5. Marketing & Sales Applications

### 5.1 Lead Scoring

Transform from "email opened" counting to multi-layered qualification:

| Layer | Weight | Signals |
|-------|--------|---------|
| **Behavioral Engagement** | 50 pts | Pricing page visits (25pts), repeat sessions in 7 days (15pts), demo video watch (10pts) |
| **Firmographic Fit** | 30 pts | ICP match: industry, company size, tech stack |
| **External Intent** | 20 pts | Third-party topic surges (Bombora, etc.) |

**Score decay**: Reduce by 50% after 30 days inactivity, another 50% after 60 days. Leads 90+ route to sales within 24 hours. Below 60 = nurture.

### 5.2 Buying Signal Detection

B2B buyers complete **60-70% of their journey before filling out a demo form**. Your library makes the invisible research process visible:

| Signal | Funnel Stage | Action Window |
|--------|-------------|---------------|
| Pricing page visit (repeated) | Mid-bottom | 1 hour (4-7x higher response rate) |
| Feature comparison pages | Mid funnel | 24 hours |
| Integration documentation | Evaluation | 48 hours |
| Return visit within 7 days | Active evaluation | 24 hours |
| Case study / ROI calculator download | Consideration | 1 week |

**Critical insight**: First-party signals (your own website) should receive **2-3x the weight** of third-party signals. A pricing page visit should outscore a Bombora surge at the same recency.

### 5.3 Conversion Optimization

Proven techniques your library enables:

| Technique | How It Works | Proven Result |
|-----------|-------------|---------------|
| Dynamic CTAs | Match headline/CTA to visitor's search intent | +58-120% conversion |
| Exit intent offers | Trigger lower-commitment CTA on exit trajectory | 10.8% of abandoners convert |
| Anxiety reduction | Show "No credit card required" for hesitant users | +78% conversion |
| Progress indicators | Show form completion progress | +75% conversion |
| Adaptive content | Change hero/copy based on visitor segment | +72-138% conversion |

### 5.4 Integration Architecture

```
Your JS Library (captures + scores behavioral signals)
    |
    +---> CDP (Segment, RudderStack) via track() calls
    +---> CRM (HubSpot, Salesforce) via webhooks
    +---> Marketing Automation (Marketo, Customer.io) via events
    +---> Personalization Engine (Mutiny, Dynamic Yield) via real-time API
    +---> Sales Engagement (Salesloft, Outreach) via prioritized queues
    +---> Ad Platforms (LinkedIn, Google) via matched audiences
    +---> Slack/Notifications via real-time webhooks for high-intent alerts
```

### 5.5 Anonymous Visitor Scoring (Highest-Value Use Case)

Boomi's reference architecture:
- Score every visitor 0-100 on buying intent from real-time behavior
- High-intent (>70) → route to live SDR via Drift/chat
- Medium intent (40-70) → personalized nurture content
- Low intent (<40) → chatbot deflection
- Result: **58% of pipeline from anonymous visitors**, **15x ROI**

---

## 6. Competitive Landscape

### Direct Competitors (Intent Prediction)

| Tool | What It Does | Size | Gap |
|------|-------------|------|-----|
| **PassiveIntent** | Privacy-first behavioral intent SDK (Markov + entropy + dwell) | ~11KB gzip | AGPL license, single-session only, no SaaS-specific models |
| **Convoy** | Behavioral intelligence + contextual nudges | Single script tag | E-commerce focused, early-stage waitlist |
| **ForesightJS** | Mouse trajectory prediction, keyboard nav, scroll | ~32KB | Prediction only, no intent scoring, no analytics |
| **ClickSense** | Click confidence from motor behavior | 2KB | Research tool, no scoring pipeline |

### Analytics Platforms (Adjacent)

| Tool | Pricing | What Your Library Does Better |
|------|---------|-------------------------------|
| **FullStory** | $1,500-2,500/mo+ | Your library: 100x cheaper, 40x lighter, embeddable |
| **Hotjar** | From 39 EUR/mo | Your library: predicts intent, not just records it |
| **Microsoft Clarity** | Free | Your library: provides intent scores as API, not just replays |
| **Mixpanel** | Free tier → enterprise | Your library: client-side prediction, no data egress |
| **Amplitude** | Enterprise | Your library: framework-agnostic, embeddable, privacy-first |
| **PostHog** | Open source | Your library: purpose-built for intent, not general analytics |

### Open Source Ecosystem

| Project | Status | What It Offers |
|---------|--------|---------------|
| **Behavise** | Early (Apr 2026) | Modular trackers (pointer, dwell, scroll, click, visibility), zero deps |
| **Microsoft Clarity** | Mature (2M+ sites) | Session replay + heatmaps, TypeScript, but no intent scoring |
| **PostHog** | Mature | Full analytics suite, but no predictive intent |
| **Plausible** | Mature | Privacy-first analytics, but page-view focused only |
| **Deloitte Beacon** | Early | Privacy-first collection framework, no prediction |

---

## 7. Market Gaps Your Library Can Fill

### Gap 1: No Framework-Agnostic "Intent as API" Library
Every tool is either a full platform (FullStory, Hotjar) or a CMS-coupled SDK (Contentful, Contentstack). Nothing provides a clean API that says "here's what the user is likely trying to do" and lets your own code/CRM/CDP respond.

### Gap 2: SaaS/B2B Buyer Journey Models Don't Exist
All intent tools target e-commerce checkout flows. None model SaaS-specific patterns: pricing page confusion, integration evaluation, trial engagement decay, onboarding friction, admin-settings exploration, multi-stakeholder buying committees.

### Gap 3: Client-Side Prediction with Zero Data Egress
Nearly every solution sends data to their cloud. No mature solution does all intent computation client-side with optional self-hosted server sync.

### Gap 4: Detection-to-Action Pipeline Is Vendor-Locked
Tools either detect behavior (Clarity, Hotjar) or deliver experiences (Dynamic Yield, Contentful). Nothing bridges the two with a clean API layer.

### Gap 5: Pricing/Billing Flow Intent Is Underserved
No tool provides specialized models for SaaS billing-page drop-off, plan-comparison confusion, or trial-to-paid conversion friction — the highest-value moments in B2B SaaS.

### Gap 6: Cross-Session Intent Continuity
Most tools treat sessions independently. For SaaS buying cycles spanning weeks, no tool builds intent models across sessions without requiring login-based tracking.

---

## 8. Recommended Architecture

### Phase 1: Core (Week 1-2)

```
intent-sdk/
├── core/                    # < 5KB gzip
│   ├── collector.ts         # Event collection with throttling
│   ├── buffer.ts            # In-memory queue + flush logic
│   ├── transport.ts         # fetchLater → sendBeacon → fetch chain
│   ├── privacy.ts           # DNT check, session hashing, PII sanitization
│   └── types.ts             # All event payload types
├── trackers/                # Modular, tree-shakeable
│   ├── pointer.ts           # Mouse/touch tracking
│   ├── scroll.ts            # Scroll velocity + section dwell
│   ├── click.ts             # Click confidence + rage/dead detection
│   ├── visibility.ts        # IntersectionObserver per section
│   ├── form.ts              # Field hesitation (no values captured)
│   └── navigation.ts        # SPA route change detection
```

### Phase 2: Intent Engine (Week 3-4)

```
├── engine/
│   ├── scorer.ts            # Composite intent scoring (0-100)
│   ├── signals/             # Individual signal detectors
│   │   ├── exit-intent.ts
│   │   ├── hesitation.ts
│   │   ├── engagement.ts
│   │   ├── pricing-interest.ts
│   │   └── confusion.ts
│   ├── calibrator.ts        # Z-score self-calibration against baseline
│   └── emitter.ts           # Event emitter: onIntentChange, onSignalDetected
```

### Phase 3: Integrations (Week 5+)

```
├── integrations/
│   ├── segment.ts           # Segment track() calls
│   ├── webhook.ts           # Generic webhook push
│   ├── hubspot.ts           # HubSpot custom behavioral events
│   └── slack.ts             # Real-time high-intent alerts
├── adapters/                # Framework wrappers
│   ├── react.ts             # useIntent(), IntentProvider
│   ├── vue.ts               # composable
│   └── vanilla.ts           # Direct script tag usage
```

### API Design Sketch

```typescript
import { IntentSDK } from '@yourorg/intent-sdk'

const sdk = new IntentSDK({
  // Privacy
  privacy: 'strict',           // cookieless, no PII, 24h rotating hashes
  respectDNT: true,

  // Collection
  trackers: ['pointer', 'scroll', 'click', 'visibility', 'navigation'],
  sampleRate: 1.0,             // 100% for all users (lightweight enough)

  // Scoring
  scoring: {
    model: 'statistical',      // 'heuristic' | 'statistical' | 'ml'
    calibrate: true,           // self-calibrate to site baseline
  },

  // Transport
  endpoint: '/api/intent',     // your own server
  flushInterval: 5000,         // 5 seconds
  batchSize: 20,
})

// Subscribe to intent changes
sdk.on('intent:change', (score) => {
  console.log(`Visitor intent: ${score}/100`)
})

sdk.on('signal:exit-intent', () => {
  showExitOffer()
})

sdk.on('signal:pricing-hesitation', (data) => {
  showPricingHelp(data.element)
})

sdk.on('signal:high-intent', (data) => {
  // Push to CRM or trigger SDR notification
  fetch('/api/webhook', {
    method: 'POST',
    body: JSON.stringify({ visitor: data.sessionId, score: data.score, signals: data.signals })
  })
})

// Get current state anytime
const state = sdk.getState()
// { score: 72, signals: ['pricing-visit', 'repeat-session', 'feature-comparison'], lastSignal: 'pricing-visit' }
```

---

## 9. Sources

### Intent Prediction & Techniques
- [ForesightJS](https://foresightjs.com/) — Mouse trajectory prediction library
- [ClickSense](https://github.com/andyed/clicksense) — Click confidence from motor behavior
- [PassiveIntent](https://passiveintent.dev/) — Privacy-first behavioral intent SDK
- [TensorFlow.js Predictive Prefetching](https://tensorflow.google.cn/js/tutorials/applications/predictive_prefetching)
- [ONNX Runtime Web](https://onnxruntime.ai/docs/tutorials/web/)
- [web.dev — Client-Side AI](https://web.dev/learn/ai/client-side)

### Data Collection & Architecture
- [Behavise — Modular TypeScript behavior tracking](https://github.com/anovise/behavise)
- [Google Chrome — Batch Analytics Events Guide](https://github.com/GoogleChrome/modern-web-guidance-src/blob/main/guides/performance/batch-analytics-events/guide.md)
- [Mixpanel JS SDK Architecture](https://deepwiki.com/mixpanel/mixpanel-js/4-architecture-and-implementation)
- [PostHog JS SDK](https://github.com/PostHog/posthog-js)
- [Plausible — Cookieless Web Analytics](https://plausible.io/cookieless-web-analytics)
- [identity-js — Visitor Intelligence](https://www.identity-js.com/)
- [CoreWebVitals — Analytics Script Impact](https://www.corewebvitals.io/pagespeed/the-case-for-limiting-analytics-and-tracking-scripts)

### Marketing & Sales Applications
- [Lift AI — Boomi Case Study](https://www.lift-ai.com/case-studies/boomi) (15x ROI, behavioral SDR routing)
- [House of MarTech — Lead Qualification Models](https://houseofmartech.com/blog/lead-qualification-scoring-models-combining-behavioral-firmographic-and-intent-data-for-b2b-prioritization)
- [Explorium — B2B Buying Signals](https://www.explorium.ai/blog/data-for-gtm/b2b-buying-signals/)
- [ConversionLab — Campaign Monitor Case Study](https://blog.conversionlab.no/campaign-monitor-case-study/)
- [Troopod — Homepage Personalization](https://blog.troopod.io/homepage-personalization-converting-52-000-visitors-into-individual-experiences/)
- [Optiblack — Real-Time SaaS Personalization](https://optiblack.com/insights/real-time-personalization-in-saas-how-it-works)
- [Segment — HubSpot Integration](https://segment.com/docs/connections/destinations/catalog/actions-hubspot-cloud)

### Competitive Landscape
- [Convoy](https://convoy.sale/) — Behavioral intelligence for modern web
- [Sentioflow](https://sentioflow.com/) — AI-powered intent detection
- [Made With Intent](https://www.madewithintent.ai/) — Intent-based experience optimization
- [Cognera](https://cogneradatalabs.com/) — Privacy-first behavioral intelligence
- [Pathmonk](https://pathmonk.com/) — Unified growth engine
- [Microsoft Clarity GitHub](https://github.com/microsoft/clarity)
- [Deloitte Beacon](https://github.com/Deloitte/beacon)
