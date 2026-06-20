/**
 * Afrorama — bamboohr-scraper Edge Function
 *
 * Fetches open jobs from BambooHR career pages for curated African-focused orgs
 * and upserts them into the Supabase listings table.
 *
 * Orgs are stored in the bamboohr_orgs table — add new ones there without
 * touching this code.
 *
 * Deploy:
 *   supabase functions deploy bamboohr-scraper
 *
 * Schedule daily (add after reliefweb-daily in pg_cron):
 *   SELECT cron.schedule('bamboohr-daily', '0 7 * * *',
 *     $$SELECT net.http_post(url := 'https://vqchwioyhyiuunpyildz.supabase.co/functions/v1/bamboohr-scraper',
 *       headers := '{"Authorization":"Bearer SERVICE_ROLE_KEY","Content-Type":"application/json"}'::jsonb,
 *       body := '{}'::jsonb)$$);
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const DISCLAIMER = '\n\n─────────────────────────────────────\nThis summary is automatically generated for quick reference. For the complete and authoritative job description, please view the original posting.';

const AFRICA_ISO = new Set([
  'KE','ZA','NG','SN','ET','GH','TZ','UG','RW','ZM','MZ','MW','ZW','BW','NA',
  'CM','CI','BF','ML','NE','TD','SD','SS','SO','CD','CG','AO','BJ','BI','CV',
  'CF','KM','DJ','EG','GQ','ER','SZ','GA','GM','GN','GW','LS','LR','LY','MG',
  'MR','MU','MA','ST','SL','TG','TN',
]);

const SECTOR_MAP: Record<string, string> = {
  'Engineering':           'Innovation & Technology',
  'Technology':            'Innovation & Technology',
  'Finance':               'Finance & Economics',
  'Accounting':            'Finance & Economics',
  'Health':                'Health',
  'Medical':               'Health',
  'Education':             'Education',
  'Programs':              'Governance & Public Policy',
  'Programme':             'Governance & Public Policy',
  'Policy':                'Governance & Public Policy',
  'Research':              'Governance & Public Policy',
  'Communications':        'Governance & Public Policy',
  'Marketing':             'Governance & Public Policy',
  'Operations':            'Governance & Public Policy',
  'Human Resources':       'Governance & Public Policy',
  'Agriculture':           'Agriculture & Food Security',
  'Environment':           'Climate & Environment',
  'Gender':                'Gender & Social Inclusion',
  'Legal':                 'Human Rights',
};

function mapSector(dept: string): string {
  if (!dept) return 'Governance & Public Policy';
  for (const [key, val] of Object.entries(SECTOR_MAP)) {
    if (dept.toLowerCase().includes(key.toLowerCase())) return val;
  }
  return 'Governance & Public Policy';
}

function mapType(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('intern') || t.includes('trainee') || t.includes('volunteer')) return 'internship';
  if (t.includes('fellowship')) return 'capacity';
  if (t.includes('consultant') || t.includes('consultancy') || t.includes('advisor') || t.includes('adviser') || t.includes('contractor')) return 'consultancy';
  return 'jobs';
}

function extractDeadline(text: string): string | null {
  if (!text) return null;
  const patterns = [
    /(?:deadline|closing date|close[sd]? on|applications?\s+close|apply by|submit by|due date|applications?\s+due)[:\s]+([A-Za-z]+\.?\s+\d{1,2},?\s+\d{4})/i,
    /(?:deadline|closing date|close[sd]? on|applications?\s+close|apply by|submit by)[:\s]+(\d{1,2}\s+[A-Za-z]+\.?\s+\d{4})/i,
    /(?:deadline|closing date)[:\s]+(\d{4}-\d{2}-\d{2})/i,
    /submit.*?by\s+([A-Za-z]+\.?\s+\d{1,2},?\s+\d{4})/i,
  ];
  for (const p of patterns) {
    const m = p.exec(text);
    if (m) {
      const parsed = new Date(m[1].replace(/,/g, '').trim());
      if (!isNaN(parsed.getTime()) && parsed.getFullYear() >= new Date().getFullYear()) {
        return parsed.toISOString().split('T')[0];
      }
    }
  }
  return null;
}

function buildExcerpt(text: string): string {
  if (text.length <= 4000) return text;
  return text.slice(0, 3000) + '\n[...]\n' + text.slice(-1000);
}

async function formatWithClaude(title: string, org: string, description: string): Promise<{ description: string; salary: string }> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    console.error('[formatWithClaude] ANTHROPIC_API_KEY is not set — falling back');
    return { description: fallbackDesc(description, org), salary: 'See listing' };
  }
  if (!description || description.length < 80) {
    console.error(`[formatWithClaude] description too short (${description?.length ?? 0} chars) — falling back`);
    return { description: fallbackDesc(description, org), salary: 'See listing' };
  }

  const prompt = `You are writing a job summary for Afrorama, Africa's social impact job board. Format the job description below in British English.

Task 1 — Write exactly 5 bullet points:
- Bullet 1 must be drawn directly from the opening or overview — capture what the role is actually about
- Bullets 2–5 must each begin with a strong imperative verb (e.g. Lead, Manage, Develop, Coordinate, Deliver, Foster, Build, Drive)
- Parallel imperative structure, addressing the reader directly
- Concise and action-oriented — no fluff, no passive voice, no vague verbs like "help" or "assist"
- British English spelling (organise, programme, analyse, prioritise)

Task 2 — Extract salary or compensation (be thorough):
- Extract ANY compensation clue — explicit figures, grades, bands, or qualitative terms
- Explicit: "USD 45,000–55,000/yr", "KES 150,000/month", "ZAR 800,000/yr"
- UN/NGO grades: if you see P3, G5, NOA, Band C etc. write e.g. "UN P3 grade"
- Qualitative: "Competitive", "Market-related", "Attractive package", "Commensurate with experience" — write as-is
- Allowances: "VLA USD 1,200/month", "per diem included", "daily subsistence allowance"
- Only write: none — if the text has absolutely zero mention of pay, salary, stipend, grade, band, allowance, or compensation

Job: ${title} at ${org}

Description:
${buildExcerpt(description)}

Return in this exact format:
BULLETS:
• [bullet 1]
• [bullet 2]
• [bullet 3]
• [bullet 4]
• [bullet 5]
SALARY: [salary or none]`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages:   [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      console.error(`[formatWithClaude] Anthropic API returned ${res.status}: ${errBody.slice(0, 300)}`);
      return { description: fallbackDesc(description, org), salary: 'See listing' };
    }

    const data   = await res.json() as { content: { text: string }[] };
    const raw    = data.content?.[0]?.text?.trim() || '';

    // Parse bullets and salary from response
    const bulletMatch = raw.match(/BULLETS:\s*([\s\S]*?)(?=SALARY:|$)/i);
    const salaryMatch = raw.match(/SALARY:\s*(.+)/i);

    const bullets = bulletMatch?.[1]?.trim() || fallbackDesc(description, org);
    const salaryRaw = salaryMatch?.[1]?.trim() || 'none';
    const salary  = salaryRaw.toLowerCase() === 'none' ? 'See listing' : salaryRaw;

    return { description: bullets + DISCLAIMER, salary };
  } catch (err) {
    console.error(`[formatWithClaude] Exception calling Anthropic API: ${err instanceof Error ? err.message : String(err)}`);
    return { description: fallbackDesc(description, org), salary: 'See listing' };
  }
}

function fallbackDesc(bodyText: string, org: string): string {
  const firstLine = (bodyText || '').split('\n').map(l => l.trim()).find(l => l.length > 30) || '';
  const first = firstLine.replace(/^[-•*–·]\s*/, '').trim();
  const bullet1 = first
    ? `• ${first.charAt(0).toUpperCase() + first.slice(1)}`
    : `• Deliver impactful work as part of the ${org} team`;
  return [
    bullet1,
    '• Manage tasks with a focus on measurable impact and accountability',
    '• Develop strategies and solutions within your area of expertise',
    '• Collaborate with colleagues and partners to achieve shared goals',
    '• Drive outcomes that create lasting social impact across the region',
  ].join('\n') + DISCLAIMER;
}

function stripHtml(html: string): string {
  return (html || '')
    .replace(/<\/?(li|p|br|h[1-6]|div)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

Deno.serve(async (req) => {
  console.log('[bamboohr-scraper] Starting...');

  // Support ?batch=N to process orgs in rotating batches of 15 (avoids timeout)
  const batchSize  = 15;
  const batchParam = new URL(req.url).searchParams.get('batch');
  const batch      = Math.max(0, parseInt(batchParam || '0', 10));

  const { data: allOrgs, error: orgsErr } = await supabase
    .from('bamboohr_orgs')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: true });

  if (orgsErr || !allOrgs?.length) {
    console.error('[bamboohr-scraper] Could not load orgs:', orgsErr?.message);
    return Response.json({ imported: 0, skipped: 0, error: 'No orgs found' });
  }

  const start = (batch * batchSize) % allOrgs.length;
  const orgs  = [...allOrgs, ...allOrgs].slice(start, start + batchSize);
  console.log(`[bamboohr-scraper] Batch ${batch}: orgs ${start + 1}–${start + orgs.length} of ${allOrgs.length}`);

  let totalImported = 0, totalSkipped = 0;

  for (const org of orgs) {
    await new Promise(r => setTimeout(r, 300));

    try {
      const url = `https://${org.subdomain}.bamboohr.com/careers/list`;
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'Afrorama/1.0' },
      });

      if (!res.ok) {
        console.warn(`[bamboohr-scraper] ${org.name}: HTTP ${res.status}`);
        continue;
      }

      let json: any;
      try { json = await res.json(); } catch { console.warn(`[bamboohr-scraper] ${org.name}: invalid JSON`); continue; }

      const jobs = json.result || json.jobs || (Array.isArray(json) ? json : []);
      console.log(`[bamboohr-scraper] ${org.name}: ${jobs.length} jobs`);

      for (const job of jobs) {
        const jobId = String(job.id || job.jobOpeningId || '');
        if (!jobId) continue;

        const title      = (job.jobOpeningName || job.title || 'Untitled').trim();
        const dept       = job.departmentLabel || job.department?.label || '';
        const sector     = mapSector(dept);
        const applyUrl   = `https://${org.subdomain}.bamboohr.com/careers/${jobId}`;
        const experience = job.minimumExperience?.label || job.minimumExperience || job.employmentStatusLabel || null;

        const locRaw     = job.location || job.atsLocation || {};
        const city       = typeof locRaw === 'string' ? locRaw : (locRaw.city || '');
        const countryRaw = typeof locRaw === 'object' ? (locRaw.country || org.country || 'ZA') : (org.country || 'ZA');
        const location   = job.isRemote ? 'Remote' : (city || countryRaw);

        // Resolve ISO2: explicit code → name lookup → org fallback
        const COUNTRY_NAME_ISO: Record<string, string> = {
          'philippines':'PH','thailand':'TH','vietnam':'VN','indonesia':'ID','malaysia':'MY',
          'india':'IN','nepal':'NP','bangladesh':'BD','pakistan':'PK','myanmar':'MM',
          'cambodia':'KH','laos':'LA','sri lanka':'LK','china':'CN','japan':'JP',
          'singapore':'SG','united states':'US','usa':'US','united kingdom':'GB','uk':'GB',
          'canada':'CA','australia':'AU','new zealand':'NZ','germany':'DE','france':'FR',
          'netherlands':'NL','belgium':'BE','switzerland':'CH','sweden':'SE','norway':'NO',
          'denmark':'DK','italy':'IT','spain':'ES','austria':'AT','ireland':'IE',
          'brazil':'BR','colombia':'CO','mexico':'MX','argentina':'AR','chile':'CL',
          'peru':'PE','ecuador':'EC','hungary':'HU','poland':'PL','czechia':'CZ',
          'czech republic':'CZ','luxembourg':'LU','ukraine':'UA','turkey':'TR',
          'jordan':'JO','lebanon':'LB','armenia':'AM','georgia':'GE','moldova':'MD',
          'haiti':'HT','dominican republic':'DO','guatemala':'GT','honduras':'HN',
          'el salvador':'SV','nicaragua':'NI','costa rica':'CR','panama':'PA',
        };
        const rawIso = String(countryRaw).trim();
        const resolvedIso = rawIso.length === 2
          ? rawIso.toUpperCase()
          : COUNTRY_NAME_ISO[rawIso.toLowerCase()] || null;
        // Only fall back to org.country when the location is genuinely unknown (not a named non-Africa country)
        const country = resolvedIso ?? org.country;

        // Keep if: African country OR (no country info AND title/location mentions Africa)
        const AFRICA_MENTIONS = ['africa','kenya','nigeria','ghana','ethiopia','uganda','rwanda',
          'tanzania','zambia','mozambique','malawi','zimbabwe','south africa','senegal','cameroon',
          'côte d\'ivoire','ivory coast','burkina faso','mali','niger','chad','sudan','somalia',
          'congo','angola','egypt','morocco','tunisia','botswana','namibia','sierra leone'];
        const titleLower = title.toLowerCase();
        const locationLower = location.toLowerCase();
        // Include if: African country code, location text mentions Africa, OR title signals Africa
        const mentionsAfrica = AFRICA_MENTIONS.some(c => titleLower.includes(c) || locationLower.includes(c));
        if (!AFRICA_ISO.has(country) && !mentionsAfrica) continue;

        // The /careers/list endpoint never includes the full description —
        // it only lives on the per-job /careers/{id}/detail endpoint.
        let detailDesc = '';
        let compensation: string | null = null;
        try {
          const detailRes = await fetch(`https://${org.subdomain}.bamboohr.com/careers/${jobId}/detail`, {
            headers: { 'Accept': 'application/json', 'User-Agent': 'Afrorama/1.0' },
          });
          if (detailRes.ok) {
            const detailJson: any = await detailRes.json();
            detailDesc = detailJson?.result?.jobOpening?.description || '';
            compensation = detailJson?.result?.jobOpening?.compensation || null;
          } else {
            console.error(`[bamboohr-scraper] ${org.name} job ${jobId}: detail HTTP ${detailRes.status}`);
          }
        } catch (err) {
          console.error(`[bamboohr-scraper] ${org.name} job ${jobId}: detail fetch failed — ${err instanceof Error ? err.message : String(err)}`);
        }

        const rawDesc = stripHtml(detailDesc || job.description || job.jobDescription || '');
        const deadline = extractDeadline(rawDesc);
        const { description, salary: extractedSalary } = await formatWithClaude(title, org.name, rawDesc);
        const salary   = compensation || extractedSalary;
        const posted   = job.datePosted?.slice(0, 10) || new Date().toISOString().split('T')[0];

        const entry = {
          id:           `bhr-${org.subdomain}-${jobId}`,
          title,
          organisation: org.name,
          type:         mapType(title),
          sector,
          location,
          country,
          deadline,
          posted,
          salary,
          description, apply_url:    applyUrl,
          experience,
          org_domain:   `${org.subdomain}.bamboohr.com`,
          source:       'BambooHR',
          views:        0,
          apply_clicks: 0,
          paid_listing: false,
        };

        const { error } = await supabase
          .from('listings')
          .upsert(entry, { onConflict: 'id', ignoreDuplicates: false });

        if (error) { console.error(`[bamboohr-scraper] Upsert error: ${error.message}`); totalSkipped++; }
        else totalImported++;
      }
    } catch (err) {
      console.warn(`[bamboohr-scraper] ${org.name} failed:`, (err as Error).message);
    }
  }

  console.log(`[bamboohr-scraper] Done. Imported: ${totalImported}, Skipped: ${totalSkipped}`);
  return Response.json({ imported: totalImported, skipped: totalSkipped });
});
