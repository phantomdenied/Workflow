(function(){
  const GEMINI_MODEL = 'gemini-2.0-flash';

  function escHtml(s){
    return String(s ?? '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function toastSafe(msg){
    if(typeof window.toast === 'function') window.toast(msg);
    else console.log(msg);
  }

  function getApiKey(){
    let key = '';

    // 1) live app state
    if(window.S){
      key = window.S.geminiKey || window.S.apiKey || window.S.anthropicKey || '';
    }

    // 2) direct localStorage keys
    if(!key){
      try{
        key =
          localStorage.getItem('geminiKey') ||
          localStorage.getItem('apiKey') ||
          localStorage.getItem('anthropicKey') ||
          '';
      }catch(e){}
    }

    // 3) fallback to saved app-state blob in localStorage
    if(!key){
      try{
        const raw = localStorage.getItem('r4hub_v3');
        if(raw){
          const parsed = JSON.parse(raw);
          key = parsed.geminiKey || parsed.apiKey || parsed.anthropicKey || '';
        }
      }catch(e){}
    }

    // 4) if we found it, cache direct keys for future checks
    if(key){
      try{
        localStorage.setItem('geminiKey', key);
        localStorage.setItem('anthropicKey', key);
      }catch(e){}
    }

    console.log('AI KEY CHECK:', key ? 'FOUND' : 'MISSING');
    return String(key || '').trim();
  }

  function requireApiKey(){
    const key = getApiKey();
    if(!key){
      toastSafe('Add your Gemini API key in Settings first');
      throw new Error('Missing Gemini API key');
    }
    return key;
  }

  function parseJsonLoose(text){
    if(!text) throw new Error('Empty AI response');
    let t = String(text).trim();
    t = t.replace(/^```json\s*/i,'').replace(/^```\s*/,'').replace(/\s*```$/,'').trim();
    try { return JSON.parse(t); } catch(_) {}
    const startArr = t.indexOf('[');
    const startObj = t.indexOf('{');
    let start = -1;
    if(startArr === -1) start = startObj;
    else if(startObj === -1) start = startArr;
    else start = Math.min(startArr, startObj);
    const endObj = t.lastIndexOf('}');
    const endArr = t.lastIndexOf(']');
    const end = Math.max(endObj, endArr);
    if(start >= 0 && end > start){
      return JSON.parse(t.slice(start, end + 1));
    }
    throw new Error('Could not parse AI response');
  }

  async function runJsonTask(systemPrompt, userPrompt){
    const key = requireApiKey();
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent?key=' + encodeURIComponent(key),
      {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
          contents: [{
            parts: [
              {text: systemPrompt},
              {text: userPrompt}
            ]
          }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 900
          }
        })
      }
    );
    if(!response.ok){
      const err = await response.json().catch(()=>({}));
      throw new Error(err.error?.message || ('HTTP ' + response.status));
    }
    const data = await response.json();
    const content = (data.candidates?.[0]?.content?.parts || [])
      .map(p => p.text || '')
      .join('')
      .trim();
    return parseJsonLoose(content);
  }

  function normalizePriority(p){
    const x = String(p || 'medium').toLowerCase();
    return x === 'high' || x === 'low' ? x : 'medium';
  }

  function findHouseIdByName(name){
    const target = String(name || '').trim().toLowerCase();
    if(!target) return null;
    const exact = (window.S?.houses || []).find(h => (h.name || '').trim().toLowerCase() === target);
    if(exact) return exact.id;
    const partial = (window.S?.houses || []).find(h => {
      const hn = (h.name || '').trim().toLowerCase();
      return hn.includes(target) || target.includes(hn);
    });
    return partial ? partial.id : null;
  }

  function addSuggestedTasks(tasks){
    if(!window.S) throw new Error('App state unavailable');
    if(!Array.isArray(window.S.rTasks)) window.S.rTasks = [];
    let added = 0;
    const today = new Date().toISOString().slice(0,10);

    tasks.forEach(t => {
      const name = String(t.name || t.title || '').trim();
      if(!name) return;
      window.S.rTasks.push({
        id: window.uid ? window.uid() : ('ai_' + Date.now() + Math.random().toString(36).slice(2,8)),
        name,
        freq: 'weekly',
        day: 1,
        time: 'morning',
        notes: String(t.notes || '').trim(),
        priority: normalizePriority(t.priority),
        taskType: 'once',
        dayType: 'date',
        customInterval: 3,
        onceDate: t.dueDate || today,
        specificDate: '',
        houseId: findHouseIdByName(t.houseName),
        completions: {},
        completedAt: null,
        createdAt: new Date().toISOString(),
        fromAI: true
      });
      added++;
    });

    if(typeof window.saveS === 'function') window.saveS();
    if(typeof window.renderRTasks === 'function') window.renderRTasks();
    if(typeof window.renderHome === 'function' && document.getElementById('homeList')) window.renderHome();
    toastSafe(added ? ('Added ' + added + ' task' + (added===1?'':'s')) : 'No tasks found');
  }

  function renderTaskSuggestions(resultEl, payload){
    if(!resultEl) return;
    resultEl.style.display = 'block';
    const summary = payload.summary ? '<div style="margin-bottom:8px;"><strong>Summary:</strong> ' + escHtml(payload.summary) + '</div>' : '';
    const tasks = Array.isArray(payload.tasks) ? payload.tasks : [];
    const items = tasks.map((t, idx) => `
      <div class="ai-suggest-item">
        <div class="ai-suggest-title">${escHtml(t.name || t.title || 'Untitled Task')}</div>
        <div class="ai-suggest-meta">${escHtml((t.priority || 'medium').toUpperCase())}${t.dueDate ? ' · ' + escHtml(t.dueDate) : ''}${t.houseName ? ' · ' + escHtml(t.houseName) : ''}</div>
        ${t.notes ? `<div class="ai-suggest-notes">${escHtml(t.notes)}</div>` : ''}
        <div class="ai-inline-row">
          <button class="ai-mini-btn" data-ai-add-one="${idx}">Add Task</button>
        </div>
      </div>`).join('');

    resultEl.innerHTML = summary + (tasks.length ? `
      <div class="ai-inline-row" style="margin-bottom:8px;">
        <button class="ai-chip-btn" id="aiAddAllTasksBtn">Add All Tasks</button>
      </div>
      <div class="ai-suggest-list">${items}</div>` : '<div>No tasks suggested.</div>');

    const addAll = resultEl.querySelector('#aiAddAllTasksBtn');
    if(addAll) addAll.onclick = () => addSuggestedTasks(tasks);
    resultEl.querySelectorAll('[data-ai-add-one]').forEach(btn => {
      btn.onclick = () => addSuggestedTasks([tasks[Number(btn.dataset.aiAddOne)]]);
    });
  }

  async function noteSummarize(){
    const txt = document.getElementById('noteText')?.value?.trim() || '';
    const resultEl = document.getElementById('aiResultArea');
    if(!txt){ toastSafe('Write or paste a note first'); return; }
    resultEl.style.display = 'block';
    resultEl.innerHTML = 'Thinking…';
    try{
      const data = await runJsonTask(
        'You summarize operations notes. Return JSON only: {"summary":"2-4 sentence summary"}',
        txt
      );
      resultEl.innerHTML = '<strong>Summary:</strong><div style="margin-top:6px;">' + escHtml(data.summary || '') + '</div>';
    }catch(e){
      console.error(e);
      resultEl.innerHTML = escHtml(e.message);
    }
  }

  async function noteRewrite(){
    const ta = document.getElementById('noteText');
    const txt = ta?.value?.trim() || '';
    if(!txt){ toastSafe('Write or paste a note first'); return; }
    try{
      const data = await runJsonTask(
        'You rewrite rough notes into concise, professional, plain-English operations notes. Keep all factual meaning. Return JSON only: {"text":"rewritten text"}',
        txt
      );
      if(ta && data.text) ta.value = data.text;
      toastSafe('Note polished');
    }catch(e){
      console.error(e);
      toastSafe(e.message);
    }
  }

  async function noteMakeTasks(){
    const txt = document.getElementById('noteText')?.value?.trim() || '';
    const resultEl = document.getElementById('aiResultArea');
    const houses = (window.S?.houses || []).map(h=>h.name).join(', ') || 'none';
    if(!txt){ toastSafe('Write or paste a note first'); return; }
    resultEl.style.display = 'block';
    resultEl.innerHTML = 'Extracting tasks…';
    try{
      const data = await runJsonTask(
        'Extract actionable tasks from operations notes. Return JSON only with this exact shape: {"summary":"short summary","tasks":[{"name":"short action task","notes":"context","priority":"high|medium|low","dueDate":"YYYY-MM-DD or null","houseName":"exact house name from the list or null"}]}. Use only these house names if relevant: ' + houses,
        txt
      );
      renderTaskSuggestions(resultEl, data);
    }catch(e){
      console.error(e);
      resultEl.innerHTML = escHtml(e.message);
    }
  }

  async function emailMakeTasks(){
    const txt = document.getElementById('aiEmailText')?.value?.trim() || '';
    const resultEl = document.getElementById('aiEmailResult');
    const houses = (window.S?.houses || []).map(h=>h.name).join(', ') || 'none';
    if(!txt){ toastSafe('Paste an email first'); return; }
    resultEl.classList.add('show');
    resultEl.innerHTML = 'Reading email…';
    try{
      const data = await runJsonTask(
        'Extract actionable tasks from an email. Return JSON only with this exact shape: {"summary":"short summary","tasks":[{"name":"short action task","notes":"context from email","priority":"high|medium|low","dueDate":"YYYY-MM-DD or null","houseName":"exact house name from the list or null"}]}. Use only these house names if relevant: ' + houses,
        txt
      );
      renderTaskSuggestions(resultEl, data);
    }catch(e){
      console.error(e);
      resultEl.innerHTML = escHtml(e.message);
    }
  }

  function findTextareaContext(textarea){
    const auditCard = textarea.closest('.acard');
    if(auditCard){
      const itemText = auditCard.querySelector('.aitem-text')?.textContent?.trim() || '';
      const label = auditCard.querySelector('.acorr-lbl')?.textContent?.trim() || '';
      return { kind: 'audit', label: (itemText + ' ' + label).trim() };
    }
    const taskRow = textarea.closest('.task-row');
    const title = taskRow?.querySelector('.task-title')?.textContent?.trim() || '';
    const label = textarea.closest('.task-notes-area,.acorr')?.querySelector('.acorr-lbl,.notes-lbl')?.textContent?.trim() || '';
    return { kind: 'da3', label: (title + ' ' + label).trim() };
  }

  async function polishField(textarea, mode){
    const txt = textarea.value.trim();
    const ctx = findTextareaContext(textarea);
    const action = mode === 'suggest' ? 'suggest concise professional wording' : 'rewrite the existing text into concise professional wording';
    const userPrompt = 'Context: ' + ctx.kind.toUpperCase() + ' field\nLabel: ' + (ctx.label || 'General note') + '\nCurrent text: ' + (txt || '(blank)') + '\nTask: ' + action + '. Return JSON only: {"text":"final text"}';
    try{
      const data = await runJsonTask(
        'You write concise, professional documentation comments for operations forms. Return JSON only: {"text":"final text"}',
        userPrompt
      );
      if(data.text){
        textarea.value = data.text;
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        toastSafe(mode === 'suggest' ? 'AI suggestion added' : 'Field polished');
      }
    }catch(e){
      console.error(e);
      toastSafe(e.message);
    }
  }

  function ensureNotesButtons(){
    const row = document.getElementById('aiAnalyzeRow');
    const result = document.getElementById('aiResultArea');
    if(!row) return;
    row.style.display = 'block';
    if(!document.getElementById('aiTextNoteRow')){
      const wrap = document.createElement('div');
      wrap.id = 'aiTextNoteRow';
      wrap.className = 'ai-inline-row';
      wrap.style.marginBottom = '12px';
      wrap.innerHTML = `
        <button class="ai-chip-btn" id="aiNoteSummBtn">✨ Summarize</button>
        <button class="ai-chip-btn" id="aiNoteRewriteBtn">✍️ Rewrite</button>
        <button class="ai-chip-btn" id="aiNoteTasksBtn">✅ Make Tasks</button>`;
      row.insertAdjacentElement('afterend', wrap);
      wrap.querySelector('#aiNoteSummBtn').onclick = noteSummarize;
      wrap.querySelector('#aiNoteRewriteBtn').onclick = noteRewrite;
      wrap.querySelector('#aiNoteTasksBtn').onclick = noteMakeTasks;
    }
    if(result) result.classList.add('ai-result-box');
  }

  function ensureEmailCard(){
    const notesScreen = document.getElementById('notesScreen');
    if(!notesScreen || document.getElementById('aiEmailCard')) return;
    const card = document.createElement('div');
    card.id = 'aiEmailCard';
    card.className = 'ai-card';
    card.innerHTML = `
      <div class="ai-card-title">Email → Task Import</div>
      <textarea id="aiEmailText" class="ai-textarea" placeholder="Paste an email here, then let AI suggest tasks…"></textarea>
      <div class="ai-inline-row">
        <button class="ai-chip-btn" id="aiEmailTaskBtn">📧 Create Tasks from Email</button>
      </div>
      <div id="aiEmailResult" class="ai-result-box"></div>`;
    const filterWrap = document.getElementById('notesFilterWrap');
    if(filterWrap && filterWrap.parentNode){
      filterWrap.parentNode.insertBefore(card, filterWrap.nextSibling);
    } else {
      notesScreen.appendChild(card);
    }
    card.querySelector('#aiEmailTaskBtn').onclick = emailMakeTasks;
  }

  function enhanceFormTextareas(rootSel){
    const root = document.querySelector(rootSel);
    if(!root) return;
    root.querySelectorAll('textarea').forEach((ta) => {
      if(ta.dataset.aiEnhanced) return;
      const isDa3 = ta.id.startsWith('da3cmt_') || ta.id.startsWith('da3subcmt_') || ta.id.startsWith('da3cor_');
      const isAudit = ta.id.startsWith('aCorrText') || ta.id === 'aMismatchReason';
      if(!isDa3 && !isAudit) return;
      ta.dataset.aiEnhanced = '1';
      const row = document.createElement('div');
      row.className = 'ai-inline-row';
      row.innerHTML = `
        <button class="ai-mini-btn">✨ Polish</button>
        <button class="ai-mini-btn">💡 Suggest</button>`;
      const buttons = row.querySelectorAll('button');
      buttons[0].onclick = () => polishField(ta, 'polish');
      buttons[1].onclick = () => polishField(ta, 'suggest');
      ta.insertAdjacentElement('afterend', row);
    });
  }

  function initAIUI(){
    ensureNotesButtons();
    ensureEmailCard();
    enhanceFormTextareas('#da3Container');
    enhanceFormTextareas('#auditContainer');
  }

  document.addEventListener('mainReady', initAIUI);
  setTimeout(initAIUI, 1500);

  const observer = new MutationObserver(() => initAIUI());
  document.addEventListener('DOMContentLoaded', () => {
    observer.observe(document.body, { childList: true, subtree: true });
  });

  window.aiSummarizeNote = noteSummarize;
  window.aiRewriteNote = noteRewrite;
  window.aiTasksFromNote = noteMakeTasks;
  window.aiTasksFromEmail = emailMakeTasks;
})();