/* Signatures feature PDF stamping extracted from index2.html (phase 2) */
/* Uses the existing saved signature pool and random selection behavior. */

async function stampSignatureOnPDFById(pdfDoc, pageIndex, rect, sigId){
  const sigs = S.signatures||[];
  let sig = sigId ? sigs.find(s=>s.id===sigId) : null;
  if(!sig) sig = sigs[Math.floor(Math.random()*sigs.length)];
  if(!sig) return null;
  try{
    const base64 = sig.data.split(',')[1];
    const imgBytes = Uint8Array.from(atob(base64), c=>c.charCodeAt(0));
    const img = await pdfDoc.embedPng(imgBytes);
    const page = pdfDoc.getPages()[pageIndex];
    const [x1,y1,x2,y2] = rect;
    const pad = 2;
    page.drawImage(img, {x:x1+pad, y:y1+pad, width:x2-x1-pad*2, height:y2-y1-pad*2, opacity:1});
    return sig.id;
  }catch(e){ console.warn('Sig stamp failed:',e); return null; }
}

async function stampSignatureOnPDF(pdfDoc, pageIndex, rect){
  const sig = getRandomSig();
  if(!sig) return; // no sig saved, skip silently
  try{
    const base64 = sig.data.split(',')[1];
    const imgBytes = Uint8Array.from(atob(base64), c=>c.charCodeAt(0));
    const img = await pdfDoc.embedPng(imgBytes);
    const pages = pdfDoc.getPages();
    const page = pages[pageIndex];
    const pdfH = page.getHeight();
    // rect is in PDF coords [x1,y1,x2,y2] from bottom-left
    const [x1,y1,x2,y2] = rect;
    const w = x2-x1;
    const h = y2-y1;
    // Add padding
    const pad = 2;
    page.drawImage(img, {
      x: x1+pad, y: y1+pad,
      width: w-pad*2, height: h-pad*2,
      opacity: 1
    });
  }catch(e){ console.warn('Sig stamp failed:',e); }
}
