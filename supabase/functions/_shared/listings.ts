/**
 * Save a scraped listing without clobbering live data: new listings are
 * inserted with zeroed counters; existing ones are refreshed but keep their
 * posted date, views and apply_clicks.
 */
import { trySubmitSalary } from './currency.ts';

export interface ScrapedListing {
  id: string; title: string; organisation: string; type: string; sector: string;
  location: string; country: string; deadline: string | null; posted: string;
  salary: string; description: string; apply_url: string; org_domain: string; source: string;
}

// deno-lint-ignore no-explicit-any
export async function saveListing(supabase: any, l: ScrapedListing, opts: { submitSalary: boolean }): Promise<'inserted' | 'updated' | 'error'> {
  const { data: existing } = await supabase.from('listings').select('id').eq('id', l.id).maybeSingle();
  if (existing) {
    const { posted: _posted, ...fresh } = l;
    const { error } = await supabase.from('listings').update(fresh).eq('id', l.id);
    if (error) { console.error(`[saveListing] update ${l.id}: ${error.message}`); return 'error'; }
    return 'updated';
  }
  const { error } = await supabase.from('listings').insert({
    ...l, experience: null, views: 0, apply_clicks: 0, paid_listing: false,
  });
  if (error) { console.error(`[saveListing] insert ${l.id}: ${error.message}`); return 'error'; }
  // Salary Intelligence: once per listing, and only for Africa-based pay
  if (opts.submitSalary) {
    await trySubmitSalary(supabase, {
      company: l.organisation, position: l.title, salaryText: l.salary,
      experienceText: null, sector: l.sector, country: l.country,
    });
  }
  return 'inserted';
}
