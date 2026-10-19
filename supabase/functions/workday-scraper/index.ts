/**
 * Afrorama — workday-scraper Edge Function
 *
 * Workday career sites ({tenant}.wdN.myworkdayjobs.com/{site}) through
 * Workday's public JSON endpoints:
 *   POST /wday/cxs/{tenant}/{site}/jobs        → job list (paged)
 *   GET  /wday/cxs/{tenant}/{site}{externalPath} → job detail
 *
 * A role is imported if its main or any additional location is in Africa
 * (and remote roles, for orgs with a remoteCountry set).
 *
 * Deploy: supabase functions deploy workday-scraper
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { africanIsoIn } from '../_shared/africa.ts';
import { AFRICA_TEXT_ISO } from '../_shared/reliefweb.ts';
import { stripHtml, summariseJob, mapSector, mapType } from '../_shared/summarise.ts';
import { saveListing } from '../_shared/listings.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// host + tenant + site come from the careers URL:
//   https://{host}/{site}/job/...   and the tenant is the host's first label
const ORGS: { host: string; tenant: string; site: string; name: string; sector?: string; remoteCountry: string | null }[] = [
  { host: 'osfglobal.wd5.myworkdayjobs.com', tenant: 'osfglobal', site: 'OSF', name: 'Open Society Foundations', remoteCountry: null },
];

const AFRICA_ISO = new Set(Object.values(AFRICA_TEXT_ISO));
const HEADERS = { 'Content-Type': 'application/json', 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0 (compatible; Afrorama/1.0)' };

Deno.serve(async () => {
  const today = new Date().toISOString().slice(0, 10);
  let inserted = 0, updated = 0, errors = 0, skipped = 0;

  for (const org of ORGS) {
    const api = `https://${org.host}/wday/cxs/${org.tenant}/${org.site}`;
    try {
      // deno-lint-ignore no-explicit-any
      const postings: any[] = [];
      for (let offset = 0; offset < 500; offset += 20) {
        const res = await fetch(`${api}/jobs`, {
          method: 'POST', headers: HEADERS,
          body: JSON.stringify({ limit: 20, offset, searchText: '', appliedFacets: {} }),
        });
        if (!res.ok) { console.warn(`[workday-scraper] ${org.name}: list HTTP ${res.status}`); break; }
        const page = await res.json();
        postings.push(...(page.jobPostings || []));
        if (!page.jobPostings?.length || postings.length >= (page.total ?? 0)) break;
      }
      console.log(`[workday-scraper] ${org.name}: ${postings.length} open roles`);

      for (const p of postings) {
        await new Promise(r => setTimeout(r, 250));
        const dr = await fetch(`${api}${p.externalPath}`, { headers: HEADERS });
        if (!dr.ok) { console.warn(`[workday-scraper] ${org.name} ${p.externalPath}: HTTP ${dr.status}`); continue; }
        const info = (await dr.json()).jobPostingInfo;
        if (!info) continue;

        const places: string[] = [info.location, ...(info.additionalLocations || [])].filter(Boolean);
        const mainIso = info.jobRequisitionLocation?.country?.alpha2Code;
        const africanIso = (mainIso && AFRICA_ISO.has(mainIso)) ? mainIso : africanIsoIn(`${places.join(' / ')} ${info.title}`);
        const isRemote = /remote/i.test(places.join(' ')) || /remote/i.test(info.remoteType || '');
        let iso: string, location: string;
        if (africanIso) { iso = africanIso; location = places.join(' / ') || iso; }
        else if (isRemote && org.remoteCountry) { iso = org.remoteCountry; location = 'Remote'; }
        else { skipped++; continue; }

        const deadline = info.endDate ? String(info.endDate).slice(0, 10) : null;
        if (deadline && deadline < today) { skipped++; continue; }

        const title = String(info.title || p.title).trim();
        const bodyText = stripHtml(info.jobDescription || '');
        const { description, salary } = await summariseJob(title, org.name, bodyText);
        const result = await saveListing(supabase, {
          id: `wd-${org.tenant}-${info.jobReqId || info.id}`,
          title,
          organisation: org.name,
          type: mapType(title, info.timeType || ''),
          sector: org.sector || mapSector(`${title} ${bodyText.slice(0, 800)}`),
          location, country: iso, deadline,
          posted: info.startDate ? String(info.startDate).slice(0, 10) : today,
          salary, description,
          apply_url: info.externalUrl || `https://${org.host}/${org.site}${p.externalPath}`,
          org_domain: org.host,
          source: 'Workday',
        }, { submitSalary: !!africanIso });
        if (result === 'inserted') inserted++; else if (result === 'updated') updated++; else errors++;
      }
    } catch (err) {
      console.warn(`[workday-scraper] ${org.name} failed:`, (err as Error).message);
    }
  }

  console.log(`[workday-scraper] Done. Inserted ${inserted}, updated ${updated}, skipped ${skipped}, errors ${errors}`);
  return Response.json({ inserted, updated, skipped, errors });
});
