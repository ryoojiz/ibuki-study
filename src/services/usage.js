// src/services/usage.js — Usage quota + enforcement for ibuki-study.
//
// Quota model (Supabase):
//   quota_global (id='global')            -> global defaults
//   profiles.quota_*                      -> per-user overrides (0 => inherit global)
//   profiles.usage_*                      -> running counters
//   profiles.is_admin                     -> admin account flag
//
// Enforcement rules (as requested):
//   - 100 notebooks total   (per-user limit, 0 => inherit global 100)
//   - 12 subjects max       (per-user max distinct subjects, 0 => global 12)
//   - 1000 tokens/month     (per-user monthly token cap, 0 => global 1000)
//   - create notebook = 3 tokens
//   - chat + other tools = 1 token each
//
// NOTE: This app has no backend server, so quota checks run in the app layer
// (Supabase RLS + a usage_log table as audit trail is the next production step).
// The checks below are correct for a SPA + Supabase client; for strict atomicity
// a Supabase DB function (rpc) is recommended.

import { supabase } from './supabase';

const GLOBAL_ID = 'global';

async function rpcCall(name, params) {
  const { data, error } = await supabase.rpc(name, params)
  if (error) throw error
  if (Array.isArray(data)) {
    if (data.length === 0) throw new Error(`RPC "${name}" returned no rows`)
    return data[0]
  }
  return data
}

// ------------------------------------------------------------------ globals
export async function getGlobalQuota() {
  const { data, error } = await supabase
    .from('quota_global')
    .select('*')
    .eq('id', 'global')
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  if (!data) {
    return {
      id: 'global', notebook_limit: 100, subject_max: 12, monthly_token_limit: 1000,
      notebook_cost: 3, chat_cost: 1, updated_at: new Date().toISOString(),
    };
  }
  return data;
}

// ------------------------------------------------------------------ profiles
export async function getUserProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
}

export async function ensureProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .upsert(
      {
        id: userId,
        quota_notebook: 0, quota_subject: 0, quota_token: 0,
        usage_notebook: 0, usage_subject: 0, usage_token: 0, usage_chat: 0,
        is_admin: false,
      },
      { onConflict: 'id' }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export function getEffectiveQuota(profile, gq) {
  const v = (x) => (x === 0 || x == null ? null : x);
  return {
    notebook_limit: v(profile?.quota_notebook) ?? (gq?.notebook_limit ?? 100),
    subject_max: v(profile?.quota_subject) ?? (gq?.subject_max ?? 12),
    monthly_token_limit: v(profile?.quota_token) ?? (gq?.monthly_token_limit ?? 1000),
    notebook_cost: gq?.notebook_cost ?? 3,
    chat_cost: gq?.chat_cost ?? 1,
    is_admin: !!profile?.is_admin,
  };
}

export async function getEffectiveQuotaForUser(userId) {
  const [profile, gq] = await Promise.all([getUserProfile(userId), getGlobalQuota()]);
  if (!profile) throw new Error('User profile not found.');
  return getEffectiveQuota(profile, gq);
}

// ---------------------------------------------------------------- usage counters
export async function getUsage(userId) {
  const p = await getUserProfile(userId);
  if (!p) throw new Error('User profile not found.');
  return {
    notebook: p.usage_notebook || 0,
    token: p.usage_token || 0,
    chat: p.usage_chat || 0,
  };
}

export async function setUsage(userId, patch) {
  const { data, error } = await supabase
    .from('profiles')
    .upsert({ id: userId, ...patch }, { onConflict: 'id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------- enforce
async function distinctSubjects(userId) {
  const { data } = await supabase
    .from('notebooks')
    .select('subject')
    .eq('user_id', userId)
    .neq('subject', null);
  if (data) {
    const set = new Set(data.map((n) => String(n.subject).trim()).filter(Boolean));
    return set;
  }
  return new Set();
}

export async function canCreateNotebook(userId) {
  const [profile, gq, usage] = await Promise.all([
    getUserProfile(userId),
    getGlobalQuota(),
    getUsage(userId),
  ])
  if (!profile) throw new Error('User profile not found.')
  const q = getEffectiveQuota(profile, gq)
  const subjects = await distinctSubjects(userId)

  const tooManyNotebooks =
    q.notebook_limit > 0 && usage.notebook + 1 > q.notebook_limit
  const tooManySubjects =
    q.subject_max > 0 && subjects.size + 1 > q.subject_max
  const tooManyTokens =
    usage.token + q.notebook_cost > q.monthly_token_limit

  return {
    ok: !tooManyNotebooks && !tooManySubjects && !tooManyTokens,
    limit: q,
    usage,
    errors: {
      notebook: tooManyNotebooks
        ? `Notebook limit reached (${usage.notebook}/${q.notebook_limit})`
        : null,
      subject: tooManySubjects
        ? `Subject limit reached (${subjects.size}/${q.subject_max})`
        : null,
      token: tooManyTokens
        ? `Token limit reached (${usage.token}/${q.monthly_token_limit})`
        : null,
    },
  }
}

export async function chargeNotebook(userId, subject) {
  const r = await rpcCall('charge_notebook', {
    userId,
    subject: subject || null,
    cost: 3,
  })
  if (r && typeof r.ok === 'boolean' && !r.ok) {
    return { ok: false, error: r.error || 'Quota exceeded' }
  }
  if (!r || typeof r.ok !== 'boolean' || !r.ok) {
    return { ok: false, error: 'RPC failed' }
  }
  return { ok: true, remaining: r.remaining, subjects: r.subjects }
}

export async function chargeChat(userId, cost = 1) {
  const r = await rpcCall('charge_notebook', {
    userId,
    subject: null,
    cost,
  })
  if (r && typeof r.ok === 'boolean' && !r.ok) {
    return { ok: false, error: r.error || 'Token limit reached' }
  }
  return { ok: true, remaining: r.remaining }
}

export async function chargeTool(userId, cost = 1) {
  return chargeChat(userId, cost)
}

// ---------------------------------------------------------------- admin (profiles)
export async function listUsersForAdmin() {
  const { data, error } = await supabase
    .from('profiles')
    .select(`id, email, is_admin, quota_notebook, quota_subject, quota_token, usage_notebook, usage_subject, usage_token, usage_chat, updated_at`)
    .order('updated_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function setAdmin(userId, isAdmin) {
  const { data, error } = await supabase
    .from('profiles')
    .upsert({ id: userId, is_admin: !!isAdmin, quota_updated_at: new Date().toISOString() }, { onConflict: 'id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function resetUsage(userId) {
  return setUsage(userId, {
    usage_notebook: 0, usage_subject: 0, usage_token: 0, usage_chat: 0, quota_updated_at: new Date().toISOString(),
  });
}

export async function resetLimits(userId) {
  const gq = await getGlobalQuota();
  return setUsage(userId, {
    quota_notebook: gq.notebook_limit, quota_subject: gq.subject_max, quota_token: gq.monthly_token_limit, quota_updated_at: new Date().toISOString(),
  });
}

export async function setLimits(userId, { notebook, subject, token }) {
  return setUsage(userId, {
    quota_notebook: Math.max(0, notebook ?? 0),
    quota_subject: Math.max(0, subject ?? 0),
    quota_token: Math.max(0, token ?? 0),
    quota_updated_at: new Date().toISOString(),
  });
}

export async function changeUsage(userId, { notebook, subject, token, chat }) {
  return setUsage(userId, {
    usage_notebook: (usage_notebook ?? 0) + (notebook ?? 0),
    usage_subject: (usage_subject ?? 0) + (subject ?? 0),
    usage_token: (usage_token ?? 0) + (token ?? 0),
    usage_chat: (usage_chat ?? 0) + (chat ?? 0),
    quota_updated_at: new Date().toISOString(),
  });
}

export async function getAdminEmailList() {
  const users = await listUsersForAdmin()
  return users.filter((u) => (u.is_admin === true || u.is_admin === 'true') && u.email).map((u) => ({ id: u.id, email: u.email, is_admin: !!u.is_admin }))
}

export async function upsertGlobalQuota(patch) {
  const { data, error } = await supabase
    .from('quota_global')
    .upsert({ id: 'global', updated_at: new Date().toISOString(), ...patch }, { onConflict: 'id' })
    .select()
    .single()
  if (error) throw error
  return data
}
