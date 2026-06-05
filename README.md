# Intent Layer

A 3.6KB framework-agnostic JavaScript library that captures behavioral signals from website visitors — mouse movement, scroll patterns, clicks, section visibility, and navigation — and sends them to your endpoint for analysis.

Cookieless. Privacy-first. No consent banner needed.

---

## Quick Start

### 1. Add the script

```html
<script defer src="https://cdn.jsdelivr.net/gh/szsoma/intent-layer@v0.1.0/dist/intent-layer.iife.js"></script>
```

Or via npm:

```bash
npm install intent-layer
```

```typescript
import { IntentLayer } from 'intent-layer'
```

### 2. Mark your page sections

Add `data-intent` attributes to the key elements on your page:

```html
<section data-intent="hero">
  <h1>Welcome to Our Product</h1>
  <p>The best solution for your team</p>
</section>

<section data-intent="features">
  <h2>Features</h2>
  <!-- ... -->
</section>

<div data-intent="pricing">
  <div data-intent="plan-starter">Starter — $29/mo</div>
  <div data-intent="plan-pro">Pro — $99/mo</div>
  <div data-intent="plan-enterprise">Enterprise — Custom</div>
</div>

<button data-intent="cta-primary">Get Started</button>
<button data-intent="cta-demo">Book a Demo</button>

<form data-intent="demo-form">
  <!-- form fields -->
</form>

<footer data-intent="footer">
  <!-- footer links -->
</footer>
```

### 3. Initialize the SDK

```html
<script>
  const sdk = new IntentLayer({
    endpoint: 'https://your-server.com/api/intent',
    dev: true,   // enables console logging — remove in production
  })
</script>
```

That's it. The library starts collecting behavioral data immediately.

---

## What Gets Collected

Once active, Intent Layer captures five types of events:

### Pointer Events (`type: 'pointer'`)

Emitted when the user moves their mouse (throttled to every 150ms).

```json
{
  "type": "pointer",
  "data": {
    "x": 842,
    "y": 315,
    "velocity": 0.342,
    "targetElement": "plan-pro",
    "targetDistance": 22
  }
}
```

| Field | What it means |
|-------|--------------|
| `x`, `y` | Cursor position in viewport |
| `velocity` | Mouse speed in px/ms — low = reading, high = scanning |
| `targetElement` | Name of the nearest `data-intent` element, or `"none"` |
| `targetDistance` | Distance in px to that element — decreasing = approaching |

### Scroll Events (`type: 'scroll'`)

Emitted on scroll (throttled to every 200ms).

```json
{
  "type": "scroll",
  "data": {
    "scrollY": 1840,
    "velocity": 1.2,
    "section": "pricing",
    "sectionDwell": 4500,
    "scrollDepth": 2100
  }
}
```

| Field | What it means |
|-------|--------------|
| `scrollY` | Current scroll position in px |
| `velocity` | Scroll speed — positive = down, negative = up |
| `section` | Which `data-intent` section is currently in the viewport center |
| `sectionDwell` | How long (ms) the user has been in this section |
| `scrollDepth` | Maximum scroll position reached in this session |

### Click Events (`type: 'click'`)

Emitted on every click. Includes confidence signals.

```json
{
  "type": "click",
  "data": {
    "x": 520,
    "y": 640,
    "targetElement": "cta-primary",
    "holdMs": 89,
    "approachDecel": false,
    "rage": false,
    "dead": false
  }
}
```

| Field | What it means |
|-------|--------------|
| `targetElement` | `data-intent` name of clicked element, or its HTML tag name |
| `holdMs` | Duration of mousedown-to-mouseup — long = hesitant, short = confident |
| `rage` | `true` if this is part of 3+ rapid clicks on the same spot (user frustration) |
| `dead` | `true` if the click landed on a non-interactive element (user confusion) |

### Visibility Events (`type: 'visibility'`)

Emitted when a `data-intent` section enters or leaves the viewport (50% threshold).

```json
{
  "type": "visibility",
  "data": {
    "section": "features",
    "visibleMs": 3200,
    "intersectionRatio": 0.85,
    "entered": true
  }
}
```

| Field | What it means |
|-------|--------------|
| `section` | The `data-intent` section name |
| `visibleMs` | Cumulative milliseconds this section has been visible |
| `intersectionRatio` | How much of the section is visible (0–1) |
| `entered` | `true` = just entered viewport, `false` = just left |

### Navigation Events (`type: 'navigation'`)

Emitted on page load and every route change (works with SPAs).

```json
{
  "type": "navigation",
  "data": {
    "from": "/features",
    "to": "/pricing",
    "trigger": "pushState"
  }
}
```

| Field | What it means |
|-------|--------------|
| `from` | Previous URL path |
| `to` | New URL path |
| `trigger` | `"initial"`, `"pushState"`, `"replaceState"`, or `"popstate"` |

---

## Every Event Includes

All events carry these envelope fields:

```json
{
  "sessionId": "a3f8b2c1e9d04756",
  "timestamp": 2847.30,
  "type": "click",
  "url": "/pricing",
  "data": { /* event-specific fields */ }
}
```

| Field | What it means |
|-------|--------------|
| `sessionId` | Rotating 16-char hex ID — resets every 24 hours, no cookies |
| `timestamp` | Milliseconds since page load (`performance.now()`) |
| `type` | Event type: `pointer`, `scroll`, `click`, `visibility`, `navigation` |
| `url` | Current page path |

---

## Setting Up `data-intent` Attributes

### Naming Convention

Use lowercase, descriptive names separated by hyphens:

```html
<!-- Sections — name them after what they ARE -->
<section data-intent="hero">
<section data-intent="features">
<section data-intent="pricing">
<section data-intent="testimonials">
<section data-intent="faq">

<!-- CTAs — name them after their PURPOSE -->
<button data-intent="cta-primary">Get Started</button>
<button data-intent="cta-demo">Book a Demo</button>
<button data-intent="cta-trial">Start Free Trial</button>

<!-- Pricing plans — name them after the PLAN -->
<div data-intent="plan-starter">Starter</div>
<div data-intent="plan-pro">Pro</div>
<div data-intent="plan-enterprise">Enterprise</div>

<!-- Forms — name them after their FUNCTION -->
<form data-intent="demo-form">
<form data-intent="newsletter-form">
<form data-intent="contact-form">

<!-- Navigation -->
<nav data-intent="main-nav">
<a data-intent="nav-pricing" href="/pricing">Pricing</a>
<a data-intent="nav-docs" href="/docs">Docs</a>
```

### Where to Place Them

**On sections**: Wrap each major page section. The library tracks which section is in the viewport, how long the user dwells, and scroll velocity within each section.

```html
<section data-intent="hero">...</section>
<section data-intent="problem">...</section>
<section data-intent="solution">...</section>
<section data-intent="features">...</section>
<section data-intent="pricing">...</section>
<section data-intent="cta-final">...</section>
```

**On CTAs and interactive elements**: The library measures mouse proximity, hover time, click confidence, and rage clicks on these elements.

**On pricing plans**: This is the highest-value area for intent signals. The library detects which plan the user is hovering near, hesitation before clicking, and comparison behavior (bouncing between plans).

### Minimal Setup (Fewest Attributes for Most Value)

If you only have 5 minutes, add these:

```html
<section data-intent="hero">...</section>
<section data-intent="pricing">...</section>
<button data-intent="cta-primary">...</button>
<form data-intent="demo-form">...</form>
```

These four elements capture: hero engagement, pricing interest, CTA interaction, and form behavior.

---

## Configuration

All options are optional:

```typescript
const sdk = new IntentLayer({
  // Where to send event batches (POST request)
  endpoint: 'https://your-server.com/api/intent',

  // Enable console logging — shows every event in browser DevTools
  dev: false,

  // Which trackers to activate. Default: all five.
  trackers: ['pointer', 'scroll', 'click', 'visibility', 'navigation'],

  // Fraction of events to capture. 0.5 = 50% of users. Default: 1 (all).
  // Clicks and navigation are always captured regardless of this setting.
  sampleRate: 1,

  // How many events to batch before sending. Default: 20.
  batchSize: 20,

  // How often to send a batch (milliseconds). Default: 5000 (5 seconds).
  flushInterval: 5000,

  // How often to rotate the session ID (milliseconds). Default: 86400000 (24 hours).
  sessionRotationMs: 86400000,

  // Respect browser Do Not Track setting. Default: true.
  // When true and user has DNT enabled, the library stays inert.
  respectDNT: true,
})
```

### Dev Mode

Set `dev: true` during development to see every event in the browser console:

```
[IntentLayer] pointer { x: 842, y: 315, velocity: 0.34, targetElement: 'plan-pro', targetDistance: 22 } sessionId=a3f8b2c1…
[IntentLayer] scroll { scrollY: 1840, velocity: 1.2, section: 'pricing', sectionDwell: 4500, scrollDepth: 2100 } sessionId=a3f8b2c1…
[IntentLayer] click { x: 520, y: 640, targetElement: 'cta-primary', holdMs: 89, approachDecel: false, rage: false, dead: false } sessionId=a3f8b2c1…
```

Remove `dev: true` in production to stop console logging.

### Disabling Specific Trackers

If you don't need all five trackers:

```typescript
// Only track clicks and section visibility (smallest footprint)
const sdk = new IntentLayer({
  trackers: ['click', 'visibility'],
})
```

---

## Data Transport

### How Events Are Sent

Events are batched in memory and sent via `POST` to your endpoint:

```
POST https://your-server.com/api/intent
Content-Type: application/json
```

**Payload:**

```json
{
  "events": [
    { "sessionId": "a3f8b2c1...", "timestamp": 1234.5, "type": "click", "url": "/pricing", "data": { ... } },
    { "sessionId": "a3f8b2c1...", "timestamp": 1235.1, "type": "scroll", "url": "/pricing", "data": { ... } }
  ],
  "sessionId": "a3f8b2c1e9d04756",
  "url": "/pricing",
  "sentAt": 1717584000000
}
```

### Flush Triggers

A batch is sent when any of these conditions is met:

1. **Batch size reached** — 20 events collected (configurable)
2. **Timer fires** — every 5 seconds (configurable)
3. **Page hidden** — user switches tabs, closes tab, or navigates away (`visibilitychange`)
4. **SDK destroyed** — `sdk.destroy()` is called

### Transport Chain

The library tries these methods in order:

1. `navigator.sendBeacon()` — survives page unload, up to 64KB
2. `fetch()` with `keepalive: true` — fallback if sendBeacon unavailable

Both are designed to work even when the user closes the tab.

### No Endpoint (Dev Only)

If you omit `endpoint`, events are only logged to the console (when `dev: true`). Nothing is sent over the network. Useful for local development and testing your `data-intent` setup.

---

## Server-Side Setup

You need an endpoint to receive event batches. Here's a minimal example for different backends:

### Supabase (Fastest Setup)

1. Create a table called `intent_events`:

```sql
create table intent_events (
  id uuid default gen_random_uuid() primary key,
  session_id text not null,
  url text,
  events jsonb not null,
  sent_at timestamptz default now()
);
```

2. Point the SDK at your Supabase REST API:

```typescript
const sdk = new IntentLayer({
  endpoint: 'https://your-project.supabase.co/rest/v1/intent_events',
})
```

### Generic Express.js

```javascript
app.post('/api/intent', express.json(), (req, res) => {
  const { events, sessionId, url } = req.body

  // Store events in your database
  for (const event of events) {
    db.query(
      'INSERT INTO intent_events (session_id, type, url, data, timestamp) VALUES ($1, $2, $3, $4, $5)',
      [sessionId, event.type, event.url, JSON.stringify(event.data), event.timestamp]
    )
  }

  res.status(200).send({ ok: true })
})
```

### Google Sheets (Quickest for Testing)

Use a service like [-sheetdb](https://sheetdb.io/) or [Zapier Webhooks](https://zapier.com/apps/webhook) to forward POST requests into a Google Sheet. No backend needed.

---

## Privacy

### No Consent Banner Needed

The library operates without cookies, localStorage identifiers, or fingerprinting:

- **Session IDs** are random 16-character hex strings that rotate every 24 hours
- **No cross-session tracking** — each day gets a new random ID
- **No personal data captured** — form field values are never collected
- **No IP stored** — the library runs entirely in the browser
- **DNT respected** — if the user has Do Not Track enabled, the library stays inert

Under GDPR and CCPA, this model qualifies as "isolated hits" (aggregated analytics without user identification), which does not require a consent banner.

### What Is NOT Collected

- Form field values (names, emails, phone numbers)
- IP addresses (not accessible from JavaScript)
- Browser fingerprint data
- Cross-device or cross-session identifiers
- Any personally identifiable information

---

## Framework Examples

### Next.js (App Router)

```tsx
// app/layout.tsx
import Script from 'next/script'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Script
          src="https://cdn.jsdelivr.net/gh/szsoma/intent-layer@v0.1.0/dist/intent-layer.iife.js"
          strategy="afterInteractive"
          onLoad={() => {
            new window.IntentLayer({
              endpoint: '/api/intent',
              dev: process.env.NODE_ENV === 'development',
            })
          }}
        />
      </body>
    </html>
  )
}
```

### React (SPA)

```tsx
// App.tsx
import { useEffect } from 'react'
import { IntentLayer } from 'intent-layer'

export default function App() {
  useEffect(() => {
    const sdk = new IntentLayer({
      endpoint: '/api/intent',
      dev: process.env.NODE_ENV === 'development',
    })
    return () => sdk.destroy()
  }, [])

  return (
    <main>
      <section data-intent="hero">...</section>
      <section data-intent="pricing">...</section>
      <button data-intent="cta-primary">Get Started</button>
    </main>
  )
}
```

### Webflow / WordPress / Any CMS

Add the script tag and `data-intent` attributes directly in the page HTML or through the CMS's custom code injection:

```html
<!-- In <head> -->
<script defer src="https://cdn.jsdelivr.net/gh/szsoma/intent-layer@v0.1.0/dist/intent-layer.iife.js"></script>

<!-- Before </body> -->
<script>
  new IntentLayer({ endpoint: 'https://your-server.com/api/intent' })
</script>
```

Then add `data-intent="name"` attributes to your CMS elements via their custom attributes setting.

---

## API Reference

### `new IntentLayer(config?)`

Creates and starts the SDK. Collection begins immediately.

```typescript
import { IntentLayer } from 'intent-layer'

const sdk = new IntentLayer({
  endpoint: '/api/intent',
  dev: false,
  trackers: ['pointer', 'scroll', 'click', 'visibility', 'navigation'],
  sampleRate: 1,
  batchSize: 20,
  flushInterval: 5000,
  sessionRotationMs: 86400000,
  respectDNT: true,
})
```

### `sdk.getSessionId()`

Returns the current 16-character hex session ID. Useful for correlating events with your own user tracking.

```typescript
const sid = sdk.getSessionId() // "a3f8b2c1e9d04756"
```

### `sdk.destroy()`

Stops all tracking, flushes any buffered events, and removes event listeners. Call this when unmounting a SPA component or navigating away.

```typescript
sdk.destroy()
```

---

## Bundle Size

| Format | Raw | Gzip |
|--------|-----|------|
| ESM | 13.4 KB | 3.7 KB |
| IIFE | 10.4 KB | 3.4 KB |

For comparison: GA4 is ~45 KB, FullStory is ~200 KB, Google Tag Manager is ~33 KB (empty container).

Zero runtime dependencies.

---

## License

MIT
