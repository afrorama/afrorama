/**
 * Afrorama — afdb-scraper Edge Function
 *
 * Scrapes job listings from the African Development Bank careers portal.
 * AfDB uses SAP SuccessFactors (jobs2web), which serves server-rendered HTML
 * with no public JSON API. Jobs are parsed from HTML search results and
 * detail pages.
 *
 * List:   GET https://afdb.jobs2web.com/search/?q=&locale=en_US&numPerPage=100
 * Detail: GET https://afdb.jobs2web.com/job/{loc}-{title}/{id}/
 *
 * Deploy:  supabase functions deploy afdb-scraper
 *
 * Schedule daily:
 *   SELECT cron.schedule('afdb-scraper-daily', '0 7 * * *',
 *     $$SELECT net.http_post(
 *       url := 'https://vqchwioyhyiuunpyildz.supabase.co/functions/v1/afdb-scraper',
 *       headers := '{"Authorization":"Bearer SERVICE_ROLE_KEY","Content-Type":"application/json"}'::jsonb,
 *       body := '{}'::jsonb,
 *       timeout_milliseconds := 120000
 *     )$$);
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { trySubmitSalary } from '../_shared/currency.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const BASE        = 'https://afdb.jobs2web.com';
const SEARCH_URL  = `${BASE}/search/?q=&locale=en_US&numPerPage=100`;
const DISCLAIMER  = '\n\n─────────────────────────────────────\nThis summary is automatically generated. For the complete job description, view the original posting.';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; Afrorama/1.0)',
  'Accept': 'text/html,application/xhtml+xml',
};

function stripHtml(html: string): string {
  return (html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<\/?(li|p|br|h[1-6]|div|tr|td|th)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function parseMDYDate(raw: string): string | null {
  const m = raw?.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;
}

function mapGradeToType(grade: string, title: string): string {
  const g = (grade || '').toUpperCase();
  const t = (title || '').toLowerCase();
  if (/intern|youth/i.test(t) || /^YP/.test(g)) return 'internship';
  if (/consultant|advisor/i.test(t)) return 'consultancy';
  if (/fellow/i.test(t)) return 'capacity';
  return 'jobs';
}

function mapSector(text: string): string {
  const t = text.toLowerCase();
  if (/health|medical|epidem|disease/i.test(t))                            return 'Health';
  if (/financ|econom|account|audit|budget|treasury|grant/i.test(t))       return 'Finance & Economics';
  if (/tech|digital|ict|software|data|innovat/i.test(t))                  return 'Innovation & Technology';
  if (/education|teach|school|learn|training/i.test(t))                   return 'Education';
  if (/agricultur|food|farm|nutrition|rural/i.test(t))                    return 'Agriculture & Food Security';
  if (/climate|environment|energy|water|wash|sanitation|green/i.test(t))  return 'Climate & Environment';
  if (/gender|women|girl|inclusion|social/i.test(t))                      return 'Gender & Social Inclusion';
  if (/peace|security|conflict|human rights|protection/i.test(t))         return 'Human Rights';
  if (/infrastructure|urban|transport|logistics|construct/i.test(t))      return 'Infrastructure & Urban Development';
  if (/trade|private sector|enterprise/i.test(t))                         return 'Private Sector Development';
  return 'Governance & Public Policy';
}

// Location → ISO. AfDB is based in Abidjan; many roles are regional.
const LOCATION_ISO: Record<string, string> = {
  'abidjan':'CI','ivory coast':'CI',"côte d'ivoire":'CI',
  'nairobi':'KE','kenya':'KE','addis ababa':'ET','ethiopia':'ET',
  'accra':'GH','ghana':'GH','abuja':'NG','nigeria':'NG',
  'lusaka':'ZM','zambia':'ZM','dar es salaam':'TZ','tanzania':'TZ',
  'kampala':'UG','uganda':'UG','kigali':'RW','rwanda':'RW',
  'dakar':'SN','senegal':'SN','cairo':'EG','egypt':'EG',
  'rabat':'MA','morocco':'MA','johannesburg':'ZA','pretoria':'ZA','south africa':'ZA',
  'yaounde':'CM','cameroon':'CM','maputo':'MZ','mozambique':'MZ',
  'harare':'ZW','zimbabwe':'ZW','lilongwe':'MW','malawi':'MW',
  'gaborone':'BW','botswana':'BW','windhoek':'NA','namibia':'NA',
  'tunis':'TN','tunisia':'TN','tripoli':'LY','libya':'LY',
  'algiers':'DZ','algeria':'DZ','bamako':'ML','mali':'ML',
  'ouagadougou':'BF','burkina faso':'BF','niamey':'NE','niger':'NE',
  'lomé':'TG','togo':'TG','cotonou':'BJ','benin':'BJ',
  'conakry':'GN','guinea':'GN','freetown':'SL','sierra leone':'SL',
  'monrovia':'LR','liberia':'LR','banjul':'GM','gambia':'GM',
  'praia':'CV','cape verde':'CV','libreville':'GA','gabon':'GA',
};

function locationToIso(loc: string): string {
  const lower = loc.toLowerCase();
  for (const [key, iso] of Object.entries(LOCATION_ISO)) {
    if (lower.includes(key)) return iso;
  }
  return 'CI'; // AfDB HQ default
}

interface AfdbJob { id: string; title: string; href: string; location: string; family: string }

async function fetchListings(): Promise<AfdbJob[]> {
  const res = await fetch(SEARCH_URL, { headers: HEADERS });
  if (!res.ok) throw new Error(`Search page ${res.status}`);
  const html = await res.text();

  const jobs: AfdbJob[] = [];
  // Each job is in a <tr class="data-row"> ... </tr>
  const rowRe = /<tr[^>]*class="[^"]*data-row[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRe.exec(html)) !== null) {
    const row = rowMatch[1];

    const titleMatch = row.match(/<a[^>]*class="[^"]*jobTitle-link[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!titleMatch) continue;

    const href     = titleMatch[1].startsWith('http') ? titleMatch[1] : `${BASE}${titleMatch[1]}`;
    const title    = titleMatch[2].replace(/<[^>]+>/g, '').trim();
    const locMatch = row.match(/<span[^>]*class="[^"]*jobLocation[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
    const famMatch = row.match(/<span[^>]*class="[^"]*jobFacility[^"]*"[^>]*>([\s\S]*?)<\/span>/i);

    const idMatch  = href.match(/\/(\d+)\/?$/);
    if (!idMatch) continue;

    jobs.push({
      id:       idMatch[1],
      title:    title.replace(/&amp;/g, '&').replace(/&#\d+;/g, ''),
      href,
      location: locMatch ? locMatch[1].replace(/<[^>]+>/g, '').trim() : '',
      family:   famMatch ? famMatch[1].replace(/<[^>]+>/g, '').trim() : '',
    });
  }

  return jobs;
}

interface DetailInfo { closing: string | null; posted: string | null; grade: string; bodyText: string }

async function fetchDetail(href: string): Promise<DetailInfo> {
  try {
    const res = await fetch(href, { headers: HEADERS });
    if (!res.ok) return { closing: null, posted: null, grade: '', bodyText: '' };
    const html = await res.text();

    // Extract jobdescription span
    const descMatch = html.match(/<span[^>]*class="[^"]*jobdescription[^"]*"[^>]*>([\s\S]*?)<\/span>\s*<\/div>/i)
                   || html.match(/<div[^>]*class="[^"]*jobdescription[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    const descHtml  = descMatch?.[1] || '';
    const bodyText  = stripHtml(descHtml);

    const closing = (bodyText.match(/[Cc]losing\s*[Dd]ate\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{4})/) ||
                     bodyText.match(/[Cc]lose\s*[Dd]ate\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{4})/))
                    ?.[1] ?? null;
    const posted  = bodyText.match(/[Pp]osting\s*[Dd]ate\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{4})/)?.[1] ?? null;
    const grade   = bodyText.match(/[Gg]rade\s*:?\s*([A-Z0-9/]+)/)?.[1]?.trim() ?? '';

    return { closing: closing ? parseMDYDate(closing) : null, posted: posted ? parseMDYDate(posted) : null, grade, bodyText };
  } catch {
    return { closing: null, posted: null, grade: '', bodyText: '' };
  }
}

async function formatWithClaude(title: string, org: string, bodyText: string): Promise<{ description: string; salary: string }> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  const hasDesc = bodyText && bodyText.length > 80;
  if (!apiKey || !hasDesc) {
    return { description: `• Senior role at the African Development Bank focused on ${title.toLowerCase()}\n${DISCLAIMER}`, salary: 'See listing' };
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', max_tokens: 400,
        messages: [{ role: 'user', content:
          `You are writing a job summary for Afrorama, Africa's social impact job board. British English.

Write exactly 5 bullet points:
• Bullet 1: what the role is fundamentally about
• Bullets 2–5: each begins with a strong imperative verb (Lead, Manage, Develop, Drive, Coordinate, Build, Deliver)

Also extract salary/grade/pay band if mentioned (write "none" if absent).

Job: ${title} at ${org}

Description:
${bodyText.slice(0, 2500)}

Return EXACTLY:
BULLETS:
• [bullet 1]
• [bullet 2]
• [bullet 3]
• [bullet 4]
• [bullet 5]
SALARY: [salary/grade or none]`
        }],
      }),
    });
    if (!res.ok) throw new Error(`Claude ${res.status}`);
    const data = await res.json() as { content: { text: string }[] };
    const raw  = data.content?.[0]?.text?.trim() || '';
    const bullets   = raw.match(/BULLETS:\s*([\s\S]*?)(?=SALARY:|$)/i)?.[1]?.trim() || '';
    const salaryRaw = raw.match(/SALARY:\s*(.+)/i)?.[1]?.trim() || 'none';
    return {
      description: (bullets || `• ${title} at ${org}`) + DISCLAIMER,
      salary: salaryRaw.toLowerCase() === 'none' ? 'See listing' : salaryRaw,
    };
  } catch {
    return { description: `• ${title} at ${org}${DISCLAIMER}`, salary: 'See listing' };
  }
}

Deno.serve(async () => {
  console.log('[afdb-scraper] Starting…');

  let listings: AfdbJob[];
  try {
    listings = await fetchListings();
  } catch (e) {
    console.error('[afdb-scraper] Failed to fetch listings:', (e as Error).message);
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
  console.log(`[afdb-scraper] Found ${listings.length} jobs on search page`);

  // Bulk-check which IDs already exist
  const ids = listings.map(j => `afdb-${j.id}`);
  const { data: existing } = await supabase.from('listings').select('id').in('id', ids);
  const existingSet = new Set((existing || []).map((r: any) => r.id));

  const today = new Date().toISOString().split('T')[0];
  let imported = 0, skipped = 0;

  for (const job of listings) {
    const dbId = `afdb-${job.id}`;

    if (existingSet.has(dbId)) { skipped++; continue; }

    await new Promise(r => setTimeout(r, 500));
    const { closing, posted, grade, bodyText } = await fetchDetail(job.href);

    if (closing && closing < today) { skipped++; continue; }

    const { description, salary } = await formatWithClaude(job.title, 'African Development Bank', bodyText);
    const country = locationToIso(job.location);
    const sector  = mapSector(`${job.title} ${job.family} ${bodyText}`);
    const type    = mapGradeToType(grade, job.title);

    const entry = {
      id: dbId,
      title: job.title,
      organisation: 'African Development Bank',
      type, sector,
      location: job.location || 'Abidjan, Côte d\'Ivoire',
      country,
      deadline: closing || null,
      posted: posted || today,
      salary, description,
      apply_url: job.href,
      source: 'African Development Bank',
      views: 0, apply_clicks: 0, paid_listing: false,
    };

    const { error } = await supabase.from('listings').upsert(entry, { onConflict: 'id', ignoreDuplicates: false });
    if (error) {
      console.error(`[afdb-scraper] Upsert error ${dbId}:`, error.message);
      skipped++;
    } else {
      imported++;
      console.log(`[afdb-scraper] ✓ ${job.title}`);
      await trySubmitSalary(supabase, { company: 'African Development Bank', position: job.title, salaryText: salary, sector, country });
    }
  }

  console.log(`[afdb-scraper] Done. imported=${imported} skipped=${skipped}`);
  return Response.json({ imported, skipped, total: listings.length });
});
