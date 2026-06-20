/**
 * Afrorama — recruitee-scraper Edge Function
 * Handles: Recruitee (api/offers) + Pinpoint HQ (jobs.json)
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const DISCLAIMER = '\n\n─────────────────────────────────────\nThis summary is automatically generated for quick reference. For the complete and authoritative job description, please view the original posting.';

// Recruitee orgs — subdomain.recruitee.com
const RECRUITEE_ORGS: { subdomain: string; name: string; country: string }[] = [
  { subdomain: 'adamsmithinternational1', name: 'Adam Smith International', country: 'KE' },
];

// Pinpoint HQ orgs — subdomain.pinpointhq.com
const PINPOINT_ORGS: { subdomain: string; name: string; country: string }[] = [
  { subdomain: 'medic', name: 'Medic', country: 'KE' },
];

const AFRICA_ISO = new Set([
  'KE','ZA','NG','SN','ET','GH','TZ','UG','RW','ZM','MZ','MW','ZW','BW','NA',
  'CM','CI','BF','ML','NE','TD','SD','SS','SO','CD','CG','AO','BJ','BI','CV',
  'CF','KM','DJ','EG','GQ','ER','SZ','GA','GM','GN','GW','LS','LR','LY','MG',
  'MR','MU','MA','ST','SL','TG','TN',
]);

const AFRICA_NAMES_LOWER = new Set([
  'kenya','south africa','nigeria','senegal','ethiopia','ghana','tanzania',
  'uganda','rwanda','zambia','mozambique','malawi','zimbabwe','botswana',
  'namibia','cameroon',"côte d'ivoire",'ivory coast','burkina faso','mali',
  'niger','chad','sudan','south sudan','somalia',
  'democratic republic of the congo','dr congo','congo','angola','benin',
  'burundi','cabo verde','cape verde','central african republic','comoros',
  'djibouti','egypt','equatorial guinea','eritrea','eswatini','gabon',
  'gambia','guinea','guinea-bissau','lesotho','liberia','libya','madagascar',
  'mauritania','mauritius','morocco','sierra leone','togo','tunisia','africa',
]);

function isAfrican(countryCode: string, countryName: string, location: string, fallback: string): string | null {
  // ISO2 check (Recruitee uses country_code)
  if (countryCode && AFRICA_ISO.has(countryCode.toUpperCase())) return countryCode.toUpperCase();
  // Name check
  const text = [countryName, location].join(' ').toLowerCase();
  for (const name of AFRICA_NAMES_LOWER) {
    if (text.includes(name)) return fallback;
  }
  return null;
}

const SECTOR_MAP: Record<string, string> = {
  'engineering':'Innovation & Technology','technology':'Innovation & Technology',
  'software':'Innovation & Technology','data':'Innovation & Technology',
  'finance':'Finance & Economics','accounting':'Finance & Economics',
  'health':'Health','medical':'Health',
  'education':'Education',
  'program':'Governance & Public Policy','programme':'Governance & Public Policy',
  'policy':'Governance & Public Policy','research':'Governance & Public Policy',
  'communications':'Governance & Public Policy','marketing':'Governance & Public Policy',
  'operations':'Governance & Public Policy',
  'agriculture':'Agriculture & Food Security','food':'Agriculture & Food Security',
  'environment':'Climate & Environment','climate':'Climate & Environment',
  'gender':'Gender & Social Inclusion',
  'legal':'Human Rights','human rights':'Human Rights',
};

function mapSector(dept: string): string {
  if (!dept) return 'Governance & Public Policy';
  const lower = dept.toLowerCase();
  for (const [key, val] of Object.entries(SECTOR_MAP)) { if (lower.includes(key)) return val; }
  return 'Governance & Public Policy';
}

function stripHtml(html: string): string {
  return (html || '')
    .replace(/<\/?(li|p|br|h[1-6]|div)[^>]*>/gi, '\n').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function fallbackDesc(bodyText: string, org: string): string {
  const first = (bodyText || '').split('\n').map(l => l.trim()).find(l => l.length > 30)?.replace(/^[-•*–·]\s*/, '').trim() || '';
  return [first ? `• ${first.charAt(0).toUpperCase() + first.slice(1)}` : `• Deliver impactful work as part of the ${org} team`,
    '• Manage tasks with a focus on measurable impact and accountability',
    '• Develop strategies and solutions within your area of expertise',
    '• Collaborate with colleagues and partners to achieve shared goals',
    '• Drive outcomes that create lasting social impact across the region',
  ].join('\n') + DISCLAIMER;
}

async function formatWithClaude(title: string, org: string, description: string): Promise<{ description: string; salary: string }> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey || !description || description.length < 80) return { description: fallbackDesc(description, org), salary: 'See listing' };
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', max_tokens: 400,
        messages: [{ role: 'user', content: `You are writing a job summary for Afrorama, Africa's social impact job board. Format the job description below in British English.\n\nTask 1 — Write exactly 5 bullet points:\n- Bullet 1 must be drawn directly from the opening or overview\n- Bullets 2–5 begin with a strong imperative verb\n- Concise and action-oriented, British English spelling\n\nTask 2 — Extract salary or compensation (be thorough): look for ANY clue — explicit figures, UN/NGO grades (P3, G5, Band C), qualitative terms (Competitive, Market-related, Commensurate with experience), allowances or stipends. Only write none if there is absolutely zero mention of pay, salary, grade, or compensation\n\nJob: ${title} at ${org}\n\nDescription:\n${description.slice(0, 2000)}\n\nReturn:\nBULLETS:\n• [bullet 1]\n• [bullet 2]\n• [bullet 3]\n• [bullet 4]\n• [bullet 5]\nSALARY: [salary or none]` }],
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
  console.log('[recruitee-scraper] Starting...');

  try {
  let totalImported = 0, totalSkipped = 0;

  // ── Recruitee ────────────────────────────────────────────────────
  for (const org of RECRUITEE_ORGS) {
    await new Promise(r => setTimeout(r, 300));
    try {
      const res = await fetch(`https://${org.subdomain}.recruitee.com/api/offers`, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'Afrorama/1.0' },
      });
      if (!res.ok) { console.warn(`[recruitee-scraper] ${org.name}: HTTP ${res.status}`); continue; }

      const json = await res.json() as any;
      const offers: any[] = json?.offers || [];
      console.log(`[recruitee-scraper] ${org.name}: ${offers.length} offers`);

      for (const offer of offers) {
        const iso = isAfrican(offer.country_code || '', offer.country || '', offer.location || '', org.country);
        if (!iso) continue;

        const jobId   = offer.id ? String(offer.id) : offer.guid || '';
        if (!jobId) continue;

        const title    = offer.title || 'Untitled';
        const dept     = offer.department || offer.category_code || '';
        const applyUrl = offer.careers_apply_url || offer.careers_url || `https://${org.subdomain}.recruitee.com/o/${offer.slug}`;
        const posted   = offer.published_at?.slice(0, 10) || new Date().toISOString().split('T')[0];
        const deadline = offer.close_at?.slice(0, 10) || null;
        const bodyText = stripHtml(offer.description || '');
        const { description, salary } = await formatWithClaude(title, org.name, bodyText);

        const result = await supabase.from('listings').upsert({
          id: `rt-${org.subdomain}-${jobId}`, title, organisation: org.name, type: 'jobs',
          sector: mapSector(dept), location: offer.city || offer.location || iso,
          country: iso, deadline, posted, salary, description, apply_url: applyUrl,
          experience: offer.experience_code || null, org_domain: `${org.subdomain}.recruitee.com`,
          source: 'Recruitee', views: 0, apply_clicks: 0, paid_listing: false,
        }, { onConflict: 'id', ignoreDuplicates: false });

        if (result?.error) { console.error(`[recruitee-scraper] Upsert error: ${result.error.message}`); totalSkipped++; }
        else totalImported++;
        await new Promise(r => setTimeout(r, 150));
      }
    } catch (err) { console.warn(`[recruitee-scraper] ${org.name} failed:`, (err as Error).message); }
  }

  // ── Pinpoint HQ ──────────────────────────────────────────────────
  for (const org of PINPOINT_ORGS) {
    await new Promise(r => setTimeout(r, 300));
    try {
      const res = await fetch(`https://${org.subdomain}.pinpointhq.com/jobs.json`, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'Afrorama/1.0' },
      });
      if (!res.ok) { console.warn(`[recruitee-scraper] Pinpoint ${org.name}: HTTP ${res.status}`); continue; }

      const json = await res.json() as any;
      const jobs: any[] = json?.data || json?.jobs || (Array.isArray(json) ? json : []);
      console.log(`[recruitee-scraper] Pinpoint ${org.name}: ${jobs.length} jobs`);
      if (jobs[0]) console.log(`[recruitee-scraper] Pinpoint first item keys:`, Object.keys(jobs[0]).join(', '));

      for (const job of jobs) {
        const locRaw  = job.location?.name || job.location || job.city || '';
        const country = job.location?.country || job.country || '';
        const iso     = isAfrican('', country, locRaw, org.country);
        if (!iso) continue;

        const jobId  = String(job.id || job.uuid || '');
        if (!jobId) continue;

        const title    = job.title || 'Untitled';
        const applyUrl = job.apply_url || `https://${org.subdomain}.pinpointhq.com/jobs/${jobId}`;
        const bodyText = stripHtml(job.description || job.body || '');
        const { description, salary } = await formatWithClaude(title, org.name, bodyText);

        const result = await supabase.from('listings').upsert({
          id: `pp-${org.subdomain}-${jobId}`, title, organisation: org.name, type: 'jobs',
          sector: mapSector(job.department || ''), location: locRaw || iso,
          country: iso, deadline: null,
          posted: job.published_at?.slice(0, 10) || new Date().toISOString().split('T')[0],
          salary, description, apply_url: applyUrl,
          experience: null, org_domain: `${org.subdomain}.pinpointhq.com`,
          source: 'Pinpoint', views: 0, apply_clicks: 0, paid_listing: false,
        }, { onConflict: 'id', ignoreDuplicates: false });

        if (result?.error) { console.error(`[recruitee-scraper] Upsert error: ${result.error.message}`); totalSkipped++; }
        else totalImported++;
        await new Promise(r => setTimeout(r, 150));
      }
    } catch (err) { console.warn(`[recruitee-scraper] Pinpoint ${org.name} failed:`, (err as Error).message); }
  }

  console.log(`[recruitee-scraper] Done. Imported: ${totalImported}, Skipped: ${totalSkipped}`);
  return Response.json({ imported: totalImported, skipped: totalSkipped });

  } catch (topErr) {
    console.error('[recruitee-scraper] UNCAUGHT:', (topErr as Error).message, (topErr as Error).stack);
    return Response.json({ error: (topErr as Error).message }, { status: 500 });
  }
});
