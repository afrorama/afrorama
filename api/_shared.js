/**
 * Shared helpers for the server-rendered job pages (api/job.js) and the
 * job sitemap (api/sitemap-jobs.js). Files starting with _ are not routes.
 */

const SUPABASE_URL = 'https://vqchwioyhyiuunpyildz.supabase.co';
// Public (publishable) key — same one the website uses; only public columns are readable
const ANON_KEY = 'sb_publishable_HeGZfQZEDI_IR46a2Ezp-Q_tIUdhF6_';
const SITE_URL = 'https://www.afrorama.org';

const PUBLIC_COLUMNS =
  'id,title,organisation,type,sector,location,country,deadline,posted,salary,description,' +
  'requirements,apply_url,bitly_url,source,paid_listing,payment_confirmed,created_at,org_domain';

async function supa(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.json();
}

function slugify(s) {
  return String(s || '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 80).replace(/-+$/g, '') || 'job';
}

function jobPath(job) {
  return `/jobs/${encodeURIComponent(job.id)}/${slugify(`${job.title} ${job.organisation}`)}`;
}

function todayISO() { return new Date().toISOString().slice(0, 10); }

// Same rule as get_active_listings()
function isActive(job) {
  const open = !job.deadline || job.deadline >= todayISO();
  const visible = !job.paid_listing || job.payment_confirmed;
  return open && visible;
}

let regionNames;
function countryName(iso) {
  if (!iso) return '';
  try {
    regionNames = regionNames || new Intl.DisplayNames(['en'], { type: 'region' });
    return regionNames.of(String(iso).toUpperCase()) || iso;
  } catch { return iso; }
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

module.exports = { SUPABASE_URL, ANON_KEY, SITE_URL, PUBLIC_COLUMNS, supa, slugify, jobPath, isActive, countryName, esc, todayISO };
