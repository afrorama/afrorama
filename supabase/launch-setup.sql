-- ============================================================
-- AFRORAMA LAUNCH — DATABASE GRANTS + SCHEMA FIXES
--
-- Run once in: Supabase Dashboard → SQL Editor → New query → Run
-- Safe to re-run (idempotent guards included).
-- ============================================================

-- 1. PROFILES — fix "permission denied" (42501) for anon/authenticated
--    + add columns the Stripe webhook writes to
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cv_extra_boosts INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

-- 2. SAVED_JOBS — fix 42501, needed for Job Board "save listing" feature
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_jobs TO authenticated;
GRANT SELECT ON public.saved_jobs TO anon;
ALTER TABLE public.saved_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own saved jobs" ON public.saved_jobs;
CREATE POLICY "Users manage own saved jobs" ON public.saved_jobs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 3. LISTINGS — payment gating column
--    DEFAULT true so all existing scraped/free listings stay visible
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS payment_confirmed BOOLEAN DEFAULT true;

-- 4. SALARY_SUBMISSIONS — new table for Salary Intelligence contribute form
--    Anonymous data: no user identity stored in the row
CREATE TABLE IF NOT EXISTS public.salary_submissions (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company     TEXT NOT NULL,
  position    TEXT NOT NULL,
  salary      INTEGER NOT NULL DEFAULT 0,
  unpaid      BOOLEAN NOT NULL DEFAULT false,
  years_exp   TEXT NOT NULL,
  sector      TEXT NOT NULL,
  country     TEXT NOT NULL,
  currency    TEXT DEFAULT 'USD',
  year        INTEGER NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.salary_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Salary submissions are publicly readable" ON public.salary_submissions;
CREATE POLICY "Salary submissions are publicly readable" ON public.salary_submissions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can submit salary data" ON public.salary_submissions;
CREATE POLICY "Authenticated users can submit salary data" ON public.salary_submissions
  FOR INSERT TO authenticated WITH CHECK (true);

GRANT SELECT ON public.salary_submissions TO anon;
GRANT SELECT, INSERT ON public.salary_submissions TO authenticated;

-- 5. cv_extra_boosts increment helper
--    Replaces the broken supabase.rpc('increment', ...) call in stripe-webhook
CREATE OR REPLACE FUNCTION public.increment_cv_boosts(profile_id UUID)
RETURNS void AS $$
  UPDATE public.profiles SET cv_extra_boosts = COALESCE(cv_extra_boosts, 0) + 1 WHERE id = profile_id;
$$ LANGUAGE sql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.increment_cv_boosts(UUID) TO authenticated, anon, service_role;

-- 6. (Optional, not launch-critical) Community table grants — cheap safety net
--    Prevents 42501 console errors if a user navigates directly to community.html
GRANT SELECT ON public.community_posts TO anon;
GRANT SELECT, INSERT, DELETE ON public.community_posts TO authenticated;
GRANT SELECT ON public.community_comments TO anon;
GRANT SELECT, INSERT ON public.community_comments TO authenticated;
GRANT SELECT ON public.post_upvotes TO anon;
GRANT SELECT, INSERT, DELETE ON public.post_upvotes TO authenticated;
