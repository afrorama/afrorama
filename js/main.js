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

    const ctaGroup  = document.querySelector('.nav-cta-group');
    const mobileMenu = document.getElementById('nav-mobile-menu');

    if (!user) {
      // Show Sign in link if not already present
      if (ctaGroup && !ctaGroup.querySelector('a')) {
        const a = document.createElement('a');
        a.href = 'auth.html';
        a.className = 'btn btn-outline btn-sm';
        a.textContent = 'Sign in';
        ctaGroup.appendChild(a);
      }
      if (mobileMenu && !mobileMenu.querySelector('a[href="auth.html"]')) {
        const a = document.createElement('a');
        a.href = 'auth.html';
        a.textContent = 'Sign in';
        mobileMenu.appendChild(a);
      }
      return;
    }

    const name      = user.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Account';
    const firstName = name.split(' ')[0];
    const initials  = name.split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();

    // Desktop nav — inject avatar menu into nav-cta-group
    if (ctaGroup && !ctaGroup.querySelector('.nav-user-menu')) {
      ctaGroup.innerHTML = '';
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
          <hr style="border:none;border-top:1px solid var(--gray-mid);margin:4px 0;">
          <button class="nav-signout-btn">Sign out</button>
        </div>`;
      ctaGroup.appendChild(menu);

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

    // Mobile menu
    if (mobileMenu && !mobileMenu.querySelector('.nav-signout-btn')) {
      const signOutBtn = document.createElement('button');
      signOutBtn.className = 'btn btn-outline nav-signout-btn';
      signOutBtn.textContent = 'Sign out (' + firstName + ')';
      signOutBtn.addEventListener('click', () => Auth.signOut());
      mobileMenu.appendChild(signOutBtn);
    }
  }

  updateNavAuth();
})();
