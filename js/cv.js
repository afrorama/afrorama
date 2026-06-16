/* ===== NO WAHALA CV BOOSTER ===== */

(function () {
  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  }

  /* ================================================================
     STATE
  ================================================================= */
  const state = {
    file:         null,
    score:        null,
    reuploadUsed: localStorage.getItem('afrorama_cv_reupload_used') === 'true',
  };

  /* ================================================================
     SCORING CRITERIA (kept private — not shown in UI)
  ================================================================= */
  const CRITERIA = [
    {
      id: 'language', name: 'Action + Outcome Language', max: 20, color: '#4C9F38',
      low:  'Your bullet points need stronger verbs. Replace "responsible for" or "helped with" using the formula: Action verb + Task or Project + Metrics or Result. Example: "Coordinated a 6-week programme for 120 young adults, resulting in 85% securing employment within 3 months." Every bullet should answer: what changed because of me?',
      mid:  'Good use of action verbs in places. Revisit remaining bullet points using the formula: Action verb + Task or Project + Metrics or Result. Avoid weak verbs like "helped", "assisted" or "worked on". Choose confident ones: Led, Designed, Secured, Launched, Delivered, Coordinated, Built.',
      high: 'Excellent impact-led language throughout. Your bullet points follow the Action + Task + Result formula and clearly show what changed because of your work, exactly what social impact recruiters look for.',
    },
    {
      id: 'impact', name: 'Quantified Achievements', max: 25, color: '#26BDE2',
      low:  'This is the single biggest differentiator on a social impact CV, and yours needs more numbers. Add metrics to your bullet points: people reached, budget managed, % improvement, events organised, projects delivered. Even approximate figures work: "approximately 200 beneficiaries" or "budget of ~£50K". Ask yourself: what difference did I make, and can I put a number to it?',
      mid:  'Some metrics present. Good start. Now go through every role and ask: "Can I add a number here?" Tip: reach out to former colleagues and ask "What impact did you notice from my work?" to help you recall achievements you may have forgotten.',
      high: 'Strong use of numbers and quantified impact throughout. People are naturally drawn to evidence of measurable change, and you are providing it. This is what impact sector recruiters prioritise most.',
    },
    {
      id: 'summary', name: 'Profile & Contact', max: 15, color: '#DDA63A',
      low:  'Two things to check: (1) Make sure your contact section includes your LinkedIn URL: every Afrorama CV template requires it, and many recruiters go straight to LinkedIn. (2) Consider adding a 2–4 line profile at the top: your background, sector specialism, and one standout achievement. Note: if you have 5+ years of experience, a summary is optional. Let your achievements speak instead.',
      mid:  'Contact details look good. If you have a profile/summary, strengthen it by naming your specific sector, one key metric, and what makes you distinct. A recruiter should understand your value in under 10 seconds. If you are a senior professional without a summary, that is fine. Ensure your Key Achievements section does the same job.',
      high: 'Strong profile and complete contact information including LinkedIn. Your summary is purpose-led, sector-specific and communicates your value immediately, exactly the first impression mission-driven employers need.',
    },
    {
      id: 'structure', name: 'Structure & Key Sections', max: 20, color: '#00689D',
      low:  'Check that your CV includes all the sections that matter in social impact: Experience (with action-led bullets), Skills or Areas of Expertise (sector-relevant, not generic software), Education, and, critically, Voluntary Work or Side Projects. In social impact, unpaid and informal experience is often just as valuable as paid roles. Also check your format is clean and ATS-friendly: avoid heavy graphics, tables or columns that automated systems cannot read.',
      mid:  'Good structure in place. Make sure your Skills section lists sector-relevant competencies (e.g. stakeholder engagement, MEL, fundraising, DEI facilitation) rather than generic tools like Microsoft Word. If you have voluntary work or community projects, include them. This is often what sets impact sector candidates apart.',
      high: 'Well-structured and complete CV. All key sections are present including a Skills/Expertise section with sector-relevant competencies and voluntary or project experience. Format is clean and ATS-friendly, a strong foundation that lets your content shine.',
    },
    {
      id: 'tailoring', name: 'Sector Relevance & ATS Readiness', max: 20, color: '#DD1367',
      low:  'Your CV needs to speak directly to purpose-driven employers. Three steps: (1) Highlight mission-aligned experience and values-driven work. (2) Mirror the language of the job description in your top 3–4 bullet points. Many organisations use ATS (automated tracking systems) that filter CVs by keyword before a human reads them. (3) Find a role on Afrorama, read the job description carefully, and tailor your summary and key bullets to it before applying.',
      mid:  'Good sector alignment. To go further: identify 5–6 key phrases from the job description and make sure they appear naturally in your CV. This helps you pass ATS filters. Tailor your profile and 3–4 bullet points for each specific role rather than sending the same CV everywhere.',
      high: 'Excellent sector relevance and tailoring. Your CV clearly speaks the language of mission-driven employers, mirrors sector terminology, and would pass ATS keyword screening. This is how you stand out in a competitive field.',
    },
  ];

  /* ================================================================
     FILE HANDLING
  ================================================================= */
  const dropZone     = document.getElementById('drop-zone');
  const fileInput    = document.getElementById('cv-file-input');
  const fileSelected = document.getElementById('file-selected');
  const fileNameEl   = document.getElementById('file-name');
  const fileSizeEl   = document.getElementById('file-size');
  const fileRemove   = document.getElementById('file-remove');
  const btnAnalyse   = document.getElementById('btn-analyse');

  function handleFile(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('File too large. Please upload a file under 5 MB.'); return; }
    const allowed = ['.pdf', '.doc', '.docx'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!allowed.includes(ext)) { alert('Please upload a PDF or Word document (.pdf, .doc, .docx).'); return; }
    state.file = file;
    fileNameEl.textContent = file.name;
    fileSizeEl.textContent = (file.size / 1024).toFixed(0) + ' KB';
    fileSelected.classList.add('visible');
    btnAnalyse.disabled = false;
  }

  fileInput.addEventListener('change', e => handleFile(e.target.files[0]));
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', ()  => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', e => { e.preventDefault(); dropZone.classList.remove('drag-over'); handleFile(e.dataTransfer.files[0]); });
  dropZone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });
  fileRemove?.addEventListener('click', () => {
    state.file = null;
    fileInput.value = '';
    fileSelected.classList.remove('visible');
    btnAnalyse.disabled = true;
  });

  /* ================================================================
     SCORE HISTORY
  ================================================================= */
  function loadHistory() { return JSON.parse(localStorage.getItem('afrorama_cv_history') || '[]'); }
  function saveHistory(entry) {
    const h = loadHistory();
    h.push(entry);
    localStorage.setItem('afrorama_cv_history', JSON.stringify(h.slice(-10)));
  }

  function renderHistory() {
    const h  = loadHistory();
    const el = document.getElementById('score-history');
    if (!el || h.length < 2) return;
    el.classList.add('visible');

    // Build SVG line chart
    const pts   = h.slice(-8);
    const n     = pts.length;
    const W = 560, H = 160;
    const pL = 36, pR = 12, pT = 28, pB = 44;
    const plotW = W - pL - pR;
    const plotH = H - pT - pB;

    const xOf = i => pL + (n === 1 ? plotW / 2 : i * plotW / (n - 1));
    const yOf = v => pT + plotH - (v / 100 * plotH);

    let svg = `<svg width="100%" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" aria-label="CV score history line chart">`;

    // Grid lines + y-axis labels
    [0, 25, 50, 75, 100].forEach(v => {
      const y = yOf(v);
      svg += `<line x1="${pL}" y1="${y.toFixed(1)}" x2="${W - pR}" y2="${y.toFixed(1)}" stroke="#DDDCDA" stroke-dasharray="4 3"/>`;
      svg += `<text x="${pL - 5}" y="${(y + 4).toFixed(1)}" font-family="Inter,sans-serif" font-size="9" fill="#888886" text-anchor="end">${v}</text>`;
    });

    // Area fill under the line — Afrorama yellow tint
    const areaD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(p.score).toFixed(1)}`).join(' ')
      + ` L${xOf(n-1).toFixed(1)},${(pT + plotH).toFixed(1)} L${xOf(0).toFixed(1)},${(pT + plotH).toFixed(1)} Z`;
    svg += `<path d="${areaD}" fill="rgba(255,228,0,.12)"/>`;

    // Smooth line (using straight segments — looks clean at small scale)
    const lineD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(p.score).toFixed(1)}`).join(' ');
    svg += `<path d="${lineD}" fill="none" stroke="#1C1D1C" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;

    // Data points, score labels, delta, x-axis dates
    pts.forEach((p, i) => {
      const x     = xOf(i), y = yOf(p.score);
      const delta = i > 0 ? p.score - pts[i - 1].score : null;
      const col   = delta === null ? '#1C1D1C' : delta >= 0 ? '#3F7E44' : '#A21942';
      const date  = new Date(p.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

      // Dot
      svg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5" fill="white" stroke="${col}" stroke-width="2.5"/>`;

      // Score above dot
      svg += `<text x="${x.toFixed(1)}" y="${(y - 11).toFixed(1)}" font-family="Inter,sans-serif" font-size="10" font-weight="700" fill="#1C1D1C" text-anchor="middle">${p.score}</text>`;

      // Delta (±pts) above score
      if (delta !== null) {
        const sign = delta >= 0 ? '+' : '';
        svg += `<text x="${x.toFixed(1)}" y="${(y - 22).toFixed(1)}" font-family="Inter,sans-serif" font-size="8" fill="${col}" text-anchor="middle">${sign}${delta}pts</text>`;
      }

      // Date on x-axis
      svg += `<text x="${x.toFixed(1)}" y="${(pT + plotH + 16).toFixed(1)}" font-family="Inter,sans-serif" font-size="8.5" fill="#888886" text-anchor="middle">${date}</text>`;
    });

    svg += `</svg>`;

    // Replace the existing bar entries with the SVG chart
    const listEl = document.getElementById('history-list');
    if (listEl) listEl.innerHTML = svg;
  }
  renderHistory();

  /* ================================================================
     SIMULATION (replace with real Claude API call on backend)
  ================================================================= */
  /* ================================================================
     TEXT EXTRACTION — PDF via PDF.js, Word via Mammoth
  ================================================================= */
  async function extractText(file) {
    const ext = file.name.split('.').pop().toLowerCase();

    if (ext === 'pdf') {
      if (typeof pdfjsLib === 'undefined') {
        throw new Error('PDF reader not loaded yet. Please wait a moment and try again.');
      }
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
      const buffer = await file.arrayBuffer();
      const pdf    = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
      let text = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page    = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map(s => s.str).join(' ') + '\n';
      }
      const result = text.trim();
      if (!result) throw new Error('No text found in this PDF. It may be a scanned image. Please use a text-based PDF or a Word document instead.');
      return result;
    }

    if (ext === 'docx' || ext === 'doc') {
      if (typeof mammoth === 'undefined') {
        throw new Error('Word reader not loaded yet. Please wait a moment and try again.');
      }
      const buffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer: buffer });
      if (!result.value.trim()) throw new Error('Could not extract text from this Word document.');
      return result.value.trim();
    }

    throw new Error('Unsupported file type. Please upload a PDF or Word (.docx) file.');
  }

  /* ================================================================
     REAL ANALYSIS — send text to Supabase Edge Function
  ================================================================= */
  async function analyseWithClaude(file) {
    const text = await extractText(file);
    if (!text || text.length < 100) {
      throw new Error('Could not extract enough text from your CV. Please ensure it is not a scanned image.');
    }

    const FUNCTION_URL = 'https://vqchwioyhyiuunpyildz.supabase.co/functions/v1/cv-analyser';
    const ANON_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxY2h3aW95aHlpdXVucHlpbGR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY3MTUzODgsImV4cCI6MjA2MjI5MTM4OH0.bkdBaSJhpECCPpuJ4KVeGbEKb5bnYE_VXHiL_y_RFUI';

    const res  = await fetch(FUNCTION_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ANON_KEY}` },
      body:    JSON.stringify({ text, filename: file.name }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Analysis failed');

    // Map API response to CRITERIA format
    const keyMap = { language: 0, impact: 1, summary: 2, structure: 3, tailoring: 4 };
    const scores = CRITERIA.map((c, i) => {
      const key    = Object.keys(keyMap).find(k => keyMap[k] === i);
      const earned = key ? (data.scores[key] ?? Math.round(c.max * 0.45)) : Math.round(c.max * 0.45);
      return { ...c, earned: Math.min(c.max, Math.max(0, earned)) };
    });
    return {
      total:     data.total ?? scores.reduce((a, c) => a + c.earned, 0),
      scores,
      profile:   data.profile   || '',
      keywords:  data.keywords  || [],
      boostTips: data.boostTips || {},
    };
  }

  function scoreColour(total) {
    if (total >= 90) return { stroke: '#4C9F38', label: 'Outstanding', cls: 'excellent' };
    if (total >= 70) return { stroke: '#FFE400', label: 'Strong CV',   cls: 'good' };
    if (total >= 50) return { stroke: '#FD6925', label: 'Good start',  cls: 'fair' };
    return              { stroke: '#E5243B', label: 'Needs work',   cls: 'poor' };
  }

  /* ================================================================
     RENDER RESULTS
  ================================================================= */
  function renderResults(result) {
    document.getElementById('analysing-panel').style.display = 'none';
    const rp = document.getElementById('results-panel');
    rp.classList.add('visible'); rp.style.display = '';

    const { total, scores, profile, keywords, boostTips } = result;
    const col = scoreColour(total);

    // Gauge animation
    const arc  = document.getElementById('score-arc');
    const circ = 2 * Math.PI * 64;
    arc.style.strokeDashoffset = circ;
    arc.style.stroke = col.stroke;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      arc.style.strokeDashoffset = circ * (1 - total / 100);
    }));

    // Count-up
    const numEl = document.getElementById('score-num');
    let curr = 0;
    const step = total / 60;
    const t = setInterval(() => {
      curr = Math.min(curr + step, total);
      numEl.textContent = Math.round(curr);
      if (curr >= total) clearInterval(t);
    }, 20);

    const labelEl = document.getElementById('score-label');
    labelEl.textContent = col.label;
    labelEl.className = `score-label ${col.cls}`;

    if (total >= 90) document.getElementById('bank-banner').classList.add('visible');

    // Criteria
    const criteriaEl = document.getElementById('criteria-list');
    criteriaEl.innerHTML = scores.map(c => {
      const pct = (c.earned / c.max * 100).toFixed(0);
      const lvl = c.earned / c.max >= .8 ? 'high' : c.earned / c.max >= .5 ? 'mid' : 'low';
      return `
        <div class="criterion">
          <div class="criterion-top">
            <span class="criterion-name">${c.name}</span>
            <span class="criterion-score">${c.earned}</span>
          </div>
          <div class="criterion-bar">
            <div class="criterion-fill" style="width:0%;background:${c.color}" data-target="${pct}%"></div>
          </div>
          <div class="criterion-feedback">${c[lvl]}</div>
        </div>`;
    }).join('');
    setTimeout(() => criteriaEl.querySelectorAll('.criterion-fill').forEach(b => { b.style.width = b.dataset.target; }), 300);

    // Profile detection banner
    const profileEl = document.getElementById('cv-profile-detected');
    if (profileEl && profile) {
      profileEl.innerHTML = `<span class="cv-profile-label">We think you are</span><span class="cv-profile-text">${esc(profile)}</span>`;
      profileEl.style.display = 'block';
    }

    // ATS keywords
    const keywordsEl = document.getElementById('cv-keywords');
    if (keywordsEl && keywords.length) {
      keywordsEl.innerHTML = `
        <div class="cv-keywords-label">Missing ATS keywords: add these to your CV</div>
        <div class="cv-keywords-chips">${keywords.map(k => `<span class="cv-keyword-chip">${esc(k)}</span>`).join('')}</div>`;
      keywordsEl.style.display = 'block';
    }

    // Recommendations — use specific boost tips from Claude where available
    const weakest = [...scores].sort((a, b) => (a.earned / a.max) - (b.earned / b.max)).slice(0, 3);
    const criterionKeyMap = { 'Action + Outcome Language':'language', 'Quantified Achievements':'impact', 'Profile & Contact':'summary', 'Structure & Key Sections':'structure', 'Sector Relevance & ATS Readiness':'tailoring' };
    document.getElementById('recommendations-list').innerHTML = [
      ...weakest.map(c => {
        const boostKey = criterionKeyMap[c.name];
        const specific = boostKey && boostTips[boostKey];
        return { label: c.name, text: specific || c.low };
      }),
    ].slice(0, 3).map(r =>
      `<div class="rec-item"><span class="rec-label">${esc(r.label)}</span><span>${esc(r.text)}</span></div>`
    ).join('');

    // Re-upload logic
    if (total >= 90) {
      document.getElementById('reupload-section').style.display = 'none';
    } else if (state.reuploadUsed) {
      document.getElementById('reupload-free').style.display = 'none';
      document.getElementById('paywall-card').style.display  = 'block';
    }

    // Save to history
    saveHistory({ date: new Date().toISOString(), score: total, filename: state.file?.name });
    renderHistory();

    rp.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ================================================================
     ANALYSIS FLOW
  ================================================================= */
  async function runAnalysis() {
    if (!state.file) return;

    document.getElementById('upload-panel').style.display    = 'none';
    document.getElementById('analysing-panel').style.display = 'block';

    // Animate steps while Claude is working
    const STEPS = ['step-extract', 'step-score', 'step-recommend'];
    const START = [0, 1400, 2800];
    STEPS.forEach((id, i) => {
      setTimeout(() => document.getElementById(id)?.classList.add('active'), START[i]);
    });

    try {
      const result = await analyseWithClaude(state.file);

      // Mark all steps done
      STEPS.forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.classList.remove('active'); el.classList.add('done'); }
      });

      state.score = result.total;
      renderResults(result);

      const user = await window.AfroramaAuth?.getUser().catch(() => null);
      if (user) {
        await window.AfroramaAuth?.saveCVScore(user.id, result.total, state.file?.name).catch(err => console.warn('[cv] score save failed:', err));
      }

    } catch (err) {
      // Show error in analysing panel
      document.getElementById('analysing-panel').style.display = 'none';
      document.getElementById('upload-panel').style.display    = 'block';
      STEPS.forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.classList.remove('active', 'done'); }
      });
      alert('Could not analyse your CV:\n\n' + err.message);
    }
  }

  btnAnalyse?.addEventListener('click', () => {
    if (!state.file) return;
    runAnalysis();
  });

  /* ================================================================
     RE-UPLOAD
  ================================================================= */
  document.getElementById('btn-reupload')?.addEventListener('click', () => {
    document.getElementById('reupload-free').style.display = 'none';
    document.getElementById('paywall-card').style.display  = 'block';
    state.reuploadUsed = true;
    localStorage.setItem('afrorama_cv_reupload_used', 'true');
  });


})();
