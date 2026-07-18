/**
 * Afrorama — send-job-alerts Edge Function
 *
 * Runs daily via pg_cron. For each active subscriber, checks whether it's time
 * to send (daily = every day, weekly = every 7 days), fetches matching new
 * listings, and sends a digest email via Resend.
 *
 * Deploy: supabase functions deploy send-job-alerts
 *
 * Schedule (run daily at 8am UTC):
 *   SELECT cron.schedule('send-job-alerts', '0 8 * * *',
 *     $$SELECT net.http_post(
 *       url := 'https://vqchwioyhyiuunpyildz.supabase.co/functions/v1/send-job-alerts',
 *       headers := '{"Authorization":"Bearer SERVICE_ROLE_KEY","Content-Type":"application/json"}'::jsonb,
 *       body := '{}'::jsonb,
 *       timeout_milliseconds := 60000
 *     )$$);
 *
 * Requires tables (run once in SQL Editor):
 *   See companion SQL in the project root: sql/job-alerts.sql
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const FROM_EMAIL     = 'hello@afrorama.org';
const SITE_URL       = 'https://www.afrorama.org';

const REGION_COUNTRY_IDS: Record<string, string[]> = {
  'East Africa':    ['BI','KM','DJ','ER','ET','KE','MG','MW','MU','MZ','RW','SO','SS','TZ','UG'],
  'West Africa':    ['BJ','BF','CV','CI','GM','GH','GN','GW','LR','ML','MR','NE','NG','SN','SL','TG'],
  'North Africa':   ['DZ','EG','LY','MA','SD','TN'],
  'Central Africa': ['AO','CM','CF','TD','CG','CD','GQ','GA','ST'],
  'Southern Africa':['BW','LS','MW','MZ','NA','ZA','SZ','ZM','ZW'],
};

const TYPE_LABELS: Record<string, string> = {
  jobs:        'Job',
  internship:  'Internship / Volunteering',
  consultancy: 'Consultancy',
  capacity:    'Capacity Building',
};

interface Subscriber {
  id: string;
  email: string;
  name: string | null;
  countries: string[];
  regions: string[];
  sectors: string[];
  types: string[];
  frequency: 'daily' | 'weekly';
  unsubscribe_token: string;
  last_sent_at: string | null;
}

interface Listing {
  id: string;
  title: string;
  organisation: string;
  type: string;
  country: string;
  sector: string;
  location: string | null;
  deadline: string | null;
  created_at: string;
  apply_url: string | null;
}

function shouldSendToday(sub: Subscriber): boolean {
  if (!sub.last_sent_at) return true;
  const elapsed = Date.now() - new Date(sub.last_sent_at).getTime();
  return sub.frequency === 'daily'
    ? elapsed >= 20 * 3600 * 1000
    : elapsed >= 6 * 24 * 3600 * 1000;
}

function getListingCutoff(sub: Subscriber): Date {
  if (!sub.last_sent_at) {
    const days = sub.frequency === 'daily' ? 1 : 7;
    return new Date(Date.now() - days * 24 * 3600 * 1000);
  }
  return new Date(sub.last_sent_at);
}

function matchesSubscriber(listing: Listing, sub: Subscriber): boolean {
  // Expand regions → country IDs
  const allowed = new Set<string>(sub.countries ?? []);
  for (const r of sub.regions ?? []) {
    for (const c of REGION_COUNTRY_IDS[r] ?? []) allowed.add(c);
  }
  if (allowed.size > 0 && !allowed.has(listing.country)) return false;
  if ((sub.sectors ?? []).length > 0 && !sub.sectors.includes(listing.sector)) return false;
  if ((sub.types   ?? []).length > 0 && !sub.types.includes(listing.type))     return false;
  return true;
}

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildEmail(sub: Subscriber, listings: Listing[]): { subject: string; html: string } {
  const firstName  = sub.name ? sub.name.trim().split(/\s+/)[0] : null;
  const greeting   = firstName ? `Hi ${esc(firstName)},` : 'Hi,';
  const freq       = sub.frequency === 'daily' ? 'daily' : 'weekly';
  const unsubUrl   = `${SITE_URL}/job-alerts.html?unsubscribe=${sub.unsubscribe_token}`;
  const count      = listings.length;
  const subject    = `${count} new opportunit${count === 1 ? 'y' : 'ies'} on Afrorama`;

  const listRows = listings.map(l => {
    const typeLabel  = TYPE_LABELS[l.type] || l.type;
    const deadline   = l.deadline ? ` &nbsp;·&nbsp; Deadline ${esc(l.deadline.slice(0, 10))}` : '';
    const listingUrl = `${SITE_URL}/opportunities.html`;
    return `
    <tr>
      <td style="padding:14px 0;border-bottom:1px solid #f0f0f0;">
        <a href="${listingUrl}" style="font-size:.95rem;font-weight:700;color:#1a1a1a;text-decoration:none;display:block;margin-bottom:4px;">${esc(l.title)}</a>
        <span style="font-size:.8rem;color:#777;">${esc(l.organisation)} &nbsp;·&nbsp; ${esc(typeLabel)}${deadline}</span>
      </td>
    </tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="font-family:Inter,Arial,sans-serif;background:#F6F5F2;padding:32px 16px;margin:0;">
<div style="max-width:560px;margin:0 auto;background:#fff;border:2.5px solid #1a1a1a;border-radius:14px;overflow:hidden;box-shadow:5px 5px 0 #1a1a1a;">

  <div style="background:#1a1a1a;padding:24px 28px;">
    <div style="font-family:'Bebas Neue',Impact,sans-serif;font-size:1.7rem;letter-spacing:.06em;color:#FFE400;line-height:1;">Afrorama</div>
    <div style="color:rgba(255,255,255,.5);font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;margin-top:4px;">Your ${freq} job alerts</div>
  </div>

  <div style="padding:24px 28px;">
    <p style="margin:0 0 18px;color:#1a1a1a;line-height:1.6;">
      ${greeting}<br>
      Here are <strong>${count} new opportunit${count === 1 ? 'y' : 'ies'}</strong> matching your preferences.
    </p>

    <table style="width:100%;border-collapse:collapse;">${listRows}</table>

    <div style="margin:24px 0;text-align:center;">
      <a href="${SITE_URL}/opportunities.html" style="display:inline-block;background:#FFE400;color:#1a1a1a;font-weight:800;font-size:.88rem;padding:13px 28px;border-radius:100px;border:2px solid #1a1a1a;text-decoration:none;">
        Browse all opportunities →
      </a>
    </div>
  </div>

  <div style="padding:14px 28px;background:#F6F5F2;border-top:1px solid #e8e8e8;text-align:center;">
    <p style="font-size:.7rem;color:#aaa;margin:0;line-height:1.6;">
      You're receiving ${freq} alerts from <a href="${SITE_URL}" style="color:#888;text-decoration:none;">Afrorama</a>.
      <a href="${unsubUrl}" style="color:#888;text-decoration:underline;">Unsubscribe</a>
    </p>
  </div>
</div>
</body></html>`;

  return { subject, html };
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.log(`[send-job-alerts] RESEND_API_KEY not set — would send to: ${to}`);
    return true;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });
  if (!res.ok) {
    console.error('[send-job-alerts] Resend error:', await res.text());
    return false;
  }
  return true;
}

Deno.serve(async () => {
  console.log('[send-job-alerts] Starting...');

  // Fetch listings from the last 8 days (covers both daily and weekly subscribers)
  const globalCutoff = new Date(Date.now() - 8 * 24 * 3600 * 1000);
  const { data: allListings, error: listErr } = await supabase
    .from('listings')
    .select('id, title, organisation, type, country, sector, location, deadline, created_at, apply_url')
    .gte('created_at', globalCutoff.toISOString())
    .order('created_at', { ascending: false });

  if (listErr) {
    console.error('[send-job-alerts] Listings error:', listErr.message);
    return Response.json({ error: listErr.message }, { status: 500 });
  }

  const { data: subscribers, error: subErr } = await supabase
    .from('job_alert_subscriptions')
    .select('*')
    .eq('active', true);

  if (subErr) {
    console.error('[send-job-alerts] Subscribers error:', subErr.message);
    return Response.json({ error: subErr.message }, { status: 500 });
  }

  let sent = 0, skipped = 0, errors = 0;

  for (const sub of (subscribers as Subscriber[]) ?? []) {
    if (!shouldSendToday(sub)) { skipped++; continue; }

    const cutoff  = getListingCutoff(sub);
    const matching = ((allListings as Listing[]) ?? []).filter(l => {
      if (new Date(l.created_at) <= cutoff) return false;
      return matchesSubscriber(l, sub);
    });

    if (matching.length === 0) { skipped++; continue; }

    const { subject, html } = buildEmail(sub, matching);
    const ok = await sendEmail(sub.email, subject, html);

    if (ok) {
      await supabase
        .from('job_alert_subscriptions')
        .update({ last_sent_at: new Date().toISOString() })
        .eq('id', sub.id);
      sent++;
    } else {
      errors++;
    }
  }

  console.log(`[send-job-alerts] sent=${sent} skipped=${skipped} errors=${errors}`);
  return Response.json({ sent, skipped, errors });
});
