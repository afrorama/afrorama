-- ============================================================
-- AFRORAMA — classify consultancies from the job title (2026-10-27)
--
-- ReliefWeb, ReliefWeb Europe, Breezy, Recruitee, SmartRecruiters and
-- Uncommon save every role as "jobs", so titles like "Website Redesign
-- and Development Consultancy" were listed under Jobs.
-- Like internship-classification.sql, one trigger on listings now
-- decides from the title on every insert or title change.
--
-- Run STEP 1 (preview), then STEP 2 in the Supabase SQL Editor.
-- ============================================================

-- Consultancy words: EN / FR / ES / PT ("consultant", "consultancy",
-- "consultante", "consultor", "consultoria"). Not "consulting" or
-- "consultation", which name staff roles ("Consulting Manager",
-- "Community Consultation Officer").
CREATE OR REPLACE FUNCTION public.is_consultancy_title(t text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(t, '') ~* '(consultan|consultor)';
$$;


-- ── STEP 1 — preview (changes nothing) ──────────────────────
SELECT type AS was, source, title
FROM public.listings
WHERE public.is_consultancy_title(title)
  AND type = 'jobs'
ORDER BY source, title;


-- ── STEP 2 — fix existing listings and add the rule ─────────
BEGIN;

UPDATE public.listings SET type = 'consultancy'
WHERE public.is_consultancy_title(title) AND type = 'jobs';

-- Only "jobs" becomes consultancy: internships (set by the internship
-- trigger, which runs after this one) and fellowships keep their type.
CREATE OR REPLACE FUNCTION public.set_consultancy_type()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.type = 'jobs' AND public.is_consultancy_title(NEW.title) THEN
    NEW.type := 'consultancy';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS listings_consultancy_type ON public.listings;
CREATE TRIGGER listings_consultancy_type
  BEFORE INSERT OR UPDATE OF title, type ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.set_consultancy_type();

COMMIT;
