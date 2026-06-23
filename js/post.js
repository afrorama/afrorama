/* ===== POST AN OPPORTUNITY ===== */

(function () {
  const { addJob, TYPES, SECTORS, AFRICAN_COUNTRIES } = window.AfroramaData;

  /* ---- Populate selects ---- */
  function populate() {
    const sectorSel = document.getElementById('field-sector');
    if (sectorSel) {
      SECTORS.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s; opt.textContent = s;
        sectorSel.appendChild(opt);
      });
    }
    const countrySel = document.getElementById('field-country');
    if (countrySel) {
      const grouped = {};
      AFRICAN_COUNTRIES.forEach(c => {
        if (!grouped[c.region]) grouped[c.region] = [];
        grouped[c.region].push(c);
      });
      Object.entries(grouped).sort().forEach(([region, countries]) => {
        const og = document.createElement('optgroup');
        og.label = region;
        countries.sort((a,b) => a.name.localeCompare(b.name)).forEach(c => {
          const opt = document.createElement('option');
          opt.value = c.id; opt.textContent = c.name;
          og.appendChild(opt);
        });
        countrySel.appendChild(og);
      });
    }
  }
  populate();

  // Tomorrow min for deadline
  const dlField = document.getElementById('field-deadline');
  if (dlField) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    dlField.min = tomorrow.toISOString().split('T')[0];
  }

  /* ---- Step navigation ---- */
  let currentStep = 1;

  function goToStep(n) {
    document.querySelectorAll('.form-step').forEach((el, i) => {
      el.classList.toggle('active', i + 1 === n);
    });
    document.querySelectorAll('.step').forEach((el, i) => {
      el.classList.remove('active', 'done');
      if (i + 1 === n) el.classList.add('active');
      if (i + 1 < n)  el.classList.add('done');
    });
    document.querySelector('.form-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    currentStep = n;
  }

  /* ---- Validation ---- */
  function validateStep(n) {
    let valid = true;
    document.querySelectorAll(`.form-step[data-step="${n}"] [required]`).forEach(field => {
      const err = field.parentElement.querySelector('.form-error');
      if (!field.value.trim()) {
        field.classList.add('input-error');
        if (err) { err.textContent = 'This field is required.'; err.classList.add('visible'); }
        valid = false;
      } else {
        field.classList.remove('input-error');
        if (err) err.classList.remove('visible');
      }
    });

    if (n === 1) {
      const dl = document.getElementById('field-deadline');
      if (dl?.value && Math.ceil((new Date(dl.value) - new Date()) / 86400000) < 1) {
        dl.classList.add('input-error');
        const err = dl.parentElement.querySelector('.form-error');
        if (err) { err.textContent = 'Deadline must be a future date.'; err.classList.add('visible'); }
        valid = false;
      }
    }

    if (n === 2) {
      const emailEl = document.getElementById('field-contact-email');
      if (emailEl?.value && !emailEl.value.includes('@')) {
        emailEl.classList.add('input-error');
        const err = emailEl.parentElement.querySelector('.form-error');
        if (err) { err.textContent = 'Please enter a valid email address with @.'; err.classList.add('visible'); }
        valid = false;
      }
    }
    return valid;
  }

  // Clear errors on input
  document.querySelectorAll('.form-input, .form-select, .form-textarea').forEach(el => {
    el.addEventListener('input', () => {
      el.classList.remove('input-error');
      const err = el.parentElement.querySelector('.form-error');
      if (err) err.classList.remove('visible');
    });
  });

  document.getElementById('btn-next-1')?.addEventListener('click', () => {
    if (validateStep(1)) { updatePaymentSummary(); goToStep(2); }
  });
  document.getElementById('btn-next-2')?.addEventListener('click', () => {
    if (validateStep(2)) goToStep(3);
  });
  document.getElementById('btn-back-2')?.addEventListener('click', () => goToStep(1));
  document.getElementById('btn-back-3')?.addEventListener('click', () => goToStep(2));

  function updatePaymentSummary() {
    const title = document.getElementById('field-title')?.value || '';
    const el = document.getElementById('summary-title-text');
    if (el) el.textContent = title || 'Job listing';
  }

  /* ---- Payment ---- */
  const LISTING_PRICE_USD = 29;
  const postErrEl = document.getElementById('post-error');

  function showPostError(message) {
    if (!postErrEl) return;
    postErrEl.textContent = message;
    postErrEl.style.display = 'block';
  }

  const payBtn = document.getElementById('btn-pay');
  if (payBtn) {
    payBtn.addEventListener('click', async () => {
      payBtn.disabled = true;
      payBtn.textContent = 'Saving…';
      if (postErrEl) { postErrEl.style.display = 'none'; postErrEl.textContent = ''; }

      const jobData = {
        title:        document.getElementById('field-title')?.value.trim()       || '',
        organisation: document.getElementById('field-org')?.value.trim()         || '',
        location:     document.getElementById('field-location')?.value.trim()    || '',
        country:      document.getElementById('field-country')?.value            || '',
        type:         document.querySelector('[name="field-type"]:checked')?.value || 'jobs',
        sector:       document.getElementById('field-sector')?.value             || '',
        deadline:     document.getElementById('field-deadline')?.value           || '',
        salary:       document.getElementById('field-salary')?.value.trim()      || 'Not specified',
        apply_url:    document.getElementById('field-apply-url')?.value.trim()   || '',
        description:  document.getElementById('field-description')?.value.trim() || '',
        requirements: document.getElementById('field-requirements')?.value.trim() || '',
      };
      const contactEmail = document.getElementById('field-contact-email')?.value.trim() || '';

      // Format the user's raw description/requirements into 5 AI-generated
      // bullet points, matching the style of scraped listings. Falls back
      // to the raw text untouched if formatting fails for any reason.
      try {
        const fmtRes = await fetch('https://vqchwioyhyiuunpyildz.supabase.co/functions/v1/format-listing', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title:        jobData.title,
            organisation: jobData.organisation,
            description:  jobData.description,
            requirements: jobData.requirements,
          }),
        });
        if (fmtRes.ok) {
          const { description: formatted } = await fmtRes.json();
          if (formatted) jobData.description = formatted;
        }
      } catch (err) {
        console.warn('[post] format-listing call failed, using raw description:', err);
      }

      const Supa = window.AfroramaSupabase;
      if (!Supa || Supa.isDemoMode()) {
        addJob(jobData);
        showSuccessScreen();
        return;
      }

      const sb = Supa.getSupabase();
      const id = 'post-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
      const { error } = await sb.rpc('submit_listing', {
        p_id:            id,
        p_title:         jobData.title,
        p_organisation:  jobData.organisation,
        p_type:          jobData.type,
        p_sector:        jobData.sector,
        p_location:      jobData.location,
        p_country:       jobData.country,
        p_deadline:      jobData.deadline,
        p_salary:        jobData.salary,
        p_apply_url:     jobData.apply_url,
        p_description:   jobData.description,
        p_requirements:  jobData.requirements,
        p_contact_email: contactEmail,
        p_paid_listing:  true,
      });

      if (error) {
        console.error('[post] Supabase save error:', error.message);
        showPostError('Could not save your listing. Please try again.');
        payBtn.disabled = false;
        payBtn.textContent = `Pay $${LISTING_PRICE_USD} and publish listing`;
        return;
      }

      payBtn.textContent = 'Redirecting to payment…';
      window.AfroramaStripe?.pay('job_listing', {
        userId:    id,
        userEmail: contactEmail,
        onError: err => {
          showPostError(err.message || 'Payment redirect failed. Please try again.');
          payBtn.disabled = false;
          payBtn.textContent = `Pay $${LISTING_PRICE_USD} and publish listing`;
        },
      });
    });
  }

  function showSuccessScreen() {
    document.querySelector('.form-panel').style.display   = 'none';
    document.querySelector('.post-sidebar').style.display = 'none';
    document.getElementById('step-bar')?.remove();
    document.querySelector('.post-page-header')?.remove();
    document.getElementById('success-screen').classList.add('visible');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  goToStep(1);
})();
