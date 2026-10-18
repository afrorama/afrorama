-- ============================================================
-- AFRORAMA — SECURITY HARDENING (2026-10-18)
-- Run once in the Supabase SQL Editor, AFTER the site code from
-- the fix/security-hardening PR is live (the site must stop
-- using select('*') on listings before section 1 runs).
-- ============================================================


-- ── 1. LISTINGS — hide customer emails ──────────────────────
-- Visitors may read every listing column except contact_email
-- and the internal notification flags.
-- When you add a new public column to listings, also add it to
-- this GRANT and to PUBLIC_LISTING_COLUMNS in js/supabase.js.
REVOKE SELECT ON public.listings FROM anon, authenticated;
GRANT SELECT (
  id, title, organisation, type, sector, location, country, deadline, posted,
  salary, description, requirements, apply_url, bitly_url, utm_url, source,
  views, apply_clicks, paid_listing, created_at, org_domain, experience,
  payment_confirmed
) ON public.listings TO anon, authenticated;

-- get_active_listings() — redefined in section 1b below so it no
-- longer returns contact_email. (Filled in from the live definition.)


-- ── 2. PROFILES — hide everything but names ─────────────────
-- Anyone can still see id, full_name and is_moderator (the
-- community pages show author names). Everything else is private.
REVOKE SELECT, INSERT, UPDATE ON public.profiles FROM anon, authenticated;
GRANT SELECT (id, full_name, is_moderator) ON public.profiles TO anon, authenticated;

-- Users may only edit their own profile details — not membership,
-- CV boosts, moderator status or Stripe IDs (those are set by
-- stripe-webhook / admins using the service role).
GRANT INSERT (
  id, full_name, linkedin_url, location, is_actively_looking,
  job_type_prefs, sector_prefs, email_alerts, cv_score, cv_score_history
) ON public.profiles TO authenticated;
GRANT UPDATE (
  id, full_name, linkedin_url, location, is_actively_looking,
  job_type_prefs, sector_prefs, email_alerts, cv_score, cv_score_history
) ON public.profiles TO authenticated;

-- A signed-in user reads their own full profile through this.
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS public.profiles
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.profiles WHERE id = auth.uid();
$$;
REVOKE EXECUTE ON FUNCTION public.get_my_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;


-- ── 3. CV BOOSTS — only via Stripe payment ──────────────────
-- stripe-webhook calls this with the service role after payment.
REVOKE EXECUTE ON FUNCTION public.increment_cv_boosts(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_cv_boosts(UUID) TO service_role;
