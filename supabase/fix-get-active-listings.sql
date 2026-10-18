-- ============================================================
-- AFRORAMA — get_active_listings() speed fix (2026-10-18)
-- The security-hardening version (A1) stripped private columns
-- with to_jsonb/jsonb_populate_record per row, which pushed the
-- call to ~4s and caused statement timeouts on the homepage.
-- This selects columns directly (same speed as the original) and
-- returns NULL for the private ones. Column order must match the
-- listings table; (NULL::listings).col gives a correctly typed NULL.
-- If you add a column to listings, add it here in the same position.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_active_listings()
RETURNS SETOF public.listings
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    l.id, l.title, l.organisation, l.type, l.sector, l.location, l.country,
    l.deadline, l.posted, l.salary, l.description, l.requirements, l.apply_url,
    l.bitly_url, l.utm_url, l.source, l.views, l.apply_clicks, l.paid_listing,
    l.created_at, l.org_domain, l.experience, l.payment_confirmed,
    (NULL::public.listings).contact_email,
    (NULL::public.listings).expiry_notified,
    (NULL::public.listings).live_notified,
    (NULL::public.listings).abandoned_notified,
    (NULL::public.listings).payment_confirmed_at
  FROM public.listings l
  WHERE (l.deadline >= CURRENT_DATE OR l.deadline IS NULL)
    AND (l.paid_listing = false OR l.payment_confirmed = true)
  ORDER BY l.created_at DESC;
$$;
