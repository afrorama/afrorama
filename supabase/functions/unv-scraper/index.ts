/**
 * Afrorama — unv-scraper Edge Function
 *
 * Fetches volunteer opportunities from the UNV platform and upserts
 * African postings into the Supabase listings table.
 *
 * Deploy:
 *   supabase functions deploy unv-scraper
 *
 * Schedule daily:
 *   SELECT cron.schedule('unv-daily', '0 8 * * *', $$SELECT net.http_post(...)$$);
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const DISCLAIMER = '\n\n─────────────────────────────────────\nThis summary is automatically generated for quick reference. For the complete and authoritative job description, please view the original posting.';

// African country ISO2 codes (from item.country.props.codeISO2)
const AFRICA_ISO = new Set([
  'KE','ZA','NG','SN','ET','GH','TZ','UG','RW','ZM','MZ','MW','ZW','BW','NA',
  'CM','CI','BF','ML','NE','TD','SD','SS','SO','CD','CG','AO','BJ','BI','CV',
  'CF','KM','DJ','EG','GQ','ER','SZ','GA','GM','GN','GW','LS','LR','LY','MG',
  'MR','MU','MA','ST','SL','TG','TN',
]);

// African country display names (item.country.label) — lowercase for matching
const AFRICA_LABELS_LOWER = new Set([
  'kenya','south africa','nigeria','senegal','ethiopia','ghana','tanzania',
  'uganda','rwanda','zambia','mozambique','malawi','zimbabwe','botswana',
  'namibia','cameroon',"côte d'ivoire","cote d'ivoire",'ivory coast',
  'burkina faso','mali','niger','chad','sudan','south sudan','somalia',
  'democratic republic of the congo','dr congo','drc','congo',
  'republic of the congo','angola','benin','burundi','cabo verde','cape verde',
  'central african republic','comoros','djibouti','egypt',
  'equatorial guinea','eritrea','eswatini','swaziland','gabon','gambia',
  'the gambia','guinea','guinea-bissau','lesotho','liberia','libya',
  'madagascar','mauritania','mauritius','morocco',
  'são tomé and príncipe','sao tome and principe',
  'sierra leone','togo','tunisia','united republic of tanzania',
  'tanzania, united republic of',
]);

// ISO2 → canonical display name
const ISO_TO_NAME: Record<string, string> = {
  'KE':'Kenya','ZA':'South Africa','NG':'Nigeria','SN':'Senegal','ET':'Ethiopia',
  'GH':'Ghana','TZ':'Tanzania','UG':'Uganda','RW':'Rwanda','ZM':'Zambia',
  'MZ':'Mozambique','MW':'Malawi','ZW':'Zimbabwe','BW':'Botswana','NA':'Namibia',
  'CM':'Cameroon','CI':"Côte d'Ivoire",'BF':'Burkina Faso','ML':'Mali','NE':'Niger',
  'TD':'Chad','SD':'Sudan','SS':'South Sudan','SO':'Somalia',
  'CD':'Democratic Republic of the Congo','CG':'Congo','AO':'Angola','BJ':'Benin',
  'BI':'Burundi','CV':'Cabo Verde','CF':'Central African Republic','KM':'Comoros',
  'DJ':'Djibouti','EG':'Egypt','GQ':'Equatorial Guinea','ER':'Eritrea',
  'SZ':'Eswatini','GA':'Gabon','GM':'Gambia','GN':'Guinea','GW':'Guinea-Bissau',
  'LS':'Lesotho','LR':'Liberia','LY':'Libya','MG':'Madagascar','MR':'Mauritania',
  'MU':'Mauritius','MA':'Morocco','ST':'São Tomé and Príncipe','SL':'Sierra Leone',
  'TG':'Togo','TN':'Tunisia',
};

/**
 * UNV country field structure:
 * { label: "Kenya", props: { codeISO2: "KE" }, ... }
 *
 * Returns { name, iso } if African, or null.
 */
function resolveAfricanCountry(countryField: any): { name: string; iso: string } | null {
  if (!countryField) return null;

  const iso2: string = (countryField.props?.codeISO2 || '').toUpperCase();
  const label: string = countryField.label || countryField.shortDescription || '';

  // ISO2 code check (most reliable)
  if (iso2 && AFRICA_ISO.has(iso2)) {
    return { name: ISO_TO_NAME[iso2] || label || iso2, iso: iso2 };
  }

  // Label check (case-insensitive)
  if (label && AFRICA_LABELS_LOWER.has(label.toLowerCase())) {
    return { name: label, iso: iso2 || 'KE' };
  }

  return null;
}

/** Extract label string from a UNV enum field (object or plain string) */
function enumLabel(field: any): string {
  if (!field) return '';
  if (typeof field === 'string') return field;
  return field.label || field.shortDescription || field.name || '';
}

/**
 * UNV's search API has no free-text description field at all — build a real,
 * specific summary from the structured fields it does provide, rather than
 * passing an empty string (which would otherwise always trigger the generic
 * boilerplate fallback in formatWithClaude).
 */
function buildStructuredSummary(item: any, org: string, city: string, category: string): string {
  const expertiseAreas = (item.expertiseAreas || []).map((e: any) => enumLabel(e)).filter(Boolean).join(', ');
  const workArrangement   = enumLabel(item.workArrangement);
  const assignmentDuration = enumLabel(item.assignmentDuration);
  const volunteerType      = enumLabel(item.volunteerType);
  const durationMonths     = item.duration ? Math.round(item.duration / 30) : null;

  const parts: string[] = [];
  parts.push(`${org} is recruiting a UN Volunteer in ${category || 'a specialist'} role, based in ${city || 'the field'}.`);
  if (expertiseAreas) parts.push(`Areas of expertise: ${expertiseAreas}.`);
  if (workArrangement) parts.push(`Work arrangement: ${workArrangement}.`);
  if (assignmentDuration) parts.push(`Assignment type: ${assignmentDuration}${durationMonths ? ` (approx. ${durationMonths} months)` : ''}.`);
  if (volunteerType) parts.push(`Volunteer category: ${volunteerType}.`);
  return parts.join(' ');
}

const SECTOR_MAP: Record<string, string> = {
  'health':                  'Health',
  'education':               'Education',
  'environment':             'Climate & Environment',
  'climate':                 'Climate & Environment',
  'finance':                 'Finance & Economics',
  'economic':                'Finance & Economics',
  'gender':                  'Gender & Social Inclusion',
  'human rights':            'Human Rights',
  'protection':              'Human Rights',
  'agriculture':             'Agriculture & Food Security',
  'food':                    'Agriculture & Food Security',
  'technology':              'Innovation & Technology',
  'ict':                     'Innovation & Technology',
  'infrastructure':          'Infrastructure & Urban Development',
  'urban':                   'Infrastructure & Urban Development',
  'governance':              'Governance & Public Policy',
  'peace':                   'Human Rights',
  'rule of law':             'Human Rights',
  'youth':                   'Gender & Social Inclusion',
};

function mapSector(category: string): string {
  if (!category) return 'Governance & Public Policy';
  const lower = category.toLowerCase();
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

// Uses real lines from the actual posting rather than fabricated, generic
// "responsibilities" — when AI summarisation isn't available, it's more
// honest to show less than to invent content that didn't come from the org.
function fallbackDesc(bodyText: string, org?: string): string {
  const lines = (bodyText || '')
    .split('\n')
    .map(l => l.trim().replace(/^[-•*–·]\s*/, ''))
    .filter(l => l.length > 30)
    .slice(0, 3);
  if (lines.length === 0) {
    return `${org || 'This organisation'} has posted this opportunity, but the description could not be automatically summarised. Please view the original posting for full details.${DISCLAIMER}`;
  }
  return lines.map(l => `• ${l.charAt(0).toUpperCase() + l.slice(1)}`).join('\n') + DISCLAIMER;
}

async function formatWithClaude(title: string, org: string, description: string): Promise<{ description: string; salary: string }> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    console.error('[unv-scraper formatWithClaude] ANTHROPIC_API_KEY is not set — falling back');
    return { description: fallbackDesc(description, org), salary: 'Volunteer role' };
  }
  if (!description || description.length < 80) {
    console.error(`[unv-scraper formatWithClaude] description too short (${description?.length ?? 0} chars) — falling back`);
    return { description: fallbackDesc(description, org), salary: 'Volunteer role' };
  }

  const prompt = `You are writing a job summary for Afrorama, Africa's social impact job board. Format the volunteer role description below in British English.

Task 1 — Write exactly 5 bullet points:
- Bullet 1 must be drawn directly from the opening or overview — capture what the role is actually about
- Bullets 2–5 must each begin with a strong imperative verb (e.g. Lead, Manage, Develop, Coordinate, Deliver, Foster, Build, Drive)
- Parallel imperative structure, addressing the reader directly
- Concise and action-oriented — no fluff, no passive voice
- British English spelling (organise, programme, analyse, prioritise)

Task 2 — Extract any living allowance or stipend:
- UNV roles often mention a Volunteer Living Allowance (VLA) or stipend — extract it if mentioned (e.g. "USD 1,200/month VLA")
- Also look for grade references (P3, G5, NOA), "Competitive", or any compensation clue
- If none mentioned, write: Volunteer role

Role: ${title} with ${org}

Description:
${description.slice(0, 2000)}

Return in this exact format:
BULLETS:
• [bullet 1]
• [bullet 2]
• [bullet 3]
• [bullet 4]
• [bullet 5]
SALARY: [allowance or Volunteer role]`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      console.error(`[unv-scraper formatWithClaude] Anthropic API returned ${res.status}: ${errBody.slice(0, 300)}`);
      return { description: fallbackDesc(description, org), salary: 'Volunteer role' };
    }

    const data        = await res.json() as { content: { text: string }[] };
    const raw         = data.content?.[0]?.text?.trim() || '';
    const bulletMatch = raw.match(/BULLETS:\s*([\s\S]*?)(?=SALARY:|$)/i);
    const salaryMatch = raw.match(/SALARY:\s*(.+)/i);

    const bullets   = bulletMatch?.[1]?.trim() || fallbackDesc(description, org);
    const salaryRaw = salaryMatch?.[1]?.trim() || 'Volunteer role';

    return { description: bullets + DISCLAIMER, salary: salaryRaw };
  } catch (err) {
    console.error(`[unv-scraper formatWithClaude] Exception calling Anthropic API: ${err instanceof Error ? err.message : String(err)}`);
    return { description: fallbackDesc(description, org), salary: 'Volunteer role' };
  }
}

Deno.serve(async () => {
  console.log('[unv-scraper] Starting...');

  try {
    const PAGE_SIZE = 100;
    let skip = 0, totalImported = 0, totalSkipped = 0, totalFiltered = 0;
    let totalAvailable = 999;

    while (skip < totalAvailable) {
      let res: Response;
      try {
        res = await fetch(
          'https://app.unv.org/api/doa/doa/SearchDoaAsyncByAzureCognitive',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept':       'application/json, text/plain, */*',
              'Origin':       'https://app.unv.org',
              'Referer':      'https://app.unv.org/',
              'User-Agent':   'Mozilla/5.0 (compatible; Afrorama/1.0)',
            },
            body: JSON.stringify({ take: PAGE_SIZE, skip }),
          },
        );
      } catch (err) {
        console.error('[unv-scraper] Fetch error:', (err as Error).message);
        break;
      }

      if (!res.ok) {
        const errText = await res.text();
        console.error(`[unv-scraper] API error: ${res.status} — ${errText.slice(0, 200)}`);
        break;
      }

      let json: any;
      try { json = await res.json(); } catch (err) {
        console.error('[unv-scraper] JSON parse error:', (err as Error).message);
        break;
      }

      if (!json?.isSuccess) {
        console.error('[unv-scraper] isSuccess false:', JSON.stringify(json).slice(0, 300));
        break;
      }

      const page     = json.value;
      if (!page) { console.error('[unv-scraper] json.value missing'); break; }

      totalAvailable = page.total || 0;
      const items: any[] = page.result || [];
      console.log(`[unv-scraper] Page skip=${skip}: ${items.length} items (total ${totalAvailable})`);

      for (const item of items) {
        // Country: { label: "Kenya", props: { codeISO2: "KE" }, ... }
        const country = resolveAfricanCountry(item.country);
        if (!country) { totalFiltered++; continue; }

        const id = String(item.id || '');
        if (!id) continue;

        // Confirmed field names from UNV API
        const title    = item.name || 'Untitled';
        const org      = item.hostEntity?.name || item.hostEntity?.shortName || 'United Nations Volunteers';
        const city     = enumLabel(item.workLocation);
        const category = enumLabel(item.categoryName);
        const sector   = mapSector(category);

        // UNV's search API has no expectedEndDate/endDate — sourcingEndDate
        // (the date UNV stops accepting candidates) is the real deadline signal.
        const deadlineRaw = item.sourcingEndDate;
        const deadline    = deadlineRaw
          ? new Date(deadlineRaw).toISOString().split('T')[0]
          : null;
        if (deadline && new Date(deadline) < new Date()) {
          console.log(`[unv-scraper] ${org} job ${id}: skipping expired posting (closed ${deadline})`);
          continue;
        }

        const postedRaw = item.publishDate || item.startDate;
        const posted    = postedRaw
          ? new Date(postedRaw).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0];

        const applyUrl   = `https://app.unv.org/opportunities/${id}`;
        // No free-text description field exists in this API at all — build
        // a real structured summary from the fields that are available.
        const rawDesc    = stripHtml(item.taskDescription || item.description || '')
          || buildStructuredSummary(item, org, city, category);
        const experience = item.minimumAge ? `${item.minimumAge}+ years old` : null;

        const { description, salary } = await formatWithClaude(title, org, rawDesc);

        const entry = {
          id:           `unv-${id}`,
          title,
          organisation: org,
          type:         'internship',
          sector,
          location:     city || country.name,
          country:      country.iso,
          deadline,
          posted,
          salary,
          description, apply_url:    applyUrl,
          experience,
          org_domain:   null,
          source:       'UNV',
          views:        0,
          apply_clicks: 0,
          paid_listing: false,
        };

        const { error } = await supabase
          .from('listings')
          .upsert(entry, { onConflict: 'id', ignoreDuplicates: false });

        if (error) { console.error('[unv-scraper] Upsert error:', error.message); totalSkipped++; }
        else totalImported++;

        await new Promise(r => setTimeout(r, 100));
      }

      skip += PAGE_SIZE;
      if (items.length < PAGE_SIZE) break;
      await new Promise(r => setTimeout(r, 500));
    }

    console.log(`[unv-scraper] Done. Imported: ${totalImported}, Filtered (non-Africa): ${totalFiltered}, Errors: ${totalSkipped}`);
    return Response.json({ imported: totalImported, filtered: totalFiltered, errors: totalSkipped });

  } catch (topErr) {
    console.error('[unv-scraper] UNCAUGHT ERROR:', (topErr as Error).message, (topErr as Error).stack);
    return Response.json({ error: (topErr as Error).message }, { status: 500 });
  }
});
