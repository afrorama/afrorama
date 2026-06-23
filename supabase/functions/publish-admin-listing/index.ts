/**
 * Afrorama — publish-admin-listing Edge Function
 *
 * Takes a human-reviewed listing draft (from admin-scrape.html, after a
 * scrape-url + manual edit pass) and publishes it directly to the live
 * `listings` table via the service role — bypassing the anon-insert
 * restriction safely, since this path is only reachable from the
 * password-gated admin page, not the public site.
 *
 * Also feeds Salary Intelligence: if the salary text parses to a real
 * number, a matching salary_submissions row is inserted too, same as the
 * automated scrapers do.
 *
 * Deploy: supabase functions deploy publish-admin-listing
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { parseSalaryToUSD } from '../_shared/currency.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const DISCLAIMER = '\n\n─────────────────────────────────────\nThis summary is automatically generated for quick reference. For the complete and authoritative job description, please view the original posting.';

async function formatDescription(title: string, org: string, description: string, requirements: string, howToApply: string): Promise<string> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  const combined = `${description}\n\n${requirements}`.trim();
  const applyLine = howToApply ? `\n• How to apply: ${howToApply}` : '';

  if (!apiKey || combined.length < 30) {
    const base = combined || 'No description provided.';
    return howToApply ? `${base}\n\nHow to apply: ${howToApply}` : base;
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{ role: 'user', content: `Format this job posting for Afrorama, Africa's social impact job board, in British English. Write exactly 5 bullet points: bullet 1 from the role overview, bullets 2-5 starting with a strong imperative verb, concise and action-oriented.\n\nJob: ${title} at ${org}\n\nDescription: ${description}\n\nRequirements: ${requirements}\n\nReturn only the 5 bullets, one per line, each starting with "• ".` }],
      }),
    });
    if (!res.ok) return combined + applyLine;
    const data = await res.json() as { content: { text: string }[] };
    const bullets = data.content?.[0]?.text?.trim();
    return bullets ? bullets + applyLine + DISCLAIMER : combined + applyLine;
  } catch {
    return combined + applyLine;
  }
}

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const {
      title, organisation, type, sector, location, country, deadline,
      salary, apply_url, description, requirements, paid_listing, contact_email, how_to_apply,
    } = body;

    if (!title || !organisation || !apply_url || !country) {
      return Response.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    const formattedDescription = await formatDescription(title, organisation, description || '', requirements || '', how_to_apply || '');
    const id = 'admin-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);

    const { error } = await supabase.from('listings').insert({
      id, title, organisation, type, sector, location, country,
      deadline: deadline || null,
      salary: salary || 'Not specified',
      apply_url,
      description: formattedDescription,
      requirements: requirements || null,
      contact_email: contact_email || null,
      posted: new Date().toISOString().split('T')[0],
      source: 'Admin',
      paid_listing: !!paid_listing,
      payment_confirmed: true,
      views: 0,
      apply_clicks: 0,
    });

    if (error) {
      console.error('[publish-admin-listing] Insert failed:', error.message);
      return Response.json({ error: error.message }, { status: 500 });
    }

    // Feed Salary Intelligence when a real number is present.
    const parsed = parseSalaryToUSD(salary);
    if (parsed) {
      await supabase.from('salary_submissions').insert({
        company: organisation,
        position: title,
        salary: parsed.amountUSD,
        unpaid: parsed.unpaid,
        years_exp: 'Not specified',
        sector,
        country,
        currency: 'USD',
        year: new Date().getFullYear(),
      });
    }

    return Response.json({ id });

  } catch (err) {
    console.error('[publish-admin-listing] Error:', (err as Error).message);
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
});
