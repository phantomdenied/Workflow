(function(){
  const GEMINI_MODEL = 'gemini-2.0-flash';

  function getApiKey(){
    if(!window.S) return '';
    return (
      window.S.geminiKey ||
      window.S.apiKey ||
      window.S.anthropicKey ||
      ''
    ).trim();
  }

  function toastSafe(msg){
    if(typeof window.toast === 'function') window.toast(msg);
    else console.log(msg);
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
    let t = String(text || '').trim();
    try { return JSON.parse(t); } catch {}
    const start = t.indexOf('{');
    const end = t.lastIndexOf('}');
    if(start >= 0 && end > start){
      return JSON.parse(t.slice(start, end+1));
    }
    throw new Error('Bad AI response');
  }

  async function runJsonTask(systemPrompt, userPrompt){
    const key = requireApiKey();

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`,
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
    return parseJsonLoose(text);
  }

  async function noteSummarize(){
    const txt = document.getElementById('noteText')?.value || '';
    if(!txt) return toastSafe('Add text first');

    try{
      const data = await runJsonTask(
        'Return JSON: {"summary":"text"}',
        txt
      );
      alert(data.summary);
    }catch(e){
      console.error(e);
      toastSafe(e.message);
    }
  }

  window.aiSummarizeNote = noteSummarize;
})();
