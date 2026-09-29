/**
 * Shared helpers for the ReliefWeb-backed scrapers (reliefweb-scraper,
 * reliefweb-europe-scraper) — extracting a clean, working "how to apply"
 * URL, and finding African countries named in free text when ReliefWeb's
 * own structured `country` field is empty.
 */

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'");
}

/**
 * Extracts the employer's direct application URL from ReliefWeb's
 * `how_to_apply-html` field, given a ReliefWeb fallback URL to use when no
 * usable direct link exists.
 *
 * Handles two real data issues seen in the wild:
 *  - The raw `href` attribute is HTML-entity-encoded (e.g. `&amp;` instead
 *    of `&`), which a plain regex match captures literally — breaking the
 *    URL's query string when used as-is (e.g. a `?jobId=X&amp;company=Y`
 *    query string reaching the employer's ATS mangled, since `&amp;company`
 *    isn't a valid parameter name).
 *  - Some orgs' own ReliefWeb postings contain a literal data-entry error
 *    where the same URL is pasted twice with no separator (e.g.
 *    `https://...?jobId=14648&company=Xhttps://...?jobId=14648&company=X`)
 *    — detected and repaired by checking whether the string is exactly two
 *    identical halves.
 */
export function extractApplyUrl(howToApplyHtml: string, fallbackUrl: string): string {
  const match = howToApplyHtml.match(/href=["']([^"']+)["']/i);
  let url = match?.[1] ? decodeHtmlEntities(match[1]) : '';

  if (url.length > 0 && url.length % 2 === 0) {
    const half = url.length / 2;
    const firstHalf = url.slice(0, half);
    if (firstHalf === url.slice(half) && firstHalf.startsWith('http')) {
      url = firstHalf;
    }
  }

  if (url && url.startsWith('http') && !url.includes('reliefweb.int')) return url;
  return fallbackUrl;
}

// English + French African country names → ISO2, used to find a country
// mentioned in body/title text when ReliefWeb's own `country` taxonomy
// field is empty (common for multi-country consultancies and flexible-
// location roles) — better than mislabeling those as generic "Europe".
export const AFRICA_TEXT_ISO: Record<string, string> = {
  'algeria':'DZ','algérie':'DZ','angola':'AO','benin':'BJ','bénin':'BJ','botswana':'BW',
  'burkina faso':'BF','burundi':'BI','cabo verde':'CV','cape verde':'CV','cap-vert':'CV',
  'cameroon':'CM','cameroun':'CM','central african republic':'CF','centrafrique':'CF',
  'chad':'TD','tchad':'TD','comoros':'KM','comores':'KM',
  'democratic republic of the congo':'CD','dr congo':'CD','drc':'CD','rdc':'CD',
  'republic of congo':'CG','republique democratique du congo':'CD',
  "cote d'ivoire":'CI','côte d’ivoire':'CI','ivory coast':'CI',
  'djibouti':'DJ','egypt':'EG','égypte':'EG','equatorial guinea':'GQ',
  'eritrea':'ER','eswatini':'SZ','swaziland':'SZ','ethiopia':'ET','éthiopie':'ET',
  'gabon':'GA','gambia':'GM','gambie':'GM','ghana':'GH','guinea-bissau':'GW',
  'guinea':'GN','guinée':'GN','kenya':'KE','lesotho':'LS','liberia':'LR','libéria':'LR',
  'libya':'LY','libye':'LY','madagascar':'MG','malawi':'MW','mali':'ML',
  'mauritania':'MR','mauritanie':'MR','mauritius':'MU','maurice':'MU',
  'morocco':'MA','maroc':'MA','mozambique':'MZ','namibia':'NA','namibie':'NA',
  'niger':'NE','nigeria':'NG','rwanda':'RW','sao tome and principe':'ST',
  'senegal':'SN','sénégal':'SN','seychelles':'SC','sierra leone':'SL',
  'somalia':'SO','somalie':'SO','south africa':'ZA','afrique du sud':'ZA',
  'south sudan':'SS','soudan du sud':'SS','sudan':'SD','soudan':'SD',
  'tanzania':'TZ','tanzanie':'TZ','togo':'TG','tunisia':'TN','tunisie':'TN',
  'uganda':'UG','ouganda':'UG','zambia':'ZM','zambie':'ZM','zimbabwe':'ZW',
};

/**
 * Finds African countries named in free text, in order of first
 * appearance (not alphabetical/map order), for use when there's no
 * structured location data to rely on.
 */
export function findAfricanCountriesInText(text: string): { names: string[]; isos: string[] } {
  const lower = text.toLowerCase();
  const hits: { name: string; iso: string; index: number }[] = [];
  for (const [name, iso] of Object.entries(AFRICA_TEXT_ISO)) {
    const idx = lower.indexOf(name);
    if (idx !== -1) hits.push({ name, iso, index: idx });
  }
  hits.sort((a, b) => a.index - b.index);

  const seenIso = new Set<string>();
  const names: string[] = [];
  const isos: string[] = [];
  for (const h of hits) {
    if (seenIso.has(h.iso)) continue;
    seenIso.add(h.iso);
    names.push(h.name.replace(/\b\w/g, c => c.toUpperCase()));
    isos.push(h.iso);
  }
  return { names, isos };
}
