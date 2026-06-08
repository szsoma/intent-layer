// ────────────────────────────────────────────────────────────────
// Intent Layer — Cloudflare Worker for receiving events
//
// Deploy: npm create cloudflare@latest -- intent-worker
// Then paste this as src/index.ts (or index.js)
//
// Environment variables (set in wrangler.toml or dashboard):
//   SUPABASE_URL = "https://your-project.supabase.co"
//   SUPABASE_KEY = "your-anon-key"
// ────────────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    // CORS headers — echo origin so credentials work (wildcard * fails with credentials:include)
    const origin = request.headers.get('Origin')
    const corsHeaders = {
      ...(origin ? { 'Access-Control-Allow-Origin': origin } : {}),
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      ...(origin ? { 'Access-Control-Allow-Credentials': 'true' } : {}),
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 })
    }

    let body
    try {
      body = await request.json()
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { events, sessionId, url, sentAt } = body

    if (!events || !Array.isArray(events) || events.length === 0) {
      return new Response(JSON.stringify({ error: 'No events' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const rows = events.map((event) => ({
      session_id: event.sessionId || sessionId,
      event_type: event.type,
      url: event.url || url,
      data: event.data,
      client_timestamp: event.timestamp,
    }))

    try {
      const response = await fetch(`${env.SUPABASE_URL}/rest/v1/intent_events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: env.SUPABASE_KEY,
          Authorization: `Bearer ${env.SUPABASE_KEY}`,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify(rows),
      })

      if (!response.ok) {
        const err = await response.text()
        return new Response(JSON.stringify({ error: 'Supabase error', details: err }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Supabase connection failed', details: err.message }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true, received: rows.length }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  },
}
