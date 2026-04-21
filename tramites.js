// ========== TRÁMITES + SYNC + UPLOADS (Supabase) ==========
(function() {
  const LEGACY_KEY = 'parental-leave-tramites';
  const LOCAL_STATE_KEY = 'parental-leave-state';
  const BUCKET = 'documents';

  const GROUP_FOLDERS = {
    preparacion: 'Hospital',
    registro: 'Registro-Civil',
    inss: 'INSS',
    binter: 'Binter'
  };

  let sb = null;
  let stateRowId = null;
  let lastSavedAt = 0;
  let authed = false;

  // ---------- Toast module ----------
  const toastHost = document.getElementById('toast-host');
  function toast(msg, kind) {
    kind = kind || 'info';
    const el = document.createElement('div');
    el.className = 'toast ' + kind;
    el.innerHTML = '<span>' + msg + '</span>';
    if (kind !== 'loading') {
      const x = document.createElement('span');
      x.className = 'toast-x';
      x.textContent = '×';
      x.onclick = () => el.remove();
      el.appendChild(x);
    }
    toastHost.appendChild(el);
    if (kind === 'success') setTimeout(() => el.remove(), 2500);
    else if (kind === 'error') setTimeout(() => el.remove(), 8000);
    return el;
  }

  // ---------- State ----------
  let state = { tramites: {}, docs: {}, meta: {}, subtasks: {} };

  function stripLegacyPrefix(p) {
    if (typeof p !== 'string') return p;
    return p.replace(/^Documents\//, '');
  }
  function normalizeDocs(docs) {
    const out = {};
    Object.keys(docs || {}).forEach(k => { out[k] = stripLegacyPrefix(docs[k]); });
    return out;
  }
  function syncBirthActualToWindow() {
    window.birthActual = (state.meta && state.meta.birthActual) || '2026-04-17';
  }
  function syncCalendarConfig() {
    if (state.meta && state.meta.calendarConfig) {
      window.__calendarConfig = state.meta.calendarConfig;
    }
  }
  // Expose state writer for settings UI
  window.__updateCalendarConfig = function(cfg) {
    state.meta = state.meta || {};
    state.meta.calendarConfig = cfg;
    syncCalendarConfig();
    queueSave();
  };

  function loadLocal() {
    try {
      const s = JSON.parse(localStorage.getItem(LOCAL_STATE_KEY) || 'null');
      if (s && typeof s === 'object') return {
        tramites: s.tramites || {},
        docs: normalizeDocs(s.docs),
        meta: s.meta || {},
        subtasks: s.subtasks || {}
      };
    } catch {}
    try {
      const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null');
      if (legacy && typeof legacy === 'object') return { tramites: legacy, docs: {}, meta: {}, subtasks: {} };
    } catch {}
    return { tramites: {}, docs: {}, meta: {}, subtasks: {} };
  }
  function saveLocal() { localStorage.setItem(LOCAL_STATE_KEY, JSON.stringify(state)); }

  async function loadRemote() {
    const { data, error } = await sb.from('app_state').select('*').limit(1).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    stateRowId = data.id;
    return {
      tramites: data.tramites || {},
      docs: normalizeDocs(data.docs),
      meta: data.meta || {},
      subtasks: data.subtasks || {}
    };
  }

  let saveTimer = null;
  let pendingToast = null;
  function queueSave() {
    saveLocal();
    if (!authed || !stateRowId) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(doSave, 1500);
  }
  async function doSave() {
    if (!stateRowId) return;
    const now = new Date().toISOString();
    lastSavedAt = Date.now();
    if (pendingToast) pendingToast.remove();
    pendingToast = toast('Syncing…', 'loading');
    const { error } = await sb.from('app_state').update({
      tramites: state.tramites,
      docs: state.docs,
      meta: state.meta || {},
      subtasks: state.subtasks || {},
      updated_at: now
    }).eq('id', stateRowId);
    if (pendingToast) pendingToast.remove();
    if (error) {
      pendingToast = toast('⚠ Could not save: ' + error.message, 'error');
    } else {
      pendingToast = toast('✓ Saved', 'success');
    }
  }

  async function signedUrlFor(path) {
    try {
      const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, 3600);
      if (error) return null;
      return data && data.signedUrl;
    } catch { return null; }
  }
  async function openDoc(path) {
    const url = await signedUrlFor(path);
    if (url) window.open(url, '_blank', 'noopener');
    else toast('⚠ Could not open file', 'error');
  }

  // ---------- UI: checkboxes ----------
  function applyRowStyle(cb) {
    const row = cb.closest('.tramite-row');
    if (!row) return;
    const badge = row.querySelector('.badge');
    if (cb.checked) {
      row.classList.add('done');
      if (badge) { badge.className = 'badge badge-done'; badge.textContent = 'Done'; }
    } else {
      row.classList.remove('done');
      if (badge) { badge.className = 'badge badge-pending'; badge.textContent = 'Pending'; }
    }
  }
  function updateGroupProgress(group) {
    const boxes = document.querySelectorAll('input[data-group="' + group + '"]');
    const total = boxes.length;
    const checked = Array.from(boxes).filter(b => b.checked).length;
    const fill = document.getElementById('prog-' + group);
    const label = document.getElementById('prog-label-' + group);
    if (fill) fill.style.width = (total ? (checked / total * 100) : 0) + '%';
    if (label) label.textContent = checked + ' / ' + total + ' completed';
  }
  function updateAggregate() {
    const allBoxes = document.querySelectorAll('.tramite-row input[type="checkbox"]');
    const total = allBoxes.length;
    const checked = Array.from(allBoxes).filter(b => b.checked).length;
    const pct = total ? (checked / total * 100) : 0;
    const done = document.getElementById('agg-done');
    const tot = document.getElementById('agg-total');
    const fill = document.getElementById('agg-fill');
    if (done) done.textContent = checked;
    if (tot) tot.textContent = total;
    if (fill) fill.style.width = pct + '%';
  }

  // Render JS-mode groups (Bebé, Salud, Ayudas) from TRAMITES config
  function renderJsGroups() {
    const host = document.getElementById('js-groups-host');
    if (!host || host.childElementCount) return;
    Object.entries(window.GROUPS).forEach(([groupKey, g]) => {
      if (g.renderMode !== 'js') return;
      const wrap = document.createElement('div');
      wrap.className = 'glass tramite-group';
      wrap.id = 'grp-' + groupKey;
      let html = '<h3>' + g.title + '</h3>';
      if (g.desc) html += '<p class="group-desc">' + g.desc + '</p>';
      html += '<div class="progress-label" id="prog-label-' + groupKey + '">0 / ' + g.count + ' completed</div>';
      html += '<div class="progress-track"><div class="progress-fill" id="prog-' + groupKey + '" style="width:0%"></div></div>';
      for (let i = 0; i < g.count; i++) {
        const key = groupKey + '-' + i;
        const t = window.TRAMITES[key];
        if (!t) continue;
        const folder = GROUP_FOLDERS[groupKey] || 'Hospital';
        html += '<div class="tramite-row"><input type="checkbox" data-group="' + groupKey + '" data-idx="' + i + '">';
        html += '<div class="tramite-info"><div class="name">' + t.name + '</div>';
        if (t.meta) html += '<div class="meta">' + t.meta + '</div>';
        html += '<span class="doc-slot" data-folder="' + folder + '"></span></div>';
        html += '<span class="badge badge-pending">Pending</span></div>';
      }
      host.appendChild(wrap);
      wrap.innerHTML = html;
    });
    // Make the new groups eligible for upload injection
    ['bebe','salud','ayudas'].forEach(k => { if (!GROUP_FOLDERS[k]) GROUP_FOLDERS[k] = 'Hospital'; });
  }
  renderJsGroups();

  // Inject scope chip into every tramite row (existing HTML + JS-rendered)
  function renderScopeChips() {
    document.querySelectorAll('.tramite-row input[type="checkbox"]').forEach(box => {
      const key = box.dataset.group + '-' + box.dataset.idx;
      const t = window.TRAMITES[key];
      if (!t || !t.scope) return;
      const info = box.parentElement.querySelector('.tramite-info');
      if (!info || info.querySelector('.scope-chip')) return;
      const chipDef = window.SCOPE_CHIPS[t.scope];
      if (!chipDef) return;
      const chip = document.createElement('span');
      chip.className = 'scope-chip ' + chipDef.cls;
      chip.textContent = chipDef.emoji + ' ' + chipDef.label;
      chip.title = 'Scope: ' + chipDef.label;
      const nameEl = info.querySelector('.name');
      if (nameEl) nameEl.appendChild(chip);
    });
  }
  renderScopeChips();

  // Expandable subtasks UI
  function renderSubtasks() {
    document.querySelectorAll('.tramite-row input[type="checkbox"]').forEach(box => {
      const key = box.dataset.group + '-' + box.dataset.idx;
      const t = window.TRAMITES[key];
      if (!t || !t.subtasks || !t.subtasks.length) return;
      const row = box.closest('.tramite-row');
      if (row.querySelector('.subtasks-panel')) return;

      const btn = document.createElement('button');
      btn.className = 'subtask-toggle';
      btn.type = 'button';
      btn.title = 'Show subtasks';
      btn.textContent = '▾';
      row.appendChild(btn);

      const panel = document.createElement('div');
      panel.className = 'subtasks-panel';
      panel.style.display = 'none';
      t.subtasks.forEach(st => {
        const id = 'st-' + key + '-' + st.id;
        const item = document.createElement('label');
        item.className = 'subtask-item';
        item.innerHTML = '<input type="checkbox" data-tramite="' + key + '" data-sub="' + st.id + '"> <span>' + st.label + '</span>';
        panel.appendChild(item);
      });
      row.parentNode.insertBefore(panel, row.nextSibling);

      btn.addEventListener('click', () => {
        const open = panel.style.display !== 'none';
        panel.style.display = open ? 'none' : '';
        btn.textContent = open ? '▾' : '▴';
      });

      panel.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', () => {
          const tk = cb.dataset.tramite;
          const sk = cb.dataset.sub;
          state.subtasks = state.subtasks || {};
          state.subtasks[tk] = state.subtasks[tk] || {};
          state.subtasks[tk][sk] = cb.checked;
          renderSubtaskProgress(tk);
          queueSave();
          if (navigator.vibrate && cb.checked) navigator.vibrate(15);
        });
      });
    });
  }
  renderSubtasks();

  // Per-trámite journal notes
  function renderJournalButtons() {
    document.querySelectorAll('.tramite-row input[type="checkbox"]').forEach(box => {
      const key = box.dataset.group + '-' + box.dataset.idx;
      const row = box.closest('.tramite-row');
      if (row.querySelector('.journal-toggle')) return;

      const btn = document.createElement('button');
      btn.className = 'journal-toggle';
      btn.type = 'button';
      btn.title = 'Notes';
      btn.textContent = '📝';
      row.appendChild(btn);

      const panel = document.createElement('div');
      panel.className = 'journal-panel';
      panel.style.display = 'none';
      const ta = document.createElement('textarea');
      ta.className = 'journal-textarea';
      ta.placeholder = 'Notes: people contacted, reference numbers, questions, follow-up dates…';
      ta.rows = 3;
      panel.appendChild(ta);
      const meta = document.createElement('div');
      meta.className = 'journal-meta';
      panel.appendChild(meta);
      row.parentNode.insertBefore(panel, row.nextSibling);

      btn.addEventListener('click', () => {
        const open = panel.style.display !== 'none';
        panel.style.display = open ? 'none' : '';
        if (!open) ta.focus();
      });
      ta.addEventListener('input', () => {
        state.meta = state.meta || {};
        state.meta.journal = state.meta.journal || {};
        if (ta.value.trim()) {
          state.meta.journal[key] = { note: ta.value, updatedAt: new Date().toISOString() };
        } else {
          delete state.meta.journal[key];
        }
        updateJournalDot(key);
        queueSave();
        updateJournalMeta(key, meta);
      });
    });
  }
  renderJournalButtons();

  function applyJournalState() {
    document.querySelectorAll('.journal-panel textarea').forEach(ta => {
      const row = ta.closest('.journal-panel').previousElementSibling;
      const box = row.querySelector('input[data-group]');
      if (!box) return;
      const key = box.dataset.group + '-' + box.dataset.idx;
      const entry = ((state.meta || {}).journal || {})[key];
      ta.value = entry ? entry.note : '';
      const meta = ta.parentElement.querySelector('.journal-meta');
      updateJournalMeta(key, meta);
      updateJournalDot(key);
    });
  }
  function updateJournalMeta(key, metaEl) {
    const entry = ((state.meta || {}).journal || {})[key];
    if (!metaEl) return;
    if (!entry) { metaEl.textContent = ''; return; }
    const d = new Date(entry.updatedAt);
    metaEl.textContent = 'Last edited: ' + String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + d.getFullYear() + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }
  function updateJournalDot(key) {
    const row = document.querySelector('.tramite-row input[data-group="' + key.split('-')[0] + '"][data-idx="' + key.split('-').slice(1).join('-') + '"]');
    if (!row) return;
    const btn = row.closest('.tramite-row').querySelector('.journal-toggle');
    if (!btn) return;
    const has = !!((state.meta || {}).journal || {})[key];
    btn.classList.toggle('has-note', has);
  }

  function applySubtaskState() {
    document.querySelectorAll('.subtasks-panel input[type="checkbox"]').forEach(cb => {
      const tk = cb.dataset.tramite;
      const sk = cb.dataset.sub;
      cb.checked = !!((state.subtasks || {})[tk] || {})[sk];
    });
    document.querySelectorAll('.tramite-row input[data-group]').forEach(box => {
      renderSubtaskProgress(box.dataset.group + '-' + box.dataset.idx);
    });
  }

  function renderSubtaskProgress(key) {
    const t = window.TRAMITES[key];
    if (!t || !t.subtasks || !t.subtasks.length) return;
    const row = document.querySelector('.tramite-row input[data-group="' + key.split('-')[0] + '"][data-idx="' + key.split('-').slice(1).join('-') + '"]');
    if (!row) return;
    const tr = row.closest('.tramite-row');
    const btn = tr.querySelector('.subtask-toggle');
    if (!btn) return;
    const sub = (state.subtasks || {})[key] || {};
    const done = t.subtasks.filter(s => sub[s.id]).length;
    const total = t.subtasks.length;
    let pill = btn.querySelector('.subtask-count');
    if (!pill) {
      pill = document.createElement('span');
      pill.className = 'subtask-count';
      btn.prepend(pill);
    }
    pill.textContent = done + '/' + total;
  }

  // Dependency rendering: grey out rows whose deps aren't complete
  function renderDependencyState() {
    document.querySelectorAll('.tramite-row input[type="checkbox"]').forEach(box => {
      const key = box.dataset.group + '-' + box.dataset.idx;
      const t = window.TRAMITES[key];
      const row = box.closest('.tramite-row');
      if (!row) return;
      let depBadge = row.querySelector('.dep-badge');
      if (!t || !t.dependsOn || !t.dependsOn.length) {
        row.classList.remove('blocked');
        if (depBadge) depBadge.remove();
        return;
      }
      const unmet = t.dependsOn.filter(k => !state.tramites[k]);
      if (!unmet.length) {
        row.classList.remove('blocked');
        if (depBadge) depBadge.remove();
        return;
      }
      row.classList.add('blocked');
      if (!depBadge) {
        depBadge = document.createElement('span');
        depBadge.className = 'dep-badge';
        const statusBadge = row.querySelector('.badge');
        if (statusBadge && statusBadge.parentNode) statusBadge.parentNode.insertBefore(depBadge, statusBadge);
        else row.appendChild(depBadge);
      }
      const names = unmet.map(k => {
        const t2 = window.TRAMITES[k];
        return t2 && t2.name ? t2.name : k;
      });
      depBadge.textContent = '⏳ Requires ' + unmet.length;
      depBadge.title = 'Requires: ' + names.join(' · ');
    });
  }

  const allBoxes = Array.from(document.querySelectorAll('.tramite-row input[type="checkbox"]'));
  const groups = new Set();
  allBoxes.forEach(b => groups.add(b.dataset.group));

  function renderUrgencyBadge(box) {
    const row = box.closest('.tramite-row');
    if (!row) return;
    let badge = row.querySelector('.deadline-badge');
    if (box.checked) { if (badge) badge.remove(); return; }
    const key = box.dataset.group + '-' + box.dataset.idx;
    const dl = window.resolveDeadline(key);
    if (!dl) { if (badge) badge.remove(); return; }
    const fmt = window.formatDeadlineBadge(dl.daysUntil);
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'deadline-badge';
      const statusBadge = row.querySelector('.badge');
      if (statusBadge && statusBadge.parentNode) statusBadge.parentNode.insertBefore(badge, statusBadge);
      else row.appendChild(badge);
    }
    badge.className = 'deadline-badge ' + fmt.cls;
    badge.textContent = fmt.text;
    badge.title = 'Deadline: ' + window.fmtLongDate(dl.date) + ' · ' + dl.label;
  }

  function renderUrgentBanner() {
    const banner = document.getElementById('urgent-banner');
    if (!banner) return;
    if (sessionStorage.getItem('urgent-banner-dismissed') === '1') { banner.style.display = 'none'; return; }
    const items = [];
    allBoxes.forEach(box => {
      if (box.checked) return;
      const key = box.dataset.group + '-' + box.dataset.idx;
      const dl = window.resolveDeadline(key);
      if (!dl) return;
      const rule = window.TRAMITE_DEADLINES[key] || {};
      const isCritical = rule.priority === 'critical';
      if (dl.daysUntil <= 3 || (isCritical && dl.daysUntil <= 7)) {
        items.push({ key, dl, box, isCritical });
      }
    });
    if (!items.length) { banner.style.display = 'none'; return; }
    items.sort((a,b) => a.dl.daysUntil - b.dl.daysUntil);
    const overdue = items.filter(i => i.dl.daysUntil < 0).length;
    const label = overdue ? '⚠ ' + overdue + ' overdue · ' + items.length + ' urgent' : '⚠ ' + items.length + ' urgent this week';
    banner.querySelector('.urgent-text').textContent = label;
    banner.style.display = '';
    banner.onclick = () => {
      const top = items[0];
      const tab = document.querySelector('.nav-link[href="#tramites"]');
      if (tab) tab.click();
      setTimeout(() => {
        const grp = top.box.closest('.tramite-group');
        if (grp && grp.classList.contains('group-collapsed')) { grp.classList.remove('group-collapsed'); grp.dataset.manualExpand = '1'; }
        top.box.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const row = top.box.closest('.tramite-row');
        if (row) { row.style.boxShadow = '0 0 0 2px #ef4444'; setTimeout(() => { row.style.boxShadow = ''; }, 1800); }
      }, 120);
    };
  }

  function renderDashboard() {
    const today = new Date(); today.setHours(0,0,0,0);
    renderUrgentBanner();

    const title = document.getElementById('next-action-title');
    const meta = document.getElementById('next-action-meta');
    const bdg = document.getElementById('next-action-badge');
    if (!title) return;
    const candidates = [];
    allBoxes.forEach(box => {
      if (box.checked) return;
      const key = box.dataset.group + '-' + box.dataset.idx;
      const dl = window.resolveDeadline(key);
      if (!dl) return;
      const nameEl = box.parentElement.querySelector('.tramite-info .name');
      candidates.push({ key, dl, name: nameEl ? nameEl.textContent : key, box });
    });
    if (!candidates.length) {
      title.textContent = '🎉 All caught up';
      meta.textContent = 'No immediate deadlines pending.';
      bdg.style.display = 'none';
      title.onclick = null;
      return;
    }
    candidates.sort((a, b) => a.dl.daysUntil - b.dl.daysUntil);
    const top = candidates[0];
    title.textContent = top.name;
    meta.textContent = 'Deadline: ' + window.fmtLongDate(top.dl.date) + ' · ' + top.dl.label;
    const fmt = window.formatDeadlineBadge(top.dl.daysUntil);
    bdg.style.display = '';
    bdg.className = 'dash-badge ' + fmt.cls;
    bdg.textContent = fmt.text;
    title.onclick = () => {
      const tramitesTab = document.querySelector('.nav-link[href="#tramites"]');
      if (tramitesTab) tramitesTab.click();
      setTimeout(() => {
        const grp = top.box.closest('.tramite-group');
        if (grp && grp.classList.contains('group-collapsed')) { grp.classList.remove('group-collapsed'); grp.dataset.manualExpand = '1'; }
        top.box.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const row = top.box.closest('.tramite-row');
        if (row) {
          row.style.transition = 'box-shadow 0.3s';
          row.style.boxShadow = '0 0 0 2px #fbbf24';
          setTimeout(() => { row.style.boxShadow = ''; }, 1800);
        }
      }, 120);
    };
  }

  function applyStateToUI() {
    allBoxes.forEach(box => {
      const key = box.dataset.group + '-' + box.dataset.idx;
      box.checked = !!state.tramites[key];
      applyRowStyle(box);
      renderRowDoc(box);
      renderUrgencyBadge(box);
    });
    applySubtaskState();
    if (typeof applyJournalState === 'function') applyJournalState();
    renderDependencyState();
    groups.forEach(updateGroupProgress);
    updateAggregate();
    renderDashboard();
    if (typeof autoCollapseCompleted === 'function') autoCollapseCompleted();
  }

  let lastUndoToast = null;
  allBoxes.forEach(box => {
    box.addEventListener('change', function() {
      const key = this.dataset.group + '-' + this.dataset.idx;
      const wasChecked = !this.checked;
      state.tramites[key] = this.checked;
      applyRowStyle(this);
      renderUrgencyBadge(this);
      renderDependencyState();
      updateGroupProgress(this.dataset.group);
      updateAggregate();
      renderDashboard();
      autoCollapseCompleted();
      queueSave();
      if (navigator.vibrate) navigator.vibrate(this.checked ? 25 : 10);
      if (lastUndoToast) lastUndoToast.remove();
      const self = this;
      const msg = this.checked ? '✓ Checked' : '↺ Unchecked';
      const t = toast(msg + ' · Undo', 'success');
      const undo = document.createElement('button');
      undo.textContent = 'Undo';
      undo.className = 'toast-undo';
      undo.onclick = () => {
        self.checked = wasChecked;
        self.dispatchEvent(new Event('change'));
        t.remove();
      };
      t.appendChild(undo);
      lastUndoToast = t;
    });
  });

  function autoCollapseCompleted() {
    document.querySelectorAll('.tramite-group').forEach(grpEl => {
      if (!grpEl.dataset.manualExpand) grpEl.classList.add('group-collapsed');
    });
    updateCollapsedBadges();
  }

  function updateCollapsedBadges() {
    document.querySelectorAll('.tramite-group').forEach(grpEl => {
      const h3 = grpEl.querySelector('h3');
      if (!h3) return;
      let badge = h3.querySelector('.collapsed-urgency');
      const boxes = grpEl.querySelectorAll('input[data-group]');
      let overdueCount = 0, urgentCount = 0, soonCount = 0;
      boxes.forEach(box => {
        if (box.checked) return;
        const key = box.dataset.group + '-' + box.dataset.idx;
        const dl = window.resolveDeadline(key);
        if (!dl) return;
        if (dl.daysUntil < 0) overdueCount++;
        else if (dl.daysUntil <= 3) urgentCount++;
        else if (dl.daysUntil <= 14) soonCount++;
      });
      const total = overdueCount + urgentCount;
      if (!total && !soonCount) { if (badge) badge.remove(); return; }
      if (!badge) { badge = document.createElement('span'); badge.className = 'collapsed-urgency'; h3.appendChild(badge); }
      if (overdueCount) {
        badge.className = 'collapsed-urgency has-overdue';
        badge.textContent = overdueCount + ' overdue' + (urgentCount ? ', ' + urgentCount + ' urgent' : '');
      } else if (urgentCount) {
        badge.className = 'collapsed-urgency has-urgent';
        badge.textContent = urgentCount + ' urgent';
      } else {
        badge.className = 'collapsed-urgency has-soon';
        badge.textContent = soonCount + ' due soon';
      }
    });
  }

  // Make group <h3> click toggle collapsed state (manual override)
  document.querySelectorAll('.tramite-group > h3').forEach(h3 => {
    h3.style.cursor = 'pointer';
    h3.addEventListener('click', () => {
      const grp = h3.parentElement;
      if (grp.classList.toggle('group-collapsed')) delete grp.dataset.manualExpand;
      else grp.dataset.manualExpand = '1';
      updateCollapsedBadges();
    });
  });

  // Trámites search
  const searchInput = document.getElementById('tramites-search-input');
  const searchClear = document.getElementById('tramites-search-clear');
  function applySearchFilter(q) {
    q = (q || '').trim().toLowerCase();
    searchClear.style.display = q ? '' : 'none';
    const allRows = document.querySelectorAll('.tramite-row');
    if (!q) {
      allRows.forEach(r => r.style.display = '');
      document.querySelectorAll('.tramite-group').forEach(g => g.style.display = '');
      document.querySelectorAll('.subtasks-panel').forEach(p => { p.style.display = 'none'; });
      return;
    }
    const groupCounts = new Map();
    allRows.forEach(r => {
      const cb = r.querySelector('input[data-group]');
      if (!cb) return;
      const key = cb.dataset.group + '-' + cb.dataset.idx;
      const t = window.TRAMITES[key] || {};
      const name = (r.querySelector('.name')?.textContent || t.name || '').toLowerCase();
      const meta = (r.querySelector('.meta')?.textContent || t.meta || '').toLowerCase();
      const subs = (t.subtasks || []).map(s => s.label).join(' ').toLowerCase();
      const hit = name.includes(q) || meta.includes(q) || subs.includes(q);
      r.style.display = hit ? '' : 'none';
      const grp = cb.dataset.group;
      groupCounts.set(grp, (groupCounts.get(grp) || 0) + (hit ? 1 : 0));
    });
    document.querySelectorAll('.tramite-group').forEach(g => {
      const grpKey = g.id.replace('grp-', '');
      g.style.display = (groupCounts.get(grpKey) || 0) ? '' : 'none';
      g.classList.remove('group-collapsed');
    });
  }
  if (searchInput) {
    searchInput.addEventListener('input', e => applySearchFilter(e.target.value));
    searchClear.addEventListener('click', () => { searchInput.value = ''; applySearchFilter(''); searchInput.focus(); });
  }

  // ---------- Per-row attach ----------
  function renderRowDoc(box) {
    const row = box.closest('.tramite-row');
    const slot = row.querySelector('.doc-slot');
    if (!slot) return;
    const key = box.dataset.group + '-' + box.dataset.idx;
    const folder = slot.dataset.folder;
    slot.innerHTML = '';
    const path = stripLegacyPrefix(state.docs[key]);
    if (path) {
      const a = document.createElement('a');
      a.className = 'doc-pill filled';
      a.href = '#';
      a.rel = 'noopener';
      a.innerHTML = '<span>📎</span><span class="doc-name">' + path.split('/').pop() + '</span>';
      a.onclick = (e) => { e.preventDefault(); openDoc(path); };
      slot.appendChild(a);
      const del = document.createElement('button');
      del.className = 'doc-pill-unlink';
      del.title = 'Unlink';
      del.textContent = '✕';
      del.onclick = (e) => {
        e.preventDefault(); e.stopPropagation();
        delete state.docs[key];
        renderRowDoc(box);
        queueSave();
      };
      slot.appendChild(del);
    } else {
      const btn = document.createElement('button');
      btn.className = 'doc-pill' + (authed ? '' : ' disabled');
      btn.title = 'Upload to ' + folder + '/';
      btn.innerHTML = '<span>⬆</span><span>Upload to ' + folder + '/</span>';
      btn.onclick = () => {
        if (!authed) { toast('⚠ Sign in first', 'error'); return; }
        openAttachPicker(box, folder);
      };
      slot.appendChild(btn);
    }
  }

  function openAttachPicker(box, folder) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf,image/*';
    input.onchange = async () => {
      if (!input.files || !input.files[0]) return;
      const group = box.dataset.group;
      const key = group + '-' + box.dataset.idx;
      const uploaded = await uploadFile(input.files[0], folder);
      if (uploaded) {
        state.docs[key] = uploaded.path;
        renderRowDoc(box);
        queueSave();
        // Refresh the doc list for whichever group matches this folder, if any
        Object.keys(GROUP_FOLDERS).forEach(g => {
          if (GROUP_FOLDERS[g] === folder) refreshDocList(g);
        });
      }
    };
    input.click();
  }

  // ---------- Uploader + Doc list per group ----------
  function slugify(s) {
    return s.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'archivo';
  }
  function yyyymmdd(d) {
    return d.getFullYear().toString() +
      String(d.getMonth()+1).padStart(2,'0') +
      String(d.getDate()).padStart(2,'0');
  }

  async function uploadFile(file, folder) {
    const MAX_HARD = 50 * 1024 * 1024;
    if (file.size > MAX_HARD) { toast('⚠ File exceeds 50 MB limit', 'error'); return null; }

    const origBase = (file.name.split('.').slice(0, -1).join('.') || file.name);
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
    const label = prompt('Name for the file (without extension):', origBase);
    if (label === null) return null;
    const slug = slugify(label) || slugify(origBase);
    const fname = yyyymmdd(new Date()) + '-' + slug + '.' + ext;
    const path = folder + '/' + fname;

    const loadingT = toast('Uploading ' + fname + '…', 'loading');
    const { error } = await sb.storage.from(BUCKET).upload(path, file, {
      upsert: false,
      contentType: file.type || undefined
    });
    loadingT.remove();
    if (error) {
      toast('⚠ Upload error: ' + error.message, 'error');
      return null;
    }
    toast('✓ Uploaded', 'success');
    return { path, name: fname };
  }

  async function refreshDocList(group) {
    const folder = GROUP_FOLDERS[group];
    const listEl = document.getElementById('doc-list-' + group);
    if (!listEl) return;
    if (!authed) { listEl.innerHTML = '<div class="doc-list-empty">Sign in to view documents.</div>'; return; }
    listEl.innerHTML = '<div class="doc-list-empty">Loading…</div>';
    try {
      const { data, error } = await sb.storage.from(BUCKET).list(folder, { limit: 100, sortBy: { column: 'name', order: 'desc' } });
      if (error) throw error;
      const files = (data || []).filter(f => f.name && !f.name.startsWith('.'));
      if (!files.length) { listEl.innerHTML = '<div class="doc-list-empty">No documents yet.</div>'; return; }
      listEl.innerHTML = '';
      files.forEach(f => {
        const entry = document.createElement('div');
        entry.className = 'doc-entry';
        const a = document.createElement('a');
        a.href = '#';
        a.rel = 'noopener';
        a.textContent = f.name;
        a.onclick = (e) => { e.preventDefault(); openDoc(folder + '/' + f.name); };
        entry.appendChild(a);
        const del = document.createElement('button');
        del.className = 'doc-del';
        del.title = 'Delete';
        del.textContent = '🗑';
        del.onclick = async () => {
          if (!confirm('Delete ' + f.name + '?')) return;
          const loadingT = toast('Deleting…', 'loading');
          const fullPath = folder + '/' + f.name;
          const { error: delErr } = await sb.storage.from(BUCKET).remove([fullPath]);
          loadingT.remove();
          if (delErr) { toast('⚠ Error: ' + delErr.message, 'error'); return; }
          toast('✓ Deleted', 'success');
          let dirty = false;
          Object.keys(state.docs).forEach(k => { if (state.docs[k] === fullPath) { delete state.docs[k]; dirty = true; } });
          if (dirty) { applyStateToUI(); queueSave(); }
          refreshDocList(group);
        };
        entry.appendChild(del);
        listEl.appendChild(entry);
      });
    } catch (e) {
      listEl.innerHTML = '<div class="doc-list-empty">Error: ' + (e.message || e) + '</div>';
    }
  }

  function injectUploaderUI() {
    Object.keys(GROUP_FOLDERS).forEach(group => {
      const grpEl = document.getElementById('grp-' + group);
      if (!grpEl || grpEl.querySelector('.uploader')) return;
      const folder = GROUP_FOLDERS[group];

      const uploader = document.createElement('label');
      uploader.className = 'uploader' + (authed ? '' : ' hidden');
      uploader.id = 'upl-' + group;
      uploader.innerHTML =
        '<div>📎 Upload file or drag here → <strong>' + folder + '/</strong></div>' +
        '<div class="u-hint">PDF or image · max 50 MB</div>';
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/pdf,image/*';
      input.setAttribute('capture', 'environment');
      uploader.appendChild(input);
      input.addEventListener('change', async () => {
        if (!input.files || !input.files[0]) return;
        const f = input.files[0];
        input.value = '';
        await uploadFile(f, folder);
        refreshDocList(group);
      });

      // Drag-drop
      uploader.addEventListener('dragover', e => { e.preventDefault(); uploader.classList.add('drag-over'); });
      uploader.addEventListener('dragleave', () => uploader.classList.remove('drag-over'));
      uploader.addEventListener('drop', async e => {
        e.preventDefault();
        uploader.classList.remove('drag-over');
        if (!e.dataTransfer.files.length) return;
        for (const f of e.dataTransfer.files) {
          await uploadFile(f, folder);
        }
        refreshDocList(group);
      });

      const list = document.createElement('div');
      list.className = 'doc-list';
      list.id = 'doc-list-' + group;

      grpEl.appendChild(uploader);
      grpEl.appendChild(list);
    });
  }

  // ---------- Urgent banner dismiss ----------
  const urgDismiss = document.getElementById('urgent-dismiss');
  if (urgDismiss) urgDismiss.addEventListener('click', (e) => {
    e.stopPropagation();
    sessionStorage.setItem('urgent-banner-dismissed', '1');
    document.getElementById('urgent-banner').style.display = 'none';
  });

  // ---------- Settings (now a tab, not a modal) ----------
  const syncPill = document.getElementById('sync-pill');

  // Keep legacy modal wiring for backwards compat (modal still exists in HTML)
  const modal = document.getElementById('settings-modal');
  if (modal) {
    const logoutCancel = document.getElementById('logout-cancel');
    if (logoutCancel) logoutCancel.onclick = () => modal.classList.remove('open');
    modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('open'); });
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.onclick = async () => {
      await sb.auth.signOut();
      location.reload();
    };
  }

  function updateSyncPill() {
    if (authed) {
      syncPill.textContent = '☁ Synced';
      syncPill.classList.add('synced');
    } else {
      syncPill.textContent = '📱 Device only';
      syncPill.classList.remove('synced');
    }
  }

  function refreshAllDocs() {
    Object.keys(GROUP_FOLDERS).forEach(refreshDocList);
  }

  // ---------- Realtime ----------
  function subscribeRealtime() {
    if (!stateRowId) return;
    sb.channel('app_state_changes')
      .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'app_state', filter: 'id=eq.' + stateRowId },
          (payload) => {
            const row = payload.new;
            if (!row) return;
            const remoteUpdated = row.updated_at ? new Date(row.updated_at).getTime() : 0;
            if (remoteUpdated && Math.abs(remoteUpdated - lastSavedAt) < 2000) return;
            state.tramites = row.tramites || {};
            state.docs = normalizeDocs(row.docs);
            state.meta = row.meta || {};
            state.subtasks = row.subtasks || {};
            syncBirthActualToWindow();
            syncCalendarConfig();
            saveLocal();
            applyStateToUI();
          })
      .subscribe();
  }

  // ---------- Init ----------
  state = loadLocal();
  syncBirthActualToWindow();
  syncCalendarConfig();
  applyStateToUI();

  async function initialSync() {
    try {
      const remote = await loadRemote();
      if (remote) {
        state = remote;
        syncBirthActualToWindow();
        saveLocal();
      } else if (stateRowId === null) {
        toast('⚠ Missing initial row in app_state', 'error');
      }
    } catch (e) {
      toast('⚠ Could not load: ' + (e.message || e), 'error');
    }
    applyStateToUI();
  }

  async function initAuthed() {
    sb = window.sb;
    authed = true;
    updateSyncPill();
    await initialSync();
    injectUploaderUI();
    refreshAllDocs();
    allBoxes.forEach(renderRowDoc);
    subscribeRealtime();
  }

  if (window.__authReady) {
    initAuthed();
  } else {
    window.addEventListener('auth-ready', initAuthed, { once: true });
    updateSyncPill();
  }
})();
