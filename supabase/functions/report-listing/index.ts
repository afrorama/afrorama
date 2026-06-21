/**
 * Afrorama — report-listing Edge Function
 *
 * Lets site visitors flag a listing as broken (bad link, expired deadline,
 * wrong location, etc). Sends an email notification to hello@afrorama.org
 * so it can be reviewed and removed/fixed.
 *
 * POST body: { listingId: string, title: string, organisation: string, applyUrl?: string, reason?: string }
 *
 * Deploy: supabase functions deploy report-listing
 */

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const FROM_EMAIL      = 'hello@afrorama.org';
const TO_EMAIL        = 'hello@afrorama.org';

async function sendEmail(subject: string, html: string) {
  if (!RESEND_API_KEY) {
    console.log(`[report-listing] RESEND_API_KEY not set — would send: ${subject}`);
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_EMAIL, to: TO_EMAIL, subject, html }),
  });
  if (!res.ok) console.error('[report-listing] Email send failed:', await res.text());
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return Response.json({ error: 'POST only' }, { status: 405, headers: CORS });

  try {
    const { listingId, title, organisation, applyUrl, reason } = await req.json() as {
      listingId: string; title: string; organisation: string; applyUrl?: string; reason?: string;
    };

    if (!listingId) {
      return Response.json({ error: 'listingId required' }, { status: 400, headers: CORS });
    }

    const html = `
      <h2>Listing reported</h2>
      <p><strong>Title:</strong> ${title || 'Unknown'}</p>
      <p><strong>Organisation:</strong> ${organisation || 'Unknown'}</p>
      <p><strong>Listing ID:</strong> ${listingId}</p>
      ${applyUrl ? `<p><strong>Apply URL:</strong> <a href="${applyUrl}">${applyUrl}</a></p>` : ''}
      <p><strong>Reason:</strong> ${reason || 'Not specified (broken link or expired deadline)'}</p>
      <p><a href="https://vqchwioyhyiuunpyildz.supabase.co/project/default/sql/new">Open Supabase SQL Editor to remove it</a></p>
      <p style="color:#888;font-size:.85rem;">DELETE FROM listings WHERE id = '${listingId}';</p>
    `;

    await sendEmail(`Listing reported: ${title || listingId}`, html);

    return Response.json({ ok: true }, { headers: CORS });
  } catch (err) {
    console.error(`[report-listing] Exception: ${err instanceof Error ? err.message : String(err)}`);
    return Response.json({ error: 'Failed to send report' }, { status: 500, headers: CORS });
  }
});
