// server/worker.js — Cloudflare Worker for serverless quota enforcement.
//
// Deploys as a Worker that fronts the SPA (e.g. /api/notebooks, /api/chat).
// The service_role key stays HERE, never in the browser. Every write goes
// through the Supabase RPC `charge_notebook`, which enforces the token + subject
// cap atomically in Postgres BEFORE anything is written.
//
// Env vars:
//   SUPABASE_URL            https://<project>.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY (NEVER expose this to the browser)
//   SUPABASE_USER_ID        the calling user's Supabase id (from your session layer)
//
// Install: npm i @supabase/supabase-js   (and wrangler for deployment)

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// --- helpers ---------------------------------------------------------------

async function enforceCharge(userId, subject, cost) {
  const { data, error } = await supabase.rpc('charge_notebook', {
    userId,
    subject: subject || null,
    cost,
  })
  if (error) throw error
  const row = data && data[0]
  if (!row || row.ok !== true) {
    const err = row && row.error ? row.error : 'Quota exceeded'
    throw new Error(err)
  }
  return row
}

// --- routes ----------------------------------------------------------------

export default {
  async fetch(req, env) {
    const url = new URL(req.url)

    if (url.pathname === '/api/notebooks' && req.method === 'POST') {
      const body = await req.json()
      const { userId, subject } = body

      // 1) atomic quota check + charge (server-side)
      await enforceCharge(userId, subject, 3)

      // 2) create the notebook (now safe: quota already deducted) —
      //    your existing upsert code goes here
      // const nb = await db.saveNotebook(userId, { subject, files })

      return Response.json({ ok: true })
    }

    if (url.pathname === '/api/chat' && req.method === 'POST') {
      const body = await req.json()
      const { userId } = body

      // 1) chat = 1 token, no subject
      await enforceCharge(userId, null, 1)

      // 2) call your AI/tool here
      // const reply = await aiService.chat(userId, body.text)

      return Response.json({ ok: true })
    }

    return new Response('Not found', { status: 404 })
  },
}
