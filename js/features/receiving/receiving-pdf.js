/* Receiving feature PDF export extracted from index2.html (phase 1) */
/* This file intentionally relies on the existing global app state and helpers. */

async function invBuildReceivingLogPDF(house, weekEnding, rows){
  const dateStr = document.getElementById('invDate')?.value||'';
  const receivedBy = S.staffName||'';
  const weDisp = weekEnding ? new Date(weekEnding+'T12:00:00').toLocaleDateString('en-US',{month:'2-digit',day:'2-digit',year:'numeric'}) : '';

  const pdfBytes = await fetch('BlankReceiving.pdf').then(r=>{ if(!r.ok) throw new Error('BlankReceiving.pdf not found'); return r.arrayBuffer(); });
  const pdfDoc  = await PDFLib.PDFDocument.load(pdfBytes);
  const page    = pdfDoc.getPages()[0];
  const { width, height } = page.getSize();
  const font    = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
  const sz      = 9;

  function draw(text, x, y){ page.drawText(String(text||''), {x, y, size:sz, font, color:PDFLib.rgb(0,0,0)}); }

  // Header fields — x,y coordinates tuned to the reportlab layout
  // Page height=792, top margin=0.5in=36, so content starts at y=756
  // Location row y ≈ 720, Date row y ≈ 704
  draw(house?.name||'',        105, 718);
  draw(weDisp,                 490, 718);
  draw(dateStr,                105, 702);
  draw(receivedBy,             490, 702);

  // Table rows — first data row starts at y≈640, each row is 25.2pt tall
  const rowStartY = 638;
  const rowH = 25.2;
  for(let i=0; i<11; i++){
    const r = rows[i]||{vendor:'',desc:''};
    const y = rowStartY - (i * rowH);
    draw(r.vendor,                 57,  y);  // Vendor Name col
    draw(r.desc,                   165, y);  // Description col
    if(r.vendor){
      draw(dateStr,                416, y);  // Date Received
      draw(receivedBy,             487, y);  // Received By
    }
  }

  const filled = await pdfDoc.save();
  return filled;
}
