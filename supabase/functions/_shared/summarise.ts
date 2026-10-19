/**
 * Shared job-summary helpers for scrapers: HTML → text, the Claude bullet
 * summary + salary extraction, and sector / type guesses.
 */
import { sanitizeBullets, sanitizeSalary } from './claude.ts';

export const DISCLAIMER = '\n\n─────────────────────────────────────\nThis summary is automatically generated for quick reference. For the complete and authoritative job description, please view the original posting.';

export function stripHtml(html: string): string {
  return (html || '')
    .replace(/<\/?(li|p|br|h[1-6]|div|tr)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;|&#8217;|&rsquo;/g, "'").replace(/&quot;|&#8220;|&#8221;/g, '"').replace(/&#8212;/g, '—').replace(/&#8211;|&ndash;/g, '–')
    .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function fallbackDesc(bodyText: string, org: string): string {
  const lines = (bodyText || '').split('\n')
    .map(l => l.trim().replace(/^[-•*–·]\s*/, ''))
    .filter(l => l.length > 30).slice(0, 3);
  if (!lines.length) {
    return `${org} has posted this opportunity, but the description could not be automatically summarised. Please view the original posting for full details.${DISCLAIMER}`;
  }
  return lines.map(l => `• ${l.charAt(0).toUpperCase() + l.slice(1)}`).join('\n') + DISCLAIMER;
}

/** The employer's own pay line: mentions pay AND contains a money amount. */
export function findPayLine(bodyText: string): string | null {
  const line = (bodyText || '').split('\n').find(l =>
    /salary|compensation|\bpay\b|stipend|remuneration/i.test(l) &&
    /(?:[$€£]|\b(?:USD|EUR|GBP|KES|ZAR|NGN|GHS|UGX|TZS|RWF|INR)\s?)\d[\d,.]*/i.test(l));
  if (!line) return null;
  // Keep just the sentence that carries the figure
  const sentence = line.split(/(?<=[.;])\s+/).find(x => /\d/.test(x) && /[$€£]|\b[A-Z]{3}\s?\d/.test(x)) || line;
  return sentence.trim().replace(/^In compliance with [^,]+,\s*/i, '').replace(/^\w/, c => c.toUpperCase()).slice(0, 160);
}

/**
 * 5-bullet summary + salary. A pay line found in the text is used verbatim
 * (the summariser has been seen to convert $ to £); otherwise Claude's
 * extraction is used, or "See listing".
 */
export async function summariseJob(title: string, org: string, bodyText: string): Promise<{ description: string; salary: string }> {
  const payLine = findPayLine(bodyText);
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey || !bodyText || bodyText.length < 80) {
    return { description: fallbackDesc(bodyText, org), salary: payLine || 'See listing' };
  }
  // Only ~3,000 chars are sent; pay usually sits at the end, so carry it in
  const text = payLine && !bodyText.slice(0, 2700).includes(payLine)
    ? `${bodyText.slice(0, 2700)}\n\nCompensation: ${payLine}` : bodyText.slice(0, 3000);

  const prompt = `You are writing a job summary for Afrorama, Africa's social impact job board. Format the job description below in British English.

Task 1 — Write exactly 5 bullet points:
- Bullet 1 must be drawn directly from the opening or overview — capture what the role is actually about
- Bullets 2–5 must each begin with a strong imperative verb (e.g. Lead, Manage, Develop, Coordinate, Deliver, Foster, Build, Drive)
- Concise and action-oriented — no fluff, no passive voice
- British English spelling (organise, programme, analyse, prioritise)

Task 2 — Extract salary or compensation exactly as written, keeping the original currency and figures:
- Explicit figures ("USD 45,000–55,000/yr"), grades or bands (P3, Band C), or qualitative terms ("Competitive", "Commensurate with experience")
- Only write: none — if there is zero mention of pay, salary, stipend, grade, band or compensation

Job: ${title} at ${org}

Description:
${text}

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
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 400, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!res.ok) return { description: fallbackDesc(bodyText, org), salary: payLine || 'See listing' };
    const data = await res.json() as { content: { text: string }[] };
    const raw = data.content?.[0]?.text?.trim() || '';
    const fallback = fallbackDesc(bodyText, org);
    const bullets = sanitizeBullets(raw.match(/BULLETS:\s*([\s\S]*?)(?=SALARY:|$)/i)?.[1]?.trim() || '', '');
    const salary = payLine || sanitizeSalary(raw.match(/SALARY:\s*(.+)/i)?.[1]?.trim() || '');
    return { description: bullets ? bullets + DISCLAIMER : fallback, salary };
  } catch {
    return { description: fallbackDesc(bodyText, org), salary: payLine || 'See listing' };
  }
}

const SECTOR_MAP: [string, string][] = [
  ['agricultur', 'Agriculture & Food Security'], ['farmer', 'Agriculture & Food Security'], ['food', 'Agriculture & Food Security'],
  ['climate', 'Climate & Environment'], ['environment', 'Climate & Environment'],
  ['health', 'Health'], ['medical', 'Health'],
  ['education', 'Education'], ['school', 'Education'],
  ['gender', 'Gender & Social Inclusion'], ['women', 'Gender & Social Inclusion'],
  ['human rights', 'Human Rights'], ['legal', 'Human Rights'], ['justice', 'Human Rights'],
  ['finance', 'Finance & Economics'], ['grant', 'Finance & Economics'], ['econom', 'Finance & Economics'], ['accounting', 'Finance & Economics'],
  ['engineer', 'Innovation & Technology'], ['data', 'Innovation & Technology'], ['technology', 'Innovation & Technology'], ['product', 'Innovation & Technology'],
];

export function mapSector(text: string, fallback = 'Governance & Public Policy'): string {
  const lower = (text || '').toLowerCase();
  for (const [key, val] of SECTOR_MAP) if (lower.includes(key)) return val;
  return fallback;
}

export function mapType(title: string, employmentType = ''): string {
  const t = `${title} ${employmentType}`.toLowerCase();
  if (/intern|trainee/.test(t)) return 'internship';
  if (/fellow/.test(t)) return 'capacity';
  if (/consultan|contractor/.test(t)) return 'consultancy';
  return 'jobs';
}
