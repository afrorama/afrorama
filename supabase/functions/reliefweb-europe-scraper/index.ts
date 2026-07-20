/**
 * Afrorama — reliefweb-europe-scraper Edge Function
 *
 * Fetches jobs from major European INGOs on ReliefWeb that are
 * Africa-focused but based in Europe (London, Paris, Brussels, Geneva, etc.)
 *
 * Strategy: query ReliefWeb for jobs whose SOURCE organisation is one of
 * the known Africa-focused INGOs headquartered in Europe. This captures
 * posts like "Programme Manager (East Africa desk) — London" that a pure
 * country=Africa filter misses.
 *
 * Schedule daily via pg_cron:
 *   SELECT cron.schedule('reliefweb-europe-daily', '0 7 * * *',
 *     $$SELECT net.http_post(url := 'https://vqchwioyhyiuunpyildz.supabase.co/functions/v1/reliefweb-europe-scraper',
 *       headers := '{"Authorization":"Bearer SERVICE_ROLE_KEY"}'::jsonb)$$);
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { trySubmitSalary } from '../_shared/currency.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// Major Africa-focused INGOs headquartered in Europe.
// ReliefWeb source names must match exactly — verified against
// https://api.reliefweb.int/v2/sources?appname=afrorama
const EUROPE_AFRICA_ORGS = [
  // UK
  'Oxfam', 'Save the Children', 'Action Against Hunger UK',
  'Tearfund', 'Christian Aid', 'WaterAid', 'Plan International',
  'Concern Worldwide', 'Practical Action', 'Bond',
  'Overseas Development Institute', 'International Alert',
  'Restless Development', 'VSO', 'Voluntary Service Overseas',
  'ActionAid', 'CARE International UK', 'IRC', 'International Rescue Committee',
  'Sightsavers', 'Leonard Cheshire', 'Marie Stopes International',
  'Population Services International', 'Malaria Consortium',
  'African Wildlife Foundation', 'IIED',

  // France / francophone
  "Action contre la Faim", 'ACTED', 'Solidarités International',
  'Triangle Génération Humanitaire', 'ALIMA', 'Première Urgence Internationale',
  'GRET', 'CCFD-Terre Solidaire',

  // Belgium / Netherlands
  'Enabel', 'Caritas International', 'Handicap International',
  'Louvain Coopération', 'SNV Netherlands Development Organisation',
  'Hivos', 'ICCO Cooperation', 'Both ENDS',

  // Germany / Switzerland / Nordics
  'GIZ', 'Welthungerhilfe', 'Diakonie Katastrophenhilfe',
  'Swisscontact', 'Helvetas', 'Interpeace',
  'Norwegian Refugee Council', 'Norwegian Church Aid',
  'Danish Refugee Council', 'Mercy Corps',
  'International Federation of Red Cross and Red Crescent Societies',
  'IFRC', 'ICRC',

  // European-headquartered multilaterals / think tanks
  'European Commission', 'European Investment Bank',
  'Chatham House', 'ODI', 'ECDPM',
];

// African keywords — any hit in title = include even if org not in list above
const AFRICA_KEYWORDS = [
  'africa', 'african', 'sub-saharan',
  'kenya', 'nigeria', 'ethiopia', 'ghana', 'uganda', 'tanzania', 'rwanda',
  'senegal', 'mozambique', 'zambia', 'malawi', 'zimbabwe', 'somalia',
  'south africa', 'cameroon', "côte d'ivoire", 'ivory coast', 'mali',
  'niger', 'chad', 'burkina faso', 'madagascar', 'angola', 'drc', 'congo',
  'sudan', 'south sudan', 'sierra leone', 'liberia', 'guinea',
];

// European duty-station countries to search
const EUROPE_COUNTRIES = [
  'United Kingdom', 'France', 'Belgium', 'Netherlands', 'Germany',
  'Switzerland', 'Sweden', 'Norway', 'Denmark', 'Italy', 'Spain',
  'Austria', 'Ireland', 'Finland',
];

const SECTOR_MAP: Record<string, string> = {
  'Program/Project Management':             'Governance & Public Policy',
  'Monitoring and Evaluation':              'Governance & Public Policy',
  'Health':                                 'Health',
  'Education':                              'Education',
  'Food and Nutrition':                     'Agriculture & Food Security',
  'Agriculture':                            'Agriculture & Food Security',
  'Water Sanitation Hygiene':               'Infrastructure & Urban Development',
  'Protection and Human Rights':            'Human Rights',
  'Gender':                                 'Gender & Social Inclusion',
  'Environment and DRR':                    'Climate & Environment',
  'Finance':                                'Finance & Economics',
  'Communication and Outreach':             'Governance & Public Policy',
  'Information and Communication Technology': 'Innovation & Technology',
  'Research':                               'Governance & Public Policy',
  'Advocacy':                               'Governance & Public Policy',
  'Donor Relations/Grants Management':      'Finance & Economics',
  'Logistics and Supply Chain':             'Infrastructure & Urban Development',
  'Human Resources':                        'Governance & Public Policy',
};

const ORG_SET = new Set(EUROPE_AFRICA_ORGS.map(o => o.toLowerCase()));

function isAfricaFocused(title: string, orgName: string, bodyText: string): boolean {
  const t = (title + ' ' + orgName + ' ' + bodyText.slice(0, 500)).toLowerCase();
  return AFRICA_KEYWORDS.some(kw => t.includes(kw));
}

const DISCLAIMER = '\n\n─────────────────────────────────────\nThis summary is automatically generated. For the complete job description, view the original posting.';

function fallbackDesc(bodyText: string, org?: string): string {
  const lines = (bodyText || '')
    .split('\n')
    .map(l => l.trim().replace(/^[-•*–·]\s*/, ''))
    .filter(l => l.length > 30)
    .slice(0, 3);
  if (!lines.length) {
    return `${org || 'This organisation'} has posted this opportunity. Please view the original posting for full details.${DISCLAIMER}`;
  }
  return lines.map(l => `• ${l.charAt(0).toUpperCase() + l.slice(1)}`).join('\n') + DISCLAIMER;
}

async function formatDescription(bodyText: string, title: string, org: string): Promise<{ description: string; salary: string }> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey || !bodyText || bodyText.length < 80) {
    return { description: fallbackDesc(bodyText, org), salary: 'See listing' };
  }
  const prompt = `You are writing a job summary for Afrorama, Africa's social impact job board. Format the job description below in British English.

Task 1 — Write exactly 5 bullet points:
- Bullet 1: what the role is actually about (from the opening/overview)
- Bullets 2–5: each begins with a strong imperative verb (Lead, Manage, Develop, Coordinate, Deliver, Foster, Build, Drive)
- Concise, action-oriented, parallel structure, no fluff, no passive voice
- British English spelling (organise, programme, analyse, prioritise)

Task 2 — Extract salary or compensation:
- Explicit figures, UN/NGO grades (P3, G5, Band C etc.), qualitative terms (Competitive, Market-related)
- Write "none" if absolutely zero mention of pay, salary, grade, or compensation

Job: ${title} at ${org}
Description:
${bodyText.slice(0, 2000)}

Return in this exact format:
BULLETS:
• [bullet 1]
• [bullet 2]
• [bullet 3]
• [bullet 4]
• [bullet 5]
SALARY: [salary or none]`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 400, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!res.ok) return { description: fallbackDesc(bodyText, org), salary: 'See listing' };
    const data        = await res.json() as { content: { text: string }[] };
    const raw         = data.content?.[0]?.text?.trim() || '';
    const bulletMatch = raw.match(/BULLETS:\s*([\s\S]*?)(?=SALARY:|$)/i);
    const salaryMatch = raw.match(/SALARY:\s*(.+)/i);
    const bullets     = bulletMatch?.[1]?.trim() || fallbackDesc(bodyText, org);
    const salaryRaw   = salaryMatch?.[1]?.trim() || 'none';
    return { description: bullets + DISCLAIMER, salary: salaryRaw.toLowerCase() === 'none' ? 'See listing' : salaryRaw };
  } catch {
    return { description: fallbackDesc(bodyText, org), salary: 'See listing' };
  }
}

Deno.serve(async () => {
  console.log('[reliefweb-europe-scraper] Starting…');

  const FIELDS = ['title', 'body', 'date', 'source', 'country', 'career_categories', 'url_alias', 'experience', 'how_to_apply-html'];

  // Two passes: (1) known Africa-focused European orgs regardless of country,
  // (2) European-country jobs from any org where title contains Africa keywords.
  // We combine and deduplicate by item.id before upserting.
  const allItems = new Map<string, any>();

  // Pass 1 — jobs from known Africa-focused European orgs (any location)
  const pass1Parts = [
    'appname=afrorama-europe-scraper',
    'limit=100',
    'sort[]=date.created:desc',
    'filter[operator]=OR',
    ...EUROPE_AFRICA_ORGS.map(o => `filter[conditions][][field]=source.name&filter[conditions][][value]=${encodeURIComponent(o)}`),
    ...FIELDS.map(f => `fields[include][]=${f}`),
  ];
  // Note: ReliefWeb filter syntax with conditions array requires a slightly
  // different format — use the simpler source name text filter approach
  const pass1Url = `https://api.reliefweb.int/v2/jobs?appname=afrorama-europe-scraper&limit=100&sort[]=date.created:desc&filter[field]=source.name&filter[operator]=OR${EUROPE_AFRICA_ORGS.map(o => `&filter[value][]=${encodeURIComponent(o)}`).join('')}&${FIELDS.map(f => `fields[include][]=${f}`).join('&')}`;

  // Pass 2 — jobs in European countries (catch-all, will filter by keyword below)
  const pass2Url = `https://api.reliefweb.int/v2/jobs?appname=afrorama-europe-scraper&limit=100&sort[]=date.created:desc&filter[field]=country&filter[operator]=OR${EUROPE_COUNTRIES.map(c => `&filter[value][]=${encodeURIComponent(c)}`).join('')}&${FIELDS.map(f => `fields[include][]=${f}`).join('&')}`;

  for (const url of [pass1Url, pass2Url]) {
    console.log('[reliefweb-europe-scraper] Fetching:', url.slice(0, 120) + '…');
    const res = await fetch(url);
    if (!res.ok) { console.error('[reliefweb-europe-scraper] API error', res.status); continue; }
    const json = await res.json() as { data: any[] };
    for (const item of (json.data || [])) {
      if (!allItems.has(item.id)) allItems.set(item.id, item);
    }
  }

  console.log(`[reliefweb-europe-scraper] ${allItems.size} unique items before filtering`);

  let imported = 0, skipped = 0;

  for (const item of allItems.values()) {
    const f   = item.fields;
    const org = ((f.source || []) as any[]).map((s: any) => s.name).join(', ') || 'Unknown';

    // Derive readable location — prefer first country listed
    const jobCountries = ((f.country || []) as any[]).map((c: any) => c.name as string);
    const location     = jobCountries[0] || 'Europe';

    // Strip HTML for body text
    const bodyHtml = (f.body || '') as string;
    const bodyText = bodyHtml
      .replace(/<\/?(li|p|br|h[1-6]|div)[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

    // Keep only if: known Africa-focused org OR title/body mentions Africa
    const orgKnown    = ORG_SET.has(org.toLowerCase()) ||
      EUROPE_AFRICA_ORGS.some(o => org.toLowerCase().includes(o.toLowerCase()));
    const africaMatch = isAfricaFocused(f.title || '', org, bodyText);
    if (!orgKnown && !africaMatch) {
      skipped++;
      continue;
    }

    const deadlineRaw = (f.date as any)?.deadline;
    const deadline    = deadlineRaw ? new Date(deadlineRaw).toISOString().split('T')[0] : null;
    if (deadline && new Date(deadline) < new Date()) { skipped++; continue; }

    const cats     = ((f.career_categories || []) as any[]).map((c: any) => c.name as string);
    const sector   = SECTOR_MAP[cats[0]] || 'Governance & Public Policy';
    const rawAlias = f.url_alias || '';
    const rwUrl    = rawAlias.startsWith('http') ? rawAlias : rawAlias ? `https://reliefweb.int${rawAlias}` : `https://reliefweb.int/job/${item.id}`;
    const howToApplyHtml = (f['how_to_apply-html'] || '') as string;
    const directMatch    = howToApplyHtml.match(/href=["']([^"']+)["']/i);
    const directUrl      = directMatch?.[1] || '';
    const applyUrl       = (directUrl && directUrl.startsWith('http') && !directUrl.includes('reliefweb.int')) ? directUrl : rwUrl;

    const { description, salary } = await formatDescription(bodyText, f.title || '', org);

    const entry = {
      id:           'rwe-' + item.id,
      title:        f.title || 'Untitled',
      organisation: org,
      type:         'jobs',
      sector,
      location,
      country:      'EU',
      deadline,
      posted:       (f.date as any)?.created?.slice(0, 10) || new Date().toISOString().split('T')[0],
      salary,
      description,
      apply_url:    applyUrl,
      experience:   ((f.experience || []) as any[]).map((e: any) => e.name).join(', ') || null,
      org_domain:   null,
      source:       'ReliefWeb',
      views:        0,
      apply_clicks: 0,
      paid_listing: false,
    };

    const { error } = await supabase.from('listings').upsert(entry, { onConflict: 'id', ignoreDuplicates: false });
    if (error) { console.error('[reliefweb-europe-scraper] Upsert error:', error.message); skipped++; }
    else {
      imported++;
      await trySubmitSalary(supabase, {
        company: org, position: f.title || '', salaryText: salary,
        experienceText: entry.experience || '', sector, country: 'EU',
      });
    }
  }

  console.log(`[reliefweb-europe-scraper] Done. Imported: ${imported}, Skipped: ${skipped}`);
  return Response.json({ imported, skipped });
});
