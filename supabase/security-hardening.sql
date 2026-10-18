-- ============================================================
-- AFRORAMA — SECURITY HARDENING (2026-10-18)
-- Run in the Supabase SQL Editor in two parts:
--   PART A — any time (safe with the old and the new site code)
--   PART B — only AFTER the fix/security-hardening site code is
--            live on Vercel (the old code still reads private columns)
-- ============================================================


-- ════════════════════════ PART A ════════════════════════════

-- ── A1. get_active_listings — stop returning customer emails ─
-- Same filter as before; private columns come back as NULL.
CREATE OR REPLACE FUNCTION public.get_active_listings()
RETURNS SETOF public.listings
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (jsonb_populate_record(
            NULL::public.listings,
            to_jsonb(l) - ARRAY['contact_email', 'expiry_notified', 'live_notified',
                                'abandoned_notified', 'payment_confirmed_at']
          )).*
  FROM public.listings l
  WHERE (l.deadline >= CURRENT_DATE OR l.deadline IS NULL)
    AND (l.paid_listing = false OR l.payment_confirmed = true)
  ORDER BY l.created_at DESC;
$$;

-- ── A2. submit_listing — every public submission must be paid ─
-- Previously p_paid_listing = false published a listing instantly
-- for free. The parameter is kept so the post page keeps working,
-- but it is ignored: listings stay hidden until stripe-webhook
-- confirms payment.
CREATE OR REPLACE FUNCTION public.submit_listing(
  p_id text, p_title text, p_organisation text, p_type text, p_sector text,
  p_location text, p_country text, p_deadline date, p_salary text,
  p_apply_url text, p_description text, p_requirements text,
  p_contact_email text, p_paid_listing boolean
)
RETURNS text
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.listings (
    id, title, organisation, type, sector, location, country, deadline,
    salary, apply_url, description, requirements, contact_email,
    posted, source, paid_listing, payment_confirmed, views, apply_clicks
  ) VALUES (
    p_id, p_title, p_organisation, p_type, p_sector, p_location, p_country, p_deadline,
    p_salary, p_apply_url, p_description, p_requirements, p_contact_email,
    CURRENT_DATE, 'Direct', true, false, 0, 0
  )
  RETURNING id;
$$;

-- ── A3. get_my_profile — a user reads their own full profile ─
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS public.profiles
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.profiles WHERE id = auth.uid();
$$;
REVOKE EXECUTE ON FUNCTION public.get_my_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;

-- ── A4. CV boosts — only via Stripe payment ─────────────────
-- stripe-webhook calls this with the service role after payment.
REVOKE EXECUTE ON FUNCTION public.increment_cv_boosts(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_cv_boosts(UUID) TO service_role;


-- ════════════════════════ PART B ════════════════════════════
-- Run only after the new site code is live.

-- ── B1. LISTINGS — hide customer emails from direct reads ───
-- When you add a new public column to listings, also add it to
-- this GRANT and to PUBLIC_LISTING_COLUMNS in js/supabase.js.
REVOKE SELECT ON public.listings FROM anon, authenticated;
GRANT SELECT (
  id, title, organisation, type, sector, location, country, deadline, posted,
  salary, description, requirements, apply_url, bitly_url, utm_url, source,
  views, apply_clicks, paid_listing, created_at, org_domain, experience,
  payment_confirmed
) ON public.listings TO anon, authenticated;

-- ── B2. PROFILES — names public, everything else private ────
-- Community pages still show author names (id, full_name, is_moderator).
REVOKE SELECT, INSERT, UPDATE ON public.profiles FROM anon, authenticated;
GRANT SELECT (id, full_name, is_moderator) ON public.profiles TO anon, authenticated;

-- Users may edit their own details only — not membership, CV boosts,
-- moderator status or Stripe IDs (set by stripe-webhook / service role).
GRANT INSERT (
  id, full_name, linkedin_url, location, is_actively_looking,
  job_type_prefs, sector_prefs, email_alerts, cv_score, cv_score_history,
  years_exp  -- added in profiles-years-exp.sql
) ON public.profiles TO authenticated;
GRANT UPDATE (
  id, full_name, linkedin_url, location, is_actively_looking,
  job_type_prefs, sector_prefs, email_alerts, cv_score, cv_score_history,
  years_exp  -- added in profiles-years-exp.sql
) ON public.profiles TO authenticated;
