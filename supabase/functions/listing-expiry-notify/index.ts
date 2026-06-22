/**
 * Afrorama — listing-expiry-notify Edge Function
 *
 * Runs daily. Finds paid listings whose deadline was yesterday (i.e. just
 * expired) and emails the poster a professional summary of how their
 * listing performed (views, apply clicks), with a CTA to post again.
 * Aim: bring paid clients back to Afrorama.
 *
 * Deploy: supabase functions deploy listing-expiry-notify
 *
 * Schedule daily via pg_cron (run after listings have had a full day to
 * collect final view/click numbers):
 *   SELECT cron.schedule('listing-expiry-notify-daily', '0 9 * * *',
 *     $$SELECT net.http_post(
 *       url := 'https://vqchwioyhyiuunpyildz.supabase.co/functions/v1/listing-expiry-notify',
 *       headers := '{"Authorization":"Bearer SERVICE_ROLE_KEY","Content-Type":"application/json"}'::jsonb,
 *       body := '{}'::jsonb
 *     )$$);
 *
 * Requires two columns on listings (run once in SQL Editor):
 *   ALTER TABLE listings ADD COLUMN IF NOT EXISTS contact_email TEXT;
 *   ALTER TABLE listings ADD COLUMN IF NOT EXISTS expiry_notified BOOLEAN DEFAULT false;
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const FROM_EMAIL      = 'hello@afrorama.org';
const SITE_URL        = 'https://www.afrorama.org';

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) {
    console.log(`[listing-expiry-notify] RESEND_API_KEY not set — would send to ${to}: ${subject}`);
    return true;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });
  if (!res.ok) {
    console.error('[listing-expiry-notify] Email send failed:', await res.text());
    return false;
  }
  return true;
}

function performanceLine(views: number, clicks: number): string {
  if (views === 0) return "Your listing didn't pick up much visibility this time.";
  const rate = views > 0 ? Math.round((clicks / views) * 100) : 0;
  if (rate >= 15) return `That's a strong ${rate}% click-through rate — well above average for the platform.`;
  if (rate >= 5)  return `That's a solid ${rate}% click-through rate.`;
  return `That's a ${rate}% click-through rate — plenty of room to grow with a sharper title or description next time.`;
}

function emailHTML(opts: { title: string; organisation: string; views: number; clicks: number }): string {
  const { title, organisation, views, clicks } = opts;
  return `
<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="font-family:Inter,Arial,sans-serif;background:#F6F5F2;padding:40px 20px;margin:0;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:2.5px solid #1a1a1a;border-radius:16px;padding:36px;">
    <p style="font-size:.78rem;letter-spacing:.06em;text-transform:uppercase;color:#888;margin:0 0 6px;">Listing performance summary</p>
    <h1 style="font-size:1.4rem;margin:0 0 18px;color:#1a1a1a;">${title} at ${organisation}</h1>
    <p style="color:#333;line-height:1.6;font-size:.95rem;">Your listing's application window has now closed. Here's how it performed on Afrorama:</p>
    <div style="display:flex;gap:16px;margin:24px 0;">
      <div style="flex:1;background:#F6F5F2;border-radius:10px;padding:16px;text-align:center;">
        <div style="font-size:1.8rem;font-weight:800;color:#1a1a1a;">${views}</div>
        <div style="font-size:.78rem;color:#888;">Views</div>
      </div>
      <div style="flex:1;background:#F6F5F2;border-radius:10px;padding:16px;text-align:center;">
        <div style="font-size:1.8rem;font-weight:800;color:#1a1a1a;">${clicks}</div>
        <div style="font-size:.78rem;color:#888;">Apply clicks</div>
      </div>
    </div>
    <p style="color:#333;line-height:1.6;font-size:.95rem;">${performanceLine(views, clicks)}</p>
    <p style="color:#333;line-height:1.6;font-size:.95rem;">Thousands of Africa-focused social impact professionals check Afrorama every week. If you're hiring again, your next listing could reach them too.</p>
    <div style="margin:28px 0;text-align:center;">
      <a href="${SITE_URL}/post.html" style="display:inline-block;background:#FFE400;color:#1a1a1a;font-weight:800;padding:12px 28px;border-radius:100px;border:2px solid #1a1a1a;text-decoration:none;">Post another role</a>
    </div>
    <p style="color:#999;font-size:.8rem;margin-top:28px;">Thank you for posting with Afrorama — Africa's social impact job board.</p>
  </div>
</body></html>`;
}

Deno.serve(async () => {
  console.log('[listing-expiry-notify] Starting...');

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const { data: expired, error } = await supabase
    .from('listings')
    .select('id, title, organisation, contact_email, views, apply_clicks')
    .eq('paid_listing', true)
    .eq('payment_confirmed', true)
    .eq('deadline', yesterday)
    .eq('expiry_notified', false)
    .not('contact_email', 'is', null);

  if (error) {
    console.error('[listing-expiry-notify] Query failed:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }

  let sent = 0, failed = 0;

  for (const listing of expired || []) {
    const ok = await sendEmail(
      listing.contact_email,
      `How "${listing.title}" performed on Afrorama`,
      emailHTML({
        title:        listing.title,
        organisation: listing.organisation,
        views:        listing.views || 0,
        clicks:       listing.apply_clicks || 0,
      }),
    );

    if (ok) {
      await supabase.from('listings').update({ expiry_notified: true }).eq('id', listing.id);
      sent++;
    } else {
      failed++;
    }
  }

  console.log(`[listing-expiry-notify] Done. Sent: ${sent}, Failed: ${failed}`);
  return Response.json({ sent, failed, checked: expired?.length || 0 });
});
