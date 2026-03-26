/* Receiving feature PDF export extracted from index2.html (phase 1) */
/* This file intentionally relies on the existing global app state and helpers. */

async function invBuildReceivingLogPDF(house, weekEnding, rows){
  const dateStr = document.getElementById('invDate')?.value||'';
  const receivedBy = S.staffName||'';
  const weDisp = weekEnding ? new Date(weekEnding+'T12:00:00').toLocaleDateString('en-US',{month:'2-digit',day:'2-digit',year:'numeric'}) : '';

  const pdfBytes = await fetch('BlankReceiving.pdf').then(r=>{ if(!r.ok) throw new Error('BlankReceiving.pdf not found'); return r.arrayBuffer(); });
  const pdfDoc  = await PDFLib.PDFDocument.load(pdfBytes);
  const page    = pdfDoc.getPages()[0];
  const font    = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
  const sz      = 9;

  function draw(text, x, y){ page.drawText(String(text||''), {x, y, size:sz, font, color:PDFLib.rgb(0,0,0)}); }

  // Header
  draw(house?.name||'',  143, 726);   // Location (B)
  draw(weDisp,           402, 726);   // Week Ending
  draw(dateStr,          143, 704);   // Date
  draw(receivedBy,       402, 704);   // Received By

  // Table rows — columns measured from actual PDF vertical lines
  // PO# (39.6–90): left blank
  // Vendor Name (90–198): x=93
  // Description (198–363.6): x=201
  // Quantity Received (363.6–417.6): x=367
  // Date Received (417.6–496.8): x=421
  // Received By (496.8–572.4): x=500
  const rowStartY = 638.6;
  const rowH = 25.2;
  for(let i=0; i<11; i++){
    const r = rows[i]||{vendor:'',desc:'',amount:'',date2:''};
    const y = rowStartY - (i * rowH);
    draw(r.vendor,  93,  y);
    draw(r.desc,   201,  y);
    draw(r.amount, 367,  y);
    if(r.vendor){
      const rowDate = r.date2
        ? new Date(r.date2+'T12:00:00').toLocaleDateString('en-US',{month:'2-digit',day:'2-digit',year:'numeric'})
        : dateStr;
      draw(rowDate,    421, y);
      draw(receivedBy, 500, y);
    }
  }

  // Bottom certification line
  draw(receivedBy, 313, 316);   // Name (Printed)
  draw(dateStr,    473, 316);   // Date

  // Signature stamp
  const sigs = S.signatures||[];
  if(sigs.length){
    const sig = sigs[Math.floor(Math.random()*sigs.length)];
    try{
      const base64 = sig.data.split(',')[1];
      const imgBytes = Uint8Array.from(atob(base64), c=>c.charCodeAt(0));
      const img = await pdfDoc.embedPng(imgBytes);
      page.drawImage(img, {x:138, y:306, width:108, height:17, opacity:1});
    }catch(e){ console.warn('Sig stamp failed:',e); }
  }

  const filled = await pdfDoc.save();
  return filled;
}
