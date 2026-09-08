/**
 * Afrorama — resume-checkout Edge Function
 *
 * Lets someone who abandoned a job_listing Stripe Checkout pick up right
 * where they left off, without re-filling the post.html form. This is the
 * link opened by the reminder email sent from listing-abandoned-notify.
 *
 * GET /resume-checkout?id=<listing id>
 *   1. Looks up the listing (must exist, be a paid_listing, not already
 *      confirmed, and not past its deadline).
 *   2. Opens a fresh Stripe Checkout session for it — same price and
 *      metadata.userId convention as create-checkout, so the existing
 *      stripe-webhook handler flips payment_confirmed on success with no
 *      changes needed there.
 *   3. 302-redirects the browser straight to Stripe.
 *
 * Deploy (must allow an unauthenticated GET straight from an email link):
 *   supabase functions deploy resume-checkout --no-verify-jwt
 */

import Stripe from 'npm:stripe@14';
import { createClient } from 'npm:@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
});

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// Kept in sync with create-checkout/index.ts's PRICE_IDS.job_listing
const JOB_LISTING_PRICE_ID = 'price_1TigyKDSZgGHFDqFLs3p1B5l';
const SITE_URL = 'https://www.afrorama.org';

function redirect(url: string) {
  return new Response(null, { status: 302, headers: { Location: url } });
}

Deno.serve(async (req: Request) => {
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return redirect(`${SITE_URL}/post.html`);

  const { data: listing, error } = await supabase
    .from('listings')
    .select('id, deadline, contact_email, paid_listing, payment_confirmed')
    .eq('id', id)
    .single();

  if (error || !listing || !listing.paid_listing) {
    return redirect(`${SITE_URL}/post.html`);
  }

  // Already paid in the meantime — nothing to resume.
  if (listing.payment_confirmed) {
    return redirect(`${SITE_URL}/opportunities.html?job=${encodeURIComponent(id)}`);
  }

  // Deadline already passed — the saved details are stale, start fresh.
  const today = new Date().toISOString().split('T')[0];
  if (listing.deadline && listing.deadline < today) {
    return redirect(`${SITE_URL}/post.html?expired=1`);
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: JOB_LISTING_PRICE_ID, quantity: 1 }],
      customer_email: listing.contact_email || undefined,
      metadata: { type: 'job_listing', userId: id },
      success_url: `${SITE_URL}/payment-success.html?type=job_listing&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${SITE_URL}/payment-cancelled.html`,
      allow_promotion_codes: true,
    });
    return redirect(session.url!);
  } catch (err) {
    console.error('[resume-checkout]', err);
    return redirect(`${SITE_URL}/post.html`);
  }
});
