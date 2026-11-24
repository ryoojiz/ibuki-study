-- 2026-11-23: RLS policies for quota/admin schema.
--
-- Run AFTER 20261123_add_usage_quotas.sql.
--
-- Goal: non-admin users can read/update their OWN profile (including quota /
-- usage columns) but cannot change `is_admin` or touch other users. Admins
-- (profiles.is_admin=true) can read/update anything.
--
-- NOTE: `is_admin` writes are also gate-kept in the app (src/services/admin.js
-- + AdminView.vue) — only the admin UI can call them. The policies below are
-- defense-in-depth; for hard admin management use a Supabase Edge Function with
-- the service_role key.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Non-admin users: read + update their OWN profile (quota/usage included).
CREATE POLICY profiles_own_select ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY profiles_own_update ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (
    NOT (NEW.is_admin = true AND auth.uid() != id)
  );

CREATE POLICY profiles_own_delete ON public.profiles
  FOR DELETE USING (auth.uid() = id);

-- Admins: read + update everything, including is_admin.
CREATE POLICY profiles_admin_select ON public.profiles
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE is_admin
    )
  );

CREATE POLICY profiles_admin_update ON public.profiles
  FOR UPDATE USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE is_admin)
  );

CREATE POLICY profiles_admin_delete ON public.profiles
  FOR DELETE USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE is_admin)
  );

-- Global quota table: every user may READ global defaults (the charge functions
-- need them). Admins may write (set global limits).
CREATE POLICY quota_global_select_all ON public.quota_global
  FOR SELECT USING (true);

CREATE POLICY quota_global_admin_all ON public.quota_global
  FOR ALL
  USING (auth.uid() IN (SELECT id FROM public.profiles WHERE is_admin));
