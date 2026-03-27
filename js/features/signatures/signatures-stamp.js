/* Signatures feature PDF stamping extracted from index2.html (phase 2) */
/* Uses the existing saved signature pool and random selection behavior. */
/* Crops transparent whitespace before embedding so signatures render larger and more naturally. */

async function _sigToCroppedPngBytes(sig){
  const dataUrl = sig?.data || '';
  if(!dataUrl) return null;

  const imgEl = await new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = dataUrl;
  });

  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = imgEl.naturalWidth || imgEl.width;
  srcCanvas.height = imgEl.naturalHeight || imgEl.height;
  const sctx = srcCanvas.getContext('2d', { willReadFrequently: true });
  sctx.clearRect(0, 0, srcCanvas.width, srcCanvas.height);
  sctx.drawImage(imgEl, 0, 0);

  const imgData = sctx.getImageData(0, 0, srcCanvas.width, srcCanvas.height);
  const data = imgData.data;

  let minX = srcCanvas.width, minY = srcCanvas.height;
  let maxX = -1, maxY = -1;

  for(let y = 0; y < srcCanvas.height; y++){
    for(let x = 0; x < srcCanvas.width; x++){
      const a = data[(y * srcCanvas.width + x) * 4 + 3];
      if(a > 8){
        if(x < minX) minX = x;
        if(y < minY) minY = y;
        if(x > maxX) maxX = x;
        if(y > maxY) maxY = y;
      }
    }
  }

  // Nothing drawn; return original bytes
  if(maxX < 0 || maxY < 0){
    const base64 = dataUrl.split(',')[1];
    return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  }

  const pad = 3;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(srcCanvas.width - 1, maxX + pad);
  maxY = Math.min(srcCanvas.height - 1, maxY + pad);

  const cropW = Math.max(1, maxX - minX + 1);
  const cropH = Math.max(1, maxY - minY + 1);

  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = cropW;
  cropCanvas.height = cropH;
  const cctx = cropCanvas.getContext('2d');
  cctx.clearRect(0, 0, cropW, cropH);
  cctx.drawImage(srcCanvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);

  const croppedUrl = cropCanvas.toDataURL('image/png');
  const base64 = croppedUrl.split(',')[1];
  return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
}

function _drawSigFit(page, img, rect){
  const [x1,y1,x2,y2] = rect;
  const pad = 2;
  const boxW = (x2 - x1) - pad * 2;
  const boxH = (y2 - y1) - pad * 2;
  const dims = img.scale(1);

  let drawW = boxW * 0.96;
  let drawH = dims.height * (drawW / dims.width);

  if(drawH > boxH){
    drawH = boxH * 0.98;
    drawW = dims.width * (drawH / dims.height);
  }

  const drawX = x1 + pad + ((boxW - drawW) / 2);
  const drawY = y1 + pad + ((boxH - drawH) / 2);

  page.drawImage(img, { x: drawX, y: drawY, width: drawW, height: drawH });
}

  const drawX = x1 + pad + ((boxW - drawW) / 2);
  const drawY = y1 + pad + ((boxH - drawH) / 2);

  page.drawImage(img, {
    x: drawX,
    y: drawY,
    width: drawW,
    height: drawH,
    opacity: 1
  });
}

async function stampSignatureOnPDFById(pdfDoc, pageIndex, rect, sigId){
  const sigs = S.signatures||[];
  let sig = sigId ? sigs.find(s=>s.id===sigId) : null;
  if(!sig) sig = sigs[Math.floor(Math.random()*sigs.length)];
  if(!sig) return null;
  try{
    const imgBytes = await _sigToCroppedPngBytes(sig);
    const img = await pdfDoc.embedPng(imgBytes);
    const page = pdfDoc.getPages()[pageIndex];
    _drawSigFit(page, img, rect);
    return sig.id;
  }catch(e){ console.warn('Sig stamp failed:',e); return null; }
}

async function stampSignatureOnPDF(pdfDoc, pageIndex, rect){
  const sig = getRandomSig();
  if(!sig) return; // no sig saved, skip silently
  try{
    const imgBytes = await _sigToCroppedPngBytes(sig);
    const img = await pdfDoc.embedPng(imgBytes);
    const page = pdfDoc.getPages()[pageIndex];
    _drawSigFit(page, img, rect);
  }catch(e){ console.warn('Sig stamp failed:',e); }
}
