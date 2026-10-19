-- ============================================================
-- AFRORAMA — data integrity fix (2026-10-19)
--
-- 1. Scrapers re-submitted every listing's salary on each daily run, so
--    ~87% of salary_submissions were duplicates (one fellowship x114),
--    skewing Salary Intelligence.
-- 2. Scrapers upsert with views = 0, apply_clicks = 0 and posted = today,
--    resetting counters and making old jobs look newly posted.
--
-- Fixed in the database (one place) rather than in ~30 scrapers.
-- Run STEP 1, then STEP 2, then STEP 3 in the Supabase SQL Editor.
-- ============================================================


-- ── STEP 1 — preview (changes nothing) ──────────────────────
SELECT
  (SELECT count(*) FROM public.salary_submissions) AS salary_records_now,
  (SELECT count(*) FROM (
     SELECT DISTINCT lower(trim(company)), lower(trim(position)), coalesce(country, ''), salary, unpaid
     FROM public.salary_submissions) x)            AS salary_records_after,
  (SELECT count(*) FROM public.listings
    WHERE posted > created_at::date)               AS listings_with_reset_posted_date;


-- ── STEP 2 — fix (all or nothing) ───────────────────────────
BEGIN;

-- 2a. Remove duplicate salary records, keeping the first of each
DELETE FROM public.salary_submissions s
USING (
  SELECT id, row_number() OVER (
    PARTITION BY lower(trim(company)), lower(trim(position)), coalesce(country, ''), salary, unpaid
    ORDER BY created_at, id) AS rn
  FROM public.salary_submissions
) d
WHERE s.id = d.id AND d.rn > 1;

-- 2b. From now on, silently skip a salary record identical to one already stored
CREATE INDEX IF NOT EXISTS salary_submissions_dedupe_idx
  ON public.salary_submissions (lower(trim(company)), lower(trim(position)));

CREATE OR REPLACE FUNCTION public.skip_duplicate_salary()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.salary_submissions s
    WHERE lower(trim(s.company))  = lower(trim(NEW.company))
      AND lower(trim(s.position)) = lower(trim(NEW.position))
      AND coalesce(s.country, '') = coalesce(NEW.country, '')
      AND s.salary IS NOT DISTINCT FROM NEW.salary
      AND s.unpaid IS NOT DISTINCT FROM NEW.unpaid
  ) THEN
    RETURN NULL;  -- skip the insert, no error
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS salary_skip_duplicates ON public.salary_submissions;
CREATE TRIGGER salary_skip_duplicates
  BEFORE INSERT ON public.salary_submissions
  FOR EACH ROW EXECUTE FUNCTION public.skip_duplicate_salary();

-- 2c. Scraper refreshes can no longer reset counters or move the posted date later
CREATE OR REPLACE FUNCTION public.keep_listing_counters()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.views        := GREATEST(COALESCE(NEW.views, 0),        COALESCE(OLD.views, 0));
  NEW.apply_clicks := GREATEST(COALESCE(NEW.apply_clicks, 0), COALESCE(OLD.apply_clicks, 0));
  IF OLD.posted IS NOT NULL AND (NEW.posted IS NULL OR NEW.posted > OLD.posted) THEN
    NEW.posted := OLD.posted;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS listings_keep_counters ON public.listings;
CREATE TRIGGER listings_keep_counters
  BEFORE UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.keep_listing_counters();

-- 2d. Restore lost counts from the view / apply event logs
UPDATE public.listings l SET views = v.n
FROM (SELECT listing_id, count(*) AS n FROM public.view_events GROUP BY listing_id) v
WHERE l.id = v.listing_id AND v.n > COALESCE(l.views, 0);

UPDATE public.listings l SET apply_clicks = a.n
FROM (SELECT listing_id, count(*) AS n FROM public.apply_events GROUP BY listing_id) a
WHERE l.id = a.listing_id AND a.n > COALESCE(l.apply_clicks, 0);

-- 2e. Restore posted dates: a listing can't have been posted after we first saw it
UPDATE public.listings SET posted = created_at::date
WHERE posted > created_at::date;

COMMIT;


-- ── STEP 3 — check ──────────────────────────────────────────
SELECT
  (SELECT count(*) FROM public.salary_submissions)                       AS salary_records,
  (SELECT count(*) FROM public.listings WHERE posted > created_at::date) AS reset_posted_dates_left,
  (SELECT count(*) FROM public.listings WHERE views > 0)                 AS listings_with_views;
