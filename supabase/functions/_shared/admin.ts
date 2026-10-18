/**
 * Shared admin check for Edge Functions behind the admin pages.
 *
 * The admin pages send the password the admin typed in the
 * `x-admin-password` header; it is compared here against the
 * ADMIN_PASSWORD secret, so the real password never ships in page code.
 *
 *   supabase secrets set ADMIN_PASSWORD=...
 */

export function isAdmin(req: Request): boolean {
  const expected = Deno.env.get('ADMIN_PASSWORD') || '';
  const given    = req.headers.get('x-admin-password') || '';
  if (!expected || given.length !== expected.length) return false;
  // Constant-time compare
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}
