/* History + report viewing extracted from index2.html (phase 6) */
/* Structural split only: keeps the existing saved-data/report behavior. */

function goBackFromReport(){ showScreen(reportBack); }

function renderHistory(){
  renderHistDashboard();
  populateHouseFilter();
  histTab==='da3' ? renderDA3Hist() : renderAuditHist();
}

function showReportTab(tab){
  const da3Wrap = document.getElementById('reportWrapDA3');
  const auditWrap = document.getElementById('reportWrapAudit');
  const da3Pill = document.getElementById('rptPillDA3');
  const auditPill = document.getElementById('rptPillAudit');
  if(da3Wrap) da3Wrap.style.display = tab==='da3' ? 'block' : 'none';
  if(auditWrap) auditWrap.style.display = tab==='audit' ? 'block' : 'none';
  if(da3Pill) da3Pill.classList.toggle('active', tab==='da3');
  if(auditPill) auditPill.classList.toggle('active', tab==='audit');
}

function viewDA3Report(visitId){
  const v=S.da3Visits.find(x=>x.id===visitId); if(!v) return;
  reportBack='historyScreen';
  document.getElementById('reportHeaderSub').textContent='DA3 Monthly Checklist';
  let html=`<div class="report-card">
    <div class="report-top da3-top">
      <div class="report-agency">Your operations, organized.</div>
      <div class="report-title">DA3 Monthly Checklist</div>
      <div class="report-subtitle">Revised: January 2023</div>
    </div>
    <div class="report-meta-grid">
      <div class="report-meta-cell"><div class="rmc-lbl">Residential Site</div><div class="rmc-val">${esc(v.houseName)}</div></div>
      <div class="report-meta-cell"><div class="rmc-lbl">Date of Visit</div><div class="rmc-val">${v.date}</div></div>
      <div class="report-meta-cell"><div class="rmc-lbl">Staff Name</div><div class="rmc-val">${esc(v.staffName||'—')}</div></div>
      <div class="report-meta-cell"><div class="rmc-lbl">Status</div><div class="rmc-val">${v.completedAt?'✓ Complete':'In Progress'}</div></div>
    </div>`;
  DA3.forEach(sec=>{
    html+=`<div class="report-sec-title">${sec.section}</div>`;
    sec.tasks.forEach(t=>{
      if(t.subItems){
        const done=t.subItems.filter(s=>v.subChecks?.[s.id]).length;
        const allDone=done===t.subItems.length;
        html+=`<div class="report-task-row">
          <div class="rts"><span class="rts-pill ${allDone?'ok':'pending'}">${allDone?'✓':'…'}</span></div>
          <div class="rti">
            <div class="rti-name">${t.title} (${done}/${t.subItems.length})</div>
            ${t.subItems.map(s=>`<div style="font-size:0.73rem;color:${v.subChecks?.[s.id]?'var(--green)':'var(--muted)'};margin-top:2px;">${v.subChecks?.[s.id]?'✓':'○'} ${s.label}</div>`).join('')}
            ${v.comments?.[t.id]?`<div class="rti-comment">${esc(v.comments[t.id])}</div>`:''}
            ${v.corrective?.[t.id]?`<div class="rti-corrective">⚠ ${esc(v.corrective[t.id])}</div>`:''}
          </div></div>`;
      } else {
        const val=v.tasks?.[t.id];
        const sc=val==='na'?'na':val?'ok':'pending';
        const lbl=val==='na'?'N/A':val?'Done':'—';
        html+=`<div class="report-task-row">
          <div class="rts"><span class="rts-pill ${sc}">${lbl}</span></div>
          <div class="rti">
            <div class="rti-name">${t.title}</div>
            ${v.comments?.[t.id]?`<div class="rti-comment">${esc(v.comments[t.id])}</div>`:''}
            ${v.corrective?.[t.id]?`<div class="rti-corrective">⚠ ${esc(v.corrective[t.id])}</div>`:''}
          </div></div>`;
      }
    });
  });
  html+=`</div>
    <button class="print-btn da3" onclick="window.print()">🖨 Print / Save as PDF</button>
    <button class="print-btn" style="background:var(--accent);margin-top:8px;" onclick="editFromReport('da3')">✏️ Edit This Report</button>`;
  document.getElementById('reportWrapDA3').innerHTML=html;
  window._reportDA3Id = visitId;
  showReportTab('da3');
  showScreen('reportScreen');
}

function viewAuditReport(auditId){
  const a=S.auditVisits.find(x=>x.id===auditId); if(!a) return;
  reportBack='historyScreen';
  document.getElementById('reportHeaderSub').textContent='Acumatica Review';
  const noCount=Object.entries(a.answers||{}).filter(([k,v])=>v==='NO'&&NO_FLAG_ITEMS.has(k)).length;
  let html=`<div class="report-card">
    <div class="report-top audit-top">
      <div class="report-agency">Your operations, organized.</div>
      <div class="report-title">Acumatica Review Checklist</div>
      <div class="report-subtitle">Monthly, Quarterly and As Needed · Revised February 2024</div>
    </div>
    <div class="report-meta-grid">
      <div class="report-meta-cell"><div class="rmc-lbl">Individual</div><div class="rmc-val">${esc(a.indivName)}</div></div>
      <div class="report-meta-cell"><div class="rmc-lbl">Review Month</div><div class="rmc-val">${mkLabel(a.reviewMonthKey||a.monthKey)}</div></div>
      <div class="report-meta-cell"><div class="rmc-lbl">Residential Site</div><div class="rmc-val">${esc(a.houseName||'—')}</div></div>
      <div class="report-meta-cell"><div class="rmc-lbl">Date</div><div class="rmc-val">${a.visitDate||a.completedAt||'—'}</div></div>
      <div class="report-meta-cell"><div class="rmc-lbl">Staff Name</div><div class="rmc-val">${esc(a.staffName||'—')}</div></div>
      <div class="report-meta-cell"><div class="rmc-lbl">Title</div><div class="rmc-val">${esc(a.staffTitle||'—')}</div></div>
    </div>
    ${noCount>0?`<div class="report-no-banner">⚠ ${noCount} flagged NO answer${noCount!==1?'s':''} — review corrective actions below</div>`:''}`;
  html+=`<div class="report-sec-title audit">Checklist Items</div>`;
  AUDIT_QS.forEach(q=>{
    const ans=a.answers[q.num]||a.answers[q.id]||'';
    const sc=ans==='YES'?'ok':ans==='NO'?'no':ans==='NA'?'na':'pending';
    const lbl=ans==='YES'?'YES':ans==='NO'?'NO':ans==='NA'?'N/A':'—';
    html+=`<div class="report-task-row">
      <div class="rts"><span class="rts-pill ${sc}">${lbl}</span></div>
      <div class="rti"><div class="rti-name"><strong>${q.num}.</strong> ${q.text}</div>`;
    if(q.subQs&&ans==='YES'){
      q.subQs.forEach(sq=>{
        const sa=a.answers[sq.num]||a.answers[sq.id]||'';
        const ssc=sa==='YES'?'ok':sa==='NO'?'no':'pending';
        const slbl=sa==='YES'?'YES':sa==='NO'?'NO':'—';
        html+=`<div style="display:flex;align-items:center;gap:6px;font-size:0.76rem;margin-top:4px;padding-left:8px;">
          <span class="rts-pill ${ssc}" style="font-size:0.6rem;padding:1px 6px;">${slbl}</span>
          <span style="color:var(--muted2);">${sq.num}. ${sq.text}</span></div>`;
        if(a.corrective?.[sq.num]||a.corrective?.[sq.id]) html+=`<div class="rti-corrective" style="margin-left:8px">⚠ ${esc(a.corrective[sq.num]||a.corrective[sq.id])}</div>`;
      });
    }
    if(a.corrective?.[q.num]||a.corrective?.[q.id]) html+=`<div class="rti-corrective">⚠ ${esc(a.corrective[q.num]||a.corrective[q.id])}</div>`;
    html+=`</div></div>`;
  });
  html+=`</div>
    <button class="print-btn audit" onclick="window.print()">🖨 Print / Save as PDF</button>
    <button class="print-btn" style="background:var(--accent);margin-top:8px;" onclick="editFromReport('audit')">✏️ Edit This Report</button>`;
  document.getElementById('reportWrapAudit').innerHTML=html;
  window._reportAuditId = auditId;
  showReportTab('audit');
  showScreen('reportScreen');
}

function editFromReport(type){
  if(type==='da3'){
    const v = S.da3Visits.find(x=>x.id===window._reportDA3Id);
    if(!v) return;
    v.sigId = null; // clear sig — will be re-signed on export
    houseSelectedMk = v.monthKey;
    openDA3(v.houseId);
  } else {
    const a = S.auditVisits.find(x=>x.id===window._reportAuditId);
    if(!a) return;
    a.sigId = null; // clear sig — will be re-signed on export
    // reviewMonthKey is the review month; filing month = review + 1
    const mk = a.reviewMonthKey || a.monthKey;
    const [y, m] = mk.split('-').map(Number);
    let fm = m, fy = y; // m is 1-indexed review month, convert to 0-indexed filing
    // filing month (0-indexed) = review month (0-indexed) + 1 = (m-1) + 1 = m
    if(m > 11){ fm = 0; fy = y + 1; } // Dec review → Jan filing next year (edge case)
    auditSelectedMonth = { month: fm, year: fy };
    openAudit(a.indivId);
  }
}
