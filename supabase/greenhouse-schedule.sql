-- ============================================================
-- AFRORAMA — Greenhouse scraper schedule (2026-10-19)
--
-- Why: 50 of 78 Greenhouse boards were dead (404) and runs stalled at
-- random inside the edge runtime — traced to the scraper's sleep timers
-- (setTimeout) occasionally never firing, which also defeated timeouts.
-- The scraper now has no sleeps, hard per-request deadlines, a 110s time
-- budget, and replies 202 at once while scraping in the background.
--
-- 28 orgs → 7 batches of 4 (batch=0…6). The old schedule had ~30 jobs
-- (greenhouse-*, gh-scraper-*), most re-running the same orgs. This
-- replaces them with each batch twice a day (morning run + afternoon
-- retry; already-imported jobs are skipped in under a second).
--
-- Run STEP 1 (preview), then STEP 2. Reuses your existing secret key.
-- If you add orgs later: batches = ceil(orgs / 4); add rows below.
-- ============================================================

-- STEP 1 — preview: the Greenhouse jobs that will be replaced
SELECT jobname, schedule FROM cron.job
WHERE command LIKE '%functions/v1/greenhouse-scraper%'
ORDER BY jobname;


-- STEP 2 — replace them
DO $$
DECLARE
  k    text;
  url  text := 'https://vqchwioyhyiuunpyildz.supabase.co/functions/v1/greenhouse-scraper?batch=';
  j    record;
  b    int;
BEGIN
  SELECT substring(command from 'sb_secret_[A-Za-z0-9_-]+') INTO k
  FROM cron.job WHERE command LIKE '%sb_secret_%' LIMIT 1;
  IF k IS NULL THEN RAISE EXCEPTION 'No secret key found in existing cron jobs'; END IF;

  FOR j IN SELECT jobname FROM cron.job WHERE command LIKE '%functions/v1/greenhouse-scraper%' LOOP
    PERFORM cron.unschedule(j.jobname);
  END LOOP;

  FOR b IN 0..6 LOOP
    -- 05:00, 05:05 … 05:30 UTC, and a retry at 13:00, 13:05 … 13:30 UTC
    PERFORM cron.schedule(format('greenhouse-b%s', b), format('%s 5 * * *', b * 5), format(
      $f$SELECT net.http_post(url := %L, headers := jsonb_build_object('Authorization', %L, 'Content-Type', 'application/json'), body := '{}'::jsonb, timeout_milliseconds := 30000)$f$,
      url || b, 'Bearer ' || k));
    PERFORM cron.schedule(format('greenhouse-retry-b%s', b), format('%s 13 * * *', b * 5), format(
      $f$SELECT net.http_post(url := %L, headers := jsonb_build_object('Authorization', %L, 'Content-Type', 'application/json'), body := '{}'::jsonb, timeout_milliseconds := 30000)$f$,
      url || b, 'Bearer ' || k));
  END LOOP;
END $$;

-- Check: should list greenhouse-b0…b6 and greenhouse-retry-b0…b6 (14 rows)
-- SELECT jobname, schedule FROM cron.job WHERE command LIKE '%greenhouse-scraper%' ORDER BY jobname;
