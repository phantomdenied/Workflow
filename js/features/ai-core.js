// FINAL AI CORE FIX (v1 API + working model)
(function(){
  const GEMINI_MODEL = 'gemini-2.0-flash-lite';

  function getApiKey(){
    return localStorage.getItem('geminiKey') || localStorage.getItem('anthropicKey') || '';
  }

  async function runAI(prompt){
    const key = getApiKey();
    if(!key){
      alert('Add your Gemini API key in Settings first');
      return;
    }

    const res = await fetch(
      'https://generativelanguage.googleapis.com/v1/models/' + GEMINI_MODEL + ':generateContent?key=' + key,
      {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }]
        })
      }
    );

    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';
  }

  window.aiSummarizeNote = async function(){
    const txt = document.getElementById('noteText')?.value;
    if(!txt) return alert('Write something first');
    const result = await runAI('Summarize this:\n' + txt);
    document.getElementById('aiResultArea').innerText = result;
  };

  window.aiRewriteNote = async function(){
    const txt = document.getElementById('noteText')?.value;
    if(!txt) return alert('Write something first');
    const result = await runAI('Rewrite professionally:\n' + txt);
    document.getElementById('noteText').value = result;
  };

  window.aiTasksFromNote = async function(){
    const txt = document.getElementById('noteText')?.value;
    if(!txt) return alert('Write something first');
    const result = await runAI('Extract tasks:\n' + txt);
    document.getElementById('aiResultArea').innerText = result;
  };

})();