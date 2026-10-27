-- ============================================================
-- AFRORAMA — daily schedule for the france-volontaires scraper
-- Run once in the Supabase SQL Editor, after deploying the function.
-- Reuses the secret key that your existing cron jobs already use.
-- Time is UTC, next to the other new scrapers (04:20–04:40).
-- ============================================================
DO $$
DECLARE
  k text;
BEGIN
  SELECT substring(command from 'sb_secret_[A-Za-z0-9_-]+') INTO k
  FROM cron.job WHERE command LIKE '%sb_secret_%' LIMIT 1;
  IF k IS NULL THEN RAISE EXCEPTION 'No secret key found in existing cron jobs'; END IF;

  PERFORM cron.schedule('france-volontaires-daily', '45 4 * * *', format(
    $f$SELECT net.http_post(
         url := %L,
         headers := jsonb_build_object('Authorization', %L, 'Content-Type', 'application/json'),
         body := '{}'::jsonb,
         timeout_milliseconds := 150000
       )$f$,
    'https://vqchwioyhyiuunpyildz.supabase.co/functions/v1/france-volontaires-scraper', 'Bearer ' || k));
END $$;

-- Check:
-- SELECT jobname, schedule FROM cron.job WHERE jobname = 'france-volontaires-daily';
