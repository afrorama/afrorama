/**
 * Afrorama — undp-scraper Edge Function
 *
 * UNDP's careers site runs on Oracle Fusion Cloud Recruiting. The list
 * and detail endpoints are genuine public REST APIs — no login, no
 * session token needed (confirmed via plain curl). The list endpoint
 * gives ISO2 country codes directly but no full description; the detail
 * endpoint is fetched per African match for the real description and
 * deadline.
 *
 * Deploy: supabase functions deploy undp-scraper
 * Schedule daily via pg_cron, same pattern as the other scrapers.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { trySubmitSalary } from '../_shared/currency.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const DISCLAIMER = '\n\n─────────────────────────────────────\nThis summary is automatically generated for quick reference. For the complete and authoritative job description, please view the original posting.';
const API_BASE = 'https://estm.fa.em2.oraclecloud.com/hcmRestApi/resources/latest';
const SITE_URL = 'https://estm.fa.em2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/requisitions/job';
const PAGE_LIMIT = 100;
const MAX_PAGES = 5;

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
  'climate':'Climate & Environment', 'environment':'Climate & Environment', 'energy':'Climate & Environment',
  'agricult':'Agriculture & Food Security', 'food security':'Agriculture & Food Security',
  'health':'Health', 'hiv':'Health',
  'education':'Education',
  'finance':'Finance & Economics', 'financing':'Finance & Economics', 'economic':'Finance & Economics',
  'gender':'Gender & Social Inclusion', 'inclusion':'Gender & Social Inclusion',
  'governance':'Governance & Public Policy', 'policy':'Governance & Public Policy', 'rule of law':'Governance & Public Policy',
  'human rights':'Human Rights', 'protection':'Human Rights',
  'infrastructure':'Infrastructure & Urban Development', 'urban':'Infrastructure & Urban Development',
  'innovation':'Innovation & Technology', 'digital':'Innovation & Technology', 'data':'Innovation & Technology', 'information management':'Innovation & Technology',
  'peace':'Peacebuilding', 'conflict':'Peacebuilding', 'extremis':'Peacebuilding', 'security':'Peacebuilding',
  'private sector':'Private Sector Development', 'investment':'Private Sector Development', 'business':'Private Sector Development',
  'youth':'Youth & Employment', 'employment':'Youth & Employment',
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
  if (/\bconsultant\b|\bIC\b|\bindividual contractor\b/i.test(title)) return 'consultancy';
  return 'jobs';
}

// Many UNDP postings open with a lengthy internal-eligibility "Tiered
// Approach" notice (who's allowed to apply, by staff category) before the
// actual role description. Left in, it distracts Claude into summarising
// HR eligibility logistics instead of the job itself — strip it.
function stripTieredApproach(text: string): string {
  return text.replace(/Tiered Approach[\s\S]*?satisfy the eligibility to apply\.?/i, '').trim();
}

function stripHtml(html: string): string {
  const plain = (html || '')
    .replace(/<\/?(li|p|br|h[1-6]|div)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return stripTieredApproach(plain);
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
        messages: [{ role: 'user', content: `You are writing a job summary for Afrorama, Africa's social impact job board. The source text may be in French — write your output in English regardless. Format in British English.\n\nTask 1 — Write exactly 5 bullet points:\n- Bullet 1 drawn from the opening/overview\n- Bullets 2-5 begin with a strong imperative verb\n- Concise, action-oriented, British English spelling\n\nTask 2 — Extract salary or compensation (be thorough): explicit figures, UN grades (NPSA-9, P3, G5), "Competitive", allowances. Only write none if there is genuinely zero mention of pay/grade/compensation.\n\nJob: ${title} at ${org}\n\nDescription:\n${description.slice(0, 2000)}\n\nReturn:\nBULLETS:\n• [bullet 1]\n• [bullet 2]\n• [bullet 3]\n• [bullet 4]\n• [bullet 5]\nSALARY: [salary or none]` }],
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

Deno.serve(async () => {
  console.log('[undp-scraper] Starting...');

  try {
    const africanReqs: { id: string; title: string; iso: string; location: string }[] = [];
    let totalCount = Infinity;

    for (let page = 0; page < MAX_PAGES; page++) {
      const offset = page * PAGE_LIMIT;
      if (offset >= totalCount) break;

      const url = `${API_BASE}/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList&finder=findReqs;siteNumber=CX_1,facetsList=NONE,limit=${PAGE_LIMIT},sortBy=POSTING_DATES_DESC,offset=${offset}`;
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AfroramaBot/1.0)', 'Accept': 'application/json' } });
      if (!res.ok) { console.warn(`[undp-scraper] List page ${page}: HTTP ${res.status}`); break; }

      const json = await res.json() as any;
      const item = json?.items?.[0];
      totalCount = item?.TotalJobsCount ?? 0;
      const reqs: any[] = item?.requisitionList ?? [];
      console.log(`[undp-scraper] Offset ${offset}: ${reqs.length} jobs (total ${totalCount})`);

      for (const r of reqs) {
        const iso = AFRICA_ISO[r.PrimaryLocationCountry] ? r.PrimaryLocationCountry : null;
        if (iso) africanReqs.push({ id: String(r.Id), title: r.Title, iso, location: r.PrimaryLocation || AFRICA_ISO[iso] });
      }

      if (reqs.length < PAGE_LIMIT) break;
      await new Promise(r => setTimeout(r, 200));
    }

    console.log(`[undp-scraper] ${africanReqs.length} African requisitions found out of ${totalCount} total`);

    let totalImported = 0, totalSkipped = 0;
    const org = 'United Nations Development Programme (UNDP)';

    for (const req of africanReqs) {
      try {
        const dr = await fetch(
          `${API_BASE}/recruitingCEJobRequisitionDetails?expand=all&onlyData=true&finder=ById;Id=%22${req.id}%22,siteNumber=CX_1`,
          { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AfroramaBot/1.0)', 'Accept': 'application/json' } },
        );
        if (!dr.ok) { totalSkipped++; continue; }
        const detail = (await dr.json() as any)?.items?.[0];
        if (!detail) { totalSkipped++; continue; }

        const deadline = detail.ExternalPostedEndDate ? String(detail.ExternalPostedEndDate).slice(0, 10) : null;
        if (deadline && new Date(deadline) < new Date()) {
          console.log(`[undp-scraper] ${req.id}: skipping expired posting (closed ${deadline})`);
          continue;
        }

        const bodyText = stripHtml(detail.ExternalDescriptionStr || '');
        const { description, salary } = await formatWithClaude(req.title, org, bodyText);
        const posted = detail.ExternalPostedStartDate ? String(detail.ExternalPostedStartDate).slice(0, 10) : new Date().toISOString().split('T')[0];

        const result = await supabase.from('listings').upsert({
          id: `undp-${req.id}`, title: req.title, organisation: org, type: mapType(req.title),
          sector: mapSector(`${req.title} ${bodyText}`), location: req.location, country: req.iso,
          deadline, posted, salary, description,
          apply_url: `${SITE_URL}/${req.id}`,
          org_domain: 'undp.org', source: 'UNDP', views: 0, apply_clicks: 0, paid_listing: false,
        }, { onConflict: 'id', ignoreDuplicates: false });

        if (result?.error) { console.error(`[undp-scraper] Upsert error: ${result.error.message}`); totalSkipped++; }
        else totalImported++;

        await trySubmitSalary(supabase, {
          company: org, position: req.title, salaryText: salary,
          sector: mapSector(`${req.title} ${bodyText}`), country: req.iso,
        });

        await new Promise(r => setTimeout(r, 200));
      } catch (err) {
        console.warn(`[undp-scraper] ${req.id} failed:`, (err as Error).message);
        totalSkipped++;
      }
    }

    console.log(`[undp-scraper] Done. Imported: ${totalImported}, Skipped: ${totalSkipped}`);
    return Response.json({ imported: totalImported, skipped: totalSkipped, africanFound: africanReqs.length, totalAvailable: totalCount });

  } catch (err) {
    console.error('[undp-scraper] UNCAUGHT:', (err as Error).message);
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
});
