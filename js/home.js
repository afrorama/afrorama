/* ===== HOMEPAGE JS ===== */

(function () {
  const { getAllJobs, TYPES, AFRICAN_COUNTRIES, formatDate, daysUntil } = window.AfroramaData;

  /** Collapse listings that share the same title+organisation (same role
   *  re-posted under a new source ID), keeping only the most recent one. */
  function dedupeListings(jobs) {
    const seen = new Map();
    for (const j of jobs) {
      const key      = `${(j.title || '').trim().toLowerCase()}|${(j.organisation || '').trim().toLowerCase()}`;
      const existing = seen.get(key);
      if (!existing || new Date(j.created_at) > new Date(existing.created_at)) {
        seen.set(key, j);
      }
    }
    return [...seen.values()];
  }

  async function loadListings() {
    const Supa = window.AfroramaSupabase;
    if (Supa && !Supa.isDemoMode()) {
      const sb       = Supa.getSupabase();
      const today    = new Date().toISOString().split('T')[0];
      const cutoff   = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await sb.from('listings').select('*')
        .or(`deadline.gte.${today},deadline.is.null`)
        .or('paid_listing.eq.false,payment_confirmed.eq.true')
        .order('created_at', { ascending: false });
      if (data?.length) {
        const live       = data.filter(j => j.deadline || new Date(j.created_at) >= new Date(cutoff));
        const deduped    = dedupeListings(live);
        const dbIds      = new Set(deduped.map(j => j.id));
        const staticOnly = getAllJobs().filter(j => !dbIds.has(j.id));
        return [...deduped, ...staticOnly];
      }
    }
    return getAllJobs();
  }

  /* ================================================================
     TYPING ANIMATION
  ================================================================= */
  function initTyping() {
    const el = document.getElementById('typed-word');
    if (!el) return;
    const words = ['hustlers', 'movers', 'shakers', 'people', 'doers', 'returnees', 'diaspora', 'dreamers', 'hopeful'];
    let wordIdx = 0, charIdx = words[0].length, isDeleting = false;
    el.textContent = words[0];

    function tick() {
      const word = words[wordIdx];
      if (isDeleting) {
        charIdx--;
        el.textContent = word.substring(0, charIdx);
        if (charIdx === 0) {
          isDeleting = false;
          wordIdx = (wordIdx + 1) % words.length;
          setTimeout(tick, 320);
          return;
        }
        setTimeout(tick, 55);
      } else {
        charIdx++;
        el.textContent = words[wordIdx].substring(0, charIdx);
        if (charIdx === words[wordIdx].length) {
          setTimeout(() => { isDeleting = true; tick(); }, 2000);
          return;
        }
        setTimeout(tick, 95);
      }
    }
    setTimeout(() => { isDeleting = true; tick(); }, 2600);
  }
  initTyping();

  /* ================================================================
     MAP SIDEBAR STATS
  ================================================================= */
  function buildMarketStats(jobs, countByCountry, remoteCount, map) {
    const el = document.getElementById('market-stats-list');
    if (!el) return;

    const MARKETS = [
      { id: 'ZA', name: 'South Africa', flag: '🇿🇦', lat: -28.5, lon: 25.5, href: 'opportunities.html?country=ZA' },
      { id: 'KE', name: 'Kenya',        flag: '🇰🇪', lat:  0.2,  lon: 37.8, href: 'opportunities.html?country=KE' },
      { id: 'SN', name: 'Senegal',      flag: '🇸🇳', lat: 14.5,  lon:-14.5, href: 'opportunities.html?country=SN' },
      { id: 'NG', name: 'Nigeria',      flag: '🇳🇬', lat:  9.0,  lon:  8.0, href: 'opportunities.html?country=NG' },
      { id: 'remote', name: 'Remote / Pan-African', flag: '🌍', href: 'opportunities.html?q=remote' },
    ].map(m => ({
      ...m,
      count: m.id === 'remote' ? remoteCount : (countByCountry[m.id] || 0),
    })).filter(m => m.count > 0).sort((a, b) => b.count - a.count);

    const max = Math.max(...MARKETS.map(m => m.count), 1);

    el.innerHTML = MARKETS.map(m => `
      <div class="market-stat" role="button" tabindex="0" data-href="${m.href}"
           aria-label="${m.name}: ${m.count} opportunit${m.count === 1 ? 'y' : 'ies'}">
        <div class="market-stat-top">
          <span class="market-stat-name">${m.flag} ${m.name}</span>
          <span class="market-stat-count">${m.count}</span>
        </div>
        <div class="market-stat-bar">
          <div class="market-stat-fill" style="width:${Math.round(m.count / max * 100)}%"></div>
        </div>
      </div>`).join('');

    el.querySelectorAll('.market-stat').forEach(card => {
      const go = () => { window.location.href = card.dataset.href; };
      card.addEventListener('click', go);
      card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
  }

  /* ================================================================
     LEAFLET INTERACTIVE MAP
  ================================================================= */
  function initLeafletMap(jobs) {
    if (typeof L === 'undefined') return;
    const container = document.getElementById('leaflet-home-map');
    if (!container) return;

    const countByCountry = {};
    jobs.forEach(j => { countByCountry[j.country] = (countByCountry[j.country] || 0) + 1; });

    const remoteCount = jobs.filter(j =>
      j.location.toLowerCase().includes('remote') ||
      j.location.toLowerCase().includes('pan-african') ||
      j.location.toLowerCase().includes('pan african')
    ).length;

    const totalCountries = Object.keys(countByCountry).length;
    const statEl = document.getElementById('map-stat-text');
    if (statEl) statEl.innerHTML = `<strong>${jobs.length}</strong> live opportunities across <strong>${totalCountries}</strong> countries`;

    const countEl = document.getElementById('live-opp-count');
    if (countEl) countEl.textContent = jobs.length;

    const isDark = document.documentElement.dataset.theme === 'dark';
    const tileUrl = isDark
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

    const map = L.map('leaflet-home-map', {
      center: [0, 20], zoom: 3, minZoom: 2, maxZoom: 12,
      zoomControl: true, scrollWheelZoom: false,
    });

    let tileLayer = L.tileLayer(tileUrl, {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd', maxZoom: 20,
    }).addTo(map);

    // Switch tiles when theme changes
    document.getElementById('theme-toggle')?.addEventListener('click', () => {
      setTimeout(() => {
        const dark = document.documentElement.dataset.theme === 'dark';
        const url  = dark
          ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
          : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
        map.removeLayer(tileLayer);
        tileLayer = L.tileLayer(url, { subdomains: 'abcd', maxZoom: 20 }).addTo(map);
      }, 100);
    });

    // Build sidebar stats
    buildMarketStats(jobs, countByCountry, remoteCount, map);

    // Dot markers — hover tooltip only
    AFRICAN_COUNTRIES.forEach(c => {
      const count = countByCountry[c.id] || 0;
      if (count === 0) return;

      const size = Math.max(30, Math.min(50, 30 + count * 3));
      const fs   = size > 40 ? 13 : 11;
      const icon = L.divIcon({
        html: `<div class="lmap-marker" style="width:${size}px;height:${size}px;font-size:${fs}px">${count}</div>`,
        className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2],
      });
      L.marker([c.lat, c.lon], { icon })
        .addTo(map)
        .bindTooltip(`<strong>${c.name}</strong><br>${count} opportunit${count === 1 ? 'y' : 'ies'}`, { direction: 'top' })
        .on('click', () => { window.location.href = `opportunities.html?country=${c.id}`; });
    });

    map.setView([0, 20], 3);
  }

  // SDG colours for org logos
  const ORG_COLOURS = ['#DDA63A','#26BDE2','#FD6925','#3F7E44','#DD1367','#00689D','#A21942','#4C9F38','#E5243B','#19486A'];
  function orgColour(name) {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
    return ORG_COLOURS[Math.abs(h) % ORG_COLOURS.length];
  }
  function orgInitials(name) {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }

  const logoCache = new Map();
  async function loadOrgLogos(jobs) {
    const uniqueOrgs = [...new Set(jobs.map(j => j.organisation))];
    await Promise.all(uniqueOrgs.map(async org => {
      if (logoCache.has(org)) return;
      try {
        const res    = await fetch(`https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(org)}`);
        const data   = await res.json();
        const domain = data?.[0]?.domain;
        if (!domain) { logoCache.set(org, null); return; }
        const logo = `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://${domain}&size=128`;
        logoCache.set(org, logo);
        if (!logo) return;
        document.querySelectorAll(`.home-org-logo-img[data-org="${CSS.escape(org)}"]`).forEach(img => {
          img.src = logo;
          img.style.display = 'block';
          img.nextElementSibling && (img.nextElementSibling.style.display = 'none');
        });
      } catch { logoCache.set(org, null); }
    }));
  }

  /* ================================================================
     LATEST 3 JOB CARDS
  ================================================================= */
  function renderLatest(jobs) {
    const container = document.getElementById('latest-jobs');
    if (!container) return;
    jobs = jobs.slice(0, 3);
    if (!jobs.length) { container.innerHTML = '<p style="color:var(--gray-dark);grid-column:1/-1">No opportunities at the moment.</p>'; return; }
    container.innerHTML = jobs.map(j => {
      const days    = daysUntil(j.deadline);
      const urgent  = days <= 7;
      const t       = TYPES[j.type];
      const country = AFRICAN_COUNTRIES.find(c => c.id === j.country);
      const bgCol = orgColour(j.organisation);
      const inits = orgInitials(j.organisation);
      return `
        <article class="job-card-home t-${j.type}" tabindex="0" role="button" data-id="${j.id}" aria-label="${esc(j.title)} at ${esc(j.organisation)}">
          ${j.paid_listing ? '<span class="badge badge-featured">★ Featured</span> ' : ''}<span class="badge badge-${j.type}">${t.icon} ${t.label}</span>
          <div class="card-logo-wrap">
            <div class="card-logo" style="background:${bgCol};overflow:hidden" aria-hidden="true">
              <img class="home-org-logo-img" data-org="${esc(j.organisation)}" alt="${esc(j.organisation)}" style="display:none;width:100%;height:100%;object-fit:contain;border-radius:5px;background:white" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
              <span style="width:100%;height:100%;display:flex;align-items:center;justify-content:center">${inits}</span>
            </div>
            <div class="card-org">${esc(j.organisation)}</div>
          </div>
          <h3>${esc(j.title)}</h3>
          <div class="card-meta">
            <span class="card-meta-item">
              <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              ${esc(j.location)}${country ? ', ' + esc(country.name) : ''}
            </span>
            <span class="card-meta-item">${esc(j.sector)}</span>
          </div>
          <div class="card-footer">
            <span class="deadline-tag ${urgent ? 'deadline-urgent' : 'deadline-normal'}">${urgent ? '⚠ ' : ''}${days}d left</span>
            <span style="font-size:.7rem;color:var(--gray-dark);">Posted ${formatDate(j.posted)}</span>
          </div>
        </article>`;
    }).join('');
    container.querySelectorAll('.job-card-home').forEach(card => {
      const go = () => { window.location.href = 'opportunities.html'; };
      card.addEventListener('click', go);
      card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
  }
  /* ================================================================
     HERO SEARCH
  ================================================================= */
  document.getElementById('hero-search-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const kw   = (document.getElementById('search-keyword')?.value || '').trim();
    const type = document.getElementById('search-type')?.value || '';
    const p    = new URLSearchParams();
    if (kw)   p.set('q', kw);
    if (type) p.set('type', type);
    location.href = 'opportunities.html' + (p.toString() ? '?' + p : '');
  });

  // Load listings then render map + latest cards + logos
  loadListings().then(jobs => {
    initLeafletMap(jobs);
    renderLatest(jobs);
    loadOrgLogos(jobs);
  });

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]);
  }
})();
