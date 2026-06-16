/**
 * Afrorama — opportunity redirect Edge Function
 *
 * GET /opportunity/:id
 *  → logs a click_event with country code
 *  → increments click_count on opportunity_links
 *  → 302 redirects to destination_url
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (req) => {
  const segments = new URL(req.url).pathname.split('/');
  const id = parseInt(segments[segments.length - 1]);

  if (!id || isNaN(id)) {
    return new Response('Not found', { status: 404 });
  }

  const { data, error } = await supabase
    .from('opportunity_links')
    .select('destination_url')
    .eq('id', id)
    .single();

  if (error || !data) {
    return new Response('Link not found', { status: 404 });
  }

  // Vercel forwards x-vercel-ip-country on proxied requests
  const country = req.headers.get('x-vercel-ip-country')
               || req.headers.get('cf-ipcountry')
               || null;

  // Log click event + increment total — fire and forget
  Promise.all([
    supabase.from('click_events').insert({ link_id: id, country }),
    supabase.rpc('increment_opportunity_click', { link_id: id }),
  ]).then(() => {});

  return new Response(null, {
    status: 302,
    headers: {
      'Location': data.destination_url,
      'Cache-Control': 'no-store',
    },
  });
});
