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
  const fmtNum = (v, d = 0) => Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
  const fmtPct = (v, d = 1) => `${((v || 0) * 100).toFixed(d)}%`;
  const fmtMoney = v => `$${Math.round(v || 0).toLocaleString()}`;
  const fmtMoneyK = v => `$${(Number(v || 0) / 1000).toFixed(Math.abs(Number(v || 0)) >= 100000 ? 0 : 1)}k`;
  const fmtRunRate = v => {
    const n = Number(v || 0);
    if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}m`;
    return `$${Math.round(n / 1000)}k`;
  };
  const svgNS = 'http://www.w3.org/2000/svg';
  let applyingRoute = false;
  let internalNav = false;

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
    d.openSeats = Math.max(0, d.capacity - Number(d.fte || 0));
    d.scheduledStarts = Number(d.scheduledStarts || 0);
    d.knownDepartures = Number(d.knownDepartures || 0);
    d.netScheduledAdds = d.scheduledStarts - d.knownDepartures;
    d.forecast30Fte = Number(d.forecast30Fte ?? d.forecastSeries?.[d.forecastSeries.length - 1] ?? d.fte ?? 0);
    d.forecast60Fte = Number(d.forecast60Fte ?? d.forecast30Fte);
    d.forecast90Fte = Number(d.forecast90Fte ?? d.forecast60Fte);
    d.grossPayroll = Number(d.grossPayroll || 0);
    d.tuitionLessPayroll = d.netBilled - d.grossPayroll;
    d.annualizedTuition = d.netBilled * annualizationFactor(p);
    d.annualizedTuitionLessPayroll = d.tuitionLessPayroll * annualizationFactor(p);
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
    const numeric = ['fte', 'capacity', 'netAdds', 'leads', 'tours', 'toursCompleted', 'enrollments', 'charges', 'payments', 'discounts', 'subsidies', 'pastDue', 'studentHours', 'staffHours', 'scheduledStaffHours', 'grossPayroll', 'openSeats', 'scheduledStarts', 'knownDepartures', 'netScheduledAdds', 'forecast30Fte', 'forecast60Fte', 'forecast90Fte', 'netBilled', 'tuitionLessPayroll', 'annualizedTuition', 'annualizedTuitionLessPayroll'];
    const out = {};
    numeric.forEach(k => out[k] = records.reduce((s, d) => s + Number(d[k] || 0), 0));
    out.enrollmentSeries = sumSeries(records.map(d => d.enrollmentSeries));
    out.forecastSeries = sumSeries(records.map(d => d.forecastSeries));
    out.collectionsSeries = sumSeries(records.map(d => d.collectionsSeries));
    out.classrooms = records.flatMap(d => (d.classrooms || []).map(c => ({ ...c, schoolKey: d.schoolKey, school: schoolCfg(d.schoolKey)?.shortName || d.schoolKey })));
    return out;
  }

  function dataFor(s = scope(), p = period()) { return s === 'total' ? aggregate(p) : record(s, p); }
  function targetsFor(s = scope()) { return s === 'total' ? cfg.targets : { ...cfg.targets, ...(schoolCfg(s)?.targets || {}) }; }

  function metrics(d) {
    return {
      occupancy: safeDiv(d.fte, d.capacity),
      forecast30: safeDiv(d.forecast30Fte, d.capacity),
      forecast60: safeDiv(d.forecast60Fte, d.capacity),
      forecast90: safeDiv(d.forecast90Fte, d.capacity),
      collection: safeDiv(d.payments, d.netBilled),
      payrollPct: safeDiv(d.grossPayroll, d.netBilled),
      tuitionLessPayrollMargin: safeDiv(d.tuitionLessPayroll, d.netBilled),
      pastDuePct: safeDiv(d.pastDue, d.netBilled),
      conversion: safeDiv(d.enrollments, d.leads)
    };
  }

  function signedPts(delta) {
    const pts = delta * 100;
    return `${pts > 0 ? '+' : pts < 0 ? '−' : ''}${Math.abs(pts).toFixed(1)} pts`;
  }

  function targetContext(value, target, inverse = false) {
    const delta = value - target;
    const good = inverse ? value <= target : value >= target;
    const near = Math.abs(delta) <= 0.02;
    const position = delta === 0 ? 'at target' : `${Math.abs(delta * 100).toFixed(1)} pts ${delta > 0 ? 'above' : 'below'} target`;
    return { text: position, cls: good ? 'good' : near ? 'watch' : 'risk' };
  }

  function status(value, target, inverse = false) {
    const delta = value - target;
    if (inverse) {
      if (value <= target) return 'good';
      if (delta <= 0.03) return 'watch';
      return 'risk';
    }
    if (value >= target) return 'good';
    if (Math.abs(delta) <= 0.02) return 'watch';
    return 'risk';
  }

  function ensureContainer() {
    const ceo = $('#ceoView');
    if (!ceo) return null;
    let container = $('#ceoExecutiveV2');
    if (!container) {
      container = document.createElement('div');
      container.id = 'ceoExecutiveV2';
      ceo.prepend(container);
    }
    return container;
  }

  function issuesFor(s = scope()) {
    const keys = s === 'total' ? schoolKeys() : [s];
    const issues = [];
    const add = issue => issues.push(issue);

    keys.forEach(key => {
      const d = record(key);
      if (!d) return;
      const m = metrics(d);
      const t = targetsFor(key);
      const school = schoolCfg(key)?.shortName || key;
      const prefix = s === 'total' ? `${school}: ` : '';

      if (m.payrollPct > t.grossPayrollPctNetBilled) {
        const over = m.payrollPct - t.grossPayrollPctNetBilled;
        add({ score: 115 + over * 100, level: over > 0.06 ? 'risk' : 'watch', title: `${prefix}payroll above target`, detail: `${fmtPct(m.payrollPct)} of net tuition vs ${fmtPct(t.grossPayrollPctNetBilled)} target`, readout: `${school} payroll is the primary watch item at ${fmtPct(m.payrollPct)} of net tuition`, scope: key, view: 'labor' });
      }

      if (m.occupancy < t.occupancy) {
        const gap = t.occupancy - m.occupancy;
        add({ score: 108 + gap * 100, level: gap > 0.04 ? 'risk' : 'watch', title: `${prefix}occupancy below target`, detail: `${fmtPct(m.occupancy)} current vs ${fmtPct(t.occupancy)} target`, readout: `${school} occupancy is below target at ${fmtPct(m.occupancy)}`, scope: key, view: 'enrollment' });
      }

      if (m.collection < t.collectionRate) {
        const gap = t.collectionRate - m.collection;
        add({ score: 101 + gap * 100, level: gap > 0.03 ? 'risk' : 'watch', title: `${prefix}collections below target`, detail: `${fmtPct(m.collection)} collection rate vs ${fmtPct(t.collectionRate)} target`, readout: `${school} collections are below target at ${fmtPct(m.collection)}`, scope: key, view: 'billing' });
      }

      if (m.forecast30 < t.forecastOccupancy30) {
        const gap = t.forecastOccupancy30 - m.forecast30;
        add({ score: 94 + gap * 100, level: gap > 0.04 ? 'risk' : 'watch', title: `${prefix}30-day booked occupancy below target`, detail: `${fmtPct(m.forecast30)} projected vs ${fmtPct(t.forecastOccupancy30)} target`, readout: `${school} 30-day booked occupancy is ${fmtPct(m.forecast30)}`, scope: key, view: 'enrollment' });
      }

      if (m.pastDuePct > t.pastDuePctNetBilled) {
        const over = m.pastDuePct - t.pastDuePctNetBilled;
        add({ score: 88 + over * 100, level: over > 0.04 ? 'risk' : 'watch', title: `${prefix}past-due balance elevated`, detail: `${fmtPct(m.pastDuePct)} of net tuition billed is past due`, readout: `${school} past-due balances are elevated`, scope: key, view: 'billing' });
      }

      if (m.conversion < t.leadToEnrollment) {
        add({ score: 78 + (t.leadToEnrollment - m.conversion) * 100, level: 'watch', title: `${prefix}lead conversion below target`, detail: `${fmtPct(m.conversion)} lead-to-enrollment vs ${fmtPct(t.leadToEnrollment)} target`, readout: `${school} lead conversion is below target at ${fmtPct(m.conversion)}`, scope: key, view: 'admissions' });
      }

      (d.classrooms || []).forEach(c => {
        const occ = safeDiv(c.fte, c.capacity);
        if (occ >= 0.97) add({ score: 82 + (occ - 0.97) * 100, level: 'risk', title: `${prefix}${c.name} effectively full`, detail: `${fmtPct(occ, 0)} FTE occupancy with ${c.futureStarts || 0} scheduled start${c.futureStarts === 1 ? '' : 's'}`, readout: `${school} ${c.name} is effectively full`, scope: key, view: 'enrollment' });
        else if (occ >= 0.93) add({ score: 70 + (occ - 0.93) * 100, level: 'watch', title: `${prefix}${c.name} nearing capacity`, detail: `${fmtPct(occ, 0)} FTE occupancy`, readout: `${school} ${c.name} is nearing capacity`, scope: key, view: 'enrollment' });
      });
    });

    return issues.sort((a, b) => b.score - a.score);
  }

  function renderReadout(container, d, m) {
    const selected = scope();
    const label = selected === 'total' ? 'Portfolio' : schoolCfg(selected)?.shortName || selected;
    const issue = issuesFor(selected)[0];
    const first = `${label} occupancy is <strong>${fmtPct(m.occupancy)}</strong>; booked enrollment lifts it to <strong>${fmtPct(m.forecast30)}</strong> within 30 days.`;
    const economics = `Annualized net tuition is <strong>${fmtRunRate(d.annualizedTuition)}</strong>, with <strong>${fmtPct(m.tuitionLessPayrollMargin)}</strong> remaining after gross payroll.`;
    const watch = issue ? ` ${issue.readout}.` : ' No material operating exceptions are above threshold.';
    container.insertAdjacentHTML('beforeend', `<section class="exec-readout"><div class="exec-kicker">EXECUTIVE READOUT</div><h2>${first} ${economics}${watch}</h2></section>`);
  }

  function renderKpis(container, d, m, t) {
    const payrollCtx = targetContext(m.payrollPct, t.grossPayrollPctNetBilled, true);
    const tlpTarget = Math.max(0, 1 - t.grossPayrollPctNetBilled);
    const tlpCtx = targetContext(m.tuitionLessPayrollMargin, tlpTarget);
    const cards = [
      ['Occupancy', fmtPct(m.occupancy), `${fmtNum(d.fte)} / ${fmtNum(d.capacity)} FTE · ${d.netAdds >= 0 ? '+' : '−'}${fmtNum(Math.abs(d.netAdds))} net adds`, status(m.occupancy, t.occupancy)],
      ['30D Booked Occupancy', fmtPct(m.forecast30), `${fmtNum(d.forecast30Fte)} projected FTE · ${signedPts(m.forecast30 - m.occupancy)} vs today`, status(m.forecast30, t.forecastOccupancy30)],
      ['Tuition Run Rate', fmtRunRate(d.annualizedTuition), `Annualized from ${fmtMoneyK(d.netBilled)} net billed · ${periodLabel()}`, ''],
      ['Payroll / Net Tuition', fmtPct(m.payrollPct), payrollCtx.text, payrollCtx.cls],
      ['Tuition Less Payroll', fmtRunRate(d.annualizedTuitionLessPayroll), `Annualized · ${fmtPct(m.tuitionLessPayrollMargin)} after gross payroll`, tlpCtx.cls]
    ];
    container.insertAdjacentHTML('beforeend', `<section class="exec-kpis">${cards.map(c => `<div class="exec-kpi"><span class="exec-kpi-label">${c[0]}</span><strong class="exec-kpi-value">${c[1]}</strong><span class="exec-kpi-context ${c[3]}">${c[2]}</span></div>`).join('')}</section>`);
  }

  function makeSvg(tag, attrs = {}) {
    const el = document.createElementNS(svgNS, tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
  }

  function path(points) { return points.map((p, i) => `${i ? 'L' : 'M'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' '); }

  function renderOccupancyChart(svg, d, t) {
    if (!svg) return;
    svg.innerHTML = '';
    const W = 780, H = 270, pad = { l: 42, r: 54, t: 20, b: 31 };
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const actual = (d.enrollmentSeries?.length ? d.enrollmentSeries : [d.fte]).map(v => safeDiv(v, d.capacity));
    let forecast = (d.forecastSeries?.length ? d.forecastSeries : [d.fte, d.forecast30Fte]).map(v => safeDiv(v, d.capacity));
    if (!forecast.length || Math.abs(forecast[0] - actual[actual.length - 1]) > 0.0001) forecast = [actual[actual.length - 1], ...forecast];
    else forecast[0] = actual[actual.length - 1];
    const all = [...actual, ...forecast, t.occupancy];
    const minV = Math.max(0, Math.min(...all) - 0.045);
    const maxV = Math.min(1.05, Math.max(...all) + 0.04);
    const totalPoints = Math.max(2, actual.length + forecast.length - 1);
    const x = i => pad.l + (i / (totalPoints - 1)) * (W - pad.l - pad.r);
    const y = v => pad.t + ((maxV - v) / (maxV - minV || 1)) * (H - pad.t - pad.b);

    const defs = makeSvg('defs');
    const grad = makeSvg('linearGradient', { id: 'execAreaFade', x1: '0', x2: '0', y1: '0', y2: '1' });
    grad.append(makeSvg('stop', { offset: '0%', 'stop-color': '#789589', 'stop-opacity': '.16' }), makeSvg('stop', { offset: '100%', 'stop-color': '#789589', 'stop-opacity': '0' }));
    defs.append(grad); svg.append(defs);

    for (let i = 0; i < 3; i++) {
      const v = minV + (maxV - minV) * (i / 2), yy = y(v);
      svg.append(makeSvg('line', { x1: pad.l, y1: yy, x2: W - pad.r, y2: yy, class: 'exec-grid-line' }));
      const txt = makeSvg('text', { x: pad.l - 9, y: yy + 3, 'text-anchor': 'end', class: 'exec-axis' }); txt.textContent = fmtPct(v, 0); svg.append(txt);
    }

    const targetY = y(t.occupancy);
    svg.append(makeSvg('line', { x1: pad.l, y1: targetY, x2: W - pad.r, y2: targetY, class: 'exec-target' }));
    const targetLabel = makeSvg('text', { x: W - pad.r + 7, y: targetY + 3, class: 'exec-target-label' }); targetLabel.textContent = `${fmtPct(t.occupancy, 0)} target`; svg.append(targetLabel);

    const actualPts = actual.map((v, i) => [x(i), y(v)]), forecastPts = forecast.map((v, i) => [x(actual.length - 1 + i), y(v)]);
    svg.append(makeSvg('path', { d: `${path(actualPts)} L ${actualPts[actualPts.length - 1][0]} ${H - pad.b} L ${actualPts[0][0]} ${H - pad.b} Z`, class: 'exec-area' }));
    svg.append(makeSvg('path', { d: path(actualPts), class: 'exec-actual' }));
    svg.append(makeSvg('path', { d: path(forecastPts), class: 'exec-forecast' }));

    const nowX = x(actual.length - 1), endX = x(totalPoints - 1), endY = y(forecast[forecast.length - 1]);
    svg.append(makeSvg('line', { x1: nowX, y1: pad.t, x2: nowX, y2: H - pad.b, class: 'exec-now-line' }));
    svg.append(makeSvg('circle', { cx: nowX, cy: y(actual[actual.length - 1]), r: 4.3, class: 'exec-dot' }));
    svg.append(makeSvg('circle', { cx: endX, cy: endY, r: 4.3, class: 'exec-dot forecast' }));
    const nowVal = makeSvg('text', { x: nowX, y: y(actual[actual.length - 1]) - 11, 'text-anchor': 'middle', class: 'exec-value-label' }); nowVal.textContent = fmtPct(actual[actual.length - 1]); svg.append(nowVal);
    const endVal = makeSvg('text', { x: endX, y: endY - 11, 'text-anchor': 'end', class: 'exec-value-label' }); endVal.textContent = fmtPct(forecast[forecast.length - 1]); svg.append(endVal);
    [[0, 'Period start', 'start'], [actual.length - 1, 'Today', 'middle'], [totalPoints - 1, '+30 days', 'end']].forEach(([idx, label, anchor]) => {
      const txt = makeSvg('text', { x: x(idx), y: H - 8, 'text-anchor': anchor, class: 'exec-axis' }); txt.textContent = label; svg.append(txt);
    });
  }

  function percentScoreCell(value, target, inverse = false) {
    const cls = status(value, target, inverse);
    const delta = value - target;
    const variance = `${delta > 0 ? '+' : delta < 0 ? '−' : ''}${Math.abs(delta * 100).toFixed(1)} pts`;
    return `<td><span class="exec-score-value"><i class="exec-status ${cls}"></i>${fmtPct(value)}</span><span class="exec-variance ${cls === 'good' ? '' : cls}">${variance}</span></td>`;
  }

  function moneyScoreCell(value, subtext = '') {
    return `<td><span class="exec-score-value">${fmtRunRate(value)}</span>${subtext ? `<span class="exec-variance">${subtext}</span>` : ''}</td>`;
  }

  function schoolGapScore(key) {
    const d = record(key), m = metrics(d), t = targetsFor(key);
    if (!d) return 0;
    return Math.max(0, t.occupancy - m.occupancy) * 100 + Math.max(0, t.forecastOccupancy30 - m.forecast30) * 80 + Math.max(0, m.payrollPct - t.grossPayrollPctNetBilled) * 90;
  }

  function scorecardTitle() {
    const ranked = schoolKeys().map(k => [k, schoolGapScore(k)]).sort((a, b) => b[1] - a[1]);
    if (!ranked.length || ranked[0][1] <= 0.01) return 'Both schools are at or above core operating targets';
    const weak = schoolCfg(ranked[0][0])?.shortName || ranked[0][0];
    return `${weak} carries the largest gap to operating targets`;
  }

  function renderCore(container, d, m, t) {
    const forecastTitle = m.forecast30 >= t.occupancy ? `Booked starts lift occupancy above the ${fmtPct(t.occupancy, 0)} target` : 'Booked starts improve occupancy, but the 30-day outlook remains below target';
    const selected = scope();
    const columns = ['total', ...schoolKeys()];
    const records = Object.fromEntries(columns.map(key => [key, dataFor(key)]));
    const heads = columns.map(key => {
      const label = key === 'total' ? 'Total' : schoolCfg(key)?.shortName || key;
      return `<th class="scope-head ${selected === key ? 'selected' : ''}" data-exec-scope="${key}">${label}</th>`;
    }).join('');

    const scoreRows = [
      ['Occupancy', key => percentScoreCell(metrics(records[key]).occupancy, targetsFor(key).occupancy)],
      ['30D booked', key => percentScoreCell(metrics(records[key]).forecast30, targetsFor(key).forecastOccupancy30)],
      ['Tuition run rate', key => moneyScoreCell(records[key].annualizedTuition, `${fmtMoneyK(records[key].netBilled)} in period`)],
      ['Payroll / tuition', key => percentScoreCell(metrics(records[key]).payrollPct, targetsFor(key).grossPayrollPctNetBilled, true)],
      ['Tuition less payroll', key => {
        const mm = metrics(records[key]);
        return moneyScoreCell(records[key].annualizedTuitionLessPayroll, `${fmtPct(mm.tuitionLessPayrollMargin)} margin`);
      }]
    ];
    const rows = scoreRows.map(row => `<tr><td>${row[0]}</td>${columns.map(row[1]).join('')}</tr>`).join('');

    container.insertAdjacentHTML('beforeend', `
      <section class="exec-core">
        <div class="exec-hero">
          <div class="exec-hero-head">
            <div><div class="exec-section-kicker">OCCUPANCY & FORWARD BOOK</div><h3 class="exec-section-title">${forecastTitle}</h3><div class="exec-section-meta">Actual occupancy through today; dotted line reflects booked enrollment.</div></div>
            <button class="exec-view-link" data-exec-route="enrollment">View enrollment →</button>
          </div>
          <div class="exec-chart-wrap"><svg class="exec-chart" id="execOccupancyChart" aria-label="Occupancy actual and forecast chart"></svg></div>
          <div class="exec-book">
            <div class="exec-book-item"><span>Open seats</span><strong>${fmtNum(d.openSeats)}</strong></div>
            <div class="exec-book-item"><span>Scheduled starts</span><strong>+${fmtNum(d.scheduledStarts)}</strong></div>
            <div class="exec-book-item"><span>Known departures</span><strong>−${fmtNum(d.knownDepartures)}</strong></div>
            <div class="exec-book-item accent"><span>Net booked</span><strong>${d.netScheduledAdds >= 0 ? '+' : '−'}${fmtNum(Math.abs(d.netScheduledAdds))}</strong></div>
          </div>
        </div>
        <div class="exec-scorecard">
          <div class="exec-section-kicker">SCHOOL PERFORMANCE</div>
          <h3 class="exec-section-title">${scorecardTitle()}</h3>
          <div class="exec-section-meta">Consolidated result first; operating targets shown where applicable.</div>
          <table class="exec-score-table"><thead><tr><th>Metric</th>${heads}</tr></thead><tbody>${rows}</tbody></table>
        </div>
      </section>`);
    renderOccupancyChart($('#execOccupancyChart'), d, t);
  }

  function renderAttention(container) {
    const issues = issuesFor(scope()).slice(0, 3);
    const title = issues.length ? `${issues.length} item${issues.length === 1 ? '' : 's'} warrant attention` : 'No material exceptions';
    const rows = issues.length ? issues.map(issue => `<button class="exec-attention-row" data-exec-view="${issue.view}" data-exec-issue-scope="${issue.scope}"><i class="exec-status ${issue.level}"></i><span class="exec-attention-title">${issue.title}</span><span class="exec-attention-detail">${issue.detail}</span><span class="exec-attention-arrow">→</span></button>`).join('') : '<div class="exec-no-attention">All core metrics are currently within configured operating thresholds.</div>';
    container.insertAdjacentHTML('beforeend', `<section class="exec-attention"><div class="exec-attention-head"><div><div class="exec-section-kicker">NEEDS ATTENTION</div><h3 class="exec-section-title">${title}</h3><p>Collections, admissions and other diagnostics surface here only when they cross a configured threshold.</p></div></div><div class="exec-attention-list">${rows}</div></section>`);
  }

  function renderExecutive() {
    const ceo = $('#ceoView');
    if (!ceo) return;
    const active = !ceo.hidden;
    document.body.classList.toggle('ceo-active', active);
    if (!active) return;
    const container = ensureContainer();
    const d = dataFor();
    if (!container || !d) return;
    const m = metrics(d), t = targetsFor();
    container.innerHTML = '';
    renderReadout(container, d, m);
    renderKpis(container, d, m, t);
    renderCore(container, d, m, t);
    renderAttention(container);
    bindExecutiveActions(container);
    applyChrome();
  }

  function icon(name) {
    const paths = {
      overview: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
      enrollment: '<path d="M4 18V6"/><path d="M4 18h16"/><path d="m6.5 14 4-4 3 2 5-6"/>',
      admissions: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6"/><path d="M22 11h-6"/>',
      labor: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      billing: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/><path d="M7 15h3"/>',
      portfolio: '<path d="M4 21V7l8-4 8 4v14"/><path d="M8 10h2"/><path d="M14 10h2"/><path d="M8 14h2"/><path d="M14 14h2"/><path d="M9 21v-3h6v3"/>',
      settings: '<path d="M4 7h10"/><path d="M18 7h2"/><circle cx="16" cy="7" r="2"/><path d="M4 17h2"/><path d="M10 17h10"/><circle cx="8" cy="17" r="2"/>'
    };
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.overview}</svg>`;
  }

  function replaceIcons() {
    const map = { ceo: 'overview', enrollment: 'enrollment', admissions: 'admissions', labor: 'labor', billing: 'billing', schools: 'portfolio' };
    $$('.nav-item[data-view]').forEach(item => { const i = $('.nav-icon', item); if (i) i.innerHTML = icon(map[item.dataset.view]); });
    const settings = $('#openSettings .nav-icon'); if (settings) settings.innerHTML = icon('settings');
  }

  function applyChrome() {
    const navOverview = $('.nav-item[data-view="ceo"] .nav-label'); if (navOverview) navOverview.textContent = 'Overview';
    const navPortfolio = $('.nav-item[data-view="schools"] .nav-label'); if (navPortfolio) navPortfolio.textContent = 'Portfolio';
    const refresh = $('.refresh-note'); if (refresh) refresh.innerHTML = 'Demo · updated <strong>8:02 AM</strong>';
    const footerSpans = $$('.dashboard-footer span'); if (footerSpans[1]) footerSpans[1].textContent = 'Demo environment · illustrative operating data';
    if (!$('#ceoView')?.hidden) {
      const eyebrow = $('#pageEyebrow'); if (eyebrow) eyebrow.textContent = 'LITTLE WONDERS';
      const title = $('#pageTitle'); if (title) title.textContent = 'Overview';
    }
  }

  function clickScope(targetScope) {
    const btn = $(`#scopeSelector .segment[data-scope="${targetScope}"]`);
    if (btn && !btn.classList.contains('active')) btn.click();
  }
  function clickView(view) {
    const btn = $(`.nav-item[data-view="${view}"]`);
    if (btn && !btn.classList.contains('active')) btn.click();
  }
  function routeTo(view, targetScope = scope()) {
    internalNav = true;
    clickScope(targetScope);
    clickView(view);
    queueMicrotask(() => { internalNav = false; syncHash(false); renderExecutive(); });
  }

  function bindExecutiveActions(container) {
    $$('[data-exec-scope]', container).forEach(el => el.addEventListener('click', () => routeTo('ceo', el.dataset.execScope)));
    $$('[data-exec-route]', container).forEach(el => el.addEventListener('click', () => routeTo(el.dataset.execRoute, scope())));
    $$('[data-exec-view]', container).forEach(el => el.addEventListener('click', () => routeTo(el.dataset.execView, el.dataset.execIssueScope)));
  }

  function routeState() {
    const activeView = $('.nav-item[data-view].active')?.dataset.view || 'ceo';
    const pathView = activeView === 'ceo' ? 'overview' : activeView === 'schools' ? 'portfolio' : activeView;
    return { view: pathView, school: scope(), period: period() };
  }
  function syncHash(replace = false) {
    if (applyingRoute || internalNav) return;
    const r = routeState();
    const next = `#/${r.view}?school=${encodeURIComponent(r.school)}&period=${encodeURIComponent(r.period)}`;
    if (location.hash === next) return;
    if (replace) history.replaceState(null, '', next); else history.pushState(null, '', next);
  }
  function parseHash() {
    const hash = location.hash.replace(/^#\/?/, '');
    if (!hash) return null;
    const [pathPart, queryPart = ''] = hash.split('?');
    const params = new URLSearchParams(queryPart);
    const viewMap = { overview: 'ceo', portfolio: 'schools', ceo: 'ceo' };
    return { view: viewMap[pathPart] || pathPart || 'ceo', school: params.get('school') || 'total', period: params.get('period') || cfg.app.defaultPeriod || '4w' };
  }
  function applyHashRoute() {
    const r = parseHash();
    if (!r) return;
    applyingRoute = true;
    const periodSelect = $('#periodSelect');
    if (periodSelect && [...periodSelect.options].some(o => o.value === r.period) && periodSelect.value !== r.period) {
      periodSelect.value = r.period;
      periodSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
    clickScope(r.school === 'total' || schoolCfg(r.school) ? r.school : 'total');
    if ($(`.nav-item[data-view="${r.view}"]`)) clickView(r.view); else clickView('ceo');
    queueMicrotask(() => { applyingRoute = false; renderExecutive(); applyChrome(); });
  }

  function setupListeners() {
    $('#scopeSelector')?.addEventListener('click', e => {
      if (!e.target.closest('.segment')) return;
      queueMicrotask(() => { renderExecutive(); if (!applyingRoute && !internalNav) syncHash(false); });
    });
    $('#periodSelect')?.addEventListener('change', () => queueMicrotask(() => { renderExecutive(); if (!applyingRoute && !internalNav) syncHash(false); }));
    $('.nav-list')?.addEventListener('click', e => {
      if (!e.target.closest('[data-view]')) return;
      queueMicrotask(() => { renderExecutive(); applyChrome(); if (!applyingRoute && !internalNav) syncHash(false); });
    });
    $('#brandHome')?.addEventListener('click', () => queueMicrotask(() => { renderExecutive(); syncHash(false); }));
    window.addEventListener('popstate', applyHashRoute);
  }

  replaceIcons();
  applyChrome();
  ensureContainer();
  setupListeners();
  if (location.hash) applyHashRoute();
  else { renderExecutive(); syncHash(true); }
  window.LW_EXECUTIVE = { render: renderExecutive, routeTo };
})();