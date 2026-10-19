-- ============================================================
-- AFRORAMA — daily schedules for jazzhr-, workday- and adp-scraper
-- Run once in the Supabase SQL Editor. Reuses the secret key that
-- your existing cron jobs already use, so no key needs pasting.
-- Times are UTC, spread out from the busy 06:00–10:00 slots.
-- ============================================================
DO $$
DECLARE
  k    text;
  base text := 'https://vqchwioyhyiuunpyildz.supabase.co/functions/v1/';
  job  record;
BEGIN
  SELECT substring(command from 'sb_secret_[A-Za-z0-9_-]+') INTO k
  FROM cron.job WHERE command LIKE '%sb_secret_%' LIMIT 1;
  IF k IS NULL THEN RAISE EXCEPTION 'No secret key found in existing cron jobs'; END IF;

  FOR job IN SELECT * FROM (VALUES
    ('jazzhr-daily',  '20 4 * * *', 'jazzhr-scraper'),
    ('workday-daily', '25 4 * * *', 'workday-scraper'),
    ('adp-daily',     '30 4 * * *', 'adp-scraper')
  ) AS t(name, schedule, fn) LOOP
    PERFORM cron.schedule(job.name, job.schedule, format(
      $f$SELECT net.http_post(
           url := %L,
           headers := jsonb_build_object('Authorization', %L, 'Content-Type', 'application/json'),
           body := '{}'::jsonb,
           timeout_milliseconds := 150000
         )$f$,
      base || job.fn, 'Bearer ' || k));
  END LOOP;
END $$;

-- Check:
-- SELECT jobname, schedule FROM cron.job WHERE jobname IN ('jazzhr-daily','workday-daily','adp-daily');
