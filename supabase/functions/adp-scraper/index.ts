/**
 * Afrorama — adp-scraper Edge Function
 *
 * ADP Workforce Now career centres, through ADP's public JSON endpoints:
 *   GET /mascsr/default/careercenter/public/events/staffing/v1/job-requisitions?cid=…
 *   GET …/job-requisitions/{itemID}?cid=…   → full description
 * The cid / ccId come from the careers URL (…recruitment.html?cid=…&ccId=…).
 *
 * Imported: roles located in Africa, remote roles (for orgs with a
 * remoteCountry), and roles whose title is about Africa even if based
 * elsewhere (e.g. "Regional Program Manager, Africa" in Stuttgart) —
 * those keep their real location and country.
 *
 * Deploy: supabase functions deploy adp-scraper
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { africanIsoIn } from '../_shared/africa.ts';
import { stripHtml, summariseJob, mapSector, mapType } from '../_shared/summarise.ts';
import { saveListing } from '../_shared/listings.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const ORGS: { cid: string; ccId: string; name: string; hqCountry: string; sector?: string; remoteCountry: string | null }[] = [
  { cid: '9d364228-b53e-4047-b8d2-f5af4df7d8c0', ccId: '9200633833933_2', name: 'Spirit of America', hqCountry: 'US', remoteCountry: null },
];

// Non-African countries ADP reports by name, for Africa-focused roles based abroad
const COUNTRY_ISO: Record<string, string> = {
  'germany': 'DE', 'united states': 'US', 'usa': 'US', 'united kingdom': 'GB', 'france': 'FR',
  'belgium': 'BE', 'netherlands': 'NL', 'switzerland': 'CH', 'italy': 'IT', 'spain': 'ES',
  'portugal': 'PT', 'canada': 'CA', 'united arab emirates': 'AE', 'philippines': 'PH',
};

const API = 'https://workforcenow.adp.com/mascsr/default/careercenter/public/events/staffing/v1/job-requisitions';
const HEADERS = { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0 (compatible; Afrorama/1.0)' };
const money = (n: number) => Math.round(n).toLocaleString('en-US');

Deno.serve(async () => {
  let inserted = 0, updated = 0, errors = 0, skipped = 0;

  for (const org of ORGS) {
    const qs = `cid=${org.cid}&ccId=${org.ccId}&lang=en_US&locale=en_US`;
    try {
      const res = await fetch(`${API}?${qs}&$top=100`, { headers: HEADERS });
      if (!res.ok) { console.warn(`[adp-scraper] ${org.name}: list HTTP ${res.status}`); continue; }
      // deno-lint-ignore no-explicit-any
      const reqs: any[] = (await res.json()).jobRequisitions || [];
      console.log(`[adp-scraper] ${org.name}: ${reqs.length} open roles`);

      for (const r of reqs) {
        const title = String(r.requisitionTitle || '').replace(/\s+/g, ' ').trim();
        // deno-lint-ignore no-explicit-any
        const locs = (r.requisitionLocations || []).map((l: any) =>
          [l.address?.cityName, l.nameCode?.shortName || l.address?.countryCode].filter(Boolean).join(', '));
        const locText = locs.join(' / ');
        const titleAboutAfrica = /\bafrica|african\b/i.test(title) || !!africanIsoIn(title);
        if (!africanIsoIn(locText) && !/remote/i.test(locText) && !titleAboutAfrica) { skipped++; continue; }

        await new Promise(r2 => setTimeout(r2, 250));
        const dr = await fetch(`${API}/${encodeURIComponent(r.itemID)}?${qs}`, { headers: HEADERS });
        if (!dr.ok) { console.warn(`[adp-scraper] ${org.name} ${r.itemID}: HTTP ${dr.status}`); continue; }
        const detail = await dr.json();
        const bodyText = stripHtml(detail.requisitionDescription || '');

        // The description's own "Location:" line is often more precise than ADP's field
        const statedLoc = bodyText.match(/L\s?ocation:\s*([^\n]+?)(?:\s{2,}|\n|Work Days|Travel:|$)/i)?.[1]?.trim() || '';
        const where = statedLoc || locText;
        const africanIso = africanIsoIn(where) || africanIsoIn(locText);
        let iso: string, location: string;
        if (africanIso) { iso = africanIso; location = where || iso; }
        else if (/remote/i.test(where) && org.remoteCountry) { iso = org.remoteCountry; location = 'Remote'; }
        else if (titleAboutAfrica) {
          const country = Object.entries(COUNTRY_ISO).find(([n]) => where.toLowerCase().includes(n))?.[1];
          iso = country || org.hqCountry; location = where || 'See listing';
        } else { skipped++; continue; }

        const pay = detail.payGradeRange || r.payGradeRange;
        const salaryFromAdp = pay?.minimumRate?.amountValue
          ? `${pay.minimumRate.currencyCode || 'USD'} ${money(pay.minimumRate.amountValue)}${pay.maximumRate?.amountValue ? `–${money(pay.maximumRate.amountValue)}` : ''}`
          : null;
        const { description, salary } = await summariseJob(title, org.name, bodyText);

        // The public job number used in careers-page links (…&jobId=603948)
        const publicId = r.customFieldGroup?.stringFields?.[0]?.stringValue || r.clientRequisitionID || r.itemID;
        const result = await saveListing(supabase, {
          id: `adp-${org.cid.slice(0, 8)}-${r.itemID}`,
          title,
          organisation: org.name,
          type: mapType(title),
          sector: org.sector || mapSector(`${title} ${bodyText.slice(0, 800)}`),
          location, country: iso, deadline: null,
          posted: String(r.postDate || new Date().toISOString()).slice(0, 10),
          salary: salaryFromAdp || salary,
          description,
          apply_url: `https://workforcenow.adp.com/mascsr/default/mdf/recruitment/recruitment.html?cid=${org.cid}&ccId=${org.ccId}&lang=en_US&selectedMenuKey=CareerCenter&jobId=${encodeURIComponent(publicId)}`,
          org_domain: 'workforcenow.adp.com',
          source: 'ADP',
        }, { submitSalary: !!africanIso });
        if (result === 'inserted') inserted++; else if (result === 'updated') updated++; else errors++;
      }
    } catch (err) {
      console.warn(`[adp-scraper] ${org.name} failed:`, (err as Error).message);
    }
  }

  console.log(`[adp-scraper] Done. Inserted ${inserted}, updated ${updated}, skipped ${skipped}, errors ${errors}`);
  return Response.json({ inserted, updated, skipped, errors });
});
