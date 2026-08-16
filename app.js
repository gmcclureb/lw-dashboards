(() => {
  const cfg = window.LW_CONFIG;
  const demo = window.LW_DEMO_DATA;
  const state = { scope: cfg.app.defaultScope, period: cfg.app.defaultPeriod, compare: 'prior' };

  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const fmtNum = (v, d=0) => Number(v).toLocaleString(undefined,{minimumFractionDigits:d,maximumFractionDigits:d});
  const fmtPct = (v, d=1) => `${(v*100).toFixed(d)}%`;
  const fmtMoney = v => `$${Math.round(v).toLocaleString()}`;
  const fmtMoneyK = v => `$${(v/1000).toFixed(v>=100000?0:1)}k`;
  const clamp = (v,min,max) => Math.max(min,Math.min(max,v));

  function schoolData(period, key){ return demo.periods[period].scopes[key]; }

  function aggregate(period){
    const a = schoolData(period,'orono');
    const b = schoolData(period,'alpine');
    const sumSeries = (x,y) => {
      const n=Math.max(x.length,y.length); const out=[];
      for(let i=0;i<n;i++) out.push((x[i]||x[x.length-1]||0)+(y[i]||y[y.length-1]||0));
      return out;
    };
    const mergeSources={};
    [...Object.keys(a.leadSources),...Object.keys(b.leadSources)].forEach(k=>mergeSources[k]=(a.leadSources[k]||0)+(b.leadSources[k]||0));
    return {
      fte:a.fte+b.fte, capacity:a.capacity+b.capacity, netAdds:a.netAdds+b.netAdds,
      leads:a.leads+b.leads,tours:a.tours+b.tours,toursCompleted:a.toursCompleted+b.toursCompleted,enrollments:a.enrollments+b.enrollments,
      charges:a.charges+b.charges,payments:a.payments+b.payments,discounts:a.discounts+b.discounts,subsidies:a.subsidies+b.subsidies,pastDue:a.pastDue+b.pastDue,
      studentHours:a.studentHours+b.studentHours,staffHours:a.staffHours+b.staffHours,
      enrollmentSeries:sumSeries(a.enrollmentSeries,b.enrollmentSeries),forecastSeries:sumSeries(a.forecastSeries,b.forecastSeries),
      collectionsSeries:sumSeries(a.collectionsSeries,b.collectionsSeries),leadSources:mergeSources,
      classrooms:[...a.classrooms.map(x=>({...x,school:'Orono'})),...b.classrooms.map(x=>({...x,school:'Alpine'}))],
      attention:[...a.attention,...b.attention]
    };
  }

  function currentData(){ return state.scope==='total' ? aggregate(state.period) : schoolData(state.period,state.scope); }
  function metrics(data){
    const netCharges=data.charges-data.discounts;
    return {
      occupancy:data.fte/data.capacity,
      conversion:data.enrollments/data.leads,
      collection:data.payments/netCharges,
      leverage:data.studentHours/data.staffHours,
      netCharges
    };
  }

  function scopeName(scope=state.scope){
    return scope==='total'?'Little Wonders':cfg.schools[scope].name;
  }

  function renderSummary(){
    const d=currentData(), m=metrics(d);
    const cards=[
      ['FTE Enrollment',fmtNum(d.fte,0),state.scope==='total'?'+4.4 vs prior':'Current FTE','Student FTE'],
      ['Occupancy',fmtPct(m.occupancy),m.occupancy>=cfg.targets.occupancy?'Above 90% target':`${((cfg.targets.occupancy-m.occupancy)*100).toFixed(1)} pts to target`,'FTE ÷ effective capacity'],
      ['4W Net Adds',`${d.netAdds>=0?'+':''}${d.netAdds}`,demo.periods[state.period].label,'Starts less departures'],
      ['Lead → Enrollment',fmtPct(m.conversion),m.conversion>=cfg.targets.leadToEnrollment?'Above target':'Below 22% target',`${d.enrollments} enrollments / ${d.leads} leads`],
      ['Collection Rate',fmtPct(m.collection),m.collection>=cfg.targets.collectionRate?'Above target':'Below 97% target','Payments ÷ net charges'],
      ['Staff Leverage',`${m.leverage.toFixed(1)}x`,m.leverage>=cfg.targets.staffLeverage?'Above target':'Below 5.5x target','Student hrs ÷ staff hrs']
    ];
    $('#summaryCards').innerHTML=cards.map((c,i)=>{
      let cls='delta-neutral';
      if(i===1) cls=m.occupancy>=cfg.targets.occupancy?'delta-up':'delta-down';
      if(i===3) cls=m.conversion>=cfg.targets.leadToEnrollment?'delta-up':'delta-down';
      if(i===4) cls=m.collection>=cfg.targets.collectionRate?'delta-up':'delta-down';
      if(i===5) cls=m.leverage>=cfg.targets.staffLeverage?'delta-up':'delta-down';
      return `<div class="summary-card"><div class="summary-label">${c[0]}</div><div class="summary-value-row"><div class="summary-value">${c[1]}</div></div><div class="summary-delta ${cls}">${c[2]}</div><div class="summary-sub">${c[3]}</div></div>`;
    }).join('');
  }

  function renderPerformance(){
    const rows=[
      ['FTE Enrollment',x=>fmtNum(x.fte)],
      ['Effective Capacity',x=>fmtNum(x.capacity)],
      ['Occupancy',x=>fmtPct(metrics(x).occupancy)],
      ['Net Adds',x=>`${x.netAdds>=0?'+':''}${x.netAdds}`],
      ['Leads',x=>fmtNum(x.leads)],
      ['Tours Completed',x=>fmtNum(x.toursCompleted)],
      ['New Enrollments',x=>fmtNum(x.enrollments)],
      ['Lead → Enrollment',x=>fmtPct(metrics(x).conversion)],
      ['Student Hrs / Staff Hr',x=>`${metrics(x).leverage.toFixed(1)}x`],
      ['Collection Rate',x=>fmtPct(metrics(x).collection)]
    ];
    const o=schoolData(state.period,'orono'), a=schoolData(state.period,'alpine'), t=aggregate(state.period);
    $('#schoolPerformanceTable').innerHTML=`
      <thead><tr><th>Metric</th><th class="school-head" data-scope-jump="orono">Orono</th><th class="school-head" data-scope-jump="alpine">Alpine</th><th class="total-head" data-scope-jump="total">Total</th></tr></thead>
      <tbody>${rows.map((r,idx)=>`<tr><td class="${idx<3?'metric-strong':''}">${r[0]}</td><td>${r[1](o)}</td><td>${r[1](a)}</td><td class="total-cell">${r[1](t)}</td></tr>`).join('')}</tbody>`;
    $$('[data-scope-jump]').forEach(el=>el.addEventListener('click',()=>setScope(el.dataset.scopeJump)));
  }

  function svgEl(tag, attrs={}){ const el=document.createElementNS('http://www.w3.org/2000/svg',tag); Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,v)); return el; }
  function makePath(points){ return points.map((p,i)=>`${i?'L':'M'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' '); }

  function renderEnrollmentChart(){
    const d=currentData(), svg=$('#enrollmentChart');
    svg.innerHTML='';
    const W=760,H=240,pad={l:38,r:50,t:15,b:28}; svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
    const all=[...d.enrollmentSeries,...d.forecastSeries,d.capacity]; const min=Math.floor((Math.min(...all)-6)/5)*5; const max=Math.ceil((Math.max(...all)+4)/5)*5;
    const actual=d.enrollmentSeries; const forecast=[actual[actual.length-1],...d.forecastSeries.slice(1)]; const totalPoints=actual.length+forecast.length-1;
    const x=i=>pad.l+(i/(totalPoints-1))*(W-pad.l-pad.r); const y=v=>pad.t+((max-v)/(max-min))*(H-pad.t-pad.b);
    const defs=svgEl('defs'); const grad=svgEl('linearGradient',{id:'areaFade',x1:'0',x2:'0',y1:'0',y2:'1'}); grad.append(svgEl('stop',{offset:'0%','stop-color':'#769587','stop-opacity':'.18'}),svgEl('stop',{offset:'100%','stop-color':'#769587','stop-opacity':'0'})); defs.append(grad); svg.append(defs);
    for(let i=0;i<4;i++){
      const v=min+(max-min)*(i/3); const yy=y(v); svg.append(svgEl('line',{x1:pad.l,y1:yy,x2:W-pad.r,y2:yy,class:'chart-grid-line'}));
      const txt=svgEl('text',{x:pad.l-8,y:yy+3,'text-anchor':'end',class:'chart-axis-text'}); txt.textContent=Math.round(v); svg.append(txt);
    }
    const cy=y(d.capacity); svg.append(svgEl('line',{x1:pad.l,y1:cy,x2:W-pad.r,y2:cy,class:'chart-capacity-line'}));
    const ct=svgEl('text',{x:W-pad.r+7,y:cy+3,class:'chart-axis-text'}); ct.textContent=`${d.capacity} capacity`; svg.append(ct);
    const ap=actual.map((v,i)=>[x(i),y(v)]); const fp=forecast.map((v,i)=>[x(actual.length-1+i),y(v)]);
    const area=svgEl('path',{d:`${makePath(ap)} L ${ap[ap.length-1][0]} ${H-pad.b} L ${ap[0][0]} ${H-pad.b} Z`,class:'chart-area'}); svg.append(area);
    svg.append(svgEl('path',{d:makePath(ap),class:'chart-actual-line'})); svg.append(svgEl('path',{d:makePath(fp),class:'chart-forecast-line'}));
    const nowX=x(actual.length-1); svg.append(svgEl('line',{x1:nowX,y1:pad.t,x2:nowX,y2:H-pad.b,class:'chart-now'}));
    const dot=svgEl('circle',{cx:nowX,cy:y(actual[actual.length-1]),r:4.2,class:'chart-dot'}); svg.append(dot);
    const lbl=svgEl('text',{x:nowX,y:y(actual[actual.length-1])-11,'text-anchor':'middle',class:'chart-label-text'}); lbl.textContent=`${actual[actual.length-1]} FTE`; svg.append(lbl);
    const labels=['Start','','','','Now','','','Forecast'];
    [0,Math.floor((totalPoints-1)*.33),actual.length-1,totalPoints-1].forEach((idx,j)=>{ const t=svgEl('text',{x:x(idx),y:H-8,'text-anchor':j===0?'start':j===3?'end':'middle',class:'chart-axis-text'}); t.textContent=[demo.periods[state.period].label,'','Today','+ 4 wks'][j]; svg.append(t); });
    const occ=metrics(d).occupancy; $('#enrollmentTitle').textContent=occ>=cfg.targets.occupancy?'Enrollment is at or above portfolio target':'Enrollment is building toward target';
  }

  function renderFunnel(){
    const d=currentData(); const steps=[['Leads',d.leads],['Tours booked',d.tours],['Tours completed',d.toursCompleted],['Enrolled',d.enrollments]]; const max=d.leads||1;
    $('#funnel').innerHTML=steps.map((s,i)=>{
      const prev=i?steps[i-1][1]:null; const conv=prev?`${Math.round(s[1]/prev*100)}% from prior step`:'';
      return `<div class="funnel-row"><div class="funnel-label">${s[0]}</div><div class="funnel-track"><div class="funnel-fill" style="width:${Math.max(6,s[1]/max*100)}%"></div></div><div class="funnel-value">${s[1]}</div>${conv?`<div class="funnel-conversion">${conv}</div>`:''}</div>`;
    }).join('');
    const m=metrics(d); $('#admissionsChip').textContent=`${fmtPct(m.conversion)} lead → enrollment`;
    const total=Object.values(d.leadSources).reduce((x,y)=>x+y,0)||1;
    $('#leadSources').innerHTML=Object.entries(d.leadSources).map(([k,v])=>`<div class="source-mini"><strong>${Math.round(v/total*100)}%</strong><span>${k}</span></div>`).join('');
  }

  function renderBilling(){
    const d=currentData(),m=metrics(d);
    const vals=[['Net tuition billed',fmtMoneyK(m.netCharges)],['Payments collected',fmtMoneyK(d.payments)],['Discounts',fmtMoneyK(d.discounts)],['Subsidy',fmtPct(d.subsidies/Math.max(1,m.netCharges),1)],['Past due balance',fmtMoneyK(d.pastDue)],['Gross charges',fmtMoneyK(d.charges)]];
    $('#billingStats').innerHTML=vals.map(v=>`<div class="billing-stat"><span>${v[0]}</span><strong>${v[1]}</strong></div>`).join('');
    $('#collectionChip').textContent=`${fmtPct(m.collection)} collected`; $('#collectionChip').className=`metric-chip ${m.collection>=cfg.targets.collectionRate?'good':''}`;
    $('#weeklyCollectionsTotal').textContent=fmtMoney(d.collectionsSeries.reduce((x,y)=>x+y,0));
    renderSpark($('#collectionsChart'),d.collectionsSeries);
  }

  function renderSpark(svg,vals){
    svg.innerHTML=''; const W=280,H=80,p=5; svg.setAttribute('viewBox',`0 0 ${W} ${H}`); const min=Math.min(...vals)*.96,max=Math.max(...vals)*1.02; const x=i=>p+i/(Math.max(1,vals.length-1))*(W-p*2); const y=v=>p+(max-v)/(max-min||1)*(H-p*2); const pts=vals.map((v,i)=>[x(i),y(v)]);
    svg.append(svgEl('path',{d:`${makePath(pts)} L ${pts[pts.length-1][0]} ${H-p} L ${pts[0][0]} ${H-p} Z`,class:'spark-area'})); svg.append(svgEl('path',{d:makePath(pts),class:'spark-line'}));
  }

  function renderLabor(){
    const o=metrics(schoolData(state.period,'orono')).leverage,a=metrics(schoolData(state.period,'alpine')).leverage,t=metrics(aggregate(state.period)).leverage;
    const items=state.scope==='total'?[['Orono',o],['Alpine',a],['Total',t]]:[[cfg.schools[state.scope].shortName,state.scope==='orono'?o:a],['Portfolio',t]];
    $('#laborBars').innerHTML=items.map(([name,v])=>`<div class="labor-row"><div class="labor-row-label">${name}</div><div class="labor-track"><div class="labor-fill" style="width:${clamp(v/7*100,0,100)}%"></div><i class="labor-target" style="left:${cfg.targets.staffLeverage/7*100}%"></i></div><div class="labor-value">${v.toFixed(1)}x</div></div>`).join('');
    $('#laborChip').textContent=`${metrics(currentData()).leverage.toFixed(1)}x`;
  }

  function dedupeAttention(items){
    const seen=new Set(); return items.filter(x=>{ const k=x.title; if(seen.has(k))return false; seen.add(k); return true; });
  }
  function renderAttention(){
    const items=dedupeAttention(currentData().attention).slice(0,4); $('#attentionCount').textContent=`${items.length} item${items.length===1?'':'s'}`;
    $('#attentionList').innerHTML=items.map(x=>`<div class="attention-item"><div class="attention-icon ${x.level}">${x.level==='good'?'✓':x.level==='risk'?'!':'!'}</div><div class="attention-copy"><strong>${x.title}</strong><span>${x.detail}</span></div><span class="attention-action">Review →</span></div>`).join('');
  }

  function renderClassrooms(){
    const d=currentData(); const list=d.classrooms.slice().sort((a,b)=>(b.fte/b.capacity)-(a.fte/a.capacity));
    $('#classroomScope').textContent=scopeName();
    $('#classroomList').innerHTML=list.slice(0,state.scope==='total'?6:8).map(c=>{ const pct=c.fte/c.capacity; return `<div class="classroom-card"><div class="classroom-top"><strong>${c.school?`${c.school} · `:''}${c.name}</strong><span>${fmtPct(pct,0)}</span></div><div class="classroom-bar"><i style="width:${clamp(pct*100,0,100)}%"></i></div><div class="classroom-foot"><span>${c.fte} / ${c.capacity} FTE</span><span>${c.futureStarts?`+${c.futureStarts} scheduled`:c.capacity-c.fte>0?`${fmtNum(c.capacity-c.fte)} open`:'At capacity'}</span></div></div>`; }).join('');
  }

  function renderMappings(){
    $('#mappingList').innerHTML=cfg.playground.pullCatalog.map(x=>`<div class="mapping-row"><div class="mapping-row-main"><strong>${x.label}</strong><small>${x.domain} · ${x.playgroundConcepts.join(' · ')}</small></div><span class="mapping-status">${x.status}</span></div>`).join('');
  }

  function renderAll(){
    renderSummary();renderPerformance();renderEnrollmentChart();renderFunnel();renderBilling();renderLabor();renderAttention();renderClassrooms();
    $$('#scopeSelector .segment').forEach(b=>b.classList.toggle('active',b.dataset.scope===state.scope));
  }

  function setScope(scope){ state.scope=scope; renderAll(); showToast(scope==='total'?'Showing Little Wonders consolidated':`Drilled into ${cfg.schools[scope].name}`); }
  function showToast(text){ const t=$('#toast');t.textContent=text;t.classList.add('show');clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>t.classList.remove('show'),1800); }
  function openSettings(){ $('#settingsDrawer').classList.add('open');$('#drawerBackdrop').classList.add('open'); }
  function closeSettings(){ $('#settingsDrawer').classList.remove('open');$('#drawerBackdrop').classList.remove('open'); }

  $$('#scopeSelector .segment').forEach(b=>b.addEventListener('click',()=>setScope(b.dataset.scope)));
  $('#periodSelect').addEventListener('change',e=>{state.period=e.target.value;renderAll();});
  $('#compareSelect').addEventListener('change',e=>{state.compare=e.target.value;showToast(e.target.value==='target'?'Comparing KPIs to targets':'Comparing KPIs to prior period');});
  $('#openSettings').addEventListener('click',openSettings); $('#closeSettings').addEventListener('click',closeSettings); $('#drawerBackdrop').addEventListener('click',closeSettings);
  $('#collapseSidebar').addEventListener('click',()=>$('#sidebar').classList.toggle('collapsed'));
  $('#mobileMenu').addEventListener('click',()=>$('#sidebar').classList.toggle('mobile-open'));
  $$('.nav-item[data-view]').forEach(b=>b.addEventListener('click',()=>{ if(b.dataset.view!=='ceo') showToast(`${b.querySelector('.nav-label').textContent} is staged for the next dashboard module`); if(innerWidth<901)$('#sidebar').classList.remove('mobile-open'); }));
  $$('[data-detail]').forEach(b=>b.addEventListener('click',()=>showToast('Enrollment module is the next planned drill-down')));
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeSettings();});

  renderMappings();renderAll();
})();
