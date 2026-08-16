(() => {
  const cfg = window.LW_CONFIG;
  const demo = window.LW_DEMO_DATA;
  const state = { scope: cfg.app.defaultScope, period: cfg.app.defaultPeriod, compare: 'prior', view: 'ceo' };

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const safeDiv = (a, b) => b ? a / b : 0;
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const fmtNum = (v, d = 0) => Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
  const fmtPct = (v, d = 1) => `${((v || 0) * 100).toFixed(d)}%`;
  const fmtMoney = v => `$${Math.round(v || 0).toLocaleString()}`;
  const fmtMoneyK = v => `$${((v || 0) / 1000).toFixed(Math.abs(v || 0) >= 100000 ? 0 : 1)}k`;
  const schoolKeys = () => Object.keys(cfg.schools || {});
  const schoolCfg = key => cfg.schools[key];
  const rawSchoolData = (period, key) => demo.periods?.[period]?.scopes?.[key] || null;

  function deterministicWage(key) {
    const index = Math.max(0, schoolKeys().indexOf(key));
    return 29.4 + index * 0.55;
  }

  function hydrate(period, key, source) {
    if (!source) return null;
    const d = JSON.parse(JSON.stringify(source));
    d.capacity = d.capacity ?? schoolCfg(key)?.effectiveCapacity ?? 0;
    d.netBilled = Math.max(0, (d.charges || 0) - (d.discounts || 0));
    d.openSeats = Math.max(0, d.capacity - (d.fte || 0));
    d.scheduledStarts = d.scheduledStarts ?? (d.classrooms || []).reduce((s, c) => s + (c.futureStarts || 0), 0);
    d.knownDepartures = d.knownDepartures ?? Math.max(0, Math.round(d.scheduledStarts * (key === 'orono' ? 0.25 : 0.35)));
    d.netScheduledAdds = d.scheduledStarts - d.knownDepartures;
    const lastForecast = d.forecastSeries?.length ? d.forecastSeries[d.forecastSeries.length - 1] : (d.fte || 0) + d.netScheduledAdds;
    d.forecast30Fte = d.forecast30Fte ?? Math.min(d.capacity, Math.max(d.fte || 0, lastForecast));
    d.forecast60Fte = d.forecast60Fte ?? Math.min(d.capacity, d.forecast30Fte + Math.max(0, Math.round(d.netScheduledAdds * 0.55)));
    d.forecast90Fte = d.forecast90Fte ?? Math.min(d.capacity, d.forecast60Fte + Math.max(0, Math.round(d.netScheduledAdds * 0.40)));
    d.scheduledStaffHours = d.scheduledStaffHours ?? Math.round((d.staffHours || 0) * 1.025);
    d.grossPayroll = d.grossPayroll ?? Math.round((d.staffHours || 0) * deterministicWage(key));
    const pd = d.pastDue || 0;
    d.aging = d.aging || {
      current: Math.round(pd * 0.48),
      d1_30: Math.round(pd * 0.29),
      d31_60: Math.round(pd * 0.15),
      d60plus: Math.max(0, pd - Math.round(pd * 0.48) - Math.round(pd * 0.29) - Math.round(pd * 0.15))
    };
    d.schoolKey = key;
    return d;
  }

  function sumSeries(seriesList) {
    const n = Math.max(0, ...seriesList.map(s => s?.length || 0));
    return Array.from({ length: n }, (_, i) => seriesList.reduce((sum, arr) => {
      if (!arr?.length) return sum;
      return sum + (arr[i] ?? arr[arr.length - 1] ?? 0);
    }, 0));
  }

  function aggregateRecords(records) {
    const valid = records.filter(Boolean);
    const numeric = ['fte', 'capacity', 'netAdds', 'leads', 'tours', 'toursCompleted', 'enrollments', 'charges', 'payments', 'discounts', 'subsidies', 'pastDue', 'studentHours', 'staffHours', 'scheduledStaffHours', 'grossPayroll', 'openSeats', 'scheduledStarts', 'knownDepartures', 'netScheduledAdds', 'forecast30Fte', 'forecast60Fte', 'forecast90Fte', 'netBilled'];
    const out = {};
    numeric.forEach(k => out[k] = valid.reduce((s, d) => s + (Number(d[k]) || 0), 0));
    out.enrollmentSeries = sumSeries(valid.map(d => d.enrollmentSeries));
    out.forecastSeries = sumSeries(valid.map(d => d.forecastSeries));
    out.collectionsSeries = sumSeries(valid.map(d => d.collectionsSeries));
    out.leadSources = {};
    valid.forEach(d => Object.entries(d.leadSources || {}).forEach(([k, v]) => out.leadSources[k] = (out.leadSources[k] || 0) + v));
    out.classrooms = valid.flatMap(d => (d.classrooms || []).map(c => ({ ...c, school: schoolCfg(d.schoolKey)?.shortName || d.schoolKey, schoolKey: d.schoolKey })));
    out.aging = { current: 0, d1_30: 0, d31_60: 0, d60plus: 0 };
    valid.forEach(d => Object.keys(out.aging).forEach(k => out.aging[k] += d.aging?.[k] || 0));
    return out;
  }

  function schoolData(key, period = state.period) { return hydrate(period, key, rawSchoolData(period, key)); }
  function aggregate(period = state.period) { return aggregateRecords(schoolKeys().map(key => schoolData(key, period))); }
  function currentData() { return state.scope === 'total' ? aggregate() : schoolData(state.scope); }
  function activeSchoolKeys() { return state.scope === 'total' ? schoolKeys() : [state.scope]; }

  function metrics(d) {
    return {
      occupancy: safeDiv(d.fte, d.capacity),
      forecast30: safeDiv(d.forecast30Fte, d.capacity),
      forecast60: safeDiv(d.forecast60Fte, d.capacity),
      forecast90: safeDiv(d.forecast90Fte, d.capacity),
      conversion: safeDiv(d.enrollments, d.leads),
      tourBooking: safeDiv(d.tours, d.leads),
      tourCompletion: safeDiv(d.toursCompleted, d.tours),
      tourToEnroll: safeDiv(d.enrollments, d.toursCompleted),
      collection: safeDiv(d.payments, d.netBilled),
      leverage: safeDiv(d.studentHours, d.staffHours),
      payrollPct: safeDiv(d.grossPayroll, d.netBilled),
      payrollPerFte: safeDiv(d.grossPayroll, d.fte),
      payrollPerStaffHour: safeDiv(d.grossPayroll, d.staffHours),
      netBilledPerFte: safeDiv(d.netBilled, d.fte),
      pastDuePct: safeDiv(d.pastDue, d.netBilled),
      discountPct: safeDiv(d.discounts, d.charges),
      subsidyPct: safeDiv(d.subsidies, d.netBilled),
      scheduleVariance: safeDiv((d.staffHours || 0) - (d.scheduledStaffHours || 0), d.scheduledStaffHours || 0),
      staffHoursPerFte: safeDiv(d.staffHours, d.fte),
      futureStartCoverage: safeDiv(d.scheduledStarts, d.openSeats)
    };
  }

  function targets(scope = state.scope) {
    if (scope === 'total') return cfg.targets;
    return { ...cfg.targets, ...(schoolCfg(scope)?.targets || {}) };
  }

  function scopeName(scope = state.scope) { return scope === 'total' ? 'Little Wonders' : (schoolCfg(scope)?.name || scope); }

  function previousData() {
    if (state.period !== '4w' || !demo.periods?.['8w']) return null;
    const priorForSchool = key => {
      const eight = schoolData(key, '8w');
      const cur = schoolData(key, '4w');
      if (!eight || !cur) return null;
      const prior = { ...cur };
      ['netAdds', 'leads', 'tours', 'toursCompleted', 'enrollments', 'charges', 'payments', 'discounts', 'subsidies', 'studentHours', 'staffHours', 'scheduledStaffHours', 'grossPayroll'].forEach(k => prior[k] = Math.max(0, (eight[k] || 0) - (cur[k] || 0)));
      prior.fte = cur.enrollmentSeries?.[0] ?? cur.fte;
      prior.capacity = cur.capacity;
      prior.netBilled = Math.max(0, prior.charges - prior.discounts);
      prior.pastDue = cur.pastDue;
      return prior;
    };
    return state.scope === 'total' ? aggregateRecords(schoolKeys().map(priorForSchool)) : priorForSchool(state.scope);
  }

  function compareText(kind, current, targetValue, formatter, inverse = false) {
    if (state.compare === 'target') {
      const delta = current - targetValue;
      const good = inverse ? delta <= 0 : delta >= 0;
      return { text: `${delta > 0 ? '+' : ''}${formatter(delta)} vs target`, cls: good ? 'delta-up' : 'delta-down' };
    }
    const prior = previousData();
    if (prior) {
      const pm = metrics(prior);
      const priorValue = kind === 'fte' ? prior.fte : kind === 'occupancy' ? pm.occupancy : kind === 'netAdds' ? prior.netAdds : kind === 'conversion' ? pm.conversion : kind === 'collection' ? pm.collection : null;
      if (priorValue !== null && Number.isFinite(priorValue)) {
        const delta = current - priorValue;
        const good = inverse ? delta <= 0 : delta >= 0;
        return { text: `${delta > 0 ? '+' : ''}${formatter(delta)} vs prior 4W`, cls: good ? 'delta-up' : delta === 0 ? 'delta-neutral' : 'delta-down' };
      }
    }
    if (kind === 'fte' || kind === 'occupancy') {
      const d = currentData();
      const startFte = d.enrollmentSeries?.[0] ?? d.fte;
      const start = kind === 'fte' ? startFte : safeDiv(startFte, d.capacity);
      const delta = current - start;
      return { text: `${delta > 0 ? '+' : ''}${formatter(delta)} vs period start`, cls: delta >= 0 ? 'delta-up' : 'delta-down' };
    }
    const delta = current - targetValue;
    const good = inverse ? delta <= 0 : delta >= 0;
    return { text: `${delta > 0 ? '+' : ''}${formatter(delta)} vs target`, cls: good ? 'delta-up' : 'delta-down' };
  }

  function renderSummary() {
    const d = currentData(), m = metrics(d), t = targets();
    const cards = [
      ['FTE Enrollment', fmtNum(d.fte), compareText('fte', d.fte, d.fte, v => fmtNum(v)), 'Student FTE'],
      ['Occupancy', fmtPct(m.occupancy), compareText('occupancy', m.occupancy, t.occupancy, v => `${(v * 100).toFixed(1)} pts`), 'FTE ÷ effective capacity'],
      ['30D Forecast', fmtPct(m.forecast30), { text: `${m.forecast30 - t.forecastOccupancy30 >= 0 ? '+' : ''}${((m.forecast30 - t.forecastOccupancy30) * 100).toFixed(1)} pts vs target`, cls: m.forecast30 >= t.forecastOccupancy30 ? 'delta-up' : 'delta-down' }, `${fmtNum(d.forecast30Fte)} projected FTE`],
      ['Net Adds', `${d.netAdds >= 0 ? '+' : ''}${d.netAdds}`, compareText('netAdds', d.netAdds, 0, v => fmtNum(v)), demo.periods[state.period].label],
      ['Lead → Enrollment', fmtPct(m.conversion), compareText('conversion', m.conversion, t.leadToEnrollment, v => `${(v * 100).toFixed(1)} pts`), `${d.enrollments} enrollments / ${d.leads} leads`],
      ['Collection Rate', fmtPct(m.collection), compareText('collection', m.collection, t.collectionRate, v => `${(v * 100).toFixed(1)} pts`), 'Payments ÷ net tuition billed']
    ];
    $('#summaryCards').innerHTML = cards.map(c => `<div class="summary-card"><div class="summary-label">${c[0]}</div><div class="summary-value-row"><div class="summary-value">${c[1]}</div></div><div class="summary-delta ${c[2].cls}">${c[2].text}</div><div class="summary-sub">${c[3]}</div></div>`).join('');
  }

  function ensureForwardBook() {
    if ($('#forwardBook')) return;
    const section = document.createElement('section');
    section.id = 'forwardBook';
    section.className = 'panel forward-book';
    const hero = $('.hero-grid');
    if (hero) hero.before(section);
  }

  function forwardCell(label, value, detail, highlight = false) { return `<div class="forward-cell ${highlight ? 'highlight' : ''}"><span>${label}</span><strong>${value}</strong><small>${detail}</small></div>`; }
  function forecastPoint(label, value) { return `<div><span>${label}</span><strong>${fmtPct(value)}</strong><i><b style="width:${clamp(value * 100, 0, 100)}%"></b></i></div>`; }

  function renderForwardBook() {
    const d = currentData(), m = metrics(d);
    $('#forwardBook').innerHTML = `<div class="forward-head"><div><div class="panel-kicker">FORWARD BOOK</div><h2>Booked enrollment is building toward ${Math.round(targets().forecastOccupancy30 * 100)}%+ occupancy</h2></div><span class="panel-note">Playground roster, future-start and departure data</span></div><div class="forward-grid">${forwardCell('Open seats', fmtNum(d.openSeats), 'Current FTE capacity gap')}${forwardCell('Scheduled starts', `+${fmtNum(d.scheduledStarts)}`, 'Future enrollment records')}${forwardCell('Known departures', `−${fmtNum(d.knownDepartures)}`, 'Known end dates / withdrawals')}${forwardCell('Net scheduled adds', `${d.netScheduledAdds >= 0 ? '+' : ''}${fmtNum(d.netScheduledAdds)}`, 'Starts less departures', true)}<div class="forward-forecast"><span>Projected occupancy</span><div class="forecast-points">${forecastPoint('30D', m.forecast30)}${forecastPoint('60D', m.forecast60)}${forecastPoint('90D', m.forecast90)}</div></div></div>`;
  }

  function performanceRows() {
    return [
      ['FTE Enrollment', x => fmtNum(x.fte)], ['Occupancy', x => fmtPct(metrics(x).occupancy)], ['30D Forecast', x => fmtPct(metrics(x).forecast30)], ['Net Adds', x => `${x.netAdds >= 0 ? '+' : ''}${fmtNum(x.netAdds)}`], ['Leads', x => fmtNum(x.leads)], ['Lead → Enrollment', x => fmtPct(metrics(x).conversion)], ['Net Billed / FTE', x => fmtMoney(metrics(x).netBilledPerFte)], ['Collection Rate', x => fmtPct(metrics(x).collection)], ['Gross Payroll / Net Billed', x => fmtPct(metrics(x).payrollPct)], ['Student Hrs / Staff Hr', x => `${metrics(x).leverage.toFixed(1)}x`]
    ];
  }

  function performanceTableHtml() {
    const keys = schoolKeys();
    const records = Object.fromEntries(keys.map(k => [k, schoolData(k)]));
    const total = aggregate();
    const rows = performanceRows();
    const heads = keys.map(k => `<th class="school-head" data-scope-jump="${k}">${schoolCfg(k).shortName}</th>`).join('');
    const cells = r => keys.map(k => `<td>${r[1](records[k])}</td>`).join('');
    return `<thead><tr><th>Metric</th>${heads}<th class="total-head" data-scope-jump="total">Total</th></tr></thead><tbody>${rows.map((r, idx) => `<tr><td class="${idx < 3 ? 'metric-strong' : ''}">${r[0]}</td>${cells(r)}<td class="total-cell">${r[1](total)}</td></tr>`).join('')}</tbody>`;
  }

  function bindScopeJumps(root = document) { $$('[data-scope-jump]', root).forEach(el => el.addEventListener('click', () => setScope(el.dataset.scopeJump))); }
  function renderPerformance() { $('#schoolPerformanceTable').innerHTML = performanceTableHtml(); bindScopeJumps($('#schoolPerformanceTable')); }

  function svgEl(tag, attrs = {}) { const el = document.createElementNS('http://www.w3.org/2000/svg', tag); Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v)); return el; }
  function makePath(points) { return points.map((p, i) => `${i ? 'L' : 'M'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' '); }

  function drawEnrollmentChart(svg, d, labels = true) {
    if (!svg || !d) return;
    svg.innerHTML = '';
    const W = 760, H = 250, pad = { l: 38, r: 54, t: 15, b: 30 };
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const actual = d.enrollmentSeries || [d.fte];
    const forecast = [actual[actual.length - 1], ...(d.forecastSeries || [d.forecast30Fte]).slice(1)];
    const all = [...actual, ...forecast, d.capacity];
    const min = Math.floor((Math.min(...all) - 6) / 5) * 5;
    const max = Math.ceil((Math.max(...all) + 4) / 5) * 5;
    const totalPoints = Math.max(2, actual.length + forecast.length - 1);
    const x = i => pad.l + (i / (totalPoints - 1)) * (W - pad.l - pad.r);
    const y = v => pad.t + ((max - v) / (max - min || 1)) * (H - pad.t - pad.b);
    const defs = svgEl('defs');
    const grad = svgEl('linearGradient', { id: `${svg.id || 'chart'}Fade`, x1: '0', x2: '0', y1: '0', y2: '1' });
    grad.append(svgEl('stop', { offset: '0%', 'stop-color': '#769587', 'stop-opacity': '.18' }), svgEl('stop', { offset: '100%', 'stop-color': '#769587', 'stop-opacity': '0' })); defs.append(grad); svg.append(defs);
    for (let i = 0; i < 4; i++) { const v = min + (max - min) * (i / 3), yy = y(v); svg.append(svgEl('line', { x1: pad.l, y1: yy, x2: W - pad.r, y2: yy, class: 'chart-grid-line' })); const txt = svgEl('text', { x: pad.l - 8, y: yy + 3, 'text-anchor': 'end', class: 'chart-axis-text' }); txt.textContent = Math.round(v); svg.append(txt); }
    const capY = y(d.capacity); svg.append(svgEl('line', { x1: pad.l, y1: capY, x2: W - pad.r, y2: capY, class: 'chart-capacity-line' })); const capText = svgEl('text', { x: W - pad.r + 7, y: capY + 3, class: 'chart-axis-text' }); capText.textContent = `${d.capacity} cap`; svg.append(capText);
    const ap = actual.map((v, i) => [x(i), y(v)]), fp = forecast.map((v, i) => [x(actual.length - 1 + i), y(v)]);
    const area = svgEl('path', { d: `${makePath(ap)} L ${ap[ap.length - 1][0]} ${H - pad.b} L ${ap[0][0]} ${H - pad.b} Z`, class: 'chart-area' }); area.setAttribute('fill', `url(#${svg.id || 'chart'}Fade)`); svg.append(area);
    svg.append(svgEl('path', { d: makePath(ap), class: 'chart-actual-line' })); svg.append(svgEl('path', { d: makePath(fp), class: 'chart-forecast-line' }));
    const nowX = x(actual.length - 1); svg.append(svgEl('line', { x1: nowX, y1: pad.t, x2: nowX, y2: H - pad.b, class: 'chart-now' })); svg.append(svgEl('circle', { cx: nowX, cy: y(actual[actual.length - 1]), r: 4.2, class: 'chart-dot' }));
    const lbl = svgEl('text', { x: nowX, y: y(actual[actual.length - 1]) - 11, 'text-anchor': 'middle', class: 'chart-label-text' }); lbl.textContent = `${fmtNum(actual[actual.length - 1])} FTE`; svg.append(lbl);
    if (labels) [[0, demo.periods[state.period].label, 'start'], [actual.length - 1, 'Today', 'middle'], [totalPoints - 1, '+ 4 wks', 'end']].forEach(([idx, label, anchor]) => { const t = svgEl('text', { x: x(idx), y: H - 8, 'text-anchor': anchor, class: 'chart-axis-text' }); t.textContent = label; svg.append(t); });
  }

  function renderEnrollmentChart() {
    const d = currentData(), m = metrics(d);
    drawEnrollmentChart($('#enrollmentChart'), d);
    $('#enrollmentTitle').textContent = m.forecast30 >= targets().forecastOccupancy30 ? 'Booked enrollment supports target occupancy' : 'Enrollment is building toward the 30-day target';
    $('#enrollmentFootnote').textContent = 'FTE enrollment; forecast uses future starts, known departures and Playground enrollment/capacity records.';
  }

  function funnelHtml(d) {
    const steps = [['Leads', d.leads], ['Tours booked', d.tours], ['Tours completed', d.toursCompleted], ['Enrolled', d.enrollments]];
    const max = d.leads || 1;
    return steps.map((s, i) => { const prev = i ? steps[i - 1][1] : null; const conv = prev ? `${Math.round(s[1] / prev * 100)}% from prior step` : ''; return `<div class="funnel-row"><div class="funnel-label">${s[0]}</div><div class="funnel-track"><div class="funnel-fill" style="width:${Math.max(6, s[1] / max * 100)}%"></div></div><div class="funnel-value">${s[1]}</div>${conv ? `<div class="funnel-conversion">${conv}</div>` : ''}</div>`; }).join('');
  }

  function renderAdmissions() {
    const d = currentData(), m = metrics(d);
    $('#funnel').innerHTML = funnelHtml(d);
    $('#admissionsChip').textContent = `${fmtPct(m.conversion)} lead → enrollment`;
    const totalSources = Object.values(d.leadSources || {}).reduce((x, y) => x + y, 0) || 1;
    $('#leadSources').innerHTML = Object.entries(d.leadSources || {}).map(([k, v]) => `<div class="source-mini"><strong>${Math.round(v / totalSources * 100)}%</strong><span>${k}</span></div>`).join('');
    let strip = $('.pipeline-strip', $('.admissions-panel')); if (!strip) { strip = document.createElement('div'); strip.className = 'pipeline-strip'; $('.admissions-panel').append(strip); }
    strip.innerHTML = `<div><span>Open seats</span><strong>${fmtNum(d.openSeats)}</strong></div><div><span>Future starts</span><strong>${fmtNum(d.scheduledStarts)}</strong></div><div><span>Known exits</span><strong>${fmtNum(d.knownDepartures)}</strong></div><div><span>Start coverage</span><strong>${fmtPct(m.futureStartCoverage, 0)}</strong></div>`;
  }

  function agingHtml(d) {
    const total = Object.values(d.aging || {}).reduce((s, v) => s + v, 0) || 1;
    const parts = [['Current', d.aging.current], ['1–30', d.aging.d1_30], ['31–60', d.aging.d31_60], ['60+', d.aging.d60plus]];
    return `<div class="aging-head"><span>Past-due aging</span><strong>${fmtMoney(d.pastDue)}</strong></div><div class="aging-bar">${parts.map((p, i) => `<i class="age-${i}" style="width:${p[1] / total * 100}%"></i>`).join('')}</div><div class="aging-labels">${parts.map(p => `<span><b>${p[0]}</b>${fmtMoney(p[1])}</span>`).join('')}</div>`;
  }

  function renderBilling() {
    const d = currentData(), m = metrics(d);
    const vals = [['Net tuition billed', fmtMoneyK(d.netBilled)], ['Net billed / FTE', fmtMoney(m.netBilledPerFte)], ['Payments collected', fmtMoneyK(d.payments)], ['Collection rate', fmtPct(m.collection)], ['Discounts', fmtPct(m.discountPct, 1)], ['Past due', `${fmtMoneyK(d.pastDue)} · ${fmtPct(m.pastDuePct, 1)}`]];
    $('#billingStats').innerHTML = vals.map(v => `<div class="billing-stat"><span>${v[0]}</span><strong>${v[1]}</strong></div>`).join('');
    $('#collectionChip').textContent = `${fmtPct(m.collection)} collected`; $('#collectionChip').className = `metric-chip ${m.collection >= targets().collectionRate ? 'good' : ''}`;
    $('#weeklyCollectionsTotal').textContent = fmtMoney((d.collectionsSeries || []).reduce((x, y) => x + y, 0)); renderSpark($('#collectionsChart'), d.collectionsSeries || [d.payments]);
    let aging = $('.billing-aging', $('.billing-panel')); if (!aging) { aging = document.createElement('div'); aging.className = 'billing-aging'; $('.billing-panel').append(aging); } aging.innerHTML = agingHtml(d);
  }

  function renderSpark(svg, vals) {
    if (!svg || !vals?.length) return;
    svg.innerHTML = ''; const W = 280, H = 80, p = 5; svg.setAttribute('viewBox', `0 0 ${W} ${H}`); const min = Math.min(...vals) * .96, max = Math.max(...vals) * 1.02; const x = i => p + i / Math.max(1, vals.length - 1) * (W - p * 2), y = v => p + (max - v) / (max - min || 1) * (H - p * 2); const pts = vals.map((v, i) => [x(i), y(v)]); svg.append(svgEl('path', { d: `${makePath(pts)} L ${pts[pts.length - 1][0]} ${H - p} L ${pts[0][0]} ${H - p} Z`, class: 'spark-area' })); svg.append(svgEl('path', { d: makePath(pts), class: 'spark-line' }));
  }

  function laborCards(d) {
    const m = metrics(d), t = targets();
    return [['Gross payroll', fmtMoneyK(d.grossPayroll), 'Playground payroll runs'], ['Gross payroll / FTE', fmtMoney(m.payrollPerFte), 'Gross pay ÷ FTE'], ['Payroll / net billed', fmtPct(m.payrollPct), `Target ≤ ${fmtPct(t.grossPayrollPctNetBilled)}`], ['Staff hours worked', fmtNum(d.staffHours), `${fmtNum(d.scheduledStaffHours)} scheduled`], ['Schedule variance', `${m.scheduleVariance >= 0 ? '+' : ''}${fmtPct(m.scheduleVariance, 1)}`, 'Worked vs scheduled'], ['Student hrs / staff hr', `${m.leverage.toFixed(1)}x`, `Target ≥ ${t.staffLeverage.toFixed(1)}x`]];
  }

  function renderLabor() {
    const d = currentData(), m = metrics(d);
    $('#laborChip').textContent = `${fmtPct(m.payrollPct)} gross payroll / net billed`;
    $('#laborBars').innerHTML = `<div class="ops-metric-grid">${laborCards(d).map(c => `<div><span>${c[0]}</span><strong>${c[1]}</strong><small>${c[2]}</small></div>`).join('')}</div>`;
  }

  function generateAttention() {
    const levelRank = { risk: 3, watch: 2, good: 1 }, items = [];
    activeSchoolKeys().forEach(key => {
      const d = schoolData(key), m = metrics(d), t = targets(key), school = schoolCfg(key).shortName;
      const add = (level, title, detail, score) => items.push({ level, title: state.scope === 'total' ? `${school}: ${title}` : title, detail, score });
      if (m.occupancy < t.occupancy) add(m.occupancy < t.occupancy - .04 ? 'risk' : 'watch', 'occupancy below target', `${fmtPct(m.occupancy)} current vs ${fmtPct(t.occupancy)} target.`, 90 + (t.occupancy - m.occupancy) * 100);
      if (m.forecast30 < t.forecastOccupancy30) add('watch', '30-day occupancy forecast below target', `${fmtPct(m.forecast30)} projected vs ${fmtPct(t.forecastOccupancy30)} target.`, 82);
      (d.classrooms || []).forEach(c => { const occ = safeDiv(c.fte, c.capacity); if (occ >= .97) add('risk', `${c.name} is effectively full`, `${fmtPct(occ, 0)} FTE occupancy with ${c.futureStarts || 0} scheduled start(s).`, 96); else if (occ >= .93) add('watch', `${c.name} nearing capacity`, `${fmtPct(occ, 0)} FTE occupancy.`, 74); });
      if (m.conversion < t.leadToEnrollment) add('watch', 'lead conversion below target', `${fmtPct(m.conversion)} vs ${fmtPct(t.leadToEnrollment)} target.`, 70);
      if (m.collection < t.collectionRate) add(m.collection < .94 ? 'risk' : 'watch', 'collection rate below target', `${fmtPct(m.collection)} vs ${fmtPct(t.collectionRate)} target.`, 88);
      if (m.pastDuePct > t.pastDuePctNetBilled) add('watch', 'past-due balance elevated', `${fmtPct(m.pastDuePct)} of net tuition billed is past due.`, 78);
      if (m.payrollPct > t.grossPayrollPctNetBilled) add('watch', 'gross payroll running above target', `${fmtPct(m.payrollPct)} of net tuition billed vs ≤${fmtPct(t.grossPayrollPctNetBilled)} target.`, 84);
      if (m.leverage < t.staffLeverage) add('watch', 'staff leverage below target', `${m.leverage.toFixed(1)}x student hours per staff hour vs ${t.staffLeverage.toFixed(1)}x target.`, 68);
      if (m.forecast30 >= t.forecastOccupancy30 && m.collection >= t.collectionRate) add('good', 'forward occupancy and collections are on plan', `${fmtPct(m.forecast30)} 30-day forecast and ${fmtPct(m.collection)} collections.`, 38);
    });
    return items.sort((a, b) => (levelRank[b.level] - levelRank[a.level]) || (b.score - a.score)).slice(0, 5);
  }

  function renderAttention() { const items = generateAttention(); $('#attentionCount').textContent = `${items.length} item${items.length === 1 ? '' : 's'}`; $('#attentionList').innerHTML = items.length ? items.map(x => `<div class="attention-item"><div class="attention-icon ${x.level}">${x.level === 'good' ? '✓' : '!'}</div><div class="attention-copy"><strong>${x.title}</strong><span>${x.detail}</span></div><span class="attention-action">Review →</span></div>`).join('') : `<div class="empty-attention">No material exceptions in the selected period.</div>`; }

  function classroomRows(d = currentData()) {
    return (d.classrooms || []).slice().sort((a, b) => safeDiv(b.fte, b.capacity) - safeDiv(a.fte, a.capacity));
  }

  function renderClassrooms() {
    const list = classroomRows().slice(0, 8);
    $('#classroomTitle').textContent = state.scope === 'total' ? 'Highest-utilization classrooms' : 'Capacity by classroom'; $('#classroomScope').textContent = scopeName();
    $('#classroomList').innerHTML = list.map(c => { const occ = safeDiv(c.fte, c.capacity); return `<div class="classroom-card"><div class="classroom-top"><strong>${state.scope === 'total' ? `${c.school} · ` : ''}${c.name}</strong><span>${fmtPct(occ, 0)}</span></div><div class="classroom-bar"><i style="width:${clamp(occ * 100, 0, 100)}%"></i></div><div class="classroom-bottom"><span>${fmtNum(c.fte)} / ${fmtNum(c.capacity)} FTE</span><span>${c.futureStarts || 0} start${c.futureStarts === 1 ? '' : 's'}</span></div></div>`; }).join('');
  }

  function moduleKpis(cards) { return `<section class="module-kpis">${cards.map(c => `<div class="module-kpi"><span>${c[0]}</span><strong>${c[1]}</strong><small>${c[2]}</small></div>`).join('')}</section>`; }
  function panel(title, kicker, body, className = '') { return `<article class="panel module-panel ${className}"><div class="panel-header compact"><div><div class="panel-kicker">${kicker}</div><h2>${title}</h2></div><span class="source-badge">Playground</span></div>${body}</article>`; }
  function dataTable(headers, rows, opts = {}) { return `<div class="table-wrap"><table class="detail-table"><thead><tr>${headers.map((h, i) => `<th class="${i === 0 ? 'left' : ''}">${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((v, i) => `<td class="${i === 0 ? 'left' : ''}">${v}</td>`).join('')}</tr>`).join('')}</tbody>${opts.footer || ''}</table></div>`; }

  function renderEnrollmentModule() {
    const d = currentData(), m = metrics(d);
    const classroomData = classroomRows(d).map(c => { const occ = safeDiv(c.fte, c.capacity), projected = Math.min(c.capacity, c.fte + (c.futureStarts || 0)); return [state.scope === 'total' ? `${c.school} · ${c.name}` : c.name, fmtNum(c.fte), fmtNum(c.capacity), fmtPct(occ), fmtNum(Math.max(0, c.capacity - c.fte)), `+${c.futureStarts || 0}`, fmtNum(projected)]; });
    $('#moduleView').innerHTML = `${moduleKpis([['FTE enrollment', fmtNum(d.fte), `${fmtNum(d.capacity)} effective capacity`], ['Occupancy', fmtPct(m.occupancy), `${fmtNum(d.openSeats)} open FTE seats`], ['Scheduled starts', `+${fmtNum(d.scheduledStarts)}`, `${fmtNum(d.knownDepartures)} known departures`], ['Net scheduled adds', `${d.netScheduledAdds >= 0 ? '+' : ''}${fmtNum(d.netScheduledAdds)}`, 'Starts less departures'], ['30D forecast', fmtPct(m.forecast30), `${fmtNum(d.forecast30Fte)} projected FTE`], ['90D forecast', fmtPct(m.forecast90), `${fmtNum(d.forecast90Fte)} projected FTE`]])}<section class="module-grid two"><article class="panel module-panel span-wide"><div class="panel-header compact"><div><div class="panel-kicker">ENROLLMENT TRAJECTORY</div><h2>Actual enrollment, booked forecast and capacity</h2></div><span class="source-badge">Playground enrollment</span></div><div class="module-chart"><svg id="moduleEnrollmentChart" class="line-chart"></svg></div></article>${panel('Forward book', 'SEATS & STARTS', `<div class="module-forward-list"><div><span>Open seats</span><strong>${fmtNum(d.openSeats)}</strong></div><div><span>Scheduled starts</span><strong>+${fmtNum(d.scheduledStarts)}</strong></div><div><span>Known departures</span><strong>−${fmtNum(d.knownDepartures)}</strong></div><div class="accent"><span>Net scheduled adds</span><strong>${d.netScheduledAdds >= 0 ? '+' : ''}${fmtNum(d.netScheduledAdds)}</strong></div></div><div class="forecast-ladder">${forecastPoint('30D', m.forecast30)}${forecastPoint('60D', m.forecast60)}${forecastPoint('90D', m.forecast90)}</div>`)}</section>${panel('Classroom capacity & booked starts', 'CLASSROOMS', dataTable(['Classroom', 'FTE', 'Capacity', 'Occupancy', 'Open seats', 'Starts', 'Projected FTE'], classroomData), 'full')}`;
    drawEnrollmentChart($('#moduleEnrollmentChart'), d);
  }

  function renderAdmissionsModule() {
    const d = currentData(), m = metrics(d);
    const sources = Object.entries(d.leadSources || {}).sort((a, b) => b[1] - a[1]); const max = Math.max(1, ...sources.map(x => x[1]));
    const schoolRows = activeSchoolKeys().map(k => { const x = schoolData(k), mm = metrics(x); return [schoolCfg(k).shortName, fmtNum(x.leads), fmtPct(mm.tourBooking), fmtPct(mm.tourCompletion), fmtNum(x.enrollments), fmtPct(mm.conversion), `+${fmtNum(x.scheduledStarts)}`, fmtNum(x.openSeats), fmtPct(mm.futureStartCoverage, 0)]; });
    $('#moduleView').innerHTML = `${moduleKpis([['Leads', fmtNum(d.leads), demo.periods[state.period].label], ['Tours booked', fmtNum(d.tours), `${fmtPct(m.tourBooking)} of leads`], ['Tours completed', fmtNum(d.toursCompleted), `${fmtPct(m.tourCompletion)} show rate`], ['Enrollments', fmtNum(d.enrollments), `${fmtPct(m.tourToEnroll)} of completed tours`], ['Lead → enrollment', fmtPct(m.conversion), `Target ≥ ${fmtPct(targets().leadToEnrollment)}`], ['Future-start coverage', fmtPct(m.futureStartCoverage, 0), `${fmtNum(d.scheduledStarts)} starts / ${fmtNum(d.openSeats)} open seats`]])}<section class="module-grid two">${panel('Enrollment funnel', 'CRM PIPELINE', `<div class="detail-funnel">${funnelHtml(d)}</div>`, 'span-wide')}${panel('Lead sources', 'ATTRIBUTION', `<div class="source-bars">${sources.map(([name, val]) => `<div><span>${name}</span><i><b style="width:${val / max * 100}%"></b></i><strong>${val}</strong></div>`).join('')}</div>`)}</section>${panel('Admissions performance by school', 'SCHOOL COMPARISON', dataTable(['School', 'Leads', 'Tour booking', 'Show rate', 'Enrollments', 'Lead → enroll', 'Future starts', 'Open seats', 'Start coverage'], schoolRows), 'full')}`;
  }

  function renderLaborModule() {
    const d = currentData(), m = metrics(d), t = targets();
    const rows = activeSchoolKeys().map(k => { const x = schoolData(k), mm = metrics(x); return [schoolCfg(k).shortName, fmtMoney(x.grossPayroll), fmtMoney(mm.payrollPerFte), fmtPct(mm.payrollPct), fmtNum(x.staffHours), fmtNum(x.scheduledStaffHours), `${mm.scheduleVariance >= 0 ? '+' : ''}${fmtPct(mm.scheduleVariance, 1)}`, `${mm.leverage.toFixed(1)}x`, fmtMoney(mm.payrollPerStaffHour)]; });
    const scheduleRows = activeSchoolKeys().map(k => { const x = schoolData(k), mm = metrics(x); const pct = safeDiv(x.staffHours, x.scheduledStaffHours); return `<div class="schedule-row"><div><strong>${schoolCfg(k).shortName}</strong><span>${fmtNum(x.staffHours)} worked / ${fmtNum(x.scheduledStaffHours)} scheduled</span></div><i><b style="width:${clamp(pct * 100, 0, 110)}%"></b></i><strong>${fmtPct(pct, 0)}</strong></div>`; }).join('');
    $('#moduleView').innerHTML = `${moduleKpis([['Gross payroll', fmtMoneyK(d.grossPayroll), demo.periods[state.period].label], ['Payroll / FTE', fmtMoney(m.payrollPerFte), 'Gross payroll ÷ FTE'], ['Payroll / net billed', fmtPct(m.payrollPct), `Target ≤ ${fmtPct(t.grossPayrollPctNetBilled)}`], ['Staff hours worked', fmtNum(d.staffHours), `${fmtNum(d.scheduledStaffHours)} scheduled`], ['Schedule variance', `${m.scheduleVariance >= 0 ? '+' : ''}${fmtPct(m.scheduleVariance, 1)}`, 'Worked vs scheduled'], ['Student hrs / staff hr', `${m.leverage.toFixed(1)}x`, `Target ≥ ${t.staffLeverage.toFixed(1)}x`]])}<section class="module-grid two">${panel('Worked hours vs schedule', 'STAFFING EXECUTION', `<div class="schedule-list">${scheduleRows}</div>`, 'span-wide')}${panel('Labor productivity', 'OPERATING EFFICIENCY', `<div class="large-stat"><span>Student hours / staff hour</span><strong>${m.leverage.toFixed(1)}x</strong><small>${fmtNum(d.studentHours)} student attendance hours ÷ ${fmtNum(d.staffHours)} staff hours</small></div><div class="mini-pair"><div><span>Staff hrs / FTE</span><strong>${fmtNum(m.staffHoursPerFte, 1)}</strong></div><div><span>Gross pay / staff hr</span><strong>${fmtMoney(m.payrollPerStaffHour)}</strong></div></div>`)}</section>${panel('Payroll & staffing economics by school', 'SCHOOL COMPARISON', dataTable(['School', 'Gross payroll', 'Payroll / FTE', 'Payroll / net billed', 'Worked hrs', 'Scheduled hrs', 'Variance', 'Student hrs / staff hr', 'Gross pay / staff hr'], rows), 'full')}`;
  }

  function renderBillingModule() {
    const d = currentData(), m = metrics(d);
    const rows = activeSchoolKeys().map(k => { const x = schoolData(k), mm = metrics(x); return [schoolCfg(k).shortName, fmtMoney(x.charges), fmtPct(mm.discountPct), fmtMoney(x.netBilled), fmtMoney(mm.netBilledPerFte), fmtMoney(x.payments), fmtPct(mm.collection), `${fmtMoney(x.pastDue)} · ${fmtPct(mm.pastDuePct, 1)}`, fmtPct(mm.subsidyPct, 1)]; });
    $('#moduleView').innerHTML = `${moduleKpis([['Gross charges', fmtMoneyK(d.charges), demo.periods[state.period].label], ['Discounts', fmtMoneyK(d.discounts), `${fmtPct(m.discountPct, 1)} of gross charges`], ['Net tuition billed', fmtMoneyK(d.netBilled), `${fmtMoney(m.netBilledPerFte)} / FTE`], ['Payments collected', fmtMoneyK(d.payments), `${fmtPct(m.collection)} collection rate`], ['Past due', fmtMoneyK(d.pastDue), `${fmtPct(m.pastDuePct, 1)} of net billed`], ['Subsidy', fmtMoneyK(d.subsidies), `${fmtPct(m.subsidyPct, 1)} of net billed`]])}<section class="module-grid two">${panel('Collections trend', 'PAYMENTS', `<div class="module-spark"><div class="large-stat"><span>Period collections</span><strong>${fmtMoney((d.collectionsSeries || []).reduce((s, v) => s + v, 0))}</strong><small>Payments recorded in Playground</small></div><svg id="moduleCollectionsChart" class="spark-chart"></svg></div>`, 'span-wide')}${panel('Receivables aging', 'PAST DUE', `<div class="billing-aging module-aging">${agingHtml(d)}</div>`)}</section>${panel('Billing performance by school', 'SCHOOL COMPARISON', dataTable(['School', 'Gross charges', 'Discount %', 'Net billed', 'Net billed / FTE', 'Payments', 'Collection rate', 'Past due', 'Subsidy %'], rows), 'full')}`;
    renderSpark($('#moduleCollectionsChart'), d.collectionsSeries || [d.payments]);
  }

  function schoolCard(key) {
    const d = schoolData(key), m = metrics(d), selected = state.scope === key;
    return `<button class="school-card ${selected ? 'selected' : ''}" data-school-open="${key}"><div class="school-card-head"><div><span>SCHOOL</span><strong>${schoolCfg(key).name}</strong></div><i>${selected ? 'Selected' : 'Open →'}</i></div><div class="school-card-main"><strong>${fmtPct(m.occupancy)}</strong><span>occupancy · ${fmtNum(d.fte)} / ${fmtNum(d.capacity)} FTE</span></div><div class="school-card-metrics"><div><span>30D forecast</span><strong>${fmtPct(m.forecast30)}</strong></div><div><span>Net adds</span><strong>${d.netAdds >= 0 ? '+' : ''}${d.netAdds}</strong></div><div><span>Lead → enroll</span><strong>${fmtPct(m.conversion)}</strong></div><div><span>Collections</span><strong>${fmtPct(m.collection)}</strong></div><div><span>Payroll / billed</span><strong>${fmtPct(m.payrollPct)}</strong></div><div><span>Open seats</span><strong>${fmtNum(d.openSeats)}</strong></div></div></button>`;
  }

  function renderSchoolsModule() {
    const selected = currentData();
    const detailRows = classroomRows(selected).map(c => [state.scope === 'total' ? `${c.school} · ${c.name}` : c.name, `${fmtNum(c.fte)} / ${fmtNum(c.capacity)}`, fmtPct(safeDiv(c.fte, c.capacity)), `+${c.futureStarts || 0}`, fmtNum(Math.max(0, c.capacity - c.fte))]);
    $('#moduleView').innerHTML = `<section class="school-card-grid">${schoolKeys().map(schoolCard).join('')}</section>${panel('Portfolio operating scorecard', 'SCHOOL PERFORMANCE', `<div class="table-wrap"><table class="performance-table module-performance">${performanceTableHtml()}</table></div>`, 'full')}${panel(state.scope === 'total' ? 'Highest-utilization classrooms across the portfolio' : `${scopeName()} classroom capacity`, 'CLASSROOMS', dataTable(['Classroom', 'FTE / Capacity', 'Occupancy', 'Scheduled starts', 'Open seats'], detailRows), 'full')}`;
    $$('[data-school-open]', $('#moduleView')).forEach(el => el.addEventListener('click', () => setScope(el.dataset.schoolOpen)));
    bindScopeJumps($('#moduleView'));
  }

  function renderModuleView() {
    if (state.view === 'enrollment') renderEnrollmentModule();
    else if (state.view === 'admissions') renderAdmissionsModule();
    else if (state.view === 'labor') renderLaborModule();
    else if (state.view === 'billing') renderBillingModule();
    else if (state.view === 'schools') renderSchoolsModule();
  }

  function renderDataSettings() {
    const list = $('#mappingList'); if (list) list.innerHTML = cfg.playground.pullCatalog.map(x => `<div class="mapping-row"><div><strong>${x.label}</strong><span>${x.domain} · ${x.status}</span></div><code>${x.key}</code></div>`).join('');
    const schoolSection = $$('.drawer-section').find(s => $('.drawer-section-title', s)?.textContent === 'Schools');
    if (schoolSection) { $$('.school-config-row', schoolSection).forEach(r => r.remove()); schoolKeys().forEach(key => schoolSection.insertAdjacentHTML('beforeend', `<div class="school-config-row"><span>${schoolCfg(key).name}</span><code>${schoolCfg(key).id}</code></div>`)); }
  }

  function ensureDataHealth() {
    if ($('#dataHealth')) return;
    const drawer = $('#settingsDrawer'); if (!drawer) return; const section = document.createElement('div'); section.className = 'drawer-section'; section.id = 'dataHealth'; const security = $('.security-section', drawer); if (security) security.before(section); else drawer.append(section);
  }

  function renderDataHealth() {
    const section = $('#dataHealth'); if (!section) return;
    const rows = [['Enrollment / rosters', 'Ready', '8:02 AM'], ['CRM / bookings', 'Ready', '8:02 AM'], ['Billing / balances', 'Ready', '8:01 AM'], ['Attendance / schedules', 'Ready', '8:02 AM'], ['Payroll', 'Endpoint mapping', 'Playground-native']];
    section.innerHTML = `<div class="drawer-section-title">Data health</div><div class="health-list">${rows.map((r, i) => `<div class="health-row"><i class="${i === 4 ? 'mapping' : ''}"></i><span>${r[0]}</span><strong>${r[1]}</strong><small>${r[2]}</small></div>`).join('')}</div>`;
  }

  function buildScopeSelector() {
    const el = $('#scopeSelector'); if (!el) return;
    el.innerHTML = `<button class="segment active" data-scope="total">Little Wonders</button>${schoolKeys().map(k => `<button class="segment" data-scope="${k}">${schoolCfg(k).shortName}</button>`).join('')}`;
    $$('.segment', el).forEach(btn => btn.addEventListener('click', () => setScope(btn.dataset.scope)));
  }

  function setScope(scope) {
    if (scope !== 'total' && !schoolCfg(scope)) return;
    state.scope = scope;
    $$('.segment', $('#scopeSelector')).forEach(b => b.classList.toggle('active', b.dataset.scope === scope));
    renderAll();
  }

  const viewMeta = {
    ceo: ['OPERATING OVERVIEW', 'CEO Dashboard'], enrollment: ['ENROLLMENT & CAPACITY', 'Enrollment'], admissions: ['DEMAND & CONVERSION', 'Admissions'], labor: ['PAYROLL & STAFFING', 'Labor'], billing: ['BILLING & COLLECTIONS', 'Billing'], schools: ['PORTFOLIO OPERATIONS', 'Schools']
  };

  function setView(view) {
    if (!viewMeta[view]) return;
    state.view = view;
    $('#ceoView').hidden = view !== 'ceo'; $('#moduleView').hidden = view === 'ceo';
    $$('.nav-item[data-view]').forEach(item => item.classList.toggle('active', item.dataset.view === view));
    $('#pageEyebrow').textContent = viewMeta[view][0]; $('#pageTitle').textContent = viewMeta[view][1];
    $('#compareControl').style.display = view === 'ceo' ? '' : 'none';
    if (window.innerWidth <= 820) $('#sidebar')?.classList.remove('mobile-open');
    renderAll();
  }

  function openSettings() { $('#settingsDrawer')?.classList.add('open'); $('#drawerBackdrop')?.classList.add('open'); }
  function closeSettings() { $('#settingsDrawer')?.classList.remove('open'); $('#drawerBackdrop')?.classList.remove('open'); }

  function setupInteractions() {
    $('#periodSelect')?.addEventListener('change', e => { state.period = e.target.value; renderAll(); });
    $('#compareSelect')?.addEventListener('change', e => { state.compare = e.target.value; renderAll(); });
    $('#collapseSidebar')?.addEventListener('click', () => $('#sidebar')?.classList.toggle('collapsed'));
    $('#mobileMenu')?.addEventListener('click', () => $('#sidebar')?.classList.add('mobile-open'));
    $('#brandHome')?.addEventListener('click', () => setView('ceo'));
    $$('.nav-item[data-view]').forEach(item => item.addEventListener('click', () => setView(item.dataset.view)));
    $('#openSettings')?.addEventListener('click', openSettings); $('#closeSettings')?.addEventListener('click', closeSettings); $('#drawerBackdrop')?.addEventListener('click', closeSettings);
    $$('[data-detail]').forEach(btn => btn.addEventListener('click', () => setView(btn.dataset.detail)));
    window.addEventListener('resize', () => { if (window.innerWidth > 820) $('#sidebar')?.classList.remove('mobile-open'); });
  }

  function renderCEO() { renderSummary(); renderForwardBook(); renderEnrollmentChart(); renderPerformance(); renderAdmissions(); renderBilling(); renderLabor(); renderAttention(); renderClassrooms(); }

  function renderAll() {
    if (state.view === 'ceo') renderCEO(); else renderModuleView();
    renderDataSettings(); renderDataHealth();
    const note = $('.refresh-note'); if (note) note.innerHTML = `Demo data · Playground-only model · refreshed <strong>8:02 AM</strong>`;
  }

  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .forward-book{margin-bottom:16px;padding:18px 20px}.forward-head{display:flex;justify-content:space-between;align-items:center;gap:20px}.forward-head h2{font-size:15px;margin:5px 0 0}.forward-grid{display:grid;grid-template-columns:repeat(4,minmax(0,.72fr)) minmax(280px,1.6fr);margin-top:16px;border-top:1px solid var(--line)}.forward-cell{padding:15px 16px 4px 0;border-right:1px solid var(--line);margin-right:16px}.forward-cell span,.forward-forecast>span{display:block;font-size:8.5px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);font-weight:700}.forward-cell strong{display:block;font-size:22px;letter-spacing:-.04em;margin-top:5px}.forward-cell small{display:block;font-size:8.5px;color:var(--muted);margin-top:3px}.forward-cell.highlight strong{color:var(--brand)}.forward-forecast{padding-top:15px}.forecast-points{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:8px}.forecast-points>div>span{font-size:8px;color:var(--muted)}.forecast-points strong{display:block;font-size:14px;margin:3px 0 6px}.forecast-points i{height:4px;background:#edf0ec;border-radius:5px;display:block;overflow:hidden}.forecast-points b{height:100%;display:block;background:var(--brand-2);border-radius:5px}.pipeline-strip{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;border-top:1px solid var(--line);padding-top:12px;margin-top:12px}.pipeline-strip span{font-size:8px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;display:block}.pipeline-strip strong{font-size:12px;display:block;margin-top:3px}.billing-aging{border-top:1px solid var(--line);margin-top:14px;padding-top:12px}.aging-head{display:flex;justify-content:space-between;font-size:9px;color:var(--muted)}.aging-head strong{color:var(--text)}.aging-bar{height:7px;border-radius:8px;overflow:hidden;display:flex;background:#eef1ed;margin-top:8px}.aging-bar i{display:block;height:100%}.aging-bar .age-0{background:#b9c9c0}.aging-bar .age-1{background:#d7c29d}.aging-bar .age-2{background:#c99272}.aging-bar .age-3{background:#b8645d}.aging-labels{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-top:7px}.aging-labels span{font-size:8px;color:var(--muted)}.aging-labels b{display:block;color:#606c64;font-weight:600;margin-bottom:1px}.ops-metric-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-top:3px}.ops-metric-grid>div{background:var(--surface-2);border:1px solid #eef0ec;border-radius:10px;padding:9px}.ops-metric-grid span{display:block;font-size:7.8px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}.ops-metric-grid strong{display:block;font-size:13px;margin-top:4px}.ops-metric-grid small{display:block;font-size:7.8px;color:var(--muted);margin-top:2px}.health-list{margin-top:8px}.health-row{display:grid;grid-template-columns:10px 1fr auto;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid var(--line)}.health-row i{width:7px;height:7px;border-radius:50%;background:var(--good)}.health-row i.mapping{background:var(--amber)}.health-row span{font-size:10px}.health-row strong{font-size:9px;color:var(--brand)}.health-row small{grid-column:2/4;font-size:8px;color:var(--muted);margin-top:-5px}.empty-attention{font-size:10px;color:var(--muted);padding:20px 0}
      .module-view{padding-bottom:8px}.module-kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow);overflow:hidden;margin-bottom:16px}.module-kpi{padding:17px 16px;min-width:0}.module-kpi+.module-kpi{border-left:1px solid var(--line)}.module-kpi span{font-size:8.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:700;display:block}.module-kpi strong{font-size:24px;line-height:1.05;letter-spacing:-.04em;margin-top:7px;display:block}.module-kpi small{font-size:9px;color:var(--muted);margin-top:5px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.module-grid{display:grid;gap:16px;margin-bottom:16px}.module-grid.two{grid-template-columns:minmax(0,1.65fr) minmax(320px,.85fr)}.module-panel{min-height:0}.module-panel.full{margin-bottom:16px}.module-panel.span-wide{min-height:310px}.source-badge{font-size:8px;letter-spacing:.06em;text-transform:uppercase;padding:5px 7px;border-radius:10px;background:var(--brand-soft);color:var(--brand);font-weight:700}.module-chart{height:265px;margin-top:12px}.detail-table{width:100%;border-collapse:collapse;min-width:720px;font-size:10px}.detail-table th{font-size:8.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:700;text-align:right;padding:10px 9px;border-bottom:1px solid var(--line);white-space:nowrap}.detail-table td{text-align:right;padding:10px 9px;border-bottom:1px solid #edf0ec;white-space:nowrap;font-variant-numeric:tabular-nums}.detail-table th.left,.detail-table td.left{text-align:left}.detail-table tbody tr:last-child td{border-bottom:0}.module-forward-list{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px}.module-forward-list>div{padding:12px;border:1px solid #edf0ec;background:var(--surface-2);border-radius:11px}.module-forward-list span{display:block;font-size:8px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}.module-forward-list strong{display:block;font-size:18px;margin-top:4px}.module-forward-list .accent{background:var(--brand-soft)}.module-forward-list .accent strong{color:var(--brand)}.forecast-ladder{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;border-top:1px solid var(--line);margin-top:15px;padding-top:13px}.detail-funnel{margin-top:16px}.source-bars{display:flex;flex-direction:column;gap:13px;margin-top:17px}.source-bars>div{display:grid;grid-template-columns:70px 1fr 30px;gap:9px;align-items:center}.source-bars span{font-size:9px;color:var(--muted)}.source-bars i{height:7px;border-radius:7px;background:#eef1ed;overflow:hidden}.source-bars b{display:block;height:100%;border-radius:7px;background:var(--brand-2)}.source-bars strong{text-align:right;font-size:10px}.schedule-list{margin-top:16px;display:flex;flex-direction:column;gap:16px}.schedule-row{display:grid;grid-template-columns:155px 1fr 48px;gap:14px;align-items:center}.schedule-row div strong{display:block;font-size:10px}.schedule-row div span{display:block;font-size:8.5px;color:var(--muted);margin-top:2px}.schedule-row i{height:8px;background:#edf0ec;border-radius:8px;overflow:hidden}.schedule-row i b{height:100%;display:block;background:var(--brand);border-radius:8px}.schedule-row>strong{text-align:right;font-size:11px}.large-stat{margin-top:18px;padding:16px;background:var(--surface-2);border:1px solid #edf0ec;border-radius:12px}.large-stat span{display:block;font-size:8px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}.large-stat strong{display:block;font-size:31px;letter-spacing:-.05em;margin-top:5px}.large-stat small{display:block;font-size:9px;color:var(--muted);margin-top:4px}.mini-pair{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}.mini-pair>div{padding:11px;border:1px solid #edf0ec;border-radius:10px}.mini-pair span{font-size:8px;color:var(--muted);display:block}.mini-pair strong{font-size:14px;margin-top:3px;display:block}.module-spark{margin-top:10px;display:grid;grid-template-columns:180px 1fr;align-items:center;gap:24px}.module-spark .spark-chart{height:120px}.module-aging{margin-top:18px;border-top:0;padding-top:0}.school-card-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px;margin-bottom:16px}.school-card{text-align:left;border:1px solid var(--line);background:var(--surface);border-radius:var(--radius);box-shadow:var(--shadow);padding:18px;cursor:pointer;transition:transform .15s ease,border-color .15s ease}.school-card:hover{transform:translateY(-1px);border-color:#ccd6cf}.school-card.selected{border-color:#9db6aa;box-shadow:0 0 0 2px rgba(118,149,135,.12),var(--shadow)}.school-card-head{display:flex;justify-content:space-between;gap:14px}.school-card-head span{font-size:8px;letter-spacing:.08em;color:var(--muted);display:block}.school-card-head strong{font-size:14px;margin-top:4px;display:block}.school-card-head i{font-style:normal;font-size:8.5px;color:var(--brand)}.school-card-main{margin-top:18px}.school-card-main>strong{font-size:30px;letter-spacing:-.05em;display:block}.school-card-main>span{font-size:9px;color:var(--muted);display:block;margin-top:3px}.school-card-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;border-top:1px solid var(--line);margin-top:14px;padding-top:13px}.school-card-metrics span{display:block;font-size:7.5px;color:var(--muted)}.school-card-metrics strong{display:block;font-size:11px;margin-top:3px}.module-performance{min-width:650px}
      @media(max-width:1200px){.forward-grid{grid-template-columns:repeat(4,1fr)}.forward-forecast{grid-column:1/-1;border-top:1px solid var(--line);margin-top:10px}.forward-cell:nth-child(4){border-right:0}.secondary-grid{grid-template-columns:1fr 1fr}.labor-panel{grid-column:1/-1}.ops-metric-grid{grid-template-columns:repeat(3,1fr)}.module-kpis{grid-template-columns:repeat(3,1fr)}.module-kpi:nth-child(4){border-left:0;border-top:1px solid var(--line)}.module-kpi:nth-child(5),.module-kpi:nth-child(6){border-top:1px solid var(--line)}}
      @media(max-width:900px){.module-grid.two{grid-template-columns:1fr}.module-panel.span-wide{min-height:0}.module-spark{grid-template-columns:1fr}.school-card-metrics{grid-template-columns:1fr 1fr}}
      @media(max-width:820px){.forward-head{align-items:flex-start;flex-direction:column}.forward-grid{grid-template-columns:1fr 1fr}.forward-cell:nth-child(2n){border-right:0}.forward-forecast{grid-column:1/-1}.pipeline-strip{grid-template-columns:1fr 1fr}.ops-metric-grid{grid-template-columns:1fr 1fr}.refresh-note{display:none}.module-kpis{grid-template-columns:1fr 1fr}.module-kpi:nth-child(n){border-left:0;border-top:1px solid var(--line)}.module-kpi:nth-child(1),.module-kpi:nth-child(2){border-top:0}.module-kpi:nth-child(even){border-left:1px solid var(--line)}.schedule-row{grid-template-columns:130px 1fr 44px}}
      @media(max-width:540px){.forward-grid{grid-template-columns:1fr}.forward-cell{border-right:0;border-bottom:1px solid var(--line);margin-right:0;padding-bottom:12px}.forecast-points{gap:7px}.ops-metric-grid{grid-template-columns:1fr}.aging-labels{grid-template-columns:1fr 1fr}.module-kpis{grid-template-columns:1fr 1fr}.module-kpi strong{font-size:20px}.module-forward-list{grid-template-columns:1fr}.forecast-ladder{grid-template-columns:1fr}.school-card-grid{grid-template-columns:1fr}.school-card-metrics{grid-template-columns:1fr 1fr}.schedule-row{grid-template-columns:1fr}.schedule-row>strong{text-align:left}}
    `;
    document.head.append(style);
  }

  injectStyles();
  buildScopeSelector();
  ensureForwardBook();
  ensureDataHealth();
  setupInteractions();
  setView('ceo');
})();
