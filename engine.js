/**
 * Chrono of Life — engine.js
 * Self-contained canvas timeline. No build step required.
 * Piecewise linear axis allocates screen space by event density.
 */

// ── Canvas setup ──────────────────────────────────────────────────────────────
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  draw();
}
window.addEventListener('resize', resize);
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// ── State ─────────────────────────────────────────────────────────────────────
let events = [];
let panX = 0;
let zoomScale = 1;
let selectedEvent = null;
let isDragging = false;
let lastMouseX = 0;
let indiaFilter = false;

// ── Piecewise axis ────────────────────────────────────────────────────────────
// Allocates pixels proportional to event density across 12 zones.
// Origin (px=0) = t=0 (year 0 CE).

const SEGMENTS = [
  [-13.8e9, -1e9,    200],  // Cosmic/Galactic
  [-1e9,    -100e6,  150],  // Geological deep time
  [-100e6,  -10e6,   150],  // Mesozoic/Cenozoic
  [-10e6,   -100e3,  200],  // Hominin evolution
  [-100e3,  -3000,   150],  // Paleolithic/Neolithic
  [-3000,   0,       200],  // Classical/Medieval BCE
  [0,       1500,    80],   // 0–1500 CE (sparse)
  [1500,    2030,    300],  // Modern era (very dense)
  [2030,    1e4,     80],   // Near future
  [1e4,     1e6,     80],   // Far future
  [1e6,     1e9,     100],  // Deep future
  [1e9,     1e100,   300],  // Deep time
];

// Build zone table with px origin at t=0
const ZONES = (function() {
  let cum = 0;
  const raw = SEGMENTS.map(([ts, te, w]) => {
    const z = { tStart: ts, tEnd: te, pxStart: cum, pxEnd: cum + w };
    cum += w;
    return z;
  });
  // Find px at t=0
  let pxZero = 0;
  for (const z of raw) {
    if (0 >= z.tStart && 0 <= z.tEnd) {
      pxZero = z.pxStart + (0 - z.tStart) / (z.tEnd - z.tStart) * (z.pxEnd - z.pxStart);
      break;
    }
  }
  return raw.map(z => ({ ...z, pxStart: z.pxStart - pxZero, pxEnd: z.pxEnd - pxZero }));
})();

function tx(t) {
  if (t <= ZONES[0].tStart) return ZONES[0].pxStart;
  if (t >= ZONES[ZONES.length-1].tEnd) return ZONES[ZONES.length-1].pxEnd;
  for (let i = 0; i < ZONES.length; i++) {
    const z = ZONES[i];
    const inZone = i < ZONES.length-1 ? (t >= z.tStart && t < z.tEnd) : (t >= z.tStart && t <= z.tEnd);
    if (inZone) {
      const frac = (t - z.tStart) / (z.tEnd - z.tStart);
      return z.pxStart + frac * (z.pxEnd - z.pxStart);
    }
  }
  return 0;
}

function txInverse(px) {
  if (px <= ZONES[0].pxStart) return ZONES[0].tStart;
  if (px >= ZONES[ZONES.length-1].pxEnd) return ZONES[ZONES.length-1].tEnd;
  for (let i = 0; i < ZONES.length; i++) {
    const z = ZONES[i];
    const inZone = i < ZONES.length-1 ? (px >= z.pxStart && px < z.pxEnd) : (px >= z.pxStart && px <= z.pxEnd);
    if (inZone) {
      const frac = (px - z.pxStart) / (z.pxEnd - z.pxStart);
      return z.tStart + frac * (z.tEnd - z.tStart);
    }
  }
  return 0;
}

function screenX(t) {
  return canvas.width / 2 + panX + tx(t) * zoomScale;
}

function screenToTime(sx) {
  return txInverse((sx - canvas.width / 2 - panX) / zoomScale);
}

// ── Row layout ────────────────────────────────────────────────────────────────
const ROW_DEFS = [
  { key: 'header_era',      label: 'From Current Era', bg: '#c8e6c9', fg: '#1b5e20', isHeader: true },
  { key: 'header_bb',       label: 'From Big Bang',    bg: '#fff9c4', fg: '#f57f17', isHeader: true },
  { key: 'unit',            label: 'Unit',             bg: '#f5f5f5', fg: '#424242', isHeader: true },
  { key: 'scale_row',       label: 'Scale',            bg: '#eeeeee', fg: '#424242', isHeader: true },
  { key: 'physical',        label: 'Physical & Natural', bg: '#e8f5e9', fg: '#1b5e20', isContent: true },
  { key: 'evolution',       label: 'Evolution',        bg: '#fffde7', fg: '#5d4037', isContent: true },
  { key: 'science',         label: 'Science & Tech',   bg: '#e3f2fd', fg: '#0d47a1', isContent: true },
  { key: 'india',           label: 'India',            bg: '#1a3a6b', fg: '#ffffff', isContent: true },
  { key: 'world_asia',      label: 'World / Asia',     bg: '#0d2b5e', fg: '#ffffff', isContent: true },
  { key: 'world_europe',    label: 'World / Europe',   bg: '#0d2b5e', fg: '#ffffff', isContent: true },
  { key: 'world_america',   label: 'World / America',  bg: '#0d2b5e', fg: '#ffffff', isContent: true },
  { key: 'age',             label: 'Age',              bg: '#f1f8e9', fg: '#33691e', isHeader: true },
];

const LABEL_W = 140;
const MARKER_R = 5;

const ROW_COLOURS = {
  physical:      '#4caf50',
  evolution:     '#ff9800',
  science:       '#2196f3',
  india:         '#FF9933',
  world_asia:    '#90caf9',
  world_europe:  '#80cbc4',
  world_america: '#ce93d8',
};

function getRowLayout() {
  const h = canvas.height;
  const rowH = Math.floor(h / ROW_DEFS.length);
  return ROW_DEFS.map((def, i) => ({
    ...def,
    y: i * rowH,
    height: rowH,
    centreY: i * rowH + rowH / 2,
  }));
}

function getContentRow(rowLayout, rowKey) {
  return rowLayout.find(r => r.key === rowKey);
}

// ── Time formatting ───────────────────────────────────────────────────────────
function formatTime(t) {
  if (t === 0) return 'Present Day';
  const abs = Math.abs(t);
  const suffix = t < 0 ? ' Ago' : ' From Now';
  if (abs >= 1e9) return (abs/1e9).toPrecision(3) + ' Billion Years' + suffix;
  if (abs >= 1e6) return (abs/1e6).toPrecision(3) + ' Million Years' + suffix;
  if (abs >= 1000) {
    if (t < 0) return Math.round(abs) + ' BCE';
    return Math.round(abs) + ' CE';
  }
  if (abs >= 1) {
    if (t < 0) return Math.round(abs) + ' BCE';
    return Math.round(abs) + ' CE';
  }
  return t.toExponential(2) + ' Years' + suffix;
}

// ── Age lookup ────────────────────────────────────────────────────────────────
const AGE_TABLE = [
  [-Infinity, -13.77e9, 'Planck Epoch'],
  [-13.77e9, -13.4e9, 'Dark Ages'],
  [-13.4e9, -11e9, 'Cosmic Dawn'],
  [-11e9, -5e9, 'Galactic Age'],
  [-5e9, -4.6e9, 'Pre-Solar'],
  [-4.6e9, -4e9, 'Hadean'],
  [-4e9, -2.5e9, 'Archean'],
  [-2.5e9, -541e6, 'Proterozoic'],
  [-541e6, -485e6, 'Cambrian'],
  [-485e6, -252e6, 'Paleozoic'],
  [-252e6, -66e6, 'Mesozoic'],
  [-66e6, -2.6e6, 'Cenozoic'],
  [-2.6e6, -11700, 'Pleistocene'],
  [-11700, -3300, 'Neolithic'],
  [-3300, -1200, 'Bronze Age'],
  [-1200, -550, 'Iron Age'],
  [-550, 476, 'Classical'],
  [476, 1453, 'Medieval'],
  [1453, 1760, 'Early Modern'],
  [1760, 1900, 'Industrial'],
  [1900, 1945, '20th Century'],
  [1945, 1991, 'Cold War'],
  [1991, 2026, 'Information Age'],
  [2026, Infinity, 'Future'],
];

function getAge(t) {
  for (const [from, to, label] of AGE_TABLE) {
    if (t >= from && t < to) return label;
  }
  return '—';
}

// ── Draw ──────────────────────────────────────────────────────────────────────
function draw() {
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const rowLayout = getRowLayout();
  const centreT = screenToTime(W / 2);

  // ── Row backgrounds ────────────────────────────────────────────────────────
  for (const row of rowLayout) {
    ctx.fillStyle = row.bg;
    ctx.fillRect(LABEL_W, row.y, W - LABEL_W, row.height);
  }

  // ── Label column ───────────────────────────────────────────────────────────
  for (const row of rowLayout) {
    ctx.fillStyle = row.bg;
    ctx.fillRect(0, row.y, LABEL_W, row.height);

    ctx.fillStyle = row.fg;
    ctx.font = `bold ${Math.min(10, row.height * 0.35)}px system-ui,sans-serif`;
    ctx.textBaseline = 'middle';

    let labelText = row.label;
    // Dynamic header values
    if (row.key === 'header_era') {
      labelText = 'From Current Era';
      ctx.fillText(labelText, 4, row.y + row.height * 0.35);
      ctx.font = `${Math.min(9, row.height * 0.3)}px system-ui,sans-serif`;
      ctx.fillText(formatTime(centreT), 4, row.y + row.height * 0.72);
    } else if (row.key === 'header_bb') {
      labelText = 'From Big Bang';
      ctx.fillText(labelText, 4, row.y + row.height * 0.35);
      ctx.font = `${Math.min(9, row.height * 0.3)}px system-ui,sans-serif`;
      ctx.fillText(formatTime(centreT + 13.8e9), 4, row.y + row.height * 0.72);
    } else if (row.key === 'unit') {
      ctx.fillText('Unit', 4, row.y + row.height * 0.35);
      ctx.font = `${Math.min(9, row.height * 0.3)}px system-ui,sans-serif`;
      const abs = Math.abs(centreT);
      const unit = abs >= 1e9 ? 'Billions of Years' : abs >= 1e6 ? 'Millions of Years' : abs >= 1000 ? 'Thousands of Years' : 'Years';
      ctx.fillText(unit, 4, row.y + row.height * 0.72);
    } else if (row.key === 'scale_row') {
      ctx.fillText('Scale', 4, row.y + row.height * 0.35);
      ctx.font = `${Math.min(9, row.height * 0.3)}px system-ui,sans-serif`;
      const abs = Math.abs(centreT);
      const scale = abs >= 1e9 ? 'Cosmic' : abs >= 1e6 ? 'Geological' : abs >= 1000 ? 'Historical' : 'Modern';
      ctx.fillText(scale, 4, row.y + row.height * 0.72);
    } else if (row.key === 'age') {
      ctx.fillText('Age', 4, row.y + row.height * 0.35);
      ctx.font = `${Math.min(9, row.height * 0.3)}px system-ui,sans-serif`;
      ctx.fillText(getAge(centreT), 4, row.y + row.height * 0.72);
    } else {
      ctx.fillText(labelText, 4, row.centreY);
    }
  }

  // ── Label column border ────────────────────────────────────────────────────
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(LABEL_W, 0);
  ctx.lineTo(LABEL_W, H);
  ctx.stroke();

  // ── Row dividers ───────────────────────────────────────────────────────────
  ctx.strokeStyle = 'rgba(0,0,0,0.1)';
  ctx.lineWidth = 1;
  for (const row of rowLayout) {
    ctx.beginPath();
    ctx.moveTo(0, row.y + row.height);
    ctx.lineTo(W, row.y + row.height);
    ctx.stroke();
  }

  // ── Longitude reference lines ──────────────────────────────────────────────
  const refTimes = [-13.8e9, -4.6e9, -3.8e9, -65e6, -2.8e6, -10000, 0, 1500, 2026, 5e9, 1e14];
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  for (const t of refTimes) {
    const sx = screenX(t);
    if (sx < LABEL_W || sx > W) continue;
    ctx.beginPath();
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, H);
    ctx.stroke();
  }

  // ── Event markers ──────────────────────────────────────────────────────────
  const showLabels = zoomScale > 0.8;
  ctx.font = '9px system-ui,sans-serif';

  for (const ev of events) {
    const sx = screenX(ev.time);
    if (sx < LABEL_W - 10 || sx > W + 10) continue;

    const row = getContentRow(rowLayout, ev.row);
    if (!row) continue;

    const cy = row.centreY;
    const colour = ROW_COLOURS[ev.row] || '#ffffff';
    const isSelected = selectedEvent && selectedEvent.time === ev.time && selectedEvent.title === ev.title;
    const isDimmed = indiaFilter && !ev.india;

    ctx.save();
    if (isDimmed) ctx.globalAlpha = 0.15;

    // Connector line
    ctx.strokeStyle = colour + '55';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(sx, cy - MARKER_R - 2);
    ctx.lineTo(sx, row.y + row.height);
    ctx.stroke();
    ctx.setLineDash([]);

    // Marker dot
    ctx.beginPath();
    ctx.arc(sx, cy, isSelected ? MARKER_R + 2 : MARKER_R, 0, Math.PI * 2);
    ctx.fillStyle = isSelected ? '#ffffff' : colour;
    ctx.fill();
    if (isSelected) {
      ctx.strokeStyle = colour;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Label
    if (showLabels && sx > LABEL_W + 4) {
      ctx.fillStyle = row.fg === '#ffffff' ? '#e8eaf6' : row.fg;
      ctx.textBaseline = 'bottom';
      ctx.fillText(ev.title.substring(0, 22), sx + 7, cy - 2);
    }

    ctx.restore();
  }

  // ── HUD ────────────────────────────────────────────────────────────────────
  drawHUD(centreT);
}

function drawHUD(centreT) {
  const W = canvas.width;
  // Top bar background
  ctx.fillStyle = 'rgba(5,7,15,0.88)';
  ctx.fillRect(0, 0, W, 36);

  // Time label
  ctx.fillStyle = '#e8eaf6';
  ctx.font = 'bold 13px system-ui,sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(formatTime(centreT), LABEL_W + 8, 18);

  // Zoom level
  ctx.fillStyle = '#90caf9';
  ctx.font = '11px system-ui,sans-serif';
  ctx.fillText('zoom: ' + zoomScale.toFixed(2) + 'x', W - 200, 18);

  // Buttons
  drawButton(W - 150, 6, 60, 24, '⌂ Reset', '#334');
  drawButton(W - 80, 6, 70, 24, indiaFilter ? '🇮🇳 ON' : '🇮🇳 India', indiaFilter ? '#553300' : '#334');
}

function drawButton(x, y, w, h, label, bg) {
  ctx.fillStyle = bg;
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#e8eaf6';
  ctx.font = '11px system-ui,sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w/2, y + h/2);
  ctx.textAlign = 'left';
}

// ── Detail panel ──────────────────────────────────────────────────────────────
const panel = document.getElementById('panel');
const panelTitle = document.getElementById('panel-title');
const panelBody = document.getElementById('panel-body');
const panelClose = document.getElementById('panel-close');
const panelLink = document.getElementById('panel-link');

panelClose.addEventListener('click', () => {
  panel.style.display = 'none';
  selectedEvent = null;
  draw();
});

function showPanel(ev) {
  selectedEvent = ev;
  panelTitle.textContent = ev.title;
  panelBody.innerHTML = '<em>Loading Wikipedia summary…</em>';
  panel.style.display = 'block';

  if (ev.link) {
    panelLink.href = ev.link;
    panelLink.style.display = 'inline';
    const slug = ev.link.split('/wiki/').pop() || ev.title.replace(/ /g, '_');
    fetch('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(slug))
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) { panelBody.innerHTML = ev.world || ev.india || ''; return; }
        let html = '';
        if (d.thumbnail) html += `<img src="${d.thumbnail.source}" style="max-width:100%;border-radius:6px;margin-bottom:8px">`;
        html += `<p>${d.extract || ''}</p>`;
        if (ev.india) html += `<p style="color:#FF9933"><strong>India:</strong> ${ev.india}</p>`;
        panelBody.innerHTML = html;
      })
      .catch(() => { panelBody.innerHTML = ev.world || ev.india || ''; });
  } else {
    panelLink.style.display = 'none';
    panelBody.innerHTML = (ev.india ? `<p style="color:#FF9933"><strong>India:</strong> ${ev.india}</p>` : '') +
                          (ev.world ? `<p>${ev.world}</p>` : '');
  }
  draw();
}

// ── Input handling ────────────────────────────────────────────────────────────
// Zoom
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.1 : 0.9;
  const originX = e.clientX;
  const logPxAtOrigin = (originX - canvas.width/2 - panX) / zoomScale;
  zoomScale = Math.max(0.3, Math.min(2000, zoomScale * factor));
  panX = originX - canvas.width/2 - logPxAtOrigin * zoomScale;
  clampPan();
  draw();
}, { passive: false });

// Pan
canvas.addEventListener('mousedown', e => {
  if (e.button === 0) { isDragging = true; lastMouseX = e.clientX; }
});
canvas.addEventListener('mousemove', e => {
  if (isDragging) {
    panX += e.clientX - lastMouseX;
    lastMouseX = e.clientX;
    clampPan();
    draw();
  }
});
canvas.addEventListener('mouseup', () => { isDragging = false; });
canvas.addEventListener('mouseleave', () => { isDragging = false; });

// Touch
let lastTouchX = 0, lastPinchDist = 0, isPinching = false;
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  if (e.touches.length === 2) {
    isPinching = true;
    lastPinchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
  } else {
    lastTouchX = e.touches[0].clientX;
  }
}, { passive: false });
canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  if (isPinching && e.touches.length === 2) {
    const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    const factor = dist / lastPinchDist;
    const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    const logPx = (midX - canvas.width/2 - panX) / zoomScale;
    zoomScale = Math.max(0.3, Math.min(2000, zoomScale * factor));
    panX = midX - canvas.width/2 - logPx * zoomScale;
    lastPinchDist = dist;
    clampPan();
    draw();
  } else if (e.touches.length === 1) {
    panX += e.touches[0].clientX - lastTouchX;
    lastTouchX = e.touches[0].clientX;
    clampPan();
    draw();
  }
}, { passive: false });
canvas.addEventListener('touchend', e => { if (e.touches.length < 2) isPinching = false; });

// Click — hit test
canvas.addEventListener('click', e => {
  const W = canvas.width;
  // HUD buttons
  if (e.clientY < 36) {
    if (e.clientX >= W - 150 && e.clientX <= W - 90) { resetView(); return; }
    if (e.clientX >= W - 80 && e.clientX <= W - 10) { indiaFilter = !indiaFilter; draw(); return; }
    return;
  }
  // Close panel on backdrop click
  if (panel.style.display === 'block') { panel.style.display = 'none'; selectedEvent = null; draw(); return; }

  // Hit test events
  const rowLayout = getRowLayout();
  let best = null, bestDist = 16;
  for (const ev of events) {
    const sx = screenX(ev.time);
    if (sx < LABEL_W) continue;
    const row = getContentRow(rowLayout, ev.row);
    if (!row) continue;
    const dist = Math.hypot(e.clientX - sx, e.clientY - row.centreY);
    if (dist < bestDist) { bestDist = dist; best = ev; }
  }
  if (best) showPanel(best);
});

// Keyboard
window.addEventListener('keydown', e => {
  const step = 80;
  if (e.key === 'ArrowLeft') { panX += step; clampPan(); draw(); }
  if (e.key === 'ArrowRight') { panX -= step; clampPan(); draw(); }
  if (e.key === '+' || e.key === '=') { zoomScale = Math.min(2000, zoomScale * 1.2); draw(); }
  if (e.key === '-') { zoomScale = Math.max(0.3, zoomScale / 1.2); draw(); }
  if (e.key === 'Home') { resetView(); }
  if (e.key === 'Escape') { panel.style.display = 'none'; selectedEvent = null; draw(); }
});

function clampPan() {
  const W = canvas.width;
  const leftPx = tx(-13.8e9);
  const rightPx = tx(1e100);
  const minPan = -(W/2) - leftPx * zoomScale;
  const maxPan = W/2 - rightPx * zoomScale;
  if (minPan < maxPan) panX = Math.max(minPan, Math.min(maxPan, panX));
  else panX = minPan;
}

function resetView() {
  // Centre on 1800 CE (modern era) at zoom=1
  panX = -tx(1800);
  zoomScale = 1;
  clampPan();
  draw();
}

// ── Load data ─────────────────────────────────────────────────────────────────
const BASE = window.location.pathname.replace(/\/$/, '').replace(/\/[^/]*$/, '') || '';
const DATA_URL = BASE + '/data.json';

fetch(DATA_URL)
  .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
  .then(d => {
    events = Array.isArray(d) ? d : [];
    console.log('[chrono] Loaded', events.length, 'events');
    resetView();
  })
  .catch(err => {
    console.error('[chrono] Failed to load data.json:', err);
    // Fallback: show a few key events so screen is never blank
    events = [
      { time: -13.8e9, title: 'Big Bang', row: 'physical' },
      { time: -4.6e9,  title: 'Earth forms', row: 'physical' },
      { time: -3.8e9,  title: 'Abiogenesis', row: 'evolution' },
      { time: -66e6,   title: 'K-Pg Extinction', row: 'physical' },
      { time: -2.8e6,  title: 'Genus Homo', row: 'evolution' },
      { time: 0,       title: 'Year 0 CE', row: 'physical' },
      { time: 1526,    title: 'Mughal Empire', row: 'india' },
      { time: 1760,    title: 'Industrial Revolution', row: 'science' },
      { time: 1947,    title: 'India Independence', row: 'india' },
      { time: 2026,    title: 'Present', row: 'physical' },
    ];
    resetView();
  });

// Initial draw (so screen is never blank while data loads)
resetView();
