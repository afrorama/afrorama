/**
 * Afrorama — au-scraper Edge Function
 *
 * Scrapes job listings from the African Union careers portal (jobs.au.int).
 * The site uses SAP SuccessFactors. Jobs are fetched via a POST API discovered
 * by inspecting browser network traffic:
 *   POST https://jobs.au.int/services/recruiting/v1/jobs
 *
 * Covers: African Union Commission, AfCFTA Secretariat, AUDA-NEPAD,
 * African Court on Human and Peoples' Rights, and other AU organs.
 *
 * Deploy: supabase functions deploy au-scraper
 *
 * Schedule daily:
 *   SELECT cron.schedule('au-scraper-daily', '0 8 * * *',
 *     $$SELECT net.http_post(
 *       url := 'https://vqchwioyhyiuunpyildz.supabase.co/functions/v1/au-scraper',
 *       headers := '{"Authorization":"Bearer SERVICE_ROLE_KEY","Content-Type":"application/json"}'::jsonb,
 *       body := '{}'::jsonb,
 *       timeout_milliseconds := 90000
 *     )$$);
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { trySubmitSalary } from '../_shared/currency.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const SEARCH_API  = 'https://jobs.au.int/services/recruiting/v1/jobs';
const DETAIL_API  = 'https://jobs.au.int/services/recruiting/v1/job';
const APPLY_BASE  = 'https://jobs.au.int/go';
const CATEGORY_ID = 9831757;
const PAGE_SIZE   = 25;

const DISCLAIMER = '\n\n─────────────────────────────────────\nThis summary is automatically generated. For the complete job description, view the original posting.';

const COUNTRY_ISO: Record<string, string> = {
  'ethiopia':'ET','kenya':'KE','ghana':'GH','nigeria':'NG','south africa':'ZA',
  'senegal':'SN','cameroon':'CM','tanzania':'TZ','uganda':'UG','rwanda':'RW',
  'mozambique':'MZ','zambia':'ZM','malawi':'MW','zimbabwe':'ZW','botswana':'BW',
  'egypt':'EG','morocco':'MA','tunisia':'TN','algeria':'DZ','angola':'AO',
  'ivory coast':'CI',"côte d'ivoire":'CI','mali':'ML','burkina faso':'BF',
  'niger':'NE','chad':'TD','sudan':'SD','south sudan':'SS','somalia':'SO',
  'eritrea':'ER','djibouti':'DJ','comoros':'KM','mauritius':'MU','seychelles':'SC',
  'madagascar':'MG','namibia':'NA','lesotho':'LS','eswatini':'SZ','swaziland':'SZ',
  'addis ababa':'ET','abuja':'NG','nairobi':'KE','accra':'GH',
  'johannesburg':'ZA','cape town':'ZA','pretoria':'ZA','dakar':'SN','yaounde':'CM',
  'kampala':'UG','kigali':'RW','dar es salaam':'TZ','lusaka':'ZM','harare':'ZW',
  'maputo':'MZ','lilongwe':'MW','gaborone':'BW','windhoek':'NA',
};

function locationToIso(locations: string[]): { name: string; iso: string } {
  const loc = (locations || []).join(', ');
  const lower = loc.toLowerCase();
  for (const [name, iso] of Object.entries(COUNTRY_ISO)) {
    if (lower.includes(name)) return { name: loc, iso };
  }
  return { name: loc || 'Africa', iso: 'ET' }; // default to Ethiopia (AU HQ)
}

function mapGradeToType(grade: string, title: string): string {
  const g = (grade || '').toUpperCase();
  const t = (title || '').toLowerCase();
  if (g === 'INTERN' || t.includes('intern')) return 'internship';
  if (t.includes('consultant') || t.includes('consultancy') || g.includes('CONSULT')) return 'consultancy';
  if (t.includes('fellowship') || t.includes('fellow')) return 'capacity';
  return 'jobs';
}

function mapSector(title: string, org: string): string {
  const t = (title + ' ' + org).toLowerCase();
  if (/health|medical|epidem|disease|pharma/.test(t))                            return 'Health';
  if (/financ|account|audit|budget|treasury|grant/.test(t))                      return 'Finance & Economics';
  if (/tech|digital|ict|software|data|cyber|innovat/.test(t))                   return 'Innovation & Technology';
  if (/education|teach|school|learn|curricul|training/.test(t))                  return 'Education';
  if (/agricultur|food|farm|nutrition|livelihood|rural/.test(t))                 return 'Agriculture & Food Security';
  if (/climate|environment|energy|water|wash|sanitation|green/.test(t))          return 'Climate & Environment';
  if (/gender|women|girl|inclusion|social protect/.test(t))                      return 'Gender & Social Inclusion';
  if (/peace|security|conflict|defence|military|humanitar|protect|rights/.test(t)) return 'Human Rights';
  if (/infrastructure|urban|transport|logistics|construct/.test(t))              return 'Infrastructure & Urban Development';
  if (/trade|afcfta|customs|economic integration/.test(t))                       return 'Finance & Economics';
  return 'Governance & Public Policy';
}

function parseAuDate(str: string): string | null {
  if (!str) return null;
  // Handles "August 07, 2026", "8/7/26", "July 8, 2026"
  const clean = str.replace(/(\d{1,2})(st|nd|rd|th)/gi, '$1').trim();
  const d = new Date(clean);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  return null;
}

function stripHtml(html: string): string {
  return (html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<\/?(li|p|br|h[1-6]|div|tr|td)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function fallbackDesc(title: string, org: string): string {
  return `• Serve as part of the ${org}'s team in a role focused on ${title.toLowerCase().replace(/^internship program:\s*/i, '')}\n${DISCLAIMER}`;
}

async function formatWithClaude(title: string, org: string, bodyText: string): Promise<{ description: string; salary: string }> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return { description: fallbackDesc(title, org), salary: 'See listing' };

  const hasDesc = bodyText && bodyText.length > 80;
  const prompt = hasDesc
    ? `You are writing a job summary for Afrorama, Africa's social impact job board. Format in British English.

Task 1 — Write exactly 5 bullet points:
• Bullet 1: what the role is fundamentally about (from the opening/overview)
• Bullets 2–5: each begins with a strong imperative verb (Lead, Manage, Build, Drive, Develop, Coordinate, Deliver, Foster)
Parallel structure. No passive voice. No vague verbs like "help" or "assist".

Task 2 — Extract salary or compensation:
Look for figures, grades (P1–P5, D1–D2), allowances. Write "none" if truly absent.

Job: ${title} at ${org}

Description:
${bodyText.slice(0, 2500)}

Return in EXACTLY this format:
BULLETS:
• [bullet 1]
• [bullet 2]
• [bullet 3]
• [bullet 4]
• [bullet 5]
SALARY: [salary or none]`
    : `Write 5 concise bullet points for this African Union job listing in British English. Each bullet should be a realistic, specific task for this role. Begin bullets 2-5 with a strong imperative verb.

Role: ${title}
Organisation: ${org}

Return:
BULLETS:
• [bullet 1]
• [bullet 2]
• [bullet 3]
• [bullet 4]
• [bullet 5]
SALARY: none`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 400, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!res.ok) return { description: fallbackDesc(title, org), salary: 'See listing' };
    const data        = await res.json() as { content: { text: string }[] };
    const raw         = data.content?.[0]?.text?.trim() || '';
    const bullMatch   = raw.match(/BULLETS:\s*([\s\S]*?)(?=SALARY:|$)/i);
    const salaryMatch = raw.match(/SALARY:\s*(.+)/i);
    const bullets     = bullMatch?.[1]?.trim() || fallbackDesc(title, org);
    const salaryRaw   = salaryMatch?.[1]?.trim() || 'none';
    return { description: bullets + DISCLAIMER, salary: salaryRaw.toLowerCase() === 'none' ? 'See listing' : salaryRaw };
  } catch {
    return { description: fallbackDesc(title, org), salary: 'See listing' };
  }
}

async function fetchJobDescription(jobId: string): Promise<string> {
  try {
    // Try the job detail API first
    const res = await fetch(`${DETAIL_API}/${jobId}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0 (compatible; Afrorama/1.0)' },
    });
    if (res.ok) {
      const json = await res.json() as any;
      const desc = json?.jobDescription || json?.description || json?.externalDescription || '';
      if (desc && desc.length > 80) return stripHtml(desc);
    }
  } catch { /* fall through */ }

  try {
    // Fall back to the job listing page HTML (may be partially rendered)
    const res = await fetch(`${APPLY_BASE}/${jobId}/`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Afrorama/1.0)' },
    });
    if (res.ok) {
      const html = await res.text();
      const text = stripHtml(html);
      if (text.length > 300) return text.slice(0, 3000);
    }
  } catch { /* ignore */ }

  return '';
}

Deno.serve(async () => {
  console.log('[au-scraper] Starting…');

  // Fetch all pages
  const allJobs: any[] = [];
  let page = 0;
  let total = Infinity;

  while (page * PAGE_SIZE < total) {
    await new Promise(r => setTimeout(r, 300));
    const res = await fetch(SEARCH_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json',
                 'User-Agent': 'Mozilla/5.0 (compatible; Afrorama/1.0)' },
      body: JSON.stringify({
        locale: 'en_US', pageNumber: page, sortBy: '', keywords: '',
        location: '', facetFilters: {}, brand: '', alertId: '',
        categoryId: CATEGORY_ID, rcmCandidateId: '', skills: [],
      }),
    });

    if (!res.ok) { console.error(`[au-scraper] API error: ${res.status}`); break; }

    const json = await res.json() as { jobSearchResult: any[]; totalJobs: number };
    total = json.totalJobs || 0;
    const results = json.jobSearchResult || [];
    if (!results.length) break;

    allJobs.push(...results.map((r: any) => r.response));
    console.log(`[au-scraper] Page ${page}: ${results.length} jobs (total ${total})`);
    page++;
  }

  // Filter to Open jobs only
  const openJobs = allJobs.filter(j => (j.status || []).includes('Open'));
  console.log(`[au-scraper] ${openJobs.length} open jobs out of ${allJobs.length}`);

  // Check which are already in DB
  const ids = openJobs.map(j => `au-${j.id}`);
  const { data: existing } = await supabase.from('listings').select('id').in('id', ids);
  const existingSet = new Set((existing || []).map((r: any) => r.id));

  let imported = 0, skipped = 0;

  for (const job of openJobs) {
    const id  = `au-${job.id}`;
    const already = existingSet.has(id);

    const deadline = parseAuDate(job.cus_enddate);
    if (deadline && new Date(deadline) < new Date()) { skipped++; continue; }

    const title   = (job.unifiedStandardTitle || '').trim();
    const org     = (job.legalEntity_obj || ['African Union'])[0];
    const urlSlug = job.urlTitle || job.unifiedUrlTitle || '';
    const applyUrl = `${APPLY_BASE}/${urlSlug}/${job.id}/`;
    const { name: location, iso: country } = locationToIso(job.mfield1 || []);
    const posted = parseAuDate(job.cus_postingdate) || new Date().toISOString().split('T')[0];
    const type   = mapGradeToType(job.jobGrade || '', title);
    const sector = mapSector(title, org);

    if (!title) { skipped++; continue; }

    // Only fetch description for new listings (saves Claude API calls)
    let description: string;
    let salary: string;

    if (already) {
      // Update deadline only if changed
      await supabase.from('listings').update({ deadline }).eq('id', id);
      skipped++;
      continue;
    }

    await new Promise(r => setTimeout(r, 400));
    const bodyText = await fetchJobDescription(job.id);
    const formatted = await formatWithClaude(title, org, bodyText);
    description = formatted.description;
    salary      = formatted.salary;

    const entry = {
      id, title, organisation: org, type, sector,
      location: location || org, country, deadline, posted,
      salary, description, apply_url: applyUrl,
      source: 'African Union', views: 0, apply_clicks: 0, paid_listing: false,
    };

    const { error } = await supabase.from('listings').upsert(entry, { onConflict: 'id', ignoreDuplicates: false });
    if (error) { console.error(`[au-scraper] Upsert error for ${id}:`, error.message); skipped++; }
    else {
      imported++;
      console.log(`[au-scraper] ✓ ${title} @ ${org}`);
      await trySubmitSalary(supabase, { company: org, position: title, salaryText: salary, experienceText: '', sector, country });
    }
  }

  console.log(`[au-scraper] Done. Imported: ${imported}, Skipped: ${skipped}`);
  return Response.json({ imported, skipped, totalFound: openJobs.length });
});
