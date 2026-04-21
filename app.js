// ========== DEADLINE ENGINE ==========
window.BIRTH_EDD = new Date(2026, 3, 17, 12, 0, 0); // C-section 17 Apr 2026 12:00
window.birthActual = '2026-04-17'; // Luca born April 17, 2026
window.getBirthAnchor = function() {
  if (window.birthActual) {
    const [y, m, d] = window.birthActual.split('-').map(n => parseInt(n, 10));
    return new Date(y, m - 1, d);
  }
  return window.BIRTH_EDD;
};
window.isBornYet = function() { return !!window.birthActual; };

window.BLOQUE_STARTS = {
  1: new Date(2026, 3, 17),   // obligatorio
  2: new Date(2026, 5, 26),
  3: new Date(2026, 7, 10),
  4: new Date(2026, 10, 8),
  5: new Date(2026, 11, 23)
};

// Full trámite registry. Backwards-compat: window.TRAMITE_DEADLINES still works, read from .deadline.
// scope: nacional | autonomica | municipal | privado | empresa
// priority: critical | high | normal
// dependsOn: [otherKey, ...]  — row greys out until deps are checked
// Existing 4 groups are also in HTML; new 3 groups (bebe, salud, ayudas) render from this config.
window.TRAMITES = {
  // ---------- Preparación ----------
  'preparacion-0': { deadline: { kind: 'beforeEDD', days: 7, label: 'Ready 7d before EDD' }, priority: 'critical', scope: 'privado',
    subtasks: [
      { id: 'mama-ropa', label: 'Mom: nightgowns (2) + robe + nursing bra + flip-flops' },
      { id: 'mama-higiene', label: 'Mom: toiletry bag (toothbrush, toothpaste, postpartum pads, towel)' },
      { id: 'bebe-bodys', label: 'Baby: bodysuits 0-3m (5-6) + pajamas + socks + hat' },
      { id: 'bebe-manta', label: 'Baby: swaddle blanket + muslin wrap + hooded towel' },
      { id: 'bebe-panales', label: 'Baby: newborn diapers (1 pack) + wipes' },
      { id: 'docs-hospital', label: 'Docs: parents DNIs + mom SS card + Vithas insurance card' },
      { id: 'acomp-essentials', label: 'Companion: phone charger + snacks + water bottle + change of clothes' }
    ]
  },
  'preparacion-1': { deadline: { kind: 'absolute', date: '2026-04-30', label: 'Before Apr 30' }, priority: 'critical', scope: 'nacional',
    subtasks: [
      { id: 'comprar', label: 'Buy i-Size group 0+ approved car seat' },
      { id: 'instalar', label: 'Install in car (isofix base or seatbelt)' },
      { id: 'probar', label: 'Practice latching and unlatching' }
    ]
  },
  'preparacion-2': { deadline: { kind: 'beforeEDD', days: 14, label: 'Submit week 36-37' }, priority: 'high', scope: 'privado' },
  'preparacion-3': { deadline: { kind: 'beforeEDD', days: 3, label: 'Coordinate 3d before EDD' }, priority: 'high', scope: 'privado',
    subtasks: [
      { id: 'school', label: 'Confirm Luther King schedule/pickup' },
      { id: 'cuidador', label: 'Confirm primary caregiver (grandparents/family)' },
      { id: 'pernocta', label: 'Plan B for overnight if birth is at night' }
    ]
  },
  // ---------- Registro Civil ----------
  'registro-0': { deadline: { kind: 'afterBirth', days: 3, label: '72h after birth' }, priority: 'critical', scope: 'privado' },
  'registro-1': { deadline: { kind: 'afterBirth', days: 10, label: '10 days after birth' }, scope: 'nacional' },
  'registro-2': { deadline: { kind: 'afterBirth', days: 10, label: '10 days after birth' }, scope: 'nacional' },
  'registro-3': { deadline: { kind: 'afterBirth', days: 10, label: '10 days (max 30)' }, scope: 'nacional' },
  // ---------- INSS ----------
  'inss-0': { deadline: { kind: 'afterBirth', days: 15, label: 'ASAP after birth' }, priority: 'high', scope: 'nacional',
    subtasks: [
      { id: 'clave', label: 'Have active Cl@ve PIN or digital certificate' },
      { id: 'form', label: 'Fill out form MP-1 bis (INSS online portal)' },
      { id: 'adj-libro', label: 'Attach Libro de Familia / certified copy' },
      { id: 'adj-dni', label: 'Attach both parents DNIs' },
      { id: 'adj-iban', label: 'Attach IBAN ownership certificate' },
      { id: 'enviar', label: 'Submit application and save reference number' }
    ]
  },
  'inss-1': { deadline: { kind: 'afterBirth', days: 15, label: 'With application' }, scope: 'nacional' },
  'inss-2': { deadline: { kind: 'afterBirth', days: 15, label: 'After birth' }, scope: 'autonomica' },
  'inss-3': { deadline: { kind: 'afterBirth', days: 15, label: 'After Registro Civil registration' }, scope: 'nacional' },
  'inss-4': { deadline: { kind: 'afterBirth', days: 15, label: 'Company certificate' }, scope: 'empresa' },
  'inss-5': { deadline: { kind: 'beforeBloque', bloque: 2, days: 15, label: '15d before block' }, scope: 'nacional' },
  // ---------- Binter ----------
  'binter-0': { deadline: { kind: 'beforeEDD', days: 1, label: 'Before birth' }, priority: 'critical', scope: 'empresa' },
  'binter-1': { deadline: { kind: 'afterBirth', days: 15, label: 'After Registro Civil registration' }, scope: 'empresa' },
  'binter-2': { deadline: { kind: 'beforeBloque', bloque: 2, days: 15, label: '15d before block' }, scope: 'empresa' },
  'binter-3': { deadline: { kind: 'absolute', date: '2026-06-20', label: 'Due 20 Jun 2026' }, scope: 'empresa' },
  'binter-4': { deadline: { kind: 'absolute', date: '2026-04-25', label: 'Due 25 Apr 2026' }, priority: 'high', scope: 'empresa' },
  // ---------- Bebé (admin) ----------
  'bebe-0': { name: 'Online birth registration at Registro Civil (Vithas handles)', meta: 'Vithas Ciudad Jardín · 72h · Processed from hospital',
              deadline: { kind: 'afterBirth', days: 3, label: '72h after birth' }, priority: 'critical', scope: 'privado' },
  'bebe-1': { name: 'Libro de Familia / Certified copy', meta: 'Registro Civil online · Required for all other procedures',
              deadline: { kind: 'afterBirth', days: 10, label: '~10 days after registration' }, priority: 'high', scope: 'nacional',
              dependsOn: ['bebe-0'] },
  'bebe-2': { name: 'Empadronamiento baby (Ciudad Jardín, LPGC)', meta: 'Las Palmas City Hall · OAC Ciudad Jardín · Requires Libro de Familia',
              deadline: { kind: 'afterBirth', days: 30, label: 'First month' }, scope: 'municipal',
              dependsOn: ['bebe-1'],
              subtasks: [
                { id: 'cita', label: 'Book appointment at OAC Ciudad Jardín' },
                { id: 'docs', label: 'Bring: Libro de Familia + parents DNIs + mother Empadronamiento' },
                { id: 'volante', label: 'Obtain baby Empadronamiento certificate' }
              ] },
  'bebe-3': { name: 'SCS health card for baby', meta: 'SCS · Requires Empadronamiento · Health center assignment',
              deadline: { kind: 'afterBirth', days: 30, label: 'First month' }, scope: 'autonomica',
              dependsOn: ['bebe-2'],
              subtasks: [
                { id: 'online', label: 'Online request at miscs.sergas.es (or SCS equivalent)' },
                { id: 'presencial', label: 'Alternative: in person at CS Ciudad Jardín with Libro de Familia + Empadronamiento certificate' }
              ] },
  'bebe-4': { name: 'Familia Digital (Mi Familia app)', meta: 'Ministry of Justice · Replaces paper Libro de Familia · Optional',
              deadline: { kind: 'afterBirth', days: 30, label: 'When available' }, scope: 'nacional',
              dependsOn: ['bebe-1'] },
  'bebe-5': { name: 'Baby DNI', meta: 'Dirección General de Policía · Appointment required · Needed for passport',
              deadline: { kind: 'afterBirth', days: 90, label: 'Before requesting passport' }, scope: 'nacional',
              dependsOn: ['bebe-1'] },
  'bebe-6': { name: 'Baby passport', meta: 'Dirección General de Policía · Needed for Japan trip Apr 2027 · Start 2 months ahead',
              deadline: { kind: 'absolute', date: '2027-02-01', label: 'At least 2 months before trip' }, scope: 'nacional',
              dependsOn: ['bebe-5'] },
  // ---------- Salud ----------
  'salud-0': { name: 'Pediatrician assignment (CS Ciudad Jardín)', meta: 'SCS Gran Canaria · Health center by zone',
               deadline: { kind: 'afterBirth', days: 30, label: 'After health card' }, scope: 'autonomica',
               dependsOn: ['bebe-3'] },
  'salud-1': { name: 'Metabolic screening (heel prick test)', meta: 'Vithas · Done within first 48h · Results ~15 days',
               deadline: { kind: 'afterBirth', days: 2, label: '48h after birth' }, priority: 'critical', scope: 'privado' },
  'salud-2': { name: 'Hearing screening', meta: 'Vithas · Done at hospital at birth',
               deadline: { kind: 'afterBirth', days: 2, label: '48h after birth' }, priority: 'critical', scope: 'privado' },
  'salud-3': { name: 'Postpartum midwife checkup (week 1 & 6)', meta: 'SCS La Laguna · First visit in the first week',
               deadline: { kind: 'afterBirth', days: 7, label: 'First week' }, priority: 'high', scope: 'autonomica' },
  'salud-4': { name: 'Maternity report (SCS)', meta: 'Midwife or family doctor · NOT issued by Vithas · Required for INSS benefit',
               deadline: { kind: 'afterBirth', days: 15, label: 'First 2 weeks' }, priority: 'high', scope: 'autonomica' },
  'salud-5': { name: 'Well-baby checkup (1 month)', meta: 'Assigned pediatrician · First Child Health Program visit',
               deadline: { kind: 'afterBirth', days: 30, label: '~1 month old' }, scope: 'autonomica',
               dependsOn: ['salud-0'] },
  'salud-6': { name: 'Vaccine 2 months (Canarias schedule)', meta: 'Assigned health center · Hexavalent + meningo B + pneumococcal + rotavirus',
               deadline: { kind: 'afterBirth', days: 60, label: '2 months exactly' }, scope: 'autonomica',
               dependsOn: ['salud-0'] },
  'salud-7': { name: 'Vaccine 4 months', meta: 'Assigned health center',
               deadline: { kind: 'afterBirth', days: 120, label: '4 months' }, scope: 'autonomica',
               dependsOn: ['salud-6'] },
  'salud-8': { name: 'Vaccine 11 months', meta: 'Hexavalent + Meningo C',
               deadline: { kind: 'afterBirth', days: 330, label: '11 months' }, scope: 'autonomica',
               dependsOn: ['salud-7'] },
  'salud-9': { name: 'Vaccine 12 months', meta: 'MMR + Meningo B + Varicella + Pneumococcal',
               deadline: { kind: 'afterBirth', days: 365, label: '12 months' }, scope: 'autonomica',
               dependsOn: ['salud-8'] },
  'salud-10': { name: 'Vaccine 15 months', meta: 'Hepatitis A',
                deadline: { kind: 'afterBirth', days: 456, label: '15 months' }, scope: 'autonomica',
                dependsOn: ['salud-9'] },
  // ---------- Ayudas económicas ----------
  'ayudas-0': { name: 'Contact tax advisor Elena Melián', meta: 'IRPF verification — family data · Update number of children for withholdings · To employer',
                deadline: { kind: 'afterBirth', days: 60, label: 'First 2 months' }, scope: 'nacional' },
  'ayudas-2': { name: 'Update life insurance beneficiaries', meta: 'Insurance company · Include new child',
                deadline: { kind: 'afterBirth', days: 60, label: 'First 2 months' }, scope: 'nacional' },
  'ayudas-3': { name: 'Update private health insurance (if applicable)', meta: 'Insurance company · Register baby · Some have 15-30 day deadline',
                deadline: { kind: 'afterBirth', days: 15, label: 'First 2 weeks' }, priority: 'high', scope: 'privado' }
};

// Backwards-compat alias used by legacy paths.
window.TRAMITE_DEADLINES = new Proxy({}, {
  get(_, key) {
    const t = window.TRAMITES[key];
    if (!t || !t.deadline) return undefined;
    return Object.assign({ priority: t.priority }, t.deadline);
  },
  has(_, key) { return !!(window.TRAMITES[key] && window.TRAMITES[key].deadline); }
});

window.GROUPS = {
  preparacion: { title: '🎒 Pre-birth preparation', desc: 'Critical tasks before birth.', renderMode: 'html' },
  registro:    { title: 'Registro Civil — Birth Registration', renderMode: 'html' },
  inss:        { title: 'INSS / Seguridad Social — Birth Benefit', renderMode: 'html' },
  binter:      { title: 'Binter — Company / HR', renderMode: 'html' },
  bebe:        { title: '👶 Baby — Admin', desc: 'Administrative procedures for baby after birth.', renderMode: 'js', count: 7 },
  salud:       { title: '🩺 Health', desc: 'Health monitoring between Vithas (delivery) and SCS (postpartum La Laguna / LPGC). Canarias vaccine schedule.', renderMode: 'js', count: 11 },
  ayudas:      { title: '💶 Financial assistance', desc: 'Deductions and benefits at national, regional, and municipal levels.', renderMode: 'js', count: 4 }
};

window.SCOPE_CHIPS = {
  nacional:   { label: 'National', emoji: '🇪🇸', cls: 'chip-nac' },
  autonomica: { label: 'Canarias', emoji: '🌴', cls: 'chip-aut' },
  municipal:  { label: 'LPGC', emoji: '🏛', cls: 'chip-mun' },
  privado:    { label: 'Vithas', emoji: '🏥', cls: 'chip-prv' },
  empresa:    { label: 'Binter', emoji: '🏢', cls: 'chip-emp' }
};

window.resolveDeadline = function(key) {
  const rule = window.TRAMITE_DEADLINES[key];
  if (!rule) return null;
  let d = null;
  if (rule.kind === 'absolute') d = new Date(rule.date);
  else if (rule.kind === 'afterBirth') { d = new Date(window.getBirthAnchor()); d.setDate(d.getDate() + rule.days); }
  else if (rule.kind === 'beforeEDD') { d = new Date(window.BIRTH_EDD); d.setDate(d.getDate() - rule.days); }
  else if (rule.kind === 'beforeBloque') { const b = window.BLOQUE_STARTS[rule.bloque]; if (!b) return null; d = new Date(b); d.setDate(d.getDate() - rule.days); }
  if (!d) return null;
  d.setHours(0,0,0,0);
  const today = new Date(); today.setHours(0,0,0,0);
  const days = Math.round((d - today) / 86400000);
  return { date: d, daysUntil: days, label: rule.label, rule };
};

window.formatDeadlineBadge = function(daysUntil) {
  if (daysUntil < 0) return { text: 'Overdue ' + Math.abs(daysUntil) + 'd', cls: 'dl-overdue' };
  if (daysUntil === 0) return { text: 'Due today', cls: 'dl-urgent' };
  if (daysUntil === 1) return { text: 'Due tomorrow', cls: 'dl-urgent' };
  if (daysUntil <= 3) return { text: 'Due in ' + daysUntil + 'd', cls: 'dl-urgent' };
  if (daysUntil <= 14) return { text: 'Due in ' + daysUntil + 'd', cls: 'dl-soon' };
  return { text: 'Due in ' + daysUntil + 'd', cls: 'dl-ok' };
};

window.fmtLongDate = function(d) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
};
