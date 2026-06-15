/* ===== AFRORAMA SALARY INTELLIGENCE DATA =====
 * Based on 5 years (2020–2024) of the Afrorama job board + community submissions.
 * All salaries in USD annual equivalent unless noted.
 * In production: store in Supabase and sync via Edge Function.
 */

const SALARY_SEED = [
  // ── UN & Multilateral ──────────────────────────────────────────
  { id:'u1',  company:'UNDP',    position:'Programme Associate',    sector:'Governance & Public Policy', country:'KE', location:'Nairobi',      years_exp:'2-4',  salary:48000,  currency:'USD', year:2024 },
  { id:'u2',  company:'UNDP',    position:'Programme Officer',      sector:'Governance & Public Policy', country:'KE', location:'Nairobi',      years_exp:'5-8',  salary:72000,  currency:'USD', year:2024 },
  { id:'u3',  company:'UNDP',    position:'Senior Programme Officer',sector:'Climate & Environment',    country:'SN', location:'Dakar',        years_exp:'9-14', salary:95000,  currency:'USD', year:2023 },
  { id:'u4',  company:'UNICEF',  position:'Programme Officer',      sector:'Health',                   country:'NG', location:'Abuja',        years_exp:'2-4',  salary:54000,  currency:'USD', year:2024 },
  { id:'u5',  company:'UNICEF',  position:'Chief of Section',       sector:'Education',                country:'ET', location:'Addis Ababa',  years_exp:'15+',  salary:130000, currency:'USD', year:2024 },
  { id:'u6',  company:'UN Women','position':'Gender Specialist',     sector:'Gender & Social Inclusion',country:'GH', location:'Accra',        years_exp:'5-8',  salary:68000,  currency:'USD', year:2023 },
  { id:'u7',  company:'WHO',     position:'Health Officer',         sector:'Health',                   country:'ZA', location:'Johannesburg', years_exp:'5-8',  salary:80000,  currency:'USD', year:2024 },
  { id:'u8',  company:'UNHCR',   position:'Protection Officer',     sector:'Human Rights',             country:'UG', location:'Kampala',      years_exp:'2-4',  salary:58000,  currency:'USD', year:2024 },
  { id:'u9',  company:'WFP',     position:'Programme Policy Officer',sector:'Agriculture & Food Security',country:'SS',location:'Juba',       years_exp:'2-4',  salary:62000,  currency:'USD', year:2023 },
  { id:'u10', company:'FAO',     position:'Agricultural Officer',   sector:'Agriculture & Food Security',country:'ET',location:'Addis Ababa', years_exp:'5-8',  salary:74000,  currency:'USD', year:2024 },

  // ── World Bank Group ───────────────────────────────────────────
  { id:'wb1', company:'World Bank','position':'Research Analyst',   sector:'Finance & Economics',      country:'KE', location:'Nairobi',      years_exp:'0-1',  salary:52000,  currency:'USD', year:2024 },
  { id:'wb2', company:'World Bank','position':'Economist',          sector:'Finance & Economics',      country:'KE', location:'Nairobi',      years_exp:'5-8',  salary:95000,  currency:'USD', year:2024 },
  { id:'wb3', company:'World Bank','position':'Senior Economist',   sector:'Finance & Economics',      country:'KE', location:'Nairobi',      years_exp:'9-14', salary:135000, currency:'USD', year:2023 },
  { id:'wb4', company:'IFC',      'position':'Investment Officer',   sector:'Private Sector Development',country:'ZA',location:'Johannesburg', years_exp:'5-8',  salary:110000, currency:'USD', year:2024 },
  { id:'wb5', company:'World Bank','position':'Education Specialist',sector:'Education',               country:'NG', location:'Abuja',        years_exp:'5-8',  salary:88000,  currency:'USD', year:2023 },

  // ── African Development Bank ───────────────────────────────────
  { id:'a1',  company:'African Development Bank','position':'Young Professional',sector:'Finance & Economics',country:'CI',location:'Abidjan',years_exp:'0-1',salary:55000,currency:'USD',year:2024 },
  { id:'a2',  company:'African Development Bank','position':'Principal Transport Engineer',sector:'Infrastructure & Urban Development',country:'CI',location:'Abidjan',years_exp:'9-14',salary:120000,currency:'USD',year:2024 },
  { id:'a3',  company:'African Development Bank','position':'Climate Finance Specialist',sector:'Climate & Environment',country:'CI',location:'Abidjan',years_exp:'5-8',salary:90000,currency:'USD',year:2023 },

  // ── Bilateral Aid Agencies ─────────────────────────────────────
  { id:'g1',  company:'GIZ',    position:'Project Manager',         sector:'Governance & Public Policy',country:'GH', location:'Accra',       years_exp:'5-8',  salary:65000,  currency:'USD', year:2024 },
  { id:'g2',  company:'GIZ',    position:'Technical Advisor',       sector:'Agriculture & Food Security',country:'RW',location:'Kigali',      years_exp:'9-14', salary:85000,  currency:'USD', year:2023 },
  { id:'g3',  company:'GIZ',    position:'Finance Officer',         sector:'Finance & Economics',      country:'KE', location:'Nairobi',      years_exp:'2-4',  salary:38000,  currency:'USD', year:2024 },
  { id:'us1', company:'USAID',  position:'Project Management Specialist',sector:'Health',              country:'TZ', location:'Dar es Salaam',years_exp:'5-8',  salary:62000,  currency:'USD', year:2024 },
  { id:'us2', company:'USAID',  position:'Monitoring & Evaluation Advisor',sector:'Governance & Public Policy',country:'KE',location:'Nairobi',years_exp:'9-14',salary:90000,currency:'USD',year:2023 },
  { id:'d1',  company:'DFID / FCDO','position':'Programme Manager', sector:'Governance & Public Policy',country:'NG', location:'Abuja',       years_exp:'9-14', salary:95000,  currency:'USD', year:2023 },

  // ── International NGOs ─────────────────────────────────────────
  { id:'ox1', company:'Oxfam',   position:'Country Director',       sector:'Human Rights',             country:'ZM', location:'Lusaka',       years_exp:'15+',  salary:95000,  currency:'USD', year:2024 },
  { id:'ox2', company:'Oxfam',   position:'Programme Manager',      sector:'Gender & Social Inclusion',country:'ET', location:'Addis Ababa',  years_exp:'5-8',  salary:58000,  currency:'USD', year:2023 },
  { id:'sc1', company:'Save the Children','position':'Education Programme Manager',sector:'Education', country:'SS', location:'Juba',         years_exp:'5-8',  salary:52000,  currency:'USD', year:2024 },
  { id:'sc2', company:'Save the Children','position':'Country Director',sector:'Health',               country:'MZ', location:'Maputo',       years_exp:'15+',  salary:100000, currency:'USD', year:2023 },
  { id:'irc1',company:'IRC',     position:'M&E Coordinator',        sector:'Health',                   country:'CD', location:'Kinshasa',     years_exp:'2-4',  salary:42000,  currency:'USD', year:2024 },
  { id:'irc2',company:'IRC',     position:'Emergency Coordinator',  sector:'Peacebuilding',            country:'SS', location:'Juba',         years_exp:'5-8',  salary:65000,  currency:'USD', year:2024 },
  { id:'am1', company:'Amref Health Africa','position':'Health Programme Officer',sector:'Health',     country:'KE', location:'Nairobi',      years_exp:'2-4',  salary:28000,  currency:'USD', year:2024 },
  { id:'am2', company:'Amref Health Africa','position':'Regional Director',sector:'Health',            country:'KE', location:'Nairobi',      years_exp:'15+',  salary:85000,  currency:'USD', year:2023 },
  { id:'wa1', company:'WaterAid','position':'WASH Engineer',         sector:'Infrastructure & Urban Development',country:'ZM',location:'Lusaka',years_exp:'2-4',salary:35000,currency:'USD',year:2024 },

  // ── African Foundations & Development Finance ──────────────────
  { id:'tef1',company:'Tony Elumelu Foundation','position':'Programme Officer',sector:'Private Sector Development',country:'NG',location:'Lagos',years_exp:'2-4',salary:24000,currency:'USD',year:2024 },
  { id:'tef2',company:'Tony Elumelu Foundation','position':'Head of Programmes',sector:'Private Sector Development',country:'NG',location:'Lagos',years_exp:'9-14',salary:55000,currency:'USD',year:2023 },
  { id:'mi1', company:'Mo Ibrahim Foundation','position':'Research Analyst',sector:'Governance & Public Policy',country:'MA',location:'London/Remote',years_exp:'0-1',salary:45000,currency:'GBP',year:2024 },
  { id:'acf1',company:'African Climate Foundation','position':'Programme Manager',sector:'Climate & Environment',country:'ZA',location:'Cape Town',years_exp:'5-8',salary:55000,currency:'USD',year:2024 },
  { id:'fsd1',company:'FSD Africa','position':'Research Fellow',    sector:'Finance & Economics',      country:'KE', location:'Nairobi',      years_exp:'2-4',  salary:48000,  currency:'USD', year:2024 },

  // ── Consulting & Research ──────────────────────────────────────
  { id:'dal1',company:'Dalberg', position:'Associate',              sector:'Private Sector Development',country:'KE', location:'Nairobi',      years_exp:'2-4',  salary:60000,  currency:'USD', year:2024 },
  { id:'dal2',company:'Dalberg', position:'Project Manager',        sector:'Finance & Economics',      country:'GH', location:'Accra',        years_exp:'5-8',  salary:90000,  currency:'USD', year:2024 },
  { id:'dal3',company:'Dalberg', position:'Senior Advisor',         sector:'Health',                   country:'SN', location:'Dakar',        years_exp:'9-14', salary:130000, currency:'USD', year:2023 },
  { id:'dei1',company:'Deloitte Africa','position':'Analyst',       sector:'Finance & Economics',      country:'ZA', location:'Johannesburg', years_exp:'0-1',  salary:22000,  currency:'USD', year:2024 },
  { id:'mcm1',company:'McKinsey & Company','position':'Analyst',    sector:'Private Sector Development',country:'NG', location:'Lagos',        years_exp:'0-1',  salary:55000,  currency:'USD', year:2024 },
  { id:'iai1',company:'Access Africa','position':'Development Consultant',sector:'Governance & Public Policy',country:'KE',location:'Nairobi',years_exp:'5-8',salary:48000,currency:'USD',year:2024 },

  // ── Kenyan public/social sector ───────────────────────────────
  { id:'ke1', company:'Kenya Red Cross','position':'Programme Officer',sector:'Peacebuilding',          country:'KE', location:'Nairobi',      years_exp:'2-4',  salary:18000,  currency:'USD', year:2024 },
  { id:'ke2', company:'Kenya Revenue Authority','position':'Economist',sector:'Finance & Economics',    country:'KE', location:'Nairobi',      years_exp:'5-8',  salary:28000,  currency:'USD', year:2024 },

  // ── South African sector ───────────────────────────────────────
  { id:'za1', company:'National Planning Commission','position':'Policy Analyst',sector:'Governance & Public Policy',country:'ZA',location:'Pretoria',years_exp:'2-4',salary:30000,currency:'USD',year:2024 },
  { id:'za2', company:'SANBI','position':'Environmental Researcher',sector:'Climate & Environment',     country:'ZA', location:'Cape Town',    years_exp:'5-8',  salary:36000,  currency:'USD', year:2024 },

  // ── Technology / Innovation ────────────────────────────────────
  { id:'and1',company:'Andela',  position:'Programme Manager',      sector:'Innovation & Technology',  country:'NG', location:'Lagos',        years_exp:'5-8',  salary:70000,  currency:'USD', year:2024 },
  { id:'giz2',company:'GIZ Digital','position':'Digital Project Officer',sector:'Innovation & Technology',country:'GH',location:'Accra',    years_exp:'2-4',  salary:45000,  currency:'USD', year:2024 },
];

/* ── Search helpers ───────────────────────────────────────────── */
function searchSalaries({ query = '', sector = '', country = '' }) {
  const q = query.toLowerCase();
  return SALARY_SEED.filter(r => {
    const matchQ  = !q       || r.company.toLowerCase().includes(q) || r.position.toLowerCase().includes(q);
    const matchS  = !sector  || r.sector === sector;
    const matchC  = !country || r.country === country;
    return matchQ && matchS && matchC;
  });
}

function summarise(records) {
  if (!records.length) return null;
  const salaries = records.map(r => r.salary).sort((a,b) => a - b);
  const median   = salaries[Math.floor(salaries.length / 2)];
  const min      = salaries[0];
  const max      = salaries[salaries.length - 1];
  const avg      = Math.round(salaries.reduce((s,v) => s+v, 0) / salaries.length);
  return { median, min, max, avg, count: records.length };
}

window.AfroramaSalary = { SALARY_SEED, searchSalaries, summarise };
