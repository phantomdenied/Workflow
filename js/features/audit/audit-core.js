/* Audit / ACU feature extracted from index2.html (phase 8) */
/* Structural split only: keeps the existing state, PDF export, and history behavior. */

function isAuditOverdue(){
  const now = new Date();
  return now.getDate() > 10; // past 10th = overdue for prev month audit
}

function calcAuditPct(audit){
  if(!audit) return 0;
  const answered = Object.values(audit.answers||{}).filter(v=>v==='YES'||v==='NO'||v==='NA').length;
  const total = 15;
  return Math.round((answered/total)*100);
}

function openAudit(indivId){
  const ind = S.individuals.find(i=>i.id===indivId);
  if(!ind) return;
  const house = S.houses.find(h=>h.id===ind.houseId);
  currentHouseId = ind.houseId;
  currentAuditIndivId = indivId;
  // Pre-set filing month from house screen, but only if not already set by editFromReport
  if(!auditSelectedMonth){
    const ctxMk = houseSelectedMk || mkNow();
    const [cy, cm] = ctxMk.split('-').map(Number);
    auditSelectedMonth = {month: cm - 1, year: cy};
  }
  document.getElementById('auditHeaderTitle').textContent = ind.name;
  document.getElementById('auditHeaderSub').textContent = 'Acumatica Review';
  document.getElementById('auditExportBar').classList.add('visible');
  auditBuildForm(ind, house);
  showScreen('auditScreen');
  requestAnimationFrame(()=>{
    const hdr = document.querySelector('#auditScreen .app-header');
    if(hdr) document.querySelector('#auditScreen .prog-bar')?.style.setProperty('top', hdr.offsetHeight+'px');
  });
}

function auditInitMonth(){
  if(!auditSelectedMonth){
    // Default: filing month = current month, so display = current - 1 (review month)
    const now = new Date();
    auditSelectedMonth = {month: now.getMonth(), year: now.getFullYear()};
    auditPickerYear = now.getFullYear();
  } else {
    auditPickerYear = auditSelectedMonth.year;
  }
  auditUpdateMonthDisplay();
}

function auditUpdateMonthDisplay(){
  const el = document.getElementById('ampDisplayText');
  if(!el) return;
  if(auditSelectedMonth){
    // Display is review month = selected (filing) month - 1
    let rm = auditSelectedMonth.month - 1, ry = auditSelectedMonth.year;
    if(rm < 0){ rm = 11; ry--; }
    el.textContent = AMP_MONTHS_FULL[rm] + ' ' + ry;
  }
  auditUpdateProgress();
}

function auditToggleMonthPicker(){
  const dd = document.getElementById('ampDropdown');
  if(!dd) return;
  dd.classList.toggle('open');
  if(dd.classList.contains('open')){
    auditPickerYear = auditSelectedMonth ? auditSelectedMonth.year : new Date().getFullYear();
    document.getElementById('ampYear').textContent = auditPickerYear;
    auditRenderMonthGrid();
  }
}

function auditChangeYear(dir){
  auditPickerYear += dir;
  document.getElementById('ampYear').textContent = auditPickerYear;
  auditRenderMonthGrid();
}

function auditRenderMonthGrid(){
  const grid = document.getElementById('ampGrid');
  if(!grid) return;
  const now = new Date();
  grid.innerHTML = '';
  AMP_MONTHS.forEach((m,i)=>{
    const isFuture = auditPickerYear > now.getFullYear() || (auditPickerYear === now.getFullYear() && i > now.getMonth());
    const isSel = auditSelectedMonth && auditSelectedMonth.month===i && auditSelectedMonth.year===auditPickerYear;
    const cell = document.createElement('div');
    cell.className = 'amp-cell'+(isSel?' selected':'')+(isFuture?' disabled':'');
    cell.textContent = m;
    if(!isFuture) cell.onclick = ()=>{
      auditSelectedMonth = {month:i, year:auditPickerYear};
      document.getElementById('ampDropdown').classList.remove('open');
      auditUpdateMonthDisplay();
      auditLoadExisting();
    };
    grid.appendChild(cell);
  });
}

function auditExpiryDate(storedStr){
  if(!storedStr) return null;
  const d = new Date(storedStr);
  d.setFullYear(d.getFullYear()+1);
  return d;
}

function auditDateStatus(storedStr){
  const exp = auditExpiryDate(storedStr);
  if(!exp) return {cls:'',msg:'',expired:false};
  const now = new Date();
  const days = (exp-now)/(1000*60*60*24);
  if(days<0)  return {cls:'expired', msg:'EXPIRED '+auditFmtDateDisp(exp)+' — must report', expired:true};
  if(days<60) return {cls:'warn',    msg:'Expires '+auditFmtDateDisp(exp)+' — renew soon',   expired:false};
  return {cls:'', msg:'Valid until '+auditFmtDateDisp(exp), expired:false};
}

function auditFmtDateDisp(d){
  if(!d) return '—';
  return String(d.getMonth()+1).padStart(2,'0')+'/'+String(d.getDate()).padStart(2,'0')+'/'+d.getFullYear();
}

function auditFmtDatePDF(str){
  if(!str) return '—';
  const [y,m,d] = str.split('-');
  return m+'/'+d+'/'+y;
}

function auditBuildForm(ind, house){
  auditInitMonth();

  // Per-individual profile data (with defaults)
  const pepDate  = ind.pepDate  || '';
  const mmaDate  = ind.mmaDate  || '';
  const weekly   = ind.weeklyAllowance != null ? ind.weeklyAllowance : 0;

  let html = '';

  // Completion badge
  html += `<div class="acompletion"><div class="acomp-dot" id="aCompDot"></div><span id="aCompText">0 of 15 items answered</span></div>`;

  // Header info
  html += `<div class="audit-slbl">Individual Info</div>
  <div class="ainfo-card">
    <div class="ainfo-row">
      <div class="ainfo-lbl">Individual</div>
      <input class="ainfo-input prefilled" type="text" readonly value="${esc(ind.name)}">
    </div>
    <div class="ainfo-row">
      <div class="ainfo-lbl">Review Month / Year</div>
      <div class="amp-wrap">
        <div class="amp-display" onclick="auditToggleMonthPicker()">
          <span id="ampDisplayText">—</span><span style="opacity:0.45;font-size:0.85rem;">&#9662;</span>
        </div>
        <div class="amp-dropdown" id="ampDropdown">
          <div class="amp-hdr">
            <button class="amp-nav" onclick="auditChangeYear(-1);event.stopPropagation()">&#8249;</button>
            <span class="amp-year" id="ampYear"></span>
            <button class="amp-nav" onclick="auditChangeYear(1);event.stopPropagation()">&#8250;</button>
          </div>
          <div class="amp-grid" id="ampGrid"></div>
        </div>
      </div>
    </div>
  </div>`;

  // Items 1-15
  html += `<div class="audit-slbl">Cash Management — Items 1–15</div>`;
  html += auditBuildItems(ind, house, pepDate, mmaDate, weekly);

  // Footer
  html += `<div class="audit-slbl">Completion</div>
  <div class="ainfo-card" style="overflow:visible;">
    <div style="display:flex;gap:10px;">
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px;">
        <div class="ainfo-lbl">Title</div>
        <input class="ainfo-input prefilled" type="text" readonly value="${esc(S.staffTitle||'Staff')}">
      </div>
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px;">
        <div class="ainfo-lbl">Date</div>
        <input class="ainfo-input" id="aFieldDate" type="date" value="${new Date().toISOString().slice(0,10)}">
      </div>
    </div>
  </div>
  <div class="asig-note"><strong>&#9998; Signature</strong> — Export fills all fields. Sign the downloaded PDF to complete the audit.</div>`;

  document.getElementById('auditContainer').innerHTML = html;
  // Add enterkeyhint=done + blur-on-Escape to all textareas in audit form
  setTimeout(()=>{
    document.querySelectorAll('#auditContainer textarea, #auditContainer input[type=text], #auditContainer input[type=date], #auditContainer input[type=number]').forEach(el=>{
      if(el.tagName==='TEXTAREA'){
        el.setAttribute('enterkeyhint','done');
        el.addEventListener('keydown', e=>{
          // Cmd/Ctrl+Enter or toolbar Done (which fires as a blur, not keydown) — handled by blur
          // We only want to close keyboard on the iOS toolbar Done button, NOT regular Enter
          // iOS Done button triggers blur naturally; nothing extra needed
        });
      } else {
        el.setAttribute('enterkeyhint','done');
        el.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); el.blur(); }});
      }
    });
  }, 50);
  auditUpdateMonthDisplay();
  auditRenderMonthGrid();

  // Pre-fill auto fields
  auditPrefillAuto(ind.name, pepDate, mmaDate, weekly);

  // Close month picker on outside click
  document.getElementById('auditContainer').addEventListener('click', e=>{
    const wrap = document.querySelector('.amp-wrap');
    if(wrap && !wrap.contains(e.target)) document.getElementById('ampDropdown')?.classList.remove('open');
  });

  auditUpdateProgress();

  // Load existing saved record into form if one exists for this month
  auditLoadExisting();
}

function auditLoadExisting(){
  if(!auditSelectedMonth || !currentAuditIndivId) return;
  const _d = new Date(auditSelectedMonth.year, auditSelectedMonth.month, 1);
  const mk = _d.getFullYear()+'-'+String(_d.getMonth()+1).padStart(2,'0');
  const rec = S.auditVisits.find(v=>v.indivId===currentAuditIndivId && v.monthKey===mk);
  if(!rec) return;

  // Cash fields
  const ohEl = document.getElementById('aOnHand');
  const iaEl = document.getElementById('aInAcu');
  if(ohEl && rec.onHand) ohEl.value = rec.onHand;
  if(iaEl && rec.inAcu)  iaEl.value = rec.inAcu;
  if(ohEl && iaEl) auditCashInput();

  // Receipt
  const rnEl = document.getElementById('aReceiptNum');
  const rvEl = document.getElementById('aReceiptVen');
  if(rnEl && rec.receiptNum) rnEl.value = rec.receiptNum;
  if(rvEl && rec.receiptVen) rvEl.value = rec.receiptVen;
  if(rnEl || rvEl) auditSyncReceipt();

  // Date
  const dtEl = document.getElementById('aFieldDate');
  if(dtEl && rec.visitDate) dtEl.value = rec.visitDate;

  // Answers — set each one (this also populates corrective visibility)
  const ans = rec.answers || {};
  Object.entries(ans).forEach(([k,v])=>{
    if(v) auditSetAns(isNaN(k) ? k : Number(k), v);
  });

  // Corrective text — overwrite after auditSetAns (which may have set defaults)
  const corr = rec.corrective || {};
  Object.entries(corr).forEach(([k,v])=>{
    const el = document.getElementById('aCorrText'+k);
    if(el && v) el.value = v;
  });
  // Also handle mismatch reason
  const mmEl = document.getElementById('aMismatchReason');
  if(mmEl && rec.mismatch) mmEl.value = rec.mismatch;
}

function auditBuildItems(ind, house, pepDate, mmaDate, weekly){
  const ITEMS = [
    {num:1,  yesId:'YESRow1',  noId:'NORow1',  corrId:'Corrective Action Taken1 Cash on hand equals cash in safe total listed in Acumatica',
     text:'Cash on hand equals cash in safe total listed in Acumatica.', special:'cash'},
    {num:2,  yesId:'YESRow2',  noId:'NORow2',  corrId:'Corrective Action Taken2 PEP  MMA are current within 1 year and attached to the header section in Acumatica',
     text:'PEP & MMA are current (within 1 year) and attached to the header section in Acumatica.', special:'pepMma'},
    {num:3,  yesId:'YESRow3',  noId:'NORow3',  corrId:'Corrective Action Taken3 Spending money distributed matches amount allowable per MMA',
     text:'Spending money distributed matches amount allowable per MMA.', special:'weekly'},
    {num:4,  yesId:'YESRow4',  noId:'NORow4',  corrId:'Corrective Action Taken4 Money removed from safe is used within 72 hours',
     text:'Money removed from safe is used within 72 hours.'},
    {num:5,  yesId:'YESRow5',  noId:'NORow5',  corrId:'Corrective Action Taken5 Acumatica has been updated at least weekly',
     text:'Acumatica has been updated at least weekly.'},
    {num:6,  yesId:'YESRow6',  noId:'NORow6',  corrId:'Corrective Action Taken6 Individuals cash in safe balance has NOT been over the maximum of 269 for longer than 14 days',
     text:"Individual's cash in safe balance has NOT been over the maximum of $283 for longer than 14 days.", special:'max283'},
    {num:7,  yesId:'YESRow7',  noId:'NORow7',  corrId:'Corrective Action Taken7 All checks received by house staff have been entered into Acumatica regardless of if they have been cashed or forwarded to another location',
     text:'All checks received by house staff have been entered into Acumatica, regardless of if they have been cashed or forwarded to another location.'},
    {num:8,  yesId:'YESRow8',  noId:'NORow8',  corrId:'Corrective Action Taken8 All receipts have two signatures shopper  verifier',
     text:'All receipts have two signatures (shopper &amp; verifier).', special:'receipt8'},
    {num:9,  yesId:'YESRow9',  noId:'NORow9',  corrId:'Corrective Action Taken9 All receipts are appropriate numbered scanned and electronically attached to the transaction line in Acumatica and original receipts are attached to the receipt sheets',
     text:'All receipts are appropriately numbered, scanned, and electronically attached to the transaction line in Acumatica, and original receipts are attached to the receipt sheets.', special:'receipt9'},
    {num:10, yesId:'YESRow10', noId:'NORow10', corrId:'Corrective Action Taken10 Confirm the appropriate payment method has been used cash not employees personal credit card and there is no evidence of pledging See notes below on pledging',
     text:"Confirm the appropriate payment method has been used (cash, not employee's personal credit card) and there is no evidence of pledging.", note:'*See notes below on pledging.'},
    {num:11, yesId:'YESRow11', noId:'NORow11', corrId:'Corrective Action Taken11 Check if any rewardspoints were earned example Kohls Old Navy If yes confirm receipts verifying redemption or unused rewards are present',
     text:"Check if any rewards/points were earned (example: Kohl's, Old Navy). If yes, confirm receipts verifying redemption or unused rewards are present.", corrOnYes:true},
    {num:12, yesId:'YESRow12', noId:'NORow12', corrId:'Corrective Action Taken12 All funds issued to staff have been signed for on the Withdrawal Ledger',
     text:'All funds issued to staff have been signed for on the Withdrawal Ledger.'},
    {num:13, yesId:'YESRow13', noId:'NORow13', corrId:'13 If capable individuals have signed for weekly spending on the Withdrawal Ledger',
     text:'If capable, individuals have signed for weekly spending on the Withdrawal Ledger.', hasNA:true},
    {num:14, yesId:'YESRow14', noId:'NORow14', corrId:'14 If required purchases have been added to the Personal Property Record in Acumatica',
     text:'If required, purchases have been added to the Personal Property Record in Acumatica.'},
    {num:15, yesId:'YESRow15', noId:'NORow15', corrId:null,
     text:'Does the individual have any outside bank accounts? If yes, answer the following questions:',
     subs:[
       {label:'a. Confirm only the individual\'s name appears on the account.', id:'A'},
       {label:'b. Is a separate ledger maintained for saving accounts?', id:'B'},
       {label:'c. Reviewed the outside bank account balance to ensure that person\'s total resources stay below allowable limits so there is no loss in benefits.', id:'C'},
       {label:'d. Were any withdrawals made from the bank account during the month under review?', id:'D'},
       {label:'e. Were funds properly accounted for by receipts?', id:'E'},
     ]}
  ];
  window._auditItems = ITEMS;
  window._auditAnswers = {};

  let html = '';
  ITEMS.forEach(item=>{
    html += `<div class="acard" id="acard${item.num}">`;
    html += `<div class="aitem-num">ITEM ${item.num} OF 15</div>`;
    html += `<div class="aitem-text">${item.text}</div>`;
    if(item.note) html += `<span class="anote-tag">${item.note}</span>`;

    html += `<div class="ayn-row">
      <button class="ayn-btn ayes" id="ayes${item.num}" onclick="auditSetAns(${item.num},'YES')">&#10003; YES</button>
      <button class="ayn-btn ano"  id="ano${item.num}"  onclick="auditSetAns(${item.num},'NO')">&#10007; NO</button>
      ${item.hasNA ? `<button class="ayn-btn ana" id="ana${item.num}" onclick="auditSetAns(${item.num},'NA')">&#8212; N/A</button>` : ''}
    </div>`;

    if(item.special==='cash'){
      html += `<div class="acurrency-row">
        <div class="acurrency-field"><span class="acurrency-lbl">On Hand</span>
          <input class="acurrency-input" id="aOnHand" inputmode="decimal" type="number" step="0.01" min="0" placeholder="0.00" oninput="auditCashInput()" onblur="auditFmtCurrency(this)"></div>
        <div class="acurrency-field"><span class="acurrency-lbl">In Acumatica</span>
          <input class="acurrency-input" id="aInAcu" inputmode="decimal" type="number" step="0.01" min="0" placeholder="0.00" oninput="auditCashInput()" onblur="auditFmtCurrency(this)"></div>
      </div>
      <div class="amismatch" id="aMismatch">
        <div class="acorr-lbl orange" style="margin-top:10px;">&#9888; AMOUNTS DO NOT MATCH — NOTE REASON</div>
        <textarea class="acorr-ta ob" id="aMismatchReason" placeholder="Explain the discrepancy…" rows="2"></textarea>
      </div>`;
    }

    if(item.special==='pepMma'){
      const ps = auditDateStatus(pepDate);
      const ms = auditDateStatus(mmaDate);
      html += `<div class="adate-row">
        <div class="adate-field">
          <div class="adate-lbl">PEP Date</div>
          <input class="adate-input" id="aPepDate" type="date" value="${pepDate}" onchange="auditPepMmaChange()">
          <div class="aexpiry-warn ${ps.cls}" id="aPepWarn">${ps.msg}</div>
        </div>
        <div class="adate-field">
          <div class="adate-lbl">MMA Date</div>
          <input class="adate-input" id="aMmaDate" type="date" value="${mmaDate}" onchange="auditPepMmaChange()">
          <div class="aexpiry-warn ${ms.cls}" id="aMmaWarn">${ms.msg}</div>
        </div>
      </div>
      <div class="acorr show">
        <div class="acorr-lbl blue" style="margin-top:10px;">NOTES FOR PDF</div>
        <textarea class="acorr-ta bb" id="aCorrText2" rows="3"></textarea>
      </div>`;
    }

    if(item.special==='weekly'){
      html += `<div class="acorr show">
        <div class="acorr-lbl blue" style="margin-top:10px;">AUTO-FILLED IN PDF</div>
        <textarea class="acorr-ta bb" id="aCorrText3" rows="2"></textarea>
      </div>`;
    }

    if(item.special==='max283'){
      html += `<div class="acorr show">
        <div class="acorr-lbl blue" style="margin-top:10px;">AUTO-FILLED IN PDF</div>
        <div class="aautofill">*Maximum $283.00</div>
      </div>
      <div class="acorr" id="acorr6">
        <div class="acorr-lbl orange" style="margin-top:10px;">&#9888; CORRECTIVE ACTION TAKEN</div>
        <textarea class="acorr-ta ob" id="aCorrText6" placeholder="Describe corrective action taken…" rows="2"></textarea>
      </div>`;
    }

    if(item.special==='receipt8'){
      html += `<div class="acorr show">
        <div class="acorr-lbl blue" style="margin-top:10px;">RECEIPT REFERENCE (ALSO USED FOR ITEM 9)</div>
        <div style="display:flex;gap:8px;margin-top:4px;">
          <div style="flex:0 0 90px;">
            <div style="font-size:0.67rem;color:var(--muted);font-family:'DM Mono',monospace;margin-bottom:3px;">#</div>
            <input class="ainfo-input" id="aReceiptNum" inputmode="numeric" type="text" placeholder="42" style="text-align:center;font-size:1rem;font-weight:700;" oninput="auditSyncReceipt()">
          </div>
          <div style="flex:1;">
            <div style="font-size:0.67rem;color:var(--muted);font-family:'DM Mono',monospace;margin-bottom:3px;">VEN</div>
            <input class="ainfo-input" id="aReceiptVen" type="text" placeholder="Walmart" oninput="auditSyncReceipt()">
          </div>
        </div>
      </div>`;
    }

    if(item.special==='receipt9'){
      html += `<div class="acorr show">
        <div class="acorr-lbl blue" style="margin-top:10px;">RECEIPT REFERENCE (FROM ITEM 8)</div>
        <div class="aautofill" id="aReceiptPreview">Enter receipt ref in Item 8</div>
      </div>`;
    }

    if(!item.special && item.corrId){
      const onYes = !!item.corrOnYes;
      html += `<div class="acorr" id="acorr${item.num}">
        <div class="acorr-lbl ${onYes?'green':'orange'}" style="margin-top:10px;">${onYes?'&#10003; NOTE REWARDS DETAILS':'&#9888; CORRECTIVE ACTION TAKEN'}</div>
        <textarea class="acorr-ta ${onYes?'gb':'ob'}" id="aCorrText${item.num}" placeholder="${onYes?'Note which rewards and what action was taken…':'Describe corrective action taken…'}" rows="2"></textarea>
      </div>`;
    }

    if(item.subs){
      html += `<div class="asub-items" id="asubs${item.num}" style="display:none;">`;
      item.subs.forEach(s=>{
        html += `<div class="asub-item"><div class="asub-lbl">${s.label}</div><input class="asub-input" id="aSub_${s.id}" placeholder="Answer…"></div>`;
      });
      html += `</div>`;
    }

    html += `</div>`;
  });
  return html;
}

function auditPrefillAuto(name, pepDate, mmaDate, weekly){
  auditPepMmaChange();
  const t3 = document.getElementById('aCorrText3');
  if(t3) t3.value = name+' can handle up to $'+Number(weekly).toFixed(2)+' weekly.';
}

function auditFmtCurrency(el){ const v=parseFloat(el.value); if(!isNaN(v)) el.value=v.toFixed(2); }

function auditCashInput(){
  const oh=document.getElementById('aOnHand')?.value.trim();
  const ia=document.getElementById('aInAcu')?.value.trim();
  if(!oh||!ia) return;
  const ohV=parseFloat(oh), iaV=parseFloat(ia);
  if(isNaN(ohV)||isNaN(iaV)) return;
  const match = Math.abs(ohV-iaV)<0.001;
  document.getElementById('aMismatch')?.classList.toggle('show',!match);
  auditSetAns(1, match?'YES':'NO');
}

function auditPepMmaChange(){
  const pepEl=document.getElementById('aPepDate');
  const mmaEl=document.getElementById('aMmaDate');
  if(!pepEl||!mmaEl) return;
  const ps=auditDateStatus(pepEl.value);
  const ms=auditDateStatus(mmaEl.value);
  const pw=document.getElementById('aPepWarn');
  const mw=document.getElementById('aMmaWarn');
  if(pw){pw.className='aexpiry-warn '+ps.cls;pw.textContent=ps.msg;}
  if(mw){mw.className='aexpiry-warn '+ms.cls;mw.textContent=ms.msg;}
  const anyExpired=ps.expired||ms.expired;
  auditSetAns(2, anyExpired?'NO':'YES');
  const t2=document.getElementById('aCorrText2');
  if(!t2) return;
  let note='PEP Date - '+auditFmtDatePDF(pepEl.value)+'\nMMA Date - '+auditFmtDatePDF(mmaEl.value);
  if(anyExpired) note+='\n*Reported to Money Manager and ResHab';
  t2.value=note;
}

function auditSyncReceipt(){
  const num_=document.getElementById('aReceiptNum')?.value.trim()||'';
  const ven_=document.getElementById('aReceiptVen')?.value.trim()||'';
  const ref=(num_||ven_) ? ('# '+num_+' '+ven_).trim() : '';
  const p=document.getElementById('aReceiptPreview');
  if(p) p.textContent = ref||'Enter receipt ref in Item 8';
}

function auditSetAns(num, val){
  if(!window._auditAnswers) window._auditAnswers={};
  window._auditAnswers[num]=val;
  const items=window._auditItems||[];
  const item=items.find(i=>i.num===num);
  const card=document.getElementById('acard'+num);
  if(!card) return;
  card.className='acard answered-'+val.toLowerCase();
  card.classList.remove('aerror');
  document.getElementById('ayes'+num)?.classList.toggle('active',val==='YES');
  document.getElementById('ano'+num)?.classList.toggle('active',val==='NO');
  document.getElementById('ana'+num)?.classList.toggle('active',val==='NA');

  if(item && !item.special){
    const cw=document.getElementById('acorr'+num);
    if(cw){ const show=item.corrOnYes?val==='YES':val==='NO'; cw.classList.toggle('show',show); }
  }
  if(item?.special==='max283'){
    document.getElementById('acorr6')?.classList.toggle('show',val==='NO');
  }
  if(val==='NA'){
    const t=document.getElementById('aCorrText'+num); if(t) t.value='Not Applicable';
  } else {
    const t=document.getElementById('aCorrText'+num); if(t&&t.value==='Not Applicable') t.value='';
  }
  const subs=document.getElementById('asubs'+num);
  if(subs) subs.style.display=val==='YES'?'flex':'none';

  // Auto N/A item 13 if individual holds $0 (weekly allowance = 0)
  if(num===3){
    const ind=S.individuals.find(i=>i.id===currentAuditIndivId);
    const weekly=ind?.weeklyAllowance!=null?parseFloat(ind.weeklyAllowance):null;
    if(weekly===0){
      if(!window._auditAnswers['13']){
        auditSetAns('13','NA');
        toast('Item 13 auto-set to N/A — $0 weekly allowance');
      }
    }
  }

  auditUpdateProgress();

  // Scroll to next unanswered on YES, NO, and NA
  // For NO: wait a little longer so corrective action box animates in first
  if(num!==1&&num!==2){
    const _items=window._auditItems||[];
    const _next=_items.find(i=>i.num>num&&!window._auditAnswers[i.num]);
    if(_next){
      const delay = val==='NO' ? 450 : 280;
      setTimeout(()=>document.getElementById('acard'+_next.num)?.scrollIntoView({behavior:'smooth',block:'center'}),delay);
    }
  }
}

function auditUpdateProgress(){
  const items=window._auditItems||[];
  const ans=window._auditAnswers||{};
  const answered=items.filter(i=>ans[i.num]).length;
  document.getElementById('auditProgFill').style.width=(answered/15*100)+'%';
  const dot=document.getElementById('aCompDot');
  const txt=document.getElementById('aCompText');
  if(dot) dot.className='acomp-dot'+(answered===15?' done':'');
  if(txt) txt.textContent=answered+' of 15 items answered';
}

function auditValidate(){
  const ans=window._auditAnswers||{};
  const items=window._auditItems||[];
  if(!auditSelectedMonth) return [{msg:'Please select a Review Month/Year',elId:'ampDisplayText'}];
  const errs=[];
  items.forEach(item=>{
    if(!ans[item.num]) errs.push({msg:'Item '+item.num+' not answered',elId:'acard'+item.num});
  });
  if(ans[1]){
    const oh=document.getElementById('aOnHand')?.value;
    const ia=document.getElementById('aInAcu')?.value;
    if(!oh||!ia) errs.push({msg:'Enter both cash amounts for Item 1',elId:'acard1'});
  }
  const rn=document.getElementById('aReceiptNum')?.value.trim()||'';
  const rv=document.getElementById('aReceiptVen')?.value.trim()||'';
  if(!rn) errs.push({msg:'Enter receipt # for Item 8',elId:'acard8'});
  if(!rv) errs.push({msg:'Enter vendor name for Item 8',elId:'acard8'});
  return errs;
}

function auditClearConfirm(){
  if(!confirm('Clear all answers and start over?')) return;
  window._auditAnswers={};
  const ind=S.individuals.find(i=>i.id===currentAuditIndivId);
  const house=S.houses.find(h=>h.id===ind?.houseId);
  if(ind) auditBuildForm(ind,house);
}

function auditSaveProfileData(){
  const ind=S.individuals.find(i=>i.id===currentAuditIndivId);
  if(!ind) return;
  const pepEl=document.getElementById('aPepDate');
  const mmaEl=document.getElementById('aMmaDate');
  const t3=document.getElementById('aCorrText3');
  if(pepEl) ind.pepDate=pepEl.value;
  if(mmaEl) ind.mmaDate=mmaEl.value;
  // Parse weekly allowance from the corrText3 field if user changed it
  if(t3){
    const match=t3.value.match(/\$([0-9]+(?:\.[0-9]{1,2})?)/);
    if(match) ind.weeklyAllowance=parseFloat(match[1]);
  }
  saveS();
}

function auditSaveOnly(){
  const btn = document.getElementById('auditSaveBtnMain');
  const txtEl = document.getElementById('auditSaveBtnText');
  auditSaveProfileData();

  const ind = S.individuals.find(i=>i.id===currentAuditIndivId);
  const house = S.houses.find(h=>h.id===ind?.houseId);

  // Selected month IS the filing month; review month = selected - 1
  // e.g. March selected → files under March, reviews February
  const _rm = auditSelectedMonth;
  const _rmDate = _rm ? new Date(_rm.year, _rm.month, 1) : new Date();
  const auditMk = _rmDate.getFullYear()+'-'+String(_rmDate.getMonth()+1).padStart(2,'0');

  let auditRecord = S.auditVisits.find(v=>v.indivId===currentAuditIndivId && v.monthKey===auditMk);
  if(!auditRecord){
    auditRecord = {
      id:uid(), indivId:currentAuditIndivId, indivName:ind?.name||'',
      houseId:ind?.houseId||'', houseName:house?.name||'',
      monthKey:auditMk, completedAt:null
    };
    S.auditVisits.push(auditRecord);
  }

  auditRecord.savedAt = today();
  auditRecord.completedAt = today();
  auditRecord.answers = {...(window._auditAnswers||{})};
  auditRecord.visitDate = document.getElementById('aFieldDate')?.value||'';
  // Save review month for correct PDF label (separate from monthKey which is +1)
  if(auditSelectedMonth){
    let rm = auditSelectedMonth.month - 1, ry = auditSelectedMonth.year;
    if(rm < 0){ rm = 11; ry--; }
    auditRecord.reviewMonthKey = `${ry}-${String(rm+1).padStart(2,'0')}`;
  }
  // Save corrective text fields
  auditRecord.corrective = {};
  document.querySelectorAll('#auditContainer [id^="aCorrText"]').forEach(el=>{
    const num = el.id.replace('aCorrText','');
    auditRecord.corrective[num] = el.value||'';
  });
  // Save special field values for re-export reconstruction
  auditRecord.onHand = document.getElementById('aOnHand')?.value||'';
  auditRecord.inAcu  = document.getElementById('aInAcu')?.value||'';
  auditRecord.mismatch = document.getElementById('aMismatchReason')?.value||'';
  auditRecord.receiptNum = document.getElementById('aReceiptNum')?.value||'';
  auditRecord.receiptVen = document.getElementById('aReceiptVen')?.value||'';

  saveS();
  if(txtEl) txtEl.textContent = '✓ Saved!';
  toast('✓ Audit saved to '+mkLabel(auditMk));
  document.getElementById('auditHeaderSub').textContent = '💾 Saved';
  setTimeout(()=>{ if(txtEl) txtEl.textContent = '💾 Save'; if(btn) btn.disabled=false; }, 2000);
}

async function auditExportPDF(){
  const errs=auditValidate();
  if(errs.length>0){
    const first=errs[0];
    toast('⚠ '+first.msg);
    const el=document.getElementById(first.elId);
    if(el){
      el.classList.add('aerror');
      el.scrollIntoView({behavior:'smooth',block:'center'});
      setTimeout(()=>el.classList.remove('aerror'),2500);
    }
    return;
  }

  // Save any changed profile fields back to the database
  auditSaveProfileData();

  const btn=document.getElementById('auditExpBtnMain');
  btn.disabled=true;
  document.getElementById('auditExpBtnText').innerHTML='<span class="aspinner"></span> Building…';

  try {
    const ind=S.individuals.find(i=>i.id===currentAuditIndivId);
    const house=S.houses.find(h=>h.id===ind?.houseId);
    const individual=ind?.name||'';
    const houseCode=(house?.name||'??').substring(0,2).toUpperCase();
    let _reviewMonth = auditSelectedMonth ? auditSelectedMonth.month - 1 : (new Date().getMonth()-1);
    let _reviewYear = auditSelectedMonth ? auditSelectedMonth.year : new Date().getFullYear();
    if(_reviewMonth < 0){ _reviewMonth = 11; _reviewYear--; }
    const monthYear=AMP_MONTHS_FULL[_reviewMonth]+' '+_reviewYear;
    const onHand=parseFloat(document.getElementById('aOnHand')?.value||0).toFixed(2);
    const inAcu=parseFloat(document.getElementById('aInAcu')?.value||0).toFixed(2);
    const mismatch=document.getElementById('aMismatchReason')?.value||'';
    const _rn=document.getElementById('aReceiptNum')?.value.trim()||'';
    const _rv=document.getElementById('aReceiptVen')?.value.trim()||'';
    const receiptRef=(_rn||_rv)?('# '+_rn+' '+_rv).trim():'';
    const cashNote='On Hand- $'+onHand+'\nIn Acumatica- $'+inAcu+(mismatch?'\n'+mismatch:'');
    const ans=window._auditAnswers||{};
    const items=window._auditItems||[];

    const fieldMap={};
    const add=(id,val)=>fieldMap[id]=val;
    add('Individual',individual);
    add('Review Month_Year',monthYear);
    add('Title','DA3');
    add('Date',document.getElementById('aFieldDate')?.value||'');

    items.forEach(item=>{
      const a=ans[item.num]||ans[String(item.num)]||'';
      add(item.yesId,a==='YES'?'X':'');
      add(item.noId, a==='NO'?'X':'');
      if(!item.corrId) return;
      let ct='';
      if(item.special==='cash') ct=cashNote;
      else if(item.special==='pepMma') ct=document.getElementById('aCorrText2')?.value||'';
      else if(item.special==='weekly') ct=document.getElementById('aCorrText3')?.value||'';
      else if(item.special==='max283'){
        ct='*Maximum $283.00';
        if(a==='NO') ct+='\n'+(document.getElementById('aCorrText6')?.value||'');
      }
      else if(item.special==='receipt8'||item.special==='receipt9') ct=receiptRef;
      else ct=document.getElementById('aCorrText'+item.num)?.value||'';
      add(item.corrId,ct);
    });
    ['A','B','C','D','E'].forEach(k=>add(k,document.getElementById('aSub_'+k)?.value||''));

    // Fetch and fill the PDF
    const pdfBytes=await fetch('BlankACU_fixed.pdf').then(r=>{if(!r.ok)throw new Error('BlankACU.pdf not found');return r.arrayBuffer();});
    const pdfDoc=await PDFLib.PDFDocument.load(pdfBytes);
    const form=pdfDoc.getForm();

    // Force font size 9 by writing /DA directly — bypasses PDF-lib font lookup
    function forceFontSize9(field){
      try{
        const daName = PDFLib.PDFName.of('DA');
        const existing = field.acroField.dict.get(daName);
        let daStr = existing ? existing.decodeText() : '/Helv 9 Tf 0 g';
        daStr = daStr.replace(/(\/[A-Za-z]+\s+)[\d.]+(\s+Tf)/, '$19$2');
        field.acroField.dict.set(daName, PDFLib.PDFString.of(daStr));
      }catch(e){}
    }
    for(const [fid,val] of Object.entries(fieldMap)){
      try{ const tf=form.getTextField(fid); tf.setText(val||''); forceFontSize9(tf); }catch(e){}
    }
    form.flatten();
    // Audit signature field Signature4 on page 1: rect [129.325, 249.267, 398.756, 281.267]
    const auditSigId = await stampSignatureOnPDFById(pdfDoc, 1, [129.325, 249.267, 398.756, 281.267], null);
    const filled=await pdfDoc.save();

    // Build filename: HouseCode FirstInitial LastName MM YY Acumatica Audit
    const parts=individual.trim().split(' ');
    const fi=parts[0]?.[0]||'';
    const ln=parts[parts.length-1]||'';
    // Filename uses review month (filing month - 1)
    let _rnm = auditSelectedMonth.month - 1, _rny = auditSelectedMonth.year;
    if(_rnm < 0){ _rnm = 11; _rny--; }
    const mm=String(_rnm+1).padStart(2,'0');
    const yy=String(_rny).slice(-2);
    const filename=`${houseCode} ${fi} ${ln} ${mm} ${yy} Acumatica Audit.pdf`;
    pdfDoc.setTitle(filename);

    await downloadFile(filled, filename, 'application/pdf');

    document.getElementById('auditExpBtnText').textContent='✓ Downloaded!';
    toast(/iPhone|iPad|iPod/i.test(navigator.userAgent)
      ? '✓ PDF opened — tap Share ⬆ to save'
      : '✓ PDF saved: '+filename);

    // Selected month IS the filing month; review month = selected - 1
    const _rm = auditSelectedMonth;
    const _rmDate = _rm ? new Date(_rm.year, _rm.month, 1) : new Date();
    const auditMk = _rmDate.getFullYear()+'-'+String(_rmDate.getMonth()+1).padStart(2,'0');
    let auditRecord = S.auditVisits.find(v=>v.indivId===currentAuditIndivId && v.monthKey===auditMk);
    if(!auditRecord){
      auditRecord = {id:uid(), indivId:currentAuditIndivId, indivName:ind?.name||'', houseId:ind?.houseId||'', houseName:house?.name||'', monthKey:auditMk, completedAt:null};
      S.auditVisits.push(auditRecord);
    }
    auditRecord.completedAt = today();
    if(auditSigId) auditRecord.sigId = auditSigId;
    // Save answers and corrective for re-export
    auditRecord.answers = {...(window._auditAnswers||{})};
    auditRecord.visitDate = document.getElementById('aFieldDate')?.value||'';
    if(auditSelectedMonth){
      let rm = auditSelectedMonth.month - 1, ry = auditSelectedMonth.year;
      if(rm < 0){ rm = 11; ry--; }
      auditRecord.reviewMonthKey = `${ry}-${String(rm+1).padStart(2,'0')}`;
    }
    // Save corrective texts for re-export
    auditRecord.corrective = {};
    document.querySelectorAll('#auditContainer [id^="aCorrText"]').forEach(el=>{
      const num = el.id.replace('aCorrText','');
      auditRecord.corrective[num] = el.value||'';
    });
    auditRecord.onHand = document.getElementById('aOnHand')?.value||'';
    auditRecord.inAcu  = document.getElementById('aInAcu')?.value||'';
    auditRecord.mismatch = document.getElementById('aMismatchReason')?.value||'';
    auditRecord.receiptNum = document.getElementById('aReceiptNum')?.value||'';
    auditRecord.receiptVen = document.getElementById('aReceiptVen')?.value||'';
    saveS();
    document.getElementById('auditHeaderSub').textContent = '✓ Completed';

    setTimeout(()=>{btn.disabled=false;document.getElementById('auditExpBtnText').textContent='Export Filled PDF';},2500);

  } catch(e){
    console.error(e);
    toast('Export error: '+e.message);
    btn.disabled=false;
    document.getElementById('auditExpBtnText').textContent='Export Filled PDF';
  }
}

function renderAuditHist(){
  const el=document.getElementById('histContent');
  const filterHouse = document.getElementById('histHouseFilter')?.value||'';
  const mk = histSelectedMk || mkNow();
  // Filter by monthKey (filing month = review month + 1, e.g. Feb audit files under March)
  let vs=S.auditVisits.filter(v=>v.monthKey===mk);
  if(filterHouse) vs=vs.filter(v=>v.houseId===filterHouse);
  let html='';
  if(vs.length){
    vs.forEach(a=>{
      const noCount=Object.values(a.answers||{}).filter(v=>v==='NO').length;
      const saved=a.completedAt||a.savedAt;
      const badge=a.completedAt?'✓ Exported':'💾 Saved';
      const badgeCls=a.completedAt?'':'has-no';
      html+=`<div class="history-item" onclick="viewAuditReport('${a.id}')">
        <div class="history-info">
          <div class="history-house">${esc(a.indivName)}</div>
          <div class="history-date">${esc(a.houseName)} · ${a.visitDate||''}</div>
        </div>
        <div class="history-score ${badgeCls}" style="font-size:0.65rem;">${noCount>0?noCount+' NO':badge}</div>
        <button class="view-btn" onclick="event.stopPropagation();viewAuditReport('${a.id}')">View</button>
        <button class="hist-export-btn" onclick="event.stopPropagation();reExportAudit('${a.id}')" title="Re-export PDF">⬇</button>
        <button class="hist-del-btn" onclick="event.stopPropagation();histDeleteAudit('${a.id}')" title="Delete">✕</button>
      </div>`;
    });
  }
  el.innerHTML=html||`<div class="empty-hist"><span class="icon">💰</span>No money audits for ${mkLabel(mk)}.</div>`;
}

function histDeleteAudit(id){
  if(!confirm('Delete this audit record?')) return;
  S.auditVisits = S.auditVisits.filter(v=>v.id!==id);
  saveS(); renderHistory();
}

async function reExportAudit(auditId){
  const a = S.auditVisits.find(x=>x.id===auditId); if(!a) return;
  if(!a.answers){ toast('No answer data saved — open the audit and save first'); return; }
  toast('Building PDF…');
  try{
    const pdf = await buildAuditPDFBytes(a);
    if(!pdf){ toast('Could not build PDF'); return; }
    const ind=S.individuals.find(i=>i.id===a.indivId);
    const house=S.houses.find(h=>h.id===a.houseId);
    const individual=a.indivName||ind?.name||'';
    const houseCode=(house?.name||'??').substring(0,2).toUpperCase();
    // Filename uses review month (monthKey - 1)
    const rmk = a.reviewMonthKey || a.monthKey || '';
    const [ry,rmo] = rmk.split('-');
    const parts=individual.trim().split(' ');
    const fi=parts[0]?.[0]||'';
    const ln=parts[parts.length-1]||'';
    const filename=`${houseCode} ${fi} ${ln} ${rmo||''} ${(ry||'').slice(-2)} Acumatica Audit.pdf`;
    await downloadFile(pdf, filename, 'application/pdf');
    toast('✓ Re-exported: '+filename);
  }catch(e){ toast('Export error: '+e.message); }
}

async function buildAuditPDFBytes(a){
  try{
    const ind=S.individuals.find(i=>i.id===a.indivId);
    const house=S.houses.find(h=>h.id===a.houseId);
    const individual=a.indivName||ind?.name||'';

    // Use saved reviewMonthKey for the PDF label, not monthKey (which is +1)
    const rmk = a.reviewMonthKey || (() => {
      // Fallback: derive review month by subtracting 1 from monthKey
      const [y,m] = (a.monthKey||mkNow()).split('-').map(Number);
      const d = new Date(y, m-2, 1);
      return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
    })();
    const [ry,rmo] = rmk.split('-');
    const monthYear = (AMP_MONTHS_FULL[parseInt(rmo)-1]||'') + ' ' + ry;

    // Reconstruct special field values
    const onHand  = parseFloat(a.onHand||0).toFixed(2);
    const inAcu   = parseFloat(a.inAcu||0).toFixed(2);
    const mismatch = a.mismatch||'';
    const cashNote = 'On Hand- $'+onHand+'\nIn Acumatica- $'+inAcu+(mismatch?'\n'+mismatch:'');
    const rn = a.receiptNum||''; const rv = a.receiptVen||'';
    const receiptRef = (rn||rv) ? ('# '+rn+' '+rv).trim() : '';
    const ans = a.answers||{};
    // Hardcode items so this works from history/batch without the form open
    const items = [
      {num:1,  yesId:'YESRow1',  noId:'NORow1',  corrId:'Corrective Action Taken1 Cash on hand equals cash in safe total listed in Acumatica', special:'cash'},
      {num:2,  yesId:'YESRow2',  noId:'NORow2',  corrId:'Corrective Action Taken2 PEP  MMA are current within 1 year and attached to the header section in Acumatica', special:'pepMma'},
      {num:3,  yesId:'YESRow3',  noId:'NORow3',  corrId:'Corrective Action Taken3 Spending money distributed matches amount allowable per MMA', special:'weekly'},
      {num:4,  yesId:'YESRow4',  noId:'NORow4',  corrId:'Corrective Action Taken4 Money removed from safe is used within 72 hours'},
      {num:5,  yesId:'YESRow5',  noId:'NORow5',  corrId:'Corrective Action Taken5 Acumatica has been updated at least weekly'},
      {num:6,  yesId:'YESRow6',  noId:'NORow6',  corrId:'Corrective Action Taken6 Individuals cash in safe balance has NOT been over the maximum of 269 for longer than 14 days', special:'max283'},
      {num:7,  yesId:'YESRow7',  noId:'NORow7',  corrId:'Corrective Action Taken7 All checks received by house staff have been entered into Acumatica regardless of if they have been cashed or forwarded to another location'},
      {num:8,  yesId:'YESRow8',  noId:'NORow8',  corrId:'Corrective Action Taken8 All receipts have two signatures shopper  verifier', special:'receipt8'},
      {num:9,  yesId:'YESRow9',  noId:'NORow9',  corrId:'Corrective Action Taken9 All receipts are appropriate numbered scanned and electronically attached to the transaction line in Acumatica and original receipts are attached to the receipt sheets', special:'receipt9'},
      {num:10, yesId:'YESRow10', noId:'NORow10', corrId:'Corrective Action Taken10 Confirm the appropriate payment method has been used cash not employees personal credit card and there is no evidence of pledging See notes below on pledging'},
      {num:11, yesId:'YESRow11', noId:'NORow11', corrId:'Corrective Action Taken11 Check if any rewardspoints were earned example Kohls Old Navy If yes confirm receipts verifying redemption or unused rewards are present'},
      {num:12, yesId:'YESRow12', noId:'NORow12', corrId:'Corrective Action Taken12 All funds issued to staff have been signed for on the Withdrawal Ledger'},
      {num:13, yesId:'YESRow13', noId:'NORow13', corrId:'13 If capable individuals have signed for weekly spending on the Withdrawal Ledger'},
      {num:14, yesId:'YESRow14', noId:'NORow14', corrId:'14 If required purchases have been added to the Personal Property Record in Acumatica'},
      {num:15, yesId:'YESRow15', noId:'NORow15', corrId:null},
    ];

    const fieldMap={};
    const add=(id,val)=>{ if(id) fieldMap[id]=val; };
    add('Individual', individual);
    add('Review Month_Year', monthYear);
    add('Title', 'DA3');
    add('Date', a.visitDate||'');

    items.forEach(item=>{
      if(!item.yesId) return;
      const av = ans[item.num]||ans[String(item.num)]||'';
      add(item.yesId, av==='YES'?'YES':'');
      add(item.noId,  av==='NO'?'NO':'');
      if(!item.corrId) return;
      let ct = '';
      if(item.special==='cash')         ct = cashNote;
      else if(item.special==='pepMma')  ct = a.corrective?.['2']||'';
      else if(item.special==='weekly')  ct = a.corrective?.['3']||'';
      else if(item.special==='max283'){
        ct = '*Maximum $283.00';
        if(av==='NO') ct += '\n'+(a.corrective?.['6']||'');
      }
      else if(item.special==='receipt8'||item.special==='receipt9') ct = receiptRef;
      else ct = a.corrective?.[item.num]||'';
      add(item.corrId, ct);
    });

    const pdfBytes = await fetch('BlankACU_fixed.pdf').then(r=>{ if(!r.ok) throw new Error('BlankACU.pdf not found'); return r.arrayBuffer(); });
    const pdfDoc = await PDFLib.PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();
    for(const [fid,val] of Object.entries(fieldMap)){
      try{ form.getTextField(fid).setText(val||''); }catch(e){}
    }
    form.flatten();
    await stampSignatureOnPDFById(pdfDoc, 1, [129.325,249.267,398.756,281.267], a.sigId);
    return await pdfDoc.save();
  }catch(e){ console.error('buildAuditPDFBytes:', e); return null; }
}
