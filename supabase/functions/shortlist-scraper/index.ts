/**
 * Afrorama — shortlist-scraper Edge Function
 *
 * Scrapes job listings from Shortlist Africa (shortlist.thriveapp.ly).
 * Shortlist is an Africa-focused executive recruitment firm; each listing
 * is an active placement they are managing — high quality, curated roles.
 *
 * API (public, no auth):
 *   List:   GET https://shortlist.thriveapp.ly/api/v1/job_listings
 *   Detail: GET https://shortlist.thriveapp.ly/api/v1/job_listings/{id}
 *
 * The company name is embedded in job_title as "Role Title - Company Name".
 * Apply URL: https://shortlist.thriveapp.ly/job/{id}
 *
 * Deploy:  supabase functions deploy shortlist-scraper
 *
 * Schedule daily:
 *   SELECT cron.schedule('shortlist-scraper-daily', '0 7 * * *',
 *     $$SELECT net.http_post(
 *       url := 'https://vqchwioyhyiuunpyildz.supabase.co/functions/v1/shortlist-scraper',
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

const API_BASE   = 'https://shortlist.thriveapp.ly/api/v1/job_listings';
const APPLY_BASE = 'https://shortlist.thriveapp.ly/job';
const DISCLAIMER = '\n\n─────────────────────────────────────\nThis summary is automatically generated. For the complete job description, view the original posting.';

const COUNTRY_ISO: Record<string, string> = {
  'kenya':'KE','ethiopia':'ET','ghana':'GH','nigeria':'NG','uganda':'UG',
  'tanzania':'TZ','rwanda':'RW','zambia':'ZM','zimbabwe':'ZW','mozambique':'MZ',
  'senegal':'SN','south africa':'ZA','namibia':'NA','botswana':'BW',
  'malawi':'MW','angola':'AO','cameroon':'CM','mali':'ML','niger':'NE',
  'egypt':'EG','morocco':'MA','tunisia':'TN','ivory coast':'CI',
  'democratic republic of the congo':'CD','sudan':'SD','south sudan':'SS',
  'liberia':'LR','sierra leone':'SL','guinea':'GN','togo':'TG','benin':'BJ',
};

function countryToIso(name: string): string {
  return COUNTRY_ISO[name.toLowerCase()] || 'KE';
}

// Parse "Job Title - Company Name" → { title, org }
// Uses last occurrence of " - " to handle titles like "Head of Finance - East Africa - Acme Corp"
function parseJobTitle(raw: string): { title: string; org: string } {
  const parts = raw.split(' - ');
  if (parts.length === 1) return { title: raw.trim(), org: 'Shortlist Client' };
  const org   = parts[parts.length - 1].trim();
  const title = parts.slice(0, parts.length - 1).join(' - ').trim();
  return { title, org };
}

function mapPlacementType(name: string): string {
  const n = (name || '').toLowerCase();
  if (n.includes('intern'))     return 'internship';
  if (n.includes('contract') || n.includes('temp') || n.includes('fixed')) return 'consultancy';
  if (n.includes('fellow'))     return 'capacity';
  return 'jobs';
}

function mapSector(title: string, functionName: string): string {
  const t = `${title} ${functionName}`.toLowerCase();
  if (/health|medical|epidem|disease|pharma|clinical/i.test(t))             return 'Health';
  if (/financ|econom|account|audit|budget|treasury|invest/i.test(t))       return 'Finance & Economics';
  if (/tech|digital|ict|software|data|engineer|cyber|innovat/i.test(t))    return 'Innovation & Technology';
  if (/education|teach|school|learn|training|curricul/i.test(t))           return 'Education';
  if (/agricultur|food|farm|nutrition|rural|agri/i.test(t))                return 'Agriculture & Food Security';
  if (/climate|environment|energy|solar|water|wash|green|conservation/i.test(t)) return 'Climate & Environment';
  if (/gender|women|girl|inclusion|social protection/i.test(t))            return 'Gender & Social Inclusion';
  if (/peace|security|conflict|human rights|protection|safeguard/i.test(t)) return 'Human Rights';
  if (/infrastructure|urban|transport|logistics|construct/i.test(t))       return 'Infrastructure & Urban Development';
  if (/private sector|enterprise|trade|market|business|commercial/i.test(t)) return 'Private Sector Development';
  if (/youth|employment|livelihood|vocation|skill/i.test(t))               return 'Youth & Employment';
  if (/programme|project|coordinator|manager/i.test(t))                    return 'Governance & Public Policy';
  return 'Governance & Public Policy';
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

async function formatWithClaude(title: string, org: string, bodyText: string): Promise<string> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey || !bodyText || bodyText.length < 80) {
    return `• Senior role at ${org} focused on ${title.toLowerCase()}${DISCLAIMER}`;
  }
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', max_tokens: 350,
        messages: [{ role: 'user', content:
          `You are writing a job summary for Afrorama, Africa's social impact job board. British English.

Write exactly 5 bullet points:
• Bullet 1: what the role is fundamentally about (from the opening/overview)
• Bullets 2–5: each begins with a strong imperative verb (Lead, Manage, Build, Drive, Develop, Coordinate, Deliver, Foster)
Concise, action-oriented, parallel structure. No passive voice.

Job: ${title} at ${org}

Description:
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

interface ShortlistJob {
  id: number;
  job_title: string;
  description: string | null;
  location: string | null;
  city: string | null;
  country: string | null;
  job_function_name: string | null;
  placement_type_name: string | null;
  published_date: string | null;
  published: boolean;
}

Deno.serve(async () => {
  console.log('[shortlist-scraper] Starting…');

  const listRes = await fetch(API_BASE, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0 (compatible; Afrorama/1.0)' },
  });
  if (!listRes.ok) {
    console.error('[shortlist-scraper] API error:', listRes.status);
    return Response.json({ error: `API ${listRes.status}` }, { status: 502 });
  }

  const listData = await listRes.json() as { job_listings?: ShortlistJob[]; job_listing?: ShortlistJob } | ShortlistJob[];
  const jobs: ShortlistJob[] = Array.isArray(listData)
    ? listData
    : (listData as any).job_listings ?? [];

  const activeJobs = jobs.filter(j => j.published !== false);
  console.log(`[shortlist-scraper] ${activeJobs.length} active listings`);

  // Bulk-check which already exist
  const ids = activeJobs.map(j => `sl-${j.id}`);
  const { data: existing } = await supabase.from('listings').select('id').in('id', ids);
  const existingSet = new Set((existing || []).map((r: any) => r.id));

  const today = new Date().toISOString().split('T')[0];
  let imported = 0, skipped = 0;

  for (const job of activeJobs) {
    const dbId = `sl-${job.id}`;
    if (existingSet.has(dbId)) { skipped++; continue; }

    await new Promise(r => setTimeout(r, 400));

    // Fetch detail for description
    let bodyText = stripHtml(job.description || '');
    if (!bodyText || bodyText.length < 80) {
      try {
        const detailRes = await fetch(`${API_BASE}/${job.id}`, {
          headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0 (compatible; Afrorama/1.0)' },
        });
        if (detailRes.ok) {
          const detail = await detailRes.json() as { job_listing: ShortlistJob };
          bodyText = stripHtml(detail.job_listing?.description || '');
        }
      } catch { /* use what we have */ }
    }

    const { title, org } = parseJobTitle(job.job_title);
    const country     = countryToIso(job.country || '');
    const location    = [job.city, job.country].filter(Boolean).join(', ') || org;
    const posted      = job.published_date ? job.published_date.slice(0, 10) : today;
    const type        = mapPlacementType(job.placement_type_name || '');
    const sector      = mapSector(title, job.job_function_name || '');
    const description = await formatWithClaude(title, org, bodyText);

    const entry = {
      id: dbId, title,
      organisation: org,
      type, sector, location, country,
      deadline: null, // Shortlist doesn't publish closing dates
      posted,
      salary: 'See listing',
      description,
      apply_url: `${APPLY_BASE}/${job.id}`,
      source: 'Shortlist Africa',
      views: 0, apply_clicks: 0, paid_listing: false,
    };

    const { error } = await supabase.from('listings').upsert(entry, { onConflict: 'id', ignoreDuplicates: false });
    if (error) {
      console.error(`[shortlist-scraper] Upsert error ${dbId}:`, error.message);
      skipped++;
    } else {
      imported++;
      console.log(`[shortlist-scraper] ✓ ${title} @ ${org}`);
      await trySubmitSalary(supabase, { company: org, position: title, salaryText: 'See listing', sector, country });
    }
  }

  console.log(`[shortlist-scraper] Done. imported=${imported} skipped=${skipped}`);
  return Response.json({ imported, skipped, total: activeJobs.length });
});
