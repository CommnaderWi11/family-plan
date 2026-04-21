// ========== CALENDAR ==========
(function() {
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const dayLabels = ['M','T','W','T','F','S','S'];

  // Default config — used when no saved config exists
  const DEFAULT_CONFIG = {
    shiftRef: '2026-04-03',
    shiftCycle: 9,
    shiftDaysOff: 3,
    mandatory: { start: '2026-04-17', end: '2026-05-28' },
    flexibleBlocks: [
      { label: 'Block 1 – June', start: '2026-06-26', end: '2026-07-02' },
      { label: 'Block 2 – August', start: '2026-08-10', end: '2026-08-16' },
      { label: 'Block 3 – La Graciosa', start: '2026-11-08', end: '2026-11-14' },
      { label: 'Blocks 4–6 – Christmas', start: '2026-12-23', end: '2027-01-12' },
      { label: 'Blocks 7–9 – Japan', start: '2027-03-26', end: '2027-04-15' },
    ],
    annualLeave: [
      { label: 'Easter', start: '2026-04-21', end: '2026-05-02' },
      { label: 'Autumn', start: '2026-09-21', end: '2026-10-02' },
      { label: 'December', start: '2026-12-11', end: '2026-12-22' },
    ],
    trips: [
      { label: 'Siam Park', start: '2026-06-05', end: '2026-06-07' },
      { label: 'La Graciosa', start: '2026-11-05', end: '2026-11-12' },
      { label: 'Japan', start: '2027-03-26', end: '2027-04-15' },
    ],
    school: { start: '2026-06-22', end: '2026-07-31' },
    lastSchoolDay: '2026-06-19',
    birthDate: '2026-04-17',
  };

  function parseDate(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }

  function getConfig() {
    const saved = window.__calendarConfig;
    return saved || DEFAULT_CONFIG;
  }
  // Expose for settings UI
  window.__defaultCalendarConfig = DEFAULT_CONFIG;

  function daysBetween(a, b) { return Math.round((b.getTime() - a.getTime()) / 86400000); }

  function buildHelpers(cfg) {
    const shiftRef = parseDate(cfg.shiftRef);
    const cycle = cfg.shiftCycle || 9;
    const daysOff = cfg.shiftDaysOff || 3;
    const mandatory = { start: parseDate(cfg.mandatory.start), end: parseDate(cfg.mandatory.end) };
    const flexibleBlocks = cfg.flexibleBlocks.map(b => ({ label: b.label, start: parseDate(b.start), end: parseDate(b.end) }));
    const annualLeave = cfg.annualLeave.map(a => ({ label: a.label, start: parseDate(a.start), end: parseDate(a.end) }));
    const trips = cfg.trips.map(t => ({ label: t.label, start: parseDate(t.start), end: parseDate(t.end) }));
    const school = { start: parseDate(cfg.school.start), end: parseDate(cfg.school.end) };
    const lastSchoolDay = cfg.lastSchoolDay ? parseDate(cfg.lastSchoolDay) : null;
    const birthDate = parseDate(cfg.birthDate || cfg.mandatory.start);

    function inRange(d, s, e) { return d >= s && d <= e; }
    function isShiftOff(date) {
      const diff = daysBetween(shiftRef, date);
      const pos = ((diff % cycle) + cycle) % cycle;
      return pos < daysOff;
    }
    function getType(date) {
      if (inRange(date, mandatory.start, mandatory.end)) return 'mandatory';
      for (const b of flexibleBlocks) { if (inRange(date, b.start, b.end)) return 'parental'; }
      for (const a of annualLeave) { if (inRange(date, a.start, a.end)) return 'annual'; }
      return null;
    }
    function isTrip(d) { for (const t of trips) { if (inRange(d, t.start, t.end)) return true; } return false; }
    function isSchool(d) { return inRange(d, school.start, school.end); }
    function isAnnualLeave(d) { for (const a of annualLeave) { if (inRange(d, a.start, a.end)) return true; } return false; }
    function isLastSchoolDay(d) { return lastSchoolDay && d.getTime() === lastSchoolDay.getTime(); }
    function isBirthDay(d) { return d.getTime() === birthDate.getTime(); }

    return { mandatory, flexibleBlocks, annualLeave, trips, school, birthDate, isShiftOff, getType, isTrip, isSchool, isAnnualLeave, isLastSchoolDay, isBirthDay, inRange };
  }

  function renderCalendar(cfg) {
    const container = document.getElementById('yearCalendar');
    if (!container) return;
    container.innerHTML = '';

    const h = buildHelpers(cfg);

    // Parental day count
    let totalParentalDays = 0, totalWorkDays = 0;
    for (let dt = new Date(h.mandatory.start); dt <= h.mandatory.end; dt.setDate(dt.getDate() + 1)) {
      totalParentalDays++; if (!h.isShiftOff(new Date(dt))) totalWorkDays++;
    }
    for (const b of h.flexibleBlocks) {
      for (let dt = new Date(b.start); dt <= b.end; dt.setDate(dt.getDate() + 1)) {
        totalParentalDays++; if (!h.isShiftOff(new Date(dt))) totalWorkDays++;
      }
    }
    const target = document.getElementById('parentalDaySummary');
    if (target) {
      target.innerHTML =
        '<div class="total-box"><div class="num c-purple">' + totalParentalDays + '</div><div class="lbl">Leave days (assigned)</div></div>' +
        '<div class="total-box"><div class="num c-pink">' + totalWorkDays + '</div><div class="lbl">On shift working days</div></div>';
    }

    // Render months
    const monthsToShow = [
      [2026,3],[2026,4],[2026,5],[2026,6],[2026,7],[2026,8],
      [2026,9],[2026,10],[2026,11],[2027,0],[2027,1],[2027,2],[2027,3]
    ];
    for (const [year, month] of monthsToShow) {
      const monthDiv = document.createElement('div');
      monthDiv.className = 'glass cal-month';
      const title = document.createElement('h3');
      title.textContent = monthNames[month] + (year === 2027 ? ' 2027' : '');
      monthDiv.appendChild(title);
      const header = document.createElement('div');
      header.className = 'cal-header';
      for (const lbl of dayLabels) { const s = document.createElement('span'); s.textContent = lbl; header.appendChild(s); }
      monthDiv.appendChild(header);
      const daysDiv = document.createElement('div');
      daysDiv.className = 'cal-days';
      const firstDay = new Date(year, month, 1);
      let startDow = firstDay.getDay() - 1; if (startDow < 0) startDow = 6;
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      for (let i = 0; i < startDow; i++) { const e = document.createElement('div'); e.className = 'cal-day empty'; daysDiv.appendChild(e); }
      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month, d);
        const dow = date.getDay();
        const isWeekend = (dow === 0 || dow === 6);
        const shiftOff = h.isShiftOff(date);
        const type = h.getType(date);
        const tripDay = h.isTrip(date);
        const schoolDay = h.isSchool(date);
        const cell = document.createElement('div');
        cell.className = 'cal-day';
        cell.textContent = d;
        const alsoAnnual = h.isAnnualLeave(date);
        if (type && alsoAnnual && type !== 'annual') {
          cell.classList.add(type === 'mandatory' ? 'split-mandatory-annual' : 'split-parental-annual');
        } else if (type) {
          cell.classList.add(type);
        } else if (isWeekend) {
          cell.classList.add('weekend');
        } else {
          cell.classList.add('workday');
        }
        if (shiftOff) { cell.classList.add('shift-off'); cell.title = 'Shift day off'; }
        if (tripDay) cell.classList.add('trip');
        if (schoolDay) cell.classList.add('school');
        if (h.isBirthDay(date)) { cell.classList.add('baby'); cell.title = 'Luca is born!'; }
        if (h.isLastSchoolDay(date)) { cell.classList.add('last-school'); cell.title = 'Last day of school'; }
        const todayCmp = new Date(); todayCmp.setHours(0,0,0,0);
        if (date.getTime() === todayCmp.getTime()) { cell.classList.add('today'); cell.title = (cell.title ? cell.title + ' · ' : '') + 'Today'; }
        daysDiv.appendChild(cell);
      }
      monthDiv.appendChild(daysDiv);
      container.appendChild(monthDiv);
    }

    // Update leave countdown if available
    if (typeof window.updateLeaveCountdown === 'function') {
      window.updateLeaveCountdown(cfg);
    }
  }

  // ========== LEAVE COUNTDOWN ==========
  function fmtShort(d) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return d.getDate() + ' ' + months[d.getMonth()] + (d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : '');
  }

  window.updateLeaveCountdown = function(cfg) {
    const today = new Date(); today.setHours(0,0,0,0);
    const birthDate = parseDate(cfg.birthDate || cfg.mandatory.start);

    // Build sorted list of all leave blocks
    const allBlocks = [];
    if (cfg.mandatory && cfg.mandatory.start && cfg.mandatory.end) {
      allBlocks.push({ label: 'Mandatory', start: parseDate(cfg.mandatory.start), end: parseDate(cfg.mandatory.end) });
    }
    (cfg.flexibleBlocks || []).forEach(b => {
      if (b.start && b.end) allBlocks.push({ label: b.label || 'Flexible', start: parseDate(b.start), end: parseDate(b.end) });
    });
    allBlocks.sort((a, b) => a.start - b.start);

    // Calculate totals
    let totalAssigned = 0;
    let daysUsed = 0;
    let currentBlock = null;
    let nextBlock = null;

    for (const block of allBlocks) {
      const blockDays = daysBetween(block.start, block.end) + 1;
      totalAssigned += blockDays;

      if (today > block.end) {
        daysUsed += blockDays;
      } else if (today >= block.start && today <= block.end) {
        daysUsed += daysBetween(block.start, today) + 1;
        currentBlock = block;
      } else if (!nextBlock && today < block.start) {
        nextBlock = block;
      }
    }

    const remaining = totalAssigned - daysUsed;

    // Next block info
    let nextText = '—';
    let nextLabel = 'Next block';
    if (currentBlock) {
      const daysLeft = daysBetween(today, currentBlock.end);
      nextText = daysLeft + 'd left';
      nextLabel = currentBlock.label || 'On leave';
    } else if (nextBlock) {
      const daysUntil = daysBetween(today, nextBlock.start);
      nextText = 'in ' + daysUntil + 'd';
      nextLabel = (nextBlock.label || 'Next') + ' · ' + fmtShort(nextBlock.start);
    } else {
      nextText = '—';
      nextLabel = 'All blocks completed';
    }

    // Return to work: day after current block ends (or after next block)
    let returnText = '—';
    if (currentBlock) {
      const ret = new Date(currentBlock.end); ret.setDate(ret.getDate() + 1);
      returnText = fmtShort(ret);
    } else if (nextBlock) {
      const ret = new Date(nextBlock.end); ret.setDate(ret.getDate() + 1);
      returnText = fmtShort(ret);
    }

    // Deadlines
    const age1 = new Date(birthDate); age1.setFullYear(age1.getFullYear() + 1);
    const age8 = new Date(birthDate); age8.setFullYear(age8.getFullYear() + 8);
    const daysToAge1 = daysBetween(today, age1);
    const daysToAge8 = daysBetween(today, age8);

    // Update DOM
    var el;
    el = document.getElementById('cd-used'); if (el) el.textContent = daysUsed;
    el = document.getElementById('cd-remaining'); if (el) el.textContent = remaining;
    el = document.getElementById('cd-next-in'); if (el) el.textContent = nextText;
    el = document.getElementById('cd-next-label'); if (el) el.textContent = nextLabel;
    el = document.getElementById('cd-return'); if (el) el.textContent = returnText;
    el = document.getElementById('cd-progress');
    if (el) el.style.width = (totalAssigned ? Math.round((daysUsed / totalAssigned) * 100) : 0) + '%';

    var dlEl = document.getElementById('cd-deadlines');
    if (dlEl) {
      var pills = [];
      if (daysToAge1 > 0) {
        pills.push('<span class="cd-deadline">Flexible leave deadline (age 1): ' + fmtShort(age1) + ' (' + daysToAge1 + 'd)</span>');
      }
      pills.push('<span class="cd-deadline">Additional leave deadline (age 8): ' + fmtShort(age8) + ' (' + daysToAge8 + 'd)</span>');
      dlEl.innerHTML = pills.join('');
    }
  };

  // Public API
  window.rebuildCalendar = function() {
    renderCalendar(getConfig());
  };
  window.getCalendarConfig = getConfig;
  window.__calendarHelpers = { daysBetween: daysBetween, parseDate: parseDate, buildHelpers: buildHelpers };

  // Initial render
  renderCalendar(getConfig());
})();
