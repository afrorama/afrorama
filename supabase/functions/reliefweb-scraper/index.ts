/**
 * Afrorama — reliefweb-scraper Edge Function
 *
 * Fetches open jobs from the ReliefWeb API and upserts them
 * into the Supabase listings table.
 *
 * Schedule daily via pg_cron (add in Supabase SQL Editor):
 *   SELECT cron.schedule('reliefweb-daily', '0 6 * * *',
 *     $$SELECT net.http_post(url := 'https://vqchwioyhyiuunpyildz.supabase.co/functions/v1/reliefweb-scraper',
 *       headers := '{"Authorization":"Bearer SERVICE_ROLE_KEY"}'::jsonb)$$);
 *
 * Or trigger manually:
 *   supabase functions invoke reliefweb-scraper
 *
 * Deploy:
 *   supabase functions deploy reliefweb-scraper
 *
 * Supabase table needed (add to your schema):
 *   CREATE TABLE IF NOT EXISTS listings (
 *     id           TEXT PRIMARY KEY,
 *     title        TEXT NOT NULL,
 *     organisation TEXT,
 *     type         TEXT DEFAULT 'jobs',
 *     sector       TEXT,
 *     location     TEXT,
 *     country      TEXT,
 *     deadline     DATE,
 *     posted       DATE,
 *     salary       TEXT DEFAULT 'See listing',
 *     description  TEXT,
 *
 *     apply_url    TEXT,
 *     bitly_url    TEXT,
 *     utm_url      TEXT,
 *     source       TEXT DEFAULT 'ReliefWeb',
 *     views        INTEGER DEFAULT 0,
 *     apply_clicks INTEGER DEFAULT 0,
 *     paid_listing BOOLEAN DEFAULT false,
 *     created_at   TIMESTAMPTZ DEFAULT NOW()
 *   );
 *   ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
 *   CREATE POLICY "Anyone reads listings" ON listings FOR SELECT USING (true);
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// African countries to focus on (ISO codes mapped to ReliefWeb country names)
const AFRICA_COUNTRIES = [
  'Kenya', 'South Africa', 'Nigeria', 'Senegal', 'Ethiopia',
  'Ghana', 'Tanzania', 'Uganda', 'Rwanda', 'Zambia',
  'Mozambique', 'Malawi', 'Zimbabwe', 'Botswana', 'Namibia',
  'Cameroon', 'Côte d\'Ivoire', 'Burkina Faso', 'Mali', 'Niger',
  'Chad', 'Sudan', 'South Sudan', 'Somalia', 'Democratic Republic of the Congo',
];

// Map ReliefWeb categories to Afrorama sectors
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
  'Information and Communication Technology':'Innovation & Technology',
  'Research':                               'Governance & Public Policy',
};

// Map country names to ISO2 codes
const COUNTRY_ISO: Record<string, string> = {
  'Kenya':'KE','South Africa':'ZA','Nigeria':'NG','Senegal':'SN',
  'Ethiopia':'ET','Ghana':'GH','Tanzania':'TZ','Uganda':'UG',
  'Rwanda':'RW','Zambia':'ZM','Mozambique':'MZ','Malawi':'MW',
  'Zimbabwe':'ZW','Botswana':'BW','Namibia':'NA','Cameroon':'CM',
  "Côte d'Ivoire":'CI','Burkina Faso':'BF','Mali':'ML','Niger':'NE',
  'Chad':'TD','Sudan':'SD','South Sudan':'SS','Somalia':'SO',
  'DR Congo':'CD','Democratic Republic of the Congo':'CD',
};

/* ================================================================
   AI-POWERED DESCRIPTION FORMATTER (Claude Haiku)
================================================================= */
const DISCLAIMER = '\n\n─────────────────────────────────────\nThis summary is automatically generated for quick reference. For the complete and authoritative job description, please view the original posting.';

// Uses real lines from the actual posting rather than fabricated, generic
// "responsibilities" — when AI summarisation isn't available, it's more
// honest to show less than to invent content that didn't come from the org.
function fallbackDesc(bodyText: string, org?: string): string {
  const lines = (bodyText || '')
    .split('\n')
    .map(l => l.trim().replace(/^[-•*–·]\s*/, ''))
    .filter(l => l.length > 30)
    .slice(0, 3);
  if (lines.length === 0) {
    return `${org || 'This organisation'} has posted this opportunity, but the description could not be automatically summarised. Please view the original posting for full details.${DISCLAIMER}`;
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
- Bullet 1 must be drawn directly from the opening or overview — capture what the role is actually about
- Bullets 2–5 must each begin with a strong imperative verb (e.g. Lead, Manage, Develop, Coordinate, Deliver, Foster, Build, Drive)
- Parallel imperative structure, addressing the reader directly
- Concise and action-oriented — no fluff, no passive voice, no vague verbs like "help" or "assist"
- British English spelling (organise, programme, analyse, prioritise)

Task 2 — Extract salary or compensation (be thorough):
- Extract ANY compensation clue — explicit figures, grades, bands, or qualitative terms
- Explicit: "USD 45,000–55,000/yr", "KES 150,000/month", "ZAR 800,000/yr"
- UN/NGO grades: if you see P3, G5, NOA, Band C etc. write e.g. "UN P3 grade"
- Qualitative: "Competitive", "Market-related", "Attractive package", "Commensurate with experience" — write as-is
- Allowances: "VLA USD 1,200/month", "per diem included", "daily subsistence allowance"
- Only write: none — if the text has absolutely zero mention of pay, salary, stipend, grade, band, allowance, or compensation

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
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages:   [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) { console.error('[formatter] Anthropic error:', res.status); return { description: fallbackDesc(bodyText, org), salary: 'See listing' }; }

    const data       = await res.json() as { content: { text: string }[] };
    const raw        = data.content?.[0]?.text?.trim() || '';
    const bulletMatch = raw.match(/BULLETS:\s*([\s\S]*?)(?=SALARY:|$)/i);
    const salaryMatch = raw.match(/SALARY:\s*(.+)/i);

    const bullets   = bulletMatch?.[1]?.trim() || fallbackDesc(bodyText, org);
    const salaryRaw = salaryMatch?.[1]?.trim() || 'none';
    const salary    = salaryRaw.toLowerCase() === 'none' ? 'See listing' : salaryRaw;

    return { description: bullets + DISCLAIMER, salary };
  } catch (err) {
    console.error('[formatter] Failed:', (err as Error).message);
    return { description: fallbackDesc(bodyText, org), salary: 'See listing' };
  }
}

Deno.serve(async () => {
  console.log('[reliefweb-scraper] Starting...');

  // GET request — ReliefWeb expects literal PHP-style brackets in the URL.
  // URLSearchParams would encode them, so build the query string manually.
  // Limit to 50 so full body text doesn't overflow the edge function response buffer.
  const FIELDS = ['title', 'body', 'date', 'source', 'country', 'career_categories', 'url_alias', 'experience', 'how_to_apply-html'];
  const queryParts = [
    'appname=afrorama-scraper-TB8NxEbw9yeWCmx',
    'limit=50',
    'sort[]=date.created:desc',
    ...FIELDS.map(f => `fields[include][]=${f}`),
  ];
  const rwUrl = `https://api.reliefweb.int/v2/jobs?${queryParts.join('&')}`;
  console.log('[reliefweb-scraper] Fetching:', rwUrl);

  const res = await fetch(rwUrl, { method: 'GET' });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`[reliefweb-scraper] API error: ${res.status} — ${errText}`);
    return Response.json({ imported: 0, skipped: 0, error: errText });
  }

  const json    = await res.json() as { data: any[] };
  const allJobs = json.data || [];
  console.log(`[reliefweb-scraper] Fetched ${allJobs.length} jobs from ReliefWeb`);

  const AFRICA_SET = new Set(AFRICA_COUNTRIES);
  let totalImported = 0, totalSkipped = 0;

  for (const item of allJobs) {
    const f = item.fields;

    // Filter to African countries only
    const jobCountries    = ((f.country || []) as any[]).map((c: any) => c.name as string);
    const africanCountry  = jobCountries.find(n => AFRICA_SET.has(n));
    if (!africanCountry) continue;

    const org        = ((f.source || []) as any[]).map((s: any) => s.name).join(', ') || 'Unknown';
    const cats       = ((f.career_categories || []) as any[]).map((c: any) => c.name as string);
    const sector     = SECTOR_MAP[cats[0]] || 'Governance & Public Policy';
    const iso        = COUNTRY_ISO[africanCountry] || 'KE';
    const experience = ((f.experience || []) as any[]).map((e: any) => e.name as string).join(', ') || null;

    const deadlineRaw = (f.date as any)?.deadline;
    const deadline    = deadlineRaw
      ? new Date(deadlineRaw).toISOString().split('T')[0]
      : null;

    // Extract direct employer URL from how_to_apply-html (preferred)
    // Falls back to ReliefWeb listing URL if no external link found
    const howToApplyHtml = (f['how_to_apply-html'] || '') as string;
    const directUrlMatch = howToApplyHtml.match(/href=["']([^"']+)["']/i);
    const directUrl = directUrlMatch?.[1] || '';

    const rawAlias = f.url_alias || '';
    const rwFallback = rawAlias.startsWith('http')
      ? rawAlias
      : rawAlias
        ? `https://reliefweb.int${rawAlias}`
        : `https://reliefweb.int/job/${item.id}`;

    const applyUrl = (directUrl && directUrl.startsWith('http') && !directUrl.includes('reliefweb.int'))
      ? directUrl
      : rwFallback;

    // Strip HTML and format into structured bullets
    const bodyHtml = (f.body || '') as string;
    const bodyText = bodyHtml
      .replace(/<\/?(li|p|br|h[1-6]|div)[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

    const { description, salary } = await formatDescription(bodyText, f.title || '', org);

    const entry = {
      id:           'rw-' + item.id,
      title:        f.title || 'Untitled',
      organisation: org,
      type:         'jobs',
      sector,
      location:     africanCountry,
      country:      iso,
      deadline,
      posted:       (f.date as any)?.created?.slice(0, 10) || new Date().toISOString().split('T')[0],
      salary,
      description, apply_url:    applyUrl,
      experience,
      org_domain:   null,
      source:       'ReliefWeb',
      views:        0,
      apply_clicks: 0,
      paid_listing: false,
    };

    const { error } = await supabase
      .from('listings')
      .upsert(entry, { onConflict: 'id', ignoreDuplicates: false });

    if (error) { console.error('[reliefweb-scraper] Upsert error:', error.message); totalSkipped++; }
    else totalImported++;
  }

  console.log(`[reliefweb-scraper] Done. Imported: ${totalImported}, Skipped: ${totalSkipped}`);
  return Response.json({ imported: totalImported, skipped: totalSkipped });
});
