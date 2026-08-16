(() => {
  const cfg = window.LW_CONFIG;
  const demo = window.LW_DEMO_DATA;
  if (!cfg || !demo) return;

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const safeDiv = (a, b) => b ? a / b : 0;
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const schoolKeys = () => Object.keys(cfg.schools || {});
  const schoolCfg = key => cfg.schools[key];
  const svgNS = 'http://www.w3.org/2000/svg';

  const fmtNum = (v, d = 0) => Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
  const fmtPct = (v, d = 1) => `${((v || 0) * 100).toFixed(d)}%`;
  const fmtMoney = v => `$${Math.round(v || 0).toLocaleString()}`;
  const fmtMoneyK = v => `$${(Number(v || 0) / 1000).toFixed(Math.abs(Number(v || 0)) >= 100000 ? 0 : 1)}k`;
  const fmtRunRate = v => {
    const n = Number(v || 0);
    if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}m`;
    return `$${Math.round(n / 1000)}k`;
  };

  const METRICS = [
    { key: 'occupancy', label: 'Occupancy', short: 'Occupancy' },
    { key: 'booked30', label: '30D Booked Occupancy', short: '30D Booked' },
    { key: 'tuition', label: 'Tuition Run Rate', short: 'Tuition Run Rate' },
    { key: 'payrollPct', label: 'Payroll / Net Tuition', short: 'Payroll %' },
    { key: 'tuitionLessPayroll', label: 'Tuition Less Payroll', short: 'Tuition Less Payroll' }
  ];

  let activeMetric = 'occupancy';
  let observer;
  let scheduled = false;

  function period() { return $('#periodSelect')?.value || cfg.app.defaultPeriod || '4w'; }
  function scope() { return $('#scopeSelector .segment.active')?.dataset.scope || cfg.app.defaultScope || 'total'; }
  function periodLabel() { return demo.periods?.[period()]?.label || period(); }

  function annualizationFactor(p = period()) {
    if (p === '4w') return 13;
    if (p === '8w') return 6.5;
    if (p === 'mtd') return 365.25 / Math.max(1, new Date().getDate());
    return 13;
  }

  function rawRecord(key, p = period()) { return demo.periods?.[p]?.scopes?.[key] || null; }

  function record(key, p = period()) {
    const src = rawRecord(key, p);
    if (!src) return null;
    const d = JSON.parse(JSON.stringify(src));
    d.capacity = Number(d.capacity ?? schoolCfg(key)?.effectiveCapacity ?? 0);
    d.netBilled = Math.max(0, Number(d.charges || 0) - Number(d.discounts || 0));
    d.grossPayroll = Number(d.grossPayroll || 0);
    d.tuitionLessPayroll = d.netBilled - d.grossPayroll;
    d.annualizedTuition = d.netBilled * annualizationFactor(p);
    d.annualizedPayroll = d.grossPayroll * annualizationFactor(p);
    d.annualizedTuitionLessPayroll = d.tuitionLessPayroll * annualizationFactor(p);
    d.openSeats = Math.max(0, d.capacity - Number(d.fte || 0));
    d.scheduledStarts = Number(d.scheduledStarts || 0);
    d.knownDepartures = Number(d.knownDepartures || 0);
    d.netScheduledAdds = d.scheduledStarts - d.knownDepartures;
    d.forecast30Fte = Number(d.forecast30Fte ?? d.forecastSeries?.[d.forecastSeries.length - 1] ?? d.fte ?? 0);
    d.schoolKey = key;
    return d;
  }

  function sumSeries(seriesList) {
    const n = Math.max(0, ...seriesList.map(x => x?.length || 0));
    return Array.from({ length: n }, (_, i) => seriesList.reduce((sum, arr) => {
      if (!arr?.length) return sum;
      return sum + Number(arr[i] ?? arr[arr.length - 1] ?? 0);
    }, 0));
  }

  function aggregate(p = period()) {
    const records = schoolKeys().map(key => record(key, p)).filter(Boolean);
    const numeric = ['fte', 'capacity', 'netAdds', 'charges', 'payments', 'discounts', 'grossPayroll', 'netBilled', 'tuitionLessPayroll', 'annualizedTuition', 'annualizedPayroll', 'annualizedTuitionLessPayroll', 'openSeats', 'scheduledStarts', 'knownDepartures', 'netScheduledAdds', 'forecast30Fte'];
    const out = {};
    numeric.forEach(k => out[k] = records.reduce((s, d) => s + Number(d[k] || 0), 0));
    out.enrollmentSeries = sumSeries(records.map(d => d.enrollmentSeries));
    out.forecastSeries = sumSeries(records.map(d => d.forecastSeries));
    return out;
  }

  function dataFor(s = scope(), p = period()) { return s === 'total' ? aggregate(p) : record(s, p); }
  function targetsFor(s = scope()) { return s === 'total' ? cfg.targets : { ...cfg.targets, ...(schoolCfg(s)?.targets || {}) }; }

  function metricSeries(d, metric) {
    const enrollment = (d.enrollmentSeries?.length ? d.enrollmentSeries : [d.fte]).map(Number);
    const currentFte = Math.max(1, Number(d.fte || enrollment[enrollment.length - 1] || 1));
    const tuitionPerFteRunRate = safeDiv(d.annualizedTuition, currentFte);
    const currentPayrollRunRate = Number(d.annualizedPayroll || 0);

    // For the demo, historical economic trends are derived from Playground-shaped
    // enrollment + current-period billing/payroll. Production can replace these with
    // daily API snapshots without changing the chart contract.
    const tuitionSeries = enrollment.map(fte => fte * tuitionPerFteRunRate);
    const payrollSeries = enrollment.map(fte => {
      const enrollmentFactor = safeDiv(fte, currentFte);
      return currentPayrollRunRate * (0.88 + 0.12 * enrollmentFactor);
    });

    if (metric === 'occupancy') {
      return {
        actual: enrollment.map(v => safeDiv(v, d.capacity)),
        target: targetsFor().occupancy,
        type: 'percent',
        xMode: 'history',
        title: `Occupancy is ${fmtPct(safeDiv(d.fte, d.capacity))} today`,
        meta: `Actual FTE enrollment ÷ effective capacity · ${periodLabel()}`,
        route: 'enrollment',
        routeLabel: 'View enrollment',
        support: [
          ['FTE enrollment', `${fmtNum(d.fte)} / ${fmtNum(d.capacity)}`, 'Current FTE / capacity'],
          ['Net adds', `${d.netAdds >= 0 ? '+' : '−'}${fmtNum(Math.abs(d.netAdds || 0))}`, periodLabel()],
          ['Open seats', fmtNum(d.openSeats), 'Current FTE capacity gap'],
          ['Target', fmtPct(targetsFor().occupancy), 'Configured occupancy target']
        ]
      };
    }

    if (metric === 'booked30') {
      let forward = (d.forecastSeries?.length ? d.forecastSeries : [d.fte, d.forecast30Fte]).map(Number);
      if (!forward.length || forward[0] !== Number(d.fte || 0)) forward = [Number(d.fte || 0), ...forward];
      if (forward[forward.length - 1] !== Number(d.forecast30Fte || 0)) forward.push(Number(d.forecast30Fte || 0));
      return {
        actual: forward.map(v => safeDiv(v, d.capacity)),
        target: targetsFor().forecastOccupancy30,
        type: 'percent',
        xMode: 'forward',
        title: `Booked enrollment reaches ${fmtPct(safeDiv(d.forecast30Fte, d.capacity))} occupancy in 30 days`,
        meta: 'Current FTE plus scheduled starts less known departures',
        route: 'enrollment',
        routeLabel: 'View enrollment',
        support: [
          ['Scheduled starts', `+${fmtNum(d.scheduledStarts)}`, 'Future enrollment records'],
          ['Known departures', `−${fmtNum(d.knownDepartures)}`, 'Known end dates / withdrawals'],
          ['Net booked', `${d.netScheduledAdds >= 0 ? '+' : '−'}${fmtNum(Math.abs(d.netScheduledAdds))}`, 'Starts less departures'],
          ['30D FTE', fmtNum(d.forecast30Fte), `${fmtNum(d.capacity)} effective capacity`]
        ]
      };
    }

    if (metric === 'tuition') {
      return {
        actual: tuitionSeries,
        target: null,
        type: 'money',
        xMode: 'history',
        title: `Annualized tuition run rate is ${fmtRunRate(d.annualizedTuition)}`,
        meta: 'Net tuition billed annualized; demo trend scales current tuition/FTE across historical enrollment',
        route: 'billing',
        routeLabel: 'View billing',
        support: [
          ['Net billed', fmtMoneyK(d.netBilled), periodLabel()],
          ['Tuition / FTE', fmtMoney(safeDiv(d.netBilled, d.fte)), 'Selected period'],
          ['Discounts', fmtMoneyK(d.discounts), 'Selected period'],
          ['Annualized', fmtRunRate(d.annualizedTuition), 'Tuition run rate']
        ]
      };
    }

    if (metric === 'payrollPct') {
      const ratioSeries = tuitionSeries.map((v, i) => safeDiv(payrollSeries[i], v));
      return {
        actual: ratioSeries,
        target: targetsFor().grossPayrollPctNetBilled,
        targetInverse: true,
        type: 'percent',
        xMode: 'history',
        title: `Payroll is ${fmtPct(safeDiv(d.grossPayroll, d.netBilled))} of net tuition`,
        meta: 'Gross payroll ÷ net tuition billed; lower is better',
        route: 'labor',
        routeLabel: 'View labor',
        support: [
          ['Gross payroll', fmtMoneyK(d.grossPayroll), periodLabel()],
          ['Net tuition', fmtMoneyK(d.netBilled), periodLabel()],
          ['Payroll / FTE', fmtMoney(safeDiv(d.grossPayroll, d.fte)), 'Selected period'],
          ['Target', fmtPct(targetsFor().grossPayrollPctNetBilled), 'Maximum target']
        ]
      };
    }

    const tlpSeries = tuitionSeries.map((v, i) => v - payrollSeries[i]);
    return {
      actual: tlpSeries,
      target: null,
      type: 'money',
      xMode: 'history',
      title: `Tuition less payroll run rate is ${fmtRunRate(d.annualizedTuitionLessPayroll)}`,
      meta: 'Annualized net tuition less gross payroll · not EBITDA',
      route: 'labor',
      routeLabel: 'View labor',
      support: [
        ['Tuition run rate', fmtRunRate(d.annualizedTuition), 'Annualized'],
        ['Payroll run rate', fmtRunRate(d.annualizedPayroll), 'Annualized gross payroll'],
        ['TLP margin', fmtPct(safeDiv(d.tuitionLessPayroll, d.netBilled)), 'After gross payroll'],
        ['TLP run rate', fmtRunRate(d.annualizedTuitionLessPayroll), 'Annualized']
      ]
    };
  }

  function svgEl(tag, attrs = {}) {
    const el = document.createElementNS(svgNS, tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
  }

  function path(points) { return points.map((p, i) => `${i ? 'L' : 'M'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' '); }

  function valueFormatter(type, value, axis = false) {
    if (type === 'percent') return fmtPct(value, axis ? 0 : 1);
    if (axis) {
      if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}m`;
      return `$${Math.round(value / 1000)}k`;
    }
    return fmtRunRate(value);
  }

  function drawChart(svg, spec) {
    if (!svg || !spec.actual?.length) return;
    svg.innerHTML = '';
    const W = 780, H = 270, pad = { l: 48, r: 58, t: 22, b: 31 };
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

    const values = [...spec.actual];
    if (Number.isFinite(spec.target)) values.push(spec.target);
    let min = Math.min(...values), max = Math.max(...values);
    let range = max - min;
    if (!range) range = Math.abs(max || 1) * 0.1 || 1;
    min -= range * 0.20;
    max += range * 0.20;
    if (spec.type === 'percent') {
      min = Math.max(0, min);
      max = Math.min(1.15, max);
    }

    const x = i => pad.l + (i / Math.max(1, spec.actual.length - 1)) * (W - pad.l - pad.r);
    const y = v => pad.t + ((max - v) / (max - min || 1)) * (H - pad.t - pad.b);

    const defs = svgEl('defs');
    const grad = svgEl('linearGradient', { id: 'metricToggleArea', x1: '0', x2: '0', y1: '0', y2: '1' });
    grad.append(svgEl('stop', { offset: '0%', 'stop-color': '#789589', 'stop-opacity': '.16' }), svgEl('stop', { offset: '100%', 'stop-color': '#789589', 'stop-opacity': '0' }));
    defs.append(grad); svg.append(defs);

    for (let i = 0; i < 3; i++) {
      const v = min + (max - min) * (i / 2);
      const yy = y(v);
      svg.append(svgEl('line', { x1: pad.l, y1: yy, x2: W - pad.r, y2: yy, class: 'exec-grid-line' }));
      const text = svgEl('text', { x: pad.l - 9, y: yy + 3, 'text-anchor': 'end', class: 'exec-axis' });
      text.textContent = valueFormatter(spec.type, v, true); svg.append(text);
    }

    if (Number.isFinite(spec.target)) {
      const yy = y(spec.target);
      svg.append(svgEl('line', { x1: pad.l, y1: yy, x2: W - pad.r, y2: yy, class: 'exec-target' }));
      const text = svgEl('text', { x: W - pad.r + 7, y: yy + 3, class: 'exec-target-label' });
      text.textContent = `${valueFormatter(spec.type, spec.target, true)} target`; svg.append(text);
    }

    const pts = spec.actual.map((v, i) => [x(i), y(v)]);
    svg.append(svgEl('path', { d: `${path(pts)} L ${pts[pts.length - 1][0]} ${H - pad.b} L ${pts[0][0]} ${H - pad.b} Z`, fill: 'url(#metricToggleArea)' }));
    svg.append(svgEl('path', { d: path(pts), class: activeMetric === 'booked30' ? 'exec-forecast' : 'exec-actual' }));

    const end = pts[pts.length - 1];
    svg.append(svgEl('circle', { cx: end[0], cy: end[1], r: 4.3, class: `exec-dot${activeMetric === 'booked30' ? ' forecast' : ''}` }));
    const label = svgEl('text', { x: end[0], y: end[1] - 11, 'text-anchor': 'end', class: 'exec-value-label' });
    label.textContent = valueFormatter(spec.type, spec.actual[spec.actual.length - 1]); svg.append(label);

    const labels = spec.xMode === 'forward'
      ? [[0, 'Today', 'start'], [spec.actual.length - 1, '+30 days', 'end']]
      : [[0, 'Period start', 'start'], [spec.actual.length - 1, 'Today', 'end']];
    labels.forEach(([idx, textValue, anchor]) => {
      const text = svgEl('text', { x: x(idx), y: H - 8, 'text-anchor': anchor, class: 'exec-axis' });
      text.textContent = textValue; svg.append(text);
    });
  }

  function supportHtml(items) {
    return items.map(([label, value, detail], idx) => `<div class="exec-book-item metric-context ${idx === items.length - 1 ? 'accent' : ''}"><span>${label}</span><strong>${value}</strong><small>${detail}</small></div>`).join('');
  }

  function ensureSelector(hero) {
    let selector = $('.exec-chart-selector', hero);
    if (!selector) {
      selector = document.createElement('div');
      selector.className = 'exec-chart-selector';
      const chart = $('.exec-chart-wrap', hero);
      if (chart) chart.before(selector);
    }
    selector.innerHTML = `<span class="exec-chart-selector-label">Chart metric</span>${METRICS.map(m => `<button type="button" class="exec-chart-toggle ${m.key === activeMetric ? 'active' : ''}" data-chart-metric="${m.key}">${m.short}</button>`).join('')}`;
    $$('.exec-chart-toggle', selector).forEach(btn => btn.addEventListener('click', () => {
      activeMetric = btn.dataset.chartMetric;
      apply();
    }));
  }

  function bindKpiCards(root) {
    const cards = $$('.exec-kpi', root);
    cards.forEach((card, i) => {
      const metric = METRICS[i];
      if (!metric) return;
      card.dataset.chartMetric = metric.key;
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', `Show ${metric.label} on chart`);
      card.classList.toggle('active-chart-metric', metric.key === activeMetric);
      card.onclick = () => { activeMetric = metric.key; apply(); };
      card.onkeydown = e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          activeMetric = metric.key;
          apply();
        }
      };
    });
  }

  function updateHero(root) {
    const hero = $('.exec-hero', root);
    if (!hero) return;
    hero.classList.add('metric-chart');
    const d = dataFor();
    if (!d) return;
    const spec = metricSeries(d, activeMetric);

    ensureSelector(hero);
    bindKpiCards(root);

    const kicker = $('.exec-section-kicker', hero);
    const title = $('.exec-section-title', hero);
    const meta = $('.exec-section-meta', hero);
    if (kicker) kicker.textContent = METRICS.find(x => x.key === activeMetric)?.label.toUpperCase() || 'METRIC TREND';
    if (title) title.textContent = spec.title;
    if (meta) meta.textContent = spec.meta;

    const route = $('.exec-view-link', hero);
    if (route) {
      route.dataset.execRoute = spec.route;
      route.textContent = `${spec.routeLabel} →`;
    }

    const support = $('.exec-book', hero);
    if (support) support.innerHTML = supportHtml(spec.support);

    drawChart($('#execOccupancyChart', hero), spec);

    $$('.exec-chart-toggle', hero).forEach(btn => btn.classList.toggle('active', btn.dataset.chartMetric === activeMetric));
    $$('.exec-kpi', root).forEach(card => card.classList.toggle('active-chart-metric', card.dataset.chartMetric === activeMetric));
  }

  function apply() {
    const root = $('#ceoExecutiveV2');
    if (!root || $('#ceoView')?.hidden) return;
    updateHero(root);
  }

  function scheduleApply() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      apply();
    });
  }

  function setup() {
    const root = $('#ceoExecutiveV2');
    if (!root) {
      setTimeout(setup, 50);
      return;
    }
    observer?.disconnect();
    observer = new MutationObserver(scheduleApply);
    observer.observe(root, { childList: true });
    apply();

    $('#scopeSelector')?.addEventListener('click', scheduleApply);
    $('#periodSelect')?.addEventListener('change', scheduleApply);
    $('.nav-list')?.addEventListener('click', scheduleApply);
    window.addEventListener('popstate', scheduleApply);
  }

  setup();
  window.LW_CHART_TOGGLE = { setMetric: key => { if (METRICS.some(m => m.key === key)) { activeMetric = key; apply(); } }, getMetric: () => activeMetric };
})();
