/**
 * Afrorama — opportunity redirect Edge Function
 *
 * GET /opportunity/:id
 *  → increments click_count on opportunity_links
 *  → 302 redirects to destination_url
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (req) => {
  // Parse the numeric ID from the end of the path
  // e.g. /functions/v1/opportunity/42  →  id = 42
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

  // Increment click count — fire and forget so redirect is instant
  supabase.rpc('increment_opportunity_click', { link_id: id }).then(() => {});

  return new Response(null, {
    status: 302,
    headers: {
      'Location': data.destination_url,
      'Cache-Control': 'no-store',
    },
  });
});
