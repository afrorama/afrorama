/**
 * Afrorama — monthly-report Edge Function
 *
 * Runs on the 1st of each month. Emails hello@afrorama.org a summary of
 * the previous calendar month: new listings posted, paid listings +
 * revenue, and apply-click growth.
 *
 * "Views" is intentionally not included — it is not tracked anywhere
 * server-side (only a stale localStorage field in an old admin page), so
 * reporting it would mean inventing a number. apply_clicks is a running
 * counter with no per-event timestamp, so click growth is measured by
 * diffing against the previous month's snapshot in analytics_snapshots.
 *
 * Deploy: supabase functions deploy monthly-report
 *
 * Schedule (1st of each month, 9am UTC — covers the month that just ended):
 *   SELECT cron.schedule('monthly-report', '0 9 1 * *',
 *     $$SELECT net.http_post(
 *       url := 'https://vqchwioyhyiuunpyildz.supabase.co/functions/v1/monthly-report',
 *       headers := '{"Authorization":"Bearer SERVICE_ROLE_KEY","Content-Type":"application/json"}'::jsonb,
 *       body := '{}'::jsonb,
 *       timeout_milliseconds := 30000
 *     )$$);
 *
 * Requires one table (run once in SQL Editor):
 *   CREATE TABLE IF NOT EXISTS public.analytics_snapshots (
 *     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *     captured_at TIMESTAMPTZ DEFAULT NOW(),
 *     total_apply_clicks BIGINT NOT NULL
 *   );
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const RESEND_API_KEY  = Deno.env.get('RESEND_API_KEY') || '';
const FROM_EMAIL       = 'hello@afrorama.org';
const TO_EMAIL         = 'hello@afrorama.org';
const SITE_URL         = 'https://www.afrorama.org';
const JOB_LISTING_PRICE = 29;

async function sendEmail(subject: string, html: string) {
  if (!RESEND_API_KEY) {
    console.log(`[monthly-report] RESEND_API_KEY not set — would send: ${subject}`);
    return true;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_EMAIL, to: TO_EMAIL, subject, html }),
  });
  if (!res.ok) {
    console.error('[monthly-report] Email send failed:', await res.text());
    return false;
  }
  return true;
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function emailHTML(opts: {
  label: string; newListings: number; paidListings: number; revenue: number;
  clickGrowth: number | null; topListings: { title: string; organisation: string; apply_clicks: number }[];
}): string {
  const { label, newListings, paidListings, revenue, clickGrowth, topListings } = opts;
  const topRows = topListings.length
    ? topListings.map((l, i) => `
      <tr>
        <td style="padding:8px 0;color:#1a1a1a;font-size:.9rem;">${i + 1}. ${l.title} — <span style="color:#888;">${l.organisation}</span></td>
        <td style="padding:8px 0;text-align:right;color:#1a1a1a;font-size:.9rem;font-weight:700;">${l.apply_clicks} clicks</td>
      </tr>`).join('')
    : `<tr><td colspan="2" style="padding:8px 0;color:#888;font-size:.9rem;">No listings posted this month.</td></tr>`;

  return `
<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="font-family:Inter,Arial,sans-serif;background:#F6F5F2;padding:40px 20px;margin:0;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:2.5px solid #1a1a1a;border-radius:16px;padding:36px;">
    <p style="font-size:.78rem;letter-spacing:.06em;text-transform:uppercase;color:#888;margin:0 0 6px;">Monthly report</p>
    <h1 style="font-size:1.4rem;margin:0 0 18px;color:#1a1a1a;">Afrorama — ${label}</h1>

    <div style="display:flex;gap:16px;margin:24px 0;">
      <div style="flex:1;background:#F6F5F2;border-radius:10px;padding:16px;text-align:center;">
        <div style="font-size:1.6rem;font-weight:800;color:#1a1a1a;">${newListings}</div>
        <div style="font-size:.74rem;color:#888;">New listings</div>
      </div>
      <div style="flex:1;background:#F6F5F2;border-radius:10px;padding:16px;text-align:center;">
        <div style="font-size:1.6rem;font-weight:800;color:#1a1a1a;">${paidListings}</div>
        <div style="font-size:.74rem;color:#888;">Paid listings</div>
      </div>
      <div style="flex:1;background:#F6F5F2;border-radius:10px;padding:16px;text-align:center;">
        <div style="font-size:1.6rem;font-weight:800;color:#1a1a1a;">$${revenue}</div>
        <div style="font-size:.74rem;color:#888;">Revenue</div>
      </div>
    </div>

    <p style="color:#333;line-height:1.6;font-size:.95rem;">
      ${clickGrowth === null
        ? 'This is the first report — apply-click growth will be tracked starting next month.'
        : `Apply clicks across the platform grew by <strong>${clickGrowth}</strong> this month.`}
    </p>

    <h2 style="font-size:1rem;color:#1a1a1a;margin:24px 0 8px;">Top listings posted this month</h2>
    <table style="width:100%;border-collapse:collapse;">${topRows}</table>

    <div style="margin:28px 0;text-align:center;">
      <a href="${SITE_URL}/opportunities.html" style="display:inline-block;background:#FFE400;color:#1a1a1a;font-weight:800;padding:12px 28px;border-radius:100px;border:2px solid #1a1a1a;text-decoration:none;">View live board</a>
    </div>
  </div>
</body></html>`;
}

Deno.serve(async () => {
  console.log('[monthly-report] Starting...');

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const label = monthLabel(lastMonthStart);

  const { data: monthListings, error: listErr } = await supabase
    .from('listings')
    .select('title, organisation, paid_listing, payment_confirmed, apply_clicks, created_at')
    .gte('created_at', lastMonthStart.toISOString())
    .lt('created_at', thisMonthStart.toISOString());

  if (listErr) {
    console.error('[monthly-report] Listings query failed:', listErr.message);
    return Response.json({ error: listErr.message }, { status: 500 });
  }

  const newListings  = monthListings?.length || 0;
  const paidListings = (monthListings || []).filter(l => l.paid_listing && l.payment_confirmed).length;
  const revenue       = paidListings * JOB_LISTING_PRICE;

  const topListings = [...(monthListings || [])]
    .sort((a, b) => (b.apply_clicks || 0) - (a.apply_clicks || 0))
    .slice(0, 5)
    .map(l => ({ title: l.title, organisation: l.organisation, apply_clicks: l.apply_clicks || 0 }));

  // Click growth = diff against the last snapshot's total.
  const { data: allListings, error: clicksErr } = await supabase
    .from('listings')
    .select('apply_clicks');
  if (clicksErr) {
    console.error('[monthly-report] Click totals query failed:', clicksErr.message);
    return Response.json({ error: clicksErr.message }, { status: 500 });
  }
  const totalApplyClicksNow = (allListings || []).reduce((sum, l) => sum + (l.apply_clicks || 0), 0);

  const { data: lastSnapshot } = await supabase
    .from('analytics_snapshots')
    .select('total_apply_clicks')
    .order('captured_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const clickGrowth = lastSnapshot ? totalApplyClicksNow - lastSnapshot.total_apply_clicks : null;

  await supabase.from('analytics_snapshots').insert({ total_apply_clicks: totalApplyClicksNow });

  const ok = await sendEmail(
    `Afrorama — ${label} report`,
    emailHTML({ label, newListings, paidListings, revenue, clickGrowth, topListings }),
  );

  console.log(`[monthly-report] Done. Sent: ${ok}, newListings: ${newListings}, paidListings: ${paidListings}`);
  return Response.json({ sent: ok, newListings, paidListings, revenue, clickGrowth });
});
