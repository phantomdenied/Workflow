/* DA3 feature extracted from index2.html (phase 9) */
/* Structural split only: keeps the existing state, PDF export, and history behavior. */

function isDA3Overdue(){
  const now = new Date();
  return now.getDate() > 4;
}

function openDA3(houseId){
  const house = S.houses.find(h=>h.id===houseId);
  if(!house) return;
  currentHouseId = houseId;
  const mk = houseSelectedMk || mkNow();
  let v = S.da3Visits.find(x=>x.houseId===houseId&&x.monthKey===mk);
  if(!v){
    // Pre-populate persistent comments from house profile
    const savedCmts = house.da3Comments ? {...house.da3Comments} : {};
    const defaultDate = mk === mkNow() ? today() : mk+'-01';
    if(house.da3Extra && !v) v = null; // ensure null check below works
    v={id:uid(),houseId,houseName:house.name,staffName:S.staffName,date:defaultDate,monthKey:mk,
       tasks:{},subChecks:{},comments:savedCmts,corrective:{},completedAt:null};
    S.da3Visits.push(v);
    saveS();
  }
  currentDA3Visit = v;
  document.getElementById('da3HeaderTitle').textContent = house.name;
  document.getElementById('da3HeaderSub').textContent = v.completedAt ? '✓ Completed' : 'DA3 Monthly Checklist';
  document.getElementById('da3ExportBar').classList.add('visible');
  da3BuildForm(house, v);
  showScreen('checklistScreen');
  requestAnimationFrame(()=>{
    const hdr = document.querySelector('#checklistScreen .app-header');
    if(hdr) document.querySelector('#checklistScreen .prog-bar')?.style.setProperty('top', hdr.offsetHeight+'px');
  });
}

function da3GoBack(){
  document.getElementById('da3ExportBar')?.classList.remove('visible');
  goBackToHouse();
}

function da3BuildForm(house, v){
  let html = '';

  // Completion badge
  html += `<div class="acompletion"><div class="acomp-dot" id="da3CompDot"></div><span id="da3CompText">Loading…</span></div>`;

  // Header card
  html += `<div class="audit-slbl">Visit Info</div>
  <div class="ainfo-card">
    <div class="ainfo-row">
      <div class="ainfo-lbl">Residential Site</div>
      <input class="ainfo-input prefilled" type="text" readonly value="${esc(house.name)}">
    </div>
    <div class="ainfo-row">
      <div class="ainfo-lbl">Staff Name</div>
      <input class="ainfo-input prefilled" type="text" readonly value="${esc(S.staffName||'—')}">
    </div>
    <div class="ainfo-row">
      <div class="ainfo-lbl">Date of Visit</div>
      <input class="ainfo-input" id="da3VisitDate" type="date" value="${new Date().toISOString().slice(0,10)}" enterkeyhint="done">
    </div>
  </div>`;

  // Sections
  DA3.forEach(sec => {
    html += `<div class="audit-slbl">${sec.section}</div>`;
    sec.tasks.forEach(task => {
      html += da3BuildTaskCard(task, v);
    });
  });

  // Footer sig note
  html += `<div class="asig-note" style="margin-top:8px;"><strong>&#9998; Staff Signature</strong> — Sign the downloaded PDF to complete the checklist.</div>`;

  document.getElementById('da3Container').innerHTML = html;

  // enterkeyhint on all textareas
  setTimeout(()=>{
    document.querySelectorAll('#da3Container textarea').forEach(el=>{
      el.setAttribute('enterkeyhint','done');
    });
    document.querySelectorAll('#da3Container input[type=text], #da3Container input[type=date]').forEach(el=>{
      el.setAttribute('enterkeyhint','done');
      el.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); el.blur(); }});
    });
  }, 50);

  da3UpdateProgress(v);
}

function da3BuildTaskCard(task, v){
  const isNA   = v.tasks[task.id] === 'na';
  const isDone = !!v.tasks[task.id];
  const hasNA  = DA3_APPLICABLE.has(task.id);
  const cardCls = isNA ? 'answered-na' : isDone ? 'answered-yes' : '';
  const savedCmt = v.comments[task.id] || '';
  const savedCor = v.corrective[task.id] || '';

  let h = `<div class="acard ${cardCls}" id="da3card_${task.id}">`;
  h += `<div class="aitem-text" style="font-weight:600;">${esc(task.title)}</div>`;

  // ── WALKTHROUGH ──
  if(task.special === 'walkthrough'){
    task.subItems.forEach(sub=>{
      const subNA   = v.tasks['sub_na_'+sub.id] === 'na';
      const subDone = !!v.subChecks[sub.id];
      const subCmt  = v.comments['sub_'+sub.id] || '';
      const subBg   = subNA ? 'answered-na' : subDone ? 'answered-yes' : '';
      h += `<div class="acard ${subBg}" id="da3card_sub_${sub.id}" style="margin-bottom:8px;">`;
      h += `<div style="font-size:0.84rem;font-weight:600;margin-bottom:10px;">${esc(sub.label)}</div>`;
      h += `<div class="ayn-row">
        <button class="ayn-btn ayes${subDone&&!subNA?' active':''}" id="da3sub_yes_${sub.id}" onclick="da3SubCheck('${sub.id}','${task.id}',true)">&#10003; Done</button>
        <button class="ayn-btn ana${subNA?' active':''}" id="da3sub_na_${sub.id}" onclick="da3SubCheck('${sub.id}','${task.id}','na')">&#8212; N/A</button>
      </div>`;

      // Sub-item special inputs
      if(sub.special === 'humidifier'){
        const qty = v.da3Extra?.['hum_qty'] || '';
        const inUse = v.da3Extra?.['hum_inuse'];
        h += `<div style="display:flex;gap:8px;margin-top:10px;align-items:flex-end;">
          <div style="flex:0 0 70px;">
            <div class="acorr-lbl blue" style="margin-bottom:3px;">QTY</div>
            <input class="ainfo-input" type="number" inputmode="numeric" min="0" id="da3_hum_qty" value="${esc(qty)}" placeholder="0" style="text-align:center;font-weight:700;" oninput="da3SaveExtra('hum_qty',this.value);da3UpdateHumComment()">
          </div>
          <div style="flex:1;">
            <div class="acorr-lbl blue" style="margin-bottom:3px;">IN USE?</div>
            <div class="ayn-row">
              <button class="ayn-btn ayes${inUse===true?' active':''}" onclick="da3SaveExtra('hum_inuse',true);da3UpdateHumComment()" id="da3_hum_inuse">✓ Yes</button>
              <button class="ayn-btn ana${inUse===false?' active':''}" onclick="da3SaveExtra('hum_inuse',false);da3UpdateHumComment()" id="da3_hum_notuse">— No</button>
            </div>
          </div>
        </div>`;
      }
      if(sub.special === 'dryer_vent'){
        const dv = v.da3Extra?.['dryer_date'] || '';
        h += `<div style="margin-top:10px;">
          <div class="acorr-lbl blue" style="margin-bottom:3px;">DRYER VENT CHECK DATE</div>
          <input class="ainfo-input" type="date" id="da3_dryer_date" value="${esc(dv)}" oninput="da3SaveExtra('dryer_date',this.value);da3UpdateDryerComment()">
        </div>`;
      }
      if(sub.special === 'repairs'){
        h += `<div style="margin-top:8px;">
          <button class="ayn-btn ana" style="flex:none;padding:8px 14px;font-size:0.8rem;" onclick="da3SetRepairsNone('${sub.id}')">None Needed</button>
        </div>`;
      }

      h += `<div class="acorr show" style="margin-top:10px;">
        <div class="acorr-lbl blue">COMMENT</div>
        <textarea class="acorr-ta bb" id="da3subcmt_${sub.id}" placeholder="Notes for this item…" rows="2" onchange="da3SaveSubCmt('${sub.id}',this.value)">${esc(subCmt)}</textarea>
      </div>`;
      h += `</div>`;
    });
    h += `<div class="acorr show" style="margin-top:4px;">
      <div class="acorr-lbl orange">CORRECTIVE ACTION (if any)</div>
      <textarea class="acorr-ta ob" id="da3cor_${task.id}" placeholder="Describe any corrective actions…" rows="2" onchange="da3SaveCor('${task.id}',this.value)">${esc(savedCor)}</textarea>
    </div>`;
    h += `</div>`;
    return h;
  }

  // ── ACUMATICA QUARTERLY ──
  if(task.special === 'acumatica_quarterly'){
    h += `<div class="ayn-row">
      <button class="ayn-btn ayes${isDone&&!isNA?' active':''}" id="da3yes_${task.id}" onclick="da3SetTask('${task.id}','done')">&#10003; Done</button>
    </div>`;
    const quarters = v.da3Extra?.['aq_dates'] || ['','','',''];
    h += `<div style="margin-top:10px;">
      <div class="acorr-lbl blue" style="margin-bottom:6px;">QUARTER DATES (up to 4)</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        ${quarters.map((q,i)=>`<input class="ainfo-input" type="month" id="da3_aq_${i}" value="${esc(q)}" placeholder="YYYY-MM" oninput="da3SaveAQDate(${i},this.value)">`).join('')}
      </div>
    </div>`;
    h += `<div class="acorr show" style="margin-top:10px;">
      <div class="acorr-lbl blue">COMMENT PREVIEW</div>
      <textarea class="acorr-ta bb" id="da3cmt_${task.id}" rows="2" onchange="da3SaveCmt('${task.id}',this.value)">${esc(savedCmt)}</textarea>
    </div>`;
    h += `</div>`;
    return h;
  }

  // ── TRAININGS ──
  if(task.special === 'trainings'){
    h += `<div class="ayn-row">
      <button class="ayn-btn ayes${isDone&&!isNA?' active':''}" id="da3yes_${task.id}" onclick="da3SetTask('${task.id}','done')">&#10003; Done</button>
    </div>`;
    const trainings = v.da3Extra?.['trainings'] || [];
    const staff = (S.individuals||[]).filter(ind=>{
      const house = S.houses.find(h=>h.id===v.houseId);
      return ind.houseId === v.houseId;
    });
    h += `<div style="margin-top:10px;" id="da3_trainings_list">`;
    trainings.forEach((tr,i)=>{
      h += `<div class="email-list-block" style="margin-bottom:8px;">
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
          <input class="ainfo-input" style="flex:1;" placeholder="Training name…" value="${esc(tr.name||'')}" oninput="da3UpdateTrainingName(${i},this.value)" id="da3_tr_name_${i}">
          <button class="email-list-del" onclick="da3RemoveTraining(${i})">✕</button>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="ayn-btn ayes${tr.status==='completed'?' active':''}" style="font-size:0.8rem;" onclick="da3SetTrainingStatus(${i},'completed')">✓ Completed</button>
          <button class="ayn-btn ano${tr.status==='missing'?' active':''}" style="font-size:0.8rem;" onclick="da3SetTrainingStatus(${i},'missing')">Missing Staff</button>
        </div>
      </div>`;
    });
    h += `</div>`;
    h += `<button class="ayn-btn" style="margin-top:6px;font-size:0.8rem;" onclick="da3AddTraining()">+ Add Training</button>`;
    h += `<div class="acorr show" style="margin-top:10px;">
      <div class="acorr-lbl blue">COMMENT PREVIEW</div>
      <textarea class="acorr-ta bb" id="da3cmt_${task.id}" rows="3" onchange="da3SaveCmt('${task.id}',this.value)">${esc(savedCmt)}</textarea>
    </div>`;
    h += `</div>`;
    return h;
  }

  // ── SAFE PATIENT HANDLING ──
  if(task.special === 'safe_patient'){
    const spd = v.da3Extra?.['sp_date'] || '';
    h += `<div class="ayn-row">
      <button class="ayn-btn ayes${isDone&&!isNA?' active':''}" id="da3yes_${task.id}" onclick="da3SetTask('${task.id}','done')">&#10003; Done</button>
      <button class="ayn-btn ana${isNA?' active':''}" id="da3na_${task.id}" onclick="da3SetTask('${task.id}','na')">&#8212; N/A</button>
    </div>`;
    h += `<div style="margin-top:10px;">
      <div class="acorr-lbl blue" style="margin-bottom:3px;">INSPECTION DATE</div>
      <input class="ainfo-input" type="date" id="da3_sp_date" value="${esc(spd)}" oninput="da3SaveExtra('sp_date',this.value);da3UpdateSPComment()">
    </div>`;
    h += `<div class="acorr show" style="margin-top:10px;">
      <div class="acorr-lbl blue">COMMENT PREVIEW</div>
      <textarea class="acorr-ta bb" id="da3cmt_${task.id}" rows="2" onchange="da3SaveCmt('${task.id}',this.value)">${esc(savedCmt)}</textarea>
    </div>`;
    h += `</div>`;
    return h;
  }

  // ── CURTAINS ──
  if(task.special === 'curtains'){
    const cd = v.da3Extra?.['curtain_date'] || '';
    h += `<div class="ayn-row">
      <button class="ayn-btn ayes${isDone&&!isNA?' active':''}" id="da3yes_${task.id}" onclick="da3SetTask('${task.id}','done')">&#10003; Done</button>
      <button class="ayn-btn ana${isNA?' active':''}" id="da3na_${task.id}" onclick="da3SetTask('${task.id}','na')">&#8212; N/A</button>
    </div>`;
    h += `<div style="margin-top:10px;">
      <div class="acorr-lbl blue" style="margin-bottom:3px;">DATE TREATED</div>
      <input class="ainfo-input" type="date" id="da3_curtain_date" value="${esc(cd)}" oninput="da3SaveExtra('curtain_date',this.value);da3UpdateCurtainComment()">
    </div>`;
    h += `<div class="acorr show" style="margin-top:10px;">
      <div class="acorr-lbl blue">COMMENT PREVIEW</div>
      <textarea class="acorr-ta bb" id="da3cmt_${task.id}" rows="2" onchange="da3SaveCmt('${task.id}',this.value)">${esc(savedCmt)}</textarea>
    </div>`;
    h += `</div>`;
    return h;
  }

  // ── FIRE DRILL ──
  if(task.special === 'fire_drill'){
    const fd = v.da3Extra?.['fire_drill_date'] || '';
    h += `<div class="ayn-row">
      <button class="ayn-btn ayes${isDone&&!isNA?' active':''}" id="da3yes_${task.id}" onclick="da3SetTask('${task.id}','done')">&#10003; Done</button>
      <button class="ayn-btn ana${isNA?' active':''}" id="da3na_${task.id}" onclick="da3SetTask('${task.id}','na')">&#8212; N/A</button>
    </div>`;
    h += `<div style="margin-top:10px;">
      <div class="acorr-lbl blue" style="margin-bottom:3px;">DRILL DATE</div>
      <input class="ainfo-input" type="date" id="da3_fd_date" value="${esc(fd)}" oninput="da3SaveExtra('fire_drill_date',this.value);da3UpdateFireDrillComment()">
    </div>`;
    h += `<div class="acorr show" style="margin-top:10px;">
      <div class="acorr-lbl blue">COMMENT PREVIEW</div>
      <textarea class="acorr-ta bb" id="da3cmt_${task.id}" rows="2" onchange="da3SaveCmt('${task.id}',this.value)">${esc(savedCmt)}</textarea>
    </div>`;
    h += `</div>`;
    return h;
  }

  // ── GENERATOR ──
  if(task.special === 'generator'){
    const genVal = v.da3Extra?.['gen_type'] || '';
    h += `<div class="ayn-row">
      <button class="ayn-btn ayes${isDone&&!isNA?' active':''}" id="da3yes_${task.id}" onclick="da3SetTask('${task.id}','done')">&#10003; Done</button>
      <button class="ayn-btn ana${genVal==='none'?' active':''}" onclick="da3SetGeneratorNone()">&#8212; None</button>
    </div>`;
    h += `<div class="acorr show" style="margin-top:11px;">
      <div class="acorr-lbl blue">COMMENTS</div>
      <textarea class="acorr-ta bb" id="da3cmt_${task.id}" rows="2" onchange="da3SaveCmt('${task.id}',this.value)">${esc(savedCmt)}</textarea>
    </div>`;
    h += `</div>`;
    return h;
  }

  // ── EMERGENCY LIGHTING ──
  if(task.special === 'emergency_lighting'){
    const eld = v.da3Extra?.['el_date'] || '';
    h += `<div class="ayn-row">
      <button class="ayn-btn ayes${isDone&&!isNA?' active':''}" id="da3yes_${task.id}" onclick="da3SetTask('${task.id}','done')">&#10003; Done</button>
      <button class="ayn-btn ana${isNA?' active':''}" id="da3na_${task.id}" onclick="da3SetTask('${task.id}','na')">&#8212; N/A</button>
    </div>`;
    h += `<div style="margin-top:10px;">
      <div class="acorr-lbl blue" style="margin-bottom:3px;">TEST DATE</div>
      <input class="ainfo-input" type="date" id="da3_el_date" value="${esc(eld)}" oninput="da3SaveExtra('el_date',this.value);da3UpdateELComment()">
    </div>`;
    h += `<div class="acorr show" style="margin-top:10px;">
      <div class="acorr-lbl blue">COMMENT PREVIEW</div>
      <textarea class="acorr-ta bb" id="da3cmt_${task.id}" rows="2" onchange="da3SaveCmt('${task.id}',this.value)">${esc(savedCmt)}</textarea>
    </div>`;
    h += `</div>`;
    return h;
  }

  // ── CENTRAL AIR ──
  if(task.special === 'central_air'){
    const caVal = v.da3Extra?.['ca_status'] || '';
    h += `<div class="ayn-row">
      <button class="ayn-btn ayes${isDone&&!isNA?' active':''}" id="da3yes_${task.id}" onclick="da3SetTask('${task.id}','done')">&#10003; Done</button>
      <button class="ayn-btn ana${isNA?' active':''}" id="da3na_${task.id}" onclick="da3SetTask('${task.id}','na')">&#8212; N/A</button>
    </div>`;
    h += `<div style="display:flex;gap:8px;margin-top:10px;">
      <button class="ayn-btn ayes${caVal==='clean'?' active':''}" style="font-size:0.82rem;" onclick="da3SetCAStatus('clean')" id="da3_ca_clean">Clean</button>
      <button class="ayn-btn ana${caVal==='covered'?' active':''}" style="font-size:0.82rem;" onclick="da3SetCAStatus('covered')" id="da3_ca_covered">Covered for Season</button>
    </div>`;
    h += `<div class="acorr show" style="margin-top:10px;">
      <div class="acorr-lbl blue">COMMENT PREVIEW</div>
      <textarea class="acorr-ta bb" id="da3cmt_${task.id}" rows="2" onchange="da3SaveCmt('${task.id}',this.value)">${esc(savedCmt)}</textarea>
    </div>`;
    h += `</div>`;
    return h;
  }

  // ── DEFAULT TASK (autoComment or plain) ──
  h += `<div class="ayn-row">
    <button class="ayn-btn ayes${isDone&&!isNA?' active':''}" id="da3yes_${task.id}" onclick="da3SetTask('${task.id}','done')">&#10003; Done</button>
    ${hasNA ? `<button class="ayn-btn ana${isNA?' active':''}" id="da3na_${task.id}" onclick="da3SetTask('${task.id}','na')">&#8212; N/A</button>` : ''}
  </div>`;
  h += `<div class="acorr show" style="margin-top:11px;">
    <div class="acorr-lbl blue">COMMENTS</div>
    <textarea class="acorr-ta bb" id="da3cmt_${task.id}" placeholder="Add comments…" rows="2" onchange="da3SaveCmt('${task.id}',this.value)">${esc(savedCmt)}</textarea>
  </div>`;
  h += `<div class="acorr show" id="da3corwrap_${task.id}">
    <div class="acorr-lbl orange" style="margin-top:8px;">&#9888; CORRECTIVE ACTION</div>
    <textarea class="acorr-ta ob" id="da3cor_${task.id}" placeholder="Describe corrective action…" rows="2" onchange="da3SaveCor('${task.id}',this.value)">${esc(savedCor)}</textarea>
  </div>`;
  h += `</div>`;
  return h;
}

function da3SaveExtra(key, val){
  const v = currentDA3Visit; if(!v) return;
  if(!v.da3Extra) v.da3Extra = {};
  v.da3Extra[key] = val;
  // Persist non-monthly extras to house profile
  const house = S.houses.find(h=>h.id===v.houseId);
  if(house){
    if(!house.da3Extra) house.da3Extra = {};
    const persistKeys = ['curtain_date','sp_date','aq_dates'];
    if(persistKeys.includes(key)) house.da3Extra[key] = val;
  }
  saveS();
}

function da3SaveAQDate(i, val){
  const v = currentDA3Visit; if(!v) return;
  if(!v.da3Extra) v.da3Extra = {};
  let dates = v.da3Extra['aq_dates'] || ['','','',''];
  dates[i] = val;
  v.da3Extra['aq_dates'] = dates;
  const house = S.houses.find(h=>h.id===v.houseId);
  if(house){ if(!house.da3Extra) house.da3Extra={}; house.da3Extra['aq_dates']=dates; }
  saveS();
  da3UpdateAQComment();
}

function da3UpdateAQComment(){
  const v = currentDA3Visit; if(!v) return;
  const dates = (v.da3Extra?.['aq_dates']||[]).filter(d=>d);
  let cmt = dates.length ? 'Completed '+dates.map(fmtMonthYear).join(', ') : 'All Quarters Complete';
  const el = document.getElementById('da3cmt_doc3');
  if(el && el.value !== cmt){ el.value = cmt; da3SaveCmt('doc3', cmt); }
}

function da3AddTraining(){
  const v = currentDA3Visit; if(!v) return;
  if(!v.da3Extra) v.da3Extra = {};
  if(!v.da3Extra.trainings) v.da3Extra.trainings = [];
  v.da3Extra.trainings.push({name:'', status:''});
  saveS();
  const task = DA3.flatMap(s=>s.tasks).find(t=>t.id==='doc6');
  da3RebuildCard('doc6', task, v);
}

function da3RemoveTraining(i){
  const v = currentDA3Visit; if(!v) return;
  v.da3Extra.trainings.splice(i,1);
  saveS();
  da3UpdateTrainingComment();
  const task = DA3.flatMap(s=>s.tasks).find(t=>t.id==='doc6');
  da3RebuildCard('doc6', task, v);
}

function da3UpdateTrainingName(i, val){
  const v = currentDA3Visit; if(!v) return;
  if(!v.da3Extra?.trainings) return;
  v.da3Extra.trainings[i].name = val;
  saveS();
  da3UpdateTrainingComment();
}

function da3SetTrainingStatus(i, status){
  const v = currentDA3Visit; if(!v) return;
  if(!v.da3Extra?.trainings) return;
  v.da3Extra.trainings[i].status = status;
  saveS();
  // Update button states
  document.querySelectorAll(`#da3card_doc6 .ayn-btn`).forEach(b=>b.classList.remove('active'));
  const task = DA3.flatMap(s=>s.tasks).find(t=>t.id==='doc6');
  da3RebuildCard('doc6', task, v);
  da3UpdateTrainingComment();
}

function da3UpdateTrainingComment(){
  const v = currentDA3Visit; if(!v) return;
  const trainings = v.da3Extra?.trainings || [];
  const lines = trainings.filter(t=>t.name).map(t=>{
    const s = t.status==='completed' ? 'Completed' : t.status==='missing' ? 'Missing Staff' : '';
    return t.name + (s ? '- '+s : '');
  });
  const cmt = lines.join('\n') || 'Reviewed';
  const el = document.getElementById('da3cmt_doc6');
  if(el){ el.value = cmt; da3SaveCmt('doc6', cmt); }
}

function da3UpdateSPComment(){
  const v = currentDA3Visit; if(!v) return;
  const d = v.da3Extra?.sp_date || '';
  const cmt = d ? 'Reviewed- Completed '+fmtDateSlash(d)+'. No Issues' : 'Reviewed- No Issues';
  const el = document.getElementById('da3cmt_doc7');
  if(el){ el.value = cmt; da3SaveCmt('doc7', cmt); }
}

function da3UpdateCurtainComment(){
  const v = currentDA3Visit; if(!v) return;
  const d = v.da3Extra?.curtain_date || '';
  const cmt = d ? 'Treated on '+fmtDateSlash(d)+'\nDocumentation in Fire Book.' : 'Documentation in Fire Book.';
  const el = document.getElementById('da3cmt_doc10');
  if(el){ el.value = cmt; da3SaveCmt('doc10', cmt); }
}

function da3UpdateFireDrillComment(){
  const v = currentDA3Visit; if(!v) return;
  const d = v.da3Extra?.fire_drill_date || '';
  const cmt = d ? 'Completed for the Month '+fmtDateSlash(d)+'. It is reported that all staff have access.' : 'It is reported that all staff have access.';
  const el = document.getElementById('da3cmt_doc11');
  if(el){ el.value = cmt; da3SaveCmt('doc11', cmt); }
}

function da3UpdateHumComment(){
  const v = currentDA3Visit; if(!v) return;
  const qty = v.da3Extra?.hum_qty || '';
  const inUse = v.da3Extra?.hum_inuse;
  let cmt = '';
  if(inUse === true) cmt = qty ? qty+' Humidifier/Dehumidifier in Use and Clean.' : 'Humidifier/Dehumidifier in Use and Clean.';
  else if(inUse === false) cmt = qty ? qty+' Humidifier/Dehumidifier Not in Use / Clean.' : 'Humidifier/Dehumidifier Not in Use / Clean.';
  else cmt = qty ? qty+' Humidifier/Dehumidifier present.' : '';
  const el = document.getElementById('da3subcmt_s2');
  if(el){ el.value = cmt; da3SaveSubCmt('s2', cmt); }
}

function da3UpdateDryerComment(){
  const v = currentDA3Visit; if(!v) return;
  const d = v.da3Extra?.dryer_date || '';
  const cmt = d
    ? 'Behind the washer and dryer is clean. The Dryer vent has been checked Completed on '+fmtDateSlash(d)+'. - No Issues.'
    : 'Behind the washer and dryer is clean.';
  const el = document.getElementById('da3subcmt_s5');
  if(el){ el.value = cmt; da3SaveSubCmt('s5', cmt); }
}

function da3SetRepairsNone(subId){
  const v = currentDA3Visit; if(!v) return;
  v.subChecks[subId] = true;
  const cmt = 'None needed.';
  v.comments['sub_'+subId] = cmt;
  saveS();
  const el = document.getElementById('da3subcmt_'+subId);
  if(el) el.value = cmt;
  const card = document.getElementById('da3card_sub_'+subId);
  if(card) card.className = 'acard answered-yes';
  document.getElementById('da3sub_yes_'+subId)?.classList.add('active');
  da3UpdateProgress(v);
}

function da3SetGeneratorNone(){
  const v = currentDA3Visit; if(!v) return;
  if(!v.da3Extra) v.da3Extra = {};
  const isNone = v.da3Extra.gen_type === 'none';
  v.da3Extra.gen_type = isNone ? '' : 'none';
  v.tasks['pp2'] = isNone ? false : true;
  const cmt = isNone ? '' : 'None at this site';
  v.comments['pp2'] = cmt;
  saveS();
  const el = document.getElementById('da3cmt_pp2');
  if(el) el.value = cmt;
  const task = DA3.flatMap(s=>s.tasks).find(t=>t.id==='pp2');
  da3RebuildCard('pp2', task, v);
  da3UpdateProgress(v);
}

function da3UpdateELComment(){
  const v = currentDA3Visit; if(!v) return;
  const d = v.da3Extra?.el_date || '';
  const cmt = d
    ? 'Monthly Light test completed '+fmtDateSlash(d)+'\nFlashlight / Lamps working'
    : 'Flashlight / Lamps working';
  const el = document.getElementById('da3cmt_pp3');
  if(el){ el.value = cmt; da3SaveCmt('pp3', cmt); }
}

function da3SetCAStatus(status){
  const v = currentDA3Visit; if(!v) return;
  if(!v.da3Extra) v.da3Extra = {};
  v.da3Extra.ca_status = status;
  v.tasks['pp4'] = true;
  const cmt = status==='covered' ? 'Clean and covered for the season.' : 'Clean';
  v.comments['pp4'] = cmt;
  saveS();
  const el = document.getElementById('da3cmt_pp4');
  if(el) el.value = cmt;
  const task = DA3.flatMap(s=>s.tasks).find(t=>t.id==='pp4');
  da3RebuildCard('pp4', task, v);
  da3UpdateProgress(v);
}

function da3AutoPopulateComment(taskId){
  const v = currentDA3Visit; if(!v) return;
  const task = DA3.flatMap(s=>s.tasks).find(t=>t.id===taskId);
  if(!task?.autoComment) return;
  if(!v.comments[taskId]){
    v.comments[taskId] = task.autoComment;
    saveS();
    const el = document.getElementById('da3cmt_'+taskId);
    if(el && !el.value) el.value = task.autoComment;
  }
}

function da3AutoPopulateSubComment(subId){
  const v = currentDA3Visit; if(!v) return;
  const allSubs = DA3.flatMap(s=>s.tasks).flatMap(t=>t.subItems||[]);
  const sub = allSubs.find(s=>s.id===subId);
  if(!sub?.autoText) return;
  if(!v.comments['sub_'+subId]){
    v.comments['sub_'+subId] = sub.autoText;
    saveS();
    const el = document.getElementById('da3subcmt_'+subId);
    if(el && !el.value) el.value = sub.autoText;
  }
}

function da3RebuildCard(taskId, task, v){
  const card = document.getElementById('da3card_'+taskId);
  if(!card) return;
  const newHtml = da3BuildTaskCard(task, v);
  card.outerHTML = newHtml;
}

function da3SetTask(id, val){
  const v = currentDA3Visit; if(!v) return;
  const prev = v.tasks[id];
  if(val==='done')      v.tasks[id] = prev===true ? false : true;
  else if(val==='na')   v.tasks[id] = prev==='na' ? false : 'na';
  saveS();

  const isDone = !!v.tasks[id];
  const isNA   = v.tasks[id]==='na';
  const card   = document.getElementById('da3card_'+id);
  if(card){
    card.className = 'acard '+(isNA?'answered-na':isDone?'answered-yes':'');
    card.classList.remove('aerror');
  }
  document.getElementById('da3yes_'+id)?.classList.toggle('active', isDone && !isNA);
  document.getElementById('da3na_'+id)?.classList.toggle('active', isNA);

  da3UpdateProgress(v);

  // Auto-populate comment on Done
  if(isDone) da3AutoPopulateComment(id);

  // Auto-scroll to next unanswered
  if(isDone || isNA){
    const allTasks = DA3.flatMap(s=>s.tasks);
    const next = allTasks.find(t=>t.id!==id && !v.tasks[t.id] && t.id!=='pp_walk');
    if(next) setTimeout(()=>document.getElementById('da3card_'+next.id)?.scrollIntoView({behavior:'smooth',block:'center'}),280);
  }
}

function da3SubCheck(subId, taskId, val){
  const v = currentDA3Visit; if(!v) return;
  if(val==='na'){
    v.tasks['sub_na_'+subId] = v.tasks['sub_na_'+subId]==='na' ? false : 'na';
    v.subChecks[subId] = false;
  } else {
    v.subChecks[subId] = !v.subChecks[subId];
    v.tasks['sub_na_'+subId] = false;
  }
  saveS();

  const isDone = !!v.subChecks[subId];
  const isNA   = v.tasks['sub_na_'+subId]==='na';
  const subCard = document.getElementById('da3card_sub_'+subId);
  if(subCard) subCard.style.background = isNA?'#f8f8f6':isDone?'#f6fdf9':'var(--white)';
  document.getElementById('da3sub_yes_'+subId)?.classList.toggle('active', isDone&&!isNA);
  document.getElementById('da3sub_na_'+subId)?.classList.toggle('active', isNA);

  if(isDone) da3AutoPopulateSubComment(subId);
  da3UpdateProgress(v);
}

function da3SaveCmt(id, val){
  const v = currentDA3Visit; if(!v) return;
  v.comments[id] = val;
  // Also save to house profile for persistence
  const house = S.houses.find(h=>h.id===v.houseId);
  if(house){
    if(!house.da3Comments) house.da3Comments = {};
    if(!DA3_CLEAR_MONTHLY.has(id)) house.da3Comments[id] = val;
  }
  saveS();
}

function da3SaveSubCmt(subId, val){
  const v = currentDA3Visit; if(!v) return;
  v.comments['sub_'+subId] = val;
  saveS();
}

function da3SaveCor(id, val){
  const v = currentDA3Visit; if(!v) return;
  v.corrective[id] = val;
  saveS();
}

function da3UpdateProgress(v){
  if(!v) return;
  let tot=0, done=0;
  DA3.forEach(sec=>sec.tasks.forEach(task=>{
    if(task.subItems){
      task.subItems.forEach(sub=>{
        tot++;
        if(v.subChecks[sub.id] || v.tasks['sub_na_'+sub.id]==='na') done++;
      });
    } else {
      tot++;
      if(v.tasks[task.id]) done++;
    }
  }));
  const pct = tot ? Math.round((done/tot)*100) : 0;
  document.getElementById('da3ProgFill').style.width = pct+'%';
  const dot = document.getElementById('da3CompDot');
  const txt = document.getElementById('da3CompText');
  if(dot) dot.className = 'acomp-dot'+(done===tot?' done':'');
  if(txt) txt.textContent = done+' of '+tot+' items complete';
}

function calcDA3Pct(v){
  if(!v) return 0;
  let tot=0, done=0;
  DA3.forEach(s=>s.tasks.forEach(t=>{
    if(t.subItems){ t.subItems.forEach(si=>{ tot++; if(v.subChecks?.[si.id]||v.tasks?.['sub_na_'+si.id]==='na') done++; }); }
    else { tot++; if(v.tasks?.[t.id]) done++; }
  }));
  return tot ? Math.round((done/tot)*100) : 0;
}

function da3Validate(){
  const v = currentDA3Visit; if(!v) return [{msg:'No active visit',elId:'da3Container'}];
  const errs = [];
  DA3.forEach(sec=>sec.tasks.forEach(task=>{
    if(task.subItems){
      task.subItems.forEach(sub=>{
        if(!v.subChecks[sub.id] && v.tasks['sub_na_'+sub.id]!=='na')
          errs.push({msg:'Walkthrough item '+sub.label.slice(0,30)+' not completed', elId:'da3card_sub_'+sub.id});
      });
    } else {
      if(!v.tasks[task.id])
        errs.push({msg:task.title.slice(0,40)+' not completed', elId:'da3card_'+task.id});
    }
  }));
  return errs;
}

function da3ClearConfirm(){
  if(!confirm('Clear all answers and start over?')) return;
  const v = currentDA3Visit; if(!v) return;
  v.tasks={}; v.subChecks={}; v.corrective={};
  // Keep saved comments (they persist)
  const house = S.houses.find(h=>h.id===v.houseId);
  v.comments = house?.da3Comments ? {...house.da3Comments} : {};
  saveS();
  da3BuildForm(S.houses.find(h=>h.id===v.houseId), v);
}

async function buildDA3PDFBytes(v){
  try{
    const house = S.houses.find(h=>h.id===v.houseId);
    const fieldMap={};
    const add=(id,val)=>fieldMap[id]=val;
    add('Text10', house?.name||'');
    add('Text11', v.date||'');
    add('Text12', v.staffName||'');

    const walkTask = DA3.flatMap(s=>s.tasks).find(t=>t.id==='pp_walk');
    let walkLines_p1=[], walkLines_p2=[];
    if(walkTask){
      walkTask.subItems.forEach(sub=>{
        const isNA=v.tasks?.['sub_na_'+sub.id]==='na';
        const cmt=v.comments?.['sub_'+sub.id]||'';
        const num=parseInt(sub.id.replace('s',''));
        const line=num+'. '+(isNA?'N/A':cmt||sub.label);
        if(num<=5) walkLines_p1.push(line); else walkLines_p2.push(line);
      });
    }
    add('Complete walkthrough of entire house to check for 1 cleanliness of house 2 humidifiers de humidifiers 3 air vents 4 bathrooms 5 behind washer and dryer including dryer vent', walkLines_p1.join('\n'));
    add('Commentsinside and outside 6 baseboards 7 no exposed wires 8 no extension cords 9 no leaks 10no mold 11no broken or loose switch plates 12outside and inside clear and well maintained for safe mobility 13no noticeable repairs needed', walkLines_p2.join('\n'));

    const taskList=[
      {id:'doc1', cField:'OT binder revised VOTMOT Rosters and Float Grids rotated properly'},
      {id:'doc2', cField:'Personal Needs Allowance ledger is accurate for all individuals and at least two are reviewed per month'},
      {id:'doc3', cField:'Acumatica Quarterly Trial Balance timely and completed'},
      {id:'doc4', cField:'Time and Attendance reviewed monthly no issues'},
      {id:'doc5', cField:'Emergency Ready ToGo Packets updated in med book'},
      {id:'doc6', cField:'Trainings for all staff'},
      {id:'doc7', cField:'Safe Patient Handling inspections timely'},
      {id:'doc8c',cField:'Commentschange in instructor and signed off as reviewed by all staff as required'},
      {id:'doc9', cField:'CommentsInspections panel emergency lighting fire extinguisher smoke detectors carbon monoxide detectors etc up to date in Fire Book all issues addressed'},
      {id:'doc10',cField:'CommentsCurtains fire treated and documented where required'},
      {id:'doc11',cField:'CommentsFire drills completed correct and in Fire Portal all staff have access'},
      {id:'pp2',  cField:'CommentsManual generator if applicable Check fuel level'},
      {id:'pp3',  cField:'CommentsInterior automatic emergency lighting if applicable also check flashlights batteries etc'},
      {id:'pp4',  cField:'CommentsCentral and window air conditioners filters are clean if not submit work order'},
      {id:'pp5',  cField:'CommentsGarbage containers clean and waterproof'},
      {id:'pp6',  cField:'CommentsHouse cell phones charged if applicable'},
      {id:'pp7',  cField:'CommentsWater softener container filled extra salt available if applicable'},
    ];
    taskList.forEach(({id,cField})=>{
      const cmt=id==='doc8c'?(v.comments?.['doc8']||''):(v.comments?.[id]||'');
      const isNA=v.tasks?.[id]==='na';
      add(cField, isNA?'N/A':cmt);
    });

    const pdfBytes=await fetch('BlankDA3_fixed.pdf').then(r=>{if(!r.ok)throw new Error('BlankDA3.pdf not found');return r.arrayBuffer();});
    const pdfDoc=await PDFLib.PDFDocument.load(pdfBytes);
    const form=pdfDoc.getForm();

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
    await stampSignatureOnPDFById(pdfDoc, 0, [450.14,672.523,600.14,694.523], v.sigId);
    return await pdfDoc.save();
  }catch(e){ console.error('buildDA3PDFBytes:',e); return null; }
}

async function da3ExportPDF(){
  const errs = da3Validate();
  if(errs.length > 0){
    toast('&#9888; '+errs[0].msg);
    const el = document.getElementById(errs[0].elId);
    if(el){
      el.classList.add('aerror');
      el.scrollIntoView({behavior:'smooth', block:'center'});
      setTimeout(()=>el.classList.remove('aerror'), 2500);
    }
    return;
  }

  const btn = document.getElementById('da3ExpBtnMain');
  btn.disabled = true;
  document.getElementById('da3ExpBtnText').innerHTML = '<span class="aspinner"></span> Building…';

  try {
    const v = currentDA3Visit;
    const house = S.houses.find(h=>h.id===v.houseId);
    const visitDate = document.getElementById('da3VisitDate')?.value || new Date().toISOString().slice(0,10);
    const [dy,dm,dd] = visitDate.split('-');
    const dateForPDF = dm+'/'+dd+'/'+dy;
    // Update monthKey from visit date so it files under the correct month
    const visitMk = dy+'-'+dm;
    if(v.monthKey !== visitMk){
      // Move to correct month bucket
      S.da3Visits = S.da3Visits.filter(x=>x.id!==v.id);
      v.monthKey = visitMk;
      S.da3Visits.push(v);
      houseSelectedMk = visitMk;
    }
    v.date = dateForPDF;

    const fieldMap = {};
    const add = (id,val) => fieldMap[id] = val;

    // Header
    add('Text10', house?.name||'');
    add('Text11', dateForPDF);
    add('Text12', S.staffName||'');
    add('Text13', ''); // signature — left blank

    // Build walkthrough combined comment (numbered)
    const walkTask = DA3.flatMap(s=>s.tasks).find(t=>t.id==='pp_walk');
    let walkLines_p1 = [], walkLines_p2 = [], walkCor = v.corrective['pp_walk']||'';
    if(walkTask){
      walkTask.subItems.forEach(sub=>{
        const isNA  = v.tasks['sub_na_'+sub.id]==='na';
        const cmt   = v.comments['sub_'+sub.id]||'';
        const num   = parseInt(sub.id.replace('s',''));
        const line  = num+'. '+(isNA?'N/A':cmt||sub.label);
        if(num <= 5) walkLines_p1.push(line);
        else         walkLines_p2.push(line);
      });
    }
    add('Complete walkthrough of entire house to check for 1 cleanliness of house 2 humidifiers de humidifiers 3 air vents 4 bathrooms 5 behind washer and dryer including dryer vent', walkLines_p1.join('\n'));
    add('Commentsinside and outside 6 baseboards 7 no exposed wires 8 no extension cords 9 no leaks 10no mold 11no broken or loose switch plates 12outside and inside clear and well maintained for safe mobility 13no noticeable repairs needed', walkLines_p2.join('\n'));
    add('Text9', walkCor);
    add('Corrective action taken and date attach supporting documents if applicableinside and outside 6 baseboards 7 no exposed wires 8 no extension cords 9 no leaks 10no mold 11no broken or loose switch plates 12outside and inside clear and well maintained for safe mobility 13no noticeable repairs needed', '');

    // All other tasks
    const taskList = [
      {id:'doc1',  cField:'OT binder revised VOTMOT Rosters and Float Grids rotated properly', corField:'Text1'},
      {id:'doc2',  cField:'Personal Needs Allowance ledger is accurate for all individuals and at least two are reviewed per month', corField:'Text2'},
      {id:'doc3',  cField:'Acumatica Quarterly Trial Balance timely and completed', corField:'Text3'},
      {id:'doc4',  cField:'Time and Attendance reviewed monthly no issues', corField:'Text4'},
      {id:'doc5',  cField:'Emergency Ready ToGo Packets updated in med book', corField:'Text5'},
      {id:'doc6',  cField:'Trainings for all staff', corField:'Text6'},
      {id:'doc7',  cField:'Safe Patient Handling inspections timely', corField:'Text7'},
      {id:'doc8',  cField:'Fire evacuation plan up to date since new individual admission or changes in ambulation or', corField:'Text8'},
      {id:'doc8c', cField:'Commentschange in instructor and signed off as reviewed by all staff as required', corField:'Corrective action taken and date attach supporting documents if applicablechange in instructor and signed off as reviewed by all staff as required'},
      {id:'doc9',  cField:'CommentsInspections panel emergency lighting fire extinguisher smoke detectors carbon monoxide detectors carbon monoxide detectors etc up to date in Fire Book all issues addressed', corField:'Corrective action taken and date attach supporting documents if applicableInspections panel emergency lighting fire extinguisher smoke detectors carbon monoxide detectors etc up to date in Fire Book all issues addressed'},
      {id:'doc10', cField:'CommentsCurtains fire treated and documented where required', corField:'Corrective action taken and date attach supporting documents if applicableCurtains fire treated and documented where required'},
      {id:'doc11', cField:'CommentsFire drills completed correct and in Fire Portal all staff have access', corField:'Corrective action taken and date attach supporting documents if applicableFire drills completed correct and in Fire Portal all staff have access'},
      {id:'pp2',   cField:'CommentsManual generator if applicable Check fuel level', corField:'Corrective action taken and date attach supporting documents if applicableManual generator if applicable Check fuel level'},
      {id:'pp3',   cField:'CommentsInterior automatic emergency lighting if applicable also check flashlights batteries etc', corField:'Corrective action taken and date attach supporting documents if applicableInterior automatic emergency lighting if applicable also check flashlights batteries etc'},
      {id:'pp4',   cField:'CommentsCentral and window air conditioners filters are clean if not submit work order', corField:'Corrective action taken and date attach supporting documents if applicableCentral and window air conditioners filters are clean if not submit work order'},
      {id:'pp5',   cField:'CommentsGarbage containers clean and waterproof', corField:'Corrective action taken and date attach supporting documents if applicableGarbage containers clean and waterproof'},
      {id:'pp6',   cField:'CommentsHouse cell phones charged if applicable', corField:'Corrective action taken and date attach supporting documents if applicableHouse cell phones charged if applicable'},
      {id:'pp7',   cField:'CommentsWater softener container filled extra salt available if applicable', corField:'Corrective action taken and date attach supporting documents if applicableWater softener container filled extra salt available if applicable'},
    ];

    taskList.forEach(({id, cField, corField})=>{
      const cmt = id==='doc8c' ? (v.comments['doc8']||'') : (v.comments[id]||'');
      const cor = v.corrective[id]||'';
      const isNA = v.tasks[id]==='na';
      add(cField, isNA ? 'N/A' : cmt);
      if(corField) add(corField, cor);
    });

    // Load and fill PDF
    const pdfBytes = await fetch('BlankDA3_fixed.pdf').then(r=>{ if(!r.ok) throw new Error('BlankDA3.pdf not found'); return r.arrayBuffer(); });
    const pdfDoc   = await PDFLib.PDFDocument.load(pdfBytes);
    const form     = pdfDoc.getForm();


    function forceFontSize9(field){
      try{
        const daName = PDFLib.PDFName.of('DA');
        const existing = field.acroField.dict.get(daName);
        let daStr = existing ? existing.decodeText() : '/Helv 9 Tf 0 g';
        daStr = daStr.replace(/(\/[A-Za-z]+\s+)[\d.]+(\s+Tf)/, '$19$2');
        field.acroField.dict.set(daName, PDFLib.PDFString.of(daStr));
      }catch(e){}
    }
    for(const [fid, val] of Object.entries(fieldMap)){
      try{ const tf=form.getTextField(fid); tf.setText(val||''); forceFontSize9(tf); }catch(e){}
    }
    form.flatten();
    // DA3 signature is Text13 on page 0: rect [450.14, 672.523, 600.14, 694.523]
    const da3SigId = await stampSignatureOnPDFById(pdfDoc, 0, [450.14, 672.523, 600.14, 694.523], v.sigId);
    if(da3SigId) v.sigId = da3SigId;
    const filled = await pdfDoc.save();

    // Filename: HouseName DA3 Monthly Report MM YY
    const houseCode = (house?.name||'House').replace(/\s+/g,' ').trim();
    const mm = String(new Date().getMonth()+1).padStart(2,'0'); // current month
    const yy = String(new Date().getFullYear()).slice(-2);
    const filename = `${houseCode} DA3 Monthly Report ${mm} ${yy}.pdf`;
    try{ pdfDoc.setTitle(filename); }catch(_){}

    await downloadFile(filled, filename, 'application/pdf');

    // Mark DA3 complete for this month
    v.completedAt = today();
    saveS();
    document.getElementById('da3HeaderSub').textContent = '✓ Completed';

    document.getElementById('da3ExpBtnText').textContent = '✓ Downloaded!';
    toast(/iPhone|iPad|iPod/i.test(navigator.userAgent)
      ? '✓ PDF opened — tap Share ⬆ to save'
      : '✓ Saved: '+filename);
    setTimeout(()=>{ btn.disabled=false; document.getElementById('da3ExpBtnText').textContent='Export Filled PDF'; },2500);

  } catch(e){
    console.error(e);
    toast('Export error: '+e.message);
    btn.disabled=false;
    document.getElementById('da3ExpBtnText').textContent='Export Filled PDF';
  }
}

function updateDA3Bar(){ da3UpdateProgress(currentDA3Visit); }

function submitDA3(){ da3ExportPDF(); }

function renderDA3Hist(){
  const c=document.getElementById('histContent');
  const filterHouse = document.getElementById('histHouseFilter')?.value||'';
  const mk = histSelectedMk || mkNow();
  let vs=S.da3Visits.filter(v=>v.monthKey===mk);
  if(filterHouse) vs=vs.filter(v=>v.houseId===filterHouse);
  let html='';
  if(vs.length){
    vs.forEach(v=>{
      const pct=calcDA3Pct(v);
      const overdue=!v.completedAt;
      html+=`<div class="history-item" onclick="viewDA3Report('${v.id}')">
        <div class="history-info">
          <div class="history-house">${esc(v.houseName)}${overdue?' <span style="color:var(--red);font-size:0.7rem;">⚠ Incomplete</span>':''}</div>
          <div class="history-date">${v.date} · ${esc(v.staffName||'—')}</div>
        </div>
        <div class="history-score">${pct}%</div>
        <button class="view-btn" onclick="event.stopPropagation();viewDA3Report('${v.id}')">View</button>
        <button class="hist-export-btn" onclick="event.stopPropagation();reExportDA3('${v.id}')" title="Re-export PDF">⬇</button>
        <button class="hist-del-btn" onclick="event.stopPropagation();histDeleteDA3('${v.id}')" title="Delete">✕</button>
      </div>`;
    });
  }
  c.innerHTML=html||`<div class="empty-hist"><span class="icon">📋</span>No DA3 visits for ${mkLabel(mk)}.</div>`;
}

function histDeleteDA3(id){
  if(!confirm('Delete this DA3 record?')) return;
  S.da3Visits = S.da3Visits.filter(v=>v.id!==id);
  saveS(); renderHistory();
}

async function reExportDA3(visitId){
  const v = S.da3Visits.find(x=>x.id===visitId); if(!v) return;
  const house = S.houses.find(h=>h.id===v.houseId);
  toast('Building PDF…');
  try{
    const fieldMap={};
    const add=(id,val)=>fieldMap[id]=val;
    add('Text10', house?.name||'');
    // Convert date from mm/dd/yyyy back to mm/dd/yy for PDF
    add('Text11', v.date||'');
    add('Text12', v.staffName||'');

    const walkTask = DA3.flatMap(s=>s.tasks).find(t=>t.id==='pp_walk');
    let walkLines_p1=[], walkLines_p2=[];
    if(walkTask){
      walkTask.subItems.forEach(sub=>{
        const isNA=v.tasks?.['sub_na_'+sub.id]==='na';
        const cmt=v.comments?.['sub_'+sub.id]||'';
        const num=parseInt(sub.id.replace('s',''));
        const line=num+'. '+(isNA?'N/A':cmt||sub.label);
        if(num<=5) walkLines_p1.push(line); else walkLines_p2.push(line);
      });
    }
    add('Complete walkthrough of entire house to check for 1 cleanliness of house 2 humidifiers de humidifiers 3 air vents 4 bathrooms 5 behind washer and dryer including dryer vent', walkLines_p1.join('\n'));
    add('Commentsinside and outside 6 baseboards 7 no exposed wires 8 no extension cords 9 no leaks 10no mold 11no broken or loose switch plates 12outside and inside clear and well maintained for safe mobility 13no noticeable repairs needed', walkLines_p2.join('\n'));

    const taskList=[
      {id:'doc1', cField:'OT binder revised VOTMOT Rosters and Float Grids rotated properly'},
      {id:'doc2', cField:'Personal Needs Allowance ledger is accurate for all individuals and at least two are reviewed per month'},
      {id:'doc3', cField:'Acumatica Quarterly Trial Balance timely and completed'},
      {id:'doc4', cField:'Time and Attendance reviewed monthly no issues'},
      {id:'doc5', cField:'Emergency Ready ToGo Packets updated in med book'},
      {id:'doc6', cField:'Trainings for all staff'},
      {id:'doc7', cField:'Safe Patient Handling inspections timely'},
      {id:'doc8', cField:'Fire evacuation plan up to date since new individual admission or changes in ambulation or'},
      {id:'doc8c',cField:'Commentschange in instructor and signed off as reviewed by all staff as required'},
      {id:'doc9', cField:'CommentsInspections panel emergency lighting fire extinguisher smoke detectors carbon monoxide detectors carbon monoxide detectors etc up to date in Fire Book all issues addressed'},
      {id:'doc10',cField:'CommentsCurtains fire treated and documented where required'},
      {id:'doc11',cField:'CommentsFire drills completed correct and in Fire Portal all staff have access'},
      {id:'pp2',  cField:'CommentsManual generator if applicable Check fuel level'},
      {id:'pp3',  cField:'CommentsInterior automatic emergency lighting if applicable also check flashlights batteries etc'},
      {id:'pp4',  cField:'CommentsCentral and window air conditioners filters are clean if not submit work order'},
      {id:'pp5',  cField:'CommentsGarbage containers clean and waterproof'},
      {id:'pp6',  cField:'CommentsHouse cell phones charged if applicable'},
      {id:'pp7',  cField:'CommentsWater softener container filled extra salt available if applicable'},
    ];
    taskList.forEach(({id,cField})=>{
      const cmt=id==='doc8c'?(v.comments?.['doc8']||''):(v.comments?.[id]||'');
      const isNA=v.tasks?.[id]==='na';
      add(cField, isNA?'N/A':cmt);
    });

    const pdfBytes=await fetch('BlankDA3_fixed.pdf').then(r=>r.arrayBuffer());
    const pdfDoc=await PDFLib.PDFDocument.load(pdfBytes);
    const form=pdfDoc.getForm();

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
    // Use same signature if saved, else random
    await stampSignatureOnPDFById(pdfDoc, 0, [450.14,672.523,600.14,694.523], v.sigId);
    const filled=await pdfDoc.save();
    const houseCode=(house?.name||'House').replace(/\s+/g,' ').trim();
    const mk=v.monthKey||'';
    const [y,m]=mk.split('-');
    const filename=`${houseCode} DA3 Monthly Report ${m||''} ${(y||'').slice(-2)}.pdf`;
    await downloadFile(filled, filename, 'application/pdf');
    toast('✓ Re-exported: '+filename);
  }catch(e){ toast('Export error: '+e.message); }
}
