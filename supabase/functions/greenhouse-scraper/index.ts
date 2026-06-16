/**
 * Afrorama — greenhouse-scraper Edge Function
 *
 * Fetches jobs from Greenhouse job boards for curated African-focused orgs.
 * Greenhouse public API: https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs
 *
 * Deploy:
 *   supabase functions deploy greenhouse-scraper
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const DISCLAIMER = '\n\n─────────────────────────────────────\nThis summary is automatically generated for quick reference. For the complete and authoritative job description, please view the original posting.';

const ORGS: { token: string; name: string; country: string }[] = [
  { token: 'humanrightswatch',                          name: 'Human Rights Watch',                       country: 'KE' },
  { token: 'wikimedia',                                 name: 'Wikimedia Foundation',                     country: 'KE' },
  { token: 'oneearthfuture',                            name: 'One Earth Future',                         country: 'KE' },
  { token: 'givedirectly',                              name: 'GiveDirectly',                             country: 'KE' },
  { token: 'girleffect',                                name: 'Girl Effect',                              country: 'KE' },
  { token: 'acumen',                                    name: 'Acumen',                                   country: 'KE' },
  { token: 'globalenergyallianceforpeopleandplanetgeappllc', name: 'Global Energy Alliance for People and Planet', country: 'KE' },
  { token: 'theeconomistgroup',                         name: 'The Economist Group',                      country: 'KE' },
  { token: 'alu',                                       name: 'African Leadership University',             country: 'RW' },
  { token: 'imagineworldwide',                          name: 'Imagine Worldwide',                        country: 'KE' },
  { token: 'semafor',                                   name: 'Semafor',                                  country: 'KE' },
  { token: 'instiglio',                                 name: 'Instiglio',                                country: 'RW' },
  { token: 'educate',                                   name: 'Educate!',                                 country: 'UG' },
  { token: 'oneacrefundzambia',                         name: 'One Acre Fund Zambia',                     country: 'ZM' },
  { token: 'thenewyorktimes',                           name: 'The New York Times',                       country: 'KE' },
  { token: 'oafkenya',                                  name: 'One Acre Fund Kenya',                      country: 'KE' },
  { token: 'tiltingfuturescareers',                     name: 'Tilting Futures',                          country: 'KE' },
  { token: 'oneacrefundmalawi',                         name: 'One Acre Fund Malawi',                     country: 'MW' },
  { token: 'oneacrefunduganda',                         name: 'One Acre Fund Uganda',                     country: 'UG' },
  { token: 'deliveryassociates',                        name: 'Delivery Associates',                      country: 'KE' },
  { token: 'mastercardfoundation',                      name: 'Mastercard Foundation',                    country: 'GH' },
  { token: '350org',                                    name: '350.org',                                  country: 'KE' },
  { token: 'globalcitizenyear',                         name: 'Global Citizen Year',                      country: 'SN' },
  { token: '60decibelsinc',                             name: '60 Decibels',                              country: 'KE' },
  { token: 'theroom',                                   name: 'The Room',                                 country: 'ZA' },
  { token: 'financialtimes33',                          name: 'Financial Times',                          country: 'KE' },
  // New additions
  { token: 'roomtoread',                                name: 'Room to Read',                             country: 'KE' },
  { token: 'pih',                                       name: 'Partners in Health',                       country: 'RW' },
  { token: 'poverty-action',                            name: 'Innovations for Poverty Action',           country: 'KE' },
  { token: 'clintonhealthaccess',                       name: 'Clinton Health Access Initiative',         country: 'KE' },
  { token: 'villagereach',                              name: 'VillageReach',                             country: 'MZ' },
  { token: 'cgdev',                                     name: 'Center for Global Development',            country: 'KE' },
  { token: 'palladium',                                 name: 'Palladium',                                country: 'KE' },
  { token: 'pact',                                      name: 'Pact',                                     country: 'KE' },
  { token: 'wcs',                                       name: 'Wildlife Conservation Society',            country: 'KE' },
  { token: 'pathfinderinternational',                   name: 'Pathfinder International',                 country: 'ET' },
  { token: 'livinggoods',                               name: 'Living Goods',                             country: 'KE' },
  { token: 'idinsight',                                 name: 'IDinsight',                                country: 'KE' },
  { token: 'remitly',                                   name: 'Remitly',                                  country: 'KE' },
  { token: 'terraformation',                            name: 'Terraformation',                           country: 'KE' },
  { token: 'ssir',                                      name: 'Stanford Social Innovation Review',        country: 'KE' },
  { token: 'pri',                                       name: 'Population Reference Bureau',              country: 'KE' },
  { token: 'teachforall',                               name: 'Teach For All',                            country: 'KE' },
  { token: 'jpal',                                      name: 'J-PAL',                                    country: 'KE' },
  { token: '3ie',                                       name: '3ie',                                      country: 'KE' },
  { token: 'givewell',                                  name: 'GiveWell',                                 country: 'KE' },
  { token: 'openphilanthropy',                          name: 'Open Philanthropy',                        country: 'KE' },
  { token: 'convergence',                               name: 'Convergence Blended Finance',              country: 'KE' },
  { token: 'globaldev',                                 name: 'Global Development Incubator',             country: 'KE' },
  { token: 'crs',                                       name: 'Catholic Relief Services',                 country: 'KE' },
  { token: 'fhi360',                                    name: 'FHI 360',                                  country: 'KE' },
  { token: 'unitedpurpose',                             name: 'United Purpose',                           country: 'GH' },
  { token: 'nutritionintl',                             name: 'Nutrition International',                  country: 'KE' },
  { token: 'ippf',                                      name: 'International Planned Parenthood Federation', country: 'KE' },
  { token: 'wfpusa',                                    name: 'World Food Programme USA',                 country: 'KE' },
  { token: 'thenatureconservancy',                      name: 'The Nature Conservancy',                   country: 'KE' },
  { token: 'conservationinternational',                 name: 'Conservation International',               country: 'KE' },
  { token: 'worldwildlifefund',                         name: 'WWF',                                      country: 'KE' },
  { token: 'irc',                                       name: 'International Rescue Committee',           country: 'KE' },
  { token: 'mercycorps',                                name: 'Mercy Corps',                              country: 'KE' },
  { token: 'savethechildren',                           name: 'Save the Children',                        country: 'KE' },
  { token: 'oxfamamerica',                              name: 'Oxfam America',                            country: 'KE' },
  { token: 'care',                                      name: 'CARE',                                     country: 'KE' },
  { token: 'worldvision',                               name: 'World Vision',                             country: 'KE' },
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
  'africa','nairobi','lagos','accra','kampala','kigali','dar es salaam',
  'addis ababa','johannesburg','cape town','lusaka','lilongwe','harare',
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

// City → ISO fallback
const CITY_ISO: Record<string, string> = {
  'nairobi':'KE','mombasa':'KE','kisumu':'KE','lagos':'NG','abuja':'NG',
  'accra':'GH','kampala':'UG','kigali':'RW','dar es salaam':'TZ','dodoma':'TZ',
  'addis ababa':'ET','johannesburg':'ZA','cape town':'ZA','durban':'ZA',
  'lusaka':'ZM','lilongwe':'MW','harare':'ZW','dakar':'SN','abidjan':'CI',
  'kinshasa':'CD','luanda':'AO','maputo':'MZ','gaborone':'BW','windhoek':'NA',
  'antananarivo':'MG','bamako':'ML','ouagadougou':'BF','niamey':'NE',
  'conakry':'GN','freetown':'SL','monrovia':'LR','lomé':'TG','lome':'TG',
  'cotonou':'BJ','libreville':'GA','yaounde':'CM','banjul':'GM',
  'cairo':'EG','tunis':'TN','rabat':'MA','casablanca':'MA','khartoum':'SD',
  'mogadishu':'SO','asmara':'ER','djibouti':'DJ','malabo':'GQ',
};

function isAfricanLocation(text: string, fallbackIso: string): { iso: string; name: string } | null {
  if (!text) return null;
  const lower = text.toLowerCase();

  for (const name of AFRICA_NAMES_LOWER) {
    if (lower.includes(name)) {
      // Check city map first
      if (CITY_ISO[name]) return { iso: CITY_ISO[name], name: text };
      // Then country name map
      for (const [canonical, iso] of Object.entries(COUNTRY_ISO)) {
        if (canonical.toLowerCase() === name) return { iso, name: canonical };
      }
      return { iso: fallbackIso, name: text };
    }
  }
  return null;
}

const SECTOR_MAP: Record<string, string> = {
  'engineering':'Innovation & Technology','technology':'Innovation & Technology',
  'software':'Innovation & Technology','data':'Innovation & Technology',
  'finance':'Finance & Economics','accounting':'Finance & Economics',
  'health':'Health','medical':'Health',
  'education':'Education','teaching':'Education',
  'program':'Governance & Public Policy','programme':'Governance & Public Policy',
  'policy':'Governance & Public Policy','research':'Governance & Public Policy',
  'communications':'Governance & Public Policy','marketing':'Governance & Public Policy',
  'operations':'Governance & Public Policy',
  'agriculture':'Agriculture & Food Security','food':'Agriculture & Food Security',
  'environment':'Climate & Environment','climate':'Climate & Environment',
  'gender':'Gender & Social Inclusion',
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

function mapType(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('intern') || t.includes('trainee') || t.includes('volunteer')) return 'internship';
  if (t.includes('fellowship')) return 'capacity';
  if (t.includes('consultant') || t.includes('consultancy') || t.includes('advisor') || t.includes('adviser') || t.includes('contractor')) return 'consultancy';
  return 'jobs';
}

function extractDeadline(text: string): string | null {
  if (!text) return null;
  const patterns = [
    /(?:deadline|closing date|close[sd]? on|applications?\s+close|apply by|submit by|due date|applications?\s+due)[:\s]+([A-Za-z]+\.?\s+\d{1,2},?\s+\d{4})/i,
    /(?:deadline|closing date|close[sd]? on|applications?\s+close|apply by|submit by)[:\s]+(\d{1,2}\s+[A-Za-z]+\.?\s+\d{4})/i,
    /(?:deadline|closing date)[:\s]+(\d{4}-\d{2}-\d{2})/i,
    /submit.*?by\s+([A-Za-z]+\.?\s+\d{1,2},?\s+\d{4})/i,
  ];
  for (const p of patterns) {
    const m = p.exec(text);
    if (m) {
      const parsed = new Date(m[1].replace(/,/g, '').trim());
      if (!isNaN(parsed.getTime()) && parsed.getFullYear() >= new Date().getFullYear()) {
        return parsed.toISOString().split('T')[0];
      }
    }
  }
  return null;
}

function buildExcerpt(text: string): string {
  if (text.length <= 4000) return text;
  return text.slice(0, 3000) + '\n[...]\n' + text.slice(-1000);
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
${buildExcerpt(description)}

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
  console.log('[greenhouse-scraper] Starting...');

  // Batch support — 13 orgs per batch to stay within timeout
  const batchSize  = 13;
  const batchParam = new URL(req.url).searchParams.get('batch');
  const batch      = Math.max(0, parseInt(batchParam || '0', 10));
  const start      = (batch * batchSize) % ORGS.length;
  const orgs       = [...ORGS, ...ORGS].slice(start, start + batchSize);
  console.log(`[greenhouse-scraper] Batch ${batch}: orgs ${start + 1}–${start + orgs.length} of ${ORGS.length}`);

  let totalImported = 0, totalSkipped = 0;

  for (const org of orgs) {
    await new Promise(r => setTimeout(r, 300));

    try {
      // Greenhouse public board API — returns all jobs with location
      const url = `https://boards-api.greenhouse.io/v1/boards/${org.token}/jobs?content=true`;
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'Afrorama/1.0' },
      });

      if (!res.ok) {
        console.warn(`[greenhouse-scraper] ${org.name}: HTTP ${res.status}`);
        continue;
      }

      const json  = await res.json() as any;
      const jobs: any[] = json?.jobs || [];
      console.log(`[greenhouse-scraper] ${org.name}: ${jobs.length} jobs`);

      for (const job of jobs) {
        const title    = job.title || 'Untitled';
        const jobId    = String(job.id || '');
        if (!jobId) continue;

        // Greenhouse location: { name: "Nairobi, Kenya" } — a single string
        const locRaw = job.location?.name || job.offices?.[0]?.name || '';

        const locationByText = isAfricanLocation(locRaw, org.country);
        const titleSignal    = isAfricanLocation(title, org.country);
        // Include if location is African OR title signals Africa (catches non-Africa-based Africa roles)
        if (!locationByText && !titleSignal) continue;
        const location = locationByText || titleSignal!;

        // Department from departments array
        const dept   = job.departments?.[0]?.name || '';
        const sector = mapSector(dept);

        const applyUrl = job.absolute_url || `https://boards.greenhouse.io/${org.token}/jobs/${jobId}`;
        const posted   = job.updated_at?.slice(0, 10) || new Date().toISOString().split('T')[0];

        const bodyText = stripHtml(job.content || '');
        const deadline = extractDeadline(bodyText) || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
        const { description, salary } = await formatWithClaude(title, org.name, bodyText);

        const entry = {
          id:           `gh-${org.token}-${jobId}`,
          title,
          organisation: org.name,
          type:         mapType(title),
          sector,
          location:     locRaw || location.name,
          country:      location.iso,
          deadline,
          posted,
          salary,
          description, apply_url:    applyUrl,
          experience:   null,
          org_domain:   `${org.token}.greenhouse.io`,
          source:       'Greenhouse',
          views:        0,
          apply_clicks: 0,
          paid_listing: false,
        };

        const { error } = await supabase
          .from('listings')
          .upsert(entry, { onConflict: 'id', ignoreDuplicates: false });

        if (error) { console.error(`[greenhouse-scraper] Upsert error: ${error.message}`); totalSkipped++; }
        else totalImported++;

        await new Promise(r => setTimeout(r, 150));
      }
    } catch (err) {
      console.warn(`[greenhouse-scraper] ${org.name} failed:`, (err as Error).message);
    }
  }

  console.log(`[greenhouse-scraper] Done. Imported: ${totalImported}, Skipped: ${totalSkipped}`);
  return Response.json({ imported: totalImported, skipped: totalSkipped });
});
