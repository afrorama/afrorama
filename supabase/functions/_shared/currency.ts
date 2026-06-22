/**
 * Afrorama — shared salary-text parsing + USD conversion.
 *
 * Scraped salary text is freeform ("USD 50k/year", "Kshs.4.3m/year",
 * "CHF 3k/month", "Negotiable", "not disclosed", "unpaid"...). This module
 * extracts a single comparable annual-USD figure where one genuinely
 * exists, and returns null otherwise — vague text is skipped rather than
 * guessed at, consistent with the rest of this codebase's approach to
 * scraped data.
 *
 * Fixed FX rates (approx., updated periodically) are used instead of a
 * live FX API: Salary Intelligence compares relative pay levels, not
 * exact daily exchange rates, and a fixed table keeps every scraper run
 * deterministic with no extra network call or API key.
 */

export const FX_TO_USD: Record<string, number> = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.27,
  CHF: 1.12,
  CFH: 1.12, // common typo for CHF seen in scraped/manual data
  KES: 0.0077,  // Kenyan Shilling
  NGN: 0.00065, // Nigerian Naira
  ZAR: 0.054,   // South African Rand
  GHS: 0.067,   // Ghanaian Cedi
  UGX: 0.00027, // Ugandan Shilling
  TZS: 0.00038, // Tanzanian Shilling
  EGP: 0.021,   // Egyptian Pound
  XOF: 0.0017,  // West African CFA franc
  XAF: 0.0017,  // Central African CFA franc
  ETB: 0.0089,  // Ethiopian Birr
  RWF: 0.00076, // Rwandan Franc
  ZMW: 0.038,   // Zambian Kwacha
  MWK: 0.00058, // Malawian Kwacha
  MZN: 0.0157,  // Mozambican Metical
  BWP: 0.075,   // Botswana Pula
  NAD: 0.054,   // Namibian Dollar
  CAD: 0.74,
  AUD: 0.66,
};

// Aliases / symbols mapped to their ISO code.
const CURRENCY_ALIASES: Record<string, string> = {
  '$': 'USD', 'us$': 'USD', 'usd': 'USD',
  '€': 'EUR', 'eur': 'EUR',
  '£': 'GBP', 'gbp': 'GBP',
  'chf': 'CHF', 'cfh': 'CFH',
  'kes': 'KES', 'ksh': 'KES', 'kshs': 'KES', 'ksh.': 'KES', 'kshs.': 'KES',
  'ngn': 'NGN', '₦': 'NGN',
  'zar': 'ZAR', 'r': 'ZAR',
  'ghs': 'GHS', 'gh₵': 'GHS',
  'ugx': 'UGX',
  'tzs': 'TZS',
  'egp': 'EGP',
  'xof': 'XOF', 'cfa': 'XOF',
  'xaf': 'XAF',
  'etb': 'ETB',
  'rwf': 'RWF',
  'zmw': 'ZMW',
  'mwk': 'MWK',
  'mzn': 'MZN',
  'bwp': 'BWP',
  'nad': 'NAD',
  'cad': 'CAD',
  'aud': 'AUD',
};

// Phrases that mean "no usable number here" — skip entirely.
const VAGUE_PATTERNS = [
  'not disclosed', 'not applicable', 'n/a', 'na', 'see below', 'see listing',
  'competitive', 'negotiable', 'commensurate', 'tbd', 'to be discussed',
  'not specified', 'undisclosed',
];

const UNPAID_PATTERNS = ['unpaid', 'volunteer', 'no compensation', 'no salary'];

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/,/g, '').trim();
  const m = cleaned.match(/^([\d.]+)\s*([km])?$/i);
  if (!m) return null;
  let n = parseFloat(m[1]);
  if (isNaN(n)) return null;
  const suffix = m[2]?.toLowerCase();
  if (suffix === 'k') n *= 1_000;
  if (suffix === 'm') n *= 1_000_000;
  return n;
}

export interface ParsedSalary {
  amountUSD: number;
  unpaid: boolean;
}

/**
 * Parses freeform scraped salary text into an annual USD figure.
 * Returns null when the text is empty, vague, or otherwise unparseable —
 * callers should skip inserting a salary_submissions row in that case.
 */
export function parseSalaryToUSD(text: string | null | undefined): ParsedSalary | null {
  if (!text) return null;
  const t = text.trim().toLowerCase();
  if (!t) return null;

  if (UNPAID_PATTERNS.some(p => t.includes(p))) return { amountUSD: 0, unpaid: true };
  if (VAGUE_PATTERNS.some(p => t.includes(p))) return null;

  // Currency code/symbol — longest alias first so "kshs." beats "ks".
  const aliasKeys = Object.keys(CURRENCY_ALIASES).sort((a, b) => b.length - a.length);
  const aliasPattern = aliasKeys.map(a => a.replace(/[.$€£₦₵]/g, m => `\\${m}`)).join('|');
  const currencyMatch = t.match(new RegExp(`(${aliasPattern})`, 'i'));
  if (!currencyMatch) return null;
  const currency = CURRENCY_ALIASES[currencyMatch[1].toLowerCase()];
  const rate = FX_TO_USD[currency];
  if (!rate) return null;

  // Period: month/year/week/day/project — project/one-time isn't a comparable rate, skip.
  if (/\/\s*project\b/.test(t)) return null;
  const isMonthly = /\/\s*month\b|\bmonth(ly)?\b/.test(t);
  const isWeekly  = /\/\s*week\b|\bweek(ly)?\b/.test(t);
  const isDaily   = /\/\s*day\b|\bdaily\b/.test(t);

  // Amount or range — take the rest of the string after the currency token.
  const afterCurrency = t.slice(currencyMatch.index! + currencyMatch[1].length);
  const tokens = afterCurrency.match(/[\d.,]+\s*[km]?/gi)?.slice(0, 2) || [];
  if (tokens.length === 0) return null;

  // Shorthand ranges like "41-60k" mean 41k-60k — the suffix on the second
  // number applies to the first too when the first one is bare.
  if (tokens.length === 2) {
    const firstHasSuffix  = /[km]\s*$/i.test(tokens[0]);
    const secondSuffixMatch = tokens[1].match(/([km])\s*$/i);
    if (!firstHasSuffix && secondSuffixMatch) tokens[0] = tokens[0] + secondSuffixMatch[1];
  }

  const parsed = tokens.map(n => parseAmount(n.replace(/\s+/g, ''))).filter((n): n is number => n !== null);
  if (parsed.length === 0) return null;

  // A decreasing range ("70k-12k") almost always signals a typo in the
  // source data rather than a real min-max — safer to skip than guess.
  if (parsed.length === 2 && parsed[1] < parsed[0]) return null;

  const avgRaw = parsed.reduce((s, n) => s + n, 0) / parsed.length;

  let annual = avgRaw;
  if (isMonthly) annual = avgRaw * 12;
  else if (isWeekly) annual = avgRaw * 52;
  else if (isDaily) annual = avgRaw * 260; // ~working days/year

  const amountUSD = Math.round(annual * rate);
  // Sanity floor/ceiling — guards against mis-parses or source-data typos
  // (e.g. a real-world "USD 150" with no /month or /year qualifier).
  if (!amountUSD || amountUSD < 1_000 || amountUSD > 500_000) return null;

  return { amountUSD, unpaid: false };
}

/**
 * Buckets loose seniority/experience text into the fixed bands used by
 * salary.html's filter ("0-1", "2-4", "5-8", "9-14", "15+"). Falls back to
 * 'Not specified' rather than guessing when nothing matches.
 */
export function mapYearsExp(text: string | null | undefined): string {
  if (!text) return 'Not specified';
  const t = text.toLowerCase();

  const rangeMatch = t.match(/(\d+)\s*[-–to]+\s*(\d+)\s*\+?\s*years?/);
  const plusMatch   = t.match(/(\d+)\s*\+\s*years?/);
  const singleMatch = t.match(/(\d+)\s*years?/);

  let years: number | null = null;
  if (rangeMatch) years = (parseInt(rangeMatch[1]) + parseInt(rangeMatch[2])) / 2;
  else if (plusMatch) years = parseInt(plusMatch[1]);
  else if (singleMatch) years = parseInt(singleMatch[1]);

  if (years !== null) {
    if (years <= 1) return '0-1';
    if (years <= 4) return '2-4';
    if (years <= 8) return '5-8';
    if (years <= 14) return '9-14';
    return '15+';
  }

  if (/entry|junior|intern/.test(t))            return '0-1';
  if (/mid[\s-]?level|associate/.test(t))        return '2-4';
  if (/senior|lead/.test(t))                     return '5-8';
  if (/principal|director|head|chief/.test(t))   return '9-14';

  return 'Not specified';
}

interface SalarySubmissionInput {
  company: string;
  position: string;
  salaryText: string | null | undefined;
  experienceText?: string | null;
  sector: string;
  country: string; // ISO2
}

/**
 * Parses a scraped listing's salary text and, only when a clean numeric
 * figure was found, inserts a row into salary_submissions so Salary
 * Intelligence grows from real scraped data over time. Silently does
 * nothing for vague/unparseable salary text — callers don't need to
 * branch on this themselves.
 */
export async function trySubmitSalary(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  input: SalarySubmissionInput,
): Promise<void> {
  const parsed = parseSalaryToUSD(input.salaryText);
  if (!parsed) return;

  const { error } = await supabase.from('salary_submissions').insert({
    company:    input.company,
    position:   input.position,
    salary:     parsed.amountUSD,
    unpaid:     parsed.unpaid,
    years_exp:  mapYearsExp(input.experienceText),
    sector:     input.sector,
    country:    input.country,
    currency:   'USD',
    year:       new Date().getFullYear(),
  });
  if (error) console.warn('[trySubmitSalary] insert failed:', error.message);
}
