-- ============================================================
-- AFRORAMA — clean up UN Volunteer roles recorded as unpaid (2026-10-18)
-- unv-scraper used to store the salary text "Volunteer role" when a
-- posting didn't quote the Volunteer Living Allowance, and that text
-- was recorded in salary_submissions as $0 / unpaid. UNV roles always
-- pay an allowance, so these are "amount unknown", not unpaid.
-- (The re-parse backfill fixed 0 rows: there was no figure to recover.)
-- Run each step in the Supabase SQL Editor.
-- ============================================================

-- STEP 1 — preview: how many unpaid salary records come from UNV
-- listings that have no figure in their salary text?
SELECT count(*) AS will_delete
FROM public.salary_submissions s
JOIN public.listings l
  ON  lower(s.company)  = lower(l.organisation)
  AND lower(s.position) = lower(l.title)
  AND lower(coalesce(s.country, '')) = lower(coalesce(l.country, ''))
WHERE s.unpaid = true
  AND l.source = 'UNV'
  AND coalesce(l.salary, '') !~ '[0-9]';

-- STEP 2 — remove those records and relabel the listings the same way
-- other scrapers mark "no figure stated" ("See listing").
BEGIN;

DELETE FROM public.salary_submissions s
USING public.listings l
WHERE s.unpaid = true
  AND l.source = 'UNV'
  AND coalesce(l.salary, '') !~ '[0-9]'
  AND lower(s.company)  = lower(l.organisation)
  AND lower(s.position) = lower(l.title)
  AND lower(coalesce(s.country, '')) = lower(coalesce(l.country, ''));

UPDATE public.listings
SET salary = 'See listing'
WHERE source = 'UNV'
  AND coalesce(salary, '') !~ '[0-9]'
  AND salary IS DISTINCT FROM 'See listing';

COMMIT;
