/**
 * Afrorama — link-tracker Edge Function
 *
 * Accepts any URL, adds UTM parameters, shortens via Bitly,
 * saves to the tracked_links table, and returns the short link.
 *
 * POST body:
 *   { url: string, title?: string, campaign?: string, medium?: string }
 *
 * Response:
 *   { bitly_url: string, utm_url: string, original_url: string }
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const BITLY_TOKEN = Deno.env.get('BITLY_TOKEN');

function buildUtmUrl(url: string, campaign: string, medium: string): string {
  try {
    const u   = new URL(url);
    u.searchParams.set('utm_source',   'afrorama');
    u.searchParams.set('utm_medium',   medium || 'share');
    if (campaign) u.searchParams.set('utm_campaign', campaign);
    return u.toString();
  } catch {
    // Fallback for URLs that don't parse cleanly
    const sep = url.includes('?') ? '&' : '?';
    const camp = campaign ? `&utm_campaign=${encodeURIComponent(campaign)}` : '';
    return `${url}${sep}utm_source=afrorama&utm_medium=${encodeURIComponent(medium || 'share')}${camp}`;
  }
}

async function shortenWithBitly(longUrl: string): Promise<string | null> {
  if (!BITLY_TOKEN) return null;
  try {
    const res = await fetch('https://api-ssl.bitly.com/v4/shorten', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${BITLY_TOKEN}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ long_url: longUrl, domain: 'bit.ly' }),
    });
    if (!res.ok) { console.error('[link-tracker] Bitly error:', res.status); return null; }
    const data = await res.json() as { link: string };
    return data.link || null;
  } catch (err) {
    console.error('[link-tracker] Bitly exception:', (err as Error).message);
    return null;
  }
}

Deno.serve(async (req) => {
  // Allow browser requests from the admin page
  const origin = req.headers.get('origin') || '';
  const corsHeaders = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return Response.json({ error: 'POST only' }, { status: 405, headers: corsHeaders });
  }

  try {
    const body = await req.json() as { url?: string; title?: string; campaign?: string; medium?: string };
    const { url, title, campaign = '', medium = 'share' } = body;

    if (!url || !url.startsWith('http')) {
      return Response.json({ error: 'Invalid URL — must start with http' }, { status: 400, headers: corsHeaders });
    }

    // 1. Add UTM parameters
    const utmUrl = buildUtmUrl(url, campaign, medium);
    console.log('[link-tracker] UTM URL:', utmUrl);

    // 2. Shorten with Bitly
    const bitlyUrl = await shortenWithBitly(utmUrl);
    if (!bitlyUrl) {
      return Response.json({ error: 'Bitly shortening failed — check BITLY_TOKEN secret' }, { status: 500, headers: corsHeaders });
    }
    console.log('[link-tracker] Bitly URL:', bitlyUrl);

    // 3. Save to Supabase
    const { error } = await supabase.from('tracked_links').insert({
      original_url: url,
      utm_url:      utmUrl,
      bitly_url:    bitlyUrl,
      title:        title || null,
      campaign:     campaign || null,
      medium,
    });
    if (error) console.error('[link-tracker] Supabase insert error:', error.message);

    return Response.json({ bitly_url: bitlyUrl, utm_url: utmUrl, original_url: url }, { headers: corsHeaders });

  } catch (err) {
    console.error('[link-tracker] Error:', (err as Error).message);
    return Response.json({ error: (err as Error).message }, { status: 500, headers: corsHeaders });
  }
});
