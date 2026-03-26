/* Notes + AI feature extracted from index2.html (phase 4) */
/* Structural split only: keeps the existing state, photo handling, and AI-key behavior. */

async function analyzeNoteWithAI(){
  if(!S.anthropicKey){ toast('Add your Gemini API key in Settings first'); return; }
  if(!notePhotoData){ toast('Attach a photo first'); return; }

  const btn = document.getElementById('aiAnalyzeBtn');
  const resultArea = document.getElementById('aiResultArea');
  btn.textContent = '⏳ Analyzing…';
  btn.disabled = true;
  resultArea.style.display='block';
  resultArea.textContent='Reading your notes…';

  try {
    const base64 = notePhotoData.split(',')[1];
    const mediaType = notePhotoData.split(';')[0].split(':')[1] || 'image/jpeg';

    const houseList = (S.houses||[]).map(h=>h.name).join(', ') || 'none';

    const prompt = `You are a helpful assistant for a residential operations manager who oversees group homes.

Analyze this image of meeting notes or handwritten notes and respond with a JSON object only — no markdown, no explanation, just raw JSON.

The manager oversees these houses: ${houseList}

Return this exact structure:
{
  "summary": "2-4 sentence plain English summary of the key points",
  "tasks": [
    {
      "name": "task name (short, action-oriented)",
      "notes": "any context or details",
      "priority": "high|medium|low",
      "dueDate": "YYYY-MM-DD or null if not mentioned",
      "houseName": "exact house name from the list above, or null if general"
    }
  ]
}

Extract every action item, follow-up, deadline, or thing that needs to be done. If a house is mentioned, match it to the list. If a date or day is mentioned, calculate the actual date (today is ${new Date().toISOString().slice(0,10)}). If nothing actionable, return empty tasks array.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${S.anthropicKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: mediaType, data: base64 } },
              { text: prompt }
            ]
          }],
          generationConfig: { maxOutputTokens: 1024 }
        })
      }
    );

    if(!response.ok){
      const err = await response.json().catch(()=>({}));
      throw new Error(err.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const raw = (data.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('') || '').trim();
    const cleaned = raw.replace(/^```json\s*/,'').replace(/\s*```$/,'').trim();
    const result = JSON.parse(cleaned);

    // Show summary
    resultArea.innerHTML = `<div style="font-weight:700;margin-bottom:6px;color:var(--accent);">✨ AI Summary</div>
      <div>${esc(result.summary||'')}</div>
      ${result.tasks&&result.tasks.length ? `<div style="margin-top:8px;font-weight:600;font-size:0.8rem;color:var(--muted);">${result.tasks.length} task${result.tasks.length!==1?'s':''} found — will be added automatically</div>` : '<div style="margin-top:6px;font-size:0.8rem;color:var(--muted);">No action items found</div>'}`;

    // Auto-fill note text with summary
    const ta = document.getElementById('noteText');
    if(ta && !ta.value.trim()) ta.value = result.summary||'';

    // Create tasks
    if(result.tasks && result.tasks.length){
      if(!S.rTasks) S.rTasks=[];
      let added=0;
      result.tasks.forEach(t=>{
        // Match house name to id
        let houseId=null;
        if(t.houseName){
          const match=(S.houses||[]).find(h=>h.name.toLowerCase().includes(t.houseName.toLowerCase())||t.houseName.toLowerCase().includes(h.name.toLowerCase()));
          if(match) houseId=match.id;
        }
        S.rTasks.push({
          id:uid(), name:t.name, taskType:'once',
          onceDate:t.dueDate||null,
          notes:t.notes||'📋 From meeting notes',
          priority:t.priority||'medium',
          dayType:'dow', freq:'weekly', day:1, time:'morning',
          houseId, completions:{}, completedAt:null,
          createdAt:new Date().toISOString(), fromAI:true
        });
        added++;
      });
      saveS();
      haptic('medium');
      toast(`✓ Added ${added} task${added!==1?'s':''} from notes`);
    }

    btn.textContent='✨ Analyzed!';
    btn.style.background='var(--green-light)';
    btn.style.color='var(--green)';
    btn.style.borderColor='var(--green)';

  } catch(err){
    console.error('AI error:', err);
    resultArea.textContent='Error: '+err.message+'. Check your API key in Settings.';
    resultArea.style.color='var(--red)';
    btn.textContent='✨ Analyze with AI';
    btn.disabled=false;
  }
}

function openNoteCompose(editId=null){
  editingNoteId = editId;
  notePhotoData = null;
  const modal = document.getElementById('noteModal');

  // Populate house options
  const sel = document.getElementById('noteHouseTag');
  sel.innerHTML = '<option value="">🏠 No house tag</option>'
    + (S.houses||[]).map(h=>`<option value="${h.id}">${esc(h.name)}</option>`).join('');

  if(editId){
    const n = (S.notes||[]).find(x=>x.id===editId);
    if(!n) return;
    document.getElementById('noteModalTitle').textContent = 'Edit Note';
    document.getElementById('noteText').value = n.text||'';
    sel.value = n.houseId||'';
    notePhotoData = n.photoData||null;
    const prev = document.getElementById('notePhotoPreview');
    if(notePhotoData){ prev.src=notePhotoData; prev.classList.add('show'); }
    else { prev.classList.remove('show'); prev.src=''; }
    document.getElementById('noteDeleteBtn').style.display='block';
  } else {
    document.getElementById('noteModalTitle').textContent = 'New Note';
    document.getElementById('noteText').value = '';
    sel.value = '';
    const prev = document.getElementById('notePhotoPreview');
    prev.classList.remove('show'); prev.src='';
    document.getElementById('noteDeleteBtn').style.display='none';
  }
  stopVoice();
  modal.classList.add('open');
  setTimeout(()=>document.getElementById('noteText').focus(), 300);
}

function closeNoteModal(){
  stopVoice();
  document.getElementById('noteModal').classList.remove('open');
}

function closeNoteModalOutside(e){
  if(e.target===document.getElementById('noteModal')) closeNoteModal();
}

function handleNotePhoto(e){
  const file = e.target.files[0];
  if(!file) return;
  // Compress to max 800px wide
  const reader = new FileReader();
  reader.onload = ev=>{
    const img = new Image();
    img.onload = ()=>{
      const canvas = document.createElement('canvas');
      const MAX = 800;
      let w=img.width, h=img.height;
      if(w>MAX){ h=Math.round(h*MAX/w); w=MAX; }
      canvas.width=w; canvas.height=h;
      canvas.getContext('2d').drawImage(img,0,0,w,h);
      notePhotoData = canvas.toDataURL('image/jpeg', 0.75);
      const prev = document.getElementById('notePhotoPreview');
      prev.src=notePhotoData; prev.classList.add('show');
      // Show AI analyze button if API key is set
      const aiRow=document.getElementById('aiAnalyzeRow');
      if(aiRow) aiRow.style.display = S.anthropicKey ? 'block' : 'none';
    };
    img.src=ev.target.result;
  };
  reader.readAsDataURL(file);
  e.target.value='';
}

function saveNote(){
  const text = document.getElementById('noteText').value.trim();
  const houseId = document.getElementById('noteHouseTag').value||null;
  if(!text && !notePhotoData){ toast('Add some text or a photo first'); return; }
  if(!S.notes) S.notes=[];
  let noteId;
  if(editingNoteId){
    const n=S.notes.find(x=>x.id===editingNoteId);
    if(n){
      n.text=text; n.houseId=houseId; n.updatedAt=new Date().toISOString();
      if(notePhotoData){ n.photoData=notePhotoData; _photoDB.set(n.id, notePhotoData); }
    }
    noteId = editingNoteId;
  } else {
    noteId = uid();
    const newNote = {id:noteId, text, photoData:notePhotoData||null, houseId, pinned:false, createdAt:new Date().toISOString()};
    if(notePhotoData) _photoDB.set(noteId, notePhotoData);
    S.notes.push(newNote);
  }
  haptic('medium');
  saveS();
  closeNoteModal();
  renderNotes();
  toast(editingNoteId?'Note updated!':'Note saved!');
}

function deleteNote(){
  if(!editingNoteId) return;
  if(!confirm('Delete this note?')) return;
  _photoDB.delete(editingNoteId);
  S.notes=(S.notes||[]).filter(n=>n.id!==editingNoteId);
  saveS();
  closeNoteModal();
  renderNotes();
  toast('Note deleted');
}

function togglePin(id){
  const n=(S.notes||[]).find(x=>x.id===id);
  if(!n) return;
  n.pinned=!n.pinned;
  haptic();
  saveS();
  renderNotes();
}

function openLightbox(src){
  document.getElementById('lightboxImg').src=src;
  document.getElementById('lightbox').classList.add('open');
}

function closeLightbox(){
  document.getElementById('lightbox').classList.remove('open');
}

function setNotesFilter(f, el){
  _notesFilter = f;
  document.querySelectorAll('#notesFilterWrap .notes-filter-pill').forEach(p=>p.classList.remove('active'));
  if(el) el.classList.add('active');
  renderNotes();
}

function renderNotes(){
  const notes = S.notes||[];
  const countEl = document.getElementById('notesCount');
  if(countEl) countEl.textContent = notes.length+' note'+(notes.length!==1?'s':'');

  // Rebuild filter pills with house names
  const filterWrap = document.getElementById('notesFilterWrap');
  if(filterWrap){
    const housePills = (S.houses||[]).map(h=>
      `<button class="notes-filter-pill${_notesFilter===h.id?' active':''}" data-filter="${h.id}" onclick="setNotesFilter('${h.id}',this)">🏠 ${esc(h.name)}</button>`
    ).join('');
    filterWrap.innerHTML =
      `<button class="notes-filter-pill${_notesFilter==='all'?' active':''}" data-filter="all" onclick="setNotesFilter('all',this)">All</button>
       <button class="notes-filter-pill${_notesFilter==='pinned'?' active':''}" data-filter="pinned" onclick="setNotesFilter('pinned',this)">📌 Pinned</button>
       ${housePills}`;
  }

  const list = document.getElementById('notesList');
  if(!list) return;

  if(!notes.length){
    list.innerHTML=`<div style="text-align:center;padding:60px 20px;color:var(--muted);">
      <div style="font-size:2.5rem;margin-bottom:12px;">📝</div>
      <div style="font-size:0.9rem;">No notes yet — tap ✏️ to start</div>
    </div>`;
    return;
  }

  // Sort: pinned first, then date desc
  let sorted = [...notes].sort((a,b)=>{
    if(a.pinned&&!b.pinned) return -1;
    if(!a.pinned&&b.pinned) return 1;
    return new Date(b.createdAt)-new Date(a.createdAt);
  });

  // Apply filter
  if(_notesFilter === 'pinned') sorted = sorted.filter(n=>n.pinned);
  else if(_notesFilter !== 'all') sorted = sorted.filter(n=>n.houseId===_notesFilter);

  if(!sorted.length){
    list.innerHTML=`<div style="text-align:center;padding:40px 20px;color:var(--muted);font-size:0.85rem;">No notes match this filter.</div>`;
    return;
  }

  list.innerHTML = sorted.map(n=>{
    const house = n.houseId ? (S.houses||[]).find(h=>h.id===n.houseId) : null;
    const dateStr = formatNoteDate(n.createdAt);
    const aiSummary = n.aiSummary ? `<div class="note-card-ai-summary">✨ ${esc(n.aiSummary)}</div>` : '';
    const aiBadge = n.aiSummary ? `<span class="note-card-ai-badge">✨ AI</span>` : '';
    return `<div class="note-card${n.pinned?' pinned':''}">
      ${n.photoData?`<img class="note-card-photo" src="${n.photoData}" alt="photo" onclick="openLightbox('${n.photoData}')">` : ''}
      <div class="note-card-content">
        <div class="note-card-text">${esc(n.text||'')}</div>
        ${aiSummary}
        <div class="note-card-meta">
          <span class="note-card-date">${dateStr}</span>
          ${house?`<span class="note-card-house">🏠 ${esc(house.name)}</span>`:''}
          ${aiBadge}
        </div>
      </div>
      <div class="note-card-actions">
        <button class="note-action-btn pin" onclick="togglePin('${n.id}')">${n.pinned?'Unpin':'📌 Pin'}</button>
        <button class="note-action-btn" onclick="openNoteCompose('${n.id}')">✏️ Edit</button>
        <button class="note-action-btn del" onclick="quickDeleteNote('${n.id}')">🗑 Delete</button>
      </div>
    </div>`;
  }).join('');
}

function quickDeleteNote(id){
  if(!confirm('Delete this note?')) return;
  _photoDB.delete(id);
  S.notes=(S.notes||[]).filter(n=>n.id!==id);
  haptic('heavy');
  saveS();
  renderNotes();
}

function formatNoteDate(iso){
  if(!iso) return '';
  const d=new Date(iso);
  const now=new Date();
  const diff=Math.floor((now-d)/864e5);
  if(diff===0) return 'Today '+d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  if(diff===1) return 'Yesterday';
  if(diff<7) return DAYS[d.getDay()];
  return `${MO[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}
