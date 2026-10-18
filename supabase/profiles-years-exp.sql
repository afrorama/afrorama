-- ============================================================
-- AFRORAMA — profiles.years_exp (2026-10-18)
-- profile.html saves "Years of experience" as years_exp, but the
-- column never existed, so every profile save failed.
-- Run once in the Supabase SQL Editor.
-- ============================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS years_exp TEXT;

-- Users may set it on their own profile (see security-hardening.sql B2)
GRANT INSERT (years_exp), UPDATE (years_exp) ON public.profiles TO authenticated;
