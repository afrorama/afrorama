/**
 * Afrorama — backfill-unv-salaries Edge Function (one-off)
 *
 * Fixes a bug in parseSalaryToUSD (now corrected in _shared/currency.ts):
 * it used to flag any salary text containing the word "volunteer" as
 * unpaid *before* checking whether a real figure was present, so UN
 * Volunteer (UNV) assignments with a genuine Volunteer Living Allowance
 * were recorded as $0/unpaid in salary_submissions.
 *
 * This re-parses the salary text on every listing scraped by unv-scraper
 * (source = 'UNV') with the fixed parser, and updates the matching
 * salary_submissions row (joined by company + position + country, since
 * there is no FK between the two tables) wherever a real figure now comes
 * out. Rows that genuinely have no allowance stay unpaid.
 *
 * One-off: deploy, invoke once, then delete.
 *   supabase functions deploy backfill-unv-salaries
 *   curl -X POST https://<project>.supabase.co/functions/v1/backfill-unv-salaries \
 *     -H "apikey: <anon key>" -H "Authorization: Bearer <anon key>"
 *   supabase functions delete backfill-unv-salaries
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { parseSalaryToUSD } from '../_shared/currency.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
};

const PAGE = 1000;

interface Listing { organisation: string; title: string; country: string; salary: string | null }
interface Submission { id: string; company: string; position: string; country: string }

async function fetchAllListings(): Promise<Listing[]> {
  const rows: Listing[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('listings')
      .select('organisation,title,country,salary')
      .eq('source', 'UNV')
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`listings: ${error.message}`);
    const page = (data ?? []) as Listing[];
    rows.push(...page);
    if (page.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

async function fetchAllUnpaidSubmissions(): Promise<Submission[]> {
  const rows: Submission[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('salary_submissions')
      .select('id,company,position,country')
      .eq('unpaid', true)
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`salary_submissions: ${error.message}`);
    const page = (data ?? []) as Submission[];
    rows.push(...page);
    if (page.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  try {
    const [listings, subs] = await Promise.all([
      fetchAllListings(),
      fetchAllUnpaidSubmissions(),
    ]);

    // Index UNV listings by company|position|country — same fields trySubmitSalary
    // was called with, in the same scraper run, so this join is exact.
    const bySig = new Map<string, string>();
    for (const l of listings) {
      if (!l.salary) continue;
      const sig = `${l.organisation}|${l.title}|${l.country}`.toLowerCase();
      if (!bySig.has(sig)) bySig.set(sig, l.salary);
    }

    let matched = 0;
    const updates: { id: string; salary: number }[] = [];

    for (const s of subs) {
      const sig = `${s.company}|${s.position}|${s.country}`.toLowerCase();
      const salaryText = bySig.get(sig);
      if (!salaryText) continue;
      matched++;

      const parsed = parseSalaryToUSD(salaryText);
      if (parsed && !parsed.unpaid) {
        updates.push({ id: s.id, salary: parsed.amountUSD });
      }
    }

    let fixed = 0;
    const failures: string[] = [];
    for (const u of updates) {
      const { error } = await supabase
        .from('salary_submissions')
        .update({ salary: u.salary, unpaid: false })
        .eq('id', u.id);
      if (error) failures.push(`${u.id}: ${error.message}`);
      else fixed++;
    }

    return Response.json({
      unvListings:     listings.length,
      unpaidScanned:   subs.length,
      matchedToUnvJob: matched,
      fixed,
      stillUnpaid:     matched - fixed - failures.length,
      failures:        failures.slice(0, 10),
    }, { headers: CORS });

  } catch (err) {
    console.error('[backfill-unv-salaries] Error:', (err as Error).message);
    return Response.json({ error: (err as Error).message }, { status: 500, headers: CORS });
  }
});
