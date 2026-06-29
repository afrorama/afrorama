/**
 * Afrorama — afd-scraper Edge Function
 *
 * Agence Française de Développement (AFD) and its private-sector subsidiary
 * Proparco run their careers site on Cornerstone OnDemand (CSOD). The site
 * embeds a short-lived session JWT directly in its initial HTML — no login
 * required — which authenticates calls to CSOD's real jobs API. Most AFD
 * roles are France HQ-based; this scraper keeps only the African ones.
 *
 * Flow:
 *   1. GET the career site's home page, regex out the embedded JWT.
 *   2. POST to the jobs search API (paginated) using that JWT.
 *   3. Keep only requisitions whose location country is in Africa.
 *
 * Deploy: supabase functions deploy afd-scraper
 * Schedule daily via pg_cron, same pattern as the other scrapers.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { trySubmitSalary } from '../_shared/currency.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const DISCLAIMER = '\n\n─────────────────────────────────────\nThis summary is automatically generated for quick reference. For the complete and authoritative job description, please view the original posting.';

const CAREER_SITE_URL = 'https://afd.csod.com/ux/ats/careersite/5/home?c=afd&lang=en-US';
const JOBS_API_URL    = 'https://uk.api.csod.com/rec-job-search/external/jobs';
const CAREER_SITE_ID  = 5;

const AFRICA_ISO: Record<string, string> = {
  DZ:'Algeria', AO:'Angola', BJ:'Benin', BW:'Botswana', BF:'Burkina Faso',
  BI:'Burundi', CM:'Cameroon', CV:'Cabo Verde', CF:'Central African Republic',
  TD:'Chad', KM:'Comoros', CG:'Congo', CD:'Democratic Republic of the Congo',
  CI:"Côte d'Ivoire", DJ:'Djibouti', EG:'Egypt', GQ:'Equatorial Guinea',
  ER:'Eritrea', SZ:'Eswatini', ET:'Ethiopia', GA:'Gabon', GM:'Gambia',
  GH:'Ghana', GN:'Guinea', GW:'Guinea-Bissau', KE:'Kenya', LS:'Lesotho',
  LR:'Liberia', LY:'Libya', MG:'Madagascar', MW:'Malawi', ML:'Mali',
  MR:'Mauritania', MU:'Mauritius', MA:'Morocco', MZ:'Mozambique',
  NA:'Namibia', NE:'Niger', NG:'Nigeria', RW:'Rwanda', ST:'Sao Tome and Principe',
  SN:'Senegal', SL:'Sierra Leone', SO:'Somalia', ZA:'South Africa',
  SS:'South Sudan', SD:'Sudan', TG:'Togo', TN:'Tunisia', UG:'Uganda',
  TZ:'Tanzania', ZM:'Zambia', ZW:'Zimbabwe',
};

const SECTOR_MAP: Record<string, string> = {
  'climat':'Climate & Environment', 'climate':'Climate & Environment',
  'environnement':'Climate & Environment', 'biodiversit':'Climate & Environment',
  'agricult':'Agriculture & Food Security', 'rural':'Agriculture & Food Security',
  'sant':'Health', 'health':'Health', 'médical':'Health',
  'éducation':'Education', 'education':'Education', 'formation':'Education',
  'finance':'Finance & Economics', 'financ':'Finance & Economics',
  'budget':'Finance & Economics', 'comptab':'Finance & Economics',
  'genre':'Gender & Social Inclusion', 'gender':'Gender & Social Inclusion',
  'gouvernance':'Governance & Public Policy', 'politique':'Governance & Public Policy',
  'juridique':'Governance & Public Policy', 'droit':'Human Rights',
  'infrastructure':'Infrastructure & Urban Development', 'urbain':'Infrastructure & Urban Development',
  'digital':'Innovation & Technology', 'numérique':'Innovation & Technology',
  'paix':'Peacebuilding', 'crise':'Peacebuilding', 'conflit':'Peacebuilding',
  'privé':'Private Sector Development', 'entreprise':'Private Sector Development',
  'jeunesse':'Youth & Employment', 'emploi':'Youth & Employment',
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
  if (/\bstage\b|\binternship\b|\balternance\b|\bapprenticeship\b|\bvia\b|\bvsc\b/.test(t)) return 'internship';
  if (/\bconsultant\b|\bconsultanc/.test(t)) return 'consultancy';
  return 'jobs';
}

function orgFor(text: string): string {
  return /proparco/i.test(text) ? 'Proparco (AFD Group)' : 'Agence Française de Développement (AFD)';
}

function stripHtml(html: string): string {
  return (html || '')
    .replace(/<\/?(li|p|br|h[1-6]|div)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
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

function parseUSDate(mdY: string): string | null {
  const m = mdY?.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, mo, day, yr] = m;
  return `${yr}-${mo.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

async function getSessionToken(): Promise<string | null> {
  const res = await fetch(CAREER_SITE_URL, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AfroramaBot/1.0)' } });
  if (!res.ok) return null;
  const html = await res.text();
  const match = html.match(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/);
  return match ? match[0] : null;
}

Deno.serve(async () => {
  console.log('[afd-scraper] Starting...');

  try {
    const token = await getSessionToken();
    if (!token) {
      console.error('[afd-scraper] Could not extract session token from career site HTML.');
      return Response.json({ error: 'Could not extract session token' }, { status: 502 });
    }

    let totalImported = 0, totalSkipped = 0;
    let pageNumber = 1;
    const pageSize = 25;
    let totalCount = Infinity;
    const africanReqs: any[] = [];

    while ((pageNumber - 1) * pageSize < totalCount) {
      const res = await fetch(JOBS_API_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          careerSiteId: CAREER_SITE_ID, careerSitePageId: CAREER_SITE_ID,
          pageNumber, pageSize, cultureId: 1, searchText: '', cultureName: 'en-US',
          states: [], countryCodes: [], cities: [], placeID: '', radius: null,
          postingsWithinDays: null, customFieldCheckboxKeys: [], customFieldDropdowns: [], customFieldRadios: [],
        }),
      });
      if (!res.ok) { console.error(`[afd-scraper] Jobs API error: ${res.status}`); break; }

      const json = await res.json() as any;
      totalCount = json?.data?.totalCount ?? 0;
      const reqs: any[] = json?.data?.requisitions ?? [];
      console.log(`[afd-scraper] Page ${pageNumber}: ${reqs.length} jobs (total ${totalCount})`);

      for (const r of reqs) {
        const country = (r.locations || []).find((l: any) => AFRICA_ISO[l.country])?.country;
        if (country) africanReqs.push({ ...r, _iso: country });
      }

      if (reqs.length === 0) break;
      pageNumber++;
      await new Promise(r => setTimeout(r, 200));
    }

    console.log(`[afd-scraper] Found ${africanReqs.length} African requisitions out of ${totalCount} total`);

    for (const req of africanReqs) {
      const id    = String(req.requisitionId);
      const title = (req.displayJobTitle || '').trim();
      // AFD occasionally leaves unfinished draft postings live with
      // placeholder titles like "- copy" — not real job titles, skip.
      if (title.replace(/^[-\s]+/, '').length < 5) {
        console.log(`[afd-scraper] ${id}: skipping placeholder title "${title}"`);
        continue;
      }
      const iso   = req._iso;
      const org   = orgFor(`${title} ${req.externalDescription || ''}`);

      const deadline = parseUSDate(req.postingExpirationDate);
      if (deadline && new Date(deadline) < new Date()) {
        console.log(`[afd-scraper] ${id}: skipping expired posting (closed ${deadline})`);
        continue;
      }

      const bodyText = stripHtml(req.externalDescription || '');
      const { description, salary } = await formatWithClaude(title, org, bodyText);
      const posted = req.postingEffectiveDate ? parseUSDate(req.postingEffectiveDate) : null;

      const result = await supabase.from('listings').upsert({
        id: `afd-${id}`, title, organisation: org, type: mapType(title),
        sector: mapSector(`${title} ${bodyText}`), location: AFRICA_ISO[iso], country: iso,
        deadline, posted: posted || new Date().toISOString().split('T')[0],
        salary, description,
        apply_url: `https://afd.csod.com/ux/ats/careersite/${CAREER_SITE_ID}/home/requisition/${id}?c=afd&lang=en-US`,
        org_domain: 'afd.fr', source: 'AFD', views: 0, apply_clicks: 0, paid_listing: false,
      }, { onConflict: 'id', ignoreDuplicates: false });

      if (result?.error) { console.error(`[afd-scraper] Upsert error: ${result.error.message}`); totalSkipped++; }
      else totalImported++;

      await trySubmitSalary(supabase, {
        company: org, position: title, salaryText: salary,
        sector: mapSector(`${title} ${bodyText}`), country: iso,
      });

      await new Promise(r => setTimeout(r, 200));
    }

    console.log(`[afd-scraper] Done. Imported: ${totalImported}, Skipped: ${totalSkipped}`);
    return Response.json({ imported: totalImported, skipped: totalSkipped, africanFound: africanReqs.length, totalAvailable: totalCount });

  } catch (err) {
    console.error('[afd-scraper] UNCAUGHT:', (err as Error).message);
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
});
