/**
 * Afrorama — dai-scraper Edge Function
 *
 * Scrapes Africa-based job listings from DAI Global via their ADP Workforce
 * Now public JSON API. No authentication required.
 *
 * List:   GET https://workforcenow.adp.com/mascsr/default/careercenter/public/events/staffing/v1/job-requisitions
 *              ?cid=5745ed7b-7f8d-47a9-9161-d975aa7f3314&ccId=19000101_000001&lang=en_US
 * Detail: GET same URL / {itemID} (adds requisitionDescription HTML)
 *
 * Deploy:  supabase functions deploy dai-scraper
 *
 * Schedule daily:
 *   SELECT cron.schedule('dai-scraper-daily', '0 7 * * *',
 *     $$SELECT net.http_post(
 *       url := 'https://vqchwioyhyiuunpyildz.supabase.co/functions/v1/dai-scraper',
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

const ADP_BASE  = 'https://workforcenow.adp.com/mascsr/default/careercenter/public/events/staffing/v1/job-requisitions';
const ADP_CID   = '5745ed7b-7f8d-47a9-9161-d975aa7f3314';
const ADP_CCID  = '19000101_000001';
const ADP_QUERY = `cid=${ADP_CID}&ccId=${ADP_CCID}&lang=en_US`;
const APPLY_BASE = `https://workforcenow.adp.com/mascsr/default/mdf/recruitment/recruitment.html?cid=${ADP_CID}&ccId=${ADP_CCID}&lang=en_US`;

const DISCLAIMER = '\n\n─────────────────────────────────────\nThis summary is automatically generated. For the complete job description, view the original posting.';

const AFRICA_COUNTRIES = new Set([
  'KE','ZA','NG','SN','ET','GH','TZ','UG','RW','ZM','MZ','MW','ZW','BW','NA',
  'CM','CI','BF','ML','NE','TD','SD','SS','SO','CD','CG','AO','BJ','BI','CV',
  'CF','KM','DJ','EG','GQ','ER','SZ','GA','GM','GN','GW','LS','LR','LY','MG',
  'MR','MU','MA','ST','SL','TG','TN',
]);

const COUNTRY_NAME_ISO: Record<string, string> = {
  'kenya':'KE','ethiopia':'ET','ghana':'GH','nigeria':'NG','uganda':'UG',
  'tanzania':'TZ','rwanda':'RW','zambia':'ZM','zimbabwe':'ZW','mozambique':'MZ',
  'malawi':'MW','senegal':'SN','mali':'ML','niger':'NE','burkina faso':'BF',
  'chad':'TD','cameroon':'CM','democratic republic of the congo':'CD','congo':'CG',
  'south africa':'ZA','namibia':'NA','botswana':'BW','angola':'AO',
  'sudan':'SD','south sudan':'SS','somalia':'SO','liberia':'LR',
  'sierra leone':'SL','guinea':'GN','ivory coast':'CI',"côte d'ivoire":'CI',
  'egypt':'EG','morocco':'MA','tunisia':'TN','algeria':'DZ','libya':'LY',
  'madagascar':'MG','mauritania':'MR','mauritius':'MU','eswatini':'SZ',
  'lesotho':'LS','gabon':'GA','gambia':'GM','benin':'BJ','togo':'TG',
  'eritrea':'ER','djibouti':'DJ','somalia':'SO','comoros':'KM',
  // Cities
  'nairobi':'KE','addis ababa':'ET','accra':'GH','abuja':'NG','kampala':'UG',
  'dar es salaam':'TZ','kigali':'RW','lusaka':'ZM','harare':'ZW','maputo':'MZ',
  'lilongwe':'MW','dakar':'SN','johannesburg':'ZA','cairo':'EG','rabat':'MA',
};

function locationToIso(locations: { nameCode?: { shortName?: string }; address?: { countryCode?: string } }[]): string | null {
  for (const loc of locations || []) {
    const iso = loc.address?.countryCode?.toUpperCase();
    if (iso && AFRICA_COUNTRIES.has(iso)) return iso;
    const label = (loc.nameCode?.shortName || '').toLowerCase();
    for (const [name, code] of Object.entries(COUNTRY_NAME_ISO)) {
      if (label.includes(name)) return code;
    }
  }
  return null;
}

// Matches any mention of Africa or an African country/region in text
const AFRICA_REGEX = /\b(africa[n]?|sub-saharan|east africa|west africa|southern africa|north africa|central africa|nairobi|addis ababa|abuja|accra|kampala|dar es salaam|kigali|lusaka|harare|dakar|johannesburg|kenya|ethiopia|nigeria|ghana|uganda|tanzania|rwanda|zambia|zimbabwe|mozambique|senegal|mali|niger|burkina faso|cameroon|ivory coast|c[oô]te d'ivoire|angola|madagascar|malawi|namibia|botswana|sudan|south sudan|somalia|liberia|sierra leone|guinea|togo|benin|eritrea|djibouti|morocco|egypt|tunisia|libya|algeria)\b/i;

function mentionsAfrica(text: string): boolean {
  return AFRICA_REGEX.test(text);
}

// Try to extract the most relevant African country ISO from free text
function extractCountryFromText(text: string): string {
  const t = text.toLowerCase();
  for (const [name, code] of Object.entries(COUNTRY_NAME_ISO)) {
    if (t.includes(name)) return code;
  }
  return 'ZZ'; // Multi-country / unspecified
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

function mapType(code: string, title: string): string {
  const c = (code || '').toLowerCase();
  const t = (title || '').toLowerCase();
  if (/intern|trainee|attach/i.test(t)) return 'internship';
  if (/consultant|advisor/i.test(t) || c === 'cons') return 'consultancy';
  if (/fellow/i.test(t)) return 'capacity';
  if (c.includes('temporary')) return 'jobs'; // short-term still jobs
  return 'jobs';
}

function mapSector(text: string): string {
  const t = text.toLowerCase();
  if (/health|medical|epidem|disease|wash/i.test(t))                     return 'Health';
  if (/financ|econom|account|audit|budget|grant/i.test(t))               return 'Finance & Economics';
  if (/tech|digital|ict|software|data|innovat/i.test(t))                 return 'Innovation & Technology';
  if (/education|teach|school|learn|training/i.test(t))                  return 'Education';
  if (/agricultur|food|farm|nutrition|rural/i.test(t))                   return 'Agriculture & Food Security';
  if (/climate|environment|energy|water|sanitation|green/i.test(t))      return 'Climate & Environment';
  if (/gender|women|girl|inclusion/i.test(t))                            return 'Gender & Social Inclusion';
  if (/peace|security|conflict|human rights|protection|safeguard/i.test(t)) return 'Human Rights';
  if (/infrastructure|urban|transport|construct/i.test(t))               return 'Infrastructure & Urban Development';
  if (/private sector|enterprise|trade|market/i.test(t))                 return 'Private Sector Development';
  if (/youth|employment|livelihoods|vocation/i.test(t))                  return 'Youth & Employment';
  return 'Governance & Public Policy';
}

function extractSalary(req: any): string {
  // Try custom string field first
  const strFields: { nameCode?: { codeValue?: string }; stringValue?: string }[] = req.customFieldGroup?.stringFields || [];
  const salaryField = strFields.find(f => f.nameCode?.codeValue === 'SalaryRange');
  if (salaryField?.stringValue && salaryField.stringValue.trim()) return salaryField.stringValue.trim();
  // Try pay grade range
  const min = req.payGradeRange?.minimumRate?.amountValue;
  const max = req.payGradeRange?.maximumRate?.amountValue;
  const cur = req.payGradeRange?.minimumRate?.currencyCode || 'USD';
  if (min && max) return `${cur} ${Math.round(min).toLocaleString()}–${Math.round(max).toLocaleString()} p.a.`;
  if (min) return `${cur} ${Math.round(min).toLocaleString()}+ p.a.`;
  return 'See listing';
}

async function formatWithClaude(title: string, bodyText: string): Promise<string> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey || !bodyText || bodyText.length < 80) {
    return `• Senior role at DAI Global focused on ${title.toLowerCase()}${DISCLAIMER}`;
  }
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', max_tokens: 350,
        messages: [{ role: 'user', content:
          `Write exactly 5 bullet points for this DAI Global job listing for Afrorama, Africa's social impact job board. British English.
• Bullet 1: what the role is fundamentally about (from the overview)
• Bullets 2–5: strong imperative verbs (Lead, Manage, Develop, Build, Drive, Coordinate, Deliver)
Concise, parallel structure, no passive voice.

Job: ${title} at DAI Global

${bodyText.slice(0, 2000)}

Return only the 5 bullets starting with •`
        }],
      }),
    });
    if (!res.ok) throw new Error(`Claude ${res.status}`);
    const data = await res.json() as { content: { text: string }[] };
    return (data.content?.[0]?.text?.trim() || `• ${title}`) + DISCLAIMER;
  } catch {
    return `• ${title} at DAI Global${DISCLAIMER}`;
  }
}

Deno.serve(async () => {
  console.log('[dai-scraper] Starting…');

  // Fetch all job requisitions
  const listRes = await fetch(`${ADP_BASE}?${ADP_QUERY}`, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0 (compatible; Afrorama/1.0)' },
  });
  if (!listRes.ok) {
    console.error('[dai-scraper] API error:', listRes.status);
    return Response.json({ error: `ADP API ${listRes.status}` }, { status: 502 });
  }

  const listData = await listRes.json() as { jobRequisitions: any[]; meta: { totalNumber: number } };
  const allJobs  = listData.jobRequisitions || [];
  console.log(`[dai-scraper] ${allJobs.length} total requisitions (of ${listData.meta?.totalNumber})`);

  // Check which already exist
  const ids = allJobs.map((j: any) => `dai-${j.itemID}`);
  const { data: existing } = await supabase.from('listings').select('id').in('id', ids);
  const existingSet = new Set((existing || []).map((r: any) => r.id));

  const today = new Date().toISOString().split('T')[0];
  let imported = 0, skipped = 0, africaFound = 0;

  for (const job of allJobs) {
    const dbId = `dai-${job.itemID}`;
    if (existingSet.has(dbId)) { skipped++; continue; }

    const title = (job.requisitionTitle || '').trim();

    await new Promise(r => setTimeout(r, 400));

    // Always fetch detail — we need description to check for Africa mentions
    let bodyText = '';
    try {
      const detailRes = await fetch(`${ADP_BASE}/${job.itemID}?${ADP_QUERY}`, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0 (compatible; Afrorama/1.0)' },
      });
      if (detailRes.ok) {
        const detail = await detailRes.json() as any;
        bodyText = stripHtml(detail.requisitionDescription || '');
      }
    } catch { /* use empty body */ }

    // Include if: office is in Africa OR title/description mentions Africa
    const locationIso = locationToIso(job.requisitionLocations || []);
    const isAfricaByLocation = locationIso !== null;
    const isAfricaByContent  = mentionsAfrica(title) || mentionsAfrica(bodyText);

    if (!isAfricaByLocation && !isAfricaByContent) {
      console.log(`[dai-scraper] Skip (not Africa-related): ${title}`);
      continue;
    }

    africaFound++;
    const country  = locationIso || extractCountryFromText(`${title} ${bodyText}`);
    const locLabel = (job.requisitionLocations?.[0]?.nameCode?.shortName || '').trim();
    const posted   = job.postDate ? job.postDate.slice(0, 10) : today;
    const salary   = extractSalary(job);
    const type     = mapType(job.workLevelCode?.shortName || '', title);
    const sector   = mapSector(`${title} ${bodyText}`);
    const description = await formatWithClaude(title, bodyText);

    const strFields: any[] = job.customFieldGroup?.stringFields || [];
    const extId = strFields.find((f: any) => f.nameCode?.codeValue === 'ExternalJobID')?.stringValue || '';
    const applyUrl = extId
      ? `${APPLY_BASE}&type=1&subtype=1&reqid=${extId}`
      : `${APPLY_BASE}&type=1&subtype=1`;

    const entry = {
      id: dbId, title,
      organisation: 'DAI Global',
      type, sector,
      location: locLabel || (isAfricaByContent ? 'Africa (various)' : country),
      country,
      deadline: null,
      posted, salary, description,
      apply_url: applyUrl,
      source: 'DAI Global',
      views: 0, apply_clicks: 0, paid_listing: false,
    };

    const { error } = await supabase.from('listings').upsert(entry, { onConflict: 'id', ignoreDuplicates: false });
    if (error) {
      console.error(`[dai-scraper] Upsert error ${dbId}:`, error.message);
      skipped++;
    } else {
      imported++;
      console.log(`[dai-scraper] ✓ ${title} (${isAfricaByLocation ? 'Africa office' : 'Africa mention'})`);
      await trySubmitSalary(supabase, { company: 'DAI Global', position: title, salaryText: salary, sector, country });
    }
  }

  console.log(`[dai-scraper] Done. imported=${imported} skipped=${skipped} africaFound=${africaFound}`);
  return Response.json({ imported, skipped, total: allJobs.length, africaFound });
});
