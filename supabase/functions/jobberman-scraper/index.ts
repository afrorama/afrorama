/**
 * Afrorama — jobberman-scraper Edge Function
 *
 * Scrapes NGO/NPO/Charity jobs from Jobberman Nigeria and Ghana.
 * Category URL: /jobs?industry=ngo-npo-charity
 *
 * Deploy: supabase functions deploy jobberman-scraper
 *
 * Schedule daily:
 *   SELECT cron.schedule('jobberman-daily', '0 9 * * *',
 *     $$SELECT net.http_post(
 *       url := 'https://vqchwioyhyiuunpyildz.supabase.co/functions/v1/jobberman-scraper',
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

const SITES = [
  { base: 'https://www.jobberman.com',    country: 'NG', prefix: 'jbn'  },
  { base: 'https://www.jobberman.com.gh', country: 'GH', prefix: 'jbgh' },
];

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; Afrorama/1.0; +https://afrorama.org)',
  'Accept':     'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-GB,en;q=0.9',
};

const MAX_PAGES = 4;
const DISCLAIMER = '\n\n─────────────────────────────────────\nThis summary is automatically generated. For the complete job description, view the original posting.';

const COUNTRY_ISO: Record<string, string> = {
  'nigeria':'NG','ghana':'GH','kenya':'KE','uganda':'UG','tanzania':'TZ',
  'rwanda':'RW','ethiopia':'ET','zambia':'ZM','mozambique':'MZ',
  'south africa':'ZA','senegal':'SN','cameroon':'CM','malawi':'MW',
};

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

function extractListingSlugs(html: string, siteBase: string): string[] {
  const seen = new Set<string>();
  const pattern = /href="(\/listings\/[a-z0-9][a-z0-9-]*)"/gi;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    seen.add(m[1]);
  }
  return [...seen];
}

function fallbackDesc(text: string, org: string): string {
  const lines = text.split('\n')
    .map(l => l.trim().replace(/^[-•*–·]\s*/, ''))
    .filter(l => l.length > 40)
    .slice(0, 3);
  if (!lines.length) return `${org} has posted this role. View the original listing for full details.${DISCLAIMER}`;
  return lines.map(l => `• ${l[0].toUpperCase() + l.slice(1)}`).join('\n') + DISCLAIMER;
}

async function extractAndFormat(
  pageText: string,
  listingUrl: string,
  fallbackCountry: string,
): Promise<{
  title: string; company: string; location: string; country: string;
  deadline: string | null; salary: string; description: string;
  sector: string; type: string;
} | null> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  const excerpt = pageText.length > 3500 ? pageText.slice(0, 2800) + '\n[...]\n' + pageText.slice(-700) : pageText;

  if (!apiKey || excerpt.length < 100) return null;

  const prompt = `You are extracting structured data from a job listing for Afrorama, Africa's social impact job board.

From the text below extract:
- Job title (exact wording)
- Organisation name (employer, not recruiter)
- Location (city and/or country)
- Application deadline (convert to YYYY-MM-DD; write "none" if not found)
- Salary or compensation (exact text, grade, or "none" if absent)

Then write exactly 5 bullet points in British English:
• Bullet 1: what the role is fundamentally about (drawn from the overview/summary)
• Bullets 2–5: each begins with a strong imperative verb (Lead, Manage, Build, Drive, Develop, Coordinate, Deliver, Foster)
Parallel imperative structure. No passive voice. No vague verbs like "help" or "assist".

Job listing URL: ${listingUrl}

Text:
${excerpt}

Return in EXACTLY this format (no extra text before or after):
TITLE: [title]
COMPANY: [company]
LOCATION: [location]
DEADLINE: [YYYY-MM-DD or none]
SALARY: [salary or none]
BULLETS:
• [bullet 1]
• [bullet 2]
• [bullet 3]
• [bullet 4]
• [bullet 5]`;

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
        max_tokens: 500,
        messages:   [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) return null;

    const data = await res.json() as { content: { text: string }[] };
    const raw  = data.content?.[0]?.text?.trim() || '';

    const get = (key: string) => {
      const m = raw.match(new RegExp(`${key}:\\s*(.+?)(?=\\n[A-Z]+:|$)`, 'is'));
      return m?.[1]?.trim() || '';
    };

    const title    = get('TITLE')    || 'Untitled';
    const company  = get('COMPANY')  || 'Unknown Organisation';
    const location = get('LOCATION') || '';
    const deadRaw  = get('DEADLINE') || 'none';
    const salRaw   = get('SALARY')   || 'none';
    const bullMatch = raw.match(/BULLETS:\s*([\s\S]*?)(?=\n[A-Z]+:|$)/i);
    const bullets   = bullMatch?.[1]?.trim() || fallbackDesc(pageText, company);

    // Deadline
    let deadline: string | null = null;
    if (deadRaw !== 'none') {
      const d = new Date(deadRaw);
      if (!isNaN(d.getTime()) && d > new Date()) deadline = d.toISOString().split('T')[0];
    }

    // Country ISO
    const locLower = location.toLowerCase();
    let country = fallbackCountry;
    for (const [name, iso] of Object.entries(COUNTRY_ISO)) {
      if (locLower.includes(name)) { country = iso; break; }
    }

    // Sector
    const titleLow = title.toLowerCase();
    let sector = 'Governance & Public Policy';
    if (/health|medical|clinic|nurse|doctor|epidem/.test(titleLow))           sector = 'Health';
    else if (/finance|grant|accounti|budget|treasury/.test(titleLow))          sector = 'Finance & Economics';
    else if (/tech|software|data|gis|digital|ict/.test(titleLow))              sector = 'Innovation & Technology';
    else if (/education|teach|school|learning|curricul/.test(titleLow))        sector = 'Education';
    else if (/agricultur|food|farm|nutrition|livelihood/.test(titleLow))       sector = 'Agriculture & Food Security';
    else if (/climate|environment|energy|wash|water|sanitation/.test(titleLow)) sector = 'Climate & Environment';
    else if (/gender|women|girl|inclusion|social protect/.test(titleLow))      sector = 'Gender & Social Inclusion';
    else if (/protection|human rights|legal|justice/.test(titleLow))           sector = 'Human Rights';

    // Type
    let type = 'jobs';
    if (/intern|trainee|volunteer/.test(titleLow))                              type = 'internship';
    else if (/consultant|consultancy|advisor|adviser|contractor/.test(titleLow)) type = 'consultancy';
    else if (/fellowship/.test(titleLow))                                        type = 'capacity';

    return {
      title, company, location: location || fallbackCountry,
      country, deadline,
      salary: salRaw.toLowerCase() === 'none' ? 'See listing' : salRaw,
      description: bullets + DISCLAIMER,
      sector, type,
    };
  } catch (err) {
    console.error('[jobberman-scraper] Claude error:', err);
    return null;
  }
}

Deno.serve(async () => {
  console.log('[jobberman-scraper] Starting…');

  let totalImported = 0, totalSkipped = 0;

  for (const site of SITES) {
    console.log(`[jobberman-scraper] Site: ${site.base}`);

    // Collect listing slugs from category pages
    const allSlugs = new Set<string>();
    for (let page = 1; page <= MAX_PAGES; page++) {
      await new Promise(r => setTimeout(r, 600));
      const url = `${site.base}/jobs?industry=ngo-npo-charity&page=${page}`;
      try {
        const res = await fetch(url, { headers: HEADERS });
        if (!res.ok) { console.warn(`[jobberman-scraper] ${url}: ${res.status}`); break; }
        const html = await res.text();
        const slugs = extractListingSlugs(html, site.base);
        if (!slugs.length) break;
        slugs.forEach(s => allSlugs.add(s));
        console.log(`[jobberman-scraper] Page ${page}: ${slugs.length} slugs (total ${allSlugs.size})`);
      } catch (err) {
        console.error(`[jobberman-scraper] Fetch error:`, err);
        break;
      }
    }

    // Check which IDs are already in DB
    const ids = [...allSlugs].map(s => `${site.prefix}-${s.replace('/listings/', '')}`);
    const { data: existing } = await supabase
      .from('listings')
      .select('id')
      .in('id', ids);
    const existingSet = new Set((existing || []).map((r: any) => r.id));

    for (const slug of allSlugs) {
      const slugPart = slug.replace('/listings/', '');
      const id = `${site.prefix}-${slugPart}`;
      if (existingSet.has(id)) { totalSkipped++; continue; }

      await new Promise(r => setTimeout(r, 700));

      try {
        const listingUrl = `${site.base}${slug}`;
        const res = await fetch(listingUrl, { headers: HEADERS });
        if (!res.ok) { totalSkipped++; continue; }
        const html     = await res.text();
        const pageText = stripHtml(html);

        const extracted = await extractAndFormat(pageText, listingUrl, site.country);
        if (!extracted) { totalSkipped++; continue; }

        const posted = new Date().toISOString().split('T')[0];

        const entry = {
          id,
          title:        extracted.title,
          organisation: extracted.company,
          type:         extracted.type,
          sector:       extracted.sector,
          location:     extracted.location,
          country:      extracted.country,
          deadline:     extracted.deadline,
          posted,
          salary:       extracted.salary,
          description:  extracted.description,
          apply_url:    listingUrl,
          source:       'Jobberman',
          views:        0,
          apply_clicks: 0,
          paid_listing: false,
        };

        const { error } = await supabase
          .from('listings')
          .upsert(entry, { onConflict: 'id', ignoreDuplicates: false });

        if (error) {
          console.error(`[jobberman-scraper] Upsert error for ${id}:`, error.message);
          totalSkipped++;
        } else {
          totalImported++;
          console.log(`[jobberman-scraper] ✓ ${extracted.title} @ ${extracted.company}`);
          await trySubmitSalary(supabase, {
            company: extracted.company,
            position: extracted.title,
            salaryText: extracted.salary,
            experienceText: '',
            sector: extracted.sector,
            country: extracted.country,
          });
        }
      } catch (err) {
        console.error(`[jobberman-scraper] Error processing ${slug}:`, err);
        totalSkipped++;
      }
    }
  }

  console.log(`[jobberman-scraper] Done. Imported: ${totalImported}, Skipped: ${totalSkipped}`);
  return Response.json({ imported: totalImported, skipped: totalSkipped });
});
