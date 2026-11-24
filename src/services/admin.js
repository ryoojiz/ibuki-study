// src/services/admin.js — Admin functions for ibuki-study.
//
// Privileges (admin = profiles.is_admin === true):
//   list users, set admin flag, reset limits, change limits (global base),
//   reset usage, change usage, send password reset, delete account.
//
// NOTE: "delete account" requires Supabase service_role credentials (which are
// NOT in this client). Use the Supabase dashboard SQL/REST, or an edge function,
// to actually delete the user; this module deletes the local `profiles` row and
// forces a re-login by zeroing the session. Password *reset email* is sendable
// via the anon key (supabase.auth.resetPasswordForEmail).

import { supabase } from './supabase';
import { authService } from './auth';
import {
  getGlobalQuota,
  setUsage,
  resetUsage,
  resetLimits,
  changeUsage,
  setLimits,
  setAdmin,
  getUsage,
  getUserProfile,
} from './usage';

// ------------------------------------------------------------------ limits
export async function resetLimitsForUser(userId) {
  const gq = await getGlobalQuota();
  return setUsage(userId, {
    quota_notebook: gq.notebook_limit,
    quota_subject: gq.subject_max,
    quota_token: gq.monthly_token_limit,
    quota_updated_at: new Date().toISOString(),
  });
}

export async function changeLimitsForUser(userId, limits) {
  return setLimits(userId, limits);
}

export async function resetUsageForUser(userId) {
  return resetUsage(userId);
}

export async function changeUsageForUser(userId, patch) {
  return changeUsage(userId, patch);
}

// --------------------------------------------------------------------- admin
export async function listAdministrators() {
  const users = await listUsersForAdmin();
  return users.filter((u) => (u.is_admin === true || u.is_admin === 'true') && u.email);
}

export async function createAdminAccount(email, password, { isAdmin = true } = {}) {
  // Signs up the user via Supabase auth (anon key).
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  const user = data.user;
  if (!user) throw new Error('Sign-up did not return a user');

  // Set admin flag on profile (requires the user to have a profile row).
  await setAdmin(user.id, isAdmin);
  return user;
}

// ------------------------------------------------------------------ lookups
export async function findUserByEmail(email) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', email.toLowerCase())
    .single();
  if (error) throw error;
  return data;
}

export async function getAdminEmailList() {
  const users = await listAdministrators();
  return users.map((u) => ({ id: u.id, email: u.email, is_admin: !!u.is_admin }));
}

// ---------------------------------------------------------------- account
export async function deleteAccountUser(userId, { reason } = {}) {
  // IMPORTANT: ~resetPassword~ password reset email can go through the anon key.
  // Actual user deletion requires the Supabase project SERVICE ROLE key, which is
  // strictly never exposed to a client. This function:
  //   1. clears the profile row from the app's tables,
  //   2. marks the user as deleted (so the UI can show "deleted"),
  //   3. returns the caller a clear warning to run the permanent removal
  //      through the Supabase dashboard or an Edge Function.
  const { error: pErr } = await supabase
    .from('profiles')
    .delete()
    .eq('id', userId);
  if (pErr) throw pErr;

  // Force logout / remove on device.
  await authService.signOut();
  return { ok: true, note: 'Profile row deleted; re-run the Supabase account-deletion step with service_role for a hard delete.' };
}

export async function sendPasswordResetEmail(email) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset`,
  });
  if (error) throw error;
  return data;
}
