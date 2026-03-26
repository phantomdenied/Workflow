/* Settings feature extracted from index2.html (phase 3) */
/* Keeps the existing Firebase/auth/state behavior; this is a structural split only. */

function toggleSettingsSection(bodyId, hdrEl){
  const body = document.getElementById(bodyId);
  if(!body) return;
  const isOpen = body.classList.contains('open');
  body.classList.toggle('open');
  if(hdrEl) hdrEl.classList.toggle('open');
}

function renderSettings(){
  document.getElementById('sStaffName').value=S.staffName||'';
  document.getElementById('sStaffTitle').value=S.staffTitle||'';
  document.getElementById('sICSUrl').value=S.icsUrl||'';
  document.getElementById('sICSAutoSync').checked=!!S.icsAutoSync;
  const dmTog=document.getElementById('darkModeToggle'); if(dmTog) dmTog.checked=!!S.darkMode;
  const akEl=document.getElementById('sApiKey');
  const akStatus=document.getElementById('apiKeyStatus');
  if(akEl) akEl.value='';
  if(akStatus){
    if(S.anthropicKey){ akStatus.textContent='✓ Key saved: AIza...'+S.anthropicKey.slice(-6); akStatus.style.color='var(--green)'; }
    else { akStatus.textContent='No key set'; akStatus.style.color='var(--muted)'; }
  }
  // Houses
  const hl=document.getElementById('sHouseList');
  hl.innerHTML = S.houses.length===0
    ? `<div style="text-align:center;padding:14px;color:var(--muted);font-size:0.82rem;">No houses yet — add one below.</div>`
    : S.houses.map(h=>houseRowHTML(h.id,h.name,!!h.closed)).join('');
  // Populate house dropdown for new individual
  const hSel=document.getElementById('sNewIndivHouse');
  if(hSel) hSel.innerHTML=S.houses.map(h=>`<option value="${h.id}">${esc(h.name)}</option>`).join('');
  // Individuals grouped by house
  const il=document.getElementById('sIndivList');
  if(S.individuals.length===0){
    il.innerHTML=`<div style="text-align:center;padding:14px;color:var(--muted);font-size:0.82rem;">No individuals yet.</div>`;
    return;
  }
  let html='';
  S.houses.forEach(h=>{
    const inds=S.individuals.filter(i=>i.houseId===h.id);
    if(!inds.length) return;
    html+=`<div class="indiv-house-lbl">&#128205; ${esc(h.name)}</div>`;
    inds.forEach(ind=>{
      html+=`<div class="settings-card" id="ic_${ind.id}" style="margin-bottom:7px">
        <div class="settings-row">
          <div class="s-field"><div class="s-lbl">Name</div><input class="s-input" id="ii_${ind.id}" value="${esc(ind.name)}" placeholder="Full name"></div>
          <button class="del-btn" onclick="removeIndiv('${ind.id}')">&#10005;</button>
        </div></div>`;
    });
  });
  il.innerHTML=html||`<div style="text-align:center;padding:14px;color:var(--muted);font-size:0.82rem;">Add houses first.</div>`;
}

function houseRowHTML(id, name, closed=false){
  return `<div class="settings-card" id="hc_${id}" style="margin-bottom:7px">
    <div class="settings-row" style="align-items:flex-start;">
      <div class="s-field" style="flex:1;">
        <div class="s-lbl">House Name</div>
        <input class="s-input" id="hi_${id}" value="${esc(name)}" placeholder="e.g. 123 Maple Street">
        <label style="display:flex;align-items:center;gap:7px;margin-top:9px;font-size:0.82rem;cursor:pointer;">
          <input type="checkbox" id="hclosed_${id}" ${closed?'checked':''} style="width:16px;height:16px;">
          <span style="color:var(--red);font-weight:600;">Mark as Closed Site</span>
        </label>
      </div>
      <button class="del-btn" onclick="removeHouseRow('${id}')" style="margin-top:22px;">&#10005;</button>
    </div></div>`;
}

function addHouseRow(){
  const nameInput = document.getElementById('sNewHouseName');
  const name = nameInput ? nameInput.value.trim() : '';
  if(!name){ toast('Enter a house name first'); return; }
  const id = uid();
  const d = document.createElement('div');
  d.innerHTML = houseRowHTML(id, name, false);
  document.getElementById('sHouseList').appendChild(d.firstElementChild);
  if(nameInput) nameInput.value='';
  // Update house dropdown
  const hSel=document.getElementById('sNewIndivHouse');
  if(hSel) hSel.innerHTML+=`<option value="${id}">${esc(name)}</option>`;
  toast('House added — save settings to keep it');
}

function removeHouseRow(id){ document.getElementById(`hc_${id}`)?.remove(); }

function saveSettings(){
  S.staffName=document.getElementById('sStaffName').value.trim();
  S.staffTitle=document.getElementById('sStaffTitle').value.trim();
  S.icsUrl=(document.getElementById('sICSUrl').value||'').trim().replace(/^webcal:/i,'https:');
  S.icsAutoSync=document.getElementById('sICSAutoSync').checked;
  // Houses — preserve existing data (da3Comments, etc.)
  const newHouses=[];
  document.querySelectorAll('#sHouseList .settings-card').forEach(card=>{
    const rawId=card.id.replace('hc_','');
    const nameEl=document.getElementById(`hi_${rawId}`);
    const closedEl=document.getElementById(`hclosed_${rawId}`);
    const name=nameEl?nameEl.value.trim():'';
    if(!name) return;
    const existing=S.houses.find(h=>h.id===rawId);
    newHouses.push({...(existing||{}), id:existing?rawId:uid(), name, closed:closedEl?closedEl.checked:false});
  });
  S.houses=newHouses;
  // Individuals
  const newIndivs=[];
  document.querySelectorAll('#sIndivList .settings-card').forEach(card=>{
    const rawId=card.id.replace('ic_','');
    const nameEl=document.getElementById(`ii_${rawId}`);
    const houseEl=document.getElementById(`ih_${rawId}`);
    const name=nameEl?nameEl.value.trim():'';
    if(!name) return;
    const existing=S.individuals.find(i=>i.id===rawId);
    const houseId=houseEl?houseEl.value:(existing?.houseId||S.houses[0]?.id||'');
    if(existing){ newIndivs.push({...existing,name,houseId}); }
    else { newIndivs.push({id:uid(),name,houseId}); }
  });
  S.individuals=newIndivs;
  saveS();
  toast('Settings saved!');
  showScreen('homeScreen');
}

function handleICSImport(event){
  const file = event.target.files[0];
  if(!file) return;
  // Reset input so same file can be re-imported
  event.target.value = '';
  const reader = new FileReader();
  reader.onload = (e) => parseAndImportICS(e.target.result, file.name);
  reader.onerror = () => showICSStatus('Could not read file.', 'error');
  reader.readAsText(file);
}

function parseAndImportICS(text, filename){
  showICSStatus('Reading ' + filename + '…', 'info');
  try {
    const events = parseICS(text);
    if(!events.length){
      showICSStatus('No events found in this file.', 'error');
      return;
    }
    let added = 0, skipped = 0;
    if(!S.rTasks) S.rTasks = [];
    events.forEach(ev => {
      // Skip all-day events with no time if name is empty
      if(!ev.summary) { skipped++; return; }
      // Check for duplicate (same name + date)
      const already = S.rTasks.find(t =>
        t.icsUid === ev.uid ||
        (t.name === ev.summary && t.onceDate === ev.date)
      );
      if(already){ skipped++; return; }
      S.rTasks.push({
        id: uid(),
        name: ev.summary,
        taskType: 'once',
        onceDate: ev.date,
        icsUid: ev.uid || null,
        icsTime: ev.time || null,
        notes: ev.location ? '📍 ' + ev.location : (ev.description ? ev.description.slice(0,80) : ''),
        priority: 'medium',
        dayType: 'dow',
        freq: 'weekly',
        day: 1,
        time: 'morning',
        houseId: null,
        completions: {},
        completedAt: null,
        createdAt: new Date().toISOString(),
        fromICS: true,
      });
      added++;
    });
    saveS();
    renderRTasks();
    const msg = added
      ? `✓ Imported ${added} event${added!==1?'s':''}${skipped?' ('+skipped+' duplicates skipped)':''}` 
      : `Nothing new — ${skipped} duplicate${skipped!==1?'s':''} skipped`;
    showICSStatus(msg, added ? 'success' : 'info');
  } catch(err) {
    console.error(err);
    showICSStatus('Error parsing file: ' + err.message, 'error');
  }
}

function showICSStatus(msg, type){
  const el = document.getElementById('icsImportStatus');
  if(!el) return;
  el.style.display = 'block';
  el.innerHTML = `<div class="ics-status ${type}">${msg}</div>`;
  if(type !== 'error') setTimeout(()=>{ el.style.display='none'; }, 4000);
}

function parseICS(text){
  const events = [];
  let normalized = '';
  for(let i=0;i<text.length;i++){
    const ch=text[i], next=text[i+1];
    if(ch==='\r'&&next==='\n'){normalized+='\n';i++;}
    else if(ch==='\n'&&(next===' '||next==='\t')){i++;}
    else{normalized+=ch;}
  }
  const lines = normalized.split('\n');
  let inEvent=false, current={};
  lines.forEach(function(raw){
    const line=raw.trim();
    if(line==='BEGIN:VEVENT'){inEvent=true;current={};return;}
    if(line==='END:VEVENT'){inEvent=false;if(current.summary&&current.date)events.push(Object.assign({},current));return;}
    if(!inEvent) return;
    const ci=line.indexOf(':');
    if(ci===-1) return;
    const propFull=line.slice(0,ci).toUpperCase();
    const val=line.slice(ci+1).trim();
    const propName=propFull.split(';')[0];
    if(propName==='SUMMARY') current.summary=unescapeICS(val);
    else if(propName==='UID') current.uid=val;
    else if(propName==='LOCATION') current.location=unescapeICS(val);
    else if(propName==='DESCRIPTION') current.description=unescapeICS(val);
    else if(propName==='DTSTART'){const p=parseICSDate(val);if(p){current.date=p.date;current.time=p.time;}}
  });
  return events;
}

function parseICSDate(val){
  const v=val.replace('Z','');
  if(v.length===8){
    return {date:v.slice(0,4)+'-'+v.slice(4,6)+'-'+v.slice(6,8),time:null};
  }
  if(v.length>=15&&v.charAt(8)==='T'){
    const yr=v.slice(0,4),mo=v.slice(4,6),dy=v.slice(6,8);
    const h=parseInt(v.slice(9,11),10),mn=v.slice(11,13);
    const ampm=h>=12?'PM':'AM';
    const h12=(h%12)||12;
    return {date:yr+'-'+mo+'-'+dy,time:h12+':'+mn+' '+ampm};
  }
  return null;
}

function unescapeICS(s){
  let r='';
  for(let i=0;i<s.length;i++){
    if(s[i]==='\\'&&i+1<s.length){
      const n=s[i+1];
      if(n==='n'){r+='\n';i++;}
      else if(n===','){r+=',';i++;}
      else if(n===';'){r+=';';i++;}
      else if(n==='\\'){r+='\\';i++;}
      else r+=s[i];
    } else {r+=s[i];}
  }
  return r;
}

async function syncICSNow(){
  const url = (S.icsUrl||'').trim();
  if(!url){
    toast('No calendar URL saved — add one in Settings');
    showScreen('settingsScreen');
    return;
  }
  const statusEl = document.getElementById('sICSStatus');
  if(statusEl){ statusEl.style.display='block'; statusEl.innerHTML='<div class="ics-status info">⏳ Fetching calendar…</div>'; }
  showICSStatus('⏳ Syncing calendar…','info');

  // Try each proxy in sequence until one works
  async function tryFetch(proxyUrl, timeoutMs){
    return Promise.race([
      fetch(proxyUrl),
      new Promise((_,r)=>setTimeout(()=>r(new Error('timeout')),timeoutMs))
    ]);
  }
  async function fetchViaProxies(targetUrl){
    const proxies = [
      u => 'https://corsproxy.io/?' + encodeURIComponent(u),
      u => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u),
      u => 'https://thingproxy.freeboard.io/fetch/' + u,
      u => 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(u),
    ];
    let lastErr;
    for(const buildUrl of proxies){
      try {
        const r = await tryFetch(buildUrl(targetUrl), 8000);
        if(r.ok) return r;
        lastErr = new Error('HTTP ' + r.status);
      } catch(e){ lastErr = e; }
    }
    throw lastErr || new Error('All proxies failed');
  }

  try {
    let fetchUrl = url.replace(/^webcal:/i,'https:');
    if(fetchUrl.endsWith('.html')) fetchUrl = fetchUrl.slice(0,-5)+'.ics';
    let resp;
    // Try direct first (non-Microsoft), then fall through to proxies
    try {
      resp = await tryFetch(fetchUrl, 6000);
      if(!resp.ok) throw new Error('HTTP ' + resp.status);
    } catch(e){
      resp = await fetchViaProxies(fetchUrl);
    }
    if(!resp.ok) throw new Error('HTTP ' + resp.status);
    const text = await resp.text();
    const events = parseICS(text);
    if(!events.length){
      const msg = 'No events found in calendar feed.';
      showICSStatus(msg,'error');
      if(statusEl){ statusEl.innerHTML=`<div class="ics-status error">${msg}</div>`; }
      return;
    }
    if(!S.rTasks) S.rTasks=[];
    let added=0, skipped=0;
    // Only import events from today onwards
    const todayDate = new Date(); todayDate.setHours(0,0,0,0);
    events.forEach(ev=>{
      if(!ev.summary||!ev.date){ skipped++; return; }
      const evDate = new Date(ev.date+'T00:00:00');
      if(evDate < todayDate){ skipped++; return; } // skip past events
      const already = S.rTasks.find(t=>
        t.icsUid && t.icsUid===ev.uid ||
        (!t.icsUid && t.name===ev.summary && t.onceDate===ev.date)
      );
      if(already){ skipped++; return; }
      S.rTasks.push({
        id:uid(), name:ev.summary, taskType:'once',
        onceDate:ev.date, icsUid:ev.uid||null, icsTime:ev.time||null,
        notes:ev.location?'📍 '+ev.location:(ev.description?ev.description.slice(0,80):''),
        priority:'medium', dayType:'dow', freq:'weekly', day:1, time:'morning',
        houseId:null, completions:{}, completedAt:null,
        createdAt:new Date().toISOString(), fromICS:true,
      });
      added++;
    });
    saveS();
    renderRTasks();
    S.icsLastSync = new Date().toISOString();
    saveS();
    const msg = added
      ? `✓ Synced ${added} new event${added!==1?'s':''}${skipped?' ('+skipped+' skipped)':''}`
      : `Up to date — ${skipped} event${skipped!==1?'s':''} already imported`;
    showICSStatus(msg, added?'success':'info');
    if(statusEl){ statusEl.innerHTML=`<div class="ics-status ${added?'success':'info'}">${msg}</div>`; }
    // Auto-hide status after 4s
    if(statusEl) setTimeout(()=>{ statusEl.style.display='none'; }, 4500);
  } catch(err){
    console.error('ICS fetch error:',err);
    const msg = `Sync failed: ${err.message}. Check the URL in Settings.`;
    showICSStatus(msg,'error');
    if(statusEl){ statusEl.innerHTML=`<div class="ics-status error">${msg}</div>`; }
  }
}

async function autoSyncICS(){
  if(!S.icsUrl||!S.icsAutoSync) return;
  if(S.icsLastSync){
    const sinceMs = Date.now() - new Date(S.icsLastSync).getTime();
    if(sinceMs < 60*60*1000) return;
  }
  try {
    await syncICSNow();
    showHomeICSBanner('success');
  } catch(e) {
    showHomeICSBanner('error');
  }
}

function showHomeICSBanner(type){
  const banner = document.getElementById('homeICSBanner');
  if(!banner) return;
  if(type === 'success'){
    banner.style.display = 'block';
    banner.style.background = 'var(--green-light,#f0faf4)';
    banner.style.borderColor = 'var(--green)';
    banner.style.color = 'var(--green)';
    banner.innerHTML = '✓ Calendar synced successfully';
    setTimeout(()=>{ banner.style.display='none'; }, 4000);
  } else {
    banner.style.display = 'block';
    banner.style.background = '#fff1f1';
    banner.style.borderColor = 'var(--red)';
    banner.style.color = 'var(--red)';
    banner.innerHTML = '⚠ Calendar sync failed — check URL in Settings';
    setTimeout(()=>{ banner.style.display='none'; }, 6000);
  }
}

function toggleDarkMode(on){
  document.body.classList.toggle('dark', on);
  S.darkMode = on;
  saveS();
  const tog = document.getElementById('darkModeToggle');
  if(tog) tog.checked = on;
}

function applyDarkMode(){
  const on = !!S.darkMode;
  document.body.classList.toggle('dark', on);
  const tog = document.getElementById('darkModeToggle');
  if(tog) tog.checked = on;
}

function exportDataBackup(){
  const exportData = {
    _exportedAt: new Date().toISOString(),
    _version: 1,
    ...S
  };
  // Strip in-memory photo data — photos are device-local (IndexedDB)
  if(exportData.notes){
    exportData.notes = exportData.notes.map(n=>{ const {photoData,...rest}=n; return rest; });
  }
  const json = JSON.stringify(exportData, null, 2);
  const blob = new Blob([json], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const mm = String(new Date().getMonth()+1).padStart(2,'0');
  const dd = String(new Date().getDate()).padStart(2,'0');
  const yy = String(new Date().getFullYear()).slice(-2);
  const a = document.createElement('a');
  a.href = url; a.download = `workflow_backup_${mm}${dd}${yy}.json`; a.click();
  URL.revokeObjectURL(url);
  toast('✓ Backup exported');
}

function importDataBackup(event){
  const file = event.target.files[0];
  event.target.value = '';
  if(!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const imported = JSON.parse(e.target.result);
      // Accept both plain backups and encrypted blobs; plain always works
      if(!imported._exportedAt && !imported._enc) throw new Error('Invalid backup file');
      _pendingImportData = imported;
      document.getElementById('importMergeModal').classList.add('open');
    } catch(err) {
      console.error(err);
      toast('Import failed: ' + err.message);
      const statusEl = document.getElementById('dataSyncStatus');
      if(statusEl){ statusEl.style.display='block'; statusEl.textContent='✗ Import failed: ' + err.message; }
    }
  };
  reader.readAsText(file);
}

async function doSignOut(){
  if(!confirm('Sign out of WorkFlow?'))return;
  await window._fbSignOut();
  showLoginScreen();
  showScreen('homeScreen');
}
