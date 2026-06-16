/* ===== AFRORAMA SALARY INTELLIGENCE DATA =====
 * Real salary data comes from member submissions, stored in Supabase
 * (table: salary_submissions) and loaded at runtime by salary.html.
 * All salaries in USD annual equivalent unless noted.
 */

const SALARY_SEED = [];

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
