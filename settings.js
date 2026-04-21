// ========== SETTINGS UI ==========
(function() {
  function fmtDate(d) {
    if (!d) return '';
    if (typeof d === 'string') return d;
    return d.toISOString().split('T')[0];
  }

  function getConfig() {
    return window.getCalendarConfig ? window.getCalendarConfig() : window.__defaultCalendarConfig;
  }

  // Render a repeating block row (label + start + end + remove)
  function addBlockRow(container, data) {
    const row = document.createElement('div');
    row.className = 'block-row';
    row.innerHTML =
      '<input type="text" placeholder="Label" value="' + (data.label || '') + '">' +
      '<input type="date" value="' + (data.start || '') + '">' +
      '<input type="date" value="' + (data.end || '') + '">' +
      '<button type="button" class="btn-remove" title="Remove">×</button>';
    row.querySelector('.btn-remove').onclick = () => row.remove();
    container.appendChild(row);
  }

  function readBlockRows(container) {
    return Array.from(container.querySelectorAll('.block-row')).map(row => {
      const inputs = row.querySelectorAll('input');
      return { label: inputs[0].value.trim(), start: inputs[1].value, end: inputs[2].value };
    }).filter(b => b.start && b.end);
  }

  function populateForm(cfg) {
    document.getElementById('cfg-shift-ref').value = cfg.shiftRef || '';
    document.getElementById('cfg-cycle').value = cfg.shiftCycle || 9;
    document.getElementById('cfg-days-off').value = cfg.shiftDaysOff || 3;
    document.getElementById('cfg-mandatory-start').value = cfg.mandatory.start || '';
    document.getElementById('cfg-mandatory-end').value = cfg.mandatory.end || '';
    document.getElementById('cfg-school-start').value = cfg.school.start || '';
    document.getElementById('cfg-school-end').value = cfg.school.end || '';

    // Flexible blocks
    const flexList = document.getElementById('cfg-flexible-list');
    flexList.innerHTML = '';
    (cfg.flexibleBlocks || []).forEach(b => addBlockRow(flexList, b));

    // Annual leave
    const annualList = document.getElementById('cfg-annual-list');
    annualList.innerHTML = '';
    (cfg.annualLeave || []).forEach(b => addBlockRow(annualList, b));

    // Trips
    const tripsList = document.getElementById('cfg-trips-list');
    tripsList.innerHTML = '';
    (cfg.trips || []).forEach(b => addBlockRow(tripsList, b));
  }

  function readForm() {
    return {
      shiftRef: document.getElementById('cfg-shift-ref').value,
      shiftCycle: parseInt(document.getElementById('cfg-cycle').value) || 9,
      shiftDaysOff: parseInt(document.getElementById('cfg-days-off').value) || 3,
      birthDate: '2026-04-17',
      lastSchoolDay: '2026-06-19',
      mandatory: {
        start: document.getElementById('cfg-mandatory-start').value,
        end: document.getElementById('cfg-mandatory-end').value,
      },
      school: {
        start: document.getElementById('cfg-school-start').value,
        end: document.getElementById('cfg-school-end').value,
      },
      flexibleBlocks: readBlockRows(document.getElementById('cfg-flexible-list')),
      annualLeave: readBlockRows(document.getElementById('cfg-annual-list')),
      trips: readBlockRows(document.getElementById('cfg-trips-list')),
    };
  }

  function init() {
    populateForm(getConfig());

    // Add block buttons
    document.getElementById('cfg-add-flexible').onclick = () =>
      addBlockRow(document.getElementById('cfg-flexible-list'), {});
    document.getElementById('cfg-add-annual').onclick = () =>
      addBlockRow(document.getElementById('cfg-annual-list'), {});
    document.getElementById('cfg-add-trip').onclick = () =>
      addBlockRow(document.getElementById('cfg-trips-list'), {});

    // Save
    document.getElementById('cfg-save').onclick = () => {
      const cfg = readForm();
      if (typeof window.__updateCalendarConfig === 'function') {
        window.__updateCalendarConfig(cfg);
      }
      if (typeof window.rebuildCalendar === 'function') {
        window.rebuildCalendar();
      }
      // Update the summary cards from config
      updateSummaryCards(cfg);
      // Show feedback
      const btn = document.getElementById('cfg-save');
      const orig = btn.textContent;
      btn.textContent = '✓ Saved';
      setTimeout(() => { btn.textContent = orig; }, 1500);
    };

    // Reset defaults
    document.getElementById('cfg-reset').onclick = () => {
      if (!confirm('Reset all calendar settings to defaults?')) return;
      const defaults = window.__defaultCalendarConfig;
      populateForm(defaults);
      if (typeof window.__updateCalendarConfig === 'function') {
        window.__updateCalendarConfig(defaults);
      }
      if (typeof window.rebuildCalendar === 'function') {
        window.rebuildCalendar();
      }
      updateSummaryCards(defaults);
    };

    // Session info (moved from modal)
    const emailEl = document.getElementById('settings-session-email');
    const logoutBtn = document.getElementById('settings-logout-btn');
    if (window.sb) {
      window.sb.auth.getUser().then(({ data }) => {
        if (emailEl && data && data.user) emailEl.textContent = 'Signed in as: ' + data.user.email;
      });
    }
    if (logoutBtn) {
      logoutBtn.onclick = async () => {
        if (window.sb) await window.sb.auth.signOut();
        location.reload();
      };
    }
  }

  function updateSummaryCards(cfg) {
    // Update the summary cards on the dashboard with current config values
    // This makes the hardcoded summary cards dynamic
    const parseD = window.__calendarHelpers ? window.__calendarHelpers.parseDate : function(s) { return new Date(s); };
    const fmtShort = function(s) {
      if (!s) return '?';
      const d = typeof s === 'string' ? parseD(s) : s;
      return String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0');
    };

    // Count flexible weeks
    let totalDays = 0;
    if (cfg.mandatory && cfg.mandatory.start && cfg.mandatory.end) {
      const ms = parseD(cfg.mandatory.start), me = parseD(cfg.mandatory.end);
      totalDays += Math.round((me - ms) / 86400000) + 1;
    }
    (cfg.flexibleBlocks || []).forEach(b => {
      if (b.start && b.end) totalDays += Math.round((parseD(b.end) - parseD(b.start)) / 86400000) + 1;
    });
    const weeks = Math.round(totalDays / 7);

    // Annual leave detail
    const annualDetail = (cfg.annualLeave || []).map(a => fmtShort(a.start) + '–' + fmtShort(a.end)).join(' · ');
    // School detail
    const schoolDetail = (cfg.lastSchoolDay ? 'Last day ' + fmtShort(cfg.lastSchoolDay) + ' · ' : '') +
      'Summer school ' + fmtShort(cfg.school.start) + ' – ' + fmtShort(cfg.school.end);
    // Trips detail
    const tripDetail = (cfg.trips || []).map(t => (t.label || 'Trip') + ' ' + fmtShort(t.start) + '–' + fmtShort(t.end)).join(' · ');

    // Update DOM
    const summaryCards = document.querySelectorAll('.summary .glass');
    if (summaryCards[0]) {
      const val = summaryCards[0].querySelector('.value');
      if (val) val.textContent = weeks + ' wks';
    }
    if (summaryCards[1]) {
      const det = summaryCards[1].querySelector('.detail');
      const val = summaryCards[1].querySelector('.value');
      if (det) det.textContent = annualDetail || '—';
      if (val) val.textContent = (cfg.annualLeave || []).length + ' blocks';
    }
    if (summaryCards[2]) {
      const det = summaryCards[2].querySelector('.detail');
      if (det) det.textContent = schoolDetail;
    }
    if (summaryCards[3]) {
      const det = summaryCards[3].querySelector('.detail');
      if (det) det.textContent = tripDetail || '—';
    }
  }

  // Initialize when auth is ready
  if (window.__authReady) init();
  else window.addEventListener('auth-ready', init, { once: true });

  // Also populate on config sync (realtime updates)
  window.addEventListener('auth-ready', () => {
    // Re-populate if config changes from realtime
    const origSync = window.__calendarConfig;
    setInterval(() => {
      if (window.__calendarConfig !== origSync) {
        populateForm(getConfig());
      }
    }, 5000);
  }, { once: true });
})();
