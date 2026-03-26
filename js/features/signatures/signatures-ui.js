/* Signatures feature UI/state extracted from index2.html (phase 2) */
/* Keeps the same saved-data structure: S.signatures = [{id, data}] */
/* Signature PNGs now preserve transparency so PDF lines show through. */

let _sigCtx = null;
let _sigDrawing = false;
let _sigLastX = 0, _sigLastY = 0;

function sigPadOpen(){
  const section = document.getElementById('sigPadSection');
  const btn = document.getElementById('sigAddBtn');
  if(!section) return;
  section.style.display = 'block';
  btn.style.display = 'none';
  sigPadInit();
}

function sigPadInit(){
  const canvas = document.getElementById('sigPadCanvas');
  if(!canvas) return;
  const wrap = document.getElementById('sigPadWrap');
  const dpr = window.devicePixelRatio || 1;
  const w = wrap.offsetWidth;
  const h = 160;
  canvas.width  = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width  = w + 'px';
  canvas.style.height = h + 'px';
  _sigCtx = canvas.getContext('2d');
  _sigCtx.scale(dpr, dpr);
  _sigCtx.strokeStyle = '#1a1a1a';
  _sigCtx.lineWidth = 2.2;
  _sigCtx.lineCap = 'round';
  _sigCtx.lineJoin = 'round';
  _sigCtx.clearRect(0, 0, w, h);

  // Touch events
  canvas.addEventListener('touchstart', sigTouchStart, {passive:false});
  canvas.addEventListener('touchmove',  sigTouchMove,  {passive:false});
  canvas.addEventListener('touchend',   sigTouchEnd,   {passive:false});
  // Mouse events
  canvas.addEventListener('mousedown', sigMouseDown);
  canvas.addEventListener('mousemove', sigMouseMove);
  canvas.addEventListener('mouseup',   sigMouseUp);
  canvas.addEventListener('mouseleave',sigMouseUp);
}

function sigGetPos(e, canvas){
  const r = canvas.getBoundingClientRect();
  const src = e.touches ? e.touches[0] : e;
  return { x: src.clientX - r.left, y: src.clientY - r.top };
}

function sigTouchStart(e){ e.preventDefault(); const p=sigGetPos(e,this); _sigDrawing=true; _sigLastX=p.x; _sigLastY=p.y; _sigCtx.beginPath(); _sigCtx.moveTo(p.x,p.y); }

function sigTouchMove(e){ e.preventDefault(); if(!_sigDrawing) return; const p=sigGetPos(e,this); _sigCtx.lineTo(p.x,p.y); _sigCtx.stroke(); _sigLastX=p.x; _sigLastY=p.y; }

function sigTouchEnd(e){ e.preventDefault(); _sigDrawing=false; }

function sigMouseDown(e){ const p=sigGetPos(e,this); _sigDrawing=true; _sigLastX=p.x; _sigLastY=p.y; _sigCtx.beginPath(); _sigCtx.moveTo(p.x,p.y); }

function sigMouseMove(e){ if(!_sigDrawing) return; const p=sigGetPos(e,this); _sigCtx.lineTo(p.x,p.y); _sigCtx.stroke(); }

function sigMouseUp(){ _sigDrawing=false; }

function sigPadClear(){
  const canvas = document.getElementById('sigPadCanvas');
  if(!canvas||!_sigCtx) return;
  _sigCtx.clearRect(0,0,canvas.width,canvas.height);
}

function sigPadSave(){
  const canvas = document.getElementById('sigPadCanvas');
  if(!canvas) return;
  // Check not blank
  const data = _sigCtx.getImageData(0,0,canvas.width,canvas.height).data;
  let blank = true;
  for(let i=3; i<data.length; i+=4){
    if(data[i] !== 0){ blank = false; break; }
  }
  if(blank){ toast('Draw your signature first'); return; }

  const dataUrl = canvas.toDataURL('image/png');
  if(!S.signatures) S.signatures = [];
  if(S.signatures.length >= 10){ toast('Maximum 10 signatures saved'); return; }
  S.signatures.push({ id: Date.now().toString(36), data: dataUrl });
  saveS();
  toast('\u2713 Signature saved');

  // Hide pad, show add button again
  document.getElementById('sigPadSection').style.display = 'none';
  document.getElementById('sigAddBtn').style.display = 'block';
  sigPadClear();
  renderSigThumbs();
}

function sigDelete(id){
  if(!confirm('Delete this signature?')) return;
  S.signatures = (S.signatures||[]).filter(s=>s.id!==id);
  saveS();
  renderSigThumbs();
}

function renderSigThumbs(){
  const grid = document.getElementById('sigThumbGrid');
  if(!grid) return;
  const sigs = S.signatures || [];
  if(sigs.length === 0){
    grid.innerHTML = '<div style="color:var(--muted);font-size:0.8rem;grid-column:1/-1;">No signatures saved yet</div>';
    return;
  }
  grid.innerHTML = sigs.map(s=>`
    <div class="sig-thumb" title="Signature">
      <img src="${s.data}" alt="Signature">
      <button class="sig-del" onclick="sigDelete('${s.id}');event.stopPropagation()">✕</button>
    </div>
  `).join('');
}

function getRandomSig(){
  const sigs = S.signatures || [];
  if(!sigs.length) return null;
  return sigs[Math.floor(Math.random()*sigs.length)];
}
