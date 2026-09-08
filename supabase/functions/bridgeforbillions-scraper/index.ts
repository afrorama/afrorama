/**
 * Afrorama — bridgeforbillions-scraper Edge Function
 *
 * Scrapes Bridge for Billions' Odoo-hosted careers page (a single small
 * job board — no pagination as of writing) and imports only roles whose
 * jobLocation resolves to an African country. Bridge for Billions posts
 * globally (LatAm, Spain, fully-remote, etc.), so this is a strict
 * allow-list filter, not a keyword search — anything with no confirmed
 * country, or a confirmed non-African one, is skipped.
 *
 * Deploy: supabase functions deploy bridgeforbillions-scraper
 *
 * Schedule daily:
 *   SELECT cron.schedule('bridgeforbillions-daily', '0 11 * * *',
 *     $$SELECT net.http_post(
 *       url := 'https://vqchwioyhyiuunpyildz.supabase.co/functions/v1/bridgeforbillions-scraper',
 *       headers := '{"Authorization":"Bearer SERVICE_ROLE_KEY","Content-Type":"application/json"}'::jsonb,
 *       body := '{}'::jsonb
 *     )$$);
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { trySubmitSalary } from '../_shared/currency.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const BASE       = 'https://bridgeforbillions.odoo.com';
const ORG        = 'Bridge for Billions';
const ORG_DOMAIN = 'bridgeforbillions.org';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; Afrorama/1.0; +https://afrorama.org)',
  'Accept':     'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-GB,en;q=0.9',
};

const DISCLAIMER = '\n\n─────────────────────────────────────\nThis summary is automatically generated for quick reference. For the complete and authoritative job description, please view the original posting.';

// Official English country names as Odoo's res.country model tends to render
// them, lowercased, plus common variant spellings — matched against the
// jobLocation address microdata on each job's detail page.
const AFRICA_ISO: Record<string, string> = {
  'algeria':'DZ', 'angola':'AO', 'benin':'BJ', 'botswana':'BW', 'burkina faso':'BF',
  'burundi':'BI', 'cabo verde':'CV', 'cape verde':'CV', 'cameroon':'CM',
  'central african republic':'CF', 'chad':'TD', 'comoros':'KM',
  'congo':'CG', 'republic of congo':'CG', 'congo, republic of the':'CG', 'congo republic':'CG',
  'dr congo':'CD', 'drc':'CD', 'democratic republic of congo':'CD',
  'democratic republic of the congo':'CD', 'congo, democratic republic of the':'CD',
  "cote d'ivoire":'CI', "côte d'ivoire":'CI', 'ivory coast':'CI',
  'djibouti':'DJ', 'egypt':'EG', 'equatorial guinea':'GQ', 'eritrea':'ER',
  'eswatini':'SZ', 'swaziland':'SZ', 'ethiopia':'ET', 'gabon':'GA',
  'gambia':'GM', 'the gambia':'GM', 'ghana':'GH', 'guinea':'GN',
  'guinea-bissau':'GW', 'kenya':'KE', 'lesotho':'LS', 'liberia':'LR',
  'libya':'LY', 'madagascar':'MG', 'malawi':'MW', 'mali':'ML',
  'mauritania':'MR', 'mauritius':'MU', 'morocco':'MA', 'mozambique':'MZ',
  'namibia':'NA', 'niger':'NE', 'nigeria':'NG', 'rwanda':'RW',
  'sao tome and principe':'ST', 'são tomé and príncipe':'ST', 'sao tome & principe':'ST',
  'senegal':'SN', 'seychelles':'SC', 'sierra leone':'SL', 'somalia':'SO',
  'south africa':'ZA', 'south sudan':'SS', 'sudan':'SD',
  'tanzania':'TZ', 'tanzania, united republic of':'TZ', 'united republic of tanzania':'TZ',
  'togo':'TG', 'tunisia':'TN', 'uganda':'UG', 'zambia':'ZM', 'zimbabwe':'ZW',
};

function resolveAfricanIso(rawCountry: string): string | null {
  const key = rawCountry.trim().toLowerCase().replace(/,+$/, '');
  if (AFRICA_ISO[key]) return AFRICA_ISO[key];
  // Fallback: substring match, longest key first so "democratic republic of
  // the congo" doesn't get short-circuited by the plain "congo" entry.
  const keys = Object.keys(AFRICA_ISO).sort((a, b) => b.length - a.length);
  for (const k of keys) if (key.includes(k)) return AFRICA_ISO[k];
  return null;
}

function extractListingSlugs(html: string): string[] {
  const seen = new Set<string>();
  const pattern = /href="(\/jobs\/[a-z0-9][a-z0-9-]*)"/gi;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    if (m[1] === '/jobs' || m[1].startsWith('/jobs/apply')) continue;
    seen.add(m[1]);
  }
  return [...seen];
}

function stripHtml(html: string): string {
  return (html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<\/?(li|p|br|h[1-6]|div|tr|td|th)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

interface JobMeta {
  title: string;
  postedDate: string | null;
  addressLines: string[];
  bodyHtml: string;
}

// Odoo renders a schema.org JobPosting microdata block right at the top of
// #wrap on every job detail page — far more reliable than scraping the
// visual layout, and it's where title/datePosted/jobLocation all live.
function parseJobPage(html: string): JobMeta | null {
  const wrapStart = html.indexOf('id="wrap"');
  const sectionStart = html.indexOf('<section class="pb32">', wrapStart);
  if (wrapStart === -1 || sectionStart === -1) return null;
  const metaBlock = html.slice(wrapStart, sectionStart);

  const get = (prop: string) => metaBlock.match(new RegExp(`itemprop="${prop}"\\s+content="([^"]*)"`, 'i'))?.[1] ?? null;

  const title      = get('title');
  const postedDate = get('datePosted');
  const addressRaw = get('address') || '';
  const addressLines = addressRaw
    .split('\n')
    .map(l => l.trim().replace(/,+$/, ''))
    .filter(Boolean);

  if (!title) return null;

  // Body content: everything between the meta block and the footer, so
  // Claude sees the actual job description without nav/footer chrome.
  const footerStart = html.indexOf('id="bottom"', sectionStart);
  const bodyHtml = html.slice(sectionStart, footerStart === -1 ? undefined : footerStart);

  return { title, postedDate, addressLines, bodyHtml };
}

function mapSector(title: string): string {
  const t = title.toLowerCase();
  if (/health|medical|clinic|nurse|doctor|epidem/.test(t))             return 'Health';
  if (/finance|grant|accounti|budget|treasury/.test(t))                return 'Finance & Economics';
  if (/tech|software|data|gis|digital|ict|it\b/.test(t))               return 'Innovation & Technology';
  if (/education|teach|school|learning|curricul/.test(t))              return 'Education';
  if (/agricultur|food|farm|nutrition|livelihood/.test(t))             return 'Agriculture & Food Security';
  if (/climate|environment|energy|wash|water|sanitation/.test(t))      return 'Climate & Environment';
  if (/gender|women|girl|inclusion|social protect/.test(t))            return 'Gender & Social Inclusion';
  if (/protection|human rights|legal|justice/.test(t))                 return 'Human Rights';
  if (/partnership|ecosystem|program|entrepreneur|business development/.test(t)) return 'Governance & Public Policy';
  return 'Governance & Public Policy';
}

function mapType(title: string): string {
  const t = title.toLowerCase();
  if (/intern|trainee|volunteer|fellowship/.test(t))                          return 'internship';
  if (/consultant|consultancy|advisor|adviser|contractor|freelance/.test(t))  return 'consultancy';
  return 'jobs';
}

function fallbackDesc(bodyText: string, org: string): string {
  const lines = (bodyText || '')
    .split('\n')
    .map(l => l.trim().replace(/^[-•*–·]\s*/, ''))
    .filter(l => l.length > 40)
    .slice(0, 3);
  if (!lines.length) return `${org} has posted this role. View the original listing for full details.${DISCLAIMER}`;
  return lines.map(l => `• ${l[0].toUpperCase() + l.slice(1)}`).join('\n') + DISCLAIMER;
}

async function formatWithClaude(title: string, bodyText: string): Promise<{ description: string; salary: string }> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey || !bodyText || bodyText.length < 80) return { description: fallbackDesc(bodyText, ORG), salary: 'See listing' };
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', max_tokens: 400,
        // Bridge for Billions postings run long (their "OFFER AND LOCATION"
        // section with the actual salary often sits 8-10k characters in,
        // well past other sources' typical length) — send the whole thing
        // rather than a short prefix, Haiku's context window handles it easily.
        messages: [{ role: 'user', content: `You are writing a job summary for Afrorama, Africa's social impact job board. Format the job description below in British English.\n\nTask 1 — Write exactly 5 bullet points:\n- Bullet 1 drawn from the opening overview\n- Bullets 2–5 begin with a strong imperative verb\n- Concise and action-oriented, British English spelling\n\nTask 2 — Extract salary or compensation (be thorough): look for ANY clue anywhere in the text — explicit figures, ranges, allowances or stipends, often found in a section like "Offer and Location" or "Compensation". Only write none if there is absolutely zero mention of pay, salary, or compensation\n\nJob: ${title} at ${ORG}\n\nDescription:\n${bodyText.slice(0, 15000)}\n\nReturn:\nBULLETS:\n• [bullet 1]\n• [bullet 2]\n• [bullet 3]\n• [bullet 4]\n• [bullet 5]\nSALARY: [salary or none]` }],
      }),
    });
    if (!res.ok) return { description: fallbackDesc(bodyText, ORG), salary: 'See listing' };
    const data = await res.json() as { content: { text: string }[] };
    const raw = data.content?.[0]?.text?.trim() || '';
    const bullets = raw.match(/BULLETS:\s*([\s\S]*?)(?=SALARY:|$)/i)?.[1]?.trim() || fallbackDesc(bodyText, ORG);
    const salaryRaw = raw.match(/SALARY:\s*(.+)/i)?.[1]?.trim() || 'none';
    return { description: bullets + DISCLAIMER, salary: salaryRaw.toLowerCase() === 'none' ? 'See listing' : salaryRaw };
  } catch { return { description: fallbackDesc(bodyText, ORG), salary: 'See listing' }; }
}

Deno.serve(async () => {
  console.log('[bridgeforbillions-scraper] Starting...');

  let totalImported = 0, totalSkipped = 0;

  try {
    const res = await fetch(`${BASE}/jobs`, { headers: HEADERS });
    if (!res.ok) {
      console.error(`[bridgeforbillions-scraper] Listing page ${res.status}`);
      return Response.json({ error: `HTTP ${res.status}` }, { status: 500 });
    }
    const html  = await res.text();
    const slugs = extractListingSlugs(html);
    console.log(`[bridgeforbillions-scraper] Found ${slugs.length} job slugs`);

    const ids = slugs.map(s => `bfb-${s.replace('/jobs/', '')}`);
    const { data: existing } = await supabase.from('listings').select('id').in('id', ids);
    const existingSet = new Set((existing || []).map((r: any) => r.id));

    for (const slug of slugs) {
      const id = `bfb-${slug.replace('/jobs/', '')}`;
      if (existingSet.has(id)) { totalSkipped++; continue; }

      await new Promise(r => setTimeout(r, 500));

      try {
        const jobUrl = `${BASE}${slug}`;
        const jobRes = await fetch(jobUrl, { headers: HEADERS });
        if (!jobRes.ok) { totalSkipped++; continue; }
        const jobHtml = await jobRes.text();

        const parsed = parseJobPage(jobHtml);
        if (!parsed) { totalSkipped++; continue; }

        // No confirmed country → can't verify it's Africa-based, skip.
        if (parsed.addressLines.length === 0) {
          console.log(`[bridgeforbillions-scraper] ${parsed.title}: no location given, skipping`);
          totalSkipped++;
          continue;
        }

        const rawCountry = parsed.addressLines[parsed.addressLines.length - 1];
        const iso = resolveAfricanIso(rawCountry);
        if (!iso) {
          console.log(`[bridgeforbillions-scraper] ${parsed.title}: location "${rawCountry}" is not in Africa, skipping`);
          totalSkipped++;
          continue;
        }

        const locality = parsed.addressLines.slice(0, -1).join(', ');
        const location  = locality && locality.toLowerCase() !== rawCountry.toLowerCase()
          ? locality
          : rawCountry;

        const posted = parsed.postedDate && !isNaN(new Date(parsed.postedDate).getTime())
          ? parsed.postedDate
          : new Date().toISOString().split('T')[0];

        const bodyText = stripHtml(parsed.bodyHtml);
        const { description, salary } = await formatWithClaude(parsed.title, bodyText);

        const sector = mapSector(parsed.title);
        const type   = mapType(parsed.title);
        const applyUrl = `${BASE}/jobs/apply/${slug.replace('/jobs/', '')}`;

        const { error } = await supabase.from('listings').upsert({
          id,
          title:        parsed.title,
          organisation: ORG,
          type,
          sector,
          location,
          country:      iso,
          deadline:     null, // Bridge for Billions' careers site doesn't expose an application deadline
          posted,
          salary,
          description,
          apply_url:    applyUrl,
          org_domain:   ORG_DOMAIN,
          source:       'Bridge for Billions',
          views:        0,
          apply_clicks: 0,
          paid_listing: false,
        }, { onConflict: 'id', ignoreDuplicates: false });

        if (error) {
          console.error(`[bridgeforbillions-scraper] Upsert error for ${id}:`, error.message);
          totalSkipped++;
        } else {
          totalImported++;
          console.log(`[bridgeforbillions-scraper] ✓ ${parsed.title} (${iso})`);
          await trySubmitSalary(supabase, {
            company: ORG, position: parsed.title, salaryText: salary,
            experienceText: '', sector, country: iso,
          });
        }
      } catch (err) {
        console.error(`[bridgeforbillions-scraper] Error processing ${slug}:`, err);
        totalSkipped++;
      }
    }

    console.log(`[bridgeforbillions-scraper] Done. Imported: ${totalImported}, Skipped: ${totalSkipped}`);
    return Response.json({ imported: totalImported, skipped: totalSkipped });

  } catch (err) {
    console.error('[bridgeforbillions-scraper] UNCAUGHT:', (err as Error).message);
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
});
