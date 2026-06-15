/**
 * Afrorama — workable-scraper Edge Function
 *
 * Fetches jobs from Workable career pages for curated African-focused orgs.
 * Workable public API: https://www.workable.com/api/accounts/{subdomain}/jobs
 *
 * Deploy:
 *   supabase functions deploy workable-scraper
 *
 * Schedule daily:
 *   SELECT cron.schedule('workable-daily', '0 10 * * *', $$SELECT net.http_post(...)$$);
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const DISCLAIMER = '\n\n─────────────────────────────────────\nThis summary is automatically generated for quick reference. For the complete and authoritative job description, please view the original posting.';

const ORGS: { subdomain: string; name: string; country: string }[] = [
  { subdomain: 'evidence-action',                        name: 'Evidence Action',                          country: 'KE' },
  { subdomain: 'eed',                                    name: 'EED',                                      country: 'KE' },
  { subdomain: 'ciff',                                   name: 'Children\'s Investment Fund Foundation',   country: 'KE' },
  { subdomain: 'inkomoko',                               name: 'Inkomoko',                                 country: 'RW' },
  { subdomain: 'partechpartners',                        name: 'Partech Partners',                         country: 'SN' },
  { subdomain: 'trocaire',                               name: 'Trócaire',                                 country: 'KE' },
  { subdomain: 'hi-jobs',                                name: 'Handicap International',                   country: 'KE' },
  { subdomain: 'worldfish',                              name: 'WorldFish',                                country: 'KE' },
  { subdomain: 'action-against-hunger',                  name: 'Action Against Hunger',                    country: 'KE' },
  { subdomain: 'wateraid',                               name: 'WaterAid',                                 country: 'KE' },
  { subdomain: 'medecins-du-monde',                      name: 'Médecins du Monde',                        country: 'KE' },
  { subdomain: 'thinkwell',                              name: 'ThinkWell',                                country: 'KE' },
  { subdomain: 'icarda',                                 name: 'ICARDA',                                   country: 'MA' },
  { subdomain: 'streetchildcareers',                     name: 'Street Child',                             country: 'SL' },
  { subdomain: 'openfn',                                 name: 'OpenFn',                                   country: 'KE' },
  { subdomain: 'ide-global',                             name: 'iDE Global',                               country: 'KE' },
  { subdomain: 'zincnetwork',                            name: 'Zinc Network',                             country: 'KE' },
  { subdomain: 'waterequity',                            name: 'WaterEquity',                              country: 'KE' },
  { subdomain: 'climateworks-foundation-1',              name: 'ClimateWorks Foundation',                  country: 'KE' },
  { subdomain: 'international-water-management-institute',name: 'International Water Management Institute',country: 'GH' },
  { subdomain: 'rising-academies',                       name: 'Rising Academies',                         country: 'SL' },
  { subdomain: 'centre-for-information-resilience',      name: 'Centre for Information Resilience',        country: 'KE' },
  { subdomain: 'the-halo-trust',                         name: 'The HALO Trust',                           country: 'KE' },
  { subdomain: 'control-risks-6',                        name: 'Control Risks',                            country: 'KE' },
  // New additions
  { subdomain: 'brac-international',                     name: 'BRAC International',                       country: 'KE' },
  { subdomain: 'abt',                                    name: 'Abt Associates',                           country: 'KE' },
  { subdomain: 'concern-worldwide',                      name: 'Concern Worldwide',                        country: 'KE' },
  { subdomain: 'psi-impact',                             name: 'Population Services International',        country: 'KE' },
  { subdomain: 'tearfund',                               name: 'Tearfund',                                 country: 'KE' },
  { subdomain: 'international-alert',                    name: 'International Alert',                      country: 'KE' },
  { subdomain: 'nrc',                                    name: 'Norwegian Refugee Council',                country: 'KE' },
  { subdomain: 'oxfam-gb',                               name: 'Oxfam GB',                                 country: 'KE' },
  { subdomain: 'africasoil',                             name: 'Africa Soil Information Service',          country: 'KE' },
  { subdomain: 'kcic',                                   name: 'Kenya Climate Innovation Centre',          country: 'KE' },
  { subdomain: 'komaza',                                 name: 'Komaza',                                   country: 'KE' },
  { subdomain: 'sunculture',                             name: 'SunCulture',                               country: 'KE' },
  { subdomain: 'twiga-foods',                            name: 'Twiga Foods',                              country: 'KE' },
  { subdomain: 'asante-africa',                          name: 'Asante Africa Foundation',                 country: 'KE' },
  { subdomain: 'sightsavers',                            name: 'Sightsavers',                              country: 'KE' },
  { subdomain: 'hki',                                    name: 'Helen Keller International',               country: 'KE' },
  { subdomain: 'medair',                                 name: 'Medair',                                   country: 'KE' },
  { subdomain: 'goal',                                   name: 'GOAL',                                     country: 'KE' },
  { subdomain: 'lutheran-world-federation',              name: 'Lutheran World Federation',                country: 'KE' },
  { subdomain: 'sei',                                    name: 'Stockholm Environment Institute',          country: 'KE' },
  { subdomain: 'iied',                                   name: 'IIED',                                     country: 'KE' },
  { subdomain: 'tetratech',                              name: 'Tetra Tech',                               country: 'KE' },
  { subdomain: 'msh',                                    name: 'Management Sciences for Health',           country: 'KE' },
  { subdomain: 'cbm',                                    name: 'CBM International',                        country: 'KE' },
  { subdomain: 'intersos',                               name: 'INTERSOS',                                 country: 'KE' },
  { subdomain: 'acted',                                  name: 'ACTED',                                    country: 'KE' },
  { subdomain: 'coopi',                                  name: 'COOPI',                                    country: 'KE' },
  { subdomain: 'climategroup',                           name: 'The Climate Group',                        country: 'ZA' },
  { subdomain: 'e3g',                                    name: 'E3G',                                      country: 'KE' },
  { subdomain: 'solv-africa',                            name: 'Solv Africa',                              country: 'KE' },
  { subdomain: 'weworld',                                name: 'WeWorld',                                  country: 'KE' },
  { subdomain: 'plan-international',                     name: 'Plan International',                       country: 'KE' },
  { subdomain: 'oxfam-international',                    name: 'Oxfam International',                     country: 'KE' },
];

const AFRICA_ISO = new Set([
  'KE','ZA','NG','SN','ET','GH','TZ','UG','RW','ZM','MZ','MW','ZW','BW','NA',
  'CM','CI','BF','ML','NE','TD','SD','SS','SO','CD','CG','AO','BJ','BI','CV',
  'CF','KM','DJ','EG','GQ','ER','SZ','GA','GM','GN','GW','LS','LR','LY','MG',
  'MR','MU','MA','ST','SL','TG','TN',
]);

const AFRICA_NAMES_LOWER = new Set([
  'kenya','south africa','nigeria','senegal','ethiopia','ghana','tanzania',
  'uganda','rwanda','zambia','mozambique','malawi','zimbabwe','botswana',
  'namibia','cameroon',"côte d'ivoire","cote d'ivoire",'ivory coast',
  'burkina faso','mali','niger','chad','sudan','south sudan','somalia',
  'democratic republic of the congo','dr congo','congo','angola','benin',
  'burundi','cabo verde','cape verde','central african republic','comoros',
  'djibouti','egypt','equatorial guinea','eritrea','eswatini','gabon',
  'gambia','guinea','guinea-bissau','lesotho','liberia','libya','madagascar',
  'mauritania','mauritius','morocco','sierra leone','togo','tunisia',
  'africa',
]);

const COUNTRY_ISO: Record<string, string> = {
  'Kenya':'KE','South Africa':'ZA','Nigeria':'NG','Senegal':'SN','Ethiopia':'ET',
  'Ghana':'GH','Tanzania':'TZ','Uganda':'UG','Rwanda':'RW','Zambia':'ZM',
  'Mozambique':'MZ','Malawi':'MW','Zimbabwe':'ZW','Botswana':'BW','Namibia':'NA',
  'Cameroon':'CM',"Côte d'Ivoire":'CI','Burkina Faso':'BF','Mali':'ML','Niger':'NE',
  'Chad':'TD','Sudan':'SD','South Sudan':'SS','Somalia':'SO',
  'Democratic Republic of the Congo':'CD','Congo':'CG','Angola':'AO','Benin':'BJ',
  'Burundi':'BI','Cabo Verde':'CV','Central African Republic':'CF','Comoros':'KM',
  'Djibouti':'DJ','Egypt':'EG','Equatorial Guinea':'GQ','Eritrea':'ER',
  'Eswatini':'SZ','Gabon':'GA','Gambia':'GM','Guinea':'GN','Guinea-Bissau':'GW',
  'Lesotho':'LS','Liberia':'LR','Libya':'LY','Madagascar':'MG','Mauritania':'MR',
  'Mauritius':'MU','Morocco':'MA','Sierra Leone':'SL','Togo':'TG','Tunisia':'TN',
};

function isAfricanLocation(text: string, fallbackIso: string): { iso: string; name: string } | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const name of AFRICA_NAMES_LOWER) {
    if (lower.includes(name)) {
      for (const [canonical, iso] of Object.entries(COUNTRY_ISO)) {
        if (canonical.toLowerCase() === name) return { iso, name: canonical };
      }
      return { iso: fallbackIso, name: text };
    }
  }
  const isoMatch = text.match(/\b([A-Z]{2})\b/);
  if (isoMatch && AFRICA_ISO.has(isoMatch[1])) return { iso: isoMatch[1], name: text };
  return null;
}

const SECTOR_MAP: Record<string, string> = {
  'engineering':'Innovation & Technology','technology':'Innovation & Technology',
  'software':'Innovation & Technology','data':'Innovation & Technology',
  'finance':'Finance & Economics','accounting':'Finance & Economics',
  'health':'Health','medical':'Health','nurse':'Health','doctor':'Health',
  'education':'Education','teaching':'Education',
  'program':'Governance & Public Policy','programme':'Governance & Public Policy',
  'policy':'Governance & Public Policy','research':'Governance & Public Policy',
  'communications':'Governance & Public Policy','marketing':'Governance & Public Policy',
  'operations':'Governance & Public Policy','hr':'Governance & Public Policy',
  'agriculture':'Agriculture & Food Security','food':'Agriculture & Food Security',
  'environment':'Climate & Environment','climate':'Climate & Environment','water':'Climate & Environment',
  'gender':'Gender & Social Inclusion','protection':'Human Rights',
  'legal':'Human Rights','human rights':'Human Rights',
};

function mapSector(dept: string): string {
  if (!dept) return 'Governance & Public Policy';
  const lower = dept.toLowerCase();
  for (const [key, val] of Object.entries(SECTOR_MAP)) {
    if (lower.includes(key)) return val;
  }
  return 'Governance & Public Policy';
}

function stripHtml(html: string): string {
  return (html || '')
    .replace(/<\/?(li|p|br|h[1-6]|div)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function fallbackDesc(bodyText: string, org: string): string {
  const firstLine = (bodyText || '').split('\n').map(l => l.trim()).find(l => l.length > 30) || '';
  const first = firstLine.replace(/^[-•*–·]\s*/, '').trim();
  const bullet1 = first ? `• ${first.charAt(0).toUpperCase() + first.slice(1)}` : `• Deliver impactful work as part of the ${org} team`;
  return [
    bullet1,
    '• Manage tasks with a focus on measurable impact and accountability',
    '• Develop strategies and solutions within your area of expertise',
    '• Collaborate with colleagues and partners to achieve shared goals',
    '• Drive outcomes that create lasting social impact across the region',
  ].join('\n') + DISCLAIMER;
}

async function formatWithClaude(title: string, org: string, description: string): Promise<{ description: string; salary: string }> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey || !description || description.length < 80) {
    return { description: fallbackDesc(description, org), salary: 'See listing' };
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
${description.slice(0, 2000)}

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
    if (!res.ok) return { description: fallbackDesc(description, org), salary: 'See listing' };

    const data        = await res.json() as { content: { text: string }[] };
    const raw         = data.content?.[0]?.text?.trim() || '';
    const bulletMatch = raw.match(/BULLETS:\s*([\s\S]*?)(?=SALARY:|$)/i);
    const salaryMatch = raw.match(/SALARY:\s*(.+)/i);

    const bullets   = bulletMatch?.[1]?.trim() || fallbackDesc(description, org);
    const salaryRaw = salaryMatch?.[1]?.trim() || 'none';
    const salary    = salaryRaw.toLowerCase() === 'none' ? 'See listing' : salaryRaw;

    return { description: bullets + DISCLAIMER, salary };
  } catch {
    return { description: fallbackDesc(description, org), salary: 'See listing' };
  }
}

Deno.serve(async (req) => {
  console.log('[workable-scraper] Starting...');

  // Support ?batch=N to process orgs in rotating batches (avoids timeout)
  const batchSize  = 12;
  const batchParam = new URL(req.url).searchParams.get('batch');
  const batch      = Math.max(0, parseInt(batchParam || '0', 10));
  const start      = (batch * batchSize) % ORGS.length;
  const orgs       = [...ORGS, ...ORGS].slice(start, start + batchSize);
  console.log(`[workable-scraper] Batch ${batch}: orgs ${start + 1}–${start + orgs.length} of ${ORGS.length}`);

  let totalImported = 0, totalSkipped = 0;

  for (const org of orgs) {
    await new Promise(r => setTimeout(r, 300));

    try {
      // Workable v3 public jobs API (POST, remote must be array not boolean)
      const res = await fetch(`https://apply.workable.com/api/v3/accounts/${org.subdomain}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'User-Agent': 'Afrorama/1.0' },
        body: JSON.stringify({ query: '', location: [], department: [], worktype: [], remote: [] }),
      });
      if (!res.ok) {
        console.warn(`[workable-scraper] ${org.name}: HTTP ${res.status}`);
        continue;
      }

      let json: any;
      try { json = await res.json(); } catch {
        console.warn(`[workable-scraper] ${org.name}: invalid JSON`);
        continue;
      }

      const jobs: any[] = json?.results || (Array.isArray(json) ? json : []);
      console.log(`[workable-scraper] ${org.name}: ${jobs.length} jobs`);

      for (const job of jobs) {
        const title  = job.title || 'Untitled';
        const jobId  = job.shortcode || String(job.id || '');
        if (!jobId) continue;

        // Workable returns countryCode directly — use it for fast Africa check
        const locCode    = (job.location?.countryCode || '').toUpperCase();
        const locCity    = job.location?.city || '';
        const locCountry = job.location?.country || '';

        const iso = AFRICA_ISO.has(locCode) ? locCode
          : isAfricanLocation(locCountry, org.country)?.iso
          || isAfricanLocation(title, org.country)?.iso
          || null;
        if (!iso) continue;

        const dept   = Array.isArray(job.department) ? job.department[0] : (job.department || '');
        const sector = mapSector(dept);
        const applyUrl = `https://apply.workable.com/${org.subdomain}/j/${jobId}`;
        const posted   = job.published_on?.slice(0, 10) || new Date().toISOString().split('T')[0];
        const deadline = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

        // Fetch full description
        let bodyText = '';
        try {
          const detailRes = await fetch(`https://apply.workable.com/api/v3/accounts/${org.subdomain}/jobs/${jobId}`, {
            headers: { 'Accept': 'application/json', 'User-Agent': 'Afrorama/1.0' },
          });
          if (detailRes.ok) {
            const detail = await detailRes.json() as any;
            bodyText = stripHtml(detail.description || detail.full_description || '');
          }
        } catch { /* use fallback */ }

        const { description, salary } = await formatWithClaude(title, org.name, bodyText);

        const entry = {
          id:           `wk-${org.subdomain}-${jobId}`,
          title,
          organisation: org.name,
          type:         'jobs',
          sector,
          location:     locCity || locCountry || iso,
          country:      iso,
          deadline,
          posted,
          salary,
          description, apply_url:    applyUrl,
          experience:   job.experience_level || null,
          org_domain:   `${org.subdomain}.workable.com`,
          source:       'Workable',
          views:        0,
          apply_clicks: 0,
          paid_listing: false,
        };

        const { error } = await supabase
          .from('listings')
          .upsert(entry, { onConflict: 'id', ignoreDuplicates: false });

        if (error) { console.error(`[workable-scraper] Upsert error: ${error.message}`); totalSkipped++; }
        else totalImported++;

        await new Promise(r => setTimeout(r, 200));
      }
    } catch (err) {
      console.warn(`[workable-scraper] ${org.name} failed:`, (err as Error).message);
    }
  }

  console.log(`[workable-scraper] Done. Imported: ${totalImported}, Skipped: ${totalSkipped}`);
  return Response.json({ imported: totalImported, skipped: totalSkipped });
});
