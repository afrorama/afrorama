-- ============================================================
-- AFRORAMA — classify internships from the job title (2026-10-20)
--
-- Scrapers each guess the type with their own rules, which missed French
-- titles ("Stagiaire …", "Stage de …") and, by matching "intern" anywhere,
-- typed "International Protection Officer" as an internship.
-- One trigger on listings now decides from the title on every insert or
-- title change, whichever scraper or form saved it.
--
-- Run STEP 1 (preview), then STEP 2 in the Supabase SQL Editor.
-- ============================================================

-- Internship words, as whole words: EN / FR / ES / PT.
-- "stage" only in French phrasing ("Stage de…", or at the start) so English
-- "early-stage" doesn't match; "apprenti" not "apprentissage" (= learning).
CREATE OR REPLACE FUNCTION public.is_internship_title(t text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(t, '') ~* (
    '(stagiaire|\minterns?\M|internship|trainee|\mattachment\M|alternance|'
    || '\mapprenti(e|s|es)?\M|apprentice|pasant|estagi|'
    || '^\s*stages?\M|\mstages? (de|en|au|à|d'')|\mstage professionnel)'
  )
  AND coalesce(t, '') !~* 'fellow';   -- fellowships stay "Fellowship"
$$;


-- ── STEP 1 — preview (changes nothing) ──────────────────────
SELECT 'becomes internship' AS change, type AS was, title
FROM public.listings
WHERE public.is_internship_title(title) AND type <> 'internship'
UNION ALL
SELECT 'no longer internship', type, title
FROM public.listings
WHERE type = 'internship'
  AND title ~* '\minternational\M'
  AND NOT public.is_internship_title(title)
  AND title !~* 'volunt|volont'
  AND coalesce(source, '') <> 'UNV'
ORDER BY 1, 3;


-- ── STEP 2 — fix existing listings and add the rule ─────────
BEGIN;

UPDATE public.listings SET type = 'internship'
WHERE public.is_internship_title(title) AND type <> 'internship';

UPDATE public.listings
SET type = CASE WHEN title ~* 'consultan' THEN 'consultancy' ELSE 'jobs' END
WHERE type = 'internship'
  AND title ~* '\minternational\M'
  AND NOT public.is_internship_title(title)
  AND title !~* 'volunt|volont'
  AND coalesce(source, '') <> 'UNV';

CREATE OR REPLACE FUNCTION public.set_internship_type()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF public.is_internship_title(NEW.title) THEN
    NEW.type := 'internship';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS listings_internship_type ON public.listings;
CREATE TRIGGER listings_internship_type
  BEFORE INSERT OR UPDATE OF title, type ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.set_internship_type();

COMMIT;
