// ========== DOCUMENT LIBRARY ==========
(function() {
  const BUCKET = 'documents';
  const LIB_PREFIX = 'library/';
  let sb = null;
  let library = [];            // [{ id, filename, storage_path, doc_type, tags, uploaded_at }]
  let attachments = [];         // [{ tramite_key, document_id }]
  let currentPickerTramite = null;

  const typeLabels = {
    'dni-luis': 'DNI Luis', 'dni-madre': 'DNI Colombina',
    'libro-familia': 'Libro de Familia', 'empadronamiento': 'Empadronamiento',
    'parte-medico': 'Medical birth report', 'informe-mat': 'Maternity report',
    'cert-empresa': 'Company cert.', 'iban': 'IBAN',
    'seguro-medico': 'Health insurance', 'otro': 'Other'
  };

  function toast(msg, kind) {
    const host = document.getElementById('toast-host'); if (!host) return;
    const el = document.createElement('div');
    el.className = 'toast ' + (kind || 'info');
    el.innerHTML = '<span>' + msg + '</span>';
    host.appendChild(el);
    setTimeout(() => el.remove(), kind === 'error' ? 6000 : 2500);
  }

  async function signedUrl(path) {
    const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, 3600);
    if (error) return null;
    return data && data.signedUrl;
  }

  async function fetchLibrary() {
    const { data, error } = await sb.from('documents').select('*').order('uploaded_at', { ascending: false });
    if (error) { toast('⚠ Could not read library: ' + error.message, 'error'); return; }
    library = data || [];
    renderLibrary();
    renderAttachedPillsAll();
  }
  async function fetchAttachments() {
    const { data, error } = await sb.from('tramite_attachments').select('*');
    if (error) { toast('⚠ Could not read attachments: ' + error.message, 'error'); return; }
    attachments = data || [];
    renderAttachedPillsAll();
  }

  function renderLibrary() {
    const listEl = document.getElementById('lib-list');
    if (!listEl) return;
    if (!library.length) { listEl.innerHTML = '<div class="doc-list-empty">No documents in library yet.</div>'; return; }
    const byType = {};
    library.forEach(d => {
      const k = d.doc_type || 'otro';
      (byType[k] = byType[k] || []).push(d);
    });
    let html = '';
    Object.keys(byType).forEach(type => {
      html += '<div class="lib-group">';
      html += '<div class="lib-group-title">' + (typeLabels[type] || type) + ' <span class="lib-group-count">' + byType[type].length + '</span></div>';
      byType[type].forEach(d => {
        const count = attachments.filter(a => a.document_id === d.id).length;
        html += '<div class="lib-entry" data-id="' + d.id + '">';
        html += '<a class="lib-name" href="#">' + escapeHtml(d.filename) + '</a>';
        html += '<span class="lib-attach-count" title="Attached to ' + count + ' procedures">📎 ' + count + '</span>';
        html += '<button class="lib-del" title="Delete">🗑</button>';
        html += '</div>';
      });
      html += '</div>';
    });
    listEl.innerHTML = html;
    listEl.querySelectorAll('.lib-entry').forEach(entry => {
      const id = entry.dataset.id;
      const doc = library.find(d => d.id === id);
      entry.querySelector('.lib-name').onclick = async (e) => {
        e.preventDefault();
        const url = await signedUrl(doc.storage_path);
        if (url) window.open(url, '_blank', 'noopener');
      };
      entry.querySelector('.lib-del').onclick = async () => {
        if (!confirm('Delete "' + doc.filename + '" from library? It will be unlinked from all procedures.')) return;
        const t = toast('Deleting…', 'loading');
        await sb.storage.from(BUCKET).remove([doc.storage_path]);
        const { error } = await sb.from('documents').delete().eq('id', doc.id);
        t.remove();
        if (error) { toast('⚠ ' + error.message, 'error'); return; }
        toast('✓ Deleted', 'success');
        await Promise.all([fetchLibrary(), fetchAttachments()]);
      };
    });
  }

  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  function renderAttachedPillsAll() {
    document.querySelectorAll('.tramite-row').forEach(row => {
      const cb = row.querySelector('input[type="checkbox"][data-group]');
      if (!cb) return;
      const key = cb.dataset.group + '-' + cb.dataset.idx;
      renderAttachedPills(key, row);
    });
  }
  function renderAttachedPills(key, row) {
    if (!row) {
      const cb = document.querySelector('.tramite-row input[data-group="' + key.split('-')[0] + '"][data-idx="' + key.split('-').slice(1).join('-') + '"]');
      if (!cb) return;
      row = cb.closest('.tramite-row');
    }
    let host = row.querySelector('.lib-attached-host');
    if (!host) {
      host = document.createElement('span');
      host.className = 'lib-attached-host';
      const info = row.querySelector('.tramite-info');
      if (info) info.appendChild(host);
    }
    host.innerHTML = '';
    const keyAttachments = attachments.filter(a => a.tramite_key === key);
    keyAttachments.forEach(a => {
      const doc = library.find(d => d.id === a.document_id);
      if (!doc) return;
      const pill = document.createElement('a');
      pill.className = 'lib-pill';
      pill.href = '#';
      pill.innerHTML = '<span>📎</span><span>' + escapeHtml(doc.filename) + '</span>';
      pill.onclick = async (e) => { e.preventDefault(); const u = await signedUrl(doc.storage_path); if (u) window.open(u, '_blank', 'noopener'); };
      host.appendChild(pill);
    });
    // "Adjuntar desde biblioteca" button
    let addBtn = row.querySelector('.lib-add-btn');
    if (!addBtn) {
      addBtn = document.createElement('button');
      addBtn.className = 'lib-add-btn';
      addBtn.type = 'button';
      addBtn.title = 'Attach from library';
      addBtn.textContent = '📎+';
      row.appendChild(addBtn);
      addBtn.onclick = () => openPickerForTramite(key);
    }
  }

  function openPickerForTramite(key) {
    currentPickerTramite = key;
    const modal = document.getElementById('lib-picker-modal');
    const t = window.TRAMITES && window.TRAMITES[key];
    const nameEl = document.getElementById('lib-picker-tramite-name');
    nameEl.textContent = t && t.name ? t.name : key;
    renderPickerList();
    modal.classList.add('open');
  }
  function renderPickerList() {
    const list = document.getElementById('lib-picker-list');
    if (!library.length) {
      list.innerHTML = '<div class="doc-list-empty">Upload documents first from the Docs tab.</div>';
      return;
    }
    const attachedIds = new Set(attachments.filter(a => a.tramite_key === currentPickerTramite).map(a => a.document_id));
    list.innerHTML = library.map(d => {
      const type = typeLabels[d.doc_type || 'otro'] || 'Other';
      const checked = attachedIds.has(d.id) ? 'checked' : '';
      return '<label class="lib-pick-item"><input type="checkbox" data-id="' + d.id + '" ' + checked + '> <span class="lib-pick-name">' + escapeHtml(d.filename) + '</span> <span class="lib-pick-type">' + type + '</span></label>';
    }).join('');
    list.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', async () => {
        const docId = cb.dataset.id;
        if (cb.checked) {
          const { error } = await sb.from('tramite_attachments').insert({ tramite_key: currentPickerTramite, document_id: docId });
          if (error) { toast('⚠ ' + error.message, 'error'); cb.checked = false; return; }
        } else {
          const { error } = await sb.from('tramite_attachments').delete().match({ tramite_key: currentPickerTramite, document_id: docId });
          if (error) { toast('⚠ ' + error.message, 'error'); cb.checked = true; return; }
        }
        await fetchAttachments();
      });
    });
  }

  async function uploadToLibrary(file, docType) {
    if (!file) return;
    const id = crypto.randomUUID();
    const safeName = file.name.replace(/[^\w.\-]+/g, '_');
    const path = LIB_PREFIX + id + '/' + safeName;
    const t = toast('Uploading…', 'loading');
    const up = await sb.storage.from(BUCKET).upload(path, file, { upsert: false, contentType: file.type || undefined });
    if (up.error) { t.remove(); toast('⚠ ' + up.error.message, 'error'); return null; }
    const ins = await sb.from('documents').insert({
      id, filename: file.name, storage_path: path, doc_type: docType || null
    }).select().single();
    t.remove();
    if (ins.error) { toast('⚠ ' + ins.error.message, 'error'); return null; }
    toast('✓ Uploaded', 'success');
    await fetchLibrary();
    return ins.data;
  }

  function wire() {
    const pickBtn = document.getElementById('lib-pick-btn');
    const fileInput = document.getElementById('lib-file-input');
    const typeSelect = document.getElementById('lib-type-select');
    pickBtn && pickBtn.addEventListener('click', (e) => { e.preventDefault(); fileInput.click(); });
    fileInput && fileInput.addEventListener('change', async () => {
      if (!fileInput.files || !fileInput.files[0]) return;
      await uploadToLibrary(fileInput.files[0], typeSelect.value || null);
      fileInput.value = '';
    });
    const modal = document.getElementById('lib-picker-modal');
    modal && modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('open'); });
    document.getElementById('lib-picker-close').onclick = () => modal.classList.remove('open');
    document.getElementById('lib-picker-upload').onclick = () => {
      const tempIn = document.createElement('input');
      tempIn.type = 'file';
      tempIn.accept = 'application/pdf,image/*';
      tempIn.onchange = async () => {
        if (!tempIn.files || !tempIn.files[0]) return;
        const t = window.TRAMITES && window.TRAMITES[currentPickerTramite];
        const guessType = t && t.requiresDocs && t.requiresDocs[0] ? t.requiresDocs[0] : null;
        const doc = await uploadToLibrary(tempIn.files[0], guessType);
        if (doc) {
          await sb.from('tramite_attachments').insert({ tramite_key: currentPickerTramite, document_id: doc.id });
          await fetchAttachments();
          renderPickerList();
        }
      };
      tempIn.click();
    };
  }

  function subscribeLibRealtime() {
    sb.channel('lib-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, () => fetchLibrary())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tramite_attachments' }, () => fetchAttachments())
      .subscribe();
  }

  async function init() {
    sb = window.sb;
    wire();
    await Promise.all([fetchLibrary(), fetchAttachments()]);
    subscribeLibRealtime();
  }

  if (window.__authReady) init();
  else window.addEventListener('auth-ready', init, { once: true });
})();
