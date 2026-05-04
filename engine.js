/**
 * Chrono of Life — engine.js  v2
 * All RCA fixes applied:
 *  - Correct reset view (zoom=2, centred on 1900 CE)
 *  - Thin header bar (not 4 tall rows)
 *  - Fixed "From Big Bang" calculation
 *  - Labels only at zoom > 1.5
 *  - World rows split by region
 *  - Proper row heights for content rows
 */

// ── Canvas ────────────────────────────────────────────────────────────────────
const canvas = document.getElementById('c');
const ctx    = canvas.getContext('2d');

function resize() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  draw();
}
window.addEventListener('resize', resize);
canvas.width  = window.innerWidth;
canvas.height = window.innerHeight;

// ── State ─────────────────────────────────────────────────────────────────────
let events      = [];
let panX        = 0;
let zoomScale   = 2;
let selEvent    = null;
let isDragging  = false;
let lastMouseX  = 0;
let indiaFilter = false;

// ── Piecewise axis ────────────────────────────────────────────────────────────
const SEG = [
  [-13.8e9, -1e9,    200],
  [-1e9,    -100e6,  150],
  [-100e6,  -10e6,   150],
  [-10e6,   -100e3,  200],
  [-100e3,  -3000,   150],
  [-3000,   0,       200],
  [0,       1500,    80 ],
  [1500,    2030,    300],
  [2030,    1e4,     80 ],
  [1e4,     1e6,     80 ],
  [1e6,     1e9,     100],
  [1e9,     1e100,   300],
];

const ZONES = (function() {
  let cum = 0;
  const raw = SEG.map(([ts,te,w]) => { const z={tStart:ts,tEnd:te,pxStart:cum,pxEnd:cum+w}; cum+=w; return z; });
  let pz = 0;
  for (const z of raw) {
    if (0 >= z.tStart && 0 <= z.tEnd) { pz = z.pxStart + (0-z.tStart)/(z.tEnd-z.tStart)*(z.pxEnd-z.pxStart); break; }
  }
  return raw.map(z => ({...z, pxStart:z.pxStart-pz, pxEnd:z.pxEnd-pz}));
})();

function tx(t) {
  if (t <= ZONES[0].tStart) return ZONES[0].pxStart;
  if (t >= ZONES[ZONES.length-1].tEnd) return ZONES[ZONES.length-1].pxEnd;
  for (let i=0; i<ZONES.length; i++) {
    const z = ZONES[i];
    const hit = i<ZONES.length-1 ? (t>=z.tStart&&t<z.tEnd) : (t>=z.tStart&&t<=z.tEnd);
    if (hit) { const f=(t-z.tStart)/(z.tEnd-z.tStart); return z.pxStart+f*(z.pxEnd-z.pxStart); }
  }
  return 0;
}
function txInv(px) {
  if (px <= ZONES[0].pxStart) return ZONES[0].tStart;
  if (px >= ZONES[ZONES.length-1].pxEnd) return ZONES[ZONES.length-1].tEnd;
  for (let i=0; i<ZONES.length; i++) {
    const z = ZONES[i];
    const hit = i<ZONES.length-1 ? (px>=z.pxStart&&px<z.pxEnd) : (px>=z.pxStart&&px<=z.pxEnd);
    if (hit) { const f=(px-z.pxStart)/(z.pxEnd-z.pxStart); return z.tStart+f*(z.tEnd-z.tStart); }
  }
  return 0;
}
function sx(t) { return canvas.width/2 + panX + tx(t)*zoomScale; }
function timeAt(screenPx) { return txInv((screenPx - canvas.width/2 - panX)/zoomScale); }

// ── Layout ────────────────────────────────────────────────────────────────────
const HUD_H   = 38;   // top HUD bar
const LABEL_W = 150;  // left label column
const MARKER_R = 5;

// Content rows only — no header rows taking up space
const CONTENT_ROWS = [
  { key:'physical',      label:'Physical & Natural', bg:'#e8f5e9', fg:'#1b5e20', dot:'#4caf50' },
  { key:'evolution',     label:'Evolution',          bg:'#fffde7', fg:'#5d4037', dot:'#ff9800' },
  { key:'science',       label:'Science & Tech',     bg:'#e3f2fd', fg:'#0d47a1', dot:'#2196f3' },
  { key:'india',         label:'India',              bg:'#1a3a6b', fg:'#ffffff', dot:'#FF9933' },
  { key:'world_asia',    label:'World / Asia',       bg:'#0d2b5e', fg:'#90caf9', dot:'#90caf9' },
  { key:'world_europe',  label:'World / Europe',     bg:'#0d2b5e', fg:'#80cbc4', dot:'#80cbc4' },
  { key:'world_america', label:'World / America',    bg:'#0d2b5e', fg:'#ce93d8', dot:'#ce93d8' },
];

function getLayout() {
  const H = canvas.height - HUD_H;
  const rowH = Math.floor(H / CONTENT_ROWS.length);
  return CONTENT_ROWS.map((def, i) => ({
    ...def,
    y:       HUD_H + i * rowH,
    height:  rowH,
    centreY: HUD_H + i * rowH + rowH / 2,
  }));
}

// ── Time formatting ───────────────────────────────────────────────────────────
function fmtTime(t) {
  if (t === 0) return 'Year 0 CE';
  const abs = Math.abs(t);
  if (abs >= 1e9)  return (abs/1e9).toPrecision(3) + ' Billion Years ' + (t<0?'Ago':'From Now');
  if (abs >= 1e6)  return (abs/1e6).toPrecision(3) + ' Million Years ' + (t<0?'Ago':'From Now');
  if (abs >= 1000) return t < 0 ? Math.round(abs)+' BCE' : Math.round(abs)+' CE';
  if (abs >= 1)    return t < 0 ? Math.round(abs)+' BCE' : Math.round(abs)+' CE';
  return t.toExponential(2) + ' Years';
}

function fmtBigBang(t) {
  // t is years relative to present (negative = past)
  // Time since Big Bang = 13.8e9 + t  (e.g. t=-13.8e9 → 0, t=0 → 13.8B)
  const sinceB = 13.8e9 + t;
  if (sinceB <= 0) return '0 (Big Bang)';
  if (sinceB >= 1e9) return (sinceB/1e9).toPrecision(3) + ' Billion Years After BB';
  if (sinceB >= 1e6) return (sinceB/1e6).toPrecision(3) + ' Million Years After BB';
  return Math.round(sinceB) + ' Years After BB';
}

const AGE_TABLE = [
  [-Infinity,-13.77e9,'Planck Epoch'],[-13.77e9,-13.4e9,'Dark Ages'],
  [-13.4e9,-11e9,'Cosmic Dawn'],[-11e9,-5e9,'Galactic Age'],
  [-5e9,-4.6e9,'Pre-Solar'],[-4.6e9,-4e9,'Hadean'],
  [-4e9,-2.5e9,'Archean'],[-2.5e9,-541e6,'Proterozoic'],
  [-541e6,-252e6,'Paleozoic'],[-252e6,-66e6,'Mesozoic'],
  [-66e6,-2.6e6,'Cenozoic'],[-2.6e6,-11700,'Pleistocene'],
  [-11700,-3300,'Neolithic'],[-3300,-1200,'Bronze Age'],
  [-1200,-550,'Iron Age'],[-550,476,'Classical'],
  [476,1453,'Medieval'],[1453,1760,'Early Modern'],
  [1760,1900,'Industrial'],[1900,1945,'20th Century'],
  [1945,1991,'Cold War'],[1991,2026,'Information Age'],
  [2026,Infinity,'Future'],
];
function getAge(t) {
  for (const [f,to,l] of AGE_TABLE) if (t>=f&&t<to) return l;
  return '—';
}

// ── Draw ──────────────────────────────────────────────────────────────────────
function draw() {
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const layout = getLayout();
  const centreT = timeAt(W/2);

  // Row backgrounds + labels
  for (const row of layout) {
    // Background
    ctx.fillStyle = row.bg;
    ctx.fillRect(LABEL_W, row.y, W-LABEL_W, row.height);

    // Label cell
    ctx.fillStyle = row.bg;
    ctx.fillRect(0, row.y, LABEL_W, row.height);
    ctx.fillStyle = row.fg;
    ctx.font = `bold ${Math.min(12, row.height*0.28)}px system-ui,sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.fillText(row.label, 6, row.centreY);
  }

  // Label column border
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(LABEL_W,HUD_H); ctx.lineTo(LABEL_W,H); ctx.stroke();

  // Row dividers
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 1;
  for (const row of layout) {
    ctx.beginPath(); ctx.moveTo(0,row.y+row.height); ctx.lineTo(W,row.y+row.height); ctx.stroke();
  }

  // Reference longitude lines
  const refs = [-13.8e9,-4.6e9,-3.8e9,-252e6,-66e6,-2.8e6,-10000,0,1500,1760,1947,2026,5e9];
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth = 1;
  for (const t of refs) {
    const x = sx(t);
    if (x<LABEL_W||x>W) continue;
    ctx.beginPath(); ctx.moveTo(x,HUD_H); ctx.lineTo(x,H); ctx.stroke();
  }

  // Events
  const showLabels = zoomScale >= 1.5;
  ctx.font = '9px system-ui,sans-serif';

  for (const ev of events) {
    const x = sx(ev.time);
    if (x < LABEL_W-8 || x > W+8) continue;

    const row = layout.find(r => r.key === ev.row);
    if (!row) continue;

    const cy = row.centreY;
    const col = row.dot;
    const isSel = selEvent && selEvent.time===ev.time && selEvent.title===ev.title;
    const dim = indiaFilter && !ev.india;

    ctx.save();
    if (dim) ctx.globalAlpha = 0.12;

    // Connector
    ctx.strokeStyle = col + '44';
    ctx.lineWidth = 1;
    ctx.setLineDash([2,3]);
    ctx.beginPath(); ctx.moveTo(x, cy-MARKER_R-2); ctx.lineTo(x, row.y+row.height); ctx.stroke();
    ctx.setLineDash([]);

    // Dot
    ctx.beginPath();
    ctx.arc(x, cy, isSel ? MARKER_R+3 : MARKER_R, 0, Math.PI*2);
    ctx.fillStyle = isSel ? '#fff' : col;
    ctx.fill();
    if (isSel) { ctx.strokeStyle=col; ctx.lineWidth=2; ctx.stroke(); }

    // Label
    if (showLabels && x > LABEL_W+4) {
      ctx.fillStyle = row.fg==='#ffffff'||row.fg==='#90caf9'||row.fg==='#80cbc4'||row.fg==='#ce93d8'
        ? 'rgba(255,255,255,0.9)' : row.fg;
      ctx.textBaseline = 'bottom';
      const lbl = ev.title.length > 24 ? ev.title.substring(0,22)+'…' : ev.title;
      ctx.fillText(lbl, x+7, cy-2);
    }

    ctx.restore();
  }

  // HUD
  drawHUD(centreT, W);
}

function drawHUD(centreT, W) {
  // Background
  ctx.fillStyle = 'rgba(5,7,15,0.92)';
  ctx.fillRect(0, 0, W, HUD_H);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0,HUD_H); ctx.lineTo(W,HUD_H); ctx.stroke();

  // Time info
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#e8eaf6';
  ctx.font = 'bold 13px system-ui,sans-serif';
  ctx.fillText(fmtTime(centreT), LABEL_W+8, HUD_H/2);

  // Age badge
  const age = getAge(centreT);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  const ageX = LABEL_W + 8 + ctx.measureText(fmtTime(centreT)).width + 12;
  ctx.beginPath(); ctx.roundRect(ageX, 8, ctx.measureText(age).width+16, HUD_H-16, 4); ctx.fill();
  ctx.fillStyle = '#90caf9';
  ctx.font = '11px system-ui,sans-serif';
  ctx.fillText(age, ageX+8, HUD_H/2);

  // From Big Bang
  ctx.fillStyle = 'rgba(255,200,50,0.7)';
  ctx.font = '10px system-ui,sans-serif';
  ctx.fillText(fmtBigBang(centreT), LABEL_W+8, HUD_H-6);

  // Label column header
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = 'bold 10px system-ui,sans-serif';
  ctx.fillText('From Current Era', 4, HUD_H/2 - 6);
  ctx.font = '9px system-ui,sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillText(fmtTime(centreT), 4, HUD_H/2 + 7);

  // Zoom
  ctx.fillStyle = '#90caf9';
  ctx.font = '11px system-ui,sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('zoom: ' + zoomScale.toFixed(1) + 'x', W-220, HUD_H/2);
  ctx.textAlign = 'left';

  // Buttons
  drawBtn(W-210, 7, 70, HUD_H-14, '⌂ Reset', '#1e2a3a', '#64b5f6');
  drawBtn(W-130, 7, 80, HUD_H-14, indiaFilter?'🇮🇳 ON':'🇮🇳 India', indiaFilter?'#3a2000':'#1e2a3a', indiaFilter?'#FF9933':'#aaa');
  drawBtn(W-40,  7, 32, HUD_H-14, '?', '#1e2a3a', '#aaa');
}

function drawBtn(x, y, w, h, lbl, bg, fg) {
  ctx.fillStyle = bg;
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(x,y,w,h,4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = fg;
  ctx.font = '11px system-ui,sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(lbl, x+w/2, y+h/2);
  ctx.textAlign = 'left';
}

// ── Detail panel ──────────────────────────────────────────────────────────────
const panel     = document.getElementById('panel');
const pTitle    = document.getElementById('panel-title');
const pBody     = document.getElementById('panel-body');
const pClose    = document.getElementById('panel-close');
const pLink     = document.getElementById('panel-link');
const pTime     = document.getElementById('panel-time');

pClose.addEventListener('click', () => { panel.style.display='none'; selEvent=null; draw(); });

function showPanel(ev, anchorX) {
  selEvent = ev;
  pTitle.textContent = ev.title;
  pTime.textContent  = fmtTime(ev.time) + (ev.age ? ' · ' + ev.age : '');
  pBody.innerHTML    = '<em style="color:#666">Loading…</em>';

  // Position panel
  const W = canvas.width, H = canvas.height;
  const pw = Math.min(360, W - 20);
  let left = anchorX + 16;
  if (left + pw > W - 8) left = anchorX - pw - 16;
  if (left < 8) left = 8;
  panel.style.width  = pw + 'px';
  panel.style.left   = left + 'px';
  panel.style.top    = Math.min(anchorX < W/2 ? 60 : 60, H - 400) + 'px';
  panel.style.display = 'block';

  if (ev.link) {
    pLink.href = ev.link;
    pLink.style.display = 'block';
    const slug = ev.link.split('/wiki/').pop() || ev.title.replace(/ /g,'_');
    fetch('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(slug))
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) { pBody.innerHTML = buildFallback(ev); return; }
        let h = '';
        if (d.thumbnail) h += `<img src="${d.thumbnail.source}" alt="">`;
        h += `<p>${d.extract||''}</p>`;
        if (ev.india) h += `<p class="india-note"><strong>India:</strong> ${ev.india}</p>`;
        pBody.innerHTML = h;
      })
      .catch(() => { pBody.innerHTML = buildFallback(ev); });
  } else {
    pLink.style.display = 'none';
    pBody.innerHTML = buildFallback(ev);
  }
  draw();
}

function buildFallback(ev) {
  let h = '';
  if (ev.india) h += `<p class="india-note"><strong>India:</strong> ${ev.india}</p>`;
  if (ev.world) h += `<p>${ev.world}</p>`;
  if (!h) h = '<p style="color:#666">No description available.</p>';
  return h;
}

// ── Input ─────────────────────────────────────────────────────────────────────
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const f = e.deltaY < 0 ? 1.12 : 1/1.12;
  const ox = e.clientX;
  const lp = (ox - canvas.width/2 - panX) / zoomScale;
  zoomScale = Math.max(0.3, Math.min(2000, zoomScale*f));
  panX = ox - canvas.width/2 - lp*zoomScale;
  clamp(); draw();
}, {passive:false});

canvas.addEventListener('mousedown', e => { if(e.button===0){isDragging=true; lastMouseX=e.clientX;} });
canvas.addEventListener('mousemove', e => {
  if (isDragging) { panX += e.clientX-lastMouseX; lastMouseX=e.clientX; clamp(); draw(); }
});
canvas.addEventListener('mouseup',   () => { isDragging=false; });
canvas.addEventListener('mouseleave',() => { isDragging=false; });

// Touch
let ltx=0, lpd=0, pinch=false;
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  if (e.touches.length===2) { pinch=true; lpd=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY); }
  else ltx=e.touches[0].clientX;
},{passive:false});
canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  if (pinch&&e.touches.length===2) {
    const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
    const mx=(e.touches[0].clientX+e.touches[1].clientX)/2;
    const lp=(mx-canvas.width/2-panX)/zoomScale;
    zoomScale=Math.max(0.3,Math.min(2000,zoomScale*d/lpd));
    panX=mx-canvas.width/2-lp*zoomScale; lpd=d; clamp(); draw();
  } else if (e.touches.length===1) {
    panX+=e.touches[0].clientX-ltx; ltx=e.touches[0].clientX; clamp(); draw();
  }
},{passive:false});
canvas.addEventListener('touchend', e => { if(e.touches.length<2) pinch=false; });

canvas.addEventListener('click', e => {
  const W = canvas.width;
  // HUD buttons
  if (e.clientY < HUD_H) {
    if (e.clientX >= W-210 && e.clientX <= W-140) { resetView(); return; }
    if (e.clientX >= W-130 && e.clientX <= W-50)  { indiaFilter=!indiaFilter; draw(); return; }
    return;
  }
  // Close panel
  if (panel.style.display==='block') { panel.style.display='none'; selEvent=null; draw(); return; }
  // Hit test
  const layout = getLayout();
  let best=null, bd=18;
  for (const ev of events) {
    const x=sx(ev.time);
    if (x<LABEL_W) continue;
    const row=layout.find(r=>r.key===ev.row);
    if (!row) continue;
    const d=Math.hypot(e.clientX-x, e.clientY-row.centreY);
    if (d<bd) { bd=d; best=ev; }
  }
  if (best) showPanel(best, sx(best.time));
});

window.addEventListener('keydown', e => {
  const s=80;
  if(e.key==='ArrowLeft')  { panX+=s; clamp(); draw(); }
  if(e.key==='ArrowRight') { panX-=s; clamp(); draw(); }
  if(e.key==='+'||e.key==='=') { zoomScale=Math.min(2000,zoomScale*1.2); draw(); }
  if(e.key==='-')              { zoomScale=Math.max(0.3,zoomScale/1.2); draw(); }
  if(e.key==='Home')           { resetView(); }
  if(e.key==='Escape')         { panel.style.display='none'; selEvent=null; draw(); }
});

function clamp() {
  const W=canvas.width;
  const lp=tx(-13.8e9), rp=tx(1e100);
  const mn=-(W/2)-lp*zoomScale, mx=W/2-rp*zoomScale;
  panX = mn<mx ? Math.max(mn,Math.min(mx,panX)) : mn;
}

function resetView() {
  // Zoom=2, centred on 1900 CE so modern era (1500-2026) is fully visible
  zoomScale = 2;
  panX = -tx(1900) * zoomScale;
  clamp();
  draw();
}

// ── Load data ─────────────────────────────────────────────────────────────────
const BASE = (function() {
  const p = window.location.pathname;
  // Strip trailing slash and filename
  const dir = p.endsWith('/') ? p.slice(0,-1) : p.replace(/\/[^/]*$/,'');
  return dir || '';
})();

fetch(BASE + '/data.json')
  .then(r => { if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
  .then(d => {
    events = Array.isArray(d) ? d : [];
    console.log('[chrono] Loaded', events.length, 'events');
    document.getElementById('loading').style.display = 'none';
    resetView();
  })
  .catch(err => {
    console.error('[chrono] data.json failed:', err);
    events = [
      {time:-13.8e9,title:'Big Bang',row:'physical'},
      {time:-4.6e9, title:'Earth forms',row:'physical'},
      {time:-3.8e9, title:'Abiogenesis',row:'evolution'},
      {time:-66e6,  title:'K-Pg Extinction',row:'physical'},
      {time:-2.8e6, title:'Genus Homo',row:'evolution'},
      {time:-10000, title:'Neolithic Revolution',row:'evolution'},
      {time:-500,   title:'Axial Age',row:'science'},
      {time:0,      title:'Year 0 CE',row:'physical'},
      {time:1526,   title:'Mughal Empire',row:'india',india:'Babur wins Panipat'},
      {time:1760,   title:'Industrial Revolution',row:'science'},
      {time:1947,   title:'India Independence',row:'india',india:'Aug 15 1947'},
      {time:2026,   title:'Present',row:'physical'},
    ];
    document.getElementById('loading').style.display = 'none';
    resetView();
  });

// Draw immediately so screen is never blank
resetView();
