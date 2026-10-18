/**
 * Afrorama — listing-live-notify Edge Function
 *
 * Runs daily. Finds paid listings whose payment was confirmed in the last
 * 48 hours (payment_confirmed_at, set by stripe-webhook and
 * publish-admin-listing) that haven't had a live notification sent yet.
 * Emails the poster to confirm their listing is live, and BCCs TrustPilot to trigger an automatic
 * review invitation.
 *
 * Deploy:
 *   supabase functions deploy listing-live-notify
 *
 * Schedule daily at 9am UTC via pg_cron:
 *   SELECT cron.schedule('listing-live-notify-daily', '0 9 * * *',
 *     $$SELECT net.http_post(
 *       url := 'https://vqchwioyhyiuunpyildz.supabase.co/functions/v1/listing-live-notify',
 *       headers := '{"Authorization":"Bearer SERVICE_ROLE_KEY","Content-Type":"application/json"}'::jsonb,
 *       body := '{}'::jsonb
 *     )$$);
 *
 * Requires these columns on listings (run once in SQL Editor):
 *   ALTER TABLE listings ADD COLUMN IF NOT EXISTS contact_email TEXT;
 *   ALTER TABLE listings ADD COLUMN IF NOT EXISTS live_notified BOOLEAN DEFAULT false;
 *   ALTER TABLE listings ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMPTZ;
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const RESEND_API_KEY    = Deno.env.get('RESEND_API_KEY') || '';
const FROM_EMAIL        = 'hello@afrorama.org';
const SITE_URL          = 'https://www.afrorama.org';
const TRUSTPILOT_BCC    = 'afrorama.org+b4b2675f1a@invite.trustpilot.com';

const COUNTRY_NAMES: Record<string, string> = {
  DZ:'Algeria', AO:'Angola', BJ:'Benin', BW:'Botswana', BF:'Burkina Faso',
  BI:'Burundi', CV:'Cabo Verde', CM:'Cameroon', CF:'Central African Republic',
  TD:'Chad', KM:'Comoros', CD:'DR Congo', CG:'Republic of Congo', CI:"Côte d'Ivoire",
  DJ:'Djibouti', EG:'Egypt', GQ:'Equatorial Guinea', ER:'Eritrea', SZ:'Eswatini',
  ET:'Ethiopia', GA:'Gabon', GM:'Gambia', GH:'Ghana', GN:'Guinea', GW:'Guinea-Bissau',
  KE:'Kenya', LS:'Lesotho', LR:'Liberia', LY:'Libya', MG:'Madagascar', MW:'Malawi',
  ML:'Mali', MR:'Mauritania', MU:'Mauritius', MA:'Morocco', MZ:'Mozambique',
  NA:'Namibia', NE:'Niger', NG:'Nigeria', RW:'Rwanda', ST:'São Tomé and Príncipe',
  SN:'Senegal', SC:'Seychelles', SL:'Sierra Leone', SO:'Somalia', ZA:'South Africa',
  SS:'South Sudan', SD:'Sudan', TZ:'Tanzania', TG:'Togo', TN:'Tunisia', UG:'Uganda',
  ZM:'Zambia', ZW:'Zimbabwe',
};

const TYPE_LABELS: Record<string, string> = {
  jobs:        'Job',
  consultancy: 'Consultancy',
  internship:  'Internship',
  capacity:    'Fellowship / Capacity',
};

function formatDeadline(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.log(`[listing-live-notify] RESEND_API_KEY not set — would send to ${to}: ${subject}`);
    return true;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from:    FROM_EMAIL,
      to,
      bcc:     [FROM_EMAIL, TRUSTPILOT_BCC],
      subject,
      html,
    }),
  });
  if (!res.ok) {
    console.error('[listing-live-notify] Email send failed:', await res.text());
    return false;
  }
  return true;
}

function emailHTML(opts: {
  id: string;
  title: string;
  organisation: string;
  country: string | null;
  type: string | null;
  deadline: string | null;
}): string {
  const { id, title, organisation, country, type, deadline } = opts;

  const countryLabel  = country ? (COUNTRY_NAMES[country] ?? country) : null;
  const typeLabel     = type ? (TYPE_LABELS[type] ?? type) : null;
  const deadlineLabel = formatDeadline(deadline);

  const chips = [
    countryLabel  ? `<span class="chip">📍 ${countryLabel}</span>` : '',
    typeLabel     ? `<span class="chip">${typeLabel}</span>` : '',
    deadlineLabel ? `<span class="chip">Deadline: ${deadlineLabel}</span>` : '',
  ].filter(Boolean).join('');

  const listingUrl = `${SITE_URL}/opportunities.html?job=${encodeURIComponent(id)}`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    body { font-family: Inter, Arial, sans-serif; background: #F6F5F2; padding: 40px 20px; margin: 0; }
    .card { max-width: 560px; margin: 0 auto; background: #fff; border: 2.5px solid #1a1a1a; border-radius: 16px; padding: 36px 36px 32px; color: #1a1a1a; }
    .eyebrow { font-size: .72rem; letter-spacing: .08em; text-transform: uppercase; color: #888; margin: 0 0 6px; }
    h1 { font-size: 1.35rem; font-weight: 800; color: #1a1a1a; line-height: 1.25; margin: 0 0 20px; }
    .badge { display: inline-flex; align-items: center; gap: 6px; background: #ECFBEC; border: 1.5px solid #5EC95E; border-radius: 100px; padding: 4px 12px; font-size: .78rem; font-weight: 700; color: #1A7A1A; margin-bottom: 20px; }
    .dot { width: 7px; height: 7px; border-radius: 50%; background: #5EC95E; }
    p { font-size: .93rem; color: #333; line-height: 1.65; margin: 0 0 16px; }
    .listing-box { background: #F6F5F2; border-radius: 10px; padding: 16px 18px; margin: 20px 0; text-align: center; }
    .listing-label { font-size: .78rem; font-weight: 600; color: #888; letter-spacing: .05em; text-transform: uppercase; margin-bottom: 8px; }
    .listing-title { font-size: 1rem; font-weight: 800; color: #1a1a1a; margin-bottom: 2px; }
    .listing-org { font-size: .88rem; color: #555; margin-bottom: 10px; }
    .chips { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
    .chip { font-size: .74rem; color: #666; background: #fff; border: 1px solid #DDD; border-radius: 6px; padding: 3px 8px; font-weight: 500; }
    .what-next-label { font-size: .82rem; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: .06em; margin: 22px 0 10px; }
    .item { display: flex; gap: 10px; font-size: .88rem; color: #333; line-height: 1.5; margin-bottom: 8px; }
    .check { color: #5EC95E; flex-shrink: 0; margin-top: 1px; }
    .cta-wrap { margin: 26px 0 4px; text-align: center; }
    .cta { display: inline-block; background: #FFE400; color: #1a1a1a; font-weight: 800; font-size: .95rem; padding: 13px 32px; border-radius: 100px; border: 2px solid #1a1a1a; text-decoration: none; }
    hr { border: none; border-top: 1.5px solid #F0EEE9; margin: 24px 0; }
    .footer { font-size: .78rem; color: #aaa; line-height: 1.6; }
    .footer a { color: #888; }
    strong.brand { font-weight: 700; }
  </style>
</head>
<body>
  <div class="card">
    <p class="eyebrow">Listing confirmation</p>
    <h1>Your listing is live.</h1>

    <span class="badge">
      <span class="dot"></span>
      Active on afrorama
    </span>

    <p>Great news — your listing is now live on <strong class="brand">afrorama</strong>'s social impact job board, reaching thousands of Africa-focused professionals every week.</p>

    <div class="listing-box">
      <div class="listing-label">Your listing</div>
      <div class="listing-title">${title}</div>
      <div class="listing-org">${organisation}</div>
      <div class="chips">${chips}</div>
    </div>

    <div class="what-next-label">What happens next</div>

    <div class="item">
      <span class="check">✓</span>
      <span>Your listing is searchable on <a href="${SITE_URL}" style="color:#1a1a1a;font-weight:700;text-underline-offset:2px;"><strong class="brand">afrorama</strong></a> right now</span>
    </div>
    <div class="item">
      <span class="check">✓</span>
      <span>It will be featured in the next weekly newsletter to our 25k subscriber list</span>
    </div>
    <div class="item">
      <span class="check">✓</span>
      <span>It will be spotlighted on our LinkedIn to 38k followers</span>
    </div>
    <div class="item">
      <span class="check">✓</span>
      <span>When your listing closes, we'll email you a performance summary — views, apply clicks, and how you compared</span>
    </div>

    <div class="cta-wrap">
      <a href="${listingUrl}" class="cta">View your listing →</a>
    </div>

    <hr>

    <p class="footer">
      Questions? Reply to this email and we'll get back to you.<br><br>
      Thank you for posting with afrorama — Africa's social impact job board.<br>
      <a href="${SITE_URL}">afrorama.org</a>
    </p>
  </div>
</body>
</html>`;
}

Deno.serve(async () => {
  console.log('[listing-live-notify] Starting...');

  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const { data: listings, error } = await supabase
    .from('listings')
    .select('id, title, organisation, country, type, deadline, contact_email')
    .eq('paid_listing', true)
    .eq('payment_confirmed', true)
    .eq('live_notified', false)
    .gte('payment_confirmed_at', since)
    .not('contact_email', 'is', null);

  if (error) {
    console.error('[listing-live-notify] Query failed:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }

  let sent = 0, failed = 0;

  for (const l of listings || []) {
    const ok = await sendEmail(
      l.contact_email,
      `Your listing is now live on afrorama ✓`,
      emailHTML({
        id:           l.id,
        title:        l.title,
        organisation: l.organisation,
        country:      l.country,
        type:         l.type,
        deadline:     l.deadline,
      }),
    );

    if (ok) {
      await supabase.from('listings').update({ live_notified: true }).eq('id', l.id);
      console.log(`[listing-live-notify] Sent to ${l.contact_email} for listing ${l.id}`);
      sent++;
    } else {
      failed++;
    }
  }

  console.log(`[listing-live-notify] Done. Sent: ${sent}, Failed: ${failed}`);
  return Response.json({ sent, failed, checked: listings?.length || 0 });
});
