/**
 * Afrorama — link-tracker Edge Function
 *
 * Accepts any URL, adds UTM parameters, saves to opportunity_links,
 * and returns an afrorama.org/opportunity/[id] short link.
 *
 * POST body:
 *   { url: string, title?: string, campaign?: string, medium?: string }
 *
 * Response:
 *   { short_url: string, utm_url: string, original_url: string, id: number }
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const SITE_ORIGIN = 'https://afrorama.org';

function buildUtmUrl(url: string, campaign: string, medium: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set('utm_source', 'afrorama');
    u.searchParams.set('utm_medium', medium || 'share');
    if (campaign) u.searchParams.set('utm_campaign', campaign);
    return u.toString();
  } catch {
    const sep  = url.includes('?') ? '&' : '?';
    const camp = campaign ? `&utm_campaign=${encodeURIComponent(campaign)}` : '';
    return `${url}${sep}utm_source=afrorama&utm_medium=${encodeURIComponent(medium || 'share')}${camp}`;
  }
}

Deno.serve(async (req) => {
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
    const body = await req.json() as {
      url?: string; title?: string; campaign?: string; medium?: string;
    };
    const { url, title, campaign = '', medium = 'share' } = body;

    if (!url || !url.startsWith('http')) {
      return Response.json(
        { error: 'Invalid URL — must start with http' },
        { status: 400, headers: corsHeaders },
      );
    }

    // Add UTM parameters to the destination URL
    const utmUrl = buildUtmUrl(url, campaign, medium);

    // Insert into opportunity_links and get the auto-incremented ID
    const { data, error } = await supabase
      .from('opportunity_links')
      .insert({ destination_url: utmUrl, title: title || null })
      .select('id')
      .single();

    if (error || !data) {
      console.error('[link-tracker] Insert error:', error?.message);
      return Response.json(
        { error: 'Failed to create link' },
        { status: 500, headers: corsHeaders },
      );
    }

    const shortUrl = `${SITE_ORIGIN}/opportunity/${data.id}`;
    console.log('[link-tracker] Created:', shortUrl, '→', utmUrl);

    return Response.json(
      { short_url: shortUrl, utm_url: utmUrl, original_url: url, id: data.id },
      { headers: corsHeaders },
    );

  } catch (err) {
    console.error('[link-tracker] Error:', (err as Error).message);
    return Response.json(
      { error: (err as Error).message },
      { status: 500, headers: corsHeaders },
    );
  }
});
