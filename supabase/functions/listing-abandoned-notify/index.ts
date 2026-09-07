/**
 * Afrorama — listing-abandoned-notify Edge Function
 *
 * Runs hourly. Finds paid job listings that were saved via post.html but
 * never actually paid for (Stripe Checkout was opened and abandoned, or
 * never opened at all) and emails the poster a reminder with a one-click
 * link that resumes payment for that exact listing — no re-entering
 * details required.
 *
 * Fires once per listing (abandoned_notified flag), only for listings
 * created 4h–48h ago: long enough that it's clearly not just a slow
 * checkout, short enough that the role is still fresh and worth chasing.
 *
 * Deploy: supabase functions deploy listing-abandoned-notify
 *
 * Schedule hourly via pg_cron:
 *   SELECT cron.schedule('listing-abandoned-notify-hourly', '0 * * * *',
 *     $$SELECT net.http_post(
 *       url := 'https://vqchwioyhyiuunpyildz.supabase.co/functions/v1/listing-abandoned-notify',
 *       headers := '{"Authorization":"Bearer SERVICE_ROLE_KEY","Content-Type":"application/json"}'::jsonb,
 *       body := '{}'::jsonb
 *     )$$);
 *
 * Requires one column on listings (run once in SQL Editor):
 *   ALTER TABLE listings ADD COLUMN IF NOT EXISTS abandoned_notified BOOLEAN DEFAULT false;
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const FROM_EMAIL      = 'hello@afrorama.org';
const FUNCTIONS_URL   = 'https://vqchwioyhyiuunpyildz.supabase.co/functions/v1';

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) {
    console.log(`[listing-abandoned-notify] RESEND_API_KEY not set — would send to ${to}: ${subject}`);
    return true;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_EMAIL, to, bcc: FROM_EMAIL, subject, html }),
  });
  if (!res.ok) {
    console.error('[listing-abandoned-notify] Email send failed:', await res.text());
    return false;
  }
  return true;
}

function emailHTML(opts: { title: string; organisation: string; resumeUrl: string }): string {
  const { title, organisation, resumeUrl } = opts;
  return `
<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="font-family:Inter,Arial,sans-serif;background:#F6F5F2;padding:40px 20px;margin:0;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:2.5px solid #1a1a1a;border-radius:16px;padding:36px;">
    <p style="font-size:.78rem;letter-spacing:.06em;text-transform:uppercase;color:#888;margin:0 0 6px;">Almost there</p>
    <h1 style="font-size:1.4rem;margin:0 0 18px;color:#1a1a1a;">Your listing isn't live yet</h1>
    <p style="color:#333;line-height:1.6;font-size:.95rem;">You started posting <strong>${title}</strong>${organisation ? ` at ${organisation}` : ''} on Afrorama, but the payment step wasn't completed — so it's saved on our end but not visible to job seekers yet.</p>
    <p style="color:#333;line-height:1.6;font-size:.95rem;">Everything you entered is still there. One click finishes the job — no need to fill in the form again.</p>
    <div style="margin:28px 0;text-align:center;">
      <a href="${resumeUrl}" style="display:inline-block;background:#FFE400;color:#1a1a1a;font-weight:800;padding:12px 28px;border-radius:100px;border:2px solid #1a1a1a;text-decoration:none;">Complete payment &amp; publish</a>
    </div>
    <p style="color:#999;font-size:.8rem;margin-top:28px;">If you no longer want to post this role, feel free to ignore this — it will not be published without payment.</p>
  </div>
</body></html>`;
}

Deno.serve(async () => {
  console.log('[listing-abandoned-notify] Starting...');

  const now         = Date.now();
  const windowStart = new Date(now - 48 * 60 * 60 * 1000).toISOString(); // not older than 48h
  const windowEnd   = new Date(now -  4 * 60 * 60 * 1000).toISOString(); // at least 4h old

  const { data: abandoned, error } = await supabase
    .from('listings')
    .select('id, title, organisation, contact_email')
    .eq('paid_listing', true)
    .eq('payment_confirmed', false)
    .eq('abandoned_notified', false)
    .gte('created_at', windowStart)
    .lte('created_at', windowEnd)
    .not('contact_email', 'is', null);

  if (error) {
    console.error('[listing-abandoned-notify] Query failed:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }

  let sent = 0, failed = 0;

  for (const listing of abandoned || []) {
    const resumeUrl = `${FUNCTIONS_URL}/resume-checkout?id=${encodeURIComponent(listing.id)}`;
    const ok = await sendEmail(
      listing.contact_email,
      `Finish publishing "${listing.title}" on Afrorama`,
      emailHTML({ title: listing.title, organisation: listing.organisation, resumeUrl }),
    );

    if (ok) {
      await supabase.from('listings').update({ abandoned_notified: true }).eq('id', listing.id);
      sent++;
    } else {
      failed++;
    }
  }

  console.log(`[listing-abandoned-notify] Done. Sent: ${sent}, Failed: ${failed}`);
  return Response.json({ sent, failed, checked: abandoned?.length || 0 });
});
