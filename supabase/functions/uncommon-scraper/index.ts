/**
 * Afrorama — uncommon-scraper Edge Function
 *
 * Uncommon.org is a tech-education nonprofit focused on Zimbabwe
 * running on a custom Next.js site with no API. Jobs are server-side
 * rendered in plain HTML — the listing page gives /careers/{slug} links;
 * each detail page has the full description, closing date, and a Google
 * Forms apply link, all readable via plain fetch with no auth.
 *
 * Deploy: supabase functions deploy uncommon-scraper
 * Schedule daily via pg_cron.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { trySubmitSalary } from '../_shared/currency.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const DISCLAIMER = '\n\n─────────────────────────────────────\nThis summary is automatically generated for quick reference. For the complete and authoritative job description, please view the original posting.';
const BASE_URL = 'https://uncommon.org';

function decodeHtml(s: string): string {
  return (s || '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&#x27;/g, "'");
}

function stripTags(html: string): string {
  return html
    .replace(/<!--.*?-->/gs, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function parseClosingDate(html: string): string | null {
  // Pattern: "Closing Date<!-- -->:</span> <!-- -->6 July, 2026"
  const m = html.match(/Closing Date[^0-9]*([0-9]+ \w+,? \d{4})/);
  if (!m) return null;
  try {
    const d = new Date(m[1]);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split('T')[0];
  } catch { return null; }
}

function fallbackDesc(bodyText: string, org: string): string {
  const lines = (bodyText || '').split(/\n|\. /)
    .map(l => l.trim()).filter(l => l.length > 30).slice(0, 3);
  if (!lines.length) return `${org} has posted this opportunity. Please view the original posting for full details.${DISCLAIMER}`;
  return lines.map(l => `• ${l.charAt(0).toUpperCase() + l.slice(1)}`).join('\n') + DISCLAIMER;
}

async function formatWithClaude(title: string, org: string, description: string): Promise<{ description: string; salary: string }> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey || description.length < 60) return { description: fallbackDesc(description, org), salary: 'See listing' };
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', max_tokens: 400,
        messages: [{ role: 'user', content: `You are writing a job summary for Afrorama, Africa's social impact job board. Format in British English.\n\nTask 1 — Write exactly 5 bullet points:\n- Bullet 1 drawn from the opening/overview\n- Bullets 2-5 begin with a strong imperative verb\n- Concise, action-oriented, British English spelling\n\nTask 2 — Extract salary or compensation. Only write none if genuinely zero mention.\n\nJob: ${title} at ${org}\n\nDescription:\n${description.slice(0, 2000)}\n\nReturn:\nBULLETS:\n• [bullet 1]\n• [bullet 2]\n• [bullet 3]\n• [bullet 4]\n• [bullet 5]\nSALARY: [salary or none]` }],
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

Deno.serve(async () => {
  console.log('[uncommon-scraper] Starting...');
  const org = 'Uncommon.org';

  try {
    const listRes = await fetch(`${BASE_URL}/careers`, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AfroramaBot/1.0)' } });
    if (!listRes.ok) return Response.json({ error: `Listing page returned ${listRes.status}` }, { status: 500 });
    const listHtml = await listRes.text();

    const slugs = [...new Set([...listHtml.matchAll(/href="(\/careers\/[a-z0-9-]+)"/g)].map(m => m[1]))];
    console.log(`[uncommon-scraper] Found ${slugs.length} job slugs:`, slugs);

    let totalImported = 0, totalSkipped = 0;

    for (const slug of slugs) {
      const id = slug.replace('/careers/', '');
      const url = `${BASE_URL}${slug}`;

      const dr = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AfroramaBot/1.0)' } });
      if (!dr.ok) { console.warn(`[uncommon-scraper] ${id}: HTTP ${dr.status}`); totalSkipped++; continue; }
      const html = await dr.text();

      const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
      const title = decodeHtml(titleMatch?.[1]?.trim() || id);

      const deadline = parseClosingDate(html);
      if (deadline && new Date(deadline) < new Date()) {
        console.log(`[uncommon-scraper] ${id}: skipping expired posting (closed ${deadline})`);
        continue;
      }

      // Extract description from first <section class="mb-8..."> block
      const sectionMatch = html.match(/<section[^>]*class="[^"]*mb-8[^"]*"[^>]*>([\s\S]*?)<\/section>/);
      const rawDesc = sectionMatch ? decodeHtml(stripTags(sectionMatch[1])) : '';

      // Apply URL — Google Forms link inside the page
      const applyMatch = html.match(/href="(https:\/\/forms\.gle\/[^"]+)"/);
      const applyUrl = applyMatch?.[1] || url;

      const { description, salary } = await formatWithClaude(title, org, rawDesc);

      const result = await supabase.from('listings').upsert({
        id: `uncommon-${id}`, title, organisation: org, type: 'jobs',
        sector: 'Innovation & Technology', location: 'Zimbabwe', country: 'ZW',
        deadline, posted: new Date().toISOString().split('T')[0],
        salary, description, apply_url: applyUrl,
        org_domain: 'uncommon.org', source: 'Uncommon.org',
        views: 0, apply_clicks: 0, paid_listing: false,
      }, { onConflict: 'id', ignoreDuplicates: false });

      if (result?.error) { console.error(`[uncommon-scraper] Upsert error: ${result.error.message}`); totalSkipped++; }
      else totalImported++;

      await trySubmitSalary(supabase, {
        company: org, position: title, salaryText: salary,
        sector: 'Innovation & Technology', country: 'ZW',
      });

      await new Promise(r => setTimeout(r, 300));
    }

    console.log(`[uncommon-scraper] Done. Imported: ${totalImported}, Skipped: ${totalSkipped}`);
    return Response.json({ imported: totalImported, skipped: totalSkipped });

  } catch (err) {
    console.error('[uncommon-scraper] UNCAUGHT:', (err as Error).message);
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
});
