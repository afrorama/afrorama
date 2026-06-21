/**
 * Afrorama — format-listing Edge Function
 *
 * Takes a user-submitted job posting (post.html) and formats it into the
 * same 5-bullet-point style used for scraped listings, so paid direct
 * postings look consistent with the rest of the board.
 *
 * POST body: { title: string, organisation: string, description: string, requirements: string }
 * Response:  { description: string }
 *
 * Deploy: supabase functions deploy format-listing
 */

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const DISCLAIMER = '\n\n─────────────────────────────────────\nThis summary is automatically generated for quick reference. For the complete and authoritative job description, please view the original posting.';

function fallbackDesc(description: string, requirements: string): string {
  const lines = [description, requirements].filter(Boolean);
  return lines.map(l => `• ${l}`).join('\n') + DISCLAIMER;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return Response.json({ error: 'POST only' }, { status: 405, headers: CORS });

  try {
    const { title, organisation, description, requirements } = await req.json() as {
      title: string; organisation: string; description: string; requirements: string;
    };

    const combined = [description, requirements].filter(Boolean).join('\n\n');
    if (!combined || combined.length < 20) {
      return Response.json({ description: fallbackDesc(description, requirements) }, { headers: CORS });
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      console.error('[format-listing] ANTHROPIC_API_KEY is not set — falling back');
      return Response.json({ description: fallbackDesc(description, requirements) }, { headers: CORS });
    }

    const prompt = `You are writing a job summary for Afrorama, Africa's social impact job board. Format the role description and requirements below into British English.

Task — Write exactly 5 bullet points:
- Bullet 1 must be drawn directly from the role description — capture what the role is actually about
- Bullets 2–5 must each begin with a strong imperative verb (e.g. Lead, Manage, Develop, Coordinate, Deliver, Foster, Build, Drive)
- At least one bullet must reflect the requirements/qualifications provided
- Parallel imperative structure, addressing the reader directly
- Concise and action-oriented — no fluff, no passive voice
- British English spelling (organise, programme, analyse, prioritise)

Job: ${title} at ${organisation}

Role description:
${description}

Requirements:
${requirements}

Return in this exact format:
BULLETS:
• [bullet 1]
• [bullet 2]
• [bullet 3]
• [bullet 4]
• [bullet 5]`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':          apiKey,
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
      console.error(`[format-listing] Anthropic API returned ${res.status}: ${errBody.slice(0, 300)}`);
      return Response.json({ description: fallbackDesc(description, requirements) }, { headers: CORS });
    }

    const data        = await res.json() as { content: { text: string }[] };
    const raw         = data.content?.[0]?.text?.trim() || '';
    const bulletMatch = raw.match(/BULLETS:\s*([\s\S]*)/i);
    const bullets     = bulletMatch?.[1]?.trim() || fallbackDesc(description, requirements);

    return Response.json({ description: bullets + DISCLAIMER }, { headers: CORS });
  } catch (err) {
    console.error(`[format-listing] Exception: ${err instanceof Error ? err.message : String(err)}`);
    return Response.json({ error: 'Formatting failed' }, { status: 500, headers: CORS });
  }
});
