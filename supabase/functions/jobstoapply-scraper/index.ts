/**
 * Afrorama — jobstoapply-scraper Edge Function
 *
 * Scrapes Africa-focused job listings from jobstoapply.com via their
 * public WP REST API (no auth required).
 *
 * List:   GET /wp-json/ao-jobs/v1/jobs?continent=Africa&per_page=100&page=N
 * Detail: GET /wp-json/ao-jobs/v1/job/{id}  (adds full HTML content)
 *
 * Deploy:  supabase functions deploy jobstoapply-scraper
 *
 * Schedule daily:
 *   SELECT cron.schedule('jobstoapply-scraper-daily', '0 6 * * *',
 *     $$SELECT net.http_post(
 *       url := 'https://vqchwioyhyiuunpyildz.supabase.co/functions/v1/jobstoapply-scraper',
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

const API_BASE   = 'https://jobstoapply.com/wp-json/ao-jobs/v1';
const DISCLAIMER = '\n\n─────────────────────────────────────\nThis summary is automatically generated. For the complete job description, view the original posting.';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; Afrorama/1.0)',
  'Accept': 'application/json',
};

const COUNTRY_ISO: Record<string, string> = {
  'kenya':'KE','ethiopia':'ET','ghana':'GH','nigeria':'NG','uganda':'UG',
  'tanzania':'TZ','rwanda':'RW','zambia':'ZM','zimbabwe':'ZW','mozambique':'MZ',
  'senegal':'SN','south africa':'ZA','namibia':'NA','botswana':'BW',
  'malawi':'MW','angola':'AO','cameroon':'CM','mali':'ML','niger':'NE',
  'chad':'TD','sudan':'SD','south sudan':'SS','somalia':'SO','liberia':'LR',
  'sierra leone':'SL','guinea':'GN','togo':'TG','benin':'BJ','ivory coast':'CI',
  "côte d'ivoire":'CI','democratic republic of the congo':'CD','congo':'CG',
  'egypt':'EG','morocco':'MA','tunisia':'TN','algeria':'DZ','libya':'LY',
  'madagascar':'MG','mauritius':'MU','eritrea':'ER','djibouti':'DJ',
  'lesotho':'LS','eswatini':'SZ','gabon':'GA','gambia':'GM','cape verde':'CV',
  'burkina faso':'BF','mauritania':'MR','equatorial guinea':'GQ',
  'burundi':'BI','central african republic':'CF','comoros':'KM',
  'guinea-bissau':'GW','sao tome and principe':'ST',
  // Cities
  'nairobi':'KE','addis ababa':'ET','accra':'GH','abuja':'NG','kampala':'UG',
  'dar es salaam':'TZ','kigali':'RW','lusaka':'ZM','harare':'ZW','maputo':'MZ',
  'dakar':'SN','johannesburg':'ZA','cairo':'EG','rabat':'MA',
};

function countryToIso(name: string): string {
  return COUNTRY_ISO[(name || '').toLowerCase()] || 'ZZ';
}

const CSS_JUNK = /img:is\(|sourceURL=|contain-intrinsic-size|relatedParts\.push|metaItemHTML|hasMetaValue|filterValueLinks|escapeHtml\(/;

function stripHtml(html: string): string {
  const text = (html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<\/?(li|p|br|h[1-6]|div|tr|td|th|ul|ol)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  // Discard if the result contains leaked CSS/JS rather than prose
  if (CSS_JUNK.test(text)) return '';
  return text;
}

function isCleanField(value: string): boolean {
  return !CSS_JUNK.test(value || '');
}

// Returns true if the job entry looks like valid data worth importing
function isValidJob(job: JtaJob): boolean {
  const t = (job.title || '').trim();
  const o = (job.org   || '').trim();
  // Blank or suspiciously short title
  if (!t || t.length < 5) return false;
  // Section headings, about pages, site-level pages
  if (/^(major\s+respons|qualifications|requirements|duties|about\s+the|key\s+respons|open\s+jobs|jobstoapply)/i.test(t)) return false;
  // Title contains " - JobsToApply" suffix (site page title)
  if (/jobstoapply/i.test(t)) return false;
  // Org implausibly short (e.g. "II")
  if (o.length < 3) return false;
  // Location or other fields contain leaked CSS/JS
  if (!isCleanField(job.location) || !isCleanField(job.country)) return false;
  return true;
}

function mapType(typeStr: string): string {
  const t = (typeStr || '').toLowerCase();
  if (/intern|trainee|volunteer/i.test(t))  return 'internship';
  if (/consult|contract|freelance|temp/i.test(t)) return 'consultancy';
  if (/fellow|grant|capacity/i.test(t))     return 'capacity';
  return 'jobs';
}

function mapSector(text: string): string {
  const t = text.toLowerCase();
  if (/health|medical|epidem|disease|wash|clinic/i.test(t))               return 'Health';
  if (/financ|econom|account|audit|budget|grant|invest/i.test(t))         return 'Finance & Economics';
  if (/tech|digital|ict|software|data|innovat|engineer/i.test(t))         return 'Innovation & Technology';
  if (/education|teach|school|learn|training|youth/i.test(t))             return 'Education';
  if (/agricultur|food|farm|nutrition|rural/i.test(t))                    return 'Agriculture & Food Security';
  if (/climate|environment|energy|solar|water|sanitation|conservation/i.test(t)) return 'Climate & Environment';
  if (/gender|women|girl|inclusion|gbv/i.test(t))                         return 'Gender & Social Inclusion';
  if (/peace|security|conflict|human rights|protection|refugee/i.test(t)) return 'Human Rights';
  if (/infrastructure|urban|transport|construct|housing/i.test(t))        return 'Infrastructure & Urban Development';
  if (/private sector|enterprise|trade|market|business/i.test(t))         return 'Private Sector Development';
  if (/livelihoods|employment|vocational|skills/i.test(t))                return 'Youth & Employment';
  return 'Governance & Public Policy';
}

async function formatWithClaude(title: string, org: string, bodyText: string): Promise<string> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey || !bodyText || bodyText.length < 80) {
    return `• ${title} at ${org}${DISCLAIMER}`;
  }
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', max_tokens: 350,
        messages: [{ role: 'user', content:
          `Write exactly 5 bullet points for this Africa-focused job listing for Afrorama. British English.
• Bullet 1: what the role is fundamentally about
• Bullets 2–5: strong imperative verbs (Lead, Manage, Build, Drive, Develop, Coordinate, Deliver)
Concise, parallel structure, no passive voice.

Job: ${title} at ${org}

${bodyText.slice(0, 2200)}

Return only the 5 bullets, each starting with •`
        }],
      }),
    });
    if (!res.ok) throw new Error(`Claude ${res.status}`);
    const data = await res.json() as { content: { text: string }[] };
    return (data.content?.[0]?.text?.trim() || `• ${title}`) + DISCLAIMER;
  } catch {
    return `• ${title} at ${org}${DISCLAIMER}`;
  }
}

interface JtaJob {
  id: number;
  title: string;
  org: string;
  country: string;
  location: string;
  type: string;
  salary_label: string;
  deadline: string | null;
  apply_url: string;
  posted_on: string;
  excerpt: string;
  content?: string;
}

Deno.serve(async () => {
  console.log('[jobstoapply] Starting…');

  // Fetch all Africa jobs — API returns 46 total; per_page=100 gets them in one shot
  const allJobs: JtaJob[] = [];
  let page = 1;
  while (true) {
    const res = await fetch(`${API_BASE}/jobs?continent=Africa&per_page=100&page=${page}`, { headers: HEADERS });
    if (!res.ok) { console.error(`[jobstoapply] List API ${res.status} on page ${page}`); break; }
    const data = await res.json() as { total_pages: number; jobs: JtaJob[] };
    allJobs.push(...(data.jobs || []));
    console.log(`[jobstoapply] Page ${page}/${data.total_pages}: ${data.jobs?.length ?? 0} jobs`);
    if (page >= data.total_pages) break;
    page++;
    await new Promise(r => setTimeout(r, 400));
  }

  console.log(`[jobstoapply] Total fetched: ${allJobs.length}`);

  // Check which already exist in DB
  const dbIds = allJobs.map(j => `jta-${j.id}`);
  const { data: existing } = await supabase.from('listings').select('id').in('id', dbIds);
  const existingSet = new Set((existing || []).map((r: any) => r.id));

  const today = new Date().toISOString().split('T')[0];
  let imported = 0, skipped = 0;

  for (const job of allJobs) {
    const dbId = `jta-${job.id}`;
    if (existingSet.has(dbId)) { skipped++; continue; }

    // Skip junk entries (bad title, implausible org)
    if (!isValidJob(job)) {
      console.log(`[jobstoapply] Skip (invalid): "${job.title}" @ "${job.org}"`);
      skipped++;
      continue;
    }

    // Skip expired
    if (job.deadline && job.deadline < today) { skipped++; continue; }

    // Fetch detail for full content
    let bodyText = stripHtml(job.excerpt || '');
    await new Promise(r => setTimeout(r, 400));
    try {
      const detailRes = await fetch(`${API_BASE}/job/${job.id}`, { headers: HEADERS });
      if (detailRes.ok) {
        const detail = await detailRes.json() as JtaJob;
        if (detail.content) bodyText = stripHtml(detail.content);
      }
    } catch { /* use excerpt */ }

    const country     = countryToIso(job.country);
    const sector      = mapSector(`${job.title} ${job.org} ${bodyText}`);
    const type        = mapType(job.type);
    const description = await formatWithClaude(job.title, job.org, bodyText);
    const salary      = (job.salary_label || '').replace(/,$/, '').trim() || 'See listing';

    const entry = {
      id: dbId,
      title:        job.title,
      organisation: job.org || 'See listing',
      type, sector,
      location:     job.location || job.country || 'Africa',
      country,
      deadline:     job.deadline || null,
      posted:       job.posted_on || today,
      salary,
      description,
      apply_url:    job.apply_url,
      source:       'JobsToApply',
      views: 0, apply_clicks: 0, paid_listing: false,
    };

    const { error } = await supabase.from('listings').upsert(entry, { onConflict: 'id', ignoreDuplicates: false });
    if (error) {
      console.error(`[jobstoapply] Upsert error ${dbId}:`, error.message);
      skipped++;
    } else {
      imported++;
      console.log(`[jobstoapply] ✓ ${job.title} @ ${job.org}`);
      await trySubmitSalary(supabase, { company: job.org, position: job.title, salaryText: salary, sector, country });
    }
  }

  console.log(`[jobstoapply] Done. imported=${imported} skipped=${skipped} total=${allJobs.length}`);
  return Response.json({ imported, skipped, total: allJobs.length });
});
