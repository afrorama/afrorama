/**
 * Afrorama — expertise-france-scraper Edge Function
 *
 * Expertise France runs its careers site on GestMax, a server-rendered
 * (no JS/API needed) French ATS. The search/listing pages are plain HTML
 * with simple zone tags (e.g. "AFRIQUE SUBSAHARIENNE") cheap to check
 * before committing to a detail-page fetch. Each detail page embeds a
 * full schema.org JobPosting JSON-LD block with a clean English country
 * name, ISO deadline, and full description — used as the authoritative
 * source rather than scraping the rendered detail HTML directly.
 *
 * Deploy: supabase functions deploy expertise-france-scraper
 * Schedule daily via pg_cron, same pattern as the other scrapers.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { trySubmitSalary } from '../_shared/currency.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const DISCLAIMER = '\n\n─────────────────────────────────────\nThis summary is automatically generated for quick reference. For the complete and authoritative job description, please view the original posting.';
const BASE_URL = 'https://expertise-france.gestmax.fr';
const MAX_PAGES = 15; // safety cap — site currently has ~12 pages of 10

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
  'uganda':'UG', 'tanzania':'TZ', 'zambia':'ZM', 'zimbabwe':'ZW',
};

const SECTOR_MAP: Record<string, string> = {
  'climat':'Climate & Environment', 'climate':'Climate & Environment', 'environment':'Climate & Environment',
  'agricult':'Agriculture & Food Security', 'rural':'Agriculture & Food Security',
  'santé':'Health', 'health':'Health', 'nursing':'Health', 'médical':'Health',
  'éducation':'Education', 'education':'Education', 'curriculum':'Education',
  'finance':'Finance & Economics', 'financ':'Finance & Economics', 'budget':'Finance & Economics',
  'genre':'Gender & Social Inclusion', 'gender':'Gender & Social Inclusion', 'femmes':'Gender & Social Inclusion',
  'gouvernance':'Governance & Public Policy', 'governance':'Governance & Public Policy', 'policy':'Governance & Public Policy',
  'droits':'Human Rights', 'human rights':'Human Rights', 'justice':'Human Rights',
  'infrastructure':'Infrastructure & Urban Development', 'urbain':'Infrastructure & Urban Development', 'urban':'Infrastructure & Urban Development',
  'numérique':'Innovation & Technology', 'digital':'Innovation & Technology', 'technology':'Innovation & Technology',
  'paix':'Peacebuilding', 'crise':'Peacebuilding', 'sécurité':'Peacebuilding', 'conflict':'Peacebuilding',
  'secteur privé':'Private Sector Development', 'private sector':'Private Sector Development', 'entrepreneur':'Private Sector Development',
  'jeunes':'Youth & Employment', 'jeunesse':'Youth & Employment', 'youth':'Youth & Employment', 'employment':'Youth & Employment',
};

function mapSector(text: string): string {
  const lower = text.toLowerCase();
  for (const [key, val] of Object.entries(SECTOR_MAP)) {
    if (lower.includes(key)) return val;
  }
  return 'Governance & Public Policy';
}

function mapType(employmentType: string, title: string): string {
  const et = (employmentType || '').toUpperCase();
  const t  = title.toLowerCase();
  if (et === 'INTERN' || /\bstage\b|\binternship\b/.test(t)) return 'internship';
  if (et === 'CONTRACTOR' || /consultant|expert\.?e|expertise/.test(t)) return 'consultancy';
  return 'jobs';
}

function stripHtml(html: string): string {
  return (html || '')
    .replace(/<\/?(li|p|br|h[1-6]|div)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#8226;/g, '•')
    .replace(/&#\d+;/g, ' ')
    .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function fallbackDesc(bodyText: string, org: string): string {
  const lines = (bodyText || '')
    .split('\n')
    .map(l => l.trim().replace(/^[-•*–·]\s*/, ''))
    .filter(l => l.length > 30)
    .slice(0, 3);
  if (lines.length === 0) {
    return `${org} has posted this opportunity, but the description could not be automatically summarised. Please view the original posting for full details.${DISCLAIMER}`;
  }
  return lines.map(l => `• ${l.charAt(0).toUpperCase() + l.slice(1)}`).join('\n') + DISCLAIMER;
}

async function formatWithClaude(title: string, org: string, description: string): Promise<{ description: string; salary: string }> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey || !description || description.length < 80) return { description: fallbackDesc(description, org), salary: 'See listing' };

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', max_tokens: 400,
        messages: [{ role: 'user', content: `You are writing a job summary for Afrorama, Africa's social impact job board. The source text may be in French — write your output in English regardless. Format in British English.\n\nTask 1 — Write exactly 5 bullet points:\n- Bullet 1 drawn from the opening/overview\n- Bullets 2-5 begin with a strong imperative verb\n- Concise, action-oriented, British English spelling\n\nTask 2 — Extract salary or compensation (be thorough): explicit figures, grades, "Competitive", allowances. Only write none if there is genuinely zero mention of pay/grade/compensation.\n\nJob: ${title} at ${org}\n\nDescription:\n${description.slice(0, 2000)}\n\nReturn:\nBULLETS:\n• [bullet 1]\n• [bullet 2]\n• [bullet 3]\n• [bullet 4]\n• [bullet 5]\nSALARY: [salary or none]` }],
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

interface Candidate { url: string; title: string; }

function extractCandidates(html: string): Candidate[] {
  const out: Candidate[] = [];
  const blocks = html.split('<div class="list-group-item ').slice(1);
  for (const block of blocks) {
    const zoneMatches = [...block.matchAll(/ico_zone-geo\.png[^]*?<strong>([^<]+)<\/strong>/g)].map(m => m[1]);
    if (!zoneMatches.some(z => z.includes('AFRIQUE'))) continue;

    const hrefMatch = block.match(/<a href="([^"]+)"\s*>\s*<h2 class="list-group-item-heading">([^<]+)/);
    if (!hrefMatch) continue;
    out.push({ url: hrefMatch[1], title: hrefMatch[2].replace(/&eacute;/g, 'é').trim() });
  }
  return out;
}

async function fetchTotalPages(): Promise<number> {
  const res = await fetch(`${BASE_URL}/search/index/lang/fr_FR`, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AfroramaBot/1.0)' } });
  const html = await res.text();
  const totalMatch = html.match(/sur <strong id="pager-total-results">(\d+)<\/strong>/);
  const total = totalMatch ? parseInt(totalMatch[1], 10) : 0;
  return Math.min(MAX_PAGES, Math.ceil(total / 10) || 1);
}

Deno.serve(async () => {
  console.log('[expertise-france-scraper] Starting...');

  try {
    const totalPages = await fetchTotalPages();
    console.log(`[expertise-france-scraper] Total pages to check: ${totalPages}`);

    const candidates: Candidate[] = [];
    for (let page = 1; page <= totalPages; page++) {
      const url = page === 1
        ? `${BASE_URL}/search/index/lang/fr_FR`
        : `${BASE_URL}/search/index/lang/fr_FR/page/${page}`;
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AfroramaBot/1.0)' } });
      if (!res.ok) { console.warn(`[expertise-france-scraper] Page ${page}: HTTP ${res.status}`); continue; }
      const html = await res.text();
      candidates.push(...extractCandidates(html));
      await new Promise(r => setTimeout(r, 200));
    }

    console.log(`[expertise-france-scraper] ${candidates.length} Africa-zone candidates found across ${totalPages} pages`);

    let totalImported = 0, totalSkipped = 0;

    for (const cand of candidates) {
      try {
        const dr = await fetch(cand.url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AfroramaBot/1.0)' } });
        if (!dr.ok) { totalSkipped++; continue; }
        const html = await dr.text();
        const ldMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
        if (!ldMatch) { totalSkipped++; continue; }

        const ld = JSON.parse(ldMatch[1]);
        const countryNameRaw = ld?.jobLocation?.address?.addressCountry || '';
        const countryName = countryNameRaw.toLowerCase();
        const iso = COUNTRY_NAME_ISO[countryName];
        if (!iso) { console.log(`[expertise-france-scraper] Skipping non-African country: ${countryName}`); continue; }

        const idMatch = cand.url.match(/\/(\d+)\//);
        const id = idMatch ? idMatch[1] : null;
        if (!id) { totalSkipped++; continue; }

        const deadline = ld.validThrough ? String(ld.validThrough).slice(0, 10) : null;
        if (deadline && new Date(deadline) < new Date()) {
          console.log(`[expertise-france-scraper] ${id}: skipping expired posting (closed ${deadline})`);
          continue;
        }

        const title = ld.title || cand.title || 'Untitled';
        const org   = ld.hiringOrganization?.name || 'Expertise France';
        const bodyText = stripHtml(ld.description || '');
        const { description, salary } = await formatWithClaude(title, org, bodyText);
        const posted = ld.datePosted ? String(ld.datePosted).slice(0, 10) : new Date().toISOString().split('T')[0];
        const city = ld.jobLocation?.address?.addressLocality || countryNameRaw;

        const result = await supabase.from('listings').upsert({
          id: `ef-${id}`, title, organisation: org, type: mapType(ld.employmentType, title),
          sector: mapSector(`${title} ${bodyText}`), location: city || countryNameRaw, country: iso,
          deadline, posted, salary, description, apply_url: cand.url,
          org_domain: 'expertise-france.org', source: 'Expertise France',
          views: 0, apply_clicks: 0, paid_listing: false,
        }, { onConflict: 'id', ignoreDuplicates: false });

        if (result?.error) { console.error(`[expertise-france-scraper] Upsert error: ${result.error.message}`); totalSkipped++; }
        else totalImported++;

        await trySubmitSalary(supabase, {
          company: org, position: title, salaryText: salary,
          sector: mapSector(`${title} ${bodyText}`), country: iso,
        });

        await new Promise(r => setTimeout(r, 200));
      } catch (err) {
        console.warn(`[expertise-france-scraper] ${cand.url} failed:`, (err as Error).message);
        totalSkipped++;
      }
    }

    console.log(`[expertise-france-scraper] Done. Imported: ${totalImported}, Skipped: ${totalSkipped}`);
    return Response.json({ imported: totalImported, skipped: totalSkipped, candidatesChecked: candidates.length });

  } catch (err) {
    console.error('[expertise-france-scraper] UNCAUGHT:', (err as Error).message);
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
});
