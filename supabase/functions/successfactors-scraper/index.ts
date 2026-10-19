/**
 * Afrorama — successfactors-scraper Edge Function
 *
 * SAP SuccessFactors career sites (Career Site Builder). Their /sitemap.xml
 * is a Google-Base RSS feed of every open job with the full description,
 * so one request covers the whole board (the /services/rss feed only has
 * the newest 20).
 *
 * Location: the description's "Office Country / Office City" fields when
 * present (EBRD), else <g:location>. Deadline: "Posting End Date dd/mm/yyyy".
 * Imported: roles located in Africa, plus roles whose title is about Africa
 * (kept under their real location).
 *
 * Deploy: supabase functions deploy successfactors-scraper
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { africanIsoIn } from '../_shared/africa.ts';
import { stripHtml, summariseJob, mapSector, mapType } from '../_shared/summarise.ts';
import { saveListing } from '../_shared/listings.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const ORGS: { domain: string; name: string; hqCountry: string; sector?: string }[] = [
  { domain: 'jobs.ebrd.com', name: 'EBRD', hqCountry: 'GB', sector: 'Finance & Economics' },
];

// Non-African offices, for Africa-focused roles based abroad
const COUNTRY_ISO: Record<string, string> = {
  'united kingdom': 'GB', 'bulgaria': 'BG', 'poland': 'PL', 'croatia': 'HR', 'türkiye': 'TR', 'turkey': 'TR',
  'germany': 'DE', 'france': 'FR', 'united states': 'US', 'switzerland': 'CH', 'belgium': 'BE',
  'netherlands': 'NL', 'italy': 'IT', 'jordan': 'JO', 'lebanon': 'LB',
};

const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; Afrorama/1.0; +https://www.afrorama.org)' };

const tag = (item: string, name: string) =>
  item.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1]?.replace(/^<!\[CDATA\[|\]\]>$/g, '').trim() || '';

const decodeEntities = (s: string) => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&');

function field(text: string, label: string, next: string): string {
  return text.match(new RegExp(`${label}\\s+([\\s\\S]*?)\\s+(?:${next})`))?.[1]?.replace(/\s+/g, ' ').trim() || '';
}

Deno.serve(async () => {
  const today = new Date().toISOString().slice(0, 10);
  let inserted = 0, updated = 0, errors = 0, skipped = 0;

  for (const org of ORGS) {
    try {
      const res = await fetch(`https://${org.domain}/sitemap.xml`, { headers: UA });
      if (!res.ok) { console.warn(`[successfactors-scraper] ${org.name}: HTTP ${res.status}`); continue; }
      const items = (await res.text()).match(/<item>[\s\S]*?<\/item>/g) || [];
      console.log(`[successfactors-scraper] ${org.name}: ${items.length} open roles`);

      for (const item of items) {
        const id = tag(item, 'g:id') || tag(item, 'guid');
        const link = decodeEntities(tag(item, 'link'));
        // Titles end with "(City)" or "(City, CC)" — drop it, location is stored separately
        const title = decodeEntities(tag(item, 'title')).replace(/\s*\([^)]*\)\s*$/, '').trim();
        const bodyText = stripHtml(decodeEntities(tag(item, 'description')));
        const flat = bodyText.replace(/\s+/g, ' ');

        const country = field(flat, 'Office Country', 'Office City');
        const city = field(flat, 'Office City', 'Division|Contract Type|Full-Time');
        const where = [city, country].filter(Boolean).join(', ') || decodeEntities(tag(item, 'g:location'));
        const africanIso = africanIsoIn(where);
        const titleAboutAfrica = /\bafrica|african\b/i.test(title) || !!africanIsoIn(title);

        let iso: string;
        if (africanIso) iso = africanIso;
        else if (titleAboutAfrica) {
          iso = Object.entries(COUNTRY_ISO).find(([n]) => where.toLowerCase().includes(n))?.[1] || org.hqCountry;
        } else { skipped++; continue; }

        // "Posting End Date 01/11/2026" (dd/mm/yyyy)
        const end = flat.match(/Posting End Date\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        const deadline = end ? `${end[3]}-${end[2].padStart(2, '0')}-${end[1].padStart(2, '0')}` : null;
        if (deadline && deadline < today) { skipped++; continue; }

        const contract = field(flat, 'Contract Type', 'Contract Length|Posting End Date');
        const { description, salary } = await summariseJob(title, org.name, bodyText);
        const result = await saveListing(supabase, {
          id: `sf-${org.domain.split('.').slice(-2, -1)[0]}-${id}`,
          title,
          organisation: org.name,
          type: mapType(title, contract),
          sector: org.sector || mapSector(`${title} ${flat.slice(0, 800)}`),
          location: where || iso, country: iso, deadline,
          posted: today,
          salary, description,
          apply_url: link,
          org_domain: org.domain,
          source: 'SuccessFactors',
        }, { submitSalary: !!africanIso });
        if (result === 'inserted') inserted++; else if (result === 'updated') updated++; else errors++;
      }
    } catch (err) {
      console.warn(`[successfactors-scraper] ${org.name} failed:`, (err as Error).message);
    }
  }

  console.log(`[successfactors-scraper] Done. Inserted ${inserted}, updated ${updated}, skipped ${skipped}, errors ${errors}`);
  return Response.json({ inserted, updated, skipped, errors });
});
