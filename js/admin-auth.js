/**
 * Afrorama — admin page login
 *
 * The password is checked server-side by the admin-login Edge Function
 * (against the ADMIN_PASSWORD secret), never in page code. Once it's
 * accepted it's kept in sessionStorage for this tab and sent as
 * `x-admin-password` to admin-only functions.
 */
(function () {
  const FN_BASE  = 'https://vqchwioyhyiuunpyildz.supabase.co/functions/v1';
  const ANON_KEY = 'sb_publishable_HeGZfQZEDI_IR46a2Ezp-Q_tIUdhF6_';
  const PASS_KEY = 'afrorama_admin_pass';

  function get() {
    try { return sessionStorage.getItem(PASS_KEY) || ''; } catch { return ''; }
  }

  async function check(pass) {
    try {
      const res = await fetch(`${FN_BASE}/admin-login`, {
        method: 'POST',
        headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}`, 'x-admin-password': pass },
      });
      return res.ok;
    } catch { return false; }
  }

  async function login(pass) {
    const ok = await check(pass);
    if (ok) { try { sessionStorage.setItem(PASS_KEY, pass); } catch {} }
    return ok;
  }

  // Re-checks the stored password, so a changed password logs everyone out
  async function isLoggedIn() {
    const pass = get();
    return pass ? check(pass) : false;
  }

  function logout() {
    try { sessionStorage.removeItem(PASS_KEY); } catch {}
  }

  window.AfroramaAdmin = { login, isLoggedIn, logout, password: get };
})();
