/**
 * Afrorama — unicef-scraper Edge Function
 *
 * UNICEF's careers site is plain server-rendered HTML — no API, no login,
 * no JS execution needed. Each listing row already embeds title, a teaser
 * description, location (a clean country name), and an ISO deadline
 * directly in the HTML, so no per-job detail-page fetch is required.
 *
 * Deploy: supabase functions deploy unicef-scraper
 * Schedule daily via pg_cron, same pattern as the other scrapers.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { trySubmitSalary } from '../_shared/currency.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const DISCLAIMER = '\n\n─────────────────────────────────────\nThis summary is automatically generated for quick reference. For the complete and authoritative job description, please view the original posting.';
const BASE_URL = 'https://jobs.unicef.org';
const PAGE_ITEMS = 100;
const MAX_PAGES = 5;

const COUNTRY_NAME_ISO: Record<string, string> = {
  'algeria':'DZ', 'angola':'AO', 'benin':'BJ', 'botswana':'BW', 'burkina faso':'BF',
  'burundi':'BI', 'cameroon':'CM', 'cabo verde':'CV', 'cape verde':'CV',
  'central african republic':'CF', 'chad':'TD', 'comoros':'KM', 'congo':'CG',
  'democratic republic of the congo':'CD', 'dr congo':'CD',
  "côte d'ivoire":'CI', 'ivory coast':'CI', 'djibouti':'DJ', 'egypt':'EG',
  'equatorial guinea':'GQ', 'eritrea':'ER', 'eswatini':'SZ', 'ethiopia':'ET',
  'gabon':'GA', 'gambia':'GM', 'ghana':'GH', 'guinea':'GN', 'guinea-bissau':'GW',
  'kenya':'KE', 'lesotho':'LS', 'liberia':'LR', 'libya':'LY', 'madagascar':'MG',
  'malawi':'MW', 'mali':'ML', 'mauritania':'MR', 'mauritius':'MU', 'morocco':'MA',
  'mozambique':'MZ', 'namibia':'NA', 'niger':'NE', 'nigeria':'NG', 'rwanda':'RW',
  'sao tome and principe':'ST', 'senegal':'SN', 'sierra leone':'SL', 'somalia':'SO',
  'south africa':'ZA', 'south sudan':'SS', 'sudan':'SD', 'togo':'TG', 'tunisia':'TN',
  'uganda':'UG', 'tanzania':'TZ', 'united republic of tanzania':'TZ', 'zambia':'ZM', 'zimbabwe':'ZW',
};

const SECTOR_MAP: Record<string, string> = {
  'nutrition':'Health', 'health':'Health', 'hiv':'Health', 'wash':'Health',
  'water and sanitation':'Health', 'medical':'Health',
  'education':'Education', 'learning':'Education',
  'child protection':'Human Rights', 'protection':'Human Rights', 'rights':'Human Rights', 'gbv':'Human Rights',
  'gender':'Gender & Social Inclusion', 'social inclusion':'Gender & Social Inclusion', 'disability':'Gender & Social Inclusion',
  'climate':'Climate & Environment', 'environment':'Climate & Environment',
  'social policy':'Governance & Public Policy', 'policy':'Governance & Public Policy', 'communication':'Governance & Public Policy',
  'supply':'Private Sector Development', 'procurement':'Private Sector Development',
  'emergency':'Peacebuilding', 'humanitarian':'Peacebuilding', 'crisis':'Peacebuilding',
  'innovation':'Innovation & Technology', 'ict':'Innovation & Technology', 'digital':'Innovation & Technology', 'data':'Innovation & Technology',
  'youth':'Youth & Employment', 'adolescent':'Youth & Employment',
};

function mapSector(text: string): string {
  const lower = text.toLowerCase();
  for (const [key, val] of Object.entries(SECTOR_MAP)) {
    if (lower.includes(key)) return val;
  }
  return 'Governance & Public Policy';
}

function mapType(title: string): string {
  const t = title.toLowerCase();
  if (/\bintern(ship)?\b/.test(t)) return 'internship';
  if (/\bconsult(ant|ancy)\b|\bindividual contractor\b/.test(t)) return 'consultancy';
  return 'jobs';
}

function decodeEntities(s: string): string {
  return (s || '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&eacute;/g, 'é')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)));
}

function fallbackDesc(bodyText: string, org: string): string {
  const lines = (bodyText || '')
    .split(/\n|\. /)
    .map(l => l.trim())
    .filter(l => l.length > 30)
    .slice(0, 3);
  if (lines.length === 0) {
    return `${org} has posted this opportunity, but the description could not be automatically summarised. Please view the original posting for full details.${DISCLAIMER}`;
  }
  return lines.map(l => `• ${l.charAt(0).toUpperCase() + l.slice(1)}`).join('\n') + DISCLAIMER;
}

async function formatWithClaude(title: string, org: string, description: string): Promise<{ description: string; salary: string }> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey || !description || description.length < 60) return { description: fallbackDesc(description, org), salary: 'See listing' };

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', max_tokens: 400,
        messages: [{ role: 'user', content: `You are writing a job summary for Afrorama, Africa's social impact job board. Format in British English.\n\nTask 1 — Write exactly 5 bullet points:\n- Bullet 1 drawn from the opening/overview\n- Bullets 2-5 begin with a strong imperative verb\n- Concise, action-oriented, British English spelling\n\nTask 2 — Extract salary or compensation (be thorough): explicit figures, UN grades (P3, NO-2, G5), "Competitive", allowances. Only write none if there is genuinely zero mention of pay/grade/compensation.\n\nJob: ${title} at ${org}\n\nDescription:\n${description.slice(0, 2000)}\n\nReturn:\nBULLETS:\n• [bullet 1]\n• [bullet 2]\n• [bullet 3]\n• [bullet 4]\n• [bullet 5]\nSALARY: [salary or none]` }],
      }),
    });
    if (!res.ok) return { description: fallbackDesc(description, org), salary: 'See listing' };
    const data = await res.json() as { content: { text: string }[] };
    const raw = data.content?.[0]?.text?.trim() || '';
    const bullets = raw.match(/BULLETS:\s*([\s\S]*?)(?=SALARY:|$)/i)?.[1]?.trim() || fallbackDesc(description, org);
    const salaryRaw = raw.match(/SALARY:\s*(.+)/i)?.[1]?.trim() || 'none';
    return { description: bullets + DISCLAIMER, salary: salaryRaw.toLowerCase() === 'none' ? 'See listing' : salaryRaw };
  } catch { return { description: fallbackDesc(description, org), salary: 'See listing' }; }
}

interface RawJob { url: string; title: string; teaser: string; location: string; deadline: string | null; }

function extractJobs(html: string): RawJob[] {
  const out: RawJob[] = [];
  const seenUrls = new Set<string>();
  // Each job card renders twice in the source HTML (desktop + mobile
  // responsive markup) — dedupe by URL so downstream counts are accurate.
  const blocks = html.split('<div class="list-view--item">').slice(1);
  for (const block of blocks) {
    const linkMatch = block.match(/<a class="job-link" href="([^"]+)">([^<]+)<\/a>/);
    if (!linkMatch) continue;
    if (seenUrls.has(linkMatch[1])) continue;
    seenUrls.add(linkMatch[1]);
    const teaserMatch = block.match(/<div class="row--teaser">([\s\S]*?)<\/div>/);
    const teaserHtml = teaserMatch ? teaserMatch[1] : '';
    const teaser = decodeEntities(teaserHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    const locMatch = block.match(/<span class="location">([^<]+)<\/span>/);
    const deadlineMatch = block.match(/<time datetime="([^"]+)"/);

    out.push({
      url: linkMatch[1].startsWith('http') ? linkMatch[1] : `${BASE_URL}${linkMatch[1]}`,
      title: decodeEntities(linkMatch[2].trim()),
      teaser,
      location: locMatch ? decodeEntities(locMatch[1].trim()) : '',
      deadline: deadlineMatch ? deadlineMatch[1].slice(0, 10) : null,
    });
  }
  return out;
}

Deno.serve(async () => {
  console.log('[unicef-scraper] Starting...');

  try {
    const africanJobs: RawJob[] = [];

    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = `${BASE_URL}/en-us/listing/?page=${page}&page-items=${PAGE_ITEMS}`;
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AfroramaBot/1.0)' } });
      if (!res.ok) { console.warn(`[unicef-scraper] Page ${page}: HTTP ${res.status}`); break; }
      const html = await res.text();
      const jobs = extractJobs(html);
      console.log(`[unicef-scraper] Page ${page}: ${jobs.length} jobs found`);
      if (jobs.length === 0) break;

      for (const job of jobs) {
        const iso = COUNTRY_NAME_ISO[job.location.toLowerCase()];
        if (iso) africanJobs.push(job);
      }

      if (jobs.length < PAGE_ITEMS) break;
      await new Promise(r => setTimeout(r, 200));
    }

    console.log(`[unicef-scraper] ${africanJobs.length} African jobs found`);

    let totalImported = 0, totalSkipped = 0;
    const org = 'UNICEF';

    for (const job of africanJobs) {
      const idMatch = job.url.match(/\/job\/(\d+)\//);
      const id = idMatch ? idMatch[1] : null;
      if (!id) { totalSkipped++; continue; }

      if (job.deadline && new Date(job.deadline) < new Date()) {
        console.log(`[unicef-scraper] ${id}: skipping expired posting (closed ${job.deadline})`);
        continue;
      }

      const iso = COUNTRY_NAME_ISO[job.location.toLowerCase()];
      const { description, salary } = await formatWithClaude(job.title, org, job.teaser);

      const result = await supabase.from('listings').upsert({
        id: `unicef-${id}`, title: job.title, organisation: org, type: mapType(job.title),
        sector: mapSector(`${job.title} ${job.teaser}`), location: job.location, country: iso,
        deadline: job.deadline, posted: new Date().toISOString().split('T')[0],
        salary, description, apply_url: job.url,
        org_domain: 'unicef.org', source: 'UNICEF', views: 0, apply_clicks: 0, paid_listing: false,
      }, { onConflict: 'id', ignoreDuplicates: false });

      if (result?.error) { console.error(`[unicef-scraper] Upsert error: ${result.error.message}`); totalSkipped++; }
      else totalImported++;

      await trySubmitSalary(supabase, {
        company: org, position: job.title, salaryText: salary,
        sector: mapSector(`${job.title} ${job.teaser}`), country: iso,
      });

      await new Promise(r => setTimeout(r, 150));
    }

    console.log(`[unicef-scraper] Done. Imported: ${totalImported}, Skipped: ${totalSkipped}`);
    return Response.json({ imported: totalImported, skipped: totalSkipped, africanFound: africanJobs.length });

  } catch (err) {
    console.error('[unicef-scraper] UNCAUGHT:', (err as Error).message);
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
});
