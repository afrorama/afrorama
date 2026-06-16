/**
 * Afrorama — teamtailor-scraper Edge Function
 *
 * Fetches jobs from Team Tailor career pages for curated African-focused orgs.
 *
 * Deploy:
 *   supabase functions deploy teamtailor-scraper
 *
 * Schedule daily:
 *   SELECT cron.schedule('teamtailor-daily', '0 9 * * *', $$SELECT net.http_post(...)$$);
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const DISCLAIMER = '\n\n─────────────────────────────────────\nThis summary is automatically generated for quick reference. For the complete and authoritative job description, please view the original posting.';

// Orgs using Team Tailor — add new subdomains here
const ORGS: { subdomain: string; name: string; country: string }[] = [
  { subdomain: 'bamboo',               name: 'Bamboo',                    country: 'KE' },
  { subdomain: 'katapult',             name: 'Katapult',                  country: 'KE' },
  { subdomain: 'cdpworldwide',         name: 'CDP Worldwide',             country: 'ZA' },
  { subdomain: 'birdlifeinternational',name: 'BirdLife International',    country: 'KE' },
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
  'africa',  // catch "Sub-Saharan Africa" etc.
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

function isAfricanLocation(location: string, orgCountry: string): { iso: string; name: string } | null {
  if (!location) return { iso: orgCountry, name: orgCountry };
  const lower = location.toLowerCase();

  // Check against known African country names
  for (const name of AFRICA_NAMES_LOWER) {
    if (lower.includes(name)) {
      // Find canonical name + ISO
      for (const [canonical, iso] of Object.entries(COUNTRY_ISO)) {
        if (canonical.toLowerCase() === name) return { iso, name: canonical };
      }
      return { iso: orgCountry, name: location };
    }
  }

  // Check ISO codes embedded in location strings
  const isoMatch = location.match(/\b([A-Z]{2})\b/);
  if (isoMatch && AFRICA_ISO.has(isoMatch[1])) {
    return { iso: isoMatch[1], name: location };
  }

  return null;
}

const SECTOR_MAP: Record<string, string> = {
  'engineering':    'Innovation & Technology',
  'technology':     'Innovation & Technology',
  'software':       'Innovation & Technology',
  'data':           'Innovation & Technology',
  'finance':        'Finance & Economics',
  'accounting':     'Finance & Economics',
  'health':         'Health',
  'medical':        'Health',
  'education':      'Education',
  'program':        'Governance & Public Policy',
  'programme':      'Governance & Public Policy',
  'policy':         'Governance & Public Policy',
  'research':       'Governance & Public Policy',
  'communications': 'Governance & Public Policy',
  'marketing':      'Governance & Public Policy',
  'operations':     'Governance & Public Policy',
  'agriculture':    'Agriculture & Food Security',
  'environment':    'Climate & Environment',
  'climate':        'Climate & Environment',
  'gender':         'Gender & Social Inclusion',
  'legal':          'Human Rights',
  'human rights':   'Human Rights',
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

Deno.serve(async () => {
  console.log('[teamtailor-scraper] Starting...');

  let totalImported = 0, totalSkipped = 0;

  for (const org of ORGS) {
    await new Promise(r => setTimeout(r, 300));

    try {
      // Team Tailor public jobs JSON endpoint
      const url = `https://api.teamtailor.com/v1/jobs?include=department,role,locations&filter[company-slug]=${org.subdomain}`;
      console.log(`[teamtailor-scraper] ${org.name}: fetching ${url}`);

      let res = await fetch(url, {
        headers: {
          'Accept':          'application/vnd.api+json',
          'X-Api-Version':   '20240404',
          'User-Agent':      'Afrorama/1.0',
        },
      });

      // Fallback: try the subdomain career page JSON feed
      if (!res.ok) {
        console.warn(`[teamtailor-scraper] ${org.name}: API returned ${res.status}, trying career page feed...`);
        res = await fetch(`https://${org.subdomain}.teamtailor.com/jobs.json`, {
          headers: { 'Accept': 'application/json', 'User-Agent': 'Afrorama/1.0' },
        });
      }

      if (!res.ok) {
        console.warn(`[teamtailor-scraper] ${org.name}: HTTP ${res.status}`);
        continue;
      }

      let json: any;
      try { json = await res.json(); } catch {
        console.warn(`[teamtailor-scraper] ${org.name}: invalid JSON`);
        continue;
      }

      // Team Tailor career page returns JSON Feed: { items: [...] }
      // JSON:API fallback: { data: [...], included: [...] }
      const jobs: any[] = json?.items || json?.data || (Array.isArray(json) ? json : []);
      const included: any[] = json?.included || [];
      console.log(`[teamtailor-scraper] ${org.name}: ${jobs.length} jobs`);

      // Log first item structure so we know the field names
      if (jobs[0]) {
        console.log(`[teamtailor-scraper] ${org.name} item keys:`, Object.keys(jobs[0]).join(', '));
        console.log(`[teamtailor-scraper] ${org.name} first item:`, JSON.stringify(jobs[0]).slice(0, 600));
      }

      for (const job of jobs) {
        // JSON Feed format: title, content_html, url, date_published, _teamtailor (custom ext.)
        // JSON:API format: attributes.title, attributes.body, etc.
        const attrs    = job.attributes || job;
        const title    = attrs.title || 'Untitled';
        const bodyHtml = attrs.content_html || attrs.body || attrs.description || '';
        const bodyText = stripHtml(bodyHtml);
        const applyUrl = attrs.url || attrs.apply_url
          || `https://${org.subdomain}.teamtailor.com/jobs/${job.id}`;

        // Location: _jobposting is Team Tailor's JSON-LD extension (confirmed from logs)
        const ext          = attrs._jobposting || attrs._teamtailor || attrs._tt || {};
        const locationName = (() => {
          // JSON-LD jobLocation
          const jl = ext.jobLocation;
          if (jl) {
            const addr = jl.address || jl;
            const city    = addr.addressLocality || '';
            const country = addr.addressCountry  || '';
            return [city, country].filter(Boolean).join(', ');
          }
          // Parse "Location: X" from content_html
          const locMatch = (attrs.content_html || '').match(/Location[:\s]+([^\n<]{3,80})/i);
          if (locMatch) return locMatch[1].replace(/<[^>]+>/g, '').trim();
          // JSON:API relationship
          const locRel = job.relationships?.locations?.data?.[0];
          if (locRel) {
            const locRes = included.find((r: any) => r.type === 'locations' && r.id === locRel.id);
            if (locRes) return locRes.attributes?.name || locRes.attributes?.city || '';
          }
          return attrs.location?.name || attrs.location || attrs.city || '';
        })();

        // Department
        const dept = (() => {
          if (ext.employmentType) return ext.employmentType;
          const deptRel = job.relationships?.department?.data;
          if (deptRel) {
            const deptRes = included.find((r: any) => r.type === 'departments' && r.id === deptRel.id);
            return deptRes?.attributes?.name || '';
          }
          return attrs.department || '';
        })();

        const locationByText = isAfricanLocation(locationName, org.country);
        const titleSignal    = isAfricanLocation(title, org.country);
        // Include if location is African OR title signals Africa (catches non-Africa-based Africa roles)
        if (!locationByText && !titleSignal) continue;
        const location = locationByText || titleSignal!;

        const jobId  = String(job.id || '').replace(/^.*\/(\d+)[^/]*$/, '$1') || String(job.id || '');
        if (!jobId) continue;

        const deadline = extractDeadline(bodyText) || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
        const posted   = (attrs.date_published || attrs.created_at || '').slice(0, 10)
          || new Date().toISOString().split('T')[0];

        const { description, salary } = await formatWithClaude(title, org.name, bodyText);

        const entry = {
          id:           `tt-${org.subdomain}-${jobId}`,
          title,
          organisation: org.name,
          type:         mapType(title),
          sector:       mapSector(dept),
          location:     locationName || location.name,
          country:      location.iso,
          deadline,
          posted,
          salary,
          description, apply_url:    applyUrl,
          experience:   null,
          org_domain:   `${org.subdomain}.teamtailor.com`,
          source:       'TeamTailor',
          views:        0,
          apply_clicks: 0,
          paid_listing: false,
        };

        const { error } = await supabase
          .from('listings')
          .upsert(entry, { onConflict: 'id', ignoreDuplicates: false });

        if (error) { console.error(`[teamtailor-scraper] Upsert error: ${error.message}`); totalSkipped++; }
        else totalImported++;

        await new Promise(r => setTimeout(r, 150));
      }
    } catch (err) {
      console.warn(`[teamtailor-scraper] ${org.name} failed:`, (err as Error).message);
    }
  }

  console.log(`[teamtailor-scraper] Done. Imported: ${totalImported}, Skipped: ${totalSkipped}`);
  return Response.json({ imported: totalImported, skipped: totalSkipped });
});
