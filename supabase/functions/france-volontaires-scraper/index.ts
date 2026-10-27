/**
 * Afrorama — france-volontaires-scraper Edge Function
 *
 * France Volontaires (WordPress; its REST API is blocked) lists every
 * mission page in /sitemap.xml. Each page embeds a schema.org JobPosting
 * JSON-LD block (title, host organisation, "Afrique - Pays - Ville"
 * location, validThrough deadline, full description) and shows a
 * "Type de volontariat" field.
 *
 * Imported: missions in Africa of a stipend-paid kind (VSI, Service civique
 * international), typed as jobs and kept in French. Skipped: "Congés de
 * solidarité" (2-week trips on the volunteer's own paid leave).
 *
 * Deploy: supabase functions deploy france-volontaires-scraper
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { africanIsoIn } from '../_shared/africa.ts';
import { stripHtml, summariseJob, mapSector } from '../_shared/summarise.ts';
import { saveListing } from '../_shared/listings.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const SITE = 'https://france-volontaires.org';
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; Afrorama/1.0; +https://www.afrorama.org)' };

// "Type de volontariat" → stipend shown when the text gives no figure
const PAID_KINDS: [RegExp, string][] = [
  [/Volontariat de Solidarité Internationale|\bVSI\b/i, 'Volunteer stipend (VSI)'],
  [/Service civique/i, 'Volunteer stipend (Service civique)'],
];

// French theme words, checked before the shared English sector map
const FR_SECTORS: [string, string][] = [
  ['agro', 'Agriculture & Food Security'], ['agricol', 'Agriculture & Food Security'], ['pisciculture', 'Agriculture & Food Security'],
  ['environnement', 'Climate & Environment'], ['biodiversit', 'Climate & Environment'], ['faune', 'Climate & Environment'], ['biomasse', 'Climate & Environment'], ['déchets', 'Climate & Environment'],
  ['santé', 'Health'],
  ['éducati', 'Education'], ['formation', 'Education'], ['pédagog', 'Education'], ['francophon', 'Education'], ['médiathèque', 'Education'],
  ['genre', 'Gender & Social Inclusion'], ['femmes', 'Gender & Social Inclusion'],
  ['jeunes', 'Youth & Employment'], ['jeunesse', 'Youth & Employment'],
];

function sectorOf(text: string): string {
  const lower = text.toLowerCase();
  for (const [key, val] of FR_SECTORS) if (lower.includes(key)) return val;
  return mapSector(text);
}

// deno-lint-ignore no-explicit-any
function jobPosting(html: string): any | null {
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      const j = JSON.parse(m[1]);
      if (j?.['@type'] === 'JobPosting') return j;
    } catch { /* other JSON-LD blocks */ }
  }
  return null;
}

Deno.serve(async () => {
  const today = new Date().toISOString().slice(0, 10);
  let inserted = 0, updated = 0, errors = 0, skipped = 0;

  const xml = await (await fetch(`${SITE}/sitemap.xml`, { headers: UA })).text();
  const urls = [...xml.matchAll(/<loc>([^<]*\/mission\/[^<]*)<\/loc>/g)].map(m => m[1]);
  console.log(`[france-volontaires-scraper] ${urls.length} missions in sitemap`);

  // Reuse saved summaries so a daily run only calls Claude for new missions
  const { data: saved } = await supabase.from('listings')
    .select('id, description, salary').eq('source', 'France Volontaires');
  const known = new Map((saved || []).map((r: { id: string; description: string; salary: string }) => [r.id, r]));

  for (const url of urls) {
    try {
      await new Promise(r => setTimeout(r, 250));
      const res = await fetch(url, { headers: UA });
      if (!res.ok) { console.warn(`[france-volontaires-scraper] ${url}: HTTP ${res.status}`); errors++; continue; }
      const html = await res.text();
      const jp = jobPosting(html);
      if (!jp) { skipped++; continue; }

      const kind = html.match(/Type de volontariat\s*<\/[^>]+>\s*(?:<[^>]+>\s*)*([^<]+)/)?.[1]?.trim() || '';
      const stipend = PAID_KINDS.find(([re]) => re.test(kind))?.[1];
      if (!stipend) { skipped++; continue; }

      const deadline = jp.validThrough ? String(jp.validThrough).slice(0, 10) : null;
      if (deadline && deadline < today) { skipped++; continue; }

      const address = stripHtml(String(jp.jobLocation?.address || ''));
      const bodyText = stripHtml(jp.description || '');
      // Location is "Afrique - Sénégal - Dakar", sometimes just "Maurice"
      // or misspelt ("Camerou"); then fall back to the mission text
      const iso = africanIsoIn(address) || (/^afrique/i.test(address) ? africanIsoIn(bodyText) : null);
      if (!iso) { skipped++; continue; }

      const postId = String(jp.identifier?.value || '').match(/[?&;]p=(\d+)/)?.[1]; // "&" arrives as "&#038;"
      if (!postId) { skipped++; continue; }
      const id = `fv-${postId}`;

      const title = stripHtml(jp.title || '');
      const org = stripHtml(jp.hiringOrganization?.name || 'France Volontaires');
      const place = address.split(/\s+[-–]\s+/).filter(p => !/^afrique$/i.test(p)).reverse().join(', ');

      const prev = known.get(id);
      const { description, salary } = prev
        ? { description: prev.description, salary: prev.salary }
        : await summariseJob(title, org, bodyText);

      let orgDomain = 'france-volontaires.org';
      try { if (jp.hiringOrganization?.url) orgDomain = new URL(jp.hiringOrganization.url).hostname.replace(/^www\./, ''); } catch { /* keep default */ }

      const result = await saveListing(supabase, {
        id, title, organisation: org,
        type: 'jobs',
        sector: sectorOf(`${title} ${bodyText.slice(0, 800)}`),
        location: place || address, country: iso, deadline,
        posted: String(jp.datePosted || today).slice(0, 10),
        salary: salary === 'See listing' ? stipend : salary,
        description, apply_url: url, org_domain: orgDomain,
        source: 'France Volontaires',
      }, { submitSalary: false }); // stipends, not salary data
      if (result === 'inserted') inserted++; else if (result === 'updated') updated++; else errors++;
    } catch (err) {
      console.warn(`[france-volontaires-scraper] ${url} failed:`, (err as Error).message);
      errors++;
    }
  }

  console.log(`[france-volontaires-scraper] Done. Inserted ${inserted}, updated ${updated}, skipped ${skipped}, errors ${errors}`);
  return Response.json({ inserted, updated, skipped, errors });
});
