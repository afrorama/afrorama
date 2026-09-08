/**
 * Afrorama — ietp-scraper Edge Function
 *
 * Scrapes the "Recrutement" job table from IETP (ietp.com) — the site for
 * Investisseurs & Partenaires (I&P), a French impact-investment group
 * dedicated to African SMEs, which also posts roles for its sister
 * entities (IPAE, IPDEV, FASA, I&P Accélération). Postings are mostly in
 * French. Only rows whose stated country resolves to an African one are
 * imported — I&P also posts occasional Paris-based roles, which are
 * skipped rather than guessed at.
 *
 * The recruitment page (https://ietp.com/fr/content/recrutement) is a
 * single, unpaginated Drupal Views table — no pagination handling needed
 * as of writing.
 *
 * Deploy: supabase functions deploy ietp-scraper
 *
 * Schedule daily:
 *   SELECT cron.schedule('ietp-daily', '0 12 * * *',
 *     $$SELECT net.http_post(
 *       url := 'https://vqchwioyhyiuunpyildz.supabase.co/functions/v1/ietp-scraper',
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

const BASE = 'https://ietp.com';
const LISTING_URL = `${BASE}/fr/content/recrutement`;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; Afrorama/1.0; +https://afrorama.org)',
  'Accept':     'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
};

const DISCLAIMER = '\n\n─────────────────────────────────────\nThis summary is automatically generated for quick reference. For the complete and authoritative job description, please view the original posting.';

// Both English and French country names (and common abbreviations, e.g.
// "RDC" for DR Congo) since IETP's listings are mostly in French. Matched
// against accent-stripped, lowercased text.
const AFRICA_ISO: Record<string, string> = {
  'algeria':'DZ', 'algerie':'DZ', 'angola':'AO', 'benin':'BJ', 'botswana':'BW', 'burkina faso':'BF',
  'burundi':'BI', 'cabo verde':'CV', 'cap-vert':'CV', 'cape verde':'CV', 'cameroon':'CM', 'cameroun':'CM',
  'central african republic':'CF', 'republique centrafricaine':'CF', 'centrafrique':'CF',
  'chad':'TD', 'tchad':'TD', 'comoros':'KM', 'comores':'KM',
  'congo-brazzaville':'CG', 'republique du congo':'CG',
  'dr congo':'CD', 'drc':'CD', 'rdc':'CD', 'democratic republic of congo':'CD',
  'democratic republic of the congo':'CD', 'republique democratique du congo':'CD', 'congo-kinshasa':'CD',
  "cote d'ivoire":'CI', 'ivory coast':'CI',
  'djibouti':'DJ', 'egypt':'EG', 'egypte':'EG', 'equatorial guinea':'GQ', 'guinee equatoriale':'GQ',
  'eritrea':'ER', 'erythree':'ER', 'eswatini':'SZ', 'swaziland':'SZ', 'ethiopia':'ET', 'ethiopie':'ET',
  'gabon':'GA', 'gambia':'GM', 'gambie':'GM', 'ghana':'GH', 'guinea':'GN', 'guinee':'GN',
  'guinea-bissau':'GW', 'guinee-bissau':'GW', 'kenya':'KE', 'lesotho':'LS', 'liberia':'LR',
  'libya':'LY', 'libye':'LY', 'madagascar':'MG', 'malawi':'MW', 'mali':'ML',
  'mauritania':'MR', 'mauritanie':'MR', 'mauritius':'MU', 'maurice':'MU', 'morocco':'MA', 'maroc':'MA',
  'mozambique':'MZ', 'namibia':'NA', 'namibie':'NA', 'niger':'NE', 'nigeria':'NG', 'rwanda':'RW',
  'sao tome':'ST', 'sao tome-et-principe':'ST', 'senegal':'SN', 'seychelles':'SC',
  'sierra leone':'SL', 'somalia':'SO', 'somalie':'SO', 'south africa':'ZA', 'afrique du sud':'ZA',
  'south sudan':'SS', 'soudan du sud':'SS', 'sudan':'SD', 'soudan':'SD',
  'tanzania':'TZ', 'tanzanie':'TZ', 'togo':'TG', 'tunisia':'TN', 'tunisie':'TN',
  'uganda':'UG', 'ouganda':'UG', 'zambia':'ZM', 'zambie':'ZM', 'zimbabwe':'ZW',
  'congo':'CG', // bare "Congo" defaults to Republic of Congo; RDC/DRC aliases above catch the other one
};

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Picks the left-most African country name mentioned in the text (e.g.
// "Ghana, Kenya, Côte d'Ivoire or Sénégal" → Ghana), not just whichever
// happens to be checked first.
function resolveAfricanIso(rawCountry: string): string | null {
  const key = normalize(rawCountry.trim());
  let bestIdx = Infinity, bestLen = -1, bestIso: string | null = null;
  for (const [name, iso] of Object.entries(AFRICA_ISO)) {
    const idx = key.indexOf(name);
    if (idx === -1) continue;
    if (idx < bestIdx || (idx === bestIdx && name.length > bestLen)) { bestIdx = idx; bestLen = name.length; bestIso = iso; }
  }
  return bestIso;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#0?39;/g, "'").replace(/&rsquo;/g, '’').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .trim();
}

function slugify(rawHref: string): string {
  const decoded = decodeURIComponent(rawHref.replace('/fr/content/', ''));
  return normalize(decoded).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

interface ListingRow {
  href: string; title: string; countryRaw: string; emetteur: string; dateRaw: string; contrat: string;
}

function parseListingRows(html: string): ListingRow[] {
  const rowRegex = /<td\s+class="title text-left">\s*<h6><a href="([^"]+)">([^<]*)<\/a><\/h6>\s*<\/td>\s*<td\s+class="views-field views-field-field-country-text">\s*([\s\S]*?)<\/td>\s*<td\s+class="views-field views-field-field-emetteur">\s*([\s\S]*?)<\/td>\s*<td\s+class="views-field views-field-created">\s*([\s\S]*?)<\/td>\s*<td\s+class="views-field views-field-field-contrat-text">\s*([\s\S]*?)<\/td>/g;
  const rows: ListingRow[] = [];
  let m: RegExpExecArray | null;
  while ((m = rowRegex.exec(html)) !== null) {
    rows.push({
      href:       m[1],
      title:      decodeEntities(m[2]),
      countryRaw: decodeEntities(m[3]),
      emetteur:   decodeEntities(m[4]),
      dateRaw:    decodeEntities(m[5]),
      contrat:    decodeEntities(m[6]),
    });
  }
  return rows;
}

function parsePostedDate(dateRaw: string): string {
  // DD/MM/YYYY
  const m = dateRaw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return new Date().toISOString().split('T')[0];
  return `${m[3]}-${m[2]}-${m[1]}`;
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

// Job detail pages render a schema-free but consistently-classed
// "node-job-offer" content block; slicing to it (and cutting off before the
// footer) keeps nav/menu chrome out of what gets sent to Claude.
function extractJobBody(html: string): string {
  const start = html.indexOf('node-job-offer');
  if (start === -1) return '';
  const end = html.indexOf('id="footer"', start);
  return html.slice(start, end === -1 ? undefined : end);
}

function mapType(title: string, contrat: string): string {
  const t = normalize(`${title} ${contrat}`);
  if (/\bstage\b|intern|trainee|volontaire|volunteer/.test(t)) return 'internship';
  if (/consultant|consultanc|freelance/.test(t))               return 'consultancy';
  return 'jobs';
}

function mapSector(title: string): string {
  const t = normalize(title);
  if (/ressources humaines|\brh\b|human resources/.test(t))          return 'Governance & Public Policy';
  if (/communication|marketing/.test(t))                              return 'Governance & Public Policy';
  if (/agri|agricole|agriculture/.test(t))                            return 'Agriculture & Food Security';
  if (/climat|environnement|energie|climate|environment/.test(t))     return 'Climate & Environment';
  if (/genre|femme|gender|women/.test(t))                             return 'Gender & Social Inclusion';
  if (/juridique|legal|droits/.test(t))                               return 'Human Rights';
  if (/tech|digital|data|informatique/.test(t))                       return 'Innovation & Technology';
  // I&P's core business is African SME investment — default there.
  return 'Finance & Economics';
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

async function formatWithClaude(title: string, org: string, bodyText: string): Promise<{ description: string; salary: string }> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey || !bodyText || bodyText.length < 80) return { description: fallbackDesc(bodyText, org), salary: 'See listing' };
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', max_tokens: 400,
        // Postings are often in French — read them in French if needed, but
        // always write the summary in British English.
        messages: [{ role: 'user', content: `You are writing a job summary for Afrorama, Africa's social impact job board. The description below may be in French — read it in whichever language it's written, but write your summary in British English.\n\nTask 1 — Write exactly 5 bullet points:\n- Bullet 1 drawn from the opening overview\n- Bullets 2–5 begin with a strong imperative verb\n- Concise and action-oriented, British English spelling\n\nTask 2 — Extract salary or compensation (be thorough): look for ANY clue — explicit figures, ranges, allowances, or qualitative terms (e.g. "commensurate with experience"). Only write none if there is absolutely zero mention of pay, salary, or compensation\n\nJob: ${title} at ${org}\n\nDescription:\n${bodyText.slice(0, 12000)}\n\nReturn:\nBULLETS:\n• [bullet 1]\n• [bullet 2]\n• [bullet 3]\n• [bullet 4]\n• [bullet 5]\nSALARY: [salary or none]` }],
      }),
    });
    if (!res.ok) return { description: fallbackDesc(bodyText, org), salary: 'See listing' };
    const data = await res.json() as { content: { text: string }[] };
    const raw = data.content?.[0]?.text?.trim() || '';
    const bullets = raw.match(/BULLETS:\s*([\s\S]*?)(?=SALARY:|$)/i)?.[1]?.trim() || fallbackDesc(bodyText, org);
    const salaryRaw = raw.match(/SALARY:\s*(.+)/i)?.[1]?.trim() || 'none';
    return { description: bullets + DISCLAIMER, salary: salaryRaw.toLowerCase() === 'none' ? 'See listing' : salaryRaw };
  } catch { return { description: fallbackDesc(bodyText, org), salary: 'See listing' }; }
}

Deno.serve(async () => {
  console.log('[ietp-scraper] Starting...');

  let totalImported = 0, totalSkipped = 0;

  try {
    const res = await fetch(LISTING_URL, { headers: HEADERS });
    if (!res.ok) {
      console.error(`[ietp-scraper] Listing page ${res.status}`);
      return Response.json({ error: `HTTP ${res.status}` }, { status: 500 });
    }
    const html = await res.text();
    const rows = parseListingRows(html);
    console.log(`[ietp-scraper] Found ${rows.length} rows`);

    const ids = rows.map(r => `ietp-${slugify(r.href)}`);
    const { data: existing } = await supabase.from('listings').select('id').in('id', ids);
    const existingSet = new Set((existing || []).map((r: any) => r.id));

    for (const row of rows) {
      const id = `ietp-${slugify(row.href)}`;
      if (existingSet.has(id)) { totalSkipped++; continue; }

      const iso = resolveAfricanIso(row.countryRaw);
      if (!iso) {
        console.log(`[ietp-scraper] ${row.title}: location "${row.countryRaw}" is not in Africa, skipping`);
        totalSkipped++;
        continue;
      }

      await new Promise(r => setTimeout(r, 500));

      try {
        const jobUrl = `${BASE}${row.href}`;
        const jobRes = await fetch(jobUrl, { headers: HEADERS });
        if (!jobRes.ok) { totalSkipped++; continue; }
        const jobHtml  = await jobRes.text();
        const bodyText = stripHtml(extractJobBody(jobHtml));

        const org    = row.emetteur || 'Investisseurs & Partenaires (I&P)';
        const posted = parsePostedDate(row.dateRaw);
        const { description, salary } = await formatWithClaude(row.title, org, bodyText);

        const { error } = await supabase.from('listings').upsert({
          id,
          title:        row.title,
          organisation: org,
          type:         mapType(row.title, row.contrat),
          sector:       mapSector(row.title),
          location:     row.countryRaw,
          country:      iso,
          deadline:     null, // IETP's job table doesn't expose an application deadline
          posted,
          salary,
          description,
          apply_url:    jobUrl, // no external ATS — applications go by email, detailed on the listing itself
          org_domain:   'ietp.com',
          source:       'IETP',
          views:        0,
          apply_clicks: 0,
          paid_listing: false,
        }, { onConflict: 'id', ignoreDuplicates: false });

        if (error) {
          console.error(`[ietp-scraper] Upsert error for ${id}:`, error.message);
          totalSkipped++;
        } else {
          totalImported++;
          console.log(`[ietp-scraper] ✓ ${row.title} (${iso})`);
          await trySubmitSalary(supabase, {
            company: org, position: row.title, salaryText: salary,
            experienceText: '', sector: mapSector(row.title), country: iso,
          });
        }
      } catch (err) {
        console.error(`[ietp-scraper] Error processing ${row.href}:`, err);
        totalSkipped++;
      }
    }

    console.log(`[ietp-scraper] Done. Imported: ${totalImported}, Skipped: ${totalSkipped}`);
    return Response.json({ imported: totalImported, skipped: totalSkipped });

  } catch (err) {
    console.error('[ietp-scraper] UNCAUGHT:', (err as Error).message);
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
});
