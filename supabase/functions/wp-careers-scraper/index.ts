/**
 * Afrorama — wp-careers-scraper Edge Function
 *
 * Organisations that publish jobs as ordinary WordPress pages under a
 * "careers" page. The WordPress REST API lists the child pages; their
 * text is rendered by the theme, so each page's <main> HTML is read.
 *
 * Imported: roles whose title is about Africa or names an African place
 * (most of these orgs hire at HQ), stored under the org's office location.
 *
 * Deploy: supabase functions deploy wp-careers-scraper
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { africanIsoIn } from '../_shared/africa.ts';
import { stripHtml, summariseJob, mapSector, mapType } from '../_shared/summarise.ts';
import { saveListing } from '../_shared/listings.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// careersSlug: slug of the parent "careers" page whose child pages are jobs
// stopAt:      text where the job ends and site boilerplate begins
const ORGS: { site: string; careersSlug: string; name: string; location: string; country: string; sector?: string; stopAt: string[] }[] = [
  {
    site: 'https://cic.nyu.edu', careersSlug: 'careers', name: 'NYU Center on International Cooperation',
    location: 'New York, United States', country: 'US', sector: 'Governance & Public Policy',
    stopAt: ['For people in the EU', 'NYU is an Equal Opportunity Employer', 'Stay Connected'],
  },
];

const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; Afrorama/1.0; +https://www.afrorama.org)' };
const decode = (s: string) => stripHtml(s).replace(/\s+/g, ' ').trim();

Deno.serve(async () => {
  const today = new Date().toISOString().slice(0, 10);
  let inserted = 0, updated = 0, errors = 0, skipped = 0;

  for (const org of ORGS) {
    try {
      const parent = await (await fetch(`${org.site}/wp-json/wp/v2/pages?slug=${org.careersSlug}&_fields=id`, { headers: UA })).json();
      const parentId = parent?.[0]?.id;
      if (!parentId) { console.warn(`[wp-careers-scraper] ${org.name}: careers page not found`); continue; }
      // deno-lint-ignore no-explicit-any
      const pages: any[] = await (await fetch(
        `${org.site}/wp-json/wp/v2/pages?parent=${parentId}&per_page=100&_fields=id,link,title,date`, { headers: UA })).json();
      console.log(`[wp-careers-scraper] ${org.name}: ${pages.length} pages`);

      for (const p of pages) {
        const title = decode(p.title?.rendered || '');
        const africanIso = africanIsoIn(title);
        if (!africanIso && !/\bafrica|african\b/i.test(title)) { skipped++; continue; }

        await new Promise(r => setTimeout(r, 250));
        const res = await fetch(p.link, { headers: UA });
        if (!res.ok) { console.warn(`[wp-careers-scraper] ${org.name} ${p.link}: HTTP ${res.status}`); continue; }
        const html = await res.text();
        const main = html.slice(Math.max(0, html.indexOf('<main')), html.indexOf('</main>') > 0 ? html.indexOf('</main>') : undefined)
          .replace(/<(script|style|svg)[\s\S]*?<\/\1>/gi, '');
        const applyUrl = main.match(/<a[^>]+href="([^"]+)"[^>]*>\s*(?:<span[^>]*>)?\s*Apply/i)?.[1] || p.link;

        let bodyText = stripHtml(main);
        const descStart = bodyText.indexOf('Description');
        if (descStart > -1) bodyText = bodyText.slice(descStart);
        for (const marker of org.stopAt) {
          const i = bodyText.indexOf(marker);
          if (i > 0) bodyText = bodyText.slice(0, i);
        }

        const deadlineMatch = bodyText.match(/(?:deadline|apply by|closing date)[^\n:]*:\s*([A-Za-z]+ \d{1,2},? \d{4}|\d{1,2} [A-Za-z]+ \d{4})/i);
        const parsed = deadlineMatch ? new Date(deadlineMatch[1].replace(',', '')) : null;
        const deadline = parsed && !isNaN(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : null;
        if (deadline && deadline < today) { skipped++; continue; }

        const { description, salary } = await summariseJob(title, org.name, bodyText);
        const result = await saveListing(supabase, {
          id: `wp-${new URL(org.site).hostname.split('.')[0]}-${p.id}`,
          title,
          organisation: org.name,
          type: mapType(title),
          sector: org.sector || mapSector(`${title} ${bodyText.slice(0, 800)}`),
          location: org.location, country: org.country, deadline,
          posted: String(p.date || today).slice(0, 10),
          salary, description,
          apply_url: applyUrl,
          org_domain: new URL(org.site).hostname,
          source: 'Website',
        }, { submitSalary: false }); // HQ pay, not African pay data
        if (result === 'inserted') inserted++; else if (result === 'updated') updated++; else errors++;
      }
    } catch (err) {
      console.warn(`[wp-careers-scraper] ${org.name} failed:`, (err as Error).message);
    }
  }

  console.log(`[wp-careers-scraper] Done. Inserted ${inserted}, updated ${updated}, skipped ${skipped}, errors ${errors}`);
  return Response.json({ inserted, updated, skipped, errors });
});
