/* Home + tasks feature extracted from index2.html (phase 7) */
/* Structural split only: keeps the existing state and task behavior. */

function startHomeClock(){
  if(_homeClockInterval) clearInterval(_homeClockInterval);
  function tick(){
    const el = document.getElementById('homeDatetime');
    if(!el) return;
    const now = new Date();
    const mm = String(now.getMonth()+1).padStart(2,'0');
    const dd = String(now.getDate()).padStart(2,'0');
    const yyyy = now.getFullYear();
    let h = now.getHours(), m = String(now.getMinutes()).padStart(2,'0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    el.textContent = `${mm}/${dd}/${yyyy}  ${h}:${m} ${ampm}`;
  }
  tick();
  _homeClockInterval = setInterval(tick, 1000);
}

function goBackToHouse(){
  document.getElementById('auditExportBar')?.classList.remove('visible');
  openHouse(currentHouseId);
}

function renderHome(){
  const d=new Date();
  document.getElementById('homeStaffName').textContent = S.staffName||'Welcome!';
  document.getElementById('homeMonth').textContent = `${MO[d.getMonth()]} ${d.getFullYear()}`;
  const hr = d.getHours();
  const greet = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  const greetEl = document.getElementById('homeGreeting');
  if(greetEl) greetEl.textContent = greet;
  startHomeClock();
  document.getElementById('setupBanner').style.display = (!S.staffName||S.houses.length===0)?'block':'none';

  const mk=mkNow();
  const list=document.getElementById('homeList');

  if(S.houses.length===0){
    list.innerHTML=`<div style="text-align:center;padding:48px 20px;color:var(--muted);font-size:0.85rem;">No houses yet — add them in ⚙️ Settings</div>`;
    const rf=document.getElementById('homeRingFill'); if(rf) rf.style.strokeDashoffset='150.8';
    const rp=document.getElementById('homeRingPct'); if(rp) rp.textContent='0%';
    document.getElementById('homeOverallLabel').textContent='Add houses to get started';
    return;
  }

  let totalTasks=0, doneTasks=0;

  list.innerHTML = S.houses.map(h=>{
    const da3 = S.da3Visits.find(v=>v.houseId===h.id&&v.monthKey===mk);
    const da3Pct = da3 ? calcDA3Pct(da3) : 0;
    const indivs = S.individuals.filter(i=>i.houseId===h.id);
    const audits = indivs.map(i=>S.auditVisits.find(v=>v.indivId===i.id&&v.monthKey===mk));
    const auditDone = audits.filter(a=>a&&a.completedAt).length;
    const hasNo = audits.some(a=>a&&hasNOs(a));

    // overall progress for this house (DA3 + all audits)
    const da3Weight = da3Pct;
    const auditWeight = indivs.length ? (auditDone/indivs.length)*100 : 100;
    const overallPct = indivs.length ? Math.round((da3Weight+auditWeight)/2) : da3Pct;
    totalTasks += indivs.length+1;
    doneTasks  += auditDone+(da3&&da3.completedAt?1:0);

    // status dot color
    const allDone = (da3&&da3.completedAt) && (indivs.length===0||auditDone===indivs.length);
    const anyStarted = da3Pct>0||auditDone>0;
    const dotClass = allDone?'done':anyStarted?'in-progress':'not-started';

    // inline stat dots
    const da3Ovd = isDA3Overdue();
    const auditOverdue = isAuditOverdue();
    let da3StatCls = da3&&da3.completedAt ? 'green' : da3Pct>0 ? 'amber' : da3Ovd ? 'red' : 'grey';
    let da3StatTxt = da3&&da3.completedAt ? 'DA3 Done' : da3Pct>0 ? `DA3 ${da3Pct}%` : da3Ovd ? 'DA3 Overdue' : 'DA3 Pending';
    let auditStatCls = '', auditStatTxt = '';
    if(indivs.length>0){
      const allAuditsDone = auditDone===indivs.length;
      const auditOvd2 = auditOverdue && auditDone < indivs.length;
      auditStatCls = allAuditsDone ? 'green' : auditOvd2 ? 'red' : auditDone>0 ? 'amber' : 'grey';
      auditStatTxt = `${auditDone}/${indivs.length} Audits`;
    }
    const noChip = hasNo ? `<span class="hhcard-chip chip-red">⚠ NOs</span>` : '';

    return `<div class="home-house-card${h.closed?' closed':''}" onclick="openHouse('${h.id}')">
      <div class="home-house-card-body">
        <div class="home-house-icon">${h.closed?'🔴':'🏠'}</div>
        <div class="home-house-info">
          <div class="home-house-name">${esc(h.name)}</div>
          <div class="house-stats">
            <span class="house-stat ${da3StatCls}"><span class="house-stat-dot"></span>${da3StatTxt}</span>
            ${auditStatTxt ? `<span class="house-stat ${auditStatCls}"><span class="house-stat-dot"></span>${auditStatTxt}</span>` : ''}
            ${noChip}
          </div>
        </div>
        <div class="home-house-chevron">›</div>
      </div>
      <div class="home-house-bar"><div class="home-house-bar-fill" style="width:${overallPct}%"></div></div>
    </div>`;
  }).join('');

  const overallPct = totalTasks ? Math.round((doneTasks/totalTasks)*100) : 0;
  // Drive the SVG ring (circumference 150.8)
  const ringFill = document.getElementById('homeRingFill');
  const ringPct  = document.getElementById('homeRingPct');
  if(ringFill) ringFill.style.strokeDashoffset = 150.8 * (1 - overallPct/100);
  if(ringPct)  ringPct.textContent = overallPct + '%';
  document.getElementById('homeOverallLabel').textContent=`${doneTasks} of ${totalTasks} done`;
  renderRTasks();
}

function openHouse(houseId, mk){
  if(!mk) houseSelectedMk = null; // reset to current month when opening fresh
  currentHouseId = houseId;
  _selectedHouseTasks = new Set();
  _followupHouseTasks = new Set();
  const house = S.houses.find(h=>h.id===houseId);
  if(!house) return;
  if(!mk) mk = houseSelectedMk || mkNow();
  houseSelectedMk = mk;
  const indivs = S.individuals.filter(i=>i.houseId===houseId);
  const da3 = S.da3Visits.find(v=>v.houseId===houseId&&v.monthKey===mk);
  const da3Pct = da3 ? calcDA3Pct(da3) : 0;
  const audits = indivs.map(i=>S.auditVisits.find(v=>v.indivId===i.id&&v.monthKey===mk));
  const auditDone = audits.filter(a=>a&&a.completedAt).length;

  document.getElementById('houseScreenTitle').textContent = house.name;
  document.getElementById('houseMonthNavLbl').textContent = mkLabel(mk);
  document.getElementById('houseMonthFwd').disabled = mk >= mkNow();
  // houseDetailName/Month removed — info lives in app-header now
  const auditOvd = isAuditOverdue();
  document.getElementById('houseDA3Stat').textContent = da3&&da3.completedAt ? '✓ Done' : da3Pct>0 ? da3Pct+'%' : 'Not started';
  const auditStatText = indivs.length ? `${auditDone} / ${indivs.length}${auditOvd && auditDone < indivs.length ? ' ⚠' : ''}` : 'No individuals';
  document.getElementById('houseAuditStat').textContent = auditStatText;

  let html = '';

  // ── House Tasks ──
  const houseTasks = getHouseTasks ? getHouseTasks(houseId) : [];
  if(houseTasks.length > 0 || true) {
    html += `<div style="padding:14px 18px 7px;font-size:0.67rem;font-family:'DM Mono',monospace;text-transform:uppercase;letter-spacing:0.12em;color:var(--muted);">📌 House Tasks</div>`;
    html += renderHouseTasks(houseId);
  }

  // ── DA3 card ──
  html += `<div class="section-label">Monthly Checklist</div>`;
  const da3StatusText = da3&&da3.completedAt ? '✓ Completed' : da3Pct>0 ? 'In progress · '+da3Pct+'%' : 'Not started';
  const da3BarColor = da3&&da3.completedAt ? 'var(--green)' : 'var(--accent)';
  html += `<div class="da3-card" onclick="openDA3('${houseId}')">
    <div class="da3-card-body">
      <div class="da3-card-icon">📋</div>
      <div class="da3-card-info">
        <div class="da3-card-title">DA3 Monthly Checklist</div>
        <div class="da3-card-meta">${da3StatusText}</div>
      </div>
      <div class="da3-card-chevron">›</div>
    </div>
    <div class="da3-card-bar"><div class="da3-card-bar-fill" style="width:${da3Pct}%;background:${da3BarColor}"></div></div>
  </div>`;

  // ── Money Audits ──
  html += `<div class="section-label">Money Audits</div>`;
  indivs.forEach(ind=>{
    const audit = S.auditVisits.find(v=>v.indivId===ind.id&&v.monthKey===mk);
    const pct = audit ? calcAuditPct(audit) : 0;
    const noCount = audit ? Object.entries(audit.answers||{}).filter(([k,v])=>v==='NO'&&NO_FLAG_ITEMS.has(k)).length : 0;
    const auditOvd2 = isAuditOverdue();
    const statusText = audit&&audit.completedAt ? '✓ Completed' : pct>0 ? 'In progress · '+pct+'%' : auditOvd2 ? '⚠ Overdue' : 'Not started';
    // Determine status class
    let statusCls = '';
    if(audit&&audit.completedAt){ statusCls = noCount>0 ? 'status-no' : 'status-done'; }
    else if(pct>0){ statusCls = audit&&audit.sigId ? 'status-saved' : 'status-progress'; }
    html += `<div class="indiv-card ${statusCls}" onclick="openAudit('${ind.id}')">
      <div class="indiv-card-body">
        <div class="indiv-avatar">${esc(initials(ind.name))}</div>
        <div class="indiv-info">
          <div class="indiv-name">${esc(ind.name)}</div>
          <div class="indiv-meta">${statusText}</div>
        </div>
        ${noCount>0?`<div class="no-badge">${noCount} NO</div>`:''}
        <div class="indiv-chevron">›</div>
      </div>
      <div class="indiv-bar"><div class="indiv-bar-fill" style="width:${pct}%"></div></div>
    </div>`;
  });
  html += `<div class="add-indiv-row" onclick="addIndivPrompt('${houseId}')">
    <span style="font-size:1.1rem">＋</span> Add Individual
  </div>`;

  document.getElementById('houseDetailContent').innerHTML = html;
  const bar = document.getElementById('houseTaskActionBar');
  if(bar) bar.classList.remove('visible');
  showScreen('houseScreen');
}

function houseMonthShift(dir){
  if(!houseSelectedMk) houseSelectedMk = mkNow();
  const next = mkAdd(houseSelectedMk, dir);
  if(dir > 0 && next > mkNow()) return;
  houseSelectedMk = next;
  openHouse(currentHouseId, houseSelectedMk);
}

function populateHouseFilter(){
  const sel = document.getElementById('histHouseFilter');
  if(!sel) return;
  const current = sel.value;
  const houses = S.houses||[];
  sel.innerHTML = '<option value="">All Houses</option>' +
    houses.map(h=>`<option value="${h.id}"${current===h.id?' selected':''}>${esc(h.name)}</option>`).join('');
}

function toggleHouseSection(){
  const body = document.getElementById('houseSectionBody');
  const btn  = document.getElementById('houseSectionToggle');
  if(!body) return;
  const open = body.style.display === 'block';
  body.style.display = open ? 'none' : 'block';
  btn.textContent = open ? '&#9660; Expand' : '&#9650; Collapse';
}

function selectTaskType(t){
  selectedTaskType = t;
  document.querySelectorAll('[data-t]').forEach(b=>b.classList.toggle('sel', b.dataset.t===t));
  document.getElementById('rtOnceDateField').style.display = t==='once' ? 'block' : 'none';
  document.getElementById('rtRecurringFields').style.display = t==='recurring' ? 'block' : 'none';
}

function openRTModal(editId=null, houseId=null){
  editingRTId = editId;
  taskModalHouseId = houseId;
  const modal = document.getElementById('rtModal');
  const delBtn = document.getElementById('rtDeleteBtn');
  const title = document.getElementById('rtModalTitle');

  if(editId){
    const all = getAllTasks();
    const t = all.find(x=>x.id===editId);
    if(!t) return;
    title.textContent = 'Edit Task';
    document.getElementById('rtName').value = t.name;
    document.getElementById('rtFreq').value = t.freq||'weekly';
    document.getElementById('rtDay').value = t.day||1;
    document.getElementById('rtTime').value = t.time||'morning';
    document.getElementById('rtNotes').value = t.notes||'';
    document.getElementById('rtCustomInterval').value = t.customInterval||3;
    document.getElementById('rtOnceDate').value = t.onceDate||'';
    document.getElementById('rtSpecificDate').value = t.specificDate||'';
    selectPriority(t.priority||'medium');
    selectTaskType(t.taskType||'recurring');
    selectDayType(t.dayType||'dow');
    delBtn.style.display = 'block';
  } else {
    title.textContent = houseId ? 'New House Task' : 'New Task';
    document.getElementById('rtName').value = '';
    document.getElementById('rtFreq').value = 'weekly';
    document.getElementById('rtDay').value = 1;
    document.getElementById('rtTime').value = 'morning';
    document.getElementById('rtNotes').value = '';
    document.getElementById('rtCustomInterval').value = 3;
    document.getElementById('rtOnceDate').value = '';
    document.getElementById('rtSpecificDate').value = '';
    selectPriority('medium');
    selectTaskType('recurring');
    selectDayType('dow');
    delBtn.style.display = 'none';
  }
  onFreqChange();
  modal.classList.add('open');
}

function closeRTModal(){ document.getElementById('rtModal').classList.remove('open'); }

function closeRTModalOutside(e){ if(e.target===document.getElementById('rtModal')) closeRTModal(); }

function getAllTasks(){ return S.rTasks||[]; }

function getGlobalTasks(){ return (S.rTasks||[]).filter(t=>!t.houseId); }

function getHouseTasks(houseId){ return (S.rTasks||[]).filter(t=>t.houseId===houseId); }

function saveRTask(){
  const name = document.getElementById('rtName').value.trim();
  if(!name){ toast('Please enter a task name'); return; }

  const freq       = document.getElementById('rtFreq').value;
  const day        = parseInt(document.getElementById('rtDay').value);
  const time       = document.getElementById('rtTime').value;
  const notes      = document.getElementById('rtNotes').value.trim();
  const priority   = selectedPriority;
  const taskType   = selectedTaskType;
  const dayType    = selectedDayType;
  const customInterval = parseInt(document.getElementById('rtCustomInterval').value)||3;
  const onceDate   = document.getElementById('rtOnceDate').value;
  const specificDate = document.getElementById('rtSpecificDate').value;

  if(!S.rTasks) S.rTasks = [];

  if(editingRTId){
    const t = S.rTasks.find(x=>x.id===editingRTId);
    if(t) Object.assign(t,{name,freq,day,time,notes,priority,taskType,dayType,customInterval,onceDate,specificDate});
  } else {
    S.rTasks.push({
      id:uid(), name, freq, day, time, notes, priority, taskType, dayType,
      customInterval, onceDate, specificDate,
      houseId: taskModalHouseId||null,
      completions:{}, completedAt:null, createdAt: new Date().toISOString()
    });
  }
  saveS();
  closeRTModal();
  // Re-render the right place
  if(taskModalHouseId){ openHouse(taskModalHouseId); }
  else { renderRTasks(); }
  toast(editingRTId ? 'Task updated!' : 'Task added!');
}

function deleteRTask(){
  if(!editingRTId) return;
  if(!confirm('Delete this task?')) return;
  const t = (S.rTasks||[]).find(x=>x.id===editingRTId);
  const hid = t ? t.houseId : null;
  S.rTasks = (S.rTasks||[]).filter(t=>t.id!==editingRTId);
  saveS();
  closeRTModal();
  if(hid){ openHouse(hid); }
  else { renderRTasks(); }
  toast('Task deleted');
}

function toggleRTask(id, fromHouse=false){
  if(!S.rTasks) return;
  const t = S.rTasks.find(x=>x.id===id);
  if(!t) return;
  if(!t.completions) t.completions={};

  if(t.taskType==='once'){
    t.completedAt = t.completedAt ? null : new Date().toISOString();
  } else {
    const ck = cycleKey(t);
    t.completions[ck] = !t.completions[ck];
  }
  saveS();
  if(fromHouse && t.houseId){ openHouse(t.houseId); }
  else { renderRTasks(); }
}

function getWeekStart(now, anchorDate){
  const dayTarget = anchorDate.getDay();
  const d = new Date(now);
  let diff = d.getDay() - dayTarget;
  if(diff < 0) diff += 7;
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0,10);
}

function getBiweeklyStart(t, now){
  let anchor;
  if(t.dayType==='date' && t.specificDate){
    anchor = new Date(t.specificDate+'T00:00:00');
  } else {
    anchor = new Date('2024-01-07T00:00:00'); // a Monday
    // advance to target day of week
    while(anchor.getDay()!==(t.day||1)) anchor.setDate(anchor.getDate()+1);
  }
  const msPerCycle = 14*864e5;
  const diff = now - anchor;
  if(diff < 0) return anchor.toISOString().slice(0,10);
  const cycleStart = new Date(anchor.getTime() + Math.floor(diff/msPerCycle)*msPerCycle);
  return cycleStart.toISOString().slice(0,10);
}

function getTaskDueDate(t){
  const now = new Date(); now.setHours(0,0,0,0);

  if(t.taskType==='once'){
    if(t.onceDate) return new Date(t.onceDate+'T00:00:00');
    return now;
  }

  const freq = t.freq||'weekly';
  if(freq==='daily') return new Date(now);

  if(freq==='weekly'){
    if(t.dayType==='date' && t.specificDate){
      // Anchor date: find next occurrence on same weekday starting from anchor
      const anchor = new Date(t.specificDate+'T00:00:00');
      const d = new Date(anchor);
      while(d < now) d.setDate(d.getDate()+7);
      return d;
    }
    const dayTarget = t.day||1;
    const d = new Date(now);
    let diff = dayTarget - d.getDay();
    if(diff < 0) diff += 7;
    d.setDate(d.getDate()+diff);
    return d;
  }

  if(freq==='biweekly'){
    const bwStart = getBiweeklyStart(t, now);
    const cycleStart = new Date(bwStart+'T00:00:00');
    const dayTarget = t.dayType==='date'&&t.specificDate ? new Date(t.specificDate+'T00:00:00').getDay() : (t.day||1);
    const d = new Date(cycleStart);
    while(d.getDay()!==dayTarget) d.setDate(d.getDate()+1);
    if(d < now){
      // Next biweekly cycle
      d.setDate(d.getDate()+14);
    }
    return d;
  }

  if(freq==='monthly'){
    if(t.dayType==='date' && t.specificDate){
      // Use the exact day-of-month from the anchor (e.g. the 9th every month)
      const anchor = new Date(t.specificDate+'T00:00:00');
      const dayOfMonth = anchor.getDate();
      // Start from anchor month if anchor >= today, otherwise find next month where this date >= today
      const d = new Date(anchor.getFullYear(), anchor.getMonth(), dayOfMonth);
      while(d < now) d.setMonth(d.getMonth()+1);
      return d;
    }
    // Day-of-week based monthly (e.g. first Monday)
    const dayTarget = t.day||1;
    const d = new Date(now.getFullYear(), now.getMonth(), 1);
    while(d.getDay()!==dayTarget) d.setDate(d.getDate()+1);
    if(d < now){ d.setMonth(d.getMonth()+1); d.setDate(1); while(d.getDay()!==dayTarget) d.setDate(d.getDate()+1); }
    return d;
  }

  if(freq==='custom'){
    const ref = t.specificDate ? new Date(t.specificDate+'T00:00:00') : new Date('2024-01-01');
    const interval = t.customInterval||3;
    const diff = Math.floor((now - ref)/864e5);
    const nextCycle = (Math.floor(diff/interval)+1)*interval;
    return new Date(ref.getTime()+nextCycle*864e5);
  }

  return now;
}

function sortByPriority(a,b){
  const po={high:0,medium:1,low:2};
  return (po[a.priority||'medium'])-(po[b.priority||'medium']);
}

function partitionTasks(tasks){
  // Returns {overdue, active, completed} — all sorted by priority
  const overdue=[], active=[], completed=[];
  tasks.forEach(t=>{
    const b=dueBadgeInfo(t);
    if(b.hide) return; // skip archived
    if(b.isDone) completed.push(t);
    else if(b.cls==='overdue') overdue.push(t);
    else active.push(t);
  });
  // Sort by actual due date ascending; priority as tiebreaker
  const getMs = t => { try{ return getTaskDueDate(t).getTime(); } catch(e){ return 0; } };
  active.sort((a,b)=>{
    const diff = getMs(a) - getMs(b);
    if(diff !== 0) return diff;
    return sortByPriority(a,b);
  });
  // Overdue: most recently overdue first (closest to today), priority as tiebreaker
  overdue.sort((a,b)=>{
    const diff = getMs(b) - getMs(a);
    if(diff !== 0) return diff;
    return sortByPriority(a,b);
  });
  completed.sort((a,b)=>{
    const diff = getMs(a) - getMs(b);
    if(diff !== 0) return diff;
    return sortByPriority(a,b);
  });
  return {overdue,active,completed};
}

function renderTaskCard(t, fromHouse=false, extraClass=''){
  const badge = dueBadgeInfo(t);
  if(badge.hide) return '';
  const isDone = badge.isDone;
  const priClass = t.priority||'medium';
  const houseArg = fromHouse ? 'true' : 'false';
  return `<div class="rt-card${extraClass}">
    <div class="rt-card-body">
      <div class="rt-check${isDone?' done':badge.cls==='overdue'?' overdue':''}" onclick="toggleRTask('${t.id}',${houseArg})">
        ${isDone?'✓':''}
      </div>
      <div class="rt-info" onclick="openRTModal('${t.id}')">
        <div class="rt-name${isDone?' done':''}">${esc(t.name)}</div>
        <div class="rt-meta">${freqLabel(t)}${t.notes?' · '+esc(t.notes.slice(0,35)):''}</div>
      </div>
      <div class="rt-right">
        <div class="rt-priority ${priClass}"></div>
        <span class="rt-due-badge ${badge.cls}">${badge.label}</span>
      </div>
    </div>
  </div>`;
}

function rtTaskMatchesFilter(t){
  const f = rtFilterState || 'all';
  if(f === 'all') return true;
  if(f === 'hidden') return false;
  const todayStr = new Date().toISOString().slice(0,10);
  const tom = new Date(); tom.setDate(tom.getDate()+1);
  const tomStr = tom.toISOString().slice(0,10);
  const monthPfx = todayStr.slice(0,7);
  if(t.taskType === 'once'){
    const d = t.onceDate || '';
    if(f === 'today-tomorrow') return d === todayStr || d === tomStr;
    if(f === 'month') return d.startsWith(monthPfx);
    return true;
  }
  const badge = dueBadgeInfo(t);
  if(badge.hide) return true;
  if(f === 'today-tomorrow'){
    if(badge.cls === 'overdue') return true;
    try{ const nd = getTaskDueDate(t); const ns = nd.toISOString().slice(0,10); return ns===todayStr||ns===tomStr; }catch(e){ return true; }
  }
  if(f === 'month'){
    if(badge.cls === 'overdue') return true;
    try{ const nd = getTaskDueDate(t); return nd.toISOString().slice(0,7)===monthPfx; }catch(e){ return true; }
  }
  return true;
}

function renderRTasks(){
  const container = document.getElementById('rtList');
  if(!container) return;
  const rtLabels = {'today-tomorrow':'Today & Tomorrow','month':'This Month','all':'All Tasks','hidden':'Tasks Hidden'};
  const rtBtn = document.getElementById('rtFilterBtn');
  if(rtBtn) rtBtn.textContent = (rtLabels[rtFilterState] || 'All Tasks') + ' ›';
  const all = getGlobalTasks();
  if(all.length===0){
    container.innerHTML=`<div class="rt-empty" onclick="openRTModal()">No tasks yet — tap to add your first task</div>`;
    return;
  }

  // Separate ICS (calendar) tasks from regular tasks
  const icsTasks = all.filter(t=>t.fromICS);
  const regularTasks = all.filter(t=>!t.fromICS);
  const filteredRegular = regularTasks.filter(t=>rtTaskMatchesFilter(t));
  const {overdue,active,completed} = partitionTasks(filteredRegular);

  let html = '';
  if(rtFilterState !== 'hidden'){
    if(overdue.length) html += renderOverdueBanner(overdue);
    if(overdue.length) html += overdue.map(t=>renderTaskCard(t,false)).join('');
    html += active.map(t=>renderTaskCard(t,false)).join('');
    html += renderCompletedSection(completed, false);
    if(!overdue.length && !active.length && !completed.length && regularTasks.length > 0){
      const label = rtFilterState==='today-tomorrow'?'today or tomorrow':rtFilterState==='month'?'this month':'';
      html += `<div style="text-align:center;padding:10px;font-size:0.78rem;color:var(--muted);">No tasks due${label?' '+label:''}</div>`;
    }
  } else {
    html += `<div style="text-align:center;padding:10px;font-size:0.78rem;color:var(--muted);">${regularTasks.length} task${regularTasks.length!==1?'s':''} hidden</div>`;
  }

  // ICS/Calendar section with 3-state collapse
  if(icsTasks.length){
    const todayStr2 = new Date().toISOString().slice(0,10);
    const stateLabels = {'today':'Today & Tomorrow','all':'Show All','none':'Hidden'};
    const nextState = {'today':'all','all':'none','none':'today'};
    const nextLabel = {'today':'Today & Tomorrow','all':'Show All','none':'Hidden'};

    // Filter tasks based on collapse state
    let visibleICS = [];
    if(calCollapseState === 'today'){
      const tomStr2 = new Date(new Date().setDate(new Date().getDate()+1)).toISOString().slice(0,10);
      visibleICS = icsTasks.filter(t=>{
        const taskDate = t.onceDate || (t.nextDue ? t.nextDue.slice(0,10) : null);
        return taskDate === todayStr2 || taskDate === tomStr2;
      });
    } else if(calCollapseState === 'all'){
      visibleICS = icsTasks;
    } else {
      visibleICS = []; // none
    }
    // Sort by onceDate ascending
    visibleICS = visibleICS.slice().sort((a,b)=>{
      const da = a.onceDate||''; const db = b.onceDate||'';
      return da < db ? -1 : da > db ? 1 : 0;
    });

    html += `<div class="rt-section-hdr" style="margin-top:12px;padding:0 2px;">
      <span class="rt-section-title" style="font-size:0.75rem;">📅 Calendar</span>
      <button class="ics-collapse-btn" onclick="cycleCalCollapse()">${stateLabels[calCollapseState]} ›</button>
    </div>`;

    if(calCollapseState === 'none'){
      html += `<div style="text-align:center;padding:10px;font-size:0.78rem;color:var(--muted);">${icsTasks.length} calendar event${icsTasks.length!==1?'s':''} hidden</div>`;
    } else if(visibleICS.length === 0){
      html += `<div style="text-align:center;padding:10px;font-size:0.78rem;color:var(--muted);">No ${calCollapseState==='today'?'events today or tomorrow':'calendar events'}</div>`;
    } else {
      html += visibleICS.map(t=>renderTaskCard(t,false)).join('');
    }
  }

  if(!html.trim()) html = `<div class="rt-empty" onclick="openRTModal()">All tasks done or archived — tap to add more</div>`;
  container.innerHTML = html;
}

function cycleRtFilter(){
  const next = {'today-tomorrow':'month','month':'all','all':'hidden','hidden':'today-tomorrow'};
  rtFilterState = next[rtFilterState] || 'all';
  renderRTasks();
}

function renderHouseTasks(houseId){
  const all = getHouseTasks(houseId);
  if(all.length===0){
    return `<div class="add-indiv-row" onclick="openRTModal(null,'${houseId}')"><span style="font-size:1.1rem">＋</span> Add House Task</div>`;
  }
  const {overdue,active,completed} = partitionTasks(all);
  let html = '';
  if(overdue.length) html += renderOverdueBanner(overdue);
  if(overdue.length) html += overdue.map(t=>renderTaskCardSelectable(t)).join('');
  html += active.map(t=>renderTaskCardSelectable(t)).join('');
  html += renderCompletedSection(completed, true);
  html += `<div class="add-indiv-row" onclick="openRTModal(null,'${houseId}')"><span style="font-size:1.1rem">＋</span> Add House Task</div>`;
  return html;
}

function renderTaskCardSelectable(t){
  const badge = dueBadgeInfo(t);
  if(badge.hide) return '';
  const isDone = badge.isDone;
  const isSel = _selectedHouseTasks.has(t.id);
  const isFollowup = _followupHouseTasks.has(t.id);
  const extraCls = isSel ? ' task-selected' : isFollowup ? ' task-followup' : '';
  const icon = isSel ? '☑' : isFollowup ? '↩' : '';
  return `<div class="rt-card${extraCls}" onclick="toggleHouseTaskSelect('${t.id}')">
    <div class="rt-card-body">
      <div class="rt-check${isDone?' done':badge.cls==='overdue'?' overdue':''}" style="pointer-events:none;">
        ${isDone?'✓':icon}
      </div>
      <div class="rt-info">
        <div class="rt-name${isDone?' done':''}">${esc(t.name)}</div>
        <div class="rt-meta">${freqLabel(t)}${t.notes?' · '+esc(t.notes.slice(0,35)):''}</div>
      </div>
      <div class="rt-right">
        <div class="rt-priority ${t.priority||'medium'}"></div>
        <span class="rt-due-badge ${badge.cls}">${badge.label}</span>
        <button class="rt-menu-btn" onclick="event.stopPropagation();openRTModal('${t.id}')" style="margin-left:4px;">⋯</button>
      </div>
    </div>
  </div>`;
}

function toggleHouseTaskSelect(taskId){
  if(_selectedHouseTasks.has(taskId)){
    _selectedHouseTasks.delete(taskId);
  } else if(_followupHouseTasks.has(taskId)){
    _followupHouseTasks.delete(taskId);
  } else {
    _selectedHouseTasks.add(taskId);
  }
  updateHouseTaskActionBar();
  // Re-render just the tasks section
  const contentEl = document.getElementById('houseDetailContent');
  if(contentEl){
    // Re-render only the house tasks portion by updating affected card classes
    contentEl.querySelectorAll('.rt-card').forEach(card=>{
      const onclick = card.getAttribute('onclick')||'';
      const m = onclick.match(/'([^']+)'/);
      if(!m) return;
      const tid = m[1];
      card.classList.toggle('task-selected', _selectedHouseTasks.has(tid));
      card.classList.toggle('task-followup', _followupHouseTasks.has(tid));
      const check = card.querySelector('.rt-check');
      if(check){
        check.textContent = _selectedHouseTasks.has(tid) ? '☑' : _followupHouseTasks.has(tid) ? '↩' : '';
      }
    });
  }
}

function updateHouseTaskActionBar(){
  const bar = document.getElementById('houseTaskActionBar');
  const countBar = document.getElementById('htaCountBar');
  const countEl = document.getElementById('htaCount');
  const total = _selectedHouseTasks.size + _followupHouseTasks.size;
  if(!bar) return;
  if(total === 0){
    bar.classList.remove('visible');
    if(countBar) countBar.classList.remove('visible');
  } else {
    bar.classList.add('visible');
    if(countBar) countBar.classList.add('visible');
    let label = '';
    if(_selectedHouseTasks.size > 0 && _followupHouseTasks.size > 0){
      label = `${_selectedHouseTasks.size} selected · ${_followupHouseTasks.size} follow-up`;
    } else if(_selectedHouseTasks.size > 0){
      label = `${_selectedHouseTasks.size} task${_selectedHouseTasks.size>1?'s':''} selected`;
    } else {
      label = `${_followupHouseTasks.size} follow-up`;
    }
    if(countEl) countEl.textContent = label;
  }
}

function houseTaskAction(action){
  const selectedIds = [..._selectedHouseTasks];
  if(action === 'complete'){
    selectedIds.forEach(id=>{
      const t = (S.rTasks||[]).find(t=>t.id===id);
      if(t) toggleRTask(id, true);
    });
    _selectedHouseTasks.clear();
    _followupHouseTasks.clear();
    updateHouseTaskActionBar();
    if(currentHouseId) openHouse(currentHouseId, houseSelectedMk);
    toast('Tasks marked complete');
  } else if(action === 'followup'){
    selectedIds.forEach(id=>{
      _selectedHouseTasks.delete(id);
      _followupHouseTasks.add(id);
    });
    updateHouseTaskActionBar();
    // Update card classes
    if(document.getElementById('houseDetailContent')){
      document.getElementById('houseDetailContent').querySelectorAll('.rt-card').forEach(card=>{
        const onclick = card.getAttribute('onclick')||'';
        const m = onclick.match(/'([^']+)'/);
        if(!m) return;
        const tid = m[1];
        card.classList.toggle('task-selected', _selectedHouseTasks.has(tid));
        card.classList.toggle('task-followup', _followupHouseTasks.has(tid));
        const check = card.querySelector('.rt-check');
        if(check) check.textContent = _followupHouseTasks.has(tid)?'↩':_selectedHouseTasks.has(tid)?'☑':'';
      });
    }
    toast('Marked for follow-up');
  } else if(action === 'email'){
    if(selectedIds.length === 0){ toast('No tasks selected'); return; }
    const taskNames = selectedIds.map(id=>{
      const t = (S.rTasks||[]).find(t=>t.id===id);
      return t ? t.name : '';
    }).filter(Boolean);
    const house = S.houses.find(h=>h.id===currentHouseId);
    // Find email list matching house name
    const houseName = house ? house.name : '';
    const matchList = (S.emailLists||[]).find(l=>l.name&&l.name.toLowerCase().includes(houseName.toLowerCase().split(' ')[0]));
    const to = matchList ? matchList.emails.join(';') : '';
    const subject = encodeURIComponent(`House Tasks — ${houseName}`);
    const body = encodeURIComponent(`Hi,\n\nPlease see the following tasks that need attention:\n\n${taskNames.map(n=>`• ${n}`).join('\n')}\n\nThank you`);
    window.location.href = `mailto:${encodeURIComponent(to)}?subject=${subject}&body=${body}`;
    _selectedHouseTasks.clear();
    _followupHouseTasks.clear();
    updateHouseTaskActionBar();
  }
}
