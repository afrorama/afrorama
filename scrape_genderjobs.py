import re
import time
import requests
from bs4 import BeautifulSoup
from datetime import datetime
from urllib.parse import quote
import unicodedata

import os

SUPABASE_URL = 'https://vqchwioyhyiuunpyildz.supabase.co'
ANON_KEY     = 'sb_publishable_HeGZfQZEDI_IR46a2Ezp-Q_tIUdhF6_'
SERVICE_KEY  = os.environ.get('SUPABASE_SERVICE_KEY', ANON_KEY)

BASE_URL = 'https://genderjobs.org/jobs'
AFRICA_PARAMS = (
    'regions%5Bregion_name%5D%5B%5D=Central+Africa'
    '&regions%5Bregion_name%5D%5B%5D=East+Africa'
    '&regions%5Bregion_name%5D%5B%5D=Northwest+and+Northeast+Africa'
    '&regions%5Bregion_name%5D%5B%5D=Southern+Africa'
    '&regions%5Bregion_name%5D%5B%5D=West+Africa'
    '&search_country=&commit=Apply+Filters'
)

TYPE_MAP = {
    'job':                   'jobs',
    'consultancy':           'consultancy',
    'internship':            'internship',
    'volunteering':          'internship',
    'volunteering (unpaid)': 'internship',
    'fellowship':            'capacity',
    'phd/post doc':          'capacity',
    'secondment':            'jobs',
}

COUNTRY_ISO = {
    'Algeria': 'DZ', 'Angola': 'AO', 'Benin': 'BJ', 'Botswana': 'BW',
    'Burkina Faso': 'BF', 'Burundi': 'BI', 'Cabo Verde': 'CV', 'Cameroon': 'CM',
    'Central African Republic': 'CF', 'Chad': 'TD', 'Comoros': 'KM',
    'Democratic Republic of Congo': 'CD', 'Democratic Republic of the Congo': 'CD',
    'DR Congo': 'CD', 'Republic of Congo': 'CG', "Côte d'Ivoire": 'CI',
    "Cote d'Ivoire": 'CI', 'Ivory Coast': 'CI', 'Djibouti': 'DJ', 'Egypt': 'EG',
    'Equatorial Guinea': 'GQ', 'Eritrea': 'ER', 'Eswatini': 'SZ', 'Ethiopia': 'ET',
    'Gabon': 'GA', 'Gambia': 'GM', 'Ghana': 'GH', 'Guinea': 'GN',
    'Guinea-Bissau': 'GW', 'Kenya': 'KE', 'Lesotho': 'LS', 'Liberia': 'LR',
    'Libya': 'LY', 'Madagascar': 'MG', 'Malawi': 'MW', 'Mali': 'ML',
    'Mauritania': 'MR', 'Mauritius': 'MU', 'Morocco': 'MA', 'Mozambique': 'MZ',
    'Namibia': 'NA', 'Niger': 'NE', 'Nigeria': 'NG', 'Rwanda': 'RW',
    'São Tomé and Príncipe': 'ST', 'Senegal': 'SN', 'Seychelles': 'SC',
    'Sierra Leone': 'SL', 'Somalia': 'SO', 'South Africa': 'ZA',
    'South Sudan': 'SS', 'Sudan': 'SD', 'Tanzania': 'TZ', 'Togo': 'TG',
    'Tunisia': 'TN', 'Uganda': 'UG', 'Zambia': 'ZM', 'Zimbabwe': 'ZW',
    'United Kingdom': 'GB', 'United States': 'US', 'Germany': 'DE',
    'France': 'FR', 'Belgium': 'BE', 'Netherlands': 'NL', 'Canada': 'CA',
}

def make_id(title, organisation):
    def slugify(s):
        s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode()
        s = re.sub(r'[^\w\s-]', '', s.lower())
        s = re.sub(r'[\s_-]+', '-', s).strip('-')
        return s[:40]
    return 'gj-' + slugify(organisation)[:25] + '-' + slugify(title)[:30]

def location_to_iso(location):
    if not location:
        return None
    for name, iso in COUNTRY_ISO.items():
        if name.lower() in location.lower():
            return iso
    return None

def parse_deadline(text):
    if not text or re.search(r'open|filled|rolling', text, re.I):
        return None
    try:
        return datetime.strptime(text.strip(), '%d/%m/%Y').strftime('%Y-%m-%d')
    except ValueError:
        pass
    return None

def scrape_page(page):
    url = f'{BASE_URL}?{AFRICA_PARAMS}&page={page}'
    r = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=15)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, 'html.parser')

    listings = []
    for tag_span in soup.find_all('span', id='job-type-tag'):
        try:
            card = tag_span.find_parent('div', class_=re.compile(r'card-preview'))
            if not card:
                continue
            btn = card.find('button', attrs={'aria-controls': re.compile(r'expanded-job_\d+')})
            if not btn:
                continue

            title_span = card.find('span', class_='job-title-text')
            org_h4     = card.find('h4', id='job-organisation')
            apply_a    = card.find('a', class_=re.compile(r'link-btn-primary'))

            location = None
            deadline = None
            ul = card.find('ul', class_='vertical-to-horizontal-list')
            if ul:
                lis = ul.find_all('li')
                if lis:
                    for p in lis[0].find_all('p'):
                        if 'text-label' not in (p.get('class') or []):
                            txt = p.get_text(strip=True)
                            if txt:
                                location = txt
                                break
                    last_li = lis[-1]
                    ps = last_li.find_all('p')
                    for i, p in enumerate(ps):
                        if 'deadline' in p.get_text().lower() and i + 1 < len(ps):
                            deadline = ps[i + 1].get_text(strip=True)
                            break

            job_type = TYPE_MAP.get(tag_span.get_text(strip=True).lower(), 'jobs')

            title = title_span.get_text(strip=True) if title_span else ''
            org   = org_h4.get_text(strip=True) if org_h4 else ''
            listings.append({
                'id':                  make_id(title, org),
                'title':               title,
                'organisation':        org,
                'type':                job_type,
                'location':            location,
                'country':             location_to_iso(location),
                'apply_url':           (apply_a['href'] if apply_a else None),
                'deadline':            parse_deadline(deadline),
                'paid_listing':        False,
                'payment_confirmed':   False,
            })
        except Exception as e:
            print(f'  Parse error: {e}')

    has_next = bool(soup.find('a', string=re.compile(r'Next', re.I)))
    return listings, has_next

def already_exists(title, organisation):
    url = (f'{SUPABASE_URL}/rest/v1/listings'
           f'?title=eq.{quote(title)}'
           f'&organisation=eq.{quote(organisation)}'
           f'&select=id&limit=1')
    r = requests.get(url, headers={'apikey': ANON_KEY, 'Authorization': f'Bearer {ANON_KEY}'})
    return bool(r.json())

def insert(listing):
    r = requests.post(
        f'{SUPABASE_URL}/rest/v1/listings',
        json=listing,
        headers={
            'apikey':        SERVICE_KEY,
            'Authorization': f'Bearer {SERVICE_KEY}',
            'Content-Type':  'application/json',
            'Prefer':        'return=minimal',
        },
        timeout=10,
    )
    if r.status_code not in (200, 201):
        print(f'    → {r.text}')
    return r.status_code

def main():
    all_listings = []
    page = 1
    while True:
        print(f'Scraping page {page}...')
        listings, has_next = scrape_page(page)
        print(f'  {len(listings)} listings found')
        all_listings.extend(listings)
        if not has_next:
            break
        page += 1
        time.sleep(1)

    print(f'\nTotal scraped: {len(all_listings)}\n')

    inserted = skipped = errors = 0
    for l in all_listings:
        if not l['title'] or not l['organisation']:
            skipped += 1
            continue
        if already_exists(l['title'], l['organisation']):
            print(f'  SKIP  {l["organisation"]} | {l["title"]}')
            skipped += 1
        else:
            status = insert(l)
            if status in (200, 201):
                print(f'  ADD   [{l["type"]:12s}] {l["organisation"]} | {l["title"]} ({l["country"] or "?"})')
                inserted += 1
            else:
                print(f'  ERROR {status}: {l["organisation"]} | {l["title"]}')
                errors += 1

    print(f'\nDone — inserted: {inserted}, skipped: {skipped}, errors: {errors}')

if __name__ == '__main__':
    main()
