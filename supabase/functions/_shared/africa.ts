/**
 * Find the African country a location string refers to.
 *
 * Matches country names (English + French, from reliefweb.ts) and major
 * cities on word boundaries. When two names start at the same place the
 * longer one wins, so "Nigeria" is never read as "Niger", "Guinea-Bissau"
 * as "Guinea", or "South Sudan" as "Sudan".
 */
import { AFRICA_TEXT_ISO } from './reliefweb.ts';

const CITY_ISO: Record<string, string> = {
  'nairobi':'KE','mombasa':'KE','kisumu':'KE','lagos':'NG','abuja':'NG','kano':'NG',
  'accra':'GH','kumasi':'GH','kampala':'UG','gulu':'UG','kigali':'RW','dar es salaam':'TZ',
  'dodoma':'TZ','arusha':'TZ','addis ababa':'ET','johannesburg':'ZA','cape town':'ZA',
  'pretoria':'ZA','durban':'ZA','lusaka':'ZM','lilongwe':'MW','blantyre':'MW','harare':'ZW',
  'dakar':'SN','abidjan':'CI','kinshasa':'CD','goma':'CD','luanda':'AO','maputo':'MZ',
  'gaborone':'BW','windhoek':'NA','antananarivo':'MG','bamako':'ML','ouagadougou':'BF',
  'niamey':'NE','conakry':'GN','freetown':'SL','monrovia':'LR','lomé':'TG','lome':'TG',
  'cotonou':'BJ','libreville':'GA','yaoundé':'CM','yaounde':'CM','douala':'CM','banjul':'GM',
  'cairo':'EG','tunis':'TN','rabat':'MA','casablanca':'MA','khartoum':'SD','juba':'SS',
  'mogadishu':'SO','hargeisa':'SO','asmara':'ER','bujumbura':'BI','n\'djamena':'TD',
};

const NAMES: [string, string][] = Object.entries({ ...AFRICA_TEXT_ISO, ...CITY_ISO })
  .sort((a, b) => b[0].length - a[0].length);

const isLetter = (c: string | undefined) => !!c && /\p{L}/u.test(c);

/** ISO2 of the first African country/city named in `text`, or null. */
export function africanIsoIn(text: string | null | undefined): string | null {
  const lower = String(text || '').toLowerCase();
  if (!lower) return null;
  let best: { iso: string; index: number; len: number } | null = null;
  for (const [name, iso] of NAMES) {
    let from = 0;
    for (;;) {
      const idx = lower.indexOf(name, from);
      if (idx === -1) break;
      if (!isLetter(lower[idx - 1]) && !isLetter(lower[idx + name.length])) {
        if (!best || idx < best.index || (idx === best.index && name.length > best.len)) {
          best = { iso, index: idx, len: name.length };
        }
        break;
      }
      from = idx + 1;
    }
  }
  return best?.iso ?? null;
}
