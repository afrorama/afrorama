#!/usr/bin/env python3
"""
One-time import: parses Combined_All_Opportunities_2024_2026.csv (historical
job-board data, semicolon-delimited) and generates a SQL INSERT script for
salary_submissions, containing only rows where a real numeric salary was
found. Vague entries ("not disclosed", "Competitive", grade codes with no
number, etc.) are skipped rather than guessed at.

Run: python3 scripts/import_historical_salaries.py
Output: scripts/historical_salaries_insert.sql (paste into Supabase SQL Editor)
"""
import csv
import re
import html
import unicodedata

CSV_PATH = 'Combined_All_Opportunities_2024_2026.csv'
OUT_PATH = 'scripts/historical_salaries_insert.sql'

# ── Currency parsing (mirrors supabase/functions/_shared/currency.ts) ──────
FX_TO_USD = {
    'USD': 1, 'EUR': 1.08, 'GBP': 1.27, 'CHF': 1.12, 'CFH': 1.12,
    'KES': 0.0077, 'NGN': 0.00065, 'ZAR': 0.054, 'GHS': 0.067, 'UGX': 0.00027,
    'TZS': 0.00038, 'EGP': 0.021, 'XOF': 0.0017, 'XAF': 0.0017, 'ETB': 0.0089,
    'RWF': 0.00076, 'ZMW': 0.038, 'MWK': 0.00058, 'MZN': 0.0157, 'BWP': 0.075,
    'NAD': 0.054, 'CAD': 0.74, 'AUD': 0.66,
}
CURRENCY_ALIASES = {
    '$': 'USD', 'us$': 'USD', 'usd': 'USD',
    'eur': 'EUR',
    'gbp': 'GBP',
    'chf': 'CHF', 'cfh': 'CFH',
    'kes': 'KES', 'kshs.': 'KES', 'kshs': 'KES', 'ksh.': 'KES', 'ksh': 'KES',
    'ngn': 'NGN',
    'zar': 'ZAR',
    'ghs': 'GHS',
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
}
VAGUE_PATTERNS = [
    'not disclosed', 'not applicable', 'n/a', 'na', 'see below', 'see listing',
    'competitive', 'negotiable', 'commensurate', 'tbd', 'to be discussed',
    'not specified', 'undisclosed',
]
UNPAID_PATTERNS = ['unpaid', 'volunteer', 'no compensation', 'no salary']

ALIAS_KEYS = sorted(CURRENCY_ALIASES.keys(), key=len, reverse=True)
ALIAS_PATTERN = re.compile(
    '(' + '|'.join(re.escape(k) for k in ALIAS_KEYS) + ')', re.IGNORECASE
)


def parse_amount(raw):
    cleaned = raw.replace(',', '').strip()
    m = re.match(r'^([\d.]+)\s*([km])?$', cleaned, re.IGNORECASE)
    if not m:
        return None
    n = float(m.group(1))
    suffix = (m.group(2) or '').lower()
    if suffix == 'k':
        n *= 1_000
    if suffix == 'm':
        n *= 1_000_000
    return n


def parse_salary_to_usd(text):
    if not text:
        return None
    t = text.strip().lower()
    if not t:
        return None
    if any(p in t for p in UNPAID_PATTERNS):
        return {'amountUSD': 0, 'unpaid': True}
    if any(p in t for p in VAGUE_PATTERNS):
        return None

    m = ALIAS_PATTERN.search(t)
    if not m:
        return None
    currency = CURRENCY_ALIASES[m.group(1).lower()]
    rate = FX_TO_USD.get(currency)
    if not rate:
        return None

    if re.search(r'/\s*project\b', t):
        return None
    is_monthly = bool(re.search(r'/\s*month\b|\bmonth(ly)?\b', t))
    is_weekly = bool(re.search(r'/\s*week\b|\bweek(ly)?\b', t))
    is_daily = bool(re.search(r'/\s*day\b|\bdaily\b', t))

    after = t[m.end():]
    tokens = re.findall(r'[\d.,]+\s*[km]?', after, re.IGNORECASE)[:2]
    if not tokens:
        return None

    if len(tokens) == 2:
        first_has_suffix = bool(re.search(r'[km]\s*$', tokens[0], re.IGNORECASE))
        second_suffix = re.search(r'([km])\s*$', tokens[1], re.IGNORECASE)
        if not first_has_suffix and second_suffix:
            tokens[0] = tokens[0] + second_suffix.group(1)

    parsed = [parse_amount(tok.replace(' ', '')) for tok in tokens]
    parsed = [p for p in parsed if p is not None]
    if not parsed:
        return None
    if len(parsed) == 2 and parsed[1] < parsed[0]:
        return None  # decreasing range -> likely a typo in source data

    avg_raw = sum(parsed) / len(parsed)
    annual = avg_raw
    if is_monthly:
        annual = avg_raw * 12
    elif is_weekly:
        annual = avg_raw * 52
    elif is_daily:
        annual = avg_raw * 260

    amount_usd = round(annual * rate)
    if not amount_usd or amount_usd < 1_000 or amount_usd > 500_000:
        return None
    return {'amountUSD': amount_usd, 'unpaid': False}


def map_years_exp(text):
    if not text:
        return 'Not specified'
    t = text.lower()
    range_m = re.search(r'(\d+)\s*[-–to]+\s*(\d+)\s*\+?\s*years?', t)
    plus_m = re.search(r'(\d+)\s*\+\s*years?', t)
    single_m = re.search(r'(\d+)\s*years?', t)

    years = None
    if range_m:
        years = (int(range_m.group(1)) + int(range_m.group(2))) / 2
    elif plus_m:
        years = int(plus_m.group(1))
    elif single_m:
        years = int(single_m.group(1))

    if years is not None:
        if years <= 1: return '0-1'
        if years <= 4: return '2-4'
        if years <= 8: return '5-8'
        if years <= 14: return '9-14'
        return '15+'

    if re.search(r'entry|junior|intern', t): return '0-1'
    if re.search(r'mid[\s-]?level|associate', t): return '2-4'
    if re.search(r'senior|lead', t): return '5-8'
    if re.search(r'principal|director|head|chief', t): return '9-14'
    return 'Not specified'


# ── Sector classification (keyword match against Title + Description) ─────
SECTOR_KEYWORDS = {
    'Agriculture & Food Security': ['agricultur', 'farm', 'food security', 'food system', 'livestock', 'crop', 'nutrition', 'agribusiness', 'fisher'],
    'Climate & Environment': ['climate', 'environment', 'conservation', 'biodiversity', 'wildlife', 'renewable energy', 'sustainab', 'forest', 'wash', 'water and sanitation'],
    'Education': ['education', 'teacher', 'school', 'curriculum', 'literacy', 'pedagog', 'learning programme', 'university'],
    'Finance & Economics': ['finance', 'economic', 'accounting', 'audit', 'investment', 'microfinance', 'banking', 'budget'],
    'Gender & Social Inclusion': ['gender', 'women', 'girls', 'disability', 'inclusion', 'gbv', 'social inclusion', 'lgbtq'],
    'Governance & Public Policy': ['governance', 'policy', 'public administration', 'civil service', 'parliament', 'electoral', 'anti-corruption', 'rule of law'],
    'Health': ['health', 'medical', 'clinical', 'hiv', 'malaria', 'maternal', 'nurse', 'doctor', 'epidemiol', 'pharma', 'mental health'],
    'Human Rights': ['human rights', 'protection', 'refugee', 'asylum', 'humanitarian', 'displacement', 'advocacy'],
    'Infrastructure & Urban Development': ['infrastructure', 'urban', 'construction', 'housing', 'transport', 'engineer', 'roads'],
    'Innovation & Technology': ['technology', 'digital', 'software', 'data scien', 'ict', 'innovation', 'developer', 'engineer software', 'ai '],
    'Peacebuilding': ['peacebuilding', 'peace', 'conflict resolution', 'mediation', 'stabili', 'security sector'],
    'Private Sector Development': ['private sector', 'entrepreneur', 'sme', 'business development', 'value chain', 'market system'],
    'Youth & Employment': ['youth', 'employment', 'job creation', 'skills training', 'vocational', 'livelihood'],
}


def classify_sector(title, description):
    text = f'{title} {description}'.lower()
    text = html.unescape(re.sub(r'<[^>]+>', ' ', text))
    best_sector, best_score = 'Governance & Public Policy', 0
    for sector, keywords in SECTOR_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in text)
        if score > best_score:
            best_sector, best_score = sector, score
    return best_sector


# ── Country mapping (Location column is mostly clean country names) ───────
COUNTRY_NAME_ISO = {
    'algeria': 'DZ', 'angola': 'AO', 'benin': 'BJ', 'botswana': 'BW',
    'burkina faso': 'BF', 'burundi': 'BI', 'cameroon': 'CM', 'cape verde': 'CV',
    'central african republic': 'CF', 'chad': 'TD', 'comoros': 'KM',
    'republic of congo': 'CG', 'congo': 'CG', 'dr congo': 'CD',
    'democratic republic of the congo': 'CD', 'democratic republic of congo': 'CD',
    "côte d'ivoire": 'CI', "cote d'ivoire": 'CI', 'ivory coast': 'CI',
    'djibouti': 'DJ', 'egypt': 'EG', 'equatorial guinea': 'GQ', 'eritrea': 'ER',
    'eswatini': 'SZ', 'swaziland': 'SZ', 'ethiopia': 'ET', 'gabon': 'GA',
    'gambia': 'GM', 'ghana': 'GH', 'guinea': 'GN', 'guinea-bissau': 'GW',
    'kenya': 'KE', 'lesotho': 'LS', 'liberia': 'LR', 'libya': 'LY',
    'madagascar': 'MG', 'malawi': 'MW', 'mali': 'ML', 'mauritania': 'MR',
    'mauritius': 'MU', 'morocco': 'MA', 'mozambique': 'MZ', 'namibia': 'NA',
    'niger': 'NE', 'nigeria': 'NG', 'rwanda': 'RW',
    'são tomé & príncipe': 'ST', 'sao tome and principe': 'ST',
    'senegal': 'SN', 'sierra leone': 'SL', 'somalia': 'SO',
    'south africa': 'ZA', 'south sudan': 'SS', 'sudan': 'SD', 'tanzania': 'TZ',
    'togo': 'TG', 'tunisia': 'TN', 'uganda': 'UG', 'zambia': 'ZM', 'zimbabwe': 'ZW',
}


def map_country(location):
    if not location:
        return None
    key = location.strip().lower()
    return COUNTRY_NAME_ISO.get(key)


SLUG_PATTERN = re.compile(r'^[a-z0-9]+(-[a-z0-9]+)+$')


def clean_org_name(name):
    """Some source rows store the organisation as a URL slug
    ('foreign-commonwealth-and-development-office') instead of a display
    name. Title-case + de-hyphenate so it reads naturally in the UI.
    Deliberately simple (no acronym guessing) to avoid mis-rendering names
    we can't actually verify."""
    name = name.strip()
    if SLUG_PATTERN.match(name):
        small = {'and', 'of', 'the', 'for', 'in', 'on'}
        words = [w if w in small else w.capitalize() for w in name.split('-')]
        return ' '.join(words)
    return name


def normalize_text(s):
    """Some source rows use stylized Unicode (mathematical bold/italic
    letters from copy-pasted LinkedIn posts) — NFKC normalization maps
    them back to plain ASCII letters."""
    return unicodedata.normalize('NFKC', s or '')


def sql_escape(s):
    if s is None:
        return 'NULL'
    return "'" + str(s).replace("'", "''") + "'"


def main():
    rows_in = 0
    rows_out = []
    with open(CSV_PATH, encoding='utf-8-sig') as f:
        reader = csv.DictReader(f, delimiter=';')
        for row in reader:
            rows_in += 1
            salary_text = (row.get('Salary') or '').strip()
            parsed = parse_salary_to_usd(salary_text)
            if parsed is None:
                continue

            country_iso = map_country(row.get('Location') or '')
            if not country_iso:
                continue  # Remote / Multiple Locations / Europe / unmapped -> skip

            if not (row.get('Organisation') or '').strip() or not (row.get('Title') or '').strip():
                continue  # incomplete source row -> low confidence, skip

            year_raw = (row.get('Source Year') or '').strip()
            try:
                year = int(year_raw)
            except ValueError:
                year = 2025

            sector = classify_sector(row.get('Title') or '', row.get('Description') or '')
            years_exp = map_years_exp(row.get('Seniority') or '')

            rows_out.append({
                'company': clean_org_name(normalize_text(row.get('Organisation')) or 'Unknown'),
                'position': normalize_text(row.get('Title')).strip() or 'Untitled',
                'salary': parsed['amountUSD'],
                'unpaid': parsed['unpaid'],
                'years_exp': years_exp,
                'sector': sector,
                'country': country_iso,
                'currency': 'USD',
                'year': year,
            })

    print(f'Total rows in CSV: {rows_in}')
    print(f'Rows with usable salary + country: {len(rows_out)}')

    with open(OUT_PATH, 'w') as out:
        out.write('-- Historical salary data import — generated by scripts/import_historical_salaries.py\n')
        out.write(f'-- {len(rows_out)} rows from {rows_in} total CSV rows (rest skipped: vague salary text or non-mappable location)\n\n')
        out.write('INSERT INTO public.salary_submissions (company, position, salary, unpaid, years_exp, sector, country, currency, year) VALUES\n')
        values = []
        for r in rows_out:
            values.append(
                f"({sql_escape(r['company'])}, {sql_escape(r['position'])}, {r['salary']}, "
                f"{'true' if r['unpaid'] else 'false'}, {sql_escape(r['years_exp'])}, "
                f"{sql_escape(r['sector'])}, {sql_escape(r['country'])}, {sql_escape(r['currency'])}, {r['year']})"
            )
        out.write(',\n'.join(values))
        out.write(';\n')

    print(f'Wrote SQL to {OUT_PATH}')


if __name__ == '__main__':
    main()
