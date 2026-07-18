/**
 * Afrorama — create-checkout Edge Function
 *
 * Creates a Stripe Checkout Session and returns the redirect URL.
 *
 * Deploy:
 *   supabase functions deploy create-checkout
 *
 * Required secrets (set via `supabase secrets set KEY=value`):
 *   STRIPE_SECRET_KEY   — sk_live_... or sk_test_...
 *
 * Required env vars (auto-provided by Supabase):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * ── Stripe Price IDs ─────────────────────────────────────────────
 * Create these in your Stripe dashboard (Products → Add product)
 * then paste the price_... IDs below.
 */

import Stripe from 'npm:stripe@14';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
});

// ── Paste your Stripe Price IDs here ──────────────────────────────
const PRICE_IDS: Record<string, string> = {
  membership:   'price_1TuUbqDSZgGHFDqFxWmgEvYt',    // Afrorama Membership — $9/month
  cv_boost:     'price_1TigwyDSZgGHFDqF5qDqOnyM',   // No Wahala CV Boost — $3
  office_hours: 'price_1TigzPDSZgGHFDqFTxYo93oK',   // Office Hours — $49
  job_listing:  'price_1TigyKDSZgGHFDqFLs3p1B5l',   // Job listing — $29
};

// Types that use subscription mode (recurring billing)
const RECURRING = new Set(['membership']);

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { type, userId, userEmail, origin } = await req.json() as {
      type: string;
      userId?: string;
      userEmail?: string;
      origin: string;
    };

    // Validate type
    if (!PRICE_IDS[type]) {
      return Response.json(
        { error: `Unknown payment type: ${type}` },
        { status: 400, headers: corsHeaders },
      );
    }

    if (PRICE_IDS[type].includes('YOUR')) {
      return Response.json(
        { error: `Price ID for "${type}" is not configured. Edit supabase/functions/create-checkout/index.ts.` },
        { status: 400, headers: corsHeaders },
      );
    }

    const isRecurring = RECURRING.has(type);

    const session = await stripe.checkout.sessions.create({
      mode: isRecurring ? 'subscription' : 'payment',
      line_items: [{ price: PRICE_IDS[type], quantity: 1 }],

      // Attach the Supabase user ID so the webhook can update the profile
      client_reference_id: userId ?? undefined,
      customer_email:      userEmail ?? undefined,

      // Stored on the session so the webhook knows what to do
      metadata: { type, userId: userId ?? '' },

      // Redirect URLs — the frontend handles confirmation
      success_url: `${origin}/payment-success.html?type=${type}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${origin}/payment-cancelled.html`,

      // Allow discount codes if you create them in Stripe
      allow_promotion_codes: true,

      // Subscription-specific: let members manage billing themselves
      ...(isRecurring && {
        subscription_data: {
          metadata: { userId: userId ?? '' },
        },
      }),
    });

    return Response.json(
      { url: session.url },
      { headers: corsHeaders },
    );

  } catch (err) {
    console.error('[create-checkout]', err);
    return Response.json(
      { error: (err as Error).message },
      { status: 500, headers: corsHeaders },
    );
  }
});
