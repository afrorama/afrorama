/**
 * Afrorama — 80khours-scraper Edge Function
 *
 * Queries 80,000 Hours' Algolia job index for Africa-tagged roles.
 * Uses url_external — the direct employer application URL — so users
 * land straight on the employer's application form, not an 80k page.
 *
 * Deploy: supabase functions deploy 80khours-scraper
 * Schedule daily: cron at 0 13 30 * * (after other scrapers)
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const DISCLAIMER = '\n\n─────────────────────────────────────\nThis summary is automatically generated for quick reference. For the complete and authoritative job description, please view the original posting.';

// Algolia credentials (public search-only key from 80k Hours page source)
const ALGOLIA_APP_ID  = 'W6KM1UDIB3';
const ALGOLIA_API_KEY = 'd1d7f2c8696e7b36837d5ed337c4a319';
const ALGOLIA_INDEX   = 'jobs_prod';

// All African country names as used in 80k Hours' tags_location_80k facet
const AFRICA_TAGS = [
  'Africa', 'Kenya', 'Nigeria', 'Ethiopia', 'Ghana', 'Uganda', 'Rwanda',
  'Tanzania', 'Zambia', 'Malawi', 'Mozambique', 'Zimbabwe', 'South Africa',
  'Senegal', 'Cameroon', 'Botswana', 'Namibia', 'Sudan', 'Somalia',
  'Democratic Republic of the Congo', 'Congo', 'Angola', 'Benin', 'Burundi',
  'Cabo Verde', 'Central African Republic', 'Chad', 'Comoros', 'Djibouti',
  'Egypt', 'Equatorial Guinea', 'Eritrea', 'Eswatini', 'Gabon', 'Gambia',
  'Guinea', 'Guinea-Bissau', 'Lesotho', 'Liberia', 'Libya', 'Madagascar',
  'Mauritania', 'Mauritius', 'Morocco', 'Sierra Leone', 'Togo', 'Tunisia',
];

const AFRICA_ISO: Record<string, string> = {
  'Kenya':'KE','South Africa':'ZA','Nigeria':'NG','Senegal':'SN','Ethiopia':'ET',
  'Ghana':'GH','Tanzania':'TZ','Uganda':'UG','Rwanda':'RW','Zambia':'ZM',
  'Mozambique':'MZ','Malawi':'MW','Zimbabwe':'ZW','Botswana':'BW','Namibia':'NA',
  'Cameroon':'CM','Sudan':'SD','Somalia':'SO',
  'Democratic Republic of the Congo':'CD','Congo':'CG','Angola':'AO','Benin':'BJ',
  'Burundi':'BI','Cabo Verde':'CV','Central African Republic':'CF','Chad':'TD',
  'Comoros':'KM','Djibouti':'DJ','Egypt':'EG','Equatorial Guinea':'GQ',
  'Eritrea':'ER','Eswatini':'SZ','Gabon':'GA','Gambia':'GM','Guinea':'GN',
  'Guinea-Bissau':'GW','Lesotho':'LS','Liberia':'LR','Libya':'LY',
  'Madagascar':'MG','Mauritania':'MR','Mauritius':'MU','Morocco':'MA',
  'Sierra Leone':'SL','Togo':'TG','Tunisia':'TN',
};

// Map 80k Hours areas to Afrorama sectors
const AREA_SECTOR: Record<string, string> = {
  'Global health & development':    'Health',
  'Climate change':                  'Climate & Environment',
  'Biosecurity':                     'Health',
  'Nuclear security':                'Governance & Public Policy',
  'AI safety':                       'Innovation & Technology',
  'Education':                       'Education',
  'Global poverty':                  'Finance & Economics',
  'Animal welfare':                  'Governance & Public Policy',
  'Policy':                          'Governance & Public Policy',
  'Research':                        'Governance & Public Policy',
  'Operations':                      'Governance & Public Policy',
  'Finance':                         'Finance & Economics',
  'Communications':                  'Governance & Public Policy',
  'Software engineering':            'Innovation & Technology',
  'Data science':                    'Innovation & Technology',
  'Government & policy':             'Governance & Public Policy',
  'Effective altruism':              'Governance & Public Policy',
};

function mapSector(areas: string[]): string {
  for (const area of areas || []) {
    for (const [key, val] of Object.entries(AREA_SECTOR)) {
      if (area.toLowerCase().includes(key.toLowerCase())) return val;
    }
  }
  return 'Governance & Public Policy';
}

// Map 80k Hours role type to Afrorama type
function mapType(roleTags: string[]): string {
  const tags = (roleTags || []).map(t => t.toLowerCase());
  if (tags.some(t => t.includes('internship'))) return 'internship';
  if (tags.some(t => t.includes('fellowship'))) return 'internship';
  if (tags.some(t => t.includes('volunteer')))  return 'internship';
  if (tags.some(t => t.includes('consult')))    return 'consultancy';
  return 'jobs';
}

function stripHtml(html: string): string {
  return (html || '')
    .replace(/<\/?(li|p|br|h[1-6]|div)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

// Uses real lines from the actual posting rather than fabricated, generic
// "responsibilities" — when AI summarisation isn't available, it's more
// honest to show less than to invent content that didn't come from the org.
function fallbackDesc(bodyText: string, org: string): string {
  const lines = (bodyText || '')
    .split('\n')
    .map(l => l.trim().replace(/^[-•*–·]\s*/, ''))
    .filter(l => l.length > 30)
    .slice(0, 3);
  if (lines.length === 0) {
    return `${org} has posted this opportunity, but the description could not be automatically summarised. Please view the original posting for full details.${DISCLAIMER}`;
  }
  return lines.map(l => `• ${l.charAt(0).toUpperCase() + l.slice(1)}`).join('\n') + DISCLAIMER;
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
        messages: [{ role: 'user', content: `You are writing a job summary for Afrorama, Africa's social impact job board. Format the job description below in British English.\n\nTask 1 — Write exactly 5 bullet points:\n- Bullet 1 drawn from the opening overview\n- Bullets 2–5 begin with a strong imperative verb\n- Concise and action-oriented, British English spelling\n\nTask 2 — Extract salary or compensation (be thorough): look for ANY clue — explicit figures, UN/NGO grades (P3, G5, Band C), qualitative terms (Competitive, Market-related, Commensurate with experience), allowances or stipends. Only write none if there is absolutely zero mention of pay, salary, grade, or compensation\n\nJob: ${title} at ${org}\n\nDescription:\n${description.slice(0, 2000)}\n\nReturn:\nBULLETS:\n• [bullet 1]\n• [bullet 2]\n• [bullet 3]\n• [bullet 4]\n• [bullet 5]\nSALARY: [salary or none]` }],
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
  console.log('[80khours-scraper] Starting...');

  try {
    // Build Algolia filter for all African tags
    const africaFilter = AFRICA_TAGS.map(t => `tags_location_80k:"${t}"`).join(' OR ');

    let page = 0, totalImported = 0, totalSkipped = 0;
    const hitsPerPage = 50;

    while (true) {
      const res = await fetch(
        `https://${ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/${ALGOLIA_INDEX}/query`,
        {
          method: 'POST',
          headers: {
            'Content-Type':           'application/json',
            'X-Algolia-Application-Id': ALGOLIA_APP_ID,
            'X-Algolia-API-Key':       ALGOLIA_API_KEY,
          },
          body: JSON.stringify({
            query: '',
            filters: africaFilter,
            hitsPerPage,
            page,
            attributesToRetrieve: [
              'objectID', 'post_pk', 'title', 'description_short',
              'url_external', 'company_name', 'company_logo_url',
              'tags_area', 'tags_country', 'tags_city', 'tags_role_type',
              'tags_location_80k', 'closes_at', 'posted_at', 'salary',
            ],
          }),
        }
      );

      if (!res.ok) {
        console.error(`[80khours-scraper] Algolia error: ${res.status}`);
        break;
      }

      const data  = await res.json() as any;
      const hits  = data.hits || [];
      const pages = data.nbPages || 1;

      console.log(`[80khours-scraper] Page ${page + 1}/${pages}: ${hits.length} jobs (${data.nbHits} total)`);

      for (const job of hits) {
        const applyUrl = job.url_external;
        if (!applyUrl) { totalSkipped++; continue; }

        // Resolve country + ISO
        const countries: string[] = job.tags_location_80k || job.tags_country || [];
        const africanTag = countries.find(c => AFRICA_TAGS.includes(c));
        if (!africanTag) { totalSkipped++; continue; }

        const iso = AFRICA_ISO[africanTag] || 'KE';
        const city = (job.tags_city || [])[0] || africanTag;

        const jobId   = String(job.objectID || job.post_pk || '');
        if (!jobId) continue;

        const title   = job.title || 'Untitled';
        const org     = job.company_name || '80,000 Hours Partner';
        const sector  = mapSector(job.tags_area || []);
        const type    = mapType(job.tags_role_type || []);

        const deadline = job.closes_at
          ? new Date(job.closes_at * 1000).toISOString().split('T')[0]
          : null;
        const posted = job.posted_at
          ? new Date(job.posted_at * 1000).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0];

        const bodyText = stripHtml(job.description_short || '');
        const { description, salary } = await formatWithClaude(title, org, bodyText);

        const result = await supabase.from('listings').upsert({
          id:           `80k-${jobId}`,
          title,
          organisation: org,
          type,
          sector,
          location:     city,
          country:      iso,
          deadline,
          posted,
          salary:       job.salary || salary,
          description, apply_url:    applyUrl,
          experience:   (job.tags_exp_required || []).join(', ') || null,
          org_domain:   'jobs.80000hours.org',
          source:       '80,000 Hours',
          views:        0,
          apply_clicks: 0,
          paid_listing: false,
        }, { onConflict: 'id', ignoreDuplicates: false });

        if (result?.error) { console.error(`[80khours-scraper] Upsert: ${result.error.message}`); totalSkipped++; }
        else totalImported++;

        await new Promise(r => setTimeout(r, 150));
      }

      if (page + 1 >= pages) break;
      page++;
      await new Promise(r => setTimeout(r, 300));
    }

    console.log(`[80khours-scraper] Done. Imported: ${totalImported}, Skipped: ${totalSkipped}`);
    return Response.json({ imported: totalImported, skipped: totalSkipped });

  } catch (err) {
    console.error('[80khours-scraper] UNCAUGHT:', (err as Error).message);
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
});
