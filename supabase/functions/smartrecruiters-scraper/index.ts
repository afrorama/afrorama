/**
 * Afrorama — smartrecruiters-scraper Edge Function
 * API: GET https://api.smartrecruiters.com/v1/companies/{id}/postings?status=PUBLISHED
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const DISCLAIMER = '\n\n─────────────────────────────────────\nThis summary is automatically generated for quick reference. For the complete and authoritative job description, please view the original posting.';

const ORGS: { id: string; name: string; country: string }[] = [
  { id: 'SNV',                           name: 'SNV',                                country: 'KE' },
  { id: 'PowerGenRenewableEnergy',       name: 'PowerGen Renewable Energy',          country: 'KE' },
  { id: 'OECD',                          name: 'OECD',                               country: 'KE' },
  { id: 'AmrefHealthAfrica4',            name: 'Amref Health Africa',                country: 'KE' },
  { id: 'IKhokha',                       name: 'iKhokha',                            country: 'ZA' },
  { id: 'OxfamAmerica2',                name: 'Oxfam America',                      country: 'KE' },
  { id: 'AceliAfrica',                   name: 'Aceli Africa',                       country: 'KE' },
  { id: 'ConstanterPhilanthropyServices',name: 'Constanter Philanthropy Services',   country: 'ZA' },
  { id: 'Verisk',                        name: 'Verisk',                             country: 'ZA' },
];

const AFRICA_ISO = new Set([
  'ke','za','ng','sn','et','gh','tz','ug','rw','zm','mz','mw','zw','bw','na',
  'cm','ci','bf','ml','ne','td','sd','ss','so','cd','cg','ao','bj','bi','cv',
  'cf','km','dj','eg','gq','er','sz','ga','gm','gn','gw','ls','lr','ly','mg',
  'mr','mu','ma','st','sl','tg','tn',
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

const COUNTRY_ISO: Record<string, string> = {
  'ke':'KE','za':'ZA','ng':'NG','sn':'SN','et':'ET','gh':'GH','tz':'TZ','ug':'UG',
  'rw':'RW','zm':'ZM','mz':'MZ','mw':'MW','zw':'ZW','bw':'BW','na':'NA','cm':'CM',
  'ci':'CI','bf':'BF','ml':'ML','ne':'NE','td':'TD','sd':'SD','ss':'SS','so':'SO',
  'cd':'CD','cg':'CG','ao':'AO','bj':'BJ','bi':'BI','cv':'CV','cf':'CF','km':'KM',
  'dj':'DJ','eg':'EG','gq':'GQ','er':'ER','sz':'SZ','ga':'GA','gm':'GM','gn':'GN',
  'gw':'GW','ls':'LS','lr':'LR','ly':'LY','mg':'MG','mr':'MR','mu':'MU','ma':'MA',
  'st':'ST','sl':'SL','tg':'TG','tn':'TN',
};

function resolveLocation(job: any, fallback: string): { iso: string; city: string } | null {
  const loc = job.location || {};
  const code = (loc.country || '').toLowerCase();
  const city = loc.city || loc.fullLocation || '';

  if (code && AFRICA_ISO.has(code)) return { iso: COUNTRY_ISO[code] || code.toUpperCase(), city };

  // Check city/fullLocation for country name
  const text = (city + ' ' + code).toLowerCase();
  for (const name of AFRICA_NAMES_LOWER) {
    if (text.includes(name)) return { iso: fallback, city };
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
  'operations':'Governance & Public Policy','hr':'Governance & Public Policy',
  'agriculture':'Agriculture & Food Security','food':'Agriculture & Food Security',
  'environment':'Climate & Environment','climate':'Climate & Environment',
  'gender':'Gender & Social Inclusion',
  'legal':'Human Rights','human rights':'Human Rights',
};

function mapSector(dept: string): string {
  if (!dept) return 'Governance & Public Policy';
  const lower = dept.toLowerCase();
  for (const [key, val] of Object.entries(SECTOR_MAP)) {
    if (lower.includes(key)) return val;
  }
  return 'Governance & Public Policy';
}

function stripHtml(html: string): string {
  return (html || '')
    .replace(/<\/?(li|p|br|h[1-6]|div)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function fallbackDesc(bodyText: string, org: string): string {
  const firstLine = (bodyText || '').split('\n').map(l => l.trim()).find(l => l.length > 30) || '';
  const first = firstLine.replace(/^[-•*–·]\s*/, '').trim();
  const bullet1 = first ? `• ${first.charAt(0).toUpperCase() + first.slice(1)}` : `• Deliver impactful work as part of the ${org} team`;
  return [bullet1,
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
        messages: [{ role: 'user', content: `You are writing a job summary for Afrorama, Africa's social impact job board. Format the job description below in British English.\n\nTask 1 — Write exactly 5 bullet points:\n- Bullet 1 must be drawn directly from the opening or overview — capture what the role is actually about\n- Bullets 2–5 must each begin with a strong imperative verb (e.g. Lead, Manage, Develop, Coordinate, Deliver, Foster, Build, Drive)\n- Parallel imperative structure, addressing the reader directly\n- Concise and action-oriented — no fluff, no passive voice\n- British English spelling (organise, programme, analyse, prioritise)\n\nTask 2 — Extract salary or compensation (be thorough):\n- Extract ANY clue — explicit figures, grades (P3/G5/Band C), "Competitive", "Market-related", allowances, per diems\n- Only write: none — if zero mention of pay, salary, grade, or compensation\n\nJob: ${title} at ${org}\n\nDescription:\n${description.slice(0, 2000)}\n\nReturn in this exact format:\nBULLETS:\n• [bullet 1]\n• [bullet 2]\n• [bullet 3]\n• [bullet 4]\n• [bullet 5]\nSALARY: [salary or none]` }],
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

Deno.serve(async (req) => {
  console.log('[smartrecruiters-scraper] Starting...');

  try {
    const batchSize = 6;
    const batch = Math.max(0, parseInt(new URL(req.url).searchParams.get('batch') || '0', 10));
    const start = (batch * batchSize) % ORGS.length;
    const orgs  = [...ORGS, ...ORGS].slice(start, start + batchSize);
    console.log(`[smartrecruiters-scraper] Batch ${batch}: orgs ${start + 1}–${start + orgs.length}`);

    let totalImported = 0, totalSkipped = 0;

    for (const org of orgs) {
      await new Promise(r => setTimeout(r, 300));
      try {
        // Collect all African jobs across pages first, then process (cap per org to avoid timeout)
        const MAX_AFRICAN = 15;
        const africanJobs: any[] = [];
        let offset = 0;

        while (africanJobs.length < MAX_AFRICAN) {
          const res = await fetch(
            `https://api.smartrecruiters.com/v1/companies/${org.id}/postings?status=PUBLISHED&limit=100&offset=${offset}`,
            { headers: { 'Accept': 'application/json', 'User-Agent': 'Afrorama/1.0' } },
          );
          if (!res.ok) { console.warn(`[smartrecruiters-scraper] ${org.name}: HTTP ${res.status}`); break; }

          const json  = await res.json() as any;
          const jobs: any[] = json?.content || [];
          const total: number = json?.totalFound || 0;
          console.log(`[smartrecruiters-scraper] ${org.name}: page offset=${offset}, ${jobs.length} jobs (total ${total})`);

          for (const job of jobs) {
            const loc = resolveLocation(job, org.country);
            if (loc) africanJobs.push({ job, loc });
            if (africanJobs.length >= MAX_AFRICAN) break;
          }

          offset += 100;
          if (jobs.length < 100 || offset >= total) break;
          await new Promise(r => setTimeout(r, 200));
        }

        console.log(`[smartrecruiters-scraper] ${org.name}: ${africanJobs.length} African jobs to process`);

        for (const { job, loc } of africanJobs) {
          const jobId  = job.uuid || String(job.id || '');
          if (!jobId) continue;

          const title    = job.name || job.title || 'Untitled';
          const dept     = job.department?.label || job.function?.label || '';
          const applyUrl = job.ref || `https://jobs.smartrecruiters.com/${org.id}/${jobId}`;
          const posted   = job.releasedDate?.slice(0, 10) || new Date().toISOString().split('T')[0];
          const expLevel = job.experienceLevel?.label || null;

          // Fetch full description
          let bodyText = '';
          try {
            const dr = await fetch(
              `https://api.smartrecruiters.com/v1/companies/${org.id}/postings/${jobId}`,
              { headers: { 'Accept': 'application/json', 'User-Agent': 'Afrorama/1.0' } },
            );
            if (dr.ok) {
              const detail = await dr.json() as any;
              bodyText = stripHtml(
                detail?.jobAd?.sections?.jobDescription?.text ||
                detail?.sections?.jobDescription?.text || '',
              );
            }
          } catch { /* fallback */ }

          const { description, salary } = await formatWithClaude(title, org.name, bodyText);

          const result = await supabase.from('listings').upsert({
            id: `sr-${org.id}-${jobId}`, title, organisation: org.name, type: 'jobs',
            sector: mapSector(dept), location: loc.city || org.country, country: loc.iso,
            deadline: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
            posted, salary, description, apply_url: applyUrl,
            experience: expLevel, org_domain: `${org.id}.smartrecruiters.com`,
            source: 'SmartRecruiters', views: 0, apply_clicks: 0, paid_listing: false,
          }, { onConflict: 'id', ignoreDuplicates: false });

          if (result?.error) { console.error(`[smartrecruiters-scraper] Upsert error: ${result.error.message}`); totalSkipped++; }
          else totalImported++;

          await new Promise(r => setTimeout(r, 200));
        }
      } catch (err) {
        console.warn(`[smartrecruiters-scraper] ${org.name} failed:`, (err as Error).message);
      }
    }

    console.log(`[smartrecruiters-scraper] Done. Imported: ${totalImported}, Skipped: ${totalSkipped}`);
    return Response.json({ imported: totalImported, skipped: totalSkipped });

  } catch (topErr) {
    console.error('[smartrecruiters-scraper] UNCAUGHT:', (topErr as Error).message, (topErr as Error).stack);
    return Response.json({ error: (topErr as Error).message }, { status: 500 });
  }
});
