/* ===== AFRORAMA STRIPE PAYMENTS =====
 *
 * TWO SETUP OPTIONS — choose one:
 *
 * ── Option A: Stripe Payment Links (no backend, 5-minute setup) ──
 *  1. stripe.com → Products → create the 4 products listed below
 *  2. For each, click "Create payment link" in the product page
 *  3. Paste the resulting buy.stripe.com/... URLs into PAYMENT_LINKS below
 *  Done. No code changes, no server needed.
 *
 * ── Option B: Stripe Checkout via Supabase Edge Functions (recommended) ──
 *  1. Add secrets to your Supabase project:
 *       supabase secrets set STRIPE_SECRET_KEY=sk_live_...
 *       supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
 *  2. Create Price IDs in Stripe → paste into create-checkout/index.ts
 *  3. Deploy Edge Functions:
 *       supabase functions deploy create-checkout
 *       supabase functions deploy stripe-webhook
 *  4. In Stripe Dashboard → Webhooks → Add endpoint:
 *       URL: https://YOUR_PROJECT.supabase.co/functions/v1/stripe-webhook
 *       Events: checkout.session.completed, customer.subscription.deleted
 *  5. Paste your project URL in CHECKOUT_ENDPOINT below
 *
 * ── Products to create in Stripe ──
 *  • Afrorama Membership     — coming soon   (not launching yet)
 *  • No Wahala CV Boost      — $3            (one-time)
 *  • Office Hours session    — $49           (one-time)
 *  • Job listing             — $29           (one-time)
 */

/* ── YOUR KEYS ─────────────────────────────────────────────────── */
const STRIPE_PUBLISHABLE_KEY = 'pk_live_51TZvW0DSZgGHFDqFIn2iw3nZZIdh6ZQmfzVDuaULIXVZ0xc94d8pnPCOC93L4hUVpeKRMSvvm2e5Gs9ghfZzIrFx00OZABCBp9';

/* ── OPTION A: Payment Link URLs ──────────────────────────────── */
const PAYMENT_LINKS = {
  membership:   'https://buy.stripe.com/YOUR_MEMBERSHIP_LINK',
  cv_boost:     'https://buy.stripe.com/YOUR_CV_BOOST_LINK',
  office_hours: 'https://buy.stripe.com/YOUR_OFFICE_HOURS_LINK',
  job_listing:  'https://buy.stripe.com/YOUR_JOB_LISTING_LINK',
};

/* ── OPTION B: Supabase Edge Function URL ──────────────────────── */
const CHECKOUT_ENDPOINT = 'https://vqchwioyhyiuunpyildz.supabase.co/functions/v1/create-checkout';

/* ── Calendly link for Office Hours booking (shown after payment) ── */
const CALENDLY_OFFICE_HOURS = 'https://calendly.com/hello-afrorama';

/* ================================================================
   INTERNAL HELPERS
================================================================= */
function _isConfigured()      { return !STRIPE_PUBLISHABLE_KEY.includes('YOUR'); }
function _hasLink(type)       { return PAYMENT_LINKS[type] && !PAYMENT_LINKS[type].includes('YOUR'); }
function _hasEndpoint()       { return !CHECKOUT_ENDPOINT.includes('YOUR'); }
function _isDemo()            { return !_isConfigured() && !_hasLink('membership') && !_hasEndpoint(); }

const PRICE_LABELS = {
  membership:   'Afrorama Membership — coming soon',
  cv_boost:     'No Wahala CV Boost — $3',
  office_hours: 'Office Hours session — $49',
  job_listing:  'Job listing — $29',
};

/* ── Option A: redirect to Payment Link ── */
async function _payLink(type, userId) {
  let url = PAYMENT_LINKS[type];
  const params = new URLSearchParams();
  if (userId) params.set('client_reference_id', userId);
  params.set('success_url',
    encodeURIComponent(window.location.origin + '/payment-success.html?type=' + type));
  url += '?' + params.toString();
  window.location.href = url;
}

/* ── Option B: Stripe Checkout via Edge Function ── */
async function _payCheckout(type, userId, userEmail) {
  const sb      = window.AfroramaSupabase?.getSupabase();
  const session = await sb?.auth.getSession();
  const token   = session?.data?.session?.access_token || '';

  const res = await fetch(CHECKOUT_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token,
    },
    body: JSON.stringify({
      type, userId, userEmail,
      origin: window.location.origin,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Checkout request failed (HTTP ' + res.status + ')');
  }

  const { url, error } = await res.json();
  if (error) throw new Error(error);
  window.location.href = url;
}

/* ================================================================
   PUBLIC API
================================================================= */

/**
 * Trigger a Stripe payment for the given type.
 *
 * @param {string}   type          – 'membership' | 'cv_boost' | 'office_hours' | 'job_listing'
 * @param {object}   opts
 * @param {string}   opts.userId   – Supabase user ID (for client_reference_id)
 * @param {string}   opts.userEmail
 * @param {Function} opts.onDemo   – callback when running in demo mode (no Stripe configured)
 * @param {Function} opts.onError  – callback on payment error
 */
async function pay(type, opts = {}) {
  const { userId, userEmail, onDemo, onError } = opts;

  // Demo mode: nothing configured
  if (_isDemo()) {
    if (onDemo) {
      onDemo();
    } else {
      alert(
        'Stripe is not yet configured.\n\n' +
        'To accept real payments:\n' +
        '1. Create the products in your Stripe dashboard\n' +
        '2. Paste Payment Link URLs into js/stripe.js (quick option)\n' +
        '   — OR —\n' +
        '3. Deploy the Supabase Edge Functions and paste the endpoint URL\n\n' +
        'See the setup instructions at the top of js/stripe.js'
      );
    }
    return;
  }

  try {
    // Prefer Payment Link if available (simplest, no backend needed)
    if (_hasLink(type)) {
      await _payLink(type, userId);
      return;
    }

    // Fall back to Checkout Session via Edge Function
    if (_hasEndpoint()) {
      await _payCheckout(type, userId, userEmail);
      return;
    }

    alert('Stripe Payment Link for "' + (PRICE_LABELS[type] || type) + '" is not configured yet.\n\nAdd it to js/stripe.js → PAYMENT_LINKS.');

  } catch (err) {
    console.error('[Stripe]', err);
    if (onError) {
      onError(err);
    } else {
      alert('Payment error: ' + err.message);
    }
  }
}

/** Returns the Calendly URL for Office Hours booking (shown on success page) */
function getCalendlyUrl() {
  return CALENDLY_OFFICE_HOURS;
}

/** Returns true if at least one payment method is configured */
function isReady() {
  return !_isDemo();
}

window.AfroramaStripe = { pay, getCalendlyUrl, isReady };
