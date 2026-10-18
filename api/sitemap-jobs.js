/**
 * Afrorama — job sitemap
 *
 * GET /sitemap-jobs.xml (rewritten here by vercel.json)
 *
 * Lists every live listing's job page so Google can find them. Closed
 * listings drop out automatically. Cached at the edge for an hour.
 */

const { SITE_URL, supa, jobPath, todayISO } = require('./_shared');

const PAGE = 1000;

module.exports = async (req, res) => {
  const today = todayISO();
  const rows = [];
  try {
    for (let from = 0; ; from += PAGE) {
      const page = await supa(
        `listings?select=id,title,organisation,posted,created_at` +
        `&or=(deadline.gte.${today},deadline.is.null)&or=(paid_listing.eq.false,payment_confirmed.eq.true)` +
        `&order=created_at.desc&offset=${from}&limit=${PAGE}`
      );
      rows.push(...page);
      if (page.length < PAGE) break;
    }
  } catch (err) {
    console.error('[sitemap-jobs] fetch failed:', err.message);
    res.statusCode = 503;
    res.setHeader('Cache-Control', 'no-store');
    return res.end('Sitemap temporarily unavailable');
  }

  const xmlEsc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const urls = rows.map(j => {
    const lastmod = (j.posted || (j.created_at || '').slice(0, 10)) || today;
    return `  <url><loc>${xmlEsc(SITE_URL + jobPath(j))}</loc><lastmod>${lastmod}</lastmod></url>`;
  });

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  res.end(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`);
};
