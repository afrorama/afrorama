-- ============================================================
-- Afrorama Job Alert Subscriptions
-- Run this once in Supabase SQL Editor
-- ============================================================

-- 1. Create the table
CREATE TABLE IF NOT EXISTS public.job_alert_subscriptions (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  email            TEXT        NOT NULL,
  name             TEXT,
  countries        TEXT[]      DEFAULT '{}',
  regions          TEXT[]      DEFAULT '{}',
  sectors          TEXT[]      DEFAULT '{}',
  types            TEXT[]      DEFAULT '{}',
  frequency        TEXT        NOT NULL DEFAULT 'weekly'
                               CHECK (frequency IN ('daily', 'weekly')),
  active           BOOLEAN     DEFAULT TRUE,
  unsubscribe_token UUID       DEFAULT gen_random_uuid(),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  last_sent_at     TIMESTAMPTZ
);

-- 2. Unique constraint on email (one subscription per email)
CREATE UNIQUE INDEX IF NOT EXISTS job_alert_subscriptions_email_uq
  ON public.job_alert_subscriptions (lower(email));

-- 3. Enable RLS
ALTER TABLE public.job_alert_subscriptions ENABLE ROW LEVEL SECURITY;

-- 4. Allow anyone to subscribe (anon INSERT)
CREATE POLICY IF NOT EXISTS "anyone_can_subscribe"
  ON public.job_alert_subscriptions
  FOR INSERT
  WITH CHECK (true);

-- 5. Unsubscribe function (token-gated, callable via anon key)
CREATE OR REPLACE FUNCTION public.unsubscribe_job_alerts(token UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.job_alert_subscriptions
  SET    active = false
  WHERE  unsubscribe_token = token;
$$;

GRANT EXECUTE ON FUNCTION public.unsubscribe_job_alerts(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.unsubscribe_job_alerts(UUID) TO authenticated;

-- 6. Schedule the daily alert function (run AFTER deploying send-job-alerts)
--    Replace SERVICE_ROLE_KEY with your actual service role key.
--
-- SELECT cron.schedule(
--   'send-job-alerts',
--   '0 8 * * *',
--   $$SELECT net.http_post(
--     url := 'https://vqchwioyhyiuunpyildz.supabase.co/functions/v1/send-job-alerts',
--     headers := '{"Authorization":"Bearer SERVICE_ROLE_KEY","Content-Type":"application/json"}'::jsonb,
--     body := '{}'::jsonb,
--     timeout_milliseconds := 60000
--   )$$
-- );
