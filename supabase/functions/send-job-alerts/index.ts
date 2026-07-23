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
  const unsubUrl   = `${SITE_URL}/job-alerts?unsubscribe=${sub.unsubscribe_token}`;
  const total      = listings.length;
  const preview    = listings.slice(0, 20); // Show max 20, push to site for rest
  const hasMore    = total > 20;
  const subject    = `${total} new opportunit${total === 1 ? 'y' : 'ies'} matching your alerts`;

  const listRows = preview.map(l => {
    const typeLabel = TYPE_LABELS[l.type] || l.type;
    const deadline  = l.deadline ? `<span style="color:#e05a00;font-weight:600;">Closes ${esc(l.deadline.slice(0, 10))}</span> &nbsp;·&nbsp; ` : '';
    return `
    <tr>
      <td style="padding:14px 0;border-bottom:1px solid #f0f0f0;">
        <a href="${SITE_URL}/opportunities" style="font-size:.95rem;font-weight:700;color:#1a1a1a;text-decoration:none;display:block;margin-bottom:5px;line-height:1.3;">${esc(l.title)}</a>
        <div style="font-size:.78rem;color:#888;">${deadline}${esc(l.organisation)} &nbsp;·&nbsp; ${esc(typeLabel)}</div>
      </td>
    </tr>`;
  }).join('');

  const moreRow = hasMore ? `
    <tr>
      <td style="padding:16px 0 4px;">
        <a href="${SITE_URL}/opportunities" style="font-size:.85rem;font-weight:700;color:#1a1a1a;text-decoration:underline;">
          + ${total - 20} more roles matching your preferences →
        </a>
      </td>
    </tr>` : '';

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="font-family:Inter,-apple-system,Arial,sans-serif;background:#F2F1EE;padding:32px 16px;margin:0;">
<div style="max-width:560px;margin:0 auto;">

  <!-- Header -->
  <div style="background:#1a1a1a;padding:20px 28px;border-radius:14px 14px 0 0;border:2.5px solid #1a1a1a;border-bottom:none;">
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td>
          <!-- Logo mark: yellow circle with 'a' -->
          <span style="display:inline-flex;align-items:center;gap:10px;text-decoration:none;">
            <span style="display:inline-block;width:32px;height:32px;background:#FFE400;border-radius:50%;text-align:center;line-height:32px;font-weight:900;font-size:1.1rem;color:#1a1a1a;font-family:Inter,Arial,sans-serif;">a</span>
            <span style="font-weight:800;font-size:1.15rem;letter-spacing:-.03em;color:#fff;font-family:Inter,Arial,sans-serif;">afrorama</span>
          </span>
        </td>
        <td style="text-align:right;">
          <span style="font-size:.68rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.4);">${freq} alerts</span>
        </td>
      </tr>
    </table>
  </div>

  <!-- Body -->
  <div style="background:#fff;padding:28px 28px 20px;border:2.5px solid #1a1a1a;border-top:none;border-bottom:none;">

    <p style="margin:0 0 6px;font-size:1rem;font-weight:800;color:#1a1a1a;">${greeting}</p>
    <p style="margin:0 0 22px;font-size:.9rem;color:#555;line-height:1.6;">
      ${hasMore
        ? `You have <strong style="color:#1a1a1a;">${total} new roles</strong> matching your alerts. Here are the top 20 — see the rest on afrorama.`
        : `You have <strong style="color:#1a1a1a;">${total} new role${total === 1 ? '' : 's'}</strong> matching your alerts.`
      }
    </p>

    <table style="width:100%;border-collapse:collapse;">
      ${listRows}
      ${moreRow}
    </table>

    <!-- Primary CTA -->
    <div style="margin:24px 0 16px;text-align:center;">
      <a href="${SITE_URL}/opportunities" style="display:inline-block;background:#FFE400;color:#1a1a1a;font-weight:800;font-size:.88rem;padding:14px 32px;border-radius:100px;border:2px solid #1a1a1a;text-decoration:none;box-shadow:3px 3px 0 #1a1a1a;">
        Browse all opportunities →
      </a>
    </div>
  </div>

  <!-- CV Analyser nudge -->
  <div style="background:#f0faf0;padding:18px 28px;border:2.5px solid #1a1a1a;border-top:none;border-bottom:none;">
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="padding-right:16px;">
          <div style="font-size:.82rem;font-weight:800;color:#1a1a1a;margin-bottom:3px;">Don't waste an application.</div>
          <div style="font-size:.78rem;color:#555;line-height:1.5;">Check whether your CV is tailored for a role in under 2 minutes — free with No Wahala CV.</div>
        </td>
        <td style="white-space:nowrap;vertical-align:middle;">
          <a href="${SITE_URL}/cv-analyser" style="display:inline-block;background:#1a1a1a;color:#FFE400;font-weight:800;font-size:.75rem;padding:10px 16px;border-radius:100px;text-decoration:none;white-space:nowrap;">
            Score my CV →
          </a>
        </td>
      </tr>
    </table>
  </div>

  <!-- Footer -->
  <div style="background:#F2F1EE;padding:14px 28px;border:2.5px solid #1a1a1a;border-top:1px solid #e0e0e0;border-radius:0 0 14px 14px;text-align:center;">
    <p style="font-size:.68rem;color:#aaa;margin:0;line-height:1.8;">
      You're receiving ${freq} job alerts from <a href="${SITE_URL}" style="color:#888;text-decoration:none;font-weight:600;">afrorama</a>.
      &nbsp;·&nbsp;
      <a href="${unsubUrl}" style="color:#aaa;text-decoration:underline;">Unsubscribe</a>
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
