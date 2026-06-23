-- Fixes the live bug where anonymous visitors (post.html) cannot post a
-- job listing at all: `anon` has no INSERT grant on `listings`, and a
-- blanket GRANT would let anyone fake payment_confirmed=true directly via
-- the public REST API, bypassing Stripe entirely. Instead, this RPC lets
-- anon insert ONLY through a controlled function that forces
-- payment_confirmed server-side based on paid_listing — callers can never
-- set it themselves.

CREATE OR REPLACE FUNCTION public.submit_listing(
  p_id            text,
  p_title         text,
  p_organisation  text,
  p_type          text,
  p_sector        text,
  p_location      text,
  p_country       text,
  p_deadline      date,
  p_salary        text,
  p_apply_url     text,
  p_description   text,
  p_requirements  text,
  p_contact_email text,
  p_paid_listing  boolean
)
RETURNS text AS $$
  INSERT INTO public.listings (
    id, title, organisation, type, sector, location, country, deadline,
    salary, apply_url, description, requirements, contact_email,
    posted, source, paid_listing, payment_confirmed, views, apply_clicks
  ) VALUES (
    p_id, p_title, p_organisation, p_type, p_sector, p_location, p_country, p_deadline,
    p_salary, p_apply_url, p_description, p_requirements, p_contact_email,
    CURRENT_DATE, 'Direct', p_paid_listing, NOT p_paid_listing, 0, 0
  )
  RETURNING id;
$$ LANGUAGE sql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.submit_listing(
  text, text, text, text, text, text, text, date, text, text, text, text, text, boolean
) TO anon, authenticated;
