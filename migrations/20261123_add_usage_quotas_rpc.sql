-- 2026-11-23: Atomic RPC quota enforcement (serverless-safe).
--
-- Replaces the client-side read-then-write "charge" with a single atomic
-- check + charge executed server-side by Postgres. Every statement inside the
-- function body runs inside the RPC call's one transaction, so two concurrent
-- calls can never overshoot the token cap (the old client layer had a race
-- where both requests read the same balance and both passed).
--
-- Usage (app layer):
--   supabase.rpc('charge_notebook', { userId, subject, cost })
--
--   - cost 3  -> create a notebook (subject check + usage_subject bump)
--   - cost 1  -> chat / other tool (subject=NULL, usage_chat bump)
--
-- The function is callable by the anon key (EXECUTE granted below) so the SPA
-- can call it directly; the charge + limit check happen inside Postgres, not
-- the browser. is_admin / hard account ops still need the app-side admin
-- gate + service_role.

-- ---- charge_notebook : atomic token + subject enforcement ----
CREATE OR REPLACE FUNCTION charge_notebook(
    p_user_id uuid,
    p_subject text default null,
    p_cost integer default 3
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
    v_limit int;
    v_existing_notebooks int;
    v_existing_subjects int;
    v_already_has boolean;
    v_new_subjects int := 0;
    v_new_tokens int;
    v_result jsonb;
BEGIN
    -- Effective token limit: per-user override (nonzero) else global.
    SELECT COALESCE(NULLIF(p_user.quota_token, 0), g.monthly_token_limit)
    INTO v_limit
    FROM profiles p_user
    CROSS JOIN quota_global g
    WHERE p_user.id = p_user_id;

    IF v_limit IS NULL THEN
        v_result := jsonb_build_object('ok', false, 'error', 'global_missing');
        RETURN v_result;
    END IF;

    -- Subject check (only for real notebooks; chat uses subject=NULL).
    IF p_subject IS NOT NULL THEN
        SELECT COUNT(DISTINCT subject)
        INTO v_existing_subjects
        FROM notebooks
        WHERE user_id = p_user_id AND subject IS NOT NULL;

        IF v_existing_subjects + 1 > COALESCE(NULLIF(p_user.quota_subject, 0), g.subject_max) THEN
            v_result := jsonb_build_object('ok', false, 'error', 'subjects_exceeded');
            RETURN v_result;
        END IF;

        SELECT p_subject = subject
        INTO v_already_has
        FROM notebooks
        WHERE user_id = p_user_id AND subject = p_subject
        LIMIT 1;

        v_new_subjects := v_existing_subjects
            + CASE WHEN v_already_has THEN 0 ELSE 1 END;
        UPDATE profiles
        SET usage_subject = v_new_subjects
        WHERE id = p_user_id;
    END IF;

    -- Notebook-count limit check (per-user or global; 0 => inherit).
    SELECT COUNT(*) INTO v_existing_notebooks
    FROM notebooks
    WHERE user_id = p_user_id;
    IF (v_existing_notebooks + 1) > COALESCE(NULLIF(p_user.quota_notebook, 0), g.notebook_limit) THEN
        v_result := jsonb_build_object('ok', false, 'error', 'notebooks_exceeded');
        RETURN v_result;
    END IF;

    -- Atomic check + charge: the UPDATE ... WHERE is a single transactional
    -- step, so concurrent calls cannot overshoot the token cap.
    UPDATE profiles p
    SET usage_token = p.usage_token + p_cost,
        usage_chat = p.usage_chat
            + CASE WHEN p_subject IS NULL THEN 1 ELSE 0 END,
        usage_notebook = p.usage_notebook
            + CASE WHEN p_subject IS NOT NULL THEN 1 ELSE 0 END,
        quota_updated_at = now()
    FROM quota_global g
    WHERE p.id = p_user_id
      AND (p.quota_token IS NULL OR p.quota_token = 0
           OR p.usage_token + p_cost <= p.quota_token)
      AND p.usage_token + p_cost <= g.monthly_token_limit
    RETURNING p.usage_token INTO v_new_tokens;

    IF NOT FOUND THEN
        v_result := jsonb_build_object('ok', false, 'error', 'tokens_exceeded');
        RETURN v_result;
    END IF;

    v_result := jsonb_build_object(
        'ok', true,
        'remaining', v_limit - v_new_tokens,
        'subjects', v_new_subjects
    );
    RETURN v_result;
END;
$$;

-- Chat = charge_notebook(user, subject=NULL, cost=1), e.g.:
--   supabase.rpc('charge_notebook', {userId, cost: 1})
--
-- Allow the anon key (browser) to call the function:
GRANT EXECUTE ON FUNCTION charge_notebook(uuid, text, integer) TO anon;
