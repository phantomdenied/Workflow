(function(){
  const GEMINI_MODEL = 'gemini-2.0-flash';

  function toastSafe(msg){
    if(typeof window.toast === 'function') window.toast(msg);
    else console.log(msg);
  }

  function getApiKey(){
    let key = '';

    // 1. Try app state
    if(window.S){
      key =
        window.S.geminiKey ||
        window.S.apiKey ||
        window.S.anthropicKey ||
        '';
    }

    // 2. If found, cache it (THIS FIXES EVERYTHING)
    if(key){
      try{
        localStorage.setItem('geminiKey', key);
      }catch(e){}
    }

    // 3. Fallback to localStorage
    if(!key){
      try{
        key = localStorage.getItem('geminiKey') || '';
      }catch(e){}
    }

    console.log('AI KEY CHECK:', key ? 'FOUND' : 'MISSING');
    return String(key).trim();
  }

  function requireApiKey(){
    const key = getApiKey();
    if(!key){
      toastSafe('Add your Gemini API key in Settings first');
      throw new Error('Missing Gemini API key');
    }
    return key;
  }

  async function runJsonTask(systemPrompt, userPrompt){
    const key = requireApiKey();

    const res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent?key=' + key,
      {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          contents:[{
            parts:[
              {text: systemPrompt},
              {text: userPrompt}
            ]
          }]
        })
      }
    );

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.map(p=>p.text).join('') || '';
    return JSON.parse(text);
  }

  async function noteSummarize(){
    const txt = document.getElementById('noteText')?.value || '';
    const result = document.getElementById('aiResultArea');

    if(!txt) return;

    result.style.display = 'block';
    result.innerHTML = 'Thinking...';

    try{
      const data = await runJsonTask(
        'Return JSON: {"summary":"text"}',
        txt
      );
      result.innerHTML = data.summary;
    }catch(e){
      result.innerHTML = e.message;
    }
  }

  function init(){
    const row = document.getElementById('aiAnalyzeRow');
    if(!row) return;

    if(!document.getElementById('aiBtns')){
      const wrap = document.createElement('div');
      wrap.id = 'aiBtns';
      wrap.innerHTML = `
        <button id="aiSum">✨ Summarize</button>
      `;
      row.after(wrap);

      wrap.querySelector('#aiSum').onclick = noteSummarize;
    }
  }

  document.addEventListener('mainReady', init);
  setTimeout(init,1500);
})();