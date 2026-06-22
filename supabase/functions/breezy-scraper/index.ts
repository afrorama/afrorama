/**
 * Afrorama — breezy-scraper Edge Function
 * Authenticates with Breezy HR using stored credentials, then fetches
 * positions for each org using their internal company ID.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const DISCLAIMER = '\n\n─────────────────────────────────────\nThis summary is automatically generated for quick reference. For the complete and authoritative job description, please view the original posting.';

const ORGS: { subdomain: string; name: string; country: string }[] = [
  { subdomain: 'building-tomorrow',        name: 'Building Tomorrow',          country: 'UG' },
  { subdomain: 'the-luminos-fund',         name: 'Luminos Fund',               country: 'ET' },
  { subdomain: 'covidence',                name: 'Covidence',                  country: 'KE' },
  { subdomain: 'clicklearning',            name: 'ClickLearning',              country: 'KE' },
  { subdomain: 'caribou-digital',          name: 'Caribou Digital',            country: 'KE' },
  { subdomain: 'krutham',                  name: 'Krutham',                    country: 'ZA' },
  { subdomain: 'goal-3',                   name: 'Goal 3',                     country: 'KE' },
  { subdomain: 'viamo-inc',               name: 'Viamo',                      country: 'GH' },
  { subdomain: 'global-fund-for-children', name: 'Global Fund for Children',   country: 'KE' },
  { subdomain: 'women-s-linkworldwide',    name: "Women's Link Worldwide",     country: 'KE' },
  { subdomain: 'anka',                     name: 'Anka',                       country: 'SN' },
  { subdomain: 'africaworks',              name: 'AfricaWorks',                country: 'KE' },
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
  'namibia','cameroon',"côte d'ivoire",'ivory coast','burkina faso','mali',
  'niger','chad','sudan','south sudan','somalia',
  'democratic republic of the congo','dr congo','congo','angola','benin',
  'burundi','cabo verde','cape verde','central african republic','comoros',
  'djibouti','egypt','equatorial guinea','eritrea','eswatini','gabon',
  'gambia','guinea','guinea-bissau','lesotho','liberia','libya','madagascar',
  'mauritania','mauritius','morocco','sierra leone','togo','tunisia','africa',
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

function isAfricanLocation(countryCode: string, countryName: string, location: string, fallback: string): string | null {
  if (countryCode && AFRICA_ISO.has(countryCode.toUpperCase())) return countryCode.toUpperCase();
  const text = [countryName, location].join(' ').toLowerCase();
  for (const name of AFRICA_NAMES_LOWER) {
    if (text.includes(name)) {
      const canonical = Object.keys(COUNTRY_ISO).find(k => k.toLowerCase() === name);
      return canonical ? COUNTRY_ISO[canonical] : fallback;
    }
  }
  return null;
}

const SECTOR_MAP: Record<string, string> = {
  'engineering':'Innovation & Technology','technology':'Innovation & Technology',
  'software':'Innovation & Technology','data':'Innovation & Technology',
  'finance':'Finance & Economics','accounting':'Finance & Economics',
  'health':'Health','medical':'Health','education':'Education',
  'program':'Governance & Public Policy','programme':'Governance & Public Policy',
  'policy':'Governance & Public Policy','research':'Governance & Public Policy',
  'communications':'Governance & Public Policy','marketing':'Governance & Public Policy',
  'operations':'Governance & Public Policy',
  'agriculture':'Agriculture & Food Security','food':'Agriculture & Food Security',
  'environment':'Climate & Environment','climate':'Climate & Environment',
  'gender':'Gender & Social Inclusion','legal':'Human Rights','human rights':'Human Rights',
};

function mapSector(dept: string): string {
  if (!dept) return 'Governance & Public Policy';
  const lower = dept.toLowerCase();
  for (const [key, val] of Object.entries(SECTOR_MAP)) { if (lower.includes(key)) return val; }
  return 'Governance & Public Policy';
}

function stripHtml(html: string): string {
  return (html || '')
    .replace(/<\/?(li|p|br|h[1-6]|div)[^>]*>/gi, '\n').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

// Uses real lines from the actual posting rather than fabricated, generic
// "responsibilities" — when AI summarisation isn't available, it's more
// honest to show less than to invent content that didn't come from the org.
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
        messages: [{ role: 'user', content: `You are writing a job summary for Afrorama, Africa's social impact job board. Format the job description below in British English.\n\nTask 1 — Write exactly 5 bullet points:\n- Bullet 1 drawn from the opening overview\n- Bullets 2–5 begin with a strong imperative verb\n- Concise and action-oriented, British English spelling\n\nTask 2 — Extract salary or compensation (be thorough): look for ANY clue — explicit figures, UN/NGO grades (P3, G5, Band C), qualitative terms (Competitive, Market-related, Commensurate with experience), allowances or stipends. Only write none if there is absolutely zero mention of pay, salary, grade, or compensation\n\nJob: ${title} at ${org}\n\nDescription:\n${description.slice(0, 2000)}\n\nReturn:\nBULLETS:\n• [bullet 1]\n• [bullet 2]\n• [bullet 3]\n• [bullet 4]\n• [bullet 5]\nSALARY: [salary or none]` }],
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

/** Sign in to Breezy HR and return an access token */
async function breezySignIn(): Promise<string | null> {
  const email    = Deno.env.get('BREEZY_EMAIL');
  const password = Deno.env.get('BREEZY_PASSWORD');
  if (!email || !password) { console.error('[breezy-scraper] BREEZY_EMAIL or BREEZY_PASSWORD not set'); return null; }

  const res = await fetch('https://api.breezy.hr/v3/signin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'Afrorama/1.0' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const txt = await res.text();
    console.error(`[breezy-scraper] Sign-in failed: ${res.status} — ${txt.slice(0, 200)}`);
    return null;
  }

  const data = await res.json() as any;
  const token = data?.access_token || data?.token || data?._id;
  console.log('[breezy-scraper] Signed in. Token type:', Object.keys(data || {}).join(', '));
  return token || null;
}

/** Resolve subdomain → Breezy internal company _id */
async function getCompanyId(subdomain: string, token: string): Promise<string | null> {
  // Direct lookup by friendly_id (subdomain)
  const res = await fetch(`https://api.breezy.hr/v3/company/${subdomain}`, {
    headers: { 'Authorization': token, 'User-Agent': 'Afrorama/1.0' },
  });

  if (res.ok) {
    const data = await res.json() as any;
    // Log first company response to understand shape
    if (data) console.log(`[breezy-scraper] company lookup keys for ${subdomain}:`, Object.keys(data).join(', '));
    return data?._id || null;
  }

  console.warn(`[breezy-scraper] Company lookup for "${subdomain}": HTTP ${res.status}`);
  return null;
}

Deno.serve(async (req) => {
  console.log('[breezy-scraper] Starting...');

  try {
    const token = await breezySignIn();
    if (!token) return Response.json({ error: 'Authentication failed' }, { status: 500 });

    const batchSize = 6;
    const batch = Math.max(0, parseInt(new URL(req.url).searchParams.get('batch') || '0', 10));
    const start = (batch * batchSize) % ORGS.length;
    const orgs  = [...ORGS, ...ORGS].slice(start, start + batchSize);
    console.log(`[breezy-scraper] Batch ${batch}: orgs ${start + 1}–${start + orgs.length}`);

    let totalImported = 0, totalSkipped = 0;

    for (const org of orgs) {
      await new Promise(r => setTimeout(r, 300));
      try {
        // Get internal company ID from subdomain
        const companyId = await getCompanyId(org.subdomain, token);
        if (!companyId) {
          console.warn(`[breezy-scraper] ${org.name}: could not resolve company ID for subdomain "${org.subdomain}"`);
          continue;
        }
        console.log(`[breezy-scraper] ${org.name}: company ID = ${companyId}`);

        // Fetch published positions
        const res = await fetch(
          `https://api.breezy.hr/v3/company/${companyId}/positions?state=published`,
          { headers: { 'Authorization': token, 'User-Agent': 'Afrorama/1.0' } },
        );
        if (!res.ok) { console.warn(`[breezy-scraper] ${org.name}: positions HTTP ${res.status}`); continue; }

        const positions: any[] = await res.json() as any[];
        const jobs = Array.isArray(positions) ? positions : [];
        console.log(`[breezy-scraper] ${org.name}: ${jobs.length} positions`);

        for (const job of jobs) {
          const countryCode = job.location?.country?.id || '';
          const countryName = job.location?.country?.name || '';
          const city        = job.location?.city || '';
          const location    = [city, countryName].filter(Boolean).join(', ');

          const iso = isAfricanLocation(countryCode, countryName, city, org.country);
          if (!iso) continue;

          const jobId = job._id || '';
          if (!jobId) continue;

          const title    = job.name || 'Untitled';
          const dept     = job.department?.name || '';
          const applyUrl = `https://${org.subdomain}.breezy.hr/p/${job.friendly_id || jobId}`;
          const posted   = job.published_at?.slice(0, 10) || job.creation_date?.slice(0, 10) || new Date().toISOString().split('T')[0];
          const bodyText = stripHtml(job.description || '');
          const { description, salary } = await formatWithClaude(title, org.name, bodyText);

          const result = await supabase.from('listings').upsert({
            id: `bz-${org.subdomain}-${jobId}`, title, organisation: org.name, type: 'jobs',
            sector: mapSector(dept), location: location || iso, country: iso,
            deadline: null,
            posted, salary, description, apply_url: applyUrl,
            experience: job.experience?.name || null, org_domain: `${org.subdomain}.breezy.hr`,
            source: 'Breezy', views: 0, apply_clicks: 0, paid_listing: false,
          }, { onConflict: 'id', ignoreDuplicates: false });

          if (result?.error) { console.error(`[breezy-scraper] Upsert error: ${result.error.message}`); totalSkipped++; }
          else totalImported++;
          await new Promise(r => setTimeout(r, 150));
        }
      } catch (err) {
        console.warn(`[breezy-scraper] ${org.name} failed:`, (err as Error).message);
      }
    }

    console.log(`[breezy-scraper] Done. Imported: ${totalImported}, Skipped: ${totalSkipped}`);
    return Response.json({ imported: totalImported, skipped: totalSkipped });

  } catch (topErr) {
    console.error('[breezy-scraper] UNCAUGHT:', (topErr as Error).message, (topErr as Error).stack);
    return Response.json({ error: (topErr as Error).message }, { status: 500 });
  }
});
