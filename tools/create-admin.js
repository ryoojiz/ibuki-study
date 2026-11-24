#!/usr/bin/env node
/**
 * tools/create-admin.js — One-time seed: create the quota/admin account and verify
 * the `quota_global` defaults were applied.
 *
 * Usage:
 *   node tools/create-admin.js --email admin@example.com --password '<12-char password>'
 *
 * Docs:
 *   1. Apply migrations/20261123_add_usage_quotas.sql to your Supabase project.
 *   2. Run this script to create the first admin + verify quota_global.
 *
 * Notes:
 *   - "delete account" is NOT enabled here (no service_role key in the client).
 *     Build an edge function or move the service_role key server-side to hard-delete.
 *   - "password reset email" works via the anon key (supabase.auth.resetPasswordForEmail).
 */
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import readline from 'readline'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vmptcrlpezjinvlcxmlj.supabase.co'
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || ''
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE || ''

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true }
})

const adminClient = SUPABASE_SERVICE_ROLE
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
      auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true }
    })
  : null

function prompt(label) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => rl.question(`${label}: `, (a) => { rl.close(); resolve(a) }))
}

function toBool(v) {
  if (typeof v === 'boolean') return v
  if (typeof v === 'string') return /^(true|1|yes)$/i.test(v)
  return !!v
}

async function main() {
  const email = process.env.ADMIN_EMAIL || (await prompt('Admin email'))
  const password = process.env.ADMIN_PASSWORD || (await prompt('Admin password (min 12 chars)'))

  if (!email || !password) {
    console.error('Missing email/password. Use ADMIN_EMAIL / ADMIN_PASSWORD env or answer prompts.')
    process.exit(1)
  }
  if (password.length < 12) {
    console.error('ERROR: password must be at least 12 characters (app enforces min 12).')
    process.exit(1)
  }

  // 1. Ensure global quota defaults exist.
  let gq
  const [row] = await supabase.from('quota_global').select('*').eq('id', 'global').single().catch((e) => e)
  if (row && row.error) {
    console.warn('quota_global read failed:', row.error.message)
  }
  if (!row || row.error) {
    const ins = await supabase.from('quota_global').insert({
      id: 'global', notebook_limit: 100, subject_max: 12, monthly_token_limit: 1000,
      notebook_cost: 3, chat_cost: 1, updated_at: new Date().toISOString()
    }).single()
    if (ins.error) { console.error('Failed to seed quota_global:', ins.error.message); process.exit(1) }
    console.log('  -> seeded quota_global (100 notebooks / 12 subjects / 1000 tokens)')
    gq = (await supabase.from('quota_global').select('*').eq('id', 'global').single()).data
  } else {
    gq = row
    console.log('quota_global present:', JSON.stringify({
      notebook_limit: gq.notebook_limit, subject_max: gq.subject_max,
      monthly_token_limit: gq.monthly_token_limit, notebook_cost: gq.notebook_cost, chat_cost: gq.chat_cost
    }, null, 2))
  }

  // 2. Sign up the admin account.
  const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${process.env.BASE_URL || 'http://localhost'}/auth/callback` } })
  if (error || !data?.user) {
    console.error('Sign-up error:', error?.message || 'unknown')
    console.error('Weak password? Choose a longer password (Supabase enforces a strong-password policy).')
    process.exit(1)
  }
  const userId = data.user.id

  // 3. Mark the account admin.
  const { error: uErr } = await supabase.from('profiles').upsert({
    id: userId, is_admin: true, quota_notebook: 100, quota_subject: 12, quota_token: 1000,
    usage_notebook: 0, usage_subject: 0, usage_token: 0, usage_chat: 0, quota_updated_at: new Date().toISOString()
  }, { onConflict: 'id' })
  if (uErr) {
    console.error('Failed to mark profile admin:', uErr.message)
    process.exit(1)
  }

  console.log('\nCreated admin account:', email)
  if (adminClient) {
    console.log('  (service_role connected: hard account deletion available via admin.js.deleteAccountUser)')
  } else {
    console.log('  No service_role key: hard account deletion unavailable in the browser.')
    console.log('  Set SUPABASE_SERVICE_ROLE or remove the account in the Supabase dashboard.')
  }
  console.log('  Login -> Settings -> Admin to manage quotas/limits/usage.')
}

main().catch((e) => {
  console.error('ERROR:', e && e.message ? e.message : e)
  process.exit(1)
})
