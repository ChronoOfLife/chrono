/**
 * Chrono of Life — engine.js  v3
 * UX redesign: scroll=pan, Ctrl+scroll=zoom, time ruler, staggered labels, tooltips
 */

// ── Canvas setup ──────────────────────────────────────────────────────────────
const canvas = document.getElementById('c');
const ctx    = canvas.getContext('2d');
const tooltip = document.getElementById('tooltip');

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
let zoomScale   = 1.5;
let selEvent    = null;
let isDragging  = false;
let lastMouseX  = 0;
let indiaFilter = false;
let hoverEvent  = null;

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
  const raw = SEG.map(([ts,te,w]) => {
    const z = {tStart:ts, tEnd:te, pxStart:cum, pxEnd:cum+w};
    cum += w;
    return z;
  });
  let pz = 0;
  for (const z of raw) {
    if (0 >= z.tStart && 0 <= z.tEnd) {
      pz = z.pxStart + (0-z.tStart)/(z.tEnd-z.tStart)*(z.pxEnd-z.pxStart);
      break;
    }
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


// ── Layout constants ──────────────────────────────────────────────────────────
const HUD_H    = 44;
const RULER_H  = 28;
const LABEL_W  = 148;
const CONTENT_TOP = HUD_H + RULER_H;
const DOT_R    = 7;

// Row definitions with proportional weights
const ROW_DEFS = [
  { key:'physical',      label:'Physical & Natural', bg:'#e8f5e9', fg:'#1b5e20', dot:'#4caf50', weight:1.0 },
  { key:'evolution',     label:'Evolution',          bg:'#fffde7', fg:'#5d4037', dot:'#ff9800', weight:1.0 },
  { key:'science',       label:'Science & Tech',     bg:'#e3f2fd', fg:'#0d47a1', dot:'#2196f3', weight:1.0 },
  { key:'india',         label:'India',              bg:'#1a3a6b', fg:'#ffffff', dot:'#FF9933', weight:1.4 },
  { key:'world_asia',    label:'World / Asia',       bg:'#0d2b5e', fg:'#90caf9', dot:'#90caf9', weight:1.4 },
  { key:'world_europe',  label:'World / Europe',     bg:'#0d2b5e', fg:'#80cbc4', dot:'#80cbc4', weight:0.9 },
  { key:'world_america', label:'World / America',    bg:'#0d2b5e', fg:'#ce93d8', dot:'#ce93d8', weight:0.9 },
];
const TOTAL_WEIGHT = ROW_DEFS.reduce((s,r) => s+r.weight, 0);

function getLayout() {
  const availH = canvas.height - CONTENT_TOP;
  const unitH  = availH / TOTAL_WEIGHT;
  let y = CONTENT_TOP;
  return ROW_DEFS.map(def => {
    const h = Math.floor(def.weight * unitH);
    const row = { ...def, y, height:h, centreY: y + h/2 };
    y += h;
    return row;
  });
}

// ── Time formatting ───────────────────────────────────────────────────────────
function fmtTime(t) {
  if (t === 0) return 'Year 0 CE';
  const abs = Math.abs(t);
  const dir = t < 0 ? ' Ago' : ' From Now';
  if (abs >= 1e9)  return (abs/1e9).toPrecision(3) + ' Billion Yrs' + dir;
  if (abs >= 1e6)  return (abs/1e6).toPrecision(3) + ' Million Yrs' + dir;
  if (abs >= 1000) return t < 0 ? Math.round(abs)+' BCE' : Math.round(abs)+' CE';
  if (abs >= 1)    return t < 0 ? Math.round(abs)+' BCE' : Math.round(abs)+' CE';
  return t.toExponential(2) + ' Yrs';
}

function fmtBigBang(t) {
  const since = 13.8e9 + t;
  if (since <= 0) return 'At Big Bang';
  if (since >= 1e9) return (since/1e9).toPrecision(3) + 'B yrs after BB';
  if (since >= 1e6) return (since/1e6).toPrecision(3) + 'M yrs after BB';
  return Math.round(since) + ' yrs after BB';
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


// ── Time ruler tick logic ─────────────────────────────────────────────────────
function getTickConfig() {
  // pixels per 1 year at current zoom
  const pxPerYr = (tx(1) - tx(0)) * zoomScale;

  if (pxPerYr > 80)  return { major:1,       minor:0,      fmt: t => fmtTime(t) };
  if (pxPerYr > 20)  return { major:5,        minor:1,      fmt: t => fmtTime(t) };
  if (pxPerYr > 5)   return { major:10,       minor:2,      fmt: t => fmtTime(t) };
  if (pxPerYr > 1)   return { major:50,       minor:10,     fmt: t => fmtTime(t) };
  if (pxPerYr > 0.2) return { major:200,      minor:50,     fmt: t => fmtTime(t) };
  if (pxPerYr > 0.05)return { major:1000,     minor:200,    fmt: t => fmtTime(t) };
  if (pxPerYr > 0.01)return { major:5000,     minor:1000,   fmt: t => fmtTime(t) };
  if (pxPerYr > 0.001)return{ major:50000,    minor:10000,  fmt: t => fmtTime(t) };
  // Very zoomed out — use milestone times
  return { milestones: true, fmt: fmtTime };
}

const MILESTONES = [
  -13.8e9,-10e9,-5e9,-1e9,-500e6,-100e6,-50e6,-10e6,-1e6,
  -500e3,-100e3,-50e3,-10000,-5000,-1000,-500,-100,0,
  500,1000,1500,1760,1900,2000,2026,5e9,1e14,1e100
];

function drawRuler(centreT) {
  const W = canvas.width;
  const y = HUD_H;
  const h = RULER_H;

  // Background
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  ctx.fillRect(LABEL_W, y, W-LABEL_W, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(LABEL_W,y+h); ctx.lineTo(W,y+h); ctx.stroke();

  const cfg = getTickConfig();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '10px system-ui,sans-serif';
  ctx.textBaseline = 'middle';

  if (cfg.milestones) {
    // Draw milestone ticks
    for (const t of MILESTONES) {
      const x = sx(t);
      if (x < LABEL_W || x > W) continue;
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, y+h-10); ctx.lineTo(x, y+h); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.textAlign = 'center';
      const lbl = cfg.fmt(t);
      if (lbl.length < 20) ctx.fillText(lbl, x, y+h/2-2);
    }
    ctx.textAlign = 'left';
    return;
  }

  // Regular ticks
  const { major, minor, fmt } = cfg;
  const tLeft  = timeAt(LABEL_W);
  const tRight = timeAt(W);

  // Snap to grid
  const startMajor = Math.floor(tLeft / major) * major;
  const endMajor   = Math.ceil(tRight / major) * major;

  // Minor ticks
  if (minor > 0) {
    const startMinor = Math.floor(tLeft / minor) * minor;
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    for (let t = startMinor; t <= endMajor; t += minor) {
      const x = sx(t);
      if (x < LABEL_W || x > W) continue;
      ctx.beginPath(); ctx.moveTo(x, y+h-5); ctx.lineTo(x, y+h); ctx.stroke();
    }
  }

  // Major ticks + labels
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 1;
  let lastLabelX = -999;
  for (let t = startMajor; t <= endMajor; t += major) {
    const x = sx(t);
    if (x < LABEL_W || x > W) continue;
    ctx.beginPath(); ctx.moveTo(x, y+4); ctx.lineTo(x, y+h); ctx.stroke();
    const lbl = fmt(t);
    const lw = ctx.measureText(lbl).width;
    if (x - lastLabelX > lw + 8) {
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.textAlign = 'center';
      ctx.fillText(lbl, x, y + h/2);
      lastLabelX = x;
    }
  }
  ctx.textAlign = 'left';
}


// ── Main draw ─────────────────────────────────────────────────────────────────
function draw() {
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const layout   = getLayout();
  const centreT  = timeAt(W/2);
  const showLbls = zoomScale >= 1.0;

  // ── Row backgrounds ──────────────────────────────────────────────────────
  for (const row of layout) {
    ctx.fillStyle = row.bg;
    ctx.fillRect(LABEL_W, row.y, W-LABEL_W, row.height);
    // Subtle centre line
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(LABEL_W, row.centreY); ctx.lineTo(W, row.centreY); ctx.stroke();
  }

  // ── Label column ─────────────────────────────────────────────────────────
  for (const row of layout) {
    ctx.fillStyle = row.bg;
    ctx.fillRect(0, row.y, LABEL_W, row.height);
    ctx.fillStyle = row.fg;
    const fs = Math.min(12, Math.max(9, row.height * 0.22));
    ctx.font = `bold ${fs}px system-ui,sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.fillText(row.label, 6, row.centreY);
  }

  // Label column border
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(LABEL_W, CONTENT_TOP); ctx.lineTo(LABEL_W, H); ctx.stroke();

  // Row dividers
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 1;
  for (const row of layout) {
    ctx.beginPath(); ctx.moveTo(0, row.y+row.height); ctx.lineTo(W, row.y+row.height); ctx.stroke();
  }

  // ── "You are here" centre line ───────────────────────────────────────────
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4,4]);
  ctx.beginPath(); ctx.moveTo(W/2, CONTENT_TOP); ctx.lineTo(W/2, H); ctx.stroke();
  ctx.setLineDash([]);

  // ── Reference longitude lines ────────────────────────────────────────────
  const refs = [-13.8e9,-4.6e9,-3.8e9,-252e6,-66e6,-2.8e6,-10000,0,1500,1760,1947,2026];
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (const t of refs) {
    const x = sx(t);
    if (x < LABEL_W || x > W) continue;
    ctx.beginPath(); ctx.moveTo(x, CONTENT_TOP); ctx.lineTo(x, H); ctx.stroke();
  }

  // ── Events ───────────────────────────────────────────────────────────────
  // Collect visible events per row for staggered labels
  const visibleByRow = {};
  for (const row of layout) visibleByRow[row.key] = [];

  for (const ev of events) {
    const x = sx(ev.time);
    if (x < LABEL_W - DOT_R || x > W + DOT_R) continue;
    const row = layout.find(r => r.key === ev.row);
    if (!row) continue;
    visibleByRow[row.key].push({ ev, x, row });
  }

  // Draw connectors first (below dots)
  for (const row of layout) {
    for (const { ev, x } of visibleByRow[row.key]) {
      const isSel = selEvent && selEvent.time===ev.time && selEvent.title===ev.title;
      ctx.save();
      if (indiaFilter && !ev.india) ctx.globalAlpha = 0.1;
      ctx.strokeStyle = row.dot + '40';
      ctx.lineWidth = 1;
      ctx.setLineDash([2,3]);
      ctx.beginPath();
      ctx.moveTo(x, row.centreY - DOT_R - 2);
      ctx.lineTo(x, row.y + row.height - 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  // Draw dots
  for (const row of layout) {
    for (const { ev, x } of visibleByRow[row.key]) {
      const isSel = selEvent && selEvent.time===ev.time && selEvent.title===ev.title;
      const isHov = hoverEvent && hoverEvent.time===ev.time && hoverEvent.title===ev.title;
      ctx.save();
      if (indiaFilter && !ev.india) ctx.globalAlpha = 0.1;
      const r = isSel ? DOT_R+3 : isHov ? DOT_R+2 : DOT_R;
      ctx.beginPath();
      ctx.arc(x, row.centreY, r, 0, Math.PI*2);
      ctx.fillStyle = isSel ? '#ffffff' : row.dot;
      ctx.fill();
      if (isSel || isHov) {
        ctx.strokeStyle = row.dot;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // Draw staggered labels
  if (showLbls) {
    ctx.font = '9px system-ui,sans-serif';
    for (const row of layout) {
      const items = visibleByRow[row.key];
      // Sort by x to assign stagger
      const sorted = [...items].sort((a,b) => a.x - b.x);
      let lastX = -999, lastY = -999;
      for (let i = 0; i < sorted.length; i++) {
        const { ev, x } = sorted[i];
        if (x < LABEL_W + 4) continue;
        // Skip if too close to previous label
        if (x - lastX < 14) continue;

        const lbl = ev.title.length > 22 ? ev.title.substring(0,20)+'…' : ev.title;
        const lw  = ctx.measureText(lbl).width + 6;

        // Stagger: alternate above/below centre
        const above = (i % 2 === 0);
        const ly = above ? row.centreY - DOT_R - 14 : row.centreY + DOT_R + 14;

        // Label background pill
        ctx.save();
        if (indiaFilter && !ev.india) ctx.globalAlpha = 0.1;
        ctx.fillStyle = 'rgba(5,7,15,0.65)';
        ctx.beginPath();
        ctx.roundRect(x - lw/2, ly - 7, lw, 14, 3);
        ctx.fill();

        // Label text
        const isLight = row.fg === '#ffffff' || row.fg === '#90caf9' || row.fg === '#80cbc4' || row.fg === '#ce93d8';
        ctx.fillStyle = isLight ? 'rgba(255,255,255,0.85)' : row.fg;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.fillText(lbl, x, ly);
        ctx.textAlign = 'left';
        ctx.restore();

        lastX = x + lw/2;
        lastY = ly;
      }
    }
  }

  // ── Time ruler ───────────────────────────────────────────────────────────
  drawRuler(centreT);

  // ── HUD ──────────────────────────────────────────────────────────────────
  drawHUD(centreT, W);
}


// ── HUD ───────────────────────────────────────────────────────────────────────
function drawHUD(centreT, W) {
  // Background
  ctx.fillStyle = 'rgba(5,7,15,0.94)';
  ctx.fillRect(0, 0, W, HUD_H);
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0,HUD_H); ctx.lineTo(W,HUD_H); ctx.stroke();

  ctx.textBaseline = 'middle';

  // ── Left: nav arrows + time label ────────────────────────────────────────
  // Left arrow button
  drawBtn(8, 8, 28, HUD_H-16, '◄', '#1e2a3a', '#64b5f6');

  // Time label
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px system-ui,sans-serif';
  ctx.fillText(fmtTime(centreT), 44, HUD_H/2 - 6);

  // Age badge
  const age = getAge(centreT);
  const ageW = ctx.measureText(age).width + 14;
  ctx.fillStyle = 'rgba(100,181,246,0.18)';
  ctx.beginPath(); ctx.roundRect(44, HUD_H/2 + 2, ageW, 16, 8); ctx.fill();
  ctx.fillStyle = '#90caf9';
  ctx.font = '10px system-ui,sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(age, 44 + ageW/2, HUD_H/2 + 10);
  ctx.textAlign = 'left';

  // From Big Bang (small, below time)
  ctx.fillStyle = 'rgba(255,200,50,0.6)';
  ctx.font = '9px system-ui,sans-serif';
  ctx.fillText(fmtBigBang(centreT), 44 + ageW + 8, HUD_H/2 + 10);

  // Right arrow button
  drawBtn(44 + ageW + 8 + ctx.measureText(fmtBigBang(centreT)).width + 8, 8, 28, HUD_H-16, '►', '#1e2a3a', '#64b5f6');

  // ── Right: zoom + buttons ─────────────────────────────────────────────────
  const btnRight = W - 8;

  // ? help button (click handled in click listener)
  drawBtn(btnRight-30, 8, 28, HUD_H-16, '?', '#1e2a3a', '#888');

  // India toggle
  const indiaLabel = indiaFilter ? '🇮🇳 ON' : '🇮🇳 India';
  const indiaBg = indiaFilter ? '#3a2000' : '#1e2a3a';
  const indiaFg = indiaFilter ? '#FF9933' : '#aaa';
  drawBtn(btnRight-120, 8, 82, HUD_H-16, indiaLabel, indiaBg, indiaFg);

  // Reset button
  drawBtn(btnRight-200, 8, 72, HUD_H-16, '⌂ Reset', '#1e2a3a', '#64b5f6');

  // Zoom indicator
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = '10px system-ui,sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('zoom ' + zoomScale.toFixed(1) + 'x', btnRight-208, HUD_H/2);
  ctx.textAlign = 'left';

  // ── Label column header ───────────────────────────────────────────────────
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = 'bold 9px system-ui,sans-serif';
  ctx.fillText('CATEGORY', 4, HUD_H/2);
}

function drawBtn(x, y, w, h, lbl, bg, fg) {
  ctx.fillStyle = bg;
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
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
const panel  = document.getElementById('panel');
const pTitle = document.getElementById('panel-title');
const pBody  = document.getElementById('panel-body');
const pClose = document.getElementById('panel-close');
const pLink  = document.getElementById('panel-link');
const pTime  = document.getElementById('panel-time');

pClose.addEventListener('click', () => {
  panel.style.display = 'none';
  selEvent = null;
  draw();
});

function showPanel(ev, anchorX) {
  selEvent = ev;
  pTitle.textContent = ev.title;
  pTime.textContent  = fmtTime(ev.time) + (ev.age ? ' · ' + ev.age : '');
  pBody.innerHTML    = '<em style="color:#555">Loading…</em>';

  const W = canvas.width, H = canvas.height;
  const pw = Math.min(360, W - 20);
  let left = anchorX + 16;
  if (left + pw > W - 8) left = anchorX - pw - 16;
  if (left < 8) left = 8;
  panel.style.width   = pw + 'px';
  panel.style.left    = left + 'px';
  panel.style.top     = '60px';
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
  if (!h) h = '<p style="color:#555">No description available.</p>';
  return h;
}


// ── Input handling ────────────────────────────────────────────────────────────

// SCROLL = PAN (not zoom). Ctrl+scroll = zoom.
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  if (e.ctrlKey || e.metaKey) {
    // Zoom at cursor
    const f = e.deltaY < 0 ? 1.12 : 1/1.12;
    const ox = e.clientX;
    const lp = (ox - canvas.width/2 - panX) / zoomScale;
    zoomScale = Math.max(0.3, Math.min(2000, zoomScale * f));
    panX = ox - canvas.width/2 - lp * zoomScale;
  } else {
    // Pan horizontally — use deltaX for trackpad, deltaY for mouse wheel
    const delta = e.deltaX !== 0 ? -e.deltaX : -e.deltaY;
    panX += delta;
  }
  clamp();
  draw();
}, { passive: false });

// Drag to pan
canvas.addEventListener('mousedown', e => {
  if (e.button === 0) { isDragging = true; lastMouseX = e.clientX; canvas.style.cursor = 'grabbing'; }
});
canvas.addEventListener('mousemove', e => {
  if (isDragging) {
    panX += e.clientX - lastMouseX;
    lastMouseX = e.clientX;
    clamp();
    draw();
    return;
  }
  // Hover detection
  const layout = getLayout();
  let found = null;
  for (const ev of events) {
    const x = sx(ev.time);
    if (x < LABEL_W - DOT_R || x > canvas.width + DOT_R) continue;
    const row = layout.find(r => r.key === ev.row);
    if (!row) continue;
    const dist = Math.hypot(e.clientX - x, e.clientY - row.centreY);
    if (dist <= DOT_R + 4) { found = ev; break; }
  }
  if (found !== hoverEvent) {
    hoverEvent = found;
    canvas.style.cursor = found ? 'pointer' : 'grab';
    if (found) {
      tooltip.style.display = 'block';
      tooltip.style.left = (e.clientX + 12) + 'px';
      tooltip.style.top  = (e.clientY - 30) + 'px';
      tooltip.innerHTML  = `<strong>${found.title}</strong><br><span style="color:#90caf9">${fmtTime(found.time)}</span>`;
    } else {
      tooltip.style.display = 'none';
    }
    draw();
  } else if (found) {
    tooltip.style.left = (e.clientX + 12) + 'px';
    tooltip.style.top  = (e.clientY - 30) + 'px';
  }
});
canvas.addEventListener('mouseup',    () => { isDragging = false; canvas.style.cursor = 'grab'; });
canvas.addEventListener('mouseleave', () => { isDragging = false; tooltip.style.display = 'none'; hoverEvent = null; });

// Double-click to zoom in
canvas.addEventListener('dblclick', e => {
  if (e.clientY < HUD_H) return;
  const f = 2;
  const ox = e.clientX;
  const lp = (ox - canvas.width/2 - panX) / zoomScale;
  zoomScale = Math.min(2000, zoomScale * f);
  panX = ox - canvas.width/2 - lp * zoomScale;
  clamp();
  draw();
});

// Click handler
canvas.addEventListener('click', e => {
  const W = canvas.width;

  // HUD buttons
  if (e.clientY < HUD_H) {
    // Left arrow
    if (e.clientX >= 8 && e.clientX <= 36) { panX += 200; clamp(); draw(); return; }
    // Reset
    if (e.clientX >= W-200 && e.clientX <= W-128) { resetView(); return; }
    // India toggle
    if (e.clientX >= W-120 && e.clientX <= W-38) { indiaFilter = !indiaFilter; draw(); return; }
    // Help
    if (e.clientX >= W-36 && e.clientX <= W-8) { if (window.showHelp) window.showHelp(); return; }
    return;
  }

  // Close panel on click outside
  if (panel.style.display === 'block') {
    const pr = panel.getBoundingClientRect();
    if (e.clientX < pr.left || e.clientX > pr.right || e.clientY < pr.top || e.clientY > pr.bottom) {
      panel.style.display = 'none'; selEvent = null; draw(); return;
    }
    return;
  }

  // Hit test events
  const layout = getLayout();
  let best = null, bd = DOT_R + 8;
  for (const ev of events) {
    const x = sx(ev.time);
    if (x < LABEL_W) continue;
    const row = layout.find(r => r.key === ev.row);
    if (!row) continue;
    const d = Math.hypot(e.clientX - x, e.clientY - row.centreY);
    if (d < bd) { bd = d; best = ev; }
  }
  if (best) showPanel(best, sx(best.time));
});

// Touch
let ltx = 0, lpd = 0, pinch = false;
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  if (e.touches.length === 2) {
    pinch = true;
    lpd = Math.hypot(e.touches[0].clientX-e.touches[1].clientX, e.touches[0].clientY-e.touches[1].clientY);
  } else {
    ltx = e.touches[0].clientX;
  }
}, { passive: false });
canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  if (pinch && e.touches.length === 2) {
    const d = Math.hypot(e.touches[0].clientX-e.touches[1].clientX, e.touches[0].clientY-e.touches[1].clientY);
    const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    const lp = (mx - canvas.width/2 - panX) / zoomScale;
    zoomScale = Math.max(0.3, Math.min(2000, zoomScale * d/lpd));
    panX = mx - canvas.width/2 - lp * zoomScale;
    lpd = d; clamp(); draw();
  } else if (e.touches.length === 1) {
    panX += e.touches[0].clientX - ltx;
    ltx = e.touches[0].clientX;
    clamp(); draw();
  }
}, { passive: false });
canvas.addEventListener('touchend', e => { if (e.touches.length < 2) pinch = false; });

// Keyboard
window.addEventListener('keydown', e => {
  const step = 120;
  if (e.key === 'ArrowLeft')       { panX += step; clamp(); draw(); }
  else if (e.key === 'ArrowRight') { panX -= step; clamp(); draw(); }
  else if (e.key === '+' || e.key === '=') {
    zoomScale = Math.min(2000, zoomScale * 1.25);
    clamp(); draw();
  }
  else if (e.key === '-') {
    zoomScale = Math.max(0.3, zoomScale / 1.25);
    clamp(); draw();
  }
  else if (e.key === 'Home')   { resetView(); }
  else if (e.key === 'Escape') { panel.style.display='none'; selEvent=null; draw(); }
});

// ── Clamp & reset ─────────────────────────────────────────────────────────────
function clamp() {
  const W = canvas.width;
  const lp = tx(-13.8e9), rp = tx(1e100);
  const mn = -(W/2) - lp*zoomScale;
  const mx =  (W/2) - rp*zoomScale;
  panX = mn < mx ? Math.max(mn, Math.min(mx, panX)) : mn;
}

function resetView() {
  zoomScale = 1.5;
  panX = -tx(1800) * zoomScale;
  clamp();
  draw();
}

// ── Data loading ──────────────────────────────────────────────────────────────
const BASE = (function() {
  const p = window.location.pathname;
  const dir = p.endsWith('/') ? p.slice(0,-1) : p.replace(/\/[^/]*$/, '');
  return dir || '';
})();

fetch(BASE + '/data.json')
  .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
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

// Draw immediately
resetView();

