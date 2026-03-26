/* Receiving feature UI/actions extracted from index2.html (phase 1) */
/* This file intentionally relies on the existing global app state and helpers. */

function invInit(){
  invPhotos = [];
  invRowCount = 0;
  document.getElementById('invPhotoGrid').innerHTML = '';

  // Populate house select
  const sel = document.getElementById('invHouseSelect');
  if(!sel) return;
  if(S.houses.length===0){
    sel.innerHTML='<option value="">No houses — add in Settings</option>';
  } else {
    sel.innerHTML = S.houses.map(h=>`<option value="${h.id}">${esc(h.name)}${h.closed?' (Closed)':''}</option>`).join('');
  }

  // Auto-fill static fields
  document.getElementById('invReceivedBy').value = S.staffName||'';
  document.getElementById('invDate').value = new Date().toLocaleDateString('en-US',{month:'2-digit',day:'2-digit',year:'numeric'});

  // Week ending — default to coming Saturday
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysToSat = (6 - dayOfWeek + 7) % 7 || 7;
  const sat = new Date(now); sat.setDate(now.getDate()+daysToSat);
  document.getElementById('invWeekEnding').value = sat.toISOString().slice(0,10);

  invHouseChanged();
  invRenderRows();
}

function invHouseChanged(){
  const sel = document.getElementById('invHouseSelect');
  const houseId = sel?.value;
  const house = S.houses.find(h=>h.id===houseId);
  document.getElementById('invLocation').value = house?.name||'';
}

function invRenderRows(){
  const list = document.getElementById('invRowList');
  if(!list) return;
  list.innerHTML = '';
  for(let i=0; i<invRowCount; i++) list.appendChild(invMakeRowEl(i));
  document.getElementById('invRowCount').textContent = `(${invRowCount} of 11)`;
  document.getElementById('invAddRowBtn').style.display = invRowCount>=11 ? 'none' : 'block';
}

function invMakeRowEl(i){
  const d = document.createElement('div');
  d.className = 'inv-row-card';
  d.id = `invrow_${i}`;
  d.innerHTML = `
    <div class="inv-row-hdr">
      <span class="inv-row-num">Vendor ${i+1}</span>
      <button class="inv-del-btn" onclick="invDelRow(${i})">✕</button>
    </div>
    <input class="inv-row-input" id="invVendor_${i}" type="text" placeholder="Vendor name" enterkeyhint="done">
    <div class="inv-row-grid">
      <div>
        <div class="ainfo-lbl" style="margin-bottom:4px;">Amount</div>
        <input class="inv-row-input inv-amount" id="invAmount_${i}" type="text" inputmode="decimal" placeholder="$0.00" enterkeyhint="done">
      </div>
      <div>
        <div class="ainfo-lbl" style="margin-bottom:4px;">Date</div>
        <input class="inv-row-input" id="invDate2_${i}" type="date" enterkeyhint="done">
      </div>
    </div>
    <input class="inv-row-input" id="invDesc_${i}" type="text" placeholder="Description / Remarks (optional)" enterkeyhint="done" style="margin-top:0;">`;
  return d;
}

function invAddRow(){
  if(invRowCount>=11){ toast('Maximum 11 rows reached'); return; }
  invRowCount++;
  invRenderRows();
  // Scroll to new row
  setTimeout(()=>document.getElementById(`invrow_${invRowCount-1}`)?.scrollIntoView({behavior:'smooth',block:'center'}),100);
}

function invDelRow(i){
  for(let j=i; j<invRowCount-1; j++){
    const vNext = document.getElementById(`invVendor_${j+1}`)?.value||'';
    const dNext = document.getElementById(`invDesc_${j+1}`)?.value||'';
    const aNext = document.getElementById(`invAmount_${j+1}`)?.value||'';
    const d2Next= document.getElementById(`invDate2_${j+1}`)?.value||'';
    const vEl = document.getElementById(`invVendor_${j}`);
    const dEl = document.getElementById(`invDesc_${j}`);
    const aEl = document.getElementById(`invAmount_${j}`);
    const d2El= document.getElementById(`invDate2_${j}`);
    if(vEl) vEl.value=vNext;
    if(dEl) dEl.value=dNext;
    if(aEl) aEl.value=aNext;
    if(d2El) d2El.value=d2Next;
  }
  invRowCount--;
  invRenderRows();
}

function invAddPhoto(event){
  const file = event.target.files?.[0];
  if(!file) return;
  if(invPhotos.length>=20){ toast('Maximum 20 photos'); return; }
  const reader = new FileReader();
  reader.onload = e=>{
    invPhotos.push({dataUrl:e.target.result, name:`invoice_${invPhotos.length+1}.jpg`});
    invRenderPhotoGrid();
    toast(`Photo ${invPhotos.length} added`);
  };
  reader.readAsDataURL(file);
  event.target.value=''; // allow re-adding same file
}

function invRenderPhotoGrid(){
  const grid = document.getElementById('invPhotoGrid');
  if(!grid) return;
  grid.innerHTML = invPhotos.map((p,i)=>`
    <div class="inv-photo-wrap">
      <img class="inv-photo-thumb" src="${p.dataUrl}" alt="Invoice ${i+1}">
      <button class="inv-photo-del" onclick="invDelPhoto(${i})">&#10005;</button>
    </div>`).join('');
}

function invDelPhoto(i){
  invPhotos.splice(i,1);
  invRenderPhotoGrid();
}

function invGetRows(){
  const rows = [];
  for(let i=0; i<invRowCount; i++){
    const vendor = document.getElementById(`invVendor_${i}`)?.value.trim()||'';
    const desc   = document.getElementById(`invDesc_${i}`)?.value.trim()||'';
    const amount = document.getElementById(`invAmount_${i}`)?.value.trim()||'';
    const date2  = document.getElementById(`invDate2_${i}`)?.value.trim()||'';
    rows.push({vendor, desc, amount, date2});
  }
  return rows;
}

async function invExportZip(){
  const sel = document.getElementById('invHouseSelect');
  const houseId = sel?.value;
  const house = S.houses.find(h=>h.id===houseId);
  const weekEnding = document.getElementById('invWeekEnding')?.value;

  if(!house){ toast('Select a house first'); return; }
  if(!weekEnding){ toast('Enter week ending date'); return; }
  if(invRowCount===0){ toast('Add at least one vendor row'); return; }

  const btn = document.getElementById('invZipBtn');
  btn.disabled=true; btn.textContent='Building…';

  try {
    const mm = String(new Date().getMonth()+1).padStart(2,'0');
    const yy = String(new Date().getFullYear()).slice(-2);
    const baseName = `${house.name} Receiving Log ${mm} ${yy}`;

    const rows = invGetRows();
    const logPDFBytes = await invBuildReceivingLogPDF(house, weekEnding, rows);

    // Build File objects — PDF log + each photo as a separate file
    const files = [];
    files.push(new File([logPDFBytes], `${baseName}.pdf`, {type:'application/pdf'}));
    invPhotos.forEach((p,i)=>{
      const ext = p.dataUrl.startsWith('data:image/png')?'png':'jpg';
      const mime = ext==='png'?'image/png':'image/jpeg';
      const base64 = p.dataUrl.split(',')[1];
      const bytes = Uint8Array.from(atob(base64), c=>c.charCodeAt(0));
      files.push(new File([bytes], `invoice_${String(i+1).padStart(2,'0')}.${ext}`, {type:mime}));
    });

    // Use Web Share API if available (iOS/Android) — opens share sheet with all files
    if(navigator.canShare && navigator.canShare({files})){
      await navigator.share({ files, title: baseName });
      toast('✓ Share sheet opened — pick Mail to send all files');
      btn.textContent='✓ Shared!';
    } else {
      // Desktop fallback — download each file individually
      for(const f of files){
        const url = URL.createObjectURL(f);
        const a = document.createElement('a');
        a.href=url; a.download=f.name; a.click();
        URL.revokeObjectURL(url);
        await new Promise(r=>setTimeout(r,300));
      }
      toast(`✓ Downloaded ${files.length} file${files.length!==1?'s':''}. Attach to email manually.`);
      btn.textContent='✓ Downloaded!';
    }
    setTimeout(()=>{ btn.disabled=false; btn.textContent='⬆ Share Log & Photos'; },2500);

  } catch(e){
    if(e.name==='AbortError'){ btn.disabled=false; btn.textContent='⬆ Share Log & Photos'; return; }
    console.error(e);
    toast('Export error: '+e.message);
    btn.disabled=false;
    btn.textContent='⬆ Share Log & Photos';
  }
}
