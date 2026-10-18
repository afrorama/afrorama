/**
 * Afrorama — admin-login Edge Function
 *
 * Checks the password typed on an admin page against the ADMIN_PASSWORD
 * secret. Returns 200 if it matches, 401 otherwise. The admin pages keep
 * the password in sessionStorage and send it as `x-admin-password` to
 * admin-only functions (scrape-url, publish-admin-listing), which check
 * it again server-side.
 *
 * Deploy: supabase functions deploy admin-login
 */

import { isAdmin } from '../_shared/admin.ts';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-admin-password',
};

Deno.serve((req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  const ok = isAdmin(req);
  return Response.json({ ok }, { status: ok ? 200 : 401, headers: CORS });
});
