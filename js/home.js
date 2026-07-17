/* ===== HOMEPAGE JS ===== */

(function () {
  const { getAllJobs, TYPES, AFRICAN_COUNTRIES, formatDate, daysUntil } = window.AfroramaData;

  // Coordinates for non-African countries — covers HQ-based postings added
  // via the admin scrape tool (e.g. AFD/Expertise France roles in Paris)
  // that still need a pin on the homepage map.
  const WORLD_COUNTRY_COORDS = {
    AL:{name:'Albania',lat:41,lon:20},AD:{name:'Andorra',lat:42.5,lon:1.6},AT:{name:'Austria',lat:47.3,lon:13.3},
    BY:{name:'Belarus',lat:53.7,lon:28},BE:{name:'Belgium',lat:50.8,lon:4.5},BA:{name:'Bosnia & Herzegovina',lat:43.9,lon:17.7},
    BG:{name:'Bulgaria',lat:42.7,lon:25.5},HR:{name:'Croatia',lat:45.1,lon:15.2},CY:{name:'Cyprus',lat:35.1,lon:33.4},
    CZ:{name:'Czechia',lat:49.8,lon:15.5},DK:{name:'Denmark',lat:56.3,lon:9.5},EE:{name:'Estonia',lat:58.6,lon:25},
    FI:{name:'Finland',lat:61.9,lon:25.7},FR:{name:'France',lat:46.6,lon:2.2},DE:{name:'Germany',lat:51.2,lon:10.4},
    GR:{name:'Greece',lat:39.1,lon:21.8},HU:{name:'Hungary',lat:47.2,lon:19.5},IS:{name:'Iceland',lat:64.9,lon:-19},
    IE:{name:'Ireland',lat:53.4,lon:-8},IT:{name:'Italy',lat:41.9,lon:12.6},XK:{name:'Kosovo',lat:42.6,lon:20.9},
    LV:{name:'Latvia',lat:56.9,lon:24.6},LI:{name:'Liechtenstein',lat:47.2,lon:9.5},LT:{name:'Lithuania',lat:55.2,lon:23.9},
    LU:{name:'Luxembourg',lat:49.8,lon:6.1},MT:{name:'Malta',lat:35.9,lon:14.4},MD:{name:'Moldova',lat:47.4,lon:28.4},
    MC:{name:'Monaco',lat:43.7,lon:7.4},ME:{name:'Montenegro',lat:42.7,lon:19.4},NL:{name:'Netherlands',lat:52.1,lon:5.3},
    MK:{name:'North Macedonia',lat:41.6,lon:21.7},NO:{name:'Norway',lat:60.5,lon:8.5},PL:{name:'Poland',lat:51.9,lon:19.1},
    PT:{name:'Portugal',lat:39.4,lon:-8},RO:{name:'Romania',lat:45.9,lon:25},RU:{name:'Russia',lat:61.5,lon:105.3},
    SM:{name:'San Marino',lat:43.9,lon:12.5},RS:{name:'Serbia',lat:44,lon:21},SK:{name:'Slovakia',lat:48.7,lon:19.7},
    SI:{name:'Slovenia',lat:46.1,lon:14.8},ES:{name:'Spain',lat:40.5,lon:-3.7},SE:{name:'Sweden',lat:60.1,lon:18.6},
    CH:{name:'Switzerland',lat:46.8,lon:8.2},UA:{name:'Ukraine',lat:48.4,lon:31.2},GB:{name:'United Kingdom',lat:55.4,lon:-3.4},
    VA:{name:'Vatican City',lat:41.9,lon:12.5},
    AF:{name:'Afghanistan',lat:33.9,lon:67.7},AM:{name:'Armenia',lat:40.1,lon:45},AZ:{name:'Azerbaijan',lat:40.1,lon:47.6},
    BH:{name:'Bahrain',lat:26,lon:50.5},BD:{name:'Bangladesh',lat:23.7,lon:90.4},BT:{name:'Bhutan',lat:27.5,lon:90.4},
    BN:{name:'Brunei',lat:4.5,lon:114.7},KH:{name:'Cambodia',lat:12.6,lon:104.9},CN:{name:'China',lat:35.9,lon:104.2},
    GE:{name:'Georgia',lat:42.3,lon:43.4},IN:{name:'India',lat:20.6,lon:79},ID:{name:'Indonesia',lat:-0.8,lon:113.9},
    IR:{name:'Iran',lat:32.4,lon:53.7},IQ:{name:'Iraq',lat:33.2,lon:43.7},IL:{name:'Israel',lat:31,lon:34.8},
    JP:{name:'Japan',lat:36.2,lon:138.3},JO:{name:'Jordan',lat:30.6,lon:36.2},KZ:{name:'Kazakhstan',lat:48,lon:66.9},
    KW:{name:'Kuwait',lat:29.3,lon:47.5},KG:{name:'Kyrgyzstan',lat:41.2,lon:74.8},LA:{name:'Laos',lat:19.9,lon:102.5},
    LB:{name:'Lebanon',lat:33.9,lon:35.9},MY:{name:'Malaysia',lat:4.2,lon:108.9},MV:{name:'Maldives',lat:3.2,lon:73.2},
    MN:{name:'Mongolia',lat:46.9,lon:103.8},MM:{name:'Myanmar',lat:21.9,lon:96},NP:{name:'Nepal',lat:28.4,lon:84.1},
    KP:{name:'North Korea',lat:40.3,lon:127.5},OM:{name:'Oman',lat:21.5,lon:55.9},PK:{name:'Pakistan',lat:30.4,lon:69.3},
    PS:{name:'Palestine',lat:31.9,lon:35.2},PH:{name:'Philippines',lat:12.9,lon:121.8},QA:{name:'Qatar',lat:25.4,lon:51.2},
    SA:{name:'Saudi Arabia',lat:24,lon:45},SG:{name:'Singapore',lat:1.3,lon:103.8},KR:{name:'South Korea',lat:36.5,lon:127.9},
    LK:{name:'Sri Lanka',lat:7.9,lon:80.8},SY:{name:'Syria',lat:34.8,lon:39},TW:{name:'Taiwan',lat:23.7,lon:121},
    TJ:{name:'Tajikistan',lat:38.9,lon:71.3},TH:{name:'Thailand',lat:15.9,lon:101},TL:{name:'Timor-Leste',lat:-8.9,lon:125.7},
    TR:{name:'Türkiye',lat:38.9,lon:35.2},TM:{name:'Turkmenistan',lat:38.9,lon:59.6},AE:{name:'United Arab Emirates',lat:23.4,lon:53.8},
    UZ:{name:'Uzbekistan',lat:41.4,lon:64.6},VN:{name:'Vietnam',lat:14.1,lon:108.3},YE:{name:'Yemen',lat:15.6,lon:48.5},
    AG:{name:'Antigua & Barbuda',lat:17.1,lon:-61.8},BS:{name:'Bahamas',lat:24.3,lon:-76.6},BB:{name:'Barbados',lat:13.2,lon:-59.5},
    BZ:{name:'Belize',lat:17.2,lon:-88.5},CA:{name:'Canada',lat:56.1,lon:-106.3},CR:{name:'Costa Rica',lat:9.7,lon:-83.8},
    CU:{name:'Cuba',lat:21.5,lon:-77.8},DM:{name:'Dominica',lat:15.4,lon:-61.4},DO:{name:'Dominican Republic',lat:18.7,lon:-70.2},
    SV:{name:'El Salvador',lat:13.8,lon:-88.9},GD:{name:'Grenada',lat:12.1,lon:-61.7},GT:{name:'Guatemala',lat:15.8,lon:-90.2},
    HT:{name:'Haiti',lat:18.9,lon:-72.3},HN:{name:'Honduras',lat:15.2,lon:-86.2},JM:{name:'Jamaica',lat:18.1,lon:-77.3},
    MX:{name:'Mexico',lat:23.6,lon:-102.5},NI:{name:'Nicaragua',lat:12.9,lon:-85.2},PA:{name:'Panama',lat:8.5,lon:-80.8},
    KN:{name:'Saint Kitts & Nevis',lat:17.4,lon:-62.8},LC:{name:'Saint Lucia',lat:13.9,lon:-60.9},
    VC:{name:'Saint Vincent & the Grenadines',lat:13.3,lon:-61.2},TT:{name:'Trinidad & Tobago',lat:10.7,lon:-61.2},
    US:{name:'United States',lat:37.1,lon:-95.7},
    AR:{name:'Argentina',lat:-38.4,lon:-63.6},BO:{name:'Bolivia',lat:-16.3,lon:-63.6},BR:{name:'Brazil',lat:-14.2,lon:-51.9},
    CL:{name:'Chile',lat:-35.7,lon:-71.5},CO:{name:'Colombia',lat:4.6,lon:-74.3},EC:{name:'Ecuador',lat:-1.8,lon:-78.2},
    GY:{name:'Guyana',lat:4.9,lon:-58.9},PY:{name:'Paraguay',lat:-23.4,lon:-58.4},PE:{name:'Peru',lat:-9.2,lon:-75},
    SR:{name:'Suriname',lat:3.9,lon:-56},UY:{name:'Uruguay',lat:-32.5,lon:-55.8},VE:{name:'Venezuela',lat:6.4,lon:-66.6},
    AU:{name:'Australia',lat:-25.3,lon:133.8},FJ:{name:'Fiji',lat:-17.7,lon:178},KI:{name:'Kiribati',lat:1.9,lon:-157.4},
    MH:{name:'Marshall Islands',lat:7.1,lon:171.2},FM:{name:'Micronesia',lat:7.4,lon:150.6},NR:{name:'Nauru',lat:-0.5,lon:166.9},
    NZ:{name:'New Zealand',lat:-40.9,lon:174.9},PW:{name:'Palau',lat:7.5,lon:134.6},PG:{name:'Papua New Guinea',lat:-6.3,lon:143.9},
    WS:{name:'Samoa',lat:-13.8,lon:-172.1},SB:{name:'Solomon Islands',lat:-9.6,lon:160.2},TO:{name:'Tonga',lat:-21.2,lon:-175.2},
    TV:{name:'Tuvalu',lat:-7.1,lon:177.6},VU:{name:'Vanuatu',lat:-15.4,lon:166.9},
  };

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
      { id: 'ZA', name: 'South Africa', lat: -28.5, lon: 25.5, href: 'opportunities.html?country=ZA' },
      { id: 'KE', name: 'Kenya',        lat:  0.2,  lon: 37.8, href: 'opportunities.html?country=KE' },
      { id: 'SN', name: 'Senegal',      lat: 14.5,  lon:-14.5, href: 'opportunities.html?country=SN' },
      { id: 'NG', name: 'Nigeria',      lat:  9.0,  lon:  8.0, href: 'opportunities.html?country=NG' },
      { id: 'remote', name: 'Remote / Pan-African', href: 'opportunities.html?q=remote' },
    ].map(m => ({
      ...m,
      count: m.id === 'remote' ? remoteCount : (countByCountry[m.id] || 0),
    })).filter(m => m.count > 0).sort((a, b) => b.count - a.count);

    const max = Math.max(...MARKETS.map(m => m.count), 1);

    el.innerHTML = MARKETS.map(m => `
      <div class="market-stat" role="button" tabindex="0" data-href="${m.href}"
           aria-label="${m.name}: ${m.count} opportunit${m.count === 1 ? 'y' : 'ies'}">
        <div class="market-stat-top">
          <span class="market-stat-name">${m.id === 'remote' ? '🌍' : `<img src="https://flagcdn.com/20x15/${m.id.toLowerCase()}.png" width="20" height="15" alt="${m.name}" style="vertical-align:middle;margin-right:4px;border-radius:2px;">`}${m.name}</span>
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

    // Dot markers — hover tooltip only. Falls back to the world-coords
    // list for non-African postings (e.g. HQ-based roles in Paris/Geneva)
    // added via the admin scrape tool.
    const africanById = Object.fromEntries(AFRICAN_COUNTRIES.map(c => [c.id, c]));
    Object.keys(countByCountry).forEach(countryId => {
      const count = countByCountry[countryId] || 0;
      if (count === 0) return;

      const c = africanById[countryId]
        ? { id: countryId, ...africanById[countryId] }
        : WORLD_COUNTRY_COORDS[countryId]
        ? { id: countryId, ...WORLD_COUNTRY_COORDS[countryId] }
        : null;
      if (!c) return;

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
