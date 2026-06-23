/**
 * Afrorama — scrape-url Edge Function
 *
 * Admin tool support: takes an arbitrary job-posting URL, fetches it
 * server-side (avoids browser CORS issues with arbitrary external sites),
 * strips it to plain text, and asks Claude to extract a structured draft
 * (title, organisation, sector, country, deadline, salary, description...).
 * Returns the draft for human review in admin-scrape.html — nothing is
 * written to the database here.
 *
 * Deploy: supabase functions deploy scrape-url
 */

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const SECTORS = [
  'Agriculture & Food Security', 'Climate & Environment', 'Education',
  'Finance & Economics', 'Gender & Social Inclusion', 'Governance & Public Policy',
  'Health', 'Human Rights', 'Infrastructure & Urban Development',
  'Innovation & Technology', 'Peacebuilding', 'Private Sector Development',
  'Youth & Employment',
];

function stripHtml(html: string): string {
  return (html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/?(li|p|br|h[1-6]|div|tr)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return Response.json({ error: 'POST only' }, { status: 405, headers: CORS });

  try {
    const { url } = await req.json();
    if (!url || typeof url !== 'string') {
      return Response.json({ error: 'A url is required.' }, { status: 400, headers: CORS });
    }

    const pageRes = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AfroramaBot/1.0)' },
    });
    if (!pageRes.ok) {
      return Response.json({ error: `Could not fetch URL (status ${pageRes.status}). LinkedIn and some sites block automated requests — try pasting the text directly instead.` }, { status: 400, headers: CORS });
    }
    const html = await pageRes.text();
    const bodyText = stripHtml(html).slice(0, 9000);

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      return Response.json({ error: 'ANTHROPIC_API_KEY not configured.' }, { status: 500, headers: CORS });
    }

    const prompt = `You are extracting structured job-posting data for Afrorama, Africa's social impact job board. Read the page text below (scraped from ${url}) and extract the role details.

Return STRICT JSON only, no markdown, matching this exact shape:
{
  "title": string,
  "organisation": string,
  "type": "jobs" | "internship" | "consultancy" | "capacity",
  "sector": one of [${SECTORS.map(s => `"${s}"`).join(', ')}],
  "location": string (city, or "Remote"),
  "country": string (full country name, best guess — prefer an African country if the role is Africa-based),
  "deadline": string in YYYY-MM-DD format, or null if no deadline is stated,
  "salary": string (exact compensation text if stated, e.g. "USD 50k/year" or "Competitive" or "Not specified"),
  "description": string (2-4 sentences in your own words covering what the role involves and key responsibilities — do NOT bullet it, plain prose),
  "requirements": string (2-4 sentences covering qualifications and experience needed — plain prose),
  "apply_url": string (the most likely direct application link found in the text, or "${url}" if none found)
}

If a field genuinely cannot be determined from the text, use null for deadline or "Not specified" for salary — do not fabricate specifics, but you can use your own concise wording for description/requirements as long as it's grounded in the actual text.

PAGE TEXT:
${bodyText}`;

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!aiRes.ok) {
      return Response.json({ error: `Claude request failed: ${await aiRes.text()}` }, { status: 502, headers: CORS });
    }

    const aiData = await aiRes.json() as { content: { text: string }[] };
    const raw = aiData.content?.[0]?.text?.trim() || '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return Response.json({ error: 'Could not parse a structured listing from this page.' }, { status: 422, headers: CORS });
    }

    const draft = JSON.parse(jsonMatch[0]);
    return Response.json({ draft }, { headers: CORS });

  } catch (err) {
    console.error('[scrape-url] Error:', (err as Error).message);
    return Response.json({ error: (err as Error).message }, { status: 500, headers: CORS });
  }
});
