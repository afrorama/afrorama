/* ===== AFRORAMA DATA LAYER ===== */

const TYPES = {
  jobs:        { label: 'Jobs',                          color: '#FFE400', text: '#1C1D1C', icon: '💼' },
  internship:  { label: 'Internship & Volunteering',     color: '#4FC3F7', text: '#1C1D1C', icon: '🌱' },
  consultancy: { label: 'Consultancy & Research',        color: '#FF6B35', text: '#FFFFFF', icon: '🔬' },
  capacity:    { label: 'Capacity Building & Funding',   color: '#9B5DE5', text: '#FFFFFF', icon: '🚀' },
};

const SECTORS = [
  'Agriculture & Food Security',
  'Climate & Environment',
  'Education',
  'Finance & Economics',
  'Gender & Social Inclusion',
  'Governance & Public Policy',
  'Health',
  'Human Rights',
  'Infrastructure & Urban Development',
  'Innovation & Technology',
  'Peacebuilding',
  'Private Sector Development',
  'Youth & Employment',
];

const AFRICAN_COUNTRIES = [
  { id: 'DZ', name: 'Algeria',                    region: 'North Africa',    lon: 3,    lat: 28  },
  { id: 'AO', name: 'Angola',                     region: 'Central Africa',  lon: 18,   lat: -12 },
  { id: 'BJ', name: 'Benin',                      region: 'West Africa',     lon: 2.5,  lat: 9   },
  { id: 'BW', name: 'Botswana',                   region: 'Southern Africa', lon: 24,   lat: -22 },
  { id: 'BF', name: 'Burkina Faso',               region: 'West Africa',     lon: -2,   lat: 12  },
  { id: 'BI', name: 'Burundi',                    region: 'East Africa',     lon: 30,   lat: -4  },
  { id: 'CM', name: 'Cameroon',                   region: 'Central Africa',  lon: 12,   lat: 6   },
  { id: 'CV', name: 'Cape Verde',                 region: 'West Africa',     lon: -24,  lat: 16  },
  { id: 'CF', name: 'Central African Republic',   region: 'Central Africa',  lon: 20,   lat: 7   },
  { id: 'TD', name: 'Chad',                       region: 'Central Africa',  lon: 19,   lat: 15  },
  { id: 'KM', name: 'Comoros',                    region: 'East Africa',     lon: 44,   lat: -12 },
  { id: 'CG', name: 'Republic of Congo',          region: 'Central Africa',  lon: 15,   lat: 1   },
  { id: 'CD', name: 'DR Congo',                   region: 'Central Africa',  lon: 24,   lat: -4  },
  { id: 'CI', name: "Côte d'Ivoire",              region: 'West Africa',     lon: -6,   lat: 7   },
  { id: 'DJ', name: 'Djibouti',                   region: 'East Africa',     lon: 43,   lat: 11  },
  { id: 'EG', name: 'Egypt',                      region: 'North Africa',    lon: 30,   lat: 26  },
  { id: 'GQ', name: 'Equatorial Guinea',          region: 'Central Africa',  lon: 10,   lat: 1   },
  { id: 'ER', name: 'Eritrea',                    region: 'East Africa',     lon: 40,   lat: 14  },
  { id: 'SZ', name: 'Eswatini',                   region: 'Southern Africa', lon: 31.5, lat: -26 },
  { id: 'ET', name: 'Ethiopia',                   region: 'East Africa',     lon: 40,   lat: 9   },
  { id: 'GA', name: 'Gabon',                      region: 'Central Africa',  lon: 12,   lat: -1  },
  { id: 'GM', name: 'Gambia',                     region: 'West Africa',     lon: -15,  lat: 13  },
  { id: 'GH', name: 'Ghana',                      region: 'West Africa',     lon: -1,   lat: 8   },
  { id: 'GN', name: 'Guinea',                     region: 'West Africa',     lon: -12,  lat: 11  },
  { id: 'GW', name: 'Guinea-Bissau',              region: 'West Africa',     lon: -15,  lat: 12  },
  { id: 'KE', name: 'Kenya',                      region: 'East Africa',     lon: 38,   lat: 0   },
  { id: 'LS', name: 'Lesotho',                    region: 'Southern Africa', lon: 28.5, lat: -29.5 },
  { id: 'LR', name: 'Liberia',                    region: 'West Africa',     lon: -9,   lat: 6   },
  { id: 'LY', name: 'Libya',                      region: 'North Africa',    lon: 17,   lat: 27  },
  { id: 'MG', name: 'Madagascar',                 region: 'East Africa',     lon: 47,   lat: -20 },
  { id: 'MW', name: 'Malawi',                     region: 'Southern Africa', lon: 34,   lat: -13 },
  { id: 'ML', name: 'Mali',                       region: 'West Africa',     lon: -2,   lat: 17  },
  { id: 'MR', name: 'Mauritania',                 region: 'North Africa',    lon: -11,  lat: 20  },
  { id: 'MU', name: 'Mauritius',                  region: 'East Africa',     lon: 57.5, lat: -20 },
  { id: 'MA', name: 'Morocco',                    region: 'North Africa',    lon: -5,   lat: 32  },
  { id: 'MZ', name: 'Mozambique',                 region: 'Southern Africa', lon: 36,   lat: -18 },
  { id: 'NA', name: 'Namibia',                    region: 'Southern Africa', lon: 17,   lat: -22 },
  { id: 'NE', name: 'Niger',                      region: 'West Africa',     lon: 9,    lat: 17  },
  { id: 'NG', name: 'Nigeria',                    region: 'West Africa',     lon: 8,    lat: 9   },
  { id: 'RW', name: 'Rwanda',                     region: 'East Africa',     lon: 30,   lat: -2  },
  { id: 'ST', name: 'São Tomé & Príncipe',        region: 'Central Africa',  lon: 6.6,  lat: 0.2 },
  { id: 'SN', name: 'Senegal',                    region: 'West Africa',     lon: -14,  lat: 14  },
  { id: 'SL', name: 'Sierra Leone',               region: 'West Africa',     lon: -12,  lat: 8   },
  { id: 'SO', name: 'Somalia',                    region: 'East Africa',     lon: 46,   lat: 6   },
  { id: 'ZA', name: 'South Africa',               region: 'Southern Africa', lon: 25,   lat: -29 },
  { id: 'SS', name: 'South Sudan',                region: 'East Africa',     lon: 30,   lat: 8   },
  { id: 'SD', name: 'Sudan',                      region: 'North Africa',    lon: 30,   lat: 16  },
  { id: 'TZ', name: 'Tanzania',                   region: 'East Africa',     lon: 35,   lat: -6  },
  { id: 'TG', name: 'Togo',                       region: 'West Africa',     lon: 1,    lat: 8   },
  { id: 'TN', name: 'Tunisia',                    region: 'North Africa',    lon: 9,    lat: 34  },
  { id: 'UG', name: 'Uganda',                     region: 'East Africa',     lon: 32,   lat: 1   },
  { id: 'ZM', name: 'Zambia',                     region: 'Southern Africa', lon: 27,   lat: -14 },
  { id: 'ZW', name: 'Zimbabwe',                   region: 'Southern Africa', lon: 30,   lat: -19 },
];

const SEED_JOBS = [
  {
    id: 'seed-1',
    title: 'Programme Officer – Climate Resilience',
    organisation: 'African Development Bank',
    location: 'Abidjan',
    country: 'CI',
    type: 'jobs',
    sector: 'Climate & Environment',
    deadline: '2026-07-15',
    posted: '2026-05-10',
    salary: '$65,000 – $85,000 per annum',
    description: 'Lead climate resilience programming across West and Central Africa, working with governments and civil society to develop adaptive strategies for communities most affected by climate change.',
    requirements: "Master's degree in Environmental Science, Climate Policy, or related field. 5+ years experience in climate programming. Fluency in English and French required.",
  },
  {
    id: 'seed-2',
    title: 'Health Systems Strengthening Consultant',
    organisation: 'Amref Health Africa',
    location: 'Nairobi',
    country: 'KE',
    type: 'consultancy',
    sector: 'Health',
    deadline: '2026-07-01',
    posted: '2026-05-08',
    salary: '$500 – $700 per day',
    description: 'Support health systems capacity building in East Africa, focusing on primary healthcare delivery and health workforce development across Kenya, Uganda and Tanzania.',
    requirements: "Medical degree or MPH required. 7+ years experience in health systems strengthening. Strong analytical and report writing skills.",
  },
  {
    id: 'seed-3',
    title: 'Youth Entrepreneurship Intern',
    organisation: 'Tony Elumelu Foundation',
    location: 'Lagos',
    country: 'NG',
    type: 'internship',
    sector: 'Youth & Employment',
    deadline: '2026-06-30',
    posted: '2026-05-05',
    salary: 'Monthly stipend provided',
    description: 'Support the TEF Entrepreneurship Programme team in programme delivery, entrepreneur engagement, and impact tracking across Africa.',
    requirements: "Currently enrolled in or recently completed a Bachelor's or Master's programme. Passion for African entrepreneurship and development.",
  },
  {
    id: 'seed-4',
    title: 'Gender & Social Inclusion Specialist',
    organisation: 'UN Women',
    location: 'Dakar',
    country: 'SN',
    type: 'jobs',
    sector: 'Gender & Social Inclusion',
    deadline: '2026-07-20',
    posted: '2026-05-12',
    salary: 'P4 level, $90,000+ per annum',
    description: "Lead UN Women's gender mainstreaming efforts in West Africa, working with governments, NGOs and the private sector to advance women's economic empowerment.",
    requirements: "Advanced degree in Gender Studies, Social Sciences, or related field. 7+ years experience in gender and development programming.",
  },
  {
    id: 'seed-5',
    title: 'Digital Finance Research Fellow',
    organisation: 'FSD Africa',
    location: 'Nairobi',
    country: 'KE',
    type: 'consultancy',
    sector: 'Finance & Economics',
    deadline: '2026-07-10',
    posted: '2026-05-11',
    salary: '$800 – $1,200 per day',
    description: 'Conduct research on digital financial services adoption and impact in Sub-Saharan Africa, with a focus on smallholder farmers and MSMEs.',
    requirements: "PhD or Master's in Economics, Finance, or Development Studies. Strong quantitative research skills. East Africa experience preferred.",
  },
  {
    id: 'seed-6',
    title: 'Agri-Business Development Officer',
    organisation: 'Alliance of Bioversity International & CIAT',
    location: 'Addis Ababa',
    country: 'ET',
    type: 'jobs',
    sector: 'Agriculture & Food Security',
    deadline: '2026-07-05',
    posted: '2026-05-07',
    salary: 'Competitive, commensurate with experience',
    description: 'Drive agribusiness development initiatives in Ethiopia, linking smallholder farmers to markets and supporting value chain strengthening across key agricultural commodities.',
    requirements: "Bachelor's or Master's in Agricultural Economics, Agribusiness, or related field. 3+ years experience in agricultural development.",
  },
  {
    id: 'seed-7',
    title: 'Education Innovation Grant',
    organisation: 'African Education Trust',
    location: 'Pan-African (Remote)',
    country: 'ZA',
    type: 'capacity',
    sector: 'Education',
    deadline: '2026-07-31',
    posted: '2026-05-09',
    salary: 'Grants up to $50,000 available',
    description: 'Funding available for innovative education projects addressing learning poverty in sub-Saharan Africa. Open to NGOs, social enterprises, and academic institutions.',
    requirements: 'Registered organisation in an African country. Proven track record in education programming. Project must target underserved communities.',
  },
  {
    id: 'seed-8',
    title: 'Governance Research Analyst',
    organisation: 'Mo Ibrahim Foundation',
    location: 'Accra',
    country: 'GH',
    type: 'jobs',
    sector: 'Governance & Public Policy',
    deadline: '2026-07-25',
    posted: '2026-05-13',
    salary: '$55,000 – $70,000 per annum',
    description: 'Analyse governance trends across African countries for the Ibrahim Index of African Governance, supporting research and policy advocacy work.',
    requirements: "Master's in Political Science, International Relations, or Public Policy. Strong quantitative and qualitative analysis skills.",
  },
  {
    id: 'seed-9',
    title: 'Community Peacebuilding Volunteer',
    organisation: 'Search for Common Ground',
    location: 'Juba',
    country: 'SS',
    type: 'internship',
    sector: 'Peacebuilding',
    deadline: '2026-06-25',
    posted: '2026-05-06',
    salary: 'Volunteer – accommodation and living allowance provided',
    description: 'Support community dialogue and conflict resolution programming in South Sudan, working with local communities and government stakeholders.',
    requirements: "Bachelor's degree minimum. Strong cross-cultural communication skills. Resilience and adaptability essential. French an advantage.",
  },
  {
    id: 'seed-10',
    title: 'Tech4Dev Programme Manager',
    organisation: 'Andela',
    location: 'Lagos',
    country: 'NG',
    type: 'jobs',
    sector: 'Innovation & Technology',
    deadline: '2026-07-18',
    posted: '2026-05-14',
    salary: '$70,000 – $90,000 per annum',
    description: 'Manage technology training programmes across West Africa, overseeing curriculum development, trainer capacity building, and learner outcome tracking.',
    requirements: 'Background in computer science or education technology. 5+ years programme management experience.',
  },
  {
    id: 'seed-11',
    title: 'WASH Engineer – Rural Zambia',
    organisation: 'WaterAid',
    location: 'Lusaka',
    country: 'ZM',
    type: 'jobs',
    sector: 'Infrastructure & Urban Development',
    deadline: '2026-07-22',
    posted: '2026-05-15',
    salary: 'Competitive package with benefits',
    description: 'Design and implement WASH infrastructure projects in rural Zambia, working with communities, local government, and engineering contractors.',
    requirements: 'Civil or Environmental Engineering degree. 3+ years WASH experience in Africa. AutoCAD proficiency required.',
  },
  {
    id: 'seed-12',
    title: 'Human Rights Documentation Officer',
    organisation: 'Amnesty International Africa',
    location: 'Kampala',
    country: 'UG',
    type: 'jobs',
    sector: 'Human Rights',
    deadline: '2026-07-08',
    posted: '2026-05-10',
    salary: '$45,000 – $60,000 per annum',
    description: 'Document human rights violations in East Africa, producing evidence-based reports and supporting advocacy campaigns at national and international levels.',
    requirements: 'Law degree or equivalent. Experience in human rights monitoring and documentation. Strong English report writing required.',
  },
  {
    id: 'seed-13',
    title: 'Climate Finance Fellowship',
    organisation: 'African Climate Foundation',
    location: 'Cape Town',
    country: 'ZA',
    type: 'capacity',
    sector: 'Climate & Environment',
    deadline: '2026-08-01',
    posted: '2026-05-14',
    salary: 'Fellowship stipend of $3,000/month',
    description: 'A 12-month fellowship for emerging African climate finance professionals, including mentoring, research support, and attendance at global climate conferences.',
    requirements: "Master's degree in finance, economics, or environmental studies. Must be a citizen of an African country. Under 35 years of age.",
  },
  {
    id: 'seed-14',
    title: 'Market Systems Adviser',
    organisation: 'DAI Global',
    location: 'Nairobi',
    country: 'KE',
    type: 'consultancy',
    sector: 'Private Sector Development',
    deadline: '2026-07-30',
    posted: '2026-05-13',
    salary: '$900 – $1,100 per day',
    description: 'Provide technical advisory support on market systems development programmes in East Africa, focusing on inclusive agricultural value chains and job creation.',
    requirements: "Advanced degree in Economics or Development. 10+ years consulting experience. Strong market systems/M4P methodology knowledge.",
  },
  {
    id: 'seed-15',
    title: 'Digital Health Innovation Intern',
    organisation: 'PATH',
    location: 'Dar es Salaam',
    country: 'TZ',
    type: 'internship',
    sector: 'Health',
    deadline: '2026-06-20',
    posted: '2026-05-12',
    salary: '$1,200 per month stipend',
    description: 'Support the Digital Health team in deploying mHealth solutions across Tanzania, conducting user research and supporting mobile health application rollout.',
    requirements: "Background in public health, computer science, or digital health. Strong interest in health technology for low-resource settings.",
  },
];

/* ===== DATA ACCESS ===== */

function getAllJobs() {
  try {
    // 1. Seed jobs (hardcoded in data.js)
    // 2. Admin-imported jobs (from admin-opportunities.html — same localStorage)
    // 3. User-submitted paid listings (from post.html)
    const adminRaw  = localStorage.getItem('afrorama_admin_opps');
    const userRaw   = localStorage.getItem('afrorama_jobs');
    const adminOpps = adminRaw ? JSON.parse(adminRaw) : [];
    const userJobs  = userRaw  ? JSON.parse(userRaw)  : [];

    // Merge: admin overrides seed entries of same ID; tombstones (id ending _deleted) are excluded
    const deletedIds = new Set(adminOpps.filter(o => o.id?.endsWith('_deleted')).map(o => o.id.replace('_deleted','')));
    const adminMap   = {};
    adminOpps.filter(o => !o.id?.endsWith('_deleted')).forEach(o => { adminMap[o.id] = o; });

    const merged = [
      ...SEED_JOBS.filter(j => !deletedIds.has(j.id)).map(j => adminMap[j.id] ? { ...j, ...adminMap[j.id] } : j),
      ...adminOpps.filter(o => !o.id?.endsWith('_deleted') && !SEED_JOBS.find(s => s.id === o.id)),
      ...userJobs,
    ];

    return filterExpiredJobs(merged);
  } catch {
    return filterExpiredJobs(SEED_JOBS);
  }
}

function filterExpiredJobs(jobs) {
  const now    = new Date();
  const cutoff = new Date(now - 30 * 24 * 60 * 60 * 1000);
  return jobs.filter(j => {
    if (j.deadline) return new Date(j.deadline) > now;
    return new Date(j.posted) >= cutoff;
  });
}

function addJob(job) {
  try {
    const stored = localStorage.getItem('afrorama_jobs');
    const jobs = stored ? JSON.parse(stored) : [];
    job.id = 'user-' + Date.now();
    job.posted = new Date().toISOString().split('T')[0];
    jobs.push(job);
    localStorage.setItem('afrorama_jobs', JSON.stringify(jobs));
    return job;
  } catch {
    return null;
  }
}

function getJobCountByCountry() {
  const jobs = getAllJobs();
  const counts = {};
  jobs.forEach(j => { counts[j.country] = (counts[j.country] || 0) + 1; });
  return counts;
}

function formatDate(str) {
  if (!str) return 'Rolling basis';
  return new Date(str).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function daysUntil(str) {
  if (!str) return Infinity;
  return Math.ceil((new Date(str) - new Date()) / 86400000);
}

window.AfroramaData = {
  TYPES, SECTORS, AFRICAN_COUNTRIES,
  getAllJobs, addJob, getJobCountByCountry, formatDate, daysUntil,
};
