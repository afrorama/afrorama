-- ============================================================
-- AFRORAMA — update_my_profile() (2026-10-18)
-- Profile saves used an upsert (INSERT … ON CONFLICT DO UPDATE).
-- Postgres requires SELECT privilege on every column an upsert
-- writes, and security-hardening.sql (B2) made those columns
-- private — so every save was rejected.
--
-- A signed-in user now saves through this function instead. It
-- only touches their own row and only the user-editable columns
-- (never membership, CV boosts, moderator status or Stripe IDs).
-- Run once in the Supabase SQL Editor. Needs profiles-years-exp.sql first.
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_my_profile(fields jsonb)
RETURNS public.profiles
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid     uuid := auth.uid();
  allowed text[] := ARRAY[
    'full_name', 'linkedin_url', 'location', 'is_actively_looking',
    'job_type_prefs', 'sector_prefs', 'email_alerts', 'cv_score',
    'cv_score_history', 'years_exp'
  ];
  clean   jsonb;
  result  public.profiles;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  SELECT COALESCE(jsonb_object_agg(key, value), '{}'::jsonb) INTO clean
  FROM jsonb_each(fields) WHERE key = ANY(allowed);

  INSERT INTO public.profiles (id) VALUES (uid) ON CONFLICT (id) DO NOTHING;

  -- Keys present in `clean` overwrite; everything else keeps its value
  UPDATE public.profiles p SET
    (full_name, linkedin_url, location, is_actively_looking, job_type_prefs,
     sector_prefs, email_alerts, cv_score, cv_score_history, years_exp)
  = (SELECT r.full_name, r.linkedin_url, r.location, r.is_actively_looking, r.job_type_prefs,
            r.sector_prefs, r.email_alerts, r.cv_score, r.cv_score_history, r.years_exp
     FROM jsonb_populate_record(p, clean) r)
  WHERE p.id = uid
  RETURNING p.* INTO result;

  RETURN result;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.update_my_profile(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_my_profile(jsonb) TO authenticated;
