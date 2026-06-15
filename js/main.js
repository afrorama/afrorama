/* ===== AFRORAMA — GLOBAL JS ===== */

(function () {
  /* ---- Mobile Nav ---- */
  const hamburger  = document.getElementById('nav-hamburger');
  const mobileMenu = document.getElementById('nav-mobile-menu');

  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', () => {
      const open = mobileMenu.classList.toggle('open');
      hamburger.setAttribute('aria-expanded', String(open));
      document.body.style.overflow = open ? 'hidden' : '';
    });
    mobileMenu.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        mobileMenu.classList.remove('open');
        document.body.style.overflow = '';
        hamburger.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ---- Active nav link ---- */
  const page = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a, .nav-mobile-menu a').forEach(a => {
    if ((a.getAttribute('href') || '') === page) a.classList.add('active');
  });

  /* ---- Nav scroll shadow ---- */
  const nav = document.querySelector('.nav');
  if (nav) {
    const upd = () => nav.classList.toggle('scrolled', scrollY > 10);
    addEventListener('scroll', upd, { passive: true });
    upd();
  }

  /* ---- Auth state in nav ---- */
  async function updateNavAuth() {
    const Auth = window.AfroramaAuth;
    if (!Auth) return;
    const user = await Auth.getUser().catch(() => null);
    if (!user) return;

    const name     = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Account';
    const firstName = name.split(' ')[0];
    const initials  = name.split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();

    // Desktop nav — replace Sign in button
    const signInBtn = document.querySelector('.nav-cta-group a[href="auth.html"]');
    if (signInBtn) {
      const menu = document.createElement('div');
      menu.className = 'nav-user-menu';
      menu.innerHTML = `
        <button class="nav-user-btn" aria-haspopup="true" aria-expanded="false">
          <div class="nav-user-avatar">${initials}</div>
          <span class="nav-user-name">${firstName}</span>
          <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div class="nav-user-dropdown">
          <a href="profile.html">My profile</a>
          <a href="opportunities.html">Saved jobs</a>
          <hr style="border:none;border-top:1px solid var(--gray-mid);margin:4px 0;">
          <button class="nav-signout-btn">Sign out</button>
        </div>`;
      signInBtn.replaceWith(menu);

      const btn      = menu.querySelector('.nav-user-btn');
      const dropdown = menu.querySelector('.nav-user-dropdown');
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const open = dropdown.classList.toggle('open');
        btn.setAttribute('aria-expanded', String(open));
      });
      document.addEventListener('click', () => dropdown.classList.remove('open'));
      menu.querySelector('.nav-signout-btn').addEventListener('click', () => Auth.signOut());
    }

    // Mobile menu — replace Sign in button
    const mobileSignIn = document.querySelector('.nav-mobile-menu a[href="auth.html"]');
    if (mobileSignIn) {
      const signOutBtn = document.createElement('button');
      signOutBtn.className = 'btn btn-outline';
      signOutBtn.textContent = 'Sign out (' + firstName + ')';
      signOutBtn.addEventListener('click', () => Auth.signOut());
      mobileSignIn.replaceWith(signOutBtn);
    }
  }

  updateNavAuth();
})();
