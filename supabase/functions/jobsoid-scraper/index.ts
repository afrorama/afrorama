/**
 * Afrorama — jobsoid-scraper Edge Function
 *
 * Fetches jobs from Jobsoid career pages for curated African-focused orgs.
 * Jobsoid has no public JSON API — this scrapes the HTML job list page,
 * then each job's own description page.
 *
 * List page:   https://{subdomain}.jobsoid.com/
 * Detail page: https://{subdomain}.jobsoid.com/j/{id}/{slug}
 *
 * Note: Jobsoid career pages can use different custom page designs per
 * tenant, so the list/detail HTML structure verified here (WomenLift
 * Health) may not transfer exactly to a newly added tenant — check its
 * pages manually before trusting the parse.
 *
 * Deploy:
 *   supabase functions deploy jobsoid-scraper
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { trySubmitSalary } from '../_shared/currency.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const DISCLAIMER = '\n\n─────────────────────────────────────\nThis summary is automatically generated for quick reference. For the complete and authoritative job description, please view the original posting.';

// Orgs using Jobsoid — add new subdomains here (verify the career page's
// HTML structure matches before trusting the parse; see note above).
const ORGS: { subdomain: string; name: string; fallbackCountry: string }[] = [
  { subdomain: 'womenlifthealth', name: 'WomenLift Health', fallbackCountry: 'KE' },
];

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
  'east africa','west africa','southern africa','north africa','central africa',
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

// Multi-country regional postings (e.g. "East Africa, Southern Africa or West
// Africa") have no single ISO code — these fall back to the org's hub country.
function isAfricanLocation(text: string, fallbackIso: string): { iso: string; name: string } | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const name of AFRICA_NAMES_LOWER) {
    if (lower.includes(name)) {
      if (CITY_ISO[name]) return { iso: CITY_ISO[name], name: text };
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
  'health':'Health','medical':'Health','global health':'Health','public health':'Health',
  'education':'Education','teaching':'Education','fellows':'Education','leadership':'Education',
  'program':'Governance & Public Policy','programme':'Governance & Public Policy',
  'policy':'Governance & Public Policy','research':'Governance & Public Policy',
  'communications':'Governance & Public Policy','marketing':'Governance & Public Policy',
  'operations':'Governance & Public Policy',
  'agriculture':'Agriculture & Food Security',
  'environment':'Climate & Environment','climate':'Climate & Environment',
  'gender':'Gender & Social Inclusion','women':'Gender & Social Inclusion',
  'legal':'Human Rights','human rights':'Human Rights',
};

function mapSector(text: string): string {
  if (!text) return 'Governance & Public Policy';
  const lower = text.toLowerCase();
  for (const [key, val] of Object.entries(SECTOR_MAP)) {
    if (lower.includes(key)) return val;
  }
  return 'Governance & Public Policy';
}

function mapType(title: string, employmentType: string): string {
  const t = `${title} ${employmentType}`.toLowerCase();
  if (t.includes('intern') || t.includes('trainee') || t.includes('volunteer')) return 'internship';
  if (t.includes('fellowship') || t.includes('fellow')) return 'capacity';
  if (t.includes('consultant') || t.includes('consultancy') || t.includes('advisor') || t.includes('adviser') || t.includes('contractor')) return 'consultancy';
  return 'jobs';
}

function extractDeadline(text: string): string | null {
  if (!text) return null;
  const clean = text.replace(/\b(\d{1,2})(st|nd|rd|th)\b/gi, '$1');
  const patterns = [
    /(?:deadline|closing date|close[sd]? on|applications?\s+close|apply by|submit by|due date|applications?\s+due)[:\s]+([A-Za-z]+\.?\s+\d{1,2},?\s+\d{4})/i,
    /(?:deadline|closing date|close[sd]? on|applications?\s+close|apply by|submit by)[:\s]+(\d{1,2}\s+[A-Za-z]+\.?\s+\d{4})/i,
    /(?:deadline|closing date)[:\s]+(\d{4}-\d{2}-\d{2})/i,
  ];
  for (const p of patterns) {
    const m = p.exec(clean);
    if (m) {
      const parsed = new Date(m[1].replace(/,/g, '').trim());
      if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
    }
  }
  return null;
}

function stripHtml(html: string): string {
  return (html || '')
    .replace(/<\/?(li|p|br|h[1-6]|div)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#8217;/g, "'").replace(/&#8220;|&#8221;/g, '"')
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
- Explicit: "USD 45,000–55,000/yr", "KES 150,000/month"
- Qualitative: "Competitive", "Market-related", "Attractive package", "Commensurate with experience" — write as-is
- Only write: none — if the text has absolutely zero mention of pay, salary, stipend, grade, band, or compensation

Job: ${title} at ${org}

Description:
${description.slice(0, 3000)}

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

interface ListRow {
  jobId: string;
  title: string;
  location: string;
  employmentType: string;
  department: string;
  detailPath: string;
}

function parseListPage(html: string): ListRow[] {
  const rows: ListRow[] = [];
  // Jobs are grouped under "list-title" department headers, each followed by
  // a <ul class="list"> of <li> job rows — split on department sections first.
  const sections = html.split(/<div class="list-title">/).slice(1);

  for (const section of sections) {
    const department = (section.match(/^([^<]*)</)?.[1] || '').trim();
    const items = section.split('<li>').slice(1);

    for (const item of items) {
      const linkMatch = item.match(/href="(\/j\/(\d+)\/[^"]+)"[^>]*>([^<]+)<\/a>/);
      if (!linkMatch) continue;
      const locMatch  = item.match(/tek-address"><\/i>\s*<span>([^<]*)<\/span>/);
      const typeMatch = item.match(/<label[^>]*>([^<]*)<\/label>/);

      rows.push({
        jobId:          linkMatch[2],
        title:          linkMatch[3].trim(),
        location:       locMatch?.[1]?.trim() || '',
        employmentType: typeMatch?.[1]?.trim() || '',
        department,
        detailPath:     linkMatch[1],
      });
    }
  }
  return rows;
}

Deno.serve(async () => {
  console.log('[jobsoid-scraper] Starting...');
  let totalImported = 0, totalSkipped = 0;

  for (const org of ORGS) {
    const base = `https://${org.subdomain}.jobsoid.com`;
    await new Promise(r => setTimeout(r, 300));

    try {
      const listRes = await fetch(`${base}/`, { headers: { 'User-Agent': 'Afrorama/1.0' } });
      if (!listRes.ok) {
        console.warn(`[jobsoid-scraper] ${org.name}: list page HTTP ${listRes.status}`);
        continue;
      }
      const listHtml = await listRes.text();
      const rows = parseListPage(listHtml);
      console.log(`[jobsoid-scraper] ${org.name}: ${rows.length} open vacancies`);

      for (const row of rows) {
        const locationMatch = isAfricanLocation(row.location, org.fallbackCountry);
        const titleMatch    = isAfricanLocation(row.title, org.fallbackCountry);
        if (!locationMatch && !titleMatch) continue; // not an Africa-based/focused role — skip
        const location = locationMatch || titleMatch!;

        await new Promise(r => setTimeout(r, 200));
        const descRes = await fetch(`${base}${row.detailPath}`, { headers: { 'User-Agent': 'Afrorama/1.0' } });
        if (!descRes.ok) {
          console.warn(`[jobsoid-scraper] ${org.name} job ${row.jobId}: description HTTP ${descRes.status}`);
          continue;
        }
        const descHtml = await descRes.text();
        const contentMatch = descHtml.match(/<div class="section-content-description[^"]*">([\s\S]*?)(?=<div class="col-md-6)/);
        const bodyText = stripHtml(contentMatch?.[1] || '');

        const deadline = extractDeadline(bodyText);
        if (deadline && new Date(deadline) < new Date()) {
          console.log(`[jobsoid-scraper] ${org.name} job ${row.jobId}: skipping expired posting (closed ${deadline})`);
          continue;
        }

        // Jobsoid doesn't expose a posted date anywhere on the page — best
        // available signal is "first time we've seen this listing".
        const posted = new Date().toISOString().split('T')[0];
        const { description, salary } = await formatWithClaude(row.title, org.name, bodyText);
        const applyUrl = `${base}/apply/${row.jobId}`;
        const sector = mapSector(`${row.department} ${row.title}`);

        const entry = {
          id:           `jobsoid-${org.subdomain}-${row.jobId}`,
          title:        row.title,
          organisation: org.name,
          type:         mapType(row.title, row.employmentType),
          sector,
          location:     location.name,
          country:      location.iso,
          deadline,
          posted,
          salary,
          description, apply_url: applyUrl,
          experience:   null,
          org_domain:   `${org.subdomain}.jobsoid.com`,
          source:       'Jobsoid',
          views:        0,
          apply_clicks: 0,
          paid_listing: false,
        };

        const { error } = await supabase
          .from('listings')
          .upsert(entry, { onConflict: 'id', ignoreDuplicates: false });

        if (error) { console.error(`[jobsoid-scraper] Upsert error: ${error.message}`); totalSkipped++; }
        else totalImported++;

        await trySubmitSalary(supabase, {
          company: org.name, position: row.title, salaryText: salary,
          experienceText: null, sector, country: location.iso,
        });
      }
    } catch (err) {
      console.warn(`[jobsoid-scraper] ${org.name} failed:`, (err as Error).message);
    }
  }

  console.log(`[jobsoid-scraper] Done. Imported: ${totalImported}, Skipped: ${totalSkipped}`);
  return Response.json({ imported: totalImported, skipped: totalSkipped });
});
