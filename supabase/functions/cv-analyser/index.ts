/**
 * Afrorama — cv-analyser Edge Function
 *
 * Receives extracted CV text from the browser and uses Claude to
 * score it against Afrorama's 5 criteria. Returns per-criterion scores.
 *
 * POST body: { text: string, filename?: string }
 * Response:  { scores: { language, impact, summary, structure, tailoring }, total: number }
 */

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return Response.json({ error: 'POST only' }, { status: 405, headers: CORS });

  try {
    const { text, filename } = await req.json() as { text: string; filename?: string };

    if (!text || text.trim().length < 100) {
      return Response.json({ error: 'CV text too short — could not extract enough content from the file.' }, { status: 400, headers: CORS });
    }

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) {
      return Response.json({ error: 'ANTHROPIC_API_KEY not configured.' }, { status: 500, headers: CORS });
    }

    // Truncate to ~4000 chars for Haiku (enough for a full CV)
    const cvText = text.slice(0, 4000);

    const prompt = `You are an expert CV reviewer specialising in the African social impact sector. Analyse this CV thoroughly.

CV TEXT:
---
${cvText}
---

TASK 1 — PROFILE DETECTION
Identify: what type of professional is this person and what roles do they likely apply for?
Write one concise sentence, e.g. "Public health programme manager with experience in East Africa, likely targeting senior NGO roles in health systems or community health."

TASK 2 — MISSING ATS KEYWORDS
List exactly 10 specific ATS keywords that are NOT already in this CV but that recruiters in the relevant sector actively search for. These are the gaps — words the person should add to pass ATS filters for their target roles. Be precise: think tools, methodologies, certifications, competencies, and sector-specific terms relevant to their profile that are currently absent from the text above.
Format as a comma-separated list.

TASK 3 — SCORES (be strict, most CVs score 40–70/100)

1. ACTION + OUTCOME LANGUAGE (max 20 pts)
   Strong action verbs (Led, Designed, Built, Delivered) vs passive ("responsible for", "assisted with")? Do bullets answer "what changed because of me?"
   0–6=mostly passive | 7–13=mixed | 14–20=strong verbs with outcomes

2. QUANTIFIED ACHIEVEMENTS (max 25 pts)
   Numbers, %, budgets, headcounts, measurable results in bullets?
   0–8=no numbers | 9–17=some | 18–25=strong quantified impact throughout

3. PROFILE & CONTACT (max 15 pts)
   LinkedIn URL present? Professional summary at top?
   0–5=missing both | 6–10=has one | 11–15=has both, summary is clear and relevant

4. STRUCTURE & KEY SECTIONS (max 20 pts)
   Experience, Skills/Expertise, Education present? Voluntary/projects included? ATS-friendly format?
   0–6=major sections missing | 7–13=most present | 14–20=complete, ATS-ready

5. SECTOR RELEVANCE & ATS READINESS (max 20 pts)
   Social impact language (stakeholder engagement, programme management, M&E, beneficiaries, community development)?
   0–6=no sector language | 7–13=some terms | 14–20=clearly tailored to impact sector

TASK 4 — SPECIFIC BOOST TIPS
For each of the 3 lowest-scoring criteria, write ONE very specific, actionable tip based on what you actually saw in this CV. Reference specific sections, job titles, or content from their CV. Do not give generic advice.
Format: BOOST_[CRITERION]: [specific tip]
Criteria names: LANGUAGE, IMPACT, SUMMARY, STRUCTURE, TAILORING

Return in EXACTLY this format:
PROFILE: [one sentence]
KEYWORDS: [keyword1, keyword2, keyword3, keyword4, keyword5, keyword6, keyword7, keyword8, keyword9, keyword10]
LANGUAGE: [number]
IMPACT: [number]
SUMMARY: [number]
STRUCTURE: [number]
TAILORING: [number]
BOOST_[criterion]: [tip]
BOOST_[criterion]: [tip]
BOOST_[criterion]: [tip]`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 600,
        messages:   [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Claude error:', res.status, err.slice(0, 200));
      return Response.json({ error: 'Analysis failed — please try again.' }, { status: 500, headers: CORS });
    }

    const data = await res.json() as { content: { text: string }[] };
    const raw  = data.content?.[0]?.text?.trim() || '';
    console.log('Claude raw response:', raw);

    // Parse scores
    const extractNum = (key: string, max: number): number => {
      const m = raw.match(new RegExp(`^${key}:\\s*(\\d+)`, 'im'));
      const v = m ? parseInt(m[1], 10) : Math.floor(max * 0.45);
      return Math.min(max, Math.max(0, v));
    };

    const scores = {
      language:  extractNum('LANGUAGE',  20),
      impact:    extractNum('IMPACT',    25),
      summary:   extractNum('SUMMARY',   15),
      structure: extractNum('STRUCTURE', 20),
      tailoring: extractNum('TAILORING', 20),
    };
    const total = Object.values(scores).reduce((a, b) => a + b, 0);

    // Parse profile detection
    const profileMatch = raw.match(/^PROFILE:\s*(.+)/im);
    const profile = profileMatch?.[1]?.trim() || '';

    // Parse keywords
    const keywordsMatch = raw.match(/^KEYWORDS:\s*(.+)/im);
    const keywords = keywordsMatch?.[1]?.trim().split(',').map((k: string) => k.trim()).filter(Boolean) || [];

    // Parse specific boost tips
    const boostTips: Record<string, string> = {};
    const boostMatches = raw.matchAll(/^BOOST_(\w+):\s*(.+)/gim);
    for (const m of boostMatches) {
      boostTips[m[1].toLowerCase()] = m[2].trim();
    }

    return Response.json({ scores, total, profile, keywords, boostTips, filename: filename || 'CV' }, { headers: CORS });

  } catch (err) {
    console.error('cv-analyser error:', (err as Error).message);
    return Response.json({ error: (err as Error).message }, { status: 500, headers: CORS });
  }
});
