/**
 * Afrorama — bitly-linker Edge Function
 *
 * Finds listings with no bitly_url, shortens their UTM-tagged apply URL
 * via the Bitly API, and saves the result back to the listings table.
 *
 * Run manually or schedule daily after scrapers:
 *   SELECT cron.schedule('bitly-daily', '0 14 * * *', $$SELECT net.http_post(...)$$);
 *
 * Bitly free plan: 10,000 bit.ly links/month — well within limits.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const BITLY_TOKEN = Deno.env.get('BITLY_TOKEN');

/** Build the UTM-tagged URL that the Bitly link should resolve to */
function buildUtmUrl(listing: any): string | null {
  const dest = listing.apply_url;
  if (!dest || dest === '#') return null;

  const campaign = (listing.organisation || 'afrorama')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50);
  const content = (listing.title || 'job')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50);

  const sep = dest.includes('?') ? '&' : '?';
  return `${dest}${sep}utm_source=afrorama&utm_medium=jobboard&utm_campaign=${encodeURIComponent(campaign)}&utm_content=${encodeURIComponent(content)}`;
}

/** Call the Bitly API to shorten a URL */
async function shorten(longUrl: string): Promise<string | null> {
  if (!BITLY_TOKEN) return null;

  try {
    const res = await fetch('https://api-ssl.bitly.com/v4/shorten', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${BITLY_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ long_url: longUrl, domain: 'bit.ly' }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.warn(`[bitly-linker] Bitly error ${res.status}: ${err.slice(0, 150)}`);
      return null;
    }

    const data = await res.json() as { link: string };
    return data.link || null;
  } catch (err) {
    console.warn('[bitly-linker] Fetch error:', (err as Error).message);
    return null;
  }
}

Deno.serve(async (req) => {
  console.log('[bitly-linker] Starting...');

  if (!BITLY_TOKEN) {
    return Response.json({ error: 'BITLY_TOKEN secret not set' }, { status: 500 });
  }

  // How many to process per run (stay well under Bitly rate limits)
  const limit = parseInt(new URL(req.url).searchParams.get('limit') || '100', 10);

  // Fetch listings that don't yet have a Bitly link and have a valid apply_url
  const { data: listings, error } = await supabase
    .from('listings')
    .select('id, title, organisation, apply_url')
    .is('bitly_url', null)
    .not('apply_url', 'is', null)
    .neq('apply_url', '')
    .neq('apply_url', '#')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[bitly-linker] Query error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }

  console.log(`[bitly-linker] ${listings?.length ?? 0} listings need Bitly links`);

  let created = 0, skipped = 0, failed = 0;

  for (const listing of listings ?? []) {
    const utmUrl = buildUtmUrl(listing);
    if (!utmUrl) { skipped++; continue; }

    const bitlyUrl = await shorten(utmUrl);
    if (!bitlyUrl) { failed++; continue; }

    const { error: updateErr } = await supabase
      .from('listings')
      .update({ bitly_url: bitlyUrl })
      .eq('id', listing.id);

    if (updateErr) {
      console.error(`[bitly-linker] Update error for ${listing.id}:`, updateErr.message);
      failed++;
    } else {
      console.log(`[bitly-linker] ${listing.id} → ${bitlyUrl}`);
      created++;
    }

    // Bitly free tier: ~3 req/sec is safe
    await new Promise(r => setTimeout(r, 350));
  }

  console.log(`[bitly-linker] Done. Created: ${created}, Skipped: ${skipped}, Failed: ${failed}`);
  return Response.json({ created, skipped, failed });
});
