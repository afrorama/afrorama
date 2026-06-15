/**
 * Afrorama — bitly-link Edge Function
 *
 * Creates a Bitly short URL for an opportunity listing.
 * Automatically appends utm_source=afrorama parameters.
 *
 * Deploy:
 *   supabase functions deploy bitly-link
 *
 * Required secret:
 *   supabase secrets set BITLY_TOKEN=your_bitly_access_token
 *
 * Get your Bitly token: bitly.com → Settings → Developer → API → Generate Token
 *
 * Example request:
 *   POST https://YOUR_PROJECT.supabase.co/functions/v1/bitly-link
 *   Authorization: Bearer YOUR_ANON_KEY
 *   Content-Type: application/json
 *
 *   {
 *     "listing_id":   "seed-1",
 *     "title":        "Programme Officer – Climate",
 *     "organisation": "UNDP",
 *     "apply_url":    "https://jobs.undp.org/xyz",   ← optional, falls back to Afrorama listing page
 *     "group_guid":   "Bxxxxxxxx"                     ← optional, your Bitly group GUID
 *   }
 *
 * Returns:
 *   { "short_url": "https://bit.ly/xxxxxx", "long_url": "...", "id": "bit.ly/xxxxxx" }
 */

const SITE_URL = 'https://afrorama.org';

const cors = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

  const token = Deno.env.get('BITLY_TOKEN');
  if (!token) {
    return Response.json(
      { error: 'BITLY_TOKEN secret not set. Run: supabase secrets set BITLY_TOKEN=your_token' },
      { status: 500, headers: cors },
    );
  }

  try {
    const { listing_id, title, organisation, apply_url, group_guid } = await req.json() as {
      listing_id:   string;
      title?:       string;
      organisation?: string;
      apply_url?:   string;
      group_guid?:  string;
    };

    if (!listing_id) {
      return Response.json({ error: 'listing_id is required' }, { status: 400, headers: cors });
    }

    // Build the UTM-tagged long URL
    const campaign = (organisation || 'afrorama').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const content  = (title || 'job').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 40);

    const longUrl = apply_url
      ? `${apply_url}${apply_url.includes('?') ? '&' : '?'}utm_source=afrorama&utm_medium=jobboard&utm_campaign=${campaign}&utm_content=${content}`
      : `${SITE_URL}/opportunities.html?id=${encodeURIComponent(listing_id)}&utm_source=afrorama&utm_medium=jobboard&utm_campaign=${campaign}&utm_content=${content}`;

    // Call Bitly API v4
    const body: Record<string, unknown> = { long_url: longUrl, domain: 'bit.ly' };
    if (group_guid) body.group_guid = group_guid;

    const bitlyRes = await fetch('https://api-ssl.bitly.com/v4/shorten', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!bitlyRes.ok) {
      const err = await bitlyRes.json().catch(() => ({}));
      throw new Error(`Bitly API error ${bitlyRes.status}: ${(err as any).description || bitlyRes.statusText}`);
    }

    const data = await bitlyRes.json() as { id: string; link: string; long_url: string };

    // Optionally persist the short URL to the listing in Supabase
    // (uncomment once the listings table is set up)
    // const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    // await supabase.from('listings').update({ bitly_url: data.link, utm_url: longUrl }).eq('id', listing_id);

    return Response.json(
      { short_url: data.link, long_url: longUrl, id: data.id, listing_id },
      { headers: cors },
    );

  } catch (err) {
    console.error('[bitly-link]', err);
    return Response.json(
      { error: (err as Error).message },
      { status: 500, headers: cors },
    );
  }
});
