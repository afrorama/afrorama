/* ===== OPPORTUNITIES PAGE JS ===== */

(function () {
  const { getAllJobs, TYPES, AFRICAN_COUNTRIES, formatDate, daysUntil } = window.AfroramaData;
  const Auth = window.AfroramaAuth;

  // Coordinates for non-African countries — covers HQ-based postings added
  // via the admin scrape tool (e.g. AFD/Expertise France roles in Paris)
  // that still need a pin on the opportunities map.
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

  let activeCountry   = null;
  let allJobs         = [];
  let oppMap          = null;
  let mapMarkerLayer  = null;   // Layer group so we can redraw markers on filter
  let currentUser     = null;

  /* ---- Supabase listings loader (falls back to static data.js) ---- */
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
      const sb          = Supa.getSupabase();
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await sb.rpc('get_active_listings');
      if (data?.length) {
        const live    = data.filter(j => j.deadline || new Date(j.created_at) >= new Date(cutoff));
        const deduped = dedupeListings(live);
        const dbIds      = new Set(deduped.map(j => j.id));
        const staticOnly = getAllJobs().filter(j => !dbIds.has(j.id));
        return [...deduped, ...staticOnly];
      }
    }
    return getAllJobs();
  }

  /* ---- Org logo helpers ---- */
  const ORG_COLOURS = ['#DDA63A','#26BDE2','#FD6925','#3F7E44','#DD1367','#00689D','#A21942','#4C9F38','#E5243B','#19486A'];
  function orgColour(name) {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
    return ORG_COLOURS[Math.abs(h) % ORG_COLOURS.length];
  }
  function orgInitials(name) {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }

  /* ---- Logo fetching — manual domain map + Clearbit fallback ---- */
  const ORG_DOMAIN_MAP = {
    // Greenhouse orgs
    'Human Rights Watch':                       'hrw.org',
    'Wikimedia Foundation':                     'wikimedia.org',
    'One Earth Future':                         'oneearthfuture.org',
    'GiveDirectly':                             'givedirectly.org',
    'Girl Effect':                              'girleffect.org',
    'Acumen':                                   'acumen.org',
    'Global Energy Alliance for People and Planet': 'energyalliance.org',
    'The Economist Group':                      'economist.com',
    'African Leadership University':            'alueducation.com',
    'Imagine Worldwide':                        'imagineworldwide.org',
    'Semafor':                                  'semafor.com',
    'Instiglio':                                'instiglio.org',
    'Educate!':                                 'educate.org',
    'One Acre Fund Zambia':                     'oneacrefund.org',
    'One Acre Fund Kenya':                      'oneacrefund.org',
    'One Acre Fund Malawi':                     'oneacrefund.org',
    'One Acre Fund Uganda':                     'oneacrefund.org',
    'The New York Times':                       'nytimes.com',
    'Tilting Futures':                          'tiltingfutures.org',
    'Delivery Associates':                      'deliveryassociates.com',
    'Mastercard Foundation':                    'mastercardfdn.org',
    '350.org':                                  '350.org',
    'Global Citizen Year':                      'globalcitizenyear.org',
    '60 Decibels':                              '60decibels.com',
    'Financial Times':                          'ft.com',
    'Room to Read':                             'roomtoread.org',
    'Partners in Health':                       'pih.org',
    'Innovations for Poverty Action':           'poverty-action.org',
    'Clinton Health Access Initiative':         'clintonhealthaccess.org',
    'VillageReach':                             'villagereach.org',
    'Center for Global Development':            'cgdev.org',
    'Palladium':                                'thepalladiumgroup.com',
    'Pact':                                     'pactworld.org',
    'Wildlife Conservation Society':            'wcs.org',
    'Pathfinder International':                 'pathfinder.org',
    'Living Goods':                             'livinggoods.org',
    'IDinsight':                                'idinsight.org',
    'Remitly':                                  'remitly.com',
    'Terraformation':                           'terraformation.com',
    'Stanford Social Innovation Review':        'ssir.org',
    'Population Reference Bureau':              'prb.org',
    'Teach For All':                            'teachforall.org',
    'J-PAL':                                    'povertyactionlab.org',
    '3ie':                                      '3ieimpact.org',
    'GiveWell':                                 'givewell.org',
    'Open Philanthropy':                        'openphilanthropy.org',
    'Convergence Blended Finance':              'convergencefinance.org',
    'Global Development Incubator':             'globaldevincubator.org',
    'Catholic Relief Services':                 'crs.org',
    'FHI 360':                                  'fhi360.org',
    'United Purpose':                           'united-purpose.org',
    'Nutrition International':                  'nutritionintl.org',
    'International Planned Parenthood Federation': 'ippf.org',
    'World Food Programme USA':                 'wfpusa.org',
    'The Nature Conservancy':                   'nature.org',
    'Conservation International':               'conservation.org',
    'WWF':                                      'wwf.org',
    'International Rescue Committee':           'rescue.org',
    'World Vision':                             'worldvision.org',
    // Workable orgs
    'Evidence Action':                          'evidenceaction.org',
    "Children's Investment Fund Foundation":    'ciff.org',
    'Inkomoko':                                 'inkomoko.com',
    'Partech Partners':                         'partechpartners.com',
    'Trócaire':                                 'trocaire.org',
    'Handicap International':                   'hi.org',
    'WorldFish':                                'worldfishcenter.org',
    'Action Against Hunger':                    'actionagainsthunger.org',
    'WaterAid':                                 'wateraid.org',
    'Médecins du Monde':                        'medecinsdumonde.net',
    'ThinkWell':                                'thinkwell.global',
    'ICARDA':                                   'icarda.org',
    'Street Child':                             'street-child.co.uk',
    'OpenFn':                                   'openfn.org',
    'iDE Global':                               'ideglobal.org',
    'Zinc Network':                             'zincnetwork.com',
    'WaterEquity':                              'waterequity.org',
    'ClimateWorks Foundation':                  'climateworks.org',
    'International Water Management Institute': 'iwmi.cgiar.org',
    'Rising Academies':                         'rising-academies.org',
    'Centre for Information Resilience':        'info-res.org',
    'The HALO Trust':                           'halotrust.org',
    'Control Risks':                            'controlrisks.com',
    'BRAC International':                       'brac.net',
    'Abt Associates':                           'abtglobal.com',
    'Concern Worldwide':                        'concern.net',
    'Population Services International':        'psi.org',
    'Tearfund':                                 'tearfund.org',
    'International Alert':                      'international-alert.org',
    'Norwegian Refugee Council':                'nrc.no',
    'Oxfam GB':                                 'oxfam.org.uk',
    'Africa Soil Information Service':          'africasoils.net',
    'Kenya Climate Innovation Centre':          'kenyacic.org',
    'Komaza':                                   'komaza.com',
    'SunCulture':                               'sunculture.com',
    'Twiga Foods':                              'twigafoods.com',
    'Asante Africa Foundation':                 'asanteafrica.org',
    'Sightsavers':                              'sightsavers.org',
    'Helen Keller International':               'hki.org',
    'Medair':                                   'medair.org',
    'GOAL':                                     'goalglobal.org',
    'Lutheran World Federation':                'lutheranworld.org',
    'Stockholm Environment Institute':          'sei.org',
    'IIED':                                     'iied.org',
    'Tetra Tech':                               'tetratech.com',
    // TeamTailor orgs
    'Bamboo':                                   'bamboofinance.com',
    'Katapult':                                 'katapultfuture.com',
    'CDP Worldwide':                            'cdp.net',
    'BirdLife International':                   'birdlife.org',
    // Common additional orgs
    'UNHCR':                                    'unhcr.org',
    'UNICEF':                                   'unicef.org',
    'UNDP':                                     'undp.org',
    'UN Women':                                 'unwomen.org',
    'IOM':                                      'iom.int',
    'WHO':                                      'who.int',
    'FAO':                                      'fao.org',
    'IFRC':                                     'ifrc.org',
    'Red Cross':                                'redcross.org',
    'Save the Children':                        'savethechildren.org',
    'Plan International':                       'plan-international.org',
    'MSF':                                      'msf.org',
    'Médecins Sans Frontières':                 'msf.org',
    'Mercy Corps':                              'mercycorps.org',
    'IRC':                                      'rescue.org',
    'CARE International':                       'care-international.org',
    'World Bank':                               'worldbank.org',
    'African Development Bank':                 'afdb.org',
    'Tony Elumelu Foundation':                  'tonyelumelufoundation.org',
    'Ashoka':                                   'ashoka.org',
    'Aga Khan Foundation':                      'akdn.org',
    'Oxfam':                                    'oxfam.org',
    'ActionAid':                                'actionaid.org',
    'USAID':                                    'usaid.gov',
    'DAI':                                      'dai.com',
    'Chemonics':                                'chemonics.com',
    'RTI International':                        'rti.org',
    'Management Systems International':         'msiworldwide.com',
    'International Development Law Organization': 'idlo.int',
    'Aga Khan Development Network':             'akdn.org',
  };

  const logoCache = new Map();

  async function fetchOrgLogo(orgName) {
    if (logoCache.has(orgName)) return logoCache.get(orgName);
    // Known orgs — skip network lookup entirely
    const knownDomain = ORG_DOMAIN_MAP[orgName];
    if (knownDomain) {
      const url = `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${knownDomain}&size=256`;
      logoCache.set(orgName, url);
      return url;
    }
    // Unknown orgs — try Clearbit autocomplete
    try {
      const res    = await fetch(`https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(orgName)}`);
      const data   = await res.json();
      const domain = data?.[0]?.domain;
      if (!domain) { logoCache.set(orgName, null); return null; }
      const url = `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=256`;
      logoCache.set(orgName, url);
      return url;
    } catch {
      logoCache.set(orgName, null);
      return null;
    }
  }

  async function loadOrgLogos(jobs) {
    const uniqueOrgs = [...new Set(jobs.filter(j => !j.logo_url).map(j => j.organisation))];
    await Promise.all(uniqueOrgs.map(async org => {
      const logo = await fetchOrgLogo(org);
      if (!logo) return;
      document.querySelectorAll(`.org-logo-img[data-org="${CSS.escape(org)}"]`).forEach(img => {
        img.src = logo;
        img.style.display = 'block';
        img.closest('.job-card-logo')?.classList.remove('logo-fallback');
      });
    }));
  }

  /* ================================================================
     LEAFLET MAP — markers update as filters are applied
  ================================================================= */
  function buildLeafletMap() {
    if (typeof L === 'undefined') return;
    const container = document.getElementById('opp-leaflet-map');
    if (!container) return;

    oppMap = L.map('opp-leaflet-map', {
      center: [0, 20], zoom: 3, minZoom: 2, maxZoom: 10,
      zoomControl: true, scrollWheelZoom: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd', maxZoom: 20,
    }).addTo(oppMap);

    mapMarkerLayer = L.layerGroup().addTo(oppMap);
    oppMap.setView([0, 20], 3);
  }

  /** Rebuild map markers to match the CURRENTLY filtered job set */
  function updateMapMarkers(filteredJobs) {
    if (!oppMap || !mapMarkerLayer) return;
    mapMarkerLayer.clearLayers();

    const countByCountry = {};
    filteredJobs.forEach(j => { countByCountry[j.country] = (countByCountry[j.country] || 0) + 1; });

    const markerLatLngs = [];

    // Look up coordinates from African countries first, falling back to
    // the world list — covers HQ-based postings (e.g. AFD/Expertise
    // France roles in Paris) added via the admin scrape tool.
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

      const size = Math.max(30, Math.min(52, 30 + count * 3));
      const fs   = size > 42 ? 13 : 11;
      const icon = L.divIcon({
        html: `<div class="lmap-marker" style="width:${size}px;height:${size}px;font-size:${fs}px">${count}</div>`,
        className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2],
      });

      markerLatLngs.push([c.lat, c.lon]);

      L.marker([c.lat, c.lon], { icon })
        .addTo(mapMarkerLayer)
        .bindTooltip(`<strong>${c.name}</strong><br>${count} opportunit${count === 1 ? 'y' : 'ies'}`, { direction: 'top' })
        .on('click', () => {
          if (activeCountry === c.id) {
            activeCountry = null;
            document.getElementById('map-reset-btn').style.display = 'none';
          } else {
            activeCountry = c.id;
            document.getElementById('map-reset-btn').style.display = 'inline-flex';
          }
          applyFilters();
          document.getElementById('jobs-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });

    // Auto-zoom to show all filtered markers (with slight padding)
    if (markerLatLngs.length === 1) {
      oppMap.setView(markerLatLngs[0], 5, { animate: true });
    } else if (markerLatLngs.length > 1) {
      oppMap.fitBounds(L.latLngBounds(markerLatLngs), { padding: [40, 40], maxZoom: 6, animate: true });
    } else {
      oppMap.setView([0, 20], 3, { animate: true });
    }
  }

  /* ================================================================
     SEO — JobPosting JSON-LD schema (injected when jobs render)
  ================================================================= */
  function injectJobPostingSchema(jobs) {
    const schema = jobs.slice(0, 10).map(j => ({
      '@context':         'https://schema.org',
      '@type':            'JobPosting',
      'title':            j.title,
      'description':      j.description,
      'datePosted':       j.posted,
      'validThrough':     j.deadline,
      'employmentType':   j.type === 'jobs' ? 'FULL_TIME' : j.type === 'internship' ? 'INTERN' : 'CONTRACTOR',
      'hiringOrganization': { '@type': 'Organization', 'name': j.organisation },
      'jobLocation': {
        '@type': 'Place',
        'address': {
          '@type':           'PostalAddress',
          'addressLocality': j.location,
          'addressCountry':  j.country,
        },
      },
      'baseSalary': j.salary && j.salary !== 'Not specified' ? {
        '@type': 'MonetaryAmount', 'currency': 'USD', 'value': j.salary,
      } : undefined,
    }));
    const el = document.getElementById('jobposting-schema');
    if (el) el.textContent = JSON.stringify(schema);
  }

  /* ================================================================
     VIEW & CLICK TRACKING — stored locally + Supabase
  ================================================================= */
  const TRACK_KEY = 'afrorama_opp_tracking';

  function trackView(jobId) {
    const t = JSON.parse(localStorage.getItem(TRACK_KEY) || '{}');
    if (!t[jobId]) t[jobId] = { views: 0, clicks: 0 };
    const alreadySeen = t[jobId].views > 0;
    t[jobId].views++;
    localStorage.setItem(TRACK_KEY, JSON.stringify(t));

    const Supa = window.AfroramaSupabase;
    if (Supa && !Supa.isDemoMode()) {
      const sb   = Supa.getSupabase();
      const user = window.AfroramaAuth?.getCurrentUser?.();

      sb.rpc('increment_views', { listing_id: jobId }).catch(() => {
        sb.from('listings').select('views').eq('id', jobId).single()
          .then(({ data }) => {
            if (data) sb.from('listings').update({ views: (data.views || 0) + 1 }).eq('id', jobId);
          });
      });

      if (!alreadySeen) {
        const params   = new URLSearchParams(location.search);
        const referrer = document.referrer ? (new URL(document.referrer).hostname) : 'direct';
        sb.from('view_events').insert({
          listing_id: jobId,
          user_id:    user?.id || null,
          source:     params.get('utm_source') || referrer,
          medium:     params.get('utm_medium') || null,
          device:     /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
          timezone:   Intl.DateTimeFormat().resolvedOptions().timeZone || null,
        }).catch(() => {});
      }

      if (typeof gtag === 'function') {
        const job = allJobs.find(j => j.id === jobId);
        gtag('event', 'view_listing', {
          listing_id:   jobId,
          listing_title: job?.title,
          organisation:  job?.organisation,
          listing_type:  job?.type,
          country:       job?.country,
        });
      }
    }
  }

  function trackApplyClick(jobId) {
    // Save locally (deduplication guard)
    const t = JSON.parse(localStorage.getItem(TRACK_KEY) || '{}');
    if (!t[jobId]) t[jobId] = { views: 0, clicks: 0 };
    t[jobId].clicks++;
    localStorage.setItem(TRACK_KEY, JSON.stringify(t));

    // Increment apply_clicks counter
    const Supa = window.AfroramaSupabase;
    if (Supa && !Supa.isDemoMode()) {
      const sb   = Supa.getSupabase();
      const user = window.AfroramaAuth?.getCurrentUser?.();

      // Increment counter
      sb.rpc('increment_apply_clicks', { listing_id: jobId }).catch(() => {
        sb.from('listings').select('apply_clicks').eq('id', jobId).single()
          .then(({ data }) => {
            if (data) sb.from('listings').update({ apply_clicks: (data.apply_clicks || 0) + 1 }).eq('id', jobId);
          });
      });

      // Log rich event
      const params   = new URLSearchParams(location.search);
      const referrer = document.referrer ? (new URL(document.referrer).hostname) : 'direct';
      sb.from('apply_events').insert({
        listing_id: jobId,
        user_id:    user?.id || null,
        source:     params.get('utm_source') || referrer,
        medium:     params.get('utm_medium') || null,
        device:     /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
        timezone:   Intl.DateTimeFormat().resolvedOptions().timeZone || null,
      });
    }
  }

  /* ================================================================
     FILTERING  — triggers map marker update on every change
  ================================================================= */
  const state = { types: new Set(), regions: new Set(), query: '', sort: 'newest', remoteOnly: false };

  function applyFilters() {
    let jobs = [...allJobs];

    if (activeCountry) jobs = jobs.filter(j => j.country === activeCountry);
    if (state.types.size) jobs = jobs.filter(j => state.types.has(j.type));
    if (state.regions.size) {
      const ids = new Set(AFRICAN_COUNTRIES.filter(c => state.regions.has(c.region)).map(c => c.id));
      jobs = jobs.filter(j => ids.has(j.country));
    }
    if (state.remoteOnly) jobs = jobs.filter(j => (j.location || '').toLowerCase().includes('remote'));
    if (state.query) {
      const q = state.query.toLowerCase();
      jobs = jobs.filter(j =>
        j.title.toLowerCase().includes(q) ||
        j.organisation.toLowerCase().includes(q) ||
        j.sector.toLowerCase().includes(q) ||
        j.location.toLowerCase().includes(q)
      );
    }
    jobs.sort((a, b) => {
      // Featured listings always pin to the top, regardless of sort order
      if (!!b.paid_listing !== !!a.paid_listing) return b.paid_listing ? 1 : -1;
      if (state.sort === 'newest')   return new Date(b.posted) - new Date(a.posted);
      if (state.sort === 'deadline') return (a.deadline ? new Date(a.deadline) : Infinity) - (b.deadline ? new Date(b.deadline) : Infinity);
      if (state.sort === 'title')    return a.title.localeCompare(b.title);
      return 0;
    });

    renderJobs(jobs);
    renderActiveFilters();
    updateTypeCounts();
    updateMapMarkers(jobs);   // ← map reflects filtered results
  }

  /* ================================================================
     RENDER JOB CARDS  — with bookmark button when signed in
  ================================================================= */
  function renderJobs(jobs) {
    const list    = document.getElementById('jobs-list');
    const counter = document.getElementById('results-count');
    if (!list) return;

    if (counter) counter.innerHTML = `<strong>${jobs.length}</strong> opportunit${jobs.length === 1 ? 'y' : 'ies'} found`;

    if (jobs.length === 0) {
      list.innerHTML = `
        <div class="no-results">
          <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <h3>No opportunities found</h3>
          <p>Try adjusting your filters or search term.</p>
        </div>`;
      return;
    }

    list.innerHTML = jobs.map(j => {
      const days    = daysUntil(j.deadline);
      const urgent  = days <= 7;
      const t       = TYPES[j.type] || { label: j.type, color: '#888', text: '#fff', icon: '📋' };
      const country = AFRICAN_COUNTRIES.find(c => c.id === j.country);
      const bgCol   = orgColour(j.organisation);
      const inits   = orgInitials(j.organisation);
      const saved   = Auth?.isSaved(j.id);
      return `
        <article class="job-card type-${j.type}" role="button" tabindex="0" data-id="${j.id}" aria-label="${esc(j.title)} at ${esc(j.organisation)}">
          <div class="job-card-left">
            <div class="job-card-logo-row">
              <div class="job-card-logo ${j.logo_url ? '' : 'logo-fallback'}" style="background:${bgCol}" aria-hidden="true">
                <img class="org-logo-img" data-org="${esc(j.organisation)}" alt="${esc(j.organisation)}" ${j.logo_url ? `src="${esc(j.logo_url)}"` : 'style="display:none"'} onerror="this.style.display='none';this.closest('.job-card-logo').classList.add('logo-fallback')">
                <span class="initials">${inits}</span>
              </div>
              <div class="job-card-org">${esc(j.organisation)}</div>
            </div>
            <h3>${esc(j.title)}</h3>
            <div class="job-card-meta">
              <span class="job-card-meta-item">
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                ${esc(j.location)}${country ? ', ' + esc(country.name) : ''}
              </span>
              <span class="job-card-meta-item">
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1"/></svg>
                ${esc(j.salary)}
              </span>
              <span class="job-card-meta-item">
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5"/></svg>
                ${esc(j.sector)}
              </span>
            </div>
            <div class="job-card-tags">
              ${j.paid_listing ? '<span class="badge badge-featured">★ Featured</span>' : ''}
              <span class="badge badge-${j.type}">${t.icon} ${t.label}</span>
            </div>
          </div>
          <div class="job-card-right">
            <span class="deadline-pill ${urgent ? 'urgent' : 'normal'}">
              ${urgent ? '⚠ ' : ''}<svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              ${days}d left
            </span>
            <span class="posted-date">Posted ${formatDate(j.posted)}</span>
            ${currentUser ? `
            <button class="bookmark-btn ${saved ? 'saved' : ''}" data-job-id="${j.id}" aria-label="${saved ? 'Unsave' : 'Save'} ${esc(j.title)}" title="${saved ? 'Saved to profile' : 'Save to profile'}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="${saved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>
              ${saved ? 'Saved' : 'Save'}
            </button>` : ''}
          </div>
        </article>`;
    }).join('');

    // Inject SEO JobPosting schema for the visible set
    injectJobPostingSchema(jobs);

    // Async-load org logos by name
    loadOrgLogos(jobs);

    // Card click → modal (ignore bookmark clicks)
    list.querySelectorAll('.job-card').forEach(card => {
      card.addEventListener('click', e => {
        if (e.target.closest('.bookmark-btn')) return;
        openModal(card.dataset.id);
      });
      card.addEventListener('keydown', e => {
        if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('.bookmark-btn')) {
          e.preventDefault(); openModal(card.dataset.id);
        }
      });
    });

    // Bookmark buttons
    if (currentUser) {
      list.querySelectorAll('.bookmark-btn').forEach(btn => {
        btn.addEventListener('click', async e => {
          e.stopPropagation();
          const jobId   = btn.dataset.jobId;
          const job     = allJobs.find(j => j.id === jobId);
          const wasSaved = btn.classList.contains('saved');
          btn.classList.toggle('saved', !wasSaved);
          btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="${!wasSaved?'currentColor':'none'}" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg> ${!wasSaved?'Saved':'Save'}`;
          if (wasSaved) {
            await Auth?.unsaveJob(currentUser.id, jobId);
          } else {
            await Auth?.saveJob(currentUser.id, jobId, job);
          }
        });
      });
    }
  }

  function updateTypeCounts() {
    const jobs = allJobs;
    Object.keys(TYPES).forEach(type => {
      const el = document.getElementById('filter-count-' + type);
      if (el) el.textContent = jobs.filter(j => j.type === type).length;
    });
  }

  function renderActiveFilters() {
    const bar = document.getElementById('active-filters');
    if (!bar) return;
    const tags = [];
    state.types.forEach(t   => tags.push({ label: TYPES[t].label, remove: () => { state.types.delete(t); document.querySelector(`[data-filter-type="${t}"]`).checked = false; applyFilters(); } }));
    state.regions.forEach(r => tags.push({ label: r, remove: () => { state.regions.delete(r); document.querySelector(`[data-filter-region="${r}"]`).checked = false; applyFilters(); } }));
    if (activeCountry) {
      const c = AFRICAN_COUNTRIES.find(c => c.id === activeCountry);
      if (c) tags.push({ label: '📍 ' + c.name, remove: () => { activeCountry = null; document.getElementById('map-reset-btn').style.display = 'none'; applyFilters(); } });
    }
    if (state.remoteOnly) tags.push({ label: '🏠 Remote only', remove: () => { state.remoteOnly = false; document.getElementById('filter-remote-only').checked = false; applyFilters(); } });
    if (state.query) tags.push({ label: `"${state.query}"`, remove: () => { state.query = ''; document.getElementById('search-filter').value = ''; applyFilters(); } });
    if (tags.length === 0) { bar.innerHTML = ''; return; }
    bar.innerHTML = '<span class="active-filters-label">Filters:</span>' + tags.map((tag, i) =>
      `<button class="active-filter-tag" data-tag-i="${i}">${esc(tag.label)} <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2"><line x1="2" y1="2" x2="8" y2="8"/><line x1="8" y1="2" x2="2" y2="8"/></svg></button>`
    ).join('');
    bar.querySelectorAll('.active-filter-tag').forEach(btn => {
      btn.addEventListener('click', () => tags[+btn.dataset.tagI].remove());
    });
  }

  /* ================================================================
     MODAL
  ================================================================= */
  function openModal(id) {
    const job = allJobs.find(j => j.id === id);
    if (!job) return;
    trackView(id);
    const t       = TYPES[job.type];
    const country = AFRICAN_COUNTRIES.find(c => c.id === job.country);
    const days    = daysUntil(job.deadline);
    const urgent  = days <= 7;
    document.getElementById('modal-org').textContent   = job.organisation;
    document.getElementById('modal-title').textContent = job.title;
    document.getElementById('modal-type').innerHTML    = `${job.paid_listing ? '<span class="badge badge-featured">★ Featured</span> ' : ''}<span class="badge badge-${job.type}">${t.icon} ${t.label}</span>`;
    // Show "City, Country" but avoid "Kenya, Kenya" if location already is the country
    const locationText = country && job.location !== country.name
      ? `${job.location}, ${country.name}`
      : (country ? country.name : job.location);
    document.getElementById('modal-location').textContent = locationText;
    document.getElementById('modal-deadline').innerHTML = `<span class="${urgent ? 'deadline-pill urgent' : ''}">${formatDate(job.deadline)}${urgent ? ' (' + days + 'd left)' : ''}</span>`;
    document.getElementById('modal-salary').textContent  = job.salary;
    document.getElementById('modal-sector').textContent  = job.sector;
    const expEl = document.getElementById('modal-experience');
    if (expEl) expEl.textContent = job.experience || '—';
    document.getElementById('modal-posted').textContent  = formatDate(job.posted);
    document.getElementById('modal-description').innerHTML = formatAsHtml(job.description);

    // Share button
    const shareBtn = document.getElementById('modal-share-btn');
    if (shareBtn) {
      shareBtn.onclick = async () => {
        const shareUrl = `${location.origin}${location.pathname}?job=${encodeURIComponent(id)}&utm_source=afrorama&utm_medium=share`;
        const shareData = { title: job.title, text: `${job.title} at ${job.organisation}`, url: shareUrl };
        if (navigator.share && navigator.canShare?.(shareData)) {
          await navigator.share(shareData);
        } else {
          await navigator.clipboard.writeText(shareUrl);
          const orig = shareBtn.textContent;
          shareBtn.textContent = '✓ Link copied!';
          setTimeout(() => { shareBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg> Share'; }, 2000);
        }
      };
    }

    // Save button in modal footer
    const saveBtn = document.getElementById('modal-save-btn');
    if (saveBtn && currentUser) {
      const saved = Auth?.isSaved(id);
      saveBtn.textContent = saved ? '✓ Saved to profile' : '+ Save to profile';
      saveBtn.classList.toggle('saved', !!saved);
      saveBtn.style.display = 'inline-flex';
      saveBtn.onclick = async () => {
        const nowSaved = saveBtn.classList.contains('saved');
        if (nowSaved) {
          await Auth?.unsaveJob(currentUser.id, id);
          saveBtn.textContent = '+ Save to profile';
        } else {
          await Auth?.saveJob(currentUser.id, id, job);
          saveBtn.textContent = '✓ Saved to profile';
        }
        saveBtn.classList.toggle('saved');
        // Refresh bookmark button on card too
        const cardBtn = document.querySelector(`.bookmark-btn[data-job-id="${id}"]`);
        if (cardBtn) cardBtn.click(); // re-trigger to sync state
      };
    } else if (saveBtn) {
      saveBtn.style.display = 'none';
    }

    // Apply Now button — UTM link + click tracking
    const applyBtn = document.getElementById('modal-apply-btn');
    if (applyBtn) {
      const dest = job.apply_url || job.utm_url || '#';
      if (job.bitly_url) {
        applyBtn.href = job.bitly_url; // Use Bitly short link if available
      } else if (dest !== '#') {
        // Build UTM link on the fly
        const campaign = encodeURIComponent((job.organisation||'afrorama').toLowerCase().replace(/\s+/g,'-'));
        const content  = encodeURIComponent((job.title||'job').toLowerCase().replace(/\s+/g,'-').slice(0,40));
        const sep = dest.includes('?') ? '&' : '?';
        applyBtn.href = `${dest}${sep}utm_source=afrorama&utm_medium=jobboard&utm_campaign=${campaign}&utm_content=${content}`;
      } else {
        applyBtn.href = '#';
      }
      applyBtn.onclick = () => { trackApplyClick(id); };
    }

    // Report issue button — flags broken link / expired deadline / wrong details
    const reportBtn = document.getElementById('modal-report-btn');
    if (reportBtn) {
      // Reset state each time a (possibly different) listing's modal opens —
      // this button is a single reused DOM element, not recreated per job.
      reportBtn.disabled = false;
      reportBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> Report issue';
      reportBtn.onclick = async () => {
        const reason = prompt('What\'s wrong with this listing? (e.g. "link broken", "deadline already passed", "wrong location")', 'Deadline already passed or link broken');
        if (reason === null) return; // user cancelled
        reportBtn.disabled = true;
        reportBtn.textContent = 'Reporting…';
        try {
          await fetch('https://vqchwioyhyiuunpyildz.supabase.co/functions/v1/report-listing', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              listingId:    job.id,
              title:        job.title,
              organisation: job.organisation,
              applyUrl:     job.apply_url,
              reason,
            }),
          });
          reportBtn.innerHTML = '✓ Reported — thank you';
        } catch (err) {
          console.error('[opportunities] report-listing failed:', err);
          reportBtn.textContent = 'Report issue';
          reportBtn.disabled = false;
        }
      };
    }

    document.getElementById('modal-backdrop').classList.add('open');
    document.body.style.overflow = 'hidden';
    // Update URL so this job is shareable/bookmarkable
    const shareUrl = `${location.pathname}?job=${encodeURIComponent(id)}`;
    history.replaceState(null, '', shareUrl);
  }

  function closeModal() {
    document.getElementById('modal-backdrop').classList.remove('open');
    document.body.style.overflow = '';
    // Restore clean URL when modal closes
    history.replaceState(null, '', location.pathname);
  }

  /* ================================================================
     INIT
  ================================================================= */
  async function init() {
    // Show loading state
    const listEl = document.getElementById('jobs-list');
    if (listEl) listEl.innerHTML = '<div style="text-align:center;padding:48px 24px;color:var(--gray-dark)">Loading opportunities…</div>';

    // Check auth state for bookmark buttons
    if (Auth) {
      currentUser = await Auth.getUser().catch(() => null);
    }

    // Load listings from Supabase (falls back to static data)
    allJobs = await loadListings();

    buildLeafletMap();
    updateTypeCounts();

    // Pre-filter for country landing pages (e.g. jobs-kenya.html has data-country="KE")
    const prefilterCountry = document.body.dataset.country;
    if (prefilterCountry) activeCountry = prefilterCountry;

    // Set header count now that allJobs is loaded
    const headerCount = document.getElementById('opp-header-count');
    if (headerCount) headerCount.textContent = allJobs.length;

    applyFilters();

    // Deep-link: auto-open modal if ?job=ID is in the URL
    const deepJobId = new URLSearchParams(location.search).get('job');
    if (deepJobId) {
      const deepJob = allJobs.find(j => String(j.id) === deepJobId);
      if (deepJob) setTimeout(() => openModal(deepJob.id), 300);
    }

    // Type filters
    document.querySelectorAll('[data-filter-type]').forEach(cb => {
      cb.addEventListener('change', () => {
        cb.checked ? state.types.add(cb.dataset.filterType) : state.types.delete(cb.dataset.filterType);
        applyFilters();
      });
    });

    // Region filters
    document.querySelectorAll('[data-filter-region]').forEach(cb => {
      cb.addEventListener('change', () => {
        cb.checked ? state.regions.add(cb.dataset.filterRegion) : state.regions.delete(cb.dataset.filterRegion);
        applyFilters();
      });
    });

    // Remote-only filter
    document.getElementById('filter-remote-only')?.addEventListener('change', e => {
      state.remoteOnly = e.target.checked;
      applyFilters();
    });

    // Clear buttons
    document.getElementById('clear-types')?.addEventListener('click', () => {
      state.types.clear();
      document.querySelectorAll('[data-filter-type]').forEach(cb => cb.checked = false);
      applyFilters();
    });
    document.getElementById('clear-regions')?.addEventListener('click', () => {
      state.regions.clear();
      document.querySelectorAll('[data-filter-region]').forEach(cb => cb.checked = false);
      applyFilters();
    });

    // Search with scroll-to-results
    const searchEl = document.getElementById('search-filter');
    if (searchEl) {
      let t;
      searchEl.addEventListener('input', () => {
        clearTimeout(t);
        t = setTimeout(() => {
          state.query = searchEl.value.trim();
          applyFilters();
          if (state.query) document.getElementById('jobs-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
      });
    }

    // Sort
    document.getElementById('sort-select')?.addEventListener('change', e => {
      state.sort = e.target.value;
      applyFilters();
    });

    // Map reset
    document.getElementById('map-reset-btn')?.addEventListener('click', () => {
      activeCountry = null;
      document.getElementById('map-reset-btn').style.display = 'none';
      applyFilters();
    });

    // Modal
    document.getElementById('modal-backdrop')?.addEventListener('click', e => { if (e.target.id === 'modal-backdrop') closeModal(); });
    document.getElementById('modal-close-btn')?.addEventListener('click', closeModal);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

    // URL params
    const params    = new URLSearchParams(location.search);
    const q         = params.get('q');
    const type      = params.get('type');
    const countryP  = params.get('country');
    if (q)       { state.query = q; const el = document.getElementById('search-filter'); if (el) el.value = q; }
    if (type && TYPES[type]) { state.types.add(type); const cb = document.querySelector(`[data-filter-type="${type}"]`); if (cb) cb.checked = true; }
    if (countryP) { activeCountry = countryP; document.getElementById('map-reset-btn').style.display = 'inline-flex'; }
    if (q || type || countryP) applyFilters();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  function esc(str) {
    return String(str).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]);
  }

  function formatAsHtml(text) {
    if (!text) return '';
    // Split at the disclaimer separator line
    const [main, disclaimerRaw] = text.split(/\n─+\n/);
    const lines = (main || '').split('\n').map(l => l.trim()).filter(Boolean);
    let html = '';
    if (lines.length === 0) {
      html = `<p>${esc(text)}</p>`;
    } else if (lines.length === 1) {
      html = `<p>${esc(lines[0].replace(/^[•\-\*]\s*/, ''))}</p>`;
    } else {
      html = '<ul>' + lines.map(l => `<li>${esc(l.replace(/^[•\-\*]\s*/, ''))}</li>`).join('') + '</ul>';
    }
    if (disclaimerRaw) {
      html += `<p class="modal-disclaimer">${esc(disclaimerRaw.trim())}</p>`;
    }
    return html;
  }
})();
