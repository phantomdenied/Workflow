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
    const boxW = Math.max(0, (x2 - x1) - pad * 2);
    const boxH = Math.max(0, (y2 - y1) - pad * 2);
    const dims = img.scale(1);
    const targetH = boxH * 0.9;
    let drawH = targetH;
    let drawW = dims.width * (drawH / Math.max(dims.height, 1));
    if(drawW > boxW * 0.98){
      drawW = boxW * 0.98;
      drawH = dims.height * (drawW / Math.max(dims.width, 1));
    }
    const drawX = x1 + pad + ((boxW - drawW) / 2);
    const drawY = y1 + pad + ((boxH - drawH) / 2);
    page.drawImage(img, {x:drawX, y:drawY, width:drawW, height:drawH, opacity:1});
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
    const [x1,y1,x2,y2] = rect;
    const pad = 2;
    const boxW = Math.max(0, (x2 - x1) - pad * 2);
    const boxH = Math.max(0, (y2 - y1) - pad * 2);
    const dims = img.scale(1);
    const targetH = boxH * 0.9;
    let drawH = targetH;
    let drawW = dims.width * (drawH / Math.max(dims.height, 1));
    if(drawW > boxW * 0.98){
      drawW = boxW * 0.98;
      drawH = dims.height * (drawW / Math.max(dims.width, 1));
    }
    page.drawImage(img, {
      x: x1 + pad + ((boxW - drawW) / 2),
      y: y1 + pad + ((boxH - drawH) / 2),
      width: drawW,
      height: drawH,
      opacity: 1
    });
  }catch(e){ console.warn('Sig stamp failed:',e); }
}
