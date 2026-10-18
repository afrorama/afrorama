/**
 * Afrorama — server-rendered job page
 *
 * GET /jobs/:id/:slug  (rewritten here by vercel.json)
 *
 * One indexable page per listing, with JobPosting structured data so
 * listings can appear in Google for Jobs. Google only accepts JobPosting
 * on single-job pages, not on list pages.
 *
 *  - unknown id or unpaid listing → 404
 *  - closed listing (deadline passed) → 410, noindex, links to similar roles
 *  - wrong / missing slug → 301 to the canonical URL
 */

const { SUPABASE_URL, ANON_KEY, SITE_URL, PUBLIC_COLUMNS, supa, slugify, jobPath, isActive, countryName, esc, todayISO } = require('./_shared');

const TYPE_LABELS = { jobs: 'Job', internship: 'Internship & Volunteering', consultancy: 'Consultancy', capacity: 'Fellowship' };
const EMPLOYMENT_TYPES = { internship: 'INTERN', consultancy: 'CONTRACTOR', capacity: 'OTHER' };

// ISO → /ngo-jobs-<slug> landing page, when one exists
const COUNTRY_PAGES = {
  KE: 'kenya', GH: 'ghana', NG: 'nigeria', RW: 'rwanda', UG: 'uganda', ZM: 'zambia', TZ: 'tanzania',
  ET: 'ethiopia', SN: 'senegal', MA: 'morocco', ZA: 'south-africa', CD: 'drc', SD: 'sudan',
  SS: 'south-sudan', TD: 'chad', MZ: 'mozambique', SO: 'somalia', ML: 'mali', CI: 'cote-divoire',
  CM: 'cameroon', BF: 'burkina-faso', MW: 'malawi',
};

const isEmail = s => /^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(String(s || '').trim());
const isRemote = job => /remote/i.test(job.location || '');

function placeLabel(job) {
  if (isRemote(job)) return 'Remote';
  const loc = (job.location || '').trim();
  const country = countryName(job.country);
  if (!loc || loc === '-' || /multiple/i.test(loc)) return country || 'Africa';
  return loc.toLowerCase().includes(country.toLowerCase()) ? loc : `${loc}, ${country}`;
}

function applyHref(job) {
  const dest = (job.apply_url || '').trim();
  if (job.bitly_url) return job.bitly_url;
  if (!dest) return null;
  if (isEmail(dest)) return `mailto:${dest}?subject=${encodeURIComponent(`Application: ${job.title} (via afrorama)`)}`;
  if (!/^https?:\/\//i.test(dest)) return null;
  const campaign = encodeURIComponent((job.organisation || 'afrorama').toLowerCase().replace(/\s+/g, '-'));
  const content  = encodeURIComponent((job.title || 'job').toLowerCase().replace(/\s+/g, '-').slice(0, 40));
  return `${dest}${dest.includes('?') ? '&' : '?'}utm_source=afrorama&utm_medium=jobboard&utm_campaign=${campaign}&utm_content=${content}`;
}

// Plain text (bullets + blank-line paragraphs) → safe HTML. Any tags in
// scraped text are stripped first, then everything is escaped.
function textToHtml(text) {
  const clean = String(text || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|li|div|h\d)>/gi, '\n').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\r/g, '');
  const out = [];
  let list = [];
  const flush = () => { if (list.length) { out.push(`<ul>${list.map(li => `<li>${esc(li)}</li>`).join('')}</ul>`); list = []; } };
  for (const block of clean.split(/\n{2,}/)) {
    for (const raw of block.split('\n')) {
      const line = raw.trim();
      if (!line) continue;
      const m = line.match(/^[•\-*–·]\s*(.+)$/);
      if (m) { list.push(m[1]); continue; }
      flush();
      out.push(`<p>${esc(line)}</p>`);
    }
    flush();
  }
  return out.join('\n');
}

function jobPostingLd(job, url, descHtml) {
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: descHtml,
    datePosted: job.posted || (job.created_at || '').slice(0, 10),
    hiringOrganization: { '@type': 'Organization', name: job.organisation },
    identifier: { '@type': 'PropertyValue', name: 'afrorama', value: job.id },
    url,
    directApply: false,
  };
  if (job.org_domain) ld.hiringOrganization.sameAs = `https://${job.org_domain.replace(/^https?:\/\//, '')}`;
  if (job.deadline) ld.validThrough = `${job.deadline}T23:59:59Z`;
  if (EMPLOYMENT_TYPES[job.type]) ld.employmentType = EMPLOYMENT_TYPES[job.type];
  if (isRemote(job)) {
    ld.jobLocationType = 'TELECOMMUTE';
    if (job.country) ld.applicantLocationRequirements = { '@type': 'Country', name: countryName(job.country) };
  } else {
    const loc = (job.location || '').trim();
    ld.jobLocation = {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        ...(loc && loc !== '-' && !/multiple/i.test(loc) ? { addressLocality: loc } : {}),
        addressCountry: job.country,
      },
    };
  }
  // Escape "<" so description HTML can't close the script tag
  return JSON.stringify(ld).replace(/</g, '\\u003c');
}

function daysLeft(deadline) {
  if (!deadline) return null;
  return Math.ceil((new Date(`${deadline}T23:59:59Z`) - Date.now()) / 86400000);
}

function shell({ title, description, canonical, robots, body, ld, ogTitle }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-2VQCQTDVQG"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag("js",new Date());gtag("config","G-2VQCQTDVQG");</script>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta name="robots" content="${robots}">
  ${canonical ? `<link rel="canonical" href="${esc(canonical)}">` : ''}
  <meta property="og:type" content="website">
  ${canonical ? `<meta property="og:url" content="${esc(canonical)}">` : ''}
  <meta property="og:title" content="${esc(ogTitle || title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:image" content="${SITE_URL}/assets/hero.jpg">
  <meta property="og:site_name" content="Afrorama">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/main.css">
  ${ld ? `<script type="application/ld+json">${ld}</script>` : ''}
  <style>
    .job-page { padding: 40px 0 72px; }
    .job-crumbs { font-size: .8rem; color: var(--gray-dark); margin-bottom: 18px; }
    .job-crumbs a { color: var(--gray-dark); text-decoration: none; }
    .job-crumbs a:hover { color: var(--dark); text-decoration: underline; }
    .job-layout { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 28px; align-items: start; }
    .job-card { background: var(--white); border: 2.5px solid var(--dark); border-radius: var(--radius-lg); box-shadow: 4px 4px 0 var(--dark); padding: 28px; }
    .job-badges { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
    .job-org { font-size: .78rem; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: var(--gray-dark); margin-bottom: 6px; }
    .job-title { font-size: clamp(1.4rem, 3vw, 2rem); font-weight: 800; line-height: 1.2; margin: 0 0 16px; color: var(--dark); }
    .job-facts { display: flex; flex-wrap: wrap; gap: 8px 18px; font-size: .88rem; color: var(--dark-2); margin-bottom: 22px; }
    .job-facts span { display: inline-flex; align-items: center; gap: 5px; }
    .job-body { border-top: 1.5px solid var(--gray-mid); padding-top: 20px; font-size: .95rem; line-height: 1.7; color: #333; overflow-wrap: anywhere; }
    .job-body h2 { font-size: 1.05rem; font-weight: 800; margin: 22px 0 8px; color: var(--dark); }
    .job-body p { margin: 0 0 12px; }
    .job-body ul { margin: 0 0 14px; padding-left: 20px; }
    .job-body li { margin-bottom: 6px; }
    .job-side { display: flex; flex-direction: column; gap: 20px; position: sticky; top: calc(var(--nav-h) + 16px); }
    .job-side .job-card { padding: 22px; }
    .job-side h3 { font-size: .8rem; font-weight: 800; letter-spacing: .07em; text-transform: uppercase; margin: 0 0 12px; color: var(--dark); }
    .job-apply { display: block; text-align: center; width: 100%; }
    .job-deadline { font-size: .82rem; color: var(--gray-dark); text-align: center; margin-top: 10px; }
    .job-deadline.urgent { color: var(--orange-dk); font-weight: 700; }
    .job-similar { list-style: none; margin: 0; padding: 0; }
    .job-similar li { padding: 10px 0; border-top: 1px solid var(--gray-light); }
    .job-similar li:first-child { border-top: none; padding-top: 0; }
    .job-similar a { font-weight: 700; font-size: .88rem; color: var(--dark); text-decoration: none; line-height: 1.35; }
    .job-similar a:hover { text-decoration: underline; }
    .job-similar small { display: block; font-size: .76rem; color: var(--gray-dark); margin-top: 2px; }
    .job-more { display: inline-block; margin-top: 12px; font-size: .84rem; font-weight: 700; color: var(--dark); }
    .job-closed { text-align: center; max-width: 620px; margin: 0 auto; }
    @media (max-width: 860px) {
      .job-layout { grid-template-columns: 1fr; }
      .job-side { position: static; }
      .job-card { padding: 20px; }
    }
  </style>
</head>
<body>
<nav class="nav" id="main-nav" role="navigation" aria-label="Main navigation">
  <div class="nav-inner">
    <a class="nav-logo" href="/" aria-label="Afrorama home">
      <img src="/assets/logo-icon.svg" class="nav-logo-icon" alt="" aria-hidden="true">
      <span class="nav-logo-text">afrorama</span>
    </a>
    <ul class="nav-links" role="list">
      <li><a href="/opportunities">Opportunities</a></li>
      <li><a href="/cv-analyser">No Wahala CV</a></li>
      <li><a href="/salary">Salary Intelligence</a></li>
    </ul>
    <div class="nav-cta-group">
      <a href="/post" class="btn btn-primary btn-sm">Post a role</a>
    </div>
    <button class="nav-hamburger" id="nav-hamburger" aria-label="Open menu" aria-expanded="false" aria-controls="nav-mobile-menu"><span></span><span></span><span></span></button>
  </div>
</nav>
<div class="nav-mobile-menu" id="nav-mobile-menu" role="dialog" aria-label="Mobile menu">
  <a href="/opportunities">Opportunities</a>
  <a href="/cv-analyser">No Wahala CV Booster</a>
  <a href="/salary">Salary Intelligence</a>
  <a href="/post" class="btn btn-primary">Post a role</a>
</div>

<main class="job-page">
  <div class="container">
${body}
  </div>
</main>

<footer class="footer">
  <div class="container">
    <div class="footer-grid">
      <div class="footer-brand">
        <div class="footer-logo">
          <img src="/assets/logo-icon.svg" class="footer-logo-icon" alt="" aria-hidden="true">
          <span style="font-size:1.1rem;font-weight:800;letter-spacing:-.03em;">afrorama</span>
        </div>
        <p>Africa's dedicated platform for social impact careers. Connecting talent with organisations driving meaningful change across all 54 countries.</p>
      </div>
      <div class="footer-col">
        <h5>Platform</h5>
        <ul>
          <li><a href="/opportunities">Opportunities</a></li>
          <li><a href="/job-alerts">Job alerts</a></li>
          <li><a href="/cv-analyser">No Wahala CV</a></li>
          <li><a href="/salary">Salary</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h5>Company</h5>
        <ul>
          <li><a href="/post">Post a Role</a></li>
          <li><a href="mailto:hello@afrorama.org">Contact</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h5>Legal</h5>
        <ul>
          <li><a href="/privacy">Privacy Policy</a></li>
          <li><a href="/terms">Terms of Use</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <span>© 2026 Afrorama. All rights reserved. Founded by Chloé Bertrand.</span>
    </div>
  </div>
</footer>

<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="/js/supabase.js"></script>
<script src="/js/auth.js"></script>
<script src="/js/main.js"></script>
</body>
</html>`;
}

function similarList(similar) {
  if (!similar.length) return '';
  return `<div class="job-card">
        <h3>Similar roles</h3>
        <ul class="job-similar">
          ${similar.map(s => `<li><a href="${esc(jobPath(s))}">${esc(s.title)}</a><small>${esc(s.organisation)} · ${esc(placeLabel(s))}</small></li>`).join('\n          ')}
        </ul>
      </div>`;
}

function moreLink(job) {
  const page = COUNTRY_PAGES[job.country];
  return page
    ? `<a class="job-more" href="/ngo-jobs-${page}">More NGO jobs in ${esc(countryName(job.country))} →</a>`
    : `<a class="job-more" href="/opportunities">Browse all opportunities →</a>`;
}

async function fetchSimilar(job) {
  if (!job.country) return [];
  const today = todayISO();
  try {
    return await supa(
      `listings?select=id,title,organisation,location,country&country=eq.${encodeURIComponent(job.country)}` +
      `&id=neq.${encodeURIComponent(job.id)}&or=(deadline.gte.${today},deadline.is.null)` +
      `&or=(paid_listing.eq.false,payment_confirmed.eq.true)&order=created_at.desc&limit=5`
    );
  } catch { return []; }
}

function send(res, status, html, cache) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', cache);
  res.end(html);
}

function notFoundPage() {
  return shell({
    title: 'Opportunity not found | Afrorama',
    description: 'This opportunity could not be found on Afrorama.',
    robots: 'noindex, follow',
    body: `<div class="job-card job-closed">
      <h1 class="job-title">We couldn't find this opportunity</h1>
      <p>It may have been removed. Browse the latest social impact roles across Africa instead.</p>
      <p><a class="btn btn-primary" href="/opportunities">Browse opportunities →</a></p>
    </div>`,
  });
}

module.exports = async (req, res) => {
  const id = String(req.query.id || '').trim();
  const slug = String(req.query.slug || '').trim();
  if (!id || !/^[A-Za-z0-9_.-]+$/.test(id)) return send(res, 404, notFoundPage(), 'public, s-maxage=300');

  let job;
  try {
    const rows = await supa(`listings?select=${PUBLIC_COLUMNS}&id=eq.${encodeURIComponent(id)}&limit=1`);
    job = rows[0];
  } catch (err) {
    console.error('[job] fetch failed:', err.message);
    return send(res, 503, notFoundPage(), 'no-store');
  }

  if (!job || (job.paid_listing && !job.payment_confirmed)) {
    return send(res, 404, notFoundPage(), 'public, s-maxage=300');
  }

  const path = jobPath(job);
  const canonical = `${SITE_URL}${path}`;
  if (slug !== path.split('/').pop()) {
    res.statusCode = 301;
    res.setHeader('Location', path);
    res.setHeader('Cache-Control', 'public, s-maxage=86400');
    return res.end();
  }

  const place = placeLabel(job);
  const typeLabel = TYPE_LABELS[job.type] || 'Opportunity';
  const similar = await fetchSimilar(job);

  // Closed listing: 410 + noindex so Google drops it, but keep it useful for people
  if (!isActive(job)) {
    const body = `<div class="job-closed">
      <div class="job-card">
        <p class="job-org">${esc(job.organisation)}</p>
        <h1 class="job-title">${esc(job.title)}</h1>
        <p><strong>This opportunity has closed.</strong> Here are similar open roles you can still apply for.</p>
        <p><a class="btn btn-primary" href="/job-alerts">Get roles like this by email →</a></p>
      </div>
      ${similar.length ? `<div style="margin-top:20px;text-align:left;">${similarList(similar)}</div>` : ''}
      <p>${moreLink(job)}</p>
    </div>`;
    return send(res, 410, shell({
      title: `${job.title} at ${job.organisation} (closed) | Afrorama`,
      description: `This ${typeLabel.toLowerCase()} at ${job.organisation} has closed. Browse similar social impact opportunities in ${place} on Afrorama.`,
      robots: 'noindex, follow',
      body,
    }), 'public, s-maxage=3600');
  }

  const descHtml = textToHtml(job.description);
  const reqHtml = textToHtml(job.requirements);
  const fullHtml = [descHtml, reqHtml && `<h2>Requirements</h2>${reqHtml}`].filter(Boolean).join('\n');
  const days = daysLeft(job.deadline);
  const deadlineText = days === null ? 'Rolling deadline'
    : days <= 0 ? 'Closes today'
    : `Closes ${new Date(`${job.deadline}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · ${days} day${days === 1 ? '' : 's'} left`;
  const apply = applyHref(job);
  const salary = job.salary && !/^(see listing|tbc|not specified)$/i.test(job.salary.trim()) ? job.salary.trim() : '';
  const plainDesc = String(job.description || '').replace(/<[^>]+>/g, ' ').replace(/[•\s]+/g, ' ').trim();
  const metaDesc = `${job.organisation} is hiring: ${job.title} in ${place}. ${plainDesc}`.slice(0, 155).replace(/\s+\S*$/, '') + '…';

  const body = `<nav class="job-crumbs" aria-label="Breadcrumb">
      <a href="/">Home</a> › <a href="/opportunities">Opportunities</a>${COUNTRY_PAGES[job.country] ? ` › <a href="/ngo-jobs-${COUNTRY_PAGES[job.country]}">${esc(countryName(job.country))}</a>` : ''}
    </nav>
    <div class="job-layout">
      <article class="job-card">
        <div class="job-badges">
          ${job.paid_listing ? '<span class="badge badge-featured"><span class="badge-star">★</span> Featured</span>' : ''}
          <span class="badge badge-${esc(job.type)}">${esc(typeLabel)}</span>
        </div>
        <p class="job-org">${esc(job.organisation)}</p>
        <h1 class="job-title">${esc(job.title)}</h1>
        <div class="job-facts">
          <span>📍 ${esc(place)}</span>
          ${job.sector ? `<span>🏷 ${esc(job.sector)}</span>` : ''}
          ${salary ? `<span>💰 ${esc(salary)}</span>` : ''}
          <span>🗓 Posted ${esc(new Date(`${job.posted || job.created_at.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }))}</span>
        </div>
        <div class="job-body">
          ${fullHtml || '<p>Full details are on the organisation\'s website.</p>'}
        </div>
      </article>
      <aside class="job-side">
        <div class="job-card">
          ${apply
            ? `<a class="btn btn-primary job-apply" id="job-apply" href="${esc(apply)}" target="_blank" rel="noopener">Apply now →</a>`
            : '<p>See the organisation\'s website for how to apply.</p>'}
          <p class="job-deadline${days !== null && days <= 7 ? ' urgent' : ''}">${esc(deadlineText)}</p>
        </div>
        <div class="job-card">
          <h3>Never miss a role</h3>
          <p style="font-size:.86rem;margin:0 0 12px;color:#444;">Get new ${esc(countryName(job.country) || 'African')} opportunities in your inbox every week. Free.</p>
          <a class="btn btn-outline btn-sm" href="/job-alerts">Set up job alerts</a>
        </div>
        ${similarList(similar)}
        <div>${moreLink(job)}</div>
      </aside>
    </div>
    <script>
    (function () {
      var id = ${JSON.stringify(job.id)};
      function rpc(name) {
        fetch(${JSON.stringify(`${SUPABASE_URL}/rest/v1/rpc/`)} + name, {
          method: 'POST', keepalive: true,
          headers: { apikey: ${JSON.stringify(ANON_KEY)}, Authorization: 'Bearer ' + ${JSON.stringify(ANON_KEY)}, 'Content-Type': 'application/json' },
          body: JSON.stringify({ listing_id: id })
        }).catch(function () {});
      }
      rpc('increment_views');
      if (typeof gtag === 'function') gtag('event', 'view_listing', { listing_id: id, listing_title: ${JSON.stringify(job.title)}, organisation: ${JSON.stringify(job.organisation)} });
      var btn = document.getElementById('job-apply');
      if (btn) btn.addEventListener('click', function () {
        rpc('increment_apply_clicks');
        if (typeof gtag === 'function') gtag('event', 'apply_click', { listing_id: id, listing_title: ${JSON.stringify(job.title)}, organisation: ${JSON.stringify(job.organisation)} });
      });
    })();
    </script>`;

  return send(res, 200, shell({
    title: `${job.title} at ${job.organisation} – ${place} | Afrorama`,
    ogTitle: `${job.title} at ${job.organisation}`,
    description: metaDesc,
    canonical,
    robots: 'index, follow',
    body,
    ld: jobPostingLd(job, canonical, fullHtml || `<p>${esc(job.title)} at ${esc(job.organisation)}</p>`),
  }), 'public, s-maxage=3600, stale-while-revalidate=86400');
};
