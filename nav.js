// ========== SERVICE WORKER ==========
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {/* ignore */});
  });
}

// ========== TAB NAV ==========
(function() {
  const links = Array.from(document.querySelectorAll('.nav-link')).filter(l => {
    const href = l.getAttribute('href');
    return href && href.startsWith('#');
  });
  const sections = document.querySelectorAll('.container > section.tab-section');
  if (!links.length) return;

  function activate(id) {
    const target = document.getElementById(id);
    if (!target || !target.classList.contains('tab-section')) return false;
    sections.forEach(s => s.classList.remove('active'));
    links.forEach(l => l.classList.remove('active'));
    target.classList.add('active');
    document.body.dataset.tab = id;
    const link = links.find(l => l.getAttribute('href') === '#' + id);
    if (link) link.classList.add('active');
    window.scrollTo(0, 0);
    return true;
  }

  links.forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const id = link.getAttribute('href').slice(1);
      if (activate(id)) history.replaceState(null, '', '#' + id);
    });
  });

  const initial = (location.hash || '').slice(1);
  if (!initial || !activate(initial)) activate('resumen');
})();
