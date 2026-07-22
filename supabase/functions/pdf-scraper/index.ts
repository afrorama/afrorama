/**
 * Afrorama — pdf-scraper Edge Function
 *
 * Accepts a PDF file (multipart/form-data), sends it to Claude as a
 * native PDF document, extracts structured job listings, and upserts
 * them into the listings table.
 *
 * POST /functions/v1/pdf-scraper
 *   Content-Type: multipart/form-data
 *   Body fields:
 *     file       - the PDF file
 *     source     - (optional) source label, e.g. "UNICEF Circular"
 *     country    - (optional) default country ISO to apply if not found in PDF
 *     sector     - (optional) default sector if not found in PDF
 *
 * Returns JSON: { imported, skipped, listings: [{ title, organisation, ... }] }
 *
 * Deploy: supabase functions deploy pdf-scraper
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const DISCLAIMER = '\n\n─────────────────────────────────────\nThis summary was automatically extracted from a PDF document. For the complete job description, view the original posting.';

const AFRICA_COUNTRIES: Record<string, string> = {
  'algeria':'DZ','angola':'AO','benin':'BJ','botswana':'BW','burkina faso':'BF',
  'burundi':'BI','cabo verde':'CV','cameroon':'CM','central african republic':'CF',
  'chad':'TD','comoros':'KM','congo':'CG','democratic republic of the congo':'CD',
  "côte d'ivoire":'CI','ivory coast':'CI','djibouti':'DJ','egypt':'EG',
  'equatorial guinea':'GQ','eritrea':'ER','eswatini':'SZ','ethiopia':'ET',
  'gabon':'GA','gambia':'GM','ghana':'GH','guinea':'GN','guinea-bissau':'GW',
  'kenya':'KE','lesotho':'LS','liberia':'LR','libya':'LY','madagascar':'MG',
  'malawi':'MW','mali':'ML','mauritania':'MR','mauritius':'MU','morocco':'MA',
  'mozambique':'MZ','namibia':'NA','niger':'NE','nigeria':'NG','rwanda':'RW',
  'sao tome and principe':'ST','senegal':'SN','sierra leone':'SL','somalia':'SO',
  'south africa':'ZA','south sudan':'SS','sudan':'SD','tanzania':'TZ','togo':'TG',
  'tunisia':'TN','uganda':'UG','zambia':'ZM','zimbabwe':'ZW',
  // Cities → ISO
  'nairobi':'KE','addis ababa':'ET','abuja':'NG','accra':'GH','kampala':'UG',
  'kigali':'RW','dar es salaam':'TZ','lusaka':'ZM','harare':'ZW','dakar':'SN',
  'johannesburg':'ZA','pretoria':'ZA','cape town':'ZA','yaounde':'CM',
  'maputo':'MZ','lilongwe':'MW','gaborone':'BW','windhoek':'NA','lomé':'TG',
  'niamey':'NE','bamako':'ML','ouagadougou':'BF','bujumbura':'BI','khartoum':'SD',
  'tripoli':'LY','tunis':'TN','cairo':'EG','rabat':'MA','casablanca':'MA',
};

function locationToIso(text: string): string | null {
  const lower = text.toLowerCase();
  for (const [name, iso] of Object.entries(AFRICA_COUNTRIES)) {
    if (lower.includes(name)) return iso;
  }
  return null;
}

function slug(title: string, org: string): string {
  return `pdf-${Date.now()}-${(title + org).replace(/\W+/g, '').slice(0, 20).toLowerCase()}`;
}

function parseIsoDate(raw: string): string | null {
  if (!raw || raw.toLowerCase().includes('open')) return null;
  const clean = raw.trim().replace(/(\d{1,2})(st|nd|rd|th)/gi, '$1');
  const d = new Date(clean);
  return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
}

const SECTOR_KEYWORDS: [RegExp, string][] = [
  [/health|medical|epidem|disease|wash|sanitation/i,           'Health'],
  [/financ|econom|account|audit|budget|treasury|grant/i,       'Finance & Economics'],
  [/tech|digital|ict|software|data|cyber|innovat/i,            'Innovation & Technology'],
  [/education|teach|school|learn|curricul|training/i,          'Education'],
  [/agricultur|food|farm|nutrition|livelihood|rural/i,         'Agriculture & Food Security'],
  [/climate|environment|energy|conservation|green/i,           'Climate & Environment'],
  [/gender|women|girl|inclusion|social protect/i,              'Gender & Social Inclusion'],
  [/human rights|protection|rights|refugee|asylum/i,           'Human Rights'],
  [/infrastructure|urban|transport|logistics|construct/i,      'Infrastructure & Urban Development'],
  [/peace|security|conflict|stabilisation|humanitarian/i,      'Peacebuilding'],
  [/governance|policy|legal|law|admin|compliance/i,            'Governance & Public Policy'],
  [/private sector|enterprise|business|entrepreneur/i,         'Private Sector Development'],
  [/youth|employment|jobs|vocational|skills/i,                 'Youth & Employment'],
];

function guessSector(text: string): string {
  for (const [re, sector] of SECTOR_KEYWORDS) {
    if (re.test(text)) return sector;
  }
  return 'Governance & Public Policy';
}

function guessType(title: string): string {
  const t = title.toLowerCase();
  if (/intern|attachment|trainee|placement/i.test(t)) return 'internship';
  if (/consultant|consultancy|advisor|individual contract/i.test(t)) return 'consultancy';
  if (/fellowship|fellow|grant|funding|award/i.test(t)) return 'capacity';
  return 'jobs';
}

interface ExtractedJob {
  title: string;
  organisation: string;
  location: string;
  country_text: string;
  deadline: string;
  salary: string;
  apply_url: string;
  description_bullets: string;
  type: string;
  sector: string;
}

async function extractJobsFromPdf(
  pdfBase64: string,
  sourceLabel: string,
  defaultCountry: string,
  defaultSector: string,
): Promise<ExtractedJob[]> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const prompt = `You are extracting job listings from this PDF document for Afrorama, Africa's social impact job board.

Extract EVERY distinct job opening you find. For each job, extract:
- TITLE: exact job title
- ORG: organisation name
- LOCATION: city and/or country (as stated)
- DEADLINE: application closing date (exact text as in PDF, or "Open" if rolling)
- SALARY: salary, grade, or pay band if mentioned (or "See listing" if absent)
- APPLY: application URL or email address (or "See original PDF" if not found)
- TYPE: one of: jobs | internship | consultancy | capacity
- SECTOR: the most relevant sector from this exact list:
  Health | Education | Finance & Economics | Innovation & Technology |
  Agriculture & Food Security | Climate & Environment | Gender & Social Inclusion |
  Human Rights | Infrastructure & Urban Development | Peacebuilding |
  Governance & Public Policy | Private Sector Development | Youth & Employment
- BULLETS: exactly 5 bullet points describing the role (begin each with •, use imperative verbs for bullets 2-5)

Format each job as a block starting with === JOB START === and ending with === JOB END ===.
Within each block use the exact keys above (TITLE:, ORG:, etc.), one per line.
For BULLETS, put each bullet on its own line after "BULLETS:".

If the PDF contains no job listings, return: NO_JOBS_FOUND

PDF source: ${sourceLabel}`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'pdfs-2024-09-25',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: pdfBase64,
            },
          },
          { type: 'text', text: prompt },
        ],
      }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error ${response.status}: ${err}`);
  }

  const data = await response.json() as { content: { text: string }[] };
  const raw = data.content?.[0]?.text?.trim() || '';

  if (raw.includes('NO_JOBS_FOUND')) return [];

  const jobs: ExtractedJob[] = [];
  const blocks = raw.split('=== JOB START ===').slice(1);

  for (const block of blocks) {
    const body = block.split('=== JOB END ===')[0].trim();

    const get = (key: string): string => {
      const m = body.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
      return m ? m[1].trim() : '';
    };

    const bulletsMatch = body.match(/^BULLETS:\s*\n((?:•[^\n]*\n?)+)/m);
    const bulletsRaw = bulletsMatch ? bulletsMatch[1].trim() : '';

    const title = get('TITLE');
    if (!title) continue;

    const org      = get('ORG')      || sourceLabel;
    const location = get('LOCATION') || '';
    const deadline = get('DEADLINE') || '';
    const salary   = get('SALARY')   || 'See listing';
    const apply    = get('APPLY')    || '';
    const rawType  = get('TYPE')     || '';
    const rawSect  = get('SECTOR')   || '';

    jobs.push({
      title,
      organisation: org,
      location,
      country_text: location,
      deadline,
      salary: salary.toLowerCase() === 'see listing' ? 'See listing' : salary,
      apply_url: apply,
      description_bullets: bulletsRaw || `• ${title} at ${org}`,
      type: ['jobs','internship','consultancy','capacity'].includes(rawType.toLowerCase()) ? rawType.toLowerCase() : guessType(title),
      sector: rawSect || defaultSector || guessSector(`${title} ${org}`),
    });
  }

  return jobs;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
  }

  const CORS = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), { status: 405, headers: CORS });
  }

  // Parse multipart form data
  let pdfBytes: Uint8Array | null = null;
  let sourceLabel = 'PDF Upload';
  let defaultCountry = '';
  let defaultSector  = '';

  try {
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (!file) return new Response(JSON.stringify({ error: 'No file provided' }), { status: 400, headers: CORS });
      pdfBytes       = new Uint8Array(await file.arrayBuffer());
      sourceLabel    = (formData.get('source') as string) || file.name || 'PDF Upload';
      defaultCountry = (formData.get('country') as string) || '';
      defaultSector  = (formData.get('sector') as string)  || '';
    } else if (contentType.includes('application/json')) {
      // Alternative: base64 JSON body
      const json = await req.json() as { file_base64: string; source?: string; country?: string; sector?: string };
      const binary = atob(json.file_base64);
      pdfBytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) pdfBytes[i] = binary.charCodeAt(i);
      sourceLabel    = json.source   || 'PDF Upload';
      defaultCountry = json.country  || '';
      defaultSector  = json.sector   || '';
    } else {
      return new Response(JSON.stringify({ error: 'Unsupported content type' }), { status: 400, headers: CORS });
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: `Failed to parse request: ${(e as Error).message}` }), { status: 400, headers: CORS });
  }

  if (!pdfBytes || pdfBytes.length === 0) {
    return new Response(JSON.stringify({ error: 'Empty file' }), { status: 400, headers: CORS });
  }

  if (pdfBytes.length > 32 * 1024 * 1024) {
    return new Response(JSON.stringify({ error: 'PDF too large (max 32 MB)' }), { status: 413, headers: CORS });
  }

  console.log(`[pdf-scraper] Processing ${pdfBytes.length} bytes from "${sourceLabel}"`);

  // Convert to base64 for Claude
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < pdfBytes.length; i += chunkSize) {
    binary += String.fromCharCode(...pdfBytes.subarray(i, i + chunkSize));
  }
  const pdfBase64 = btoa(binary);

  let extracted: ExtractedJob[];
  try {
    extracted = await extractJobsFromPdf(pdfBase64, sourceLabel, defaultCountry, defaultSector);
  } catch (e) {
    console.error('[pdf-scraper] Extraction failed:', (e as Error).message);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 502, headers: CORS });
  }

  console.log(`[pdf-scraper] Extracted ${extracted.length} jobs`);

  const today = new Date().toISOString().split('T')[0];
  let imported = 0, skipped = 0;
  const results: object[] = [];

  for (const job of extracted) {
    const isoDate = parseIsoDate(job.deadline);
    if (isoDate && isoDate < today) { skipped++; continue; }

    const isoCountry = locationToIso(job.country_text)
      || (defaultCountry.length === 2 ? defaultCountry.toUpperCase() : null)
      || 'ZZ';

    const description = job.description_bullets + DISCLAIMER;
    const id = slug(job.title, job.organisation);

    const entry = {
      id,
      title:        job.title,
      organisation: job.organisation,
      type:         job.type,
      sector:       job.sector,
      location:     job.location || job.organisation,
      country:      isoCountry,
      deadline:     isoDate || null,
      posted:       today,
      salary:       job.salary,
      description,
      apply_url:    job.apply_url || '',
      source:       sourceLabel,
      views:        0,
      apply_clicks: 0,
      paid_listing: false,
    };

    const { error } = await supabase.from('listings').upsert(entry, { onConflict: 'id', ignoreDuplicates: false });
    if (error) {
      console.error(`[pdf-scraper] Upsert error for "${job.title}":`, error.message);
      skipped++;
    } else {
      imported++;
      results.push({ title: job.title, organisation: job.organisation, id });
    }
  }

  console.log(`[pdf-scraper] Done. Imported: ${imported}, Skipped: ${skipped}`);
  return new Response(JSON.stringify({ imported, skipped, total_extracted: extracted.length, listings: results }), { headers: CORS });
});
