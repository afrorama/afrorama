/**
 * Afrorama — jazzhr-scraper Edge Function
 *
 * JazzHR career pages ({subdomain}.applytojob.com). The list page gives
 * title, link and location; each job page carries schema.org JobPosting
 * JSON-LD (description, datePosted, validThrough, employmentType).
 *
 * Only Africa-based roles are imported (and remote roles, for orgs with a
 * remoteCountry set).
 *
 * Deploy: supabase functions deploy jazzhr-scraper
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { africanIsoIn } from '../_shared/africa.ts';
import { stripHtml, summariseJob, mapSector, mapType } from '../_shared/summarise.ts';
import { saveListing } from '../_shared/listings.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// remoteCountry: ISO stored for fully remote roles, or null to skip them
const ORGS: { subdomain: string; name: string; sector?: string; remoteCountry: string | null }[] = [
  { subdomain: 'digitalgreen', name: 'Digital Green', sector: 'Agriculture & Food Security', remoteCountry: null },
];

const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; Afrorama/1.0; +https://www.afrorama.org)' };
const decode = (s: string) => stripHtml(s).replace(/\s+/g, ' ').trim();

function parseList(html: string): { url: string; title: string; location: string }[] {
  const rows: { url: string; title: string; location: string }[] = [];
  const re = /<li class="list-group-item">\s*<h3[^>]*>\s*<a href="([^"]+)">([\s\S]*?)<\/a>[\s\S]*?fa-map-marker['"]?><\/i>([^<]*)<\/li>/g;
  for (const m of html.matchAll(re)) rows.push({ url: m[1], title: decode(m[2]), location: decode(m[3]) });
  return rows;
}

// deno-lint-ignore no-explicit-any
function jobPostingLd(html: string): any | null {
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { const d = JSON.parse(m[1]); if (d['@type'] === 'JobPosting') return d; } catch { /* next */ }
  }
  return null;
}

Deno.serve(async () => {
  const today = new Date().toISOString().slice(0, 10);
  let inserted = 0, updated = 0, errors = 0, skipped = 0;

  for (const org of ORGS) {
    const base = `https://${org.subdomain}.applytojob.com`;
    try {
      const res = await fetch(`${base}/apply`, { headers: UA });
      if (!res.ok) { console.warn(`[jazzhr-scraper] ${org.name}: list HTTP ${res.status}`); continue; }
      const rows = parseList(await res.text());
      console.log(`[jazzhr-scraper] ${org.name}: ${rows.length} open roles`);

      for (const row of rows) {
        const africanIso = africanIsoIn(`${row.location} ${row.title}`);
        const isRemote = /remote/i.test(row.location);
        let iso: string, location: string;
        if (africanIso) { iso = africanIso; location = row.location || iso; }
        else if (isRemote && org.remoteCountry) { iso = org.remoteCountry; location = 'Remote'; }
        else { skipped++; continue; }

        const code = row.url.match(/\/apply\/([A-Za-z0-9]+)\//)?.[1];
        if (!code) continue;

        await new Promise(r => setTimeout(r, 250));
        const jr = await fetch(row.url, { headers: UA });
        if (!jr.ok) { console.warn(`[jazzhr-scraper] ${org.name} ${code}: HTTP ${jr.status}`); continue; }
        const ld = jobPostingLd(await jr.text());

        const deadline = ld?.validThrough ? String(ld.validThrough).slice(0, 10) : null;
        if (deadline && deadline < today) { skipped++; continue; }

        const bodyText = stripHtml(ld?.description || '');
        const { description, salary } = await summariseJob(row.title, org.name, bodyText);
        const result = await saveListing(supabase, {
          id: `jazz-${org.subdomain}-${code}`,
          title: row.title,
          organisation: org.name,
          type: mapType(row.title, ld?.employmentType || ''),
          sector: org.sector || mapSector(`${row.title} ${bodyText.slice(0, 500)}`),
          location, country: iso, deadline,
          posted: ld?.datePosted ? String(ld.datePosted).slice(0, 10) : today,
          salary, description,
          apply_url: row.url,
          org_domain: `${org.subdomain}.applytojob.com`,
          source: 'JazzHR',
        }, { submitSalary: !!africanIso });
        if (result === 'inserted') inserted++; else if (result === 'updated') updated++; else errors++;
      }
    } catch (err) {
      console.warn(`[jazzhr-scraper] ${org.name} failed:`, (err as Error).message);
    }
  }

  console.log(`[jazzhr-scraper] Done. Inserted ${inserted}, updated ${updated}, skipped ${skipped}, errors ${errors}`);
  return Response.json({ inserted, updated, skipped, errors });
});
