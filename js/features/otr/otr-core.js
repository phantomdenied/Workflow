/* Weekly OTR Builder — ported from the standalone otr-builder.html.
   Local only: the weekly template is remembered in IndexedDB (wf_otr); forms stay in memory. */
(function(){
"use strict";
const LIBS = [
  "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"
];
const PDF_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
function loadScript(src){ return new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("Couldn't load " + src)); document.head.appendChild(s); }); }
let libsP = null;
function ensureLibs(){
  if (!libsP) libsP = (async () => {
    if (!window.JSZip) await loadScript(LIBS[0]);
    try { if (!window.pdfjsLib) await loadScript(LIBS[1]); if (window.pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER; } catch (e) { /* PDF reading unavailable offline; docx/xlsx still work */ }
  })().catch(e => { libsP = null; throw e; });
  return libsP;
}

/* ---------- remembered template (IndexedDB) ---------- */
function idb(){ return new Promise((res, rej) => { const r = indexedDB.open("wf_otr", 1); r.onupgradeneeded = () => r.result.createObjectStore("kv"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function kvSet(k, v){ try { const db = await idb(); await new Promise((res, rej) => { const t = db.transaction("kv", "readwrite"); t.objectStore("kv").put(v, k); t.oncomplete = res; t.onerror = () => rej(t.error); }); } catch (e) { console.warn("otr save", e); } }
async function kvGet(k){ try { const db = await idb(); return await new Promise((res, rej) => { const q = db.transaction("kv").objectStore("kv").get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); } catch (e) { return undefined; } }
function tplSave(name, buf){ kvSet("template", {name, buf, savedAt: Date.now()}); renderTplRow(name); }
function renderTplRow(name){ const el = document.getElementById("otr_tplRow"); if (el) el.innerHTML = name ? `Saved template: <strong>${esc(name)}</strong>. Drop a new .xlsx to replace it.` : ""; }
function saveOpts(){ try { localStorage.setItem("wf_otr_opts", JSON.stringify({ppn: S.ppn, repair: S.repair, detail: S.detail})); } catch (e) {} }

/* ---------- reference data ---------- */
const CODES = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const CODE_NAMES = {A:"ADMN Admin Lv",B:"Investigation",C:"Vacancy",D:"MINS Scheduled Absence",E:"MINU Unscheduled Absence",F:"LATE",G:"FMLA / UABF",H:"1:1",I:"2:1",J:"CSMD Medical",K:"CSPR Programming",L:"CSBH Behavior",M:"CSRC Recreational",N:"SPEC Special Proj/Events",O:"CSRS Respite",P:"TRNG Training",Q:"MEET Meeting",R:"CWRK Completion of Work",S:"WTHR Weather",T:"HOLD Holdover/Late incoming",U:"MWRK Maintenance/Repair",V:"STAT State of Emergency",W:"EVAC Evacuation",X:"COVD COVID",Y:"WCOM WRI",Z:"Time Change"};
const ABBR = {ADMN:"A",ADMIN:"A",INV:"B",INVESTIGATION:"B",VAC:"C",VACANCY:"C",MINS:"D",MINU:"E",LATE:"F",FMLA:"G",UABF:"G","1:1":"H","2:1":"I",CSMD:"J",CSPR:"K",CSBH:"L",CSRC:"M",SPEC:"N",CSRS:"O",TRNG:"P",TRAINING:"P",MEET:"Q",CWRK:"R",WTHR:"S",WEATHER:"S",HOLD:"T",MWRK:"U",STAT:"V",EVAC:"W",COVD:"X",COVID:"X",WCOM:"Y"};
const KEYWORDS = [[/unscheduled/i,["E"],"unscheduled absence"],[/scheduled\s*abs/i,["D"],"scheduled absence"],[/vacan/i,["C"],"vacancy"],[/holdover|incoming staff/i,["T"],"holdover"],[/\blate\b/i,["F","T"],"late"],[/medical/i,["J"],"medical"],[/programm/i,["K"],"programming"],[/behavio/i,["L"],"behavior"],[/train/i,["P"],"training"],[/meeting/i,["Q"],"meeting"],[/fmla/i,["G"],"FMLA"],[/respite/i,["O"],"respite"]];

/* ---------- state ---------- */
const S = {forms:[], template:null, example:false, week:"", ppn:"", repair:false, detail:false, onlyFlag:false, siteFilter:"", scanId:null, zoom:false};
let UID = 0; const nid = () => ++UID;

/* ---------- small helpers ---------- */
const $ = id => document.getElementById("otr_" + id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const r2 = n => Math.round(n * 100) / 100;
const fmtH = n => (isFinite(n) ? r2(n).toFixed(2) : "—");
const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const titleCase = s => String(s || "").toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase());
function iso(y, m, d){ if (y < 100) y += 2000; const dt = new Date(Date.UTC(y, m - 1, d)); if (dt.getUTCMonth() !== m - 1) return ""; return dt.toISOString().slice(0, 10); }
function parseDates(s){ const out = []; const re = /(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/g; let m; while ((m = re.exec(String(s || "")))) { const v = iso(+m[3], +m[1], +m[2]); if (v) out.push(v); } return out; }
function addDays(isoS, n){ const d = new Date(isoS + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function mdy(isoS){ if (!isoS) return ""; const [y, m, d] = isoS.split("-"); return `${+m}/${+d}/${y.slice(2)}`; }
function dot(isoS){ const [y, m, d] = isoS.split("-"); return `${m}.${d}.${y.slice(2)}`; }
function dow(isoS){ return ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][new Date(isoS + "T00:00:00Z").getUTCDay()]; }
function normMV(s){ const t = String(s || "").trim().toUpperCase(); if (t === "M" || t.startsWith("MOT")) return "MOT"; if (t === "V" || t.startsWith("VOT")) return "VOT"; return String(s || "").trim(); }

function parseHours(raw){
  let s = String(raw ?? "").trim().toLowerCase();
  if (!s) return {hours: NaN, note: ""};
  const hm = s.match(/^(\d+(?:\.\d+)?)\s*h(?:rs?|ours?)?\s*(\d+)\s*m/);
  if (hm) { const v = r2(+hm[1] + +hm[2] / 60); return {hours: v, note: `"${raw}" read as ${v} h`}; }
  const mm = s.match(/^(\d+(?:\.\d+)?)\s*m(?:in|ins|inutes)?\b/);
  if (mm) { const v = r2(+mm[1] / 60); return {hours: v, note: `"${raw}" converted to ${v} h`}; }
  s = s.replace(/h(?:rs?|ours?)?\.?$/, "").trim();
  const v = parseFloat(s);
  return {hours: isFinite(v) ? v : NaN, note: ""};
}
function parseCode(raw){
  const t = String(raw ?? "").trim().toUpperCase();
  if (!t) return {code: "", note: ""};
  if (/^[A-Z]\.?$/.test(t)) return {code: t[0], note: ""};
  // new form style: "C - Vacancy", "C – Vacancy", "C. Vacancy", "C) Vacancy", "C Vacancy"
  const lead = t.match(/^([A-Z])(?:\s*[-–—.:)]|\s+)/);
  if (lead && !ABBR[t.replace(/[^A-Z0-9:]/g, "")]) return {code: lead[1], note: ""};
  const k = t.replace(/[^A-Z0-9:]/g, "");
  if (ABBR[k]) return {code: ABBR[k], note: `"${raw}" read as ${ABBR[k]}`};
  if (ABBR[k.slice(0, 4)]) return {code: ABBR[k.slice(0, 4)], note: `"${raw}" read as ${ABBR[k.slice(0, 4)]}`};
  return {code: "", note: ""};
}
/* hours between the two times written in a shift like "4pm-5:15pm", "12-8a", "8a-1230p" */
function rangeHours(shift){
  const s = String(shift || "").toLowerCase().replace(/\s+/g, "");
  const m = s.match(/^(\d{1,4})(?::(\d{2}))?(am|pm|a|p)?[-–—to]+(\d{1,4})(?::(\d{2}))?(am|pm|a|p)?$/);
  if (!m) return null;
  const tm = (d, mi, suf) => { let h, mn; if (mi != null) { h = +d; mn = +mi; } else if (d.length >= 3) { h = Math.floor(+d / 100); mn = +d % 100; } else { h = +d; mn = 0; } if (h > 24 || mn > 59) return null; return {h, mn, suf: suf ? suf[0] : ""}; };
  const a = tm(m[1], m[2], m[3]), b = tm(m[4], m[5], m[6]);
  if (!a || !b) return null;
  let diff;
  if (a.suf && b.suf) {
    const to24 = t => ((t.h % 12) + (t.suf === "p" ? 12 : 0)) + t.mn / 60;
    diff = (to24(b) - to24(a) + 24) % 24; if (diff === 0) diff = 24;
  } else {
    const to12 = t => (t.h % 12) + t.mn / 60;
    diff = (to12(b) - to12(a) + 12) % 12; if (diff === 0) diff = 12;
  }
  return r2(diff);
}

/* ---------- model builders ---------- */
function makeLine(o){
  const ph = parseHours(o.hoursRaw), pc = parseCode(o.codeRaw);
  return {id: nid(), shift: o.shift || "", hoursRaw: o.hoursRaw ?? "", hours: ph.hours, hoursNote: ph.note, desc: o.desc || "", motvot: normMV(o.mv), codeRaw: o.codeRaw || "", code: pc.code, codeNote: pc.note, attest: o.attest || "", include: true, ack: {}};
}
function makeForm(o){
  const f = Object.assign({id: nid(), kind: "docx", fileName: "", page: 0, pageCount: 1, headerSite: "", fileSite: "", headerDate: "", fileDates: [], date: "", dateGuessed: false, siteOverride: "", include: true, lines: [], img: "", example: false}, o);
  if (!f.date) {
    if (f.fileDates.length) {
      const st = f.fileDates[0], en = f.fileDates[f.fileDates.length - 1];
      if (f.pageCount > 1) { let d = addDays(st, f.page - 1); if (d > en) d = en; f.date = d; f.dateGuessed = true; }
      else f.date = st;
    } else if (f.headerDate) f.date = f.headerDate;
  }
  return f;
}
function fileSiteOf(name){ return String(name).replace(/\.[a-z0-9]+$/i, "").split(/daily|otr/i)[0].replace(/[_\-]+/g, " ").trim(); }

/* ---------- site matching ---------- */
function knownSites(){
  if (S.template) return S.template.sites.map(s => s.name);
  const set = [];
  for (const f of S.forms) { const n = rawSiteName(f); if (n && !set.includes(n)) set.push(n); }
  return set.sort();
}
function rawSiteName(f){ const t = (f.headerSite || f.fileSite || "").replace(/\bIRA\b/ig, "").trim(); return t ? titleCase(t) : ""; }
function matchSite(raw){
  if (!raw) return "";
  const n = norm(String(raw).replace(/\bIRA\b/ig, ""));
  if (!n) return "";
  let best = "", bestLen = 0;
  for (const name of knownSites()) {
    const ns = norm(name); if (!ns) continue;
    const hit = n === ns || (ns.length >= 3 && n.startsWith(ns)) || (n.length >= 3 && ns.startsWith(n)) || (ns.length >= 4 && n.includes(ns));
    if (hit && ns.length > bestLen) { best = name; bestLen = ns.length; }
  }
  return best;
}
function siteOf(f){ return f.siteOverride || matchSite(f.headerSite) || matchSite(f.fileSite) || (S.template ? "" : rawSiteName(f)); }

/* ---------- flags ---------- */
/* a row with no hours and no description is an unused row on the form, not an entry */
const isBlank = l => !String(l.hoursRaw ?? "").trim() && !String(l.desc || "").trim();
const countsLine = l => l.include && !isBlank(l) && l.code && isFinite(l.hours);
function lineFlags(l){
  const out = [];
  if (isBlank(l)) return out;
  if (!isFinite(l.hours) || l.hours <= 0) out.push({sev: "bad", msg: `Hours missing or unreadable${l.hoursRaw ? ` ("${l.hoursRaw}")` : ""}`});
  if (l.hoursNote) out.push({sev: "info", msg: l.hoursNote});
  const rh = rangeHours(l.shift);
  const exact = /\d:\d\d|\d{3,4}\s*(a|p)/i.test(l.shift); // times with minutes are actual clock times; "4-12" is just the shift name
  if (isFinite(l.hours) && rh != null && (exact ? Math.abs(rh - l.hours) > 0.09 : l.hours > rh + 0.09) && !l.ack.range)
    out.push({sev: "warn", msg: `Shift ${l.shift} works out to ${fmtH(rh)} h`, fix: {kind: "hours", val: rh, label: `Use ${fmtH(rh)}`}, ack: "range"});
  if (isFinite(l.hours) && rh == null && !l.ack.hmm) {
    const frac = r2(l.hours - Math.floor(l.hours));
    if (frac && ![0.25, 0.5, 0.75].includes(frac) && Math.round(frac * 100) <= 59) {
      const alt = r2(Math.floor(l.hours) + Math.round(frac * 100) / 60);
      if (Math.abs(alt - l.hours) > 0.01) out.push({sev: "warn", msg: `Odd fraction. If ${l.hours} means ${Math.floor(l.hours)} h ${Math.round(frac * 100)} min, it's ${fmtH(alt)}`, fix: {kind: "hours", val: alt, label: `Use ${fmtH(alt)}`}, ack: "hmm"});
    }
  }
  if (!l.code) out.push({sev: "bad", msg: l.codeRaw ? `Reason code "${l.codeRaw}" isn't a valid code` : "No reason code"});
  if (l.codeNote) out.push({sev: "info", msg: l.codeNote});
  if (l.code && l.desc && !l.ack.kw) {
    for (const [re, codes, word] of KEYWORDS) {
      if (re.test(l.desc)) { if (!codes.includes(l.code)) out.push({sev: "warn", msg: `Says "${word}" but coded ${l.code} (${CODE_NAMES[l.code]})`, ack: "kw"}); break; }
    }
  }
  return out;
}
const realLines = f => f.lines.filter(l => !isBlank(l));
function sigOf(f){ return realLines(f).map(l => [l.shift, r2(l.hours), l.desc, l.code, l.motvot, l.attest].join("|").toLowerCase()).sort().join("¦"); }
function formFlags(f, ctx){
  const out = [];
  const site = siteOf(f);
  if (!site) out.push({sev: "bad", msg: S.template ? `Site "${f.headerSite || f.fileSite || "?"}" isn't on the template. Pick one.` : "Site unknown. Pick or load the template."});
  const hs = matchSite(f.headerSite), fs = matchSite(f.fileSite);
  if (hs && fs && hs !== fs && !f.siteOverride) out.push({sev: "warn", msg: `File name says ${fs}, form says ${hs}. Using ${hs}.`});
  if (!f.date) out.push({sev: "bad", msg: "No date. Enter one."});
  if (f.dateGuessed) out.push({sev: "warn", msg: `Date guessed from page ${f.page} of a multi-day file. Check the form.`});
  if (f.headerDate && f.fileDates.length === 1 && f.headerDate !== f.fileDates[0]) out.push({sev: "warn", msg: `Form is dated ${mdy(f.headerDate)}; file name says ${mdy(f.fileDates[0])}.`});
  const n = realLines(f).length;
  if (f.kind === "scan" && !n && !f.noOT) out.push({sev: "bad", msg: "Scanned form. Enter its lines, or mark it as having no overtime."});
  if ((f.kind === "docx" || f.noOT) && !n) out.push({sev: "info", msg: "No overtime on this form."});
  if (ctx && f.date && (f.date < ctx.start || f.date > ctx.end)) { out.push({sev: "info", msg: `Outside the week of ${mdy(ctx.start)}. Not counted.`}); return out; }
  if (ctx) {
    const twins = ctx.sig.get(site + "#" + sigOf(f)) || [];
    if (n > 1 && twins.length > 1) out.push({sev: "warn", msg: `Same lines as ${twins.filter(x => x !== f).map(x => x.fileName + (x.pageCount > 1 ? ` p${x.page}` : "")).join(", ")}`});
    const same = ctx.day.get(site + "#" + f.date) || [];
    if (f.date && same.length > 1) out.push({sev: "warn", msg: `${same.length} forms for ${site} on ${mdy(f.date)}`});
  }
  return out;
}
/* weeks run Thursday through Wednesday */
const thursdayOf = d => addDays(d, -((new Date(d + "T00:00:00Z").getUTCDay() - 4 + 7) % 7));
function defaultWeek(forms){
  const tally = new Map();
  for (const f of forms) if (f.date) { const w = thursdayOf(f.date); tally.set(w, (tally.get(w) || 0) + 1); }
  return [...tally.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || "";
}
function context(){
  const chosen = S.forms.filter(f => f.include);
  const start = S.week || defaultWeek(chosen), end = start ? addDays(start, 6) : "";
  const inc = chosen.filter(f => !start || (f.date && f.date >= start && f.date <= end));
  const sig = new Map(), day = new Map();
  for (const f of inc) {
    const s = siteOf(f);
    const k = s + "#" + sigOf(f); if (!sig.has(k)) sig.set(k, []); sig.get(k).push(f);
    const d = s + "#" + f.date; if (!day.has(d)) day.set(d, []); day.get(d).push(f);
  }
  return {inc, chosen, sig, day, start, end};
}
const worst = fl => fl.some(x => x.sev === "bad") ? "bad" : fl.some(x => x.sev === "warn") ? "warn" : fl.length ? "info" : "";

/* ---------- file intake ---------- */
const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
async function handleFiles(list){
  const msgs = [];
  if (S.example) { S.forms = []; S.example = false; }
  setLoad(`<div class="banner info">Reading ${list.length} file${list.length === 1 ? "" : "s"}…</div>`);
  for (const file of list) {
    try { await intake(file.name, await file.arrayBuffer(), msgs); }
    catch (e) { msgs.push({sev: "bad", msg: `${file.name}: ${e.message || e}`}); }
  }
  S.forms.sort((a, b) => (siteOf(a) || "~").localeCompare(siteOf(b) || "~") || (a.date || "").localeCompare(b.date || "") || a.fileName.localeCompare(b.fileName) || a.page - b.page);
  setLoad(msgs.length ? msgs.map(m => `<div class="flag ${m.sev}">${esc(m.msg)}</div>`).join("") : "");
  renderAll();
}
async function intake(name, buf, msgs){
  const ext = (name.split(".").pop() || "").toLowerCase();
  const base = name.split("/").pop();
  if (base.startsWith("~$") || base.startsWith("._")) return;
  if (ext === "zip") {
    const zip = await JSZip.loadAsync(buf);
    const entries = Object.values(zip.files).filter(e => !e.dir && !e.name.startsWith("__MACOSX"));
    for (const e of entries) { try { await intake(e.name.split("/").pop(), await e.async("arraybuffer"), msgs); } catch (er) { msgs.push({sev: "bad", msg: `${e.name}: ${er.message || er}`}); } }
  } else if (ext === "xlsx") {
    S.template = await readTemplate(base, buf);
    tplSave(base, buf);
    msgs.push({sev: "info", msg: `Template: ${base} — ${S.template.sites.length} sites in ${S.template.sections.length} team sections.`});
  } else if (ext === "docx") {
    S.forms.push(await readDocx(base, buf));
  } else if (ext === "pdf") {
    for (const f of await readPdf(base, buf)) S.forms.push(f);
  } else if (["png", "jpg", "jpeg"].includes(ext)) {
    const img = await bufToDataUrl(buf, ext === "png" ? "image/png" : "image/jpeg");
    S.forms.push(makeForm({kind: "scan", fileName: base, fileSite: fileSiteOf(base), fileDates: parseDates(base), img}));
  } else msgs.push({sev: "info", msg: `${base}: skipped (not a .docx, .pdf, image, .zip or .xlsx)`});
}
function bufToDataUrl(buf, type){ return new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(new Blob([buf], {type})); }); }
/* text of an element, ignoring Word content-control placeholder text ("Choose an item.", "Click or tap here to enter text.") */
const PLACEHOLDER = /choose an item\.?|click (?:or tap )?here to enter (?:a )?(?:text|date)\.?|click or tap to enter a date\.?|enter text here\.?/ig;
function inPlaceholder(t){
  for (let a = t.parentNode; a; a = a.parentNode) {
    if (a.localName === "sdt") { const pr = Array.from(a.childNodes).find(n => n.localName === "sdtPr"); if (pr && pr.getElementsByTagNameNS(W, "showingPlcHdr").length) return true; }
  }
  return false;
}
const textOf = el => Array.from(el.getElementsByTagNameNS(W, "t")).filter(t => !inPlaceholder(t)).map(t => t.textContent).join("").replace(PLACEHOLDER, "");

async function readDocx(name, buf){
  const zip = await JSZip.loadAsync(buf);
  const xml = await zip.file("word/document.xml").async("string");
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const body = doc.getElementsByTagNameNS(W, "body")[0];
  let headerSite = "", headerDate = "";
  for (const p of Array.from(body.getElementsByTagNameNS(W, "p"))) {
    let anc = p.parentNode, inTbl = false; while (anc && anc !== body) { if (anc.localName === "tbl") { inTbl = true; break; } anc = anc.parentNode; }
    if (inTbl) continue;
    const t = textOf(p).replace(/_+/g, " ").replace(/\s+/g, " ").trim();
    if (/\bIRA\b/i.test(t) || /\bdate\s*:/i.test(t)) {
      const m = t.match(/^(.*?)\bIRA\b/i); if (m) headerSite = m[1].trim();
      const d = t.match(/date\s*:?\s*(.*)$/i); if (d) headerDate = parseDates(d[1])[0] || "";
      if (!headerSite && d) headerSite = t.slice(0, t.search(/date/i)).trim();
      break;
    }
  }
  const tbls = Array.from(doc.getElementsByTagNameNS(W, "tbl"));
  const lines = [];
  const tbl = tbls.find(t => /hour/i.test(textOf(t))) || tbls[0];
  if (tbl) {
    const rows = Array.from(tbl.getElementsByTagNameNS(W, "tr"));
    const cellsOf = tr => Array.from(tr.childNodes).filter(n => n.localName === "tc").map(tc => Array.from(tc.getElementsByTagNameNS(W, "p")).map(textOf).join(" ").replace(/\s+/g, " ").trim());
    const hdr = rows.length ? cellsOf(rows[0]).map(x => x.toLowerCase()) : [];
    const ix = (re, d) => { const i = hdr.findIndex(h => re.test(h)); return i < 0 ? d : i; };
    const c = {shift: ix(/shift/, 0), hours: ix(/hour/, 1), desc: ix(/desc/, 2), mv: ix(/mot|vot/, 3), code: ix(/reason|code/, 4), att: ix(/attest/, 5)};
    for (const tr of rows.slice(1)) {
      const v = cellsOf(tr);
      if (!(v[c.hours] || v[c.desc])) continue; // unused row (may still show a pre-filled shift, code or "0" attestations)
      lines.push(makeLine({shift: v[c.shift], hoursRaw: v[c.hours], desc: v[c.desc], mv: v[c.mv], codeRaw: v[c.code], attest: v[c.att]}));
    }
  }
  return makeForm({kind: "docx", fileName: name, headerSite, headerDate, fileSite: fileSiteOf(name), fileDates: parseDates(name), lines});
}
async function readPdf(name, buf){
  if (!window.pdfjsLib) throw new Error("PDF reader didn't load; check the connection and reload.");
  const pdf = await pdfjsLib.getDocument({data: new Uint8Array(buf)}).promise;
  const out = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const vp = page.getViewport({scale: 1.6});
    const cv = document.createElement("canvas"); cv.width = vp.width; cv.height = vp.height;
    await page.render({canvasContext: cv.getContext("2d"), viewport: vp}).promise;
    out.push(makeForm({kind: "scan", fileName: name, page: i, pageCount: pdf.numPages, fileSite: fileSiteOf(name), fileDates: parseDates(name), img: cv.toDataURL("image/jpeg", 0.82)}));
  }
  return out;
}

/* ---------- template (xlsx) ---------- */
const SS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const colNum = c => c.split("").reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
const colStr = n => { let s = ""; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
const splitRef = r => { const m = /^([A-Z]+)(\d+)$/.exec(r); return [m[1], +m[2]]; };

async function readTemplate(name, buf){
  const zip = await JSZip.loadAsync(buf);
  const wbXml = await zip.file("xl/workbook.xml").async("string");
  const relXml = await zip.file("xl/_rels/workbook.xml.rels").async("string");
  const wb = new DOMParser().parseFromString(wbXml, "application/xml");
  const firstSheet = wb.getElementsByTagNameNS(SS, "sheet")[0];
  const rid = firstSheet.getAttribute("r:id") || firstSheet.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
  const rels = new DOMParser().parseFromString(relXml, "application/xml");
  const rel = Array.from(rels.getElementsByTagName("Relationship")).find(r => r.getAttribute("Id") === rid);
  let target = rel.getAttribute("Target"); target = target.startsWith("/") ? target.slice(1) : "xl/" + target.replace(/^\.\//, "");
  const sst = [];
  if (zip.file("xl/sharedStrings.xml")) {
    const sx = new DOMParser().parseFromString(await zip.file("xl/sharedStrings.xml").async("string"), "application/xml");
    for (const si of Array.from(sx.getElementsByTagNameNS(SS, "si"))) sst.push(Array.from(si.getElementsByTagNameNS(SS, "t")).map(t => t.textContent).join(""));
  }
  const sheetXml = await zip.file(target).async("string");
  const sh = new DOMParser().parseFromString(sheetXml, "application/xml");
  const cells = new Map();
  for (const c of Array.from(sh.getElementsByTagNameNS(SS, "c"))) {
    const t = c.getAttribute("t"), v = c.getElementsByTagNameNS(SS, "v")[0], f = c.getElementsByTagNameNS(SS, "f")[0];
    let text = "";
    if (t === "s" && v) text = sst[+v.textContent] ?? "";
    else if (t === "inlineStr") text = Array.from(c.getElementsByTagNameNS(SS, "t")).map(x => x.textContent).join("");
    else if (v && !f) text = v.textContent;
    cells.set(c.getAttribute("r"), {text: text.trim(), hasF: !!f});
  }
  const txt = r => (cells.get(r) || {}).text || "";
  const maxRow = Math.max(0, ...Array.from(cells.keys()).map(r => splitRef(r)[1]));
  const sections = [], sites = [];
  for (let r = 1; r <= maxRow; r++) {
    if (!/^pay\s*period/i.test(txt("A" + r))) continue;
    const sec = {team: txt("A" + (r - 1)) || txt("B" + (r - 1)), headerRow: r, totalCol: "", siteCols: [], codeRows: {}, totalsRow: 0};
    for (const [ref, c] of cells) { const [col, row] = splitRef(ref); if (row !== r || colNum(col) < 3 || !c.text) continue; if (/^total$/i.test(c.text)) sec.totalCol = col; else sec.siteCols.push({col, name: c.text}); }
    for (let k = r + 1; k <= maxRow; k++) {
      const a = txt("A" + k);
      if (/^totals?/i.test(a)) { sec.totalsRow = k; break; }
      const m = /^\s*([A-Z])\s*\./.exec(a); if (m) sec.codeRows[m[1]] = k;
    }
    sec.siteCols.sort((a, b) => colNum(a.col) - colNum(b.col));
    sections.push(sec);
    for (const s of sec.siteCols) sites.push({name: s.name, col: s.col, sec});
  }
  if (!sections.length) throw new Error("Couldn't find any 'Pay Period #' team sections in the first sheet.");
  let ppRef = "";
  for (const [ref, c] of cells) { if (/^payroll\s*period/i.test(c.text) && splitRef(ref)[1] < sections[0].headerRow) { const [col, row] = splitRef(ref); ppRef = colStr(colNum(col) + 1) + row; } }
  return {name, buf, sheetPath: target, sections, sites, cells, ppRef};
}

/* ---------- build xlsx ---------- */
async function buildReport(){
  const T = S.template, ctx = context();
  const zip = await JSZip.loadAsync(T.buf.slice(0));
  const sh = new DOMParser().parseFromString(await zip.file(T.sheetPath).async("string"), "application/xml");
  const sheetData = sh.getElementsByTagNameNS(SS, "sheetData")[0];
  const rowEl = new Map(); for (const r of Array.from(sheetData.getElementsByTagNameNS(SS, "row"))) rowEl.set(+r.getAttribute("r"), r);
  const getRow = n => { if (rowEl.has(n)) return rowEl.get(n); const el = sh.createElementNS(SS, "row"); el.setAttribute("r", n); const after = Array.from(rowEl.keys()).filter(k => k > n).sort((a, b) => a - b)[0]; sheetData.insertBefore(el, after ? rowEl.get(after) : null); rowEl.set(n, el); return el; };
  const findCell = ref => { const [, row] = splitRef(ref); const r = rowEl.get(row); return r ? Array.from(r.childNodes).find(x => x.localName === "c" && x.getAttribute("r") === ref) : null; };
  const getCell = ref => { const [col, row] = splitRef(ref); const r = getRow(row); const cs = Array.from(r.childNodes).filter(n => n.localName === "c"); let c = cs.find(x => x.getAttribute("r") === ref); if (c) return c; c = sh.createElementNS(SS, "c"); c.setAttribute("r", ref); const nxt = cs.find(x => colNum(splitRef(x.getAttribute("r"))[0]) > colNum(col)); r.insertBefore(c, nxt || null); return c; };
  const kid = (c, name) => Array.from(c.childNodes).find(n => n.localName === name);
  const strip = c => { for (const ch of Array.from(c.childNodes)) if (["v", "f", "is"].includes(ch.localName)) c.removeChild(ch); c.removeAttribute("t"); };
  const setNum = (ref, v) => { const c = getCell(ref); strip(c); if (v != null) { const e = sh.createElementNS(SS, "v"); e.textContent = String(v); c.appendChild(e); } };
  const setStr = (ref, s) => { const c = getCell(ref); strip(c); c.setAttribute("t", "inlineStr"); const is = sh.createElementNS(SS, "is"), t = sh.createElementNS(SS, "t"); t.textContent = s; is.appendChild(t); c.appendChild(is); };
  const setFormula = (ref, text) => { const c = getCell(ref); strip(c); const f = sh.createElementNS(SS, "f"); f.textContent = text; c.appendChild(f); };

  // 1. hours into the site columns
  const tot = {};
  for (const f of ctx.inc) { const s = siteOf(f); for (const l of f.lines) if (countsLine(l)) { tot[s] = tot[s] || {}; tot[s][l.code] = r2((tot[s][l.code] || 0) + l.hours); } }
  const sitesWithForms = new Set(ctx.inc.map(siteOf));
  for (const st of T.sites) {
    if (!sitesWithForms.has(st.name)) continue;
    for (const L of CODES) { const row = st.sec.codeRows[L]; if (!row) continue; const v = tot[st.name] && tot[st.name][L]; setNum(st.col + row, v ? v : null); }
  }
  if (S.ppn && T.ppRef) setStr(T.ppRef, S.ppn);

  // formula helpers (shared formulas are stored once on a master cell and offset for the others)
  const REF = /(?<![A-Za-z0-9_])(\$?)([A-Z]{1,3})(\$?)(\d+)(?![\d(])/g;
  const shift = (text, dr, dc) => text.replace(REF, (m, a, col, b, row) => `${a}${a ? col : colStr(colNum(col) + dc)}${b}${b ? row : +row + dr}`);
  const masters = new Map();
  for (const c of Array.from(sheetData.getElementsByTagNameNS(SS, "c"))) { const f = kid(c, "f"); if (f && f.getAttribute("t") === "shared" && f.getAttribute("ref")) masters.set(f.getAttribute("si"), {ref: c.getAttribute("r"), text: f.textContent}); }
  const formulaOf = c => {
    const f = kid(c, "f"); if (!f) return null;
    if (f.getAttribute("t") !== "shared" || f.getAttribute("ref")) return f.textContent;
    const m = masters.get(f.getAttribute("si")); if (!m) return null;
    const [mc, mr] = splitRef(m.ref), [cc, cr] = splitRef(c.getAttribute("r"));
    return shift(m.text, cr - mr, colNum(cc) - colNum(mc));
  };
  const refsIn = text => {
    const out = new Set();
    const re = /(?<![A-Za-z0-9_])\$?([A-Z]{1,3})\$?(\d+)(?![\d(])(?::\$?([A-Z]{1,3})\$?(\d+))?/g; let m;
    while ((m = re.exec(text))) {
      if (!m[3]) { out.add(m[1] + m[2]); continue; }
      for (let c = colNum(m[1]); c <= colNum(m[3]); c++) for (let r = +m[2]; r <= +m[4]; r++) out.add(colStr(c) + r);
    }
    return out;
  };
  // turn every member of a shared group into its own plain formula, so one member can be rewritten safely
  const unshare = si => {
    for (const c of Array.from(sheetData.getElementsByTagNameNS(SS, "c"))) {
      const f = kid(c, "f"); if (!f || f.getAttribute("t") !== "shared" || f.getAttribute("si") !== si) continue;
      const text = formulaOf(c); f.textContent = text; f.removeAttribute("t"); f.removeAttribute("si"); f.removeAttribute("ref");
    }
    masters.delete(si);
  };

  // 2. optional: fix only summary formulas that point at the wrong cells
  let changed = 0;
  if (S.repair) {
    const plan = [];
    for (const sec of T.sections) {
      const rows = Object.values(sec.codeRows).sort((a, b) => a - b);
      if (sec.totalCol && sec.totalsRow && rows.length) {
        const exp = new Set(rows.map(r => sec.totalCol + r));
        plan.push({ref: sec.totalCol + sec.totalsRow, exp, text: `SUM(${sec.totalCol}${rows[0]}:${sec.totalCol}${rows[rows.length - 1]})`});
      }
    }
    for (const [ref, c] of T.cells) {
      const [col, row] = splitRef(ref);
      if (row >= T.sections[0].headerRow || !/^[A-Z]$/.test(c.text)) continue;
      const right = colStr(colNum(col) + 1) + row;
      if (!(T.cells.get(right) || {}).hasF) continue;
      const parts = T.sections.filter(s => s.totalCol && s.codeRows[c.text]).map(s => s.totalCol + s.codeRows[c.text]);
      if (parts.length) plan.push({ref: right, exp: new Set(parts), text: parts.length === 1 ? parts[0] : `SUM(${parts.join(",")})`});
    }
    for (const p of plan) {
      const c = findCell(p.ref); const cur = c ? formulaOf(c) : null;
      if (cur != null) { const got = refsIn(cur); if (got.size === p.exp.size && [...p.exp].every(x => got.has(x))) continue; }
      const f = c && kid(c, "f"); if (f && f.getAttribute("t") === "shared") unshare(f.getAttribute("si"));
      setFormula(p.ref, p.text); changed++;
    }
  }

  // 3. store calculated results so totals show even where Excel hasn't recalculated (Protected View, previews, phones)
  const cellMap = new Map(); for (const c of Array.from(sheetData.getElementsByTagNameNS(SS, "c"))) cellMap.set(c.getAttribute("r"), c);
  const memo = new Map(); let unsupported = 0;
  const valueOf = (ref, stack) => {
    const c = cellMap.get(ref); if (!c) return 0;
    if (kid(c, "f")) return evalCell(ref, stack);
    const t = c.getAttribute("t"); const v = kid(c, "v");
    if (!v || (t && t !== "n")) return 0;
    const n = parseFloat(v.textContent); return isFinite(n) ? n : 0;
  };
  const evalExpr = (text, stack) => {
    const s = text.replace(/^=/, "").replace(/\s+/g, "");
    let m = /^SUM\(([^()]*)\)$/i.exec(s);
    if (m) return m[1].split(",").filter(Boolean).reduce((a, arg) => a + (/^[\d.]+$/.test(arg) ? +arg : [...refsIn(arg)].reduce((b, r) => b + valueOf(r, stack), 0)), 0);
    if (/^[A-Z$0-9.+]+$/.test(s)) return s.split("+").reduce((a, term) => a + (/^[\d.]+$/.test(term) ? +term : valueOf(term.replace(/\$/g, ""), stack)), 0);
    throw new Error("unsupported");
  };
  const evalCell = (ref, stack = new Set()) => {
    if (memo.has(ref)) return memo.get(ref);
    if (stack.has(ref)) throw new Error("cycle");
    stack.add(ref);
    const v = evalExpr(formulaOf(cellMap.get(ref)) || "", stack);
    stack.delete(ref); memo.set(ref, v); return v;
  };
  for (const [ref, c] of cellMap) {
    if (!kid(c, "f")) continue;
    const old = kid(c, "v"); if (old) c.removeChild(old);
    try {
      const v = evalCell(ref);
      if (c.getAttribute("t") && c.getAttribute("t") !== "n") c.removeAttribute("t");
      const e = sh.createElementNS(SS, "v"); e.textContent = String(+v.toFixed(10)); c.appendChild(e);
    } catch (er) { unsupported++; }
  }
  const XMLDECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  zip.file(T.sheetPath, XMLDECL + new XMLSerializer().serializeToString(sh).replace(/^<\?xml[^>]*\?>\s*/, ""));

  // 4. workbook parts: only touched when formulas changed, a result couldn't be computed, or the detail tab is added
  let wbXml = await zip.file("xl/workbook.xml").async("string");
  let relXml = await zip.file("xl/_rels/workbook.xml.rels").async("string");
  let ctXml = await zip.file("[Content_Types].xml").async("string");
  if (changed || unsupported) {
    if (/<calcPr\b/.test(wbXml)) wbXml = wbXml.replace(/<calcPr\b([^>]*?)(\/?)>/, (m, a, sl) => `<calcPr${a.replace(/\sfullCalcOnLoad="[^"]*"/, "")} fullCalcOnLoad="1"${sl}>`);
    else wbXml = wbXml.replace("</workbook>", '<calcPr fullCalcOnLoad="1"/></workbook>');
    if (zip.file("xl/calcChain.xml")) { zip.remove("xl/calcChain.xml"); relXml = relXml.replace(/<Relationship\b[^>]*calcChain\.xml"[^>]*\/>/, ""); ctXml = ctXml.replace(/<Override\b[^>]*calcChain\.xml"[^>]*\/>/, ""); }
  }
  if (S.detail) {
    const rowsOut = [["Site", "Date", "Shift", "Hours", "Description", "MOT/VOT", "Code", "Source file", "Notes"]];
    const incl = ctx.inc.slice().sort((a, b) => siteOf(a).localeCompare(siteOf(b)) || (a.date || "").localeCompare(b.date || ""));
    for (const f of incl) for (const l of f.lines) if (countsLine(l)) {
      const notes = [l.hoursNote, l.codeNote, parseFloat(l.hoursRaw) !== l.hours && !l.hoursNote ? `written "${l.hoursRaw}"` : ""].filter(Boolean).join("; ");
      rowsOut.push([siteOf(f), mdy(f.date), l.shift, r2(l.hours), l.desc, l.motvot, l.code, f.fileName + (f.pageCount > 1 ? ` (p${f.page})` : ""), notes]);
    }
    const xesc = s => String(s).replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c])).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
    const sheetRows = rowsOut.map((r, i) => `<row r="${i + 1}">` + r.map((v, j) => { const ref = colStr(j + 1) + (i + 1); return typeof v === "number" ? `<c r="${ref}"><v>${v}</v></c>` : `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xesc(v)}</t></is></c>`; }).join("") + "</row>").join("");
    const widths = [12, 10, 14, 8, 36, 9, 6, 38, 40];
    const detail = XMLDECL + `<worksheet xmlns="${SS}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols><sheetData>${sheetRows}</sheetData></worksheet>`;
    let n = 1; while (zip.file(`xl/worksheets/sheet${n}.xml`)) n++;
    zip.file(`xl/worksheets/sheet${n}.xml`, detail);
    let rn = 1; while (new RegExp(`Id="rId${rn}"`).test(relXml)) rn++;
    relXml = relXml.replace("</Relationships>", `<Relationship Id="rId${rn}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${n}.xml"/></Relationships>`);
    ctXml = ctXml.replace("</Types>", `<Override PartName="/xl/worksheets/sheet${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`);
    const ids = Array.from(wbXml.matchAll(/sheetId="(\d+)"/g)).map(m => +m[1]);
    let sname = `OT Detail ${dot(ctx.start).slice(0, 5)}-${dot(ctx.end).slice(0, 5)}`; let k = 2; while (wbXml.includes(`name="${sname}"`)) sname = `OT Detail ${k++}`;
    const rAttr = /xmlns:r=/.test(wbXml) ? "r:id" : 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id';
    wbXml = wbXml.replace("</sheets>", `<sheet name="${xesc(sname)}" sheetId="${Math.max(0, ...ids) + 1}" ${rAttr}="rId${rn}"/></sheets>`);
  }
  zip.file("xl/workbook.xml", wbXml); zip.file("xl/_rels/workbook.xml.rels", relXml); zip.file("[Content_Types].xml", ctXml);

  const blob = await zip.generateAsync({type: "blob", compression: "DEFLATE", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
  const base = T.name.replace(/\.xlsx$/i, "").replace(/[\s_]*\d{1,2}[.\-]\d{1,2}[.\-]?\d{0,4}.*$/, "").trim() || "Weekly Overtime Report";
  return {blob, filename: `${base} ${dot(ctx.start)}-${dot(ctx.end)}.xlsx`, changed};
}

async function saveFile(filename, blob){
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return "saved";
}

/* ---------- rendering ---------- */
function setLoad(html){ $("loadMsg").innerHTML = html; }
function flagHtml(fl, lineId){
  return fl.map(x => `<div class="flag ${x.sev}"><span>${esc(x.msg)}</span>${x.fix ? `<button class="btn link" data-act="fix" data-line="${lineId}" data-val="${x.fix.val}">${esc(x.fix.label)}</button>` : ""}${x.ack ? `<button class="btn link" data-act="ack" data-line="${lineId}" data-kind="${x.ack}">Keep as is</button>` : ""}</div>`).join("");
}
function siteOptions(sel){ const list = knownSites(); return `<option value="">— pick site —</option>` + list.map(n => `<option${n === sel ? " selected" : ""}>${esc(n)}</option>`).join(""); }
function codeOptions(sel){ return `<option value="">?</option>` + CODES.map(c => `<option value="${c}"${c === sel ? " selected" : ""} title="${esc(CODE_NAMES[c])}">${c}</option>`).join(""); }

function renderStats(ctx){
  const t = S.template;
  const lines = ctx.inc.reduce((n, f) => n + f.lines.filter(l => l.include && !isBlank(l)).length, 0);
  let bad = 0, warn = 0;
  for (const f of ctx.inc) { const ff = formFlags(f, ctx); bad += ff.filter(x => x.sev === "bad").length; warn += ff.filter(x => x.sev === "warn").length; for (const l of f.lines) if (l.include && !isBlank(l)) { const lf = lineFlags(l); bad += lf.filter(x => x.sev === "bad").length; warn += lf.filter(x => x.sev === "warn").length; } }
  $("stats").innerHTML = [
    t ? `<span class="chip ok">Template loaded</span>` : `<span class="chip bad">No template yet</span>`,
    `<span class="chip acc">${ctx.inc.length} forms · ${lines} lines</span>`,
    bad ? `<span class="chip bad">${bad} to fix</span>` : "",
    warn ? `<span class="chip warn">${warn} to check</span>` : "",
    ctx.start ? `<span class="chip">${mdy(ctx.start)} – ${mdy(ctx.end)}</span>` : ""
  ].join("");
  return {bad, warn};
}
function renderCoverage(ctx){
  const sites = [...new Set(ctx.inc.map(siteOf).filter(Boolean))].sort((a, b) => { const k = knownSites(); return k.indexOf(a) - k.indexOf(b) || a.localeCompare(b); });
  if (!sites.length || !ctx.start) { $("cov").innerHTML = `<p class="hint" style="padding:12px">Load forms to see which days are covered.</p>`; return; }
  const days = []; for (let d = ctx.start; d <= ctx.end && days.length < 45; d = addDays(d, 1)) days.push(d);
  let h = `<table class="cov"><thead><tr><th>Site</th>${days.map(d => `<th>${dow(d)}<br>${mdy(d).slice(0, -3)}</th>`).join("")}<th>Missing</th></tr></thead><tbody>`;
  for (const s of sites) {
    let miss = 0;
    h += `<tr><td>${esc(s)}</td>` + days.map(d => { const fs = ctx.day.get(s + "#" + d) || []; if (!fs.length) miss++; const cls = fs.length === 0 ? "c0" : fs.length === 1 ? "c1" : "c2"; return `<td><span class="cell ${cls}" title="${esc(fs.map(f => f.fileName + (f.pageCount > 1 ? " p" + f.page : "")).join("\n") || "No form")}">${fs.length || "—"}</span></td>`; }).join("") + `<td class="num">${miss ? `<span class="chip bad">${miss}</span>` : `<span class="chip ok">0</span>`}</td></tr>`;
  }
  $("cov").innerHTML = h + "</tbody></table>";
}
function renderForms(ctx){
  if (!S.forms.length) { $("forms").innerHTML = `<p class="hint" style="padding:12px">No forms loaded.</p>`; $("formsHint").textContent = ""; return; }
  const scans = S.forms.filter(f => f.kind === "scan"), todo = scans.filter(f => !realLines(f).length && !f.noOT).length;
  $("formsHint").textContent = scans.length ? `${scans.length} scanned page${scans.length === 1 ? "" : "s"}${todo ? `, ${todo} still need lines entered` : ", all entered"}` : "";
  let h = `<table><thead><tr><th>Use</th><th>Source</th><th>Site</th><th>Date</th><th>Form says</th><th class="num">Lines</th><th class="num">Hours</th><th>Needs a look</th><th></th></tr></thead><tbody>`;
  for (const f of S.forms) {
    const fl = formFlags(f, f.include ? ctx : null), w = worst(fl);
    const hrs = f.lines.filter(countsLine).reduce((a, l) => a + l.hours, 0);
    h += `<tr class="${!f.include ? "off" : w === "bad" ? "err" : w === "warn" ? "wrn" : ""}">
      <td><input type="checkbox" data-form="${f.id}" data-field="include" ${f.include ? "checked" : ""} aria-label="Use this form"></td>
      <td class="src">${esc(f.fileName)}${f.pageCount > 1 ? ` <span class="chip">p${f.page}/${f.pageCount}</span>` : ""}${f.kind === "scan" ? ` <span class="chip acc">scan</span>` : ""}${f.example ? ` <span class="chip warn">example</span>` : ""}</td>
      <td><select data-form="${f.id}" data-field="site" aria-label="Site">${siteOptions(siteOf(f))}</select></td>
      <td><input type="date" data-form="${f.id}" data-field="date" value="${f.date}" aria-label="Date"></td>
      <td class="src">${esc([f.headerSite, f.headerDate ? mdy(f.headerDate) : ""].filter(Boolean).join(" · ") || "—")}</td>
      <td class="num">${realLines(f).length}</td><td class="num">${fmtH(hrs)}</td>
      <td><div class="flags">${flagHtml(fl)}</div></td>
      <td>${f.kind === "scan" ? `<div style="display:flex;flex-direction:column;gap:4px;align-items:flex-start"><button class="btn sm${!realLines(f).length && !f.noOT ? " primary" : ""}" data-act="open-scan" data-form="${f.id}">${realLines(f).length ? "Edit lines" : "Enter lines"}</button>${!realLines(f).length ? `<label class="chk" style="font-size:12px"><input type="checkbox" data-form="${f.id}" data-field="noOT" ${f.noOT ? "checked" : ""}> No overtime</label>` : ""}</div>` : ""}</td></tr>`;
  }
  $("forms").innerHTML = h + "</tbody></table>";
}
function renderScan(){
  const f = S.forms.find(x => x.id === S.scanId);
  if (!f) { $("scanBox").innerHTML = ""; return; }
  const scans = S.forms.filter(x => x.kind === "scan"), i = scans.indexOf(f);
  $("scanBox").innerHTML = `<div class="scan">
    <div style="display:flex;flex-direction:column;gap:8px;min-width:0">
      <div class="bar"><strong>${esc(f.fileName)}${f.pageCount > 1 ? ` — page ${f.page} of ${f.pageCount}` : ""}</strong>
        <button class="btn sm" data-act="rotate" data-form="${f.id}">Rotate</button>
        <button class="btn sm" data-act="zoom">${S.zoom ? "Fit" : "Zoom"}</button></div>
      <div class="viewer${S.zoom ? " zoom" : ""}"><img src="${f.img}" alt="Scanned daily overtime report"></div>
    </div>
    <div class="ed">
      <div class="controls">
        <label class="fld" for="sc-site">Site<select id="sc-site" data-form="${f.id}" data-field="site">${siteOptions(siteOf(f))}</select></label>
        <label class="fld" for="sc-date">Date on form<input type="date" id="sc-date" data-form="${f.id}" data-field="date" value="${f.date}"></label>
      </div>
      <div class="scroll"><table><thead><tr><th>Shift</th><th>Hours</th><th>Description</th><th>MOT/VOT</th><th>Code</th><th></th></tr></thead><tbody>
      ${f.lines.map(l => `<tr>
        <td><input type="text" data-line="${l.id}" data-field="shift" value="${esc(l.shift)}" aria-label="Shift" placeholder="Night"></td>
        <td><input type="text" data-line="${l.id}" data-field="hoursRaw" value="${esc(l.hoursRaw)}" aria-label="Hours" style="width:64px" inputmode="decimal"></td>
        <td><input type="text" data-line="${l.id}" data-field="desc" value="${esc(l.desc)}" aria-label="Description"></td>
        <td><select data-line="${l.id}" data-field="motvot" aria-label="MOT or VOT"><option></option><option${l.motvot === "MOT" ? " selected" : ""}>MOT</option><option${l.motvot === "VOT" ? " selected" : ""}>VOT</option></select></td>
        <td><select class="code" data-line="${l.id}" data-field="code" aria-label="Reason code">${codeOptions(l.code)}</select></td>
        <td><button class="btn sm" data-act="del-line" data-line="${l.id}" aria-label="Delete line">✕</button></td></tr>`).join("")}
      </tbody></table></div>
      <div class="bar"><button class="btn" data-act="add-line" data-form="${f.id}">Add line</button>
        <span class="hint">Hours as decimals (7.75), or "45 min". Tab moves across; Enter in the last field adds a line.</span></div>
      <div class="bar" style="justify-content:space-between">
        <button class="btn" data-act="scan-go" data-dir="-1" ${i <= 0 ? "disabled" : ""}>‹ Previous scan</button>
        <button class="btn primary" data-act="close-scan">Done</button>
        <button class="btn" data-act="scan-go" data-dir="1" ${i >= scans.length - 1 ? "disabled" : ""}>Next scan ›</button>
      </div>
    </div></div>`;
}
function renderLines(ctx){
  const sel = $("siteFilter"); const sites = [...new Set(S.forms.map(siteOf).filter(Boolean))].sort();
  sel.innerHTML = `<option value="">All sites</option>` + sites.map(s => `<option${s === S.siteFilter ? " selected" : ""}>${esc(s)}</option>`).join("");
  const rows = [];
  for (const f of ctx.inc) {
    if (S.siteFilter && siteOf(f) !== S.siteFilter) continue;
    for (const l of f.lines) { if (isBlank(l)) continue; const fl = lineFlags(l); if (S.onlyFlag && !fl.some(x => x.sev !== "info")) continue; rows.push({f, l, fl}); }
  }
  if (!rows.length) { $("lines").innerHTML = `<p class="hint" style="padding:12px">${S.onlyFlag ? "Nothing left to look at." : "No lines yet."}</p>`; return; }
  rows.sort((a, b) => (siteOf(a.f) || "").localeCompare(siteOf(b.f) || "") || (a.f.date || "").localeCompare(b.f.date || ""));
  let h = `<table><thead><tr><th>Use</th><th>Site</th><th>Date</th><th>Shift</th><th class="num">Hours</th><th>Description</th><th>MOT/VOT</th><th>Code</th><th>Source</th><th>Needs a look</th></tr></thead><tbody>`;
  for (const {f, l, fl} of rows) {
    const w = worst(fl);
    h += `<tr class="${!l.include ? "off" : w === "bad" ? "err" : w === "warn" ? "wrn" : ""}">
      <td><input type="checkbox" data-line="${l.id}" data-field="include" ${l.include ? "checked" : ""} aria-label="Use this line"></td>
      <td>${esc(siteOf(f) || "?")}</td><td class="mono">${mdy(f.date)}</td><td class="mono">${esc(l.shift)}</td>
      <td class="num"><input class="h" type="number" step="0.01" min="0" data-line="${l.id}" data-field="hours" value="${isFinite(l.hours) ? l.hours : ""}" aria-label="Hours"></td>
      <td>${esc(l.desc)}</td><td>${esc(l.motvot)}</td>
      <td><select class="code" data-line="${l.id}" data-field="code" aria-label="Reason code">${codeOptions(l.code)}</select></td>
      <td class="src">${esc(f.fileName)}${f.pageCount > 1 ? ` p${f.page}` : ""}</td>
      <td><div class="flags">${flagHtml(fl, l.id)}</div></td></tr>`;
  }
  $("lines").innerHTML = h + "</tbody></table>";
}
function renderSummary(ctx, counts){
  const tot = {}, used = new Set(); let grand = 0;
  for (const f of ctx.inc) { const s = siteOf(f) || "?"; tot[s] = tot[s] || {}; for (const l of f.lines) if (countsLine(l)) { tot[s][l.code] = (tot[s][l.code] || 0) + l.hours; used.add(l.code); grand += l.hours; } }
  const sites = Object.keys(tot).sort((a, b) => { const k = knownSites(); return k.indexOf(a) - k.indexOf(b) || a.localeCompare(b); });
  const codes = CODES.filter(c => used.has(c));
  if (!sites.length) $("sum").innerHTML = `<p class="hint" style="padding:12px">Totals by site and reason code will show here.</p>`;
  else {
    let h = `<table class="sum"><thead><tr><th>Site</th>${codes.map(c => `<th title="${esc(CODE_NAMES[c])}">${c}</th>`).join("")}<th>Total</th></tr></thead><tbody>`;
    for (const s of sites) { const row = tot[s]; const t = Object.values(row).reduce((a, b) => a + b, 0); h += `<tr><td>${esc(s)}</td>${codes.map(c => row[c] ? `<td class="num">${fmtH(row[c])}</td>` : `<td class="num z">·</td>`).join("")}<td class="num"><strong>${fmtH(t)}</strong></td></tr>`; }
    h += `</tbody><tfoot><tr><td>Total</td>${codes.map(c => `<td class="num">${fmtH(sites.reduce((a, s) => a + (tot[s][c] || 0), 0))}</td>`).join("")}<td class="num">${fmtH(grand)}</td></tr></tfoot></table>`;
    $("sum").innerHTML = h;
  }
  $("grand").textContent = fmtH(grand);
  const btn = $("genBtn");
  btn.disabled = !S.template || !ctx.inc.length || counts.bad > 0 || S.example;
  const m = $("genMsg");
  if (!m.dataset.sticky) {
    m.innerHTML = S.example ? `<span class="muted">Example data shown. Load your files to build a report.</span>`
      : !S.template ? `<span class="flag bad">Load the weekly template (.xlsx) to build.</span>`
      : counts.bad ? `<span class="flag bad">${counts.bad} item${counts.bad === 1 ? "" : "s"} must be fixed first. <button class="btn link" data-act="show-issues">Show them</button></span>`
      : counts.warn ? `<span class="flag warn">${counts.warn} item${counts.warn === 1 ? "" : "s"} flagged to check. You can still build.</span>` : `<span class="flag info">Ready.</span>`;
  }
}
function renderAll(){
  const ctx = context();
  $("pWeek").value = ctx.start || ""; $("pWeekEnd").textContent = ctx.end ? `Wed ${mdy(ctx.end)}` : "—";
  const counts = renderStats(ctx);
  renderCoverage(ctx); renderForms(ctx); renderScan(); renderLines(ctx); renderSummary(ctx, counts);
}
function renderLive(){ const ctx = context(); const counts = renderStats(ctx); renderCoverage(ctx); renderForms(ctx); renderLines(ctx); renderSummary(ctx, counts); }

/* ---------- events ---------- */
const findLine = id => { for (const f of S.forms) { const l = f.lines.find(x => x.id === +id); if (l) return {f, l}; } return {}; };
const findForm = id => S.forms.find(f => f.id === +id);
function onField(e, live){
  const t = e.target;
  if (t.dataset.form && t.dataset.field) {
    const f = findForm(t.dataset.form); if (!f) return;
    if (t.dataset.field === "include") f.include = t.checked;
    if (t.dataset.field === "noOT") f.noOT = t.checked;
    if (t.dataset.field === "site") f.siteOverride = t.value;
    if (t.dataset.field === "date") { f.date = t.value; f.dateGuessed = false; }
    $("genMsg").dataset.sticky = ""; renderAll(); return true;
  }
  if (t.dataset.line && t.dataset.field) {
    const {l} = findLine(t.dataset.line); if (!l) return;
    const k = t.dataset.field;
    if (k === "include") l.include = t.checked;
    else if (k === "hours") { const v = parseFloat(t.value); l.hours = isFinite(v) ? v : NaN; l.hoursNote = ""; l.hoursRaw = t.value; }
    else if (k === "hoursRaw") { const p = parseHours(t.value); l.hoursRaw = t.value; l.hours = p.hours; l.hoursNote = p.note; }
    else if (k === "code") { l.code = t.value; l.codeNote = ""; l.ack.kw = false; }
    else if (k === "motvot") l.motvot = t.value;
    else l[k] = t.value;
    $("genMsg").dataset.sticky = "";
    if (live) renderLive(); else renderAll();
    return true;
  }
}
document.addEventListener("change", e => {
  if (!e.target.closest || !e.target.closest("#otrScreen")) return;
  if (onField(e, !!e.target.closest("#otr_scanBox"))) return;
  const t = e.target;
  if (t.id === "otr_fileIn") { handleFiles(Array.from(t.files)); t.value = ""; }
  else if (t.id === "otr_pWeek") { S.week = t.value ? thursdayOf(t.value) : ""; $("genMsg").dataset.sticky = ""; renderAll(); }
  else if (t.id === "otr_detail") S.detail = t.checked;
  else if (t.id === "otr_ppn") S.ppn = t.value.trim();
  else if (t.id === "otr_repair") S.repair = t.checked;
  else if (t.id === "otr_onlyFlag") { S.onlyFlag = t.checked; renderAll(); }
  else if (t.id === "otr_siteFilter") { S.siteFilter = t.value; renderAll(); }
});
document.addEventListener("input", e => { if (!e.target.closest || !e.target.closest("#otrScreen")) return; if (e.target.id === "otr_ppn") S.ppn = e.target.value.trim(); });
document.addEventListener("keydown", e => {
  const t = e.target; if (!t.closest || !t.closest("#otrScreen")) return;
  if (e.key === "Enter" && t.closest && t.closest("#otr_scanBox") && t.dataset.line) {
    e.preventDefault(); t.dispatchEvent(new Event("change", {bubbles: true}));
    const row = t.closest("tr"); if (row && !row.nextElementSibling) addLine(S.scanId);
  }
});
function addLine(formId){
  const f = findForm(formId); if (!f) return;
  const prev = f.lines[f.lines.length - 1];
  const l = makeLine({shift: prev ? prev.shift : "", hoursRaw: "", desc: "", mv: prev ? prev.motvot : "", codeRaw: ""});
  f.lines.push(l); renderAll();
  const el = document.querySelector(`#otr_scanBox input[data-line="${l.id}"][data-field="hoursRaw"]`); if (el) el.focus();
}
document.addEventListener("click", async e => {
  const b = e.target.closest("#otrScreen [data-act]"); if (!b) return;
  const act = b.dataset.act;
  if (act === "fix") { const {l} = findLine(b.dataset.line); l.hours = +b.dataset.val; l.hoursNote = ""; renderAll(); }
  else if (act === "ack") { const {l} = findLine(b.dataset.line); l.ack[b.dataset.kind] = true; renderAll(); }
  else if (act === "open-scan") { S.scanId = +b.dataset.form; renderAll(); $("scanBox").scrollIntoView({behavior: "smooth", block: "start"}); }
  else if (act === "close-scan") { S.scanId = null; renderAll(); }
  else if (act === "scan-go") { const scans = S.forms.filter(x => x.kind === "scan"); const i = scans.findIndex(x => x.id === S.scanId) + +b.dataset.dir; if (scans[i]) { S.scanId = scans[i].id; renderAll(); } }
  else if (act === "add-line") addLine(+b.dataset.form);
  else if (act === "del-line") { const {f, l} = findLine(b.dataset.line); f.lines = f.lines.filter(x => x !== l); renderAll(); }
  else if (act === "zoom") { S.zoom = !S.zoom; renderScan(); }
  else if (act === "rotate") { const f = findForm(b.dataset.form); f.img = await rotateImg(f.img); renderScan(); }
  else if (act === "show-issues") { S.onlyFlag = true; $("onlyFlag").checked = true; renderAll(); $("lines").scrollIntoView({behavior: "smooth", block: "start"}); }
  else if (act === "clear") { S.forms = []; S.example = false; S.week = ""; S.scanId = null; setLoad(""); $("genMsg").dataset.sticky = ""; renderAll(); }
  else if (act === "generate") {
    const m = $("genMsg"); m.dataset.sticky = "1"; b.disabled = true;
    m.innerHTML = `<span class="muted">Building…</span>`;
    try {
      const {blob, filename, changed} = await buildReport();
      const r = await saveFile(filename, blob);
      m.innerHTML = r === "declined" ? `<span class="flag warn">Save cancelled.</span>` : r === "busy" ? `<span class="flag warn">A save prompt is already open.</span>` : `<span class="flag info">Built ${esc(filename)}${changed ? ` · ${changed} summary formula${changed === 1 ? "" : "s"} fixed` : ""}${S.detail ? " · detail tab added" : ""}</span>`;
    } catch (er) { m.innerHTML = `<span class="flag bad">Couldn't build the report: ${esc(er.message || er)}</span>`; console.error(er); }
    b.disabled = false;
  }
});
function rotateImg(src){ return new Promise(res => { const im = new Image(); im.onload = () => { const c = document.createElement("canvas"); c.width = im.height; c.height = im.width; const g = c.getContext("2d"); g.translate(c.width / 2, c.height / 2); g.rotate(Math.PI / 2); g.drawImage(im, -im.width / 2, -im.height / 2); res(c.toDataURL("image/jpeg", 0.85)); }; im.src = src; }); }

const drop = $("drop");
["dragenter", "dragover"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add("over"); }));
["dragleave", "drop"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove("over"); }));
drop.addEventListener("drop", e => { if (e.dataTransfer && e.dataTransfer.files.length) handleFiles(Array.from(e.dataTransfer.files)); });

/* ---------- entry point, called when the screen opens ---------- */
let ready = false;
window.otrOpen = async function(){
  const msg = document.getElementById("otr_loadMsg");
  try { await ensureLibs(); } catch (e) { if (msg) msg.innerHTML = `<div class="banner bad">${esc(e.message)} Check the connection and reopen this screen.</div>`; return; }
  if (!ready) {
    ready = true;
    try { const o = JSON.parse(localStorage.getItem("wf_otr_opts") || "{}"); S.ppn = o.ppn || ""; S.repair = !!o.repair; S.detail = !!o.detail; } catch (e) {}
    $("ppn").value = S.ppn; $("repair").checked = S.repair; $("detail").checked = S.detail;
    ["ppn", "repair", "detail"].forEach(id => $(id).addEventListener("change", saveOpts));
    const t = await kvGet("template");
    if (t && t.buf) { try { S.template = await readTemplate(t.name, t.buf); renderTplRow(t.name); } catch (e) { renderTplRow(""); } }
    renderAll();
  }
};
})();
