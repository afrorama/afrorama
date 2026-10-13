/**
 * Afrorama — agora-verkehrswende-scraper Edge Function
 *
 * Scrapes Agora Verkehrswende's Personio job feed. Agora Verkehrswende is a
 * Berlin-based transport-policy think tank with a small international team
 * working on Africa-Germany cooperation on sustainable transport and
 * e-mobility — every posting is based in their single Berlin office, so
 * unlike the physically-Africa-only scrapers (bridgeforbillions, ietp),
 * this one deliberately follows the same "Africa-focused but Europe-based"
 * exception as reliefweb-europe-scraper: a listing qualifies if its title,
 * department, or description mentions Africa, not by physical location.
 *
 * Personio exposes a public XML job feed — no HTML scraping needed.
 *
 * Deploy: supabase functions deploy agora-verkehrswende-scraper
 *
 * Schedule daily:
 *   SELECT cron.schedule('agora-verkehrswende-daily', '0 13 * * *',
 *     $$SELECT net.http_post(
 *       url := 'https://vqchwioyhyiuunpyildz.supabase.co/functions/v1/agora-verkehrswende-scraper',
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

const XML_URL = 'https://agora-transport-transformation-ggmbh.jobs.personio.de/xml';
const ORG        = 'Agora Verkehrswende';
const ORG_DOMAIN  = 'agora-verkehrswende.org';

const DISCLAIMER = '\n\n─────────────────────────────────────\nThis summary is automatically generated for quick reference. For the complete and authoritative job description, please view the original posting.';

const AFRICA_SIGNAL = /africa|afrika|african|afrikanisch/i;

function decodeEntities(s: string): string {
  return s
    .replace(/&#0?39;/g, "'").replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .trim();
}

interface Position {
  id: string; office: string; department: string; name: string;
  bodyHtml: string; employmentType: string; recruitingCategory: string; createdAt: string;
}

function parsePositions(xml: string): Position[] {
  const positions: Position[] = [];
  const blocks = xml.match(/<position>[\s\S]*?<\/position>/g) || [];
  for (const block of blocks) {
    const get = (tag: string) => block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`))?.[1]?.trim() ?? '';

    // Concatenate all jobDescription sections (Your mission / Your profile /
    // Why us? etc.) into one body, keeping each section's own heading.
    const descBlocks = block.match(/<jobDescription>[\s\S]*?<\/jobDescription>/g) || [];
    const bodyHtml = descBlocks.map(d => {
      const heading = d.match(/<name>([\s\S]*?)<\/name>/)?.[1]?.trim() || '';
      const value   = d.match(/<value>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/value>/)?.[1] || '';
      return `<h4>${heading}</h4>${value}`;
    }).join('\n');

    positions.push({
      id:                  get('id'),
      office:              decodeEntities(get('office')),
      department:          decodeEntities(get('department')),
      name:                decodeEntities(get('name')),
      bodyHtml,
      employmentType:      get('employmentType'),
      recruitingCategory:  decodeEntities(get('recruitingCategory')),
      createdAt:           get('createdAt'),
    });
  }
  return positions;
}

function stripHtml(html: string): string {
  return (html || '')
    .replace(/<\/?(li|p|br|h[1-6]|div|ul)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function mapType(title: string, recruitingCategory: string): string {
  const t = `${title} ${recruitingCategory}`.toLowerCase();
  if (/werkstudent|student|intern|praktik|trainee/.test(t)) return 'internship';
  if (/consultant|consultancy|berater/.test(t))              return 'consultancy';
  return 'jobs';
}

const DISCLAIMER_SALARY_FALLBACK = 'See listing';

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
  if (!apiKey || !bodyText || bodyText.length < 80) return { description: fallbackDesc(bodyText, ORG), salary: DISCLAIMER_SALARY_FALLBACK };
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', max_tokens: 400,
        messages: [{ role: 'user', content: `You are writing a job summary for Afrorama, Africa's social impact job board. The description below may include German section headings — read it in whichever language it's written, but write your summary in British English.\n\nTask 1 — Write exactly 5 bullet points:\n- Bullet 1 drawn from the opening overview\n- Bullets 2–5 begin with a strong imperative verb\n- Concise and action-oriented, British English spelling\n\nTask 2 — Extract salary or compensation (be thorough): look for ANY clue — explicit figures, ranges, allowances. Only write none if there is absolutely zero mention of pay, salary, or compensation\n\nJob: ${title} at ${ORG}\n\nDescription:\n${bodyText.slice(0, 8000)}\n\nReturn:\nBULLETS:\n• [bullet 1]\n• [bullet 2]\n• [bullet 3]\n• [bullet 4]\n• [bullet 5]\nSALARY: [salary or none]` }],
      }),
    });
    if (!res.ok) return { description: fallbackDesc(bodyText, ORG), salary: DISCLAIMER_SALARY_FALLBACK };
    const data = await res.json() as { content: { text: string }[] };
    const raw = data.content?.[0]?.text?.trim() || '';
    const bullets = raw.match(/BULLETS:\s*([\s\S]*?)(?=SALARY:|$)/i)?.[1]?.trim() || fallbackDesc(bodyText, ORG);
    const salaryRaw = raw.match(/SALARY:\s*(.+)/i)?.[1]?.trim() || 'none';
    return { description: bullets + DISCLAIMER, salary: salaryRaw.toLowerCase() === 'none' ? DISCLAIMER_SALARY_FALLBACK : salaryRaw };
  } catch { return { description: fallbackDesc(bodyText, ORG), salary: DISCLAIMER_SALARY_FALLBACK }; }
}

Deno.serve(async () => {
  console.log('[agora-verkehrswende-scraper] Starting...');

  let totalImported = 0, totalSkipped = 0;

  try {
    const res = await fetch(XML_URL, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Afrorama/1.0; +https://afrorama.org)' } });
    if (!res.ok) {
      console.error(`[agora-verkehrswende-scraper] Feed ${res.status}`);
      return Response.json({ error: `HTTP ${res.status}` }, { status: 500 });
    }
    const xml = await res.text();
    const positions = parsePositions(xml);
    console.log(`[agora-verkehrswende-scraper] Found ${positions.length} positions`);

    const ids = positions.map(p => `agora-vw-${p.id}`);
    const { data: existing } = await supabase.from('listings').select('id').in('id', ids);
    const existingSet = new Set((existing || []).map((r: any) => r.id));

    for (const pos of positions) {
      const id = `agora-vw-${pos.id}`;
      if (existingSet.has(id)) { totalSkipped++; continue; }

      const bodyText = stripHtml(pos.bodyHtml);

      // Every posting is based in their single Berlin office — the only
      // signal for "is this actually Africa-focused" is the content itself.
      const isAfricaFocused = AFRICA_SIGNAL.test(`${pos.name} ${pos.department} ${bodyText}`);
      if (!isAfricaFocused) {
        console.log(`[agora-verkehrswende-scraper] "${pos.name}" — not Africa-focused, skipping`);
        totalSkipped++;
        continue;
      }

      const posted = pos.createdAt ? pos.createdAt.slice(0, 10) : new Date().toISOString().split('T')[0];
      const { description, salary } = await formatWithClaude(pos.name, bodyText);

      const { error } = await supabase.from('listings').upsert({
        id,
        title:        pos.name,
        organisation: ORG,
        type:         mapType(pos.name, pos.recruitingCategory),
        sector:       'Climate & Environment', // Agora Verkehrswende's entire mandate is climate-neutral transport
        location:     `${pos.office || 'Berlin'}, Germany`,
        country:      'DE', // Europe-based, Africa-focused — same exception as reliefweb-europe-scraper
        deadline:     null, // not exposed on this org's postings
        posted,
        salary,
        description,
        apply_url:    `${XML_URL.replace('/xml', '')}/job/${pos.id}`,
        org_domain:   ORG_DOMAIN,
        source:       'Agora Verkehrswende',
        views:        0,
        apply_clicks: 0,
        paid_listing: false,
      }, { onConflict: 'id', ignoreDuplicates: false });

      if (error) {
        console.error(`[agora-verkehrswende-scraper] Upsert error for ${id}:`, error.message);
        totalSkipped++;
      } else {
        totalImported++;
        console.log(`[agora-verkehrswende-scraper] ✓ ${pos.name}`);
        await trySubmitSalary(supabase, {
          company: ORG, position: pos.name, salaryText: salary,
          experienceText: '', sector: 'Climate & Environment', country: 'DE',
        });
      }
    }

    console.log(`[agora-verkehrswende-scraper] Done. Imported: ${totalImported}, Skipped: ${totalSkipped}`);
    return Response.json({ imported: totalImported, skipped: totalSkipped });

  } catch (err) {
    console.error('[agora-verkehrswende-scraper] UNCAUGHT:', (err as Error).message);
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
});
