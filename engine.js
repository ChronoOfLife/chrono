/**
 * Chrono of Life — engine.js  v4
 * Vertical scroll layout: time flows top→bottom, categories as columns.
 * Native browser scroll = no performance issues.
 * 1732 events rendered as DOM chips — only visible ones are in viewport.
 */

// ── Column definitions ────────────────────────────────────────────────────────
const COLS = [
  { key:'physical',      label:'Physical\n& Natural', bg:'#e8f5e9', dot:'#4caf50' },
  { key:'evolution',     label:'Evolution\n& Life',   bg:'#fffde7', dot:'#ff9800' },
  { key:'science',       label:'Science\n& Tech',     bg:'#e3f2fd', dot:'#2196f3' },
  { key:'india',         label:'India',               bg:'#1a3a6b', dot:'#FF9933' },
  { key:'world_asia',    label:'World\nAsia',         bg:'#0d2b5e', dot:'#90caf9' },
  { key:'world_europe',  label:'World\nEurope',       bg:'#0d2b5e', dot:'#80cbc4' },
  { key:'world_america', label:'World\nAmerica',      bg:'#0d2b5e', dot:'#ce93d8' },
];

// ── Time formatting ───────────────────────────────────────────────────────────
function fmtTime(t) {
  if (t === 0) return 'Year 0 CE';
  const abs = Math.abs(t);
  if (abs >= 1e9)  return (abs/1e9).toPrecision(3) + 'B yrs ' + (t<0?'ago':'from now');
  if (abs >= 1e6)  return (abs/1e6).toPrecision(3) + 'M yrs ' + (t<0?'ago':'from now');
  if (abs >= 1000) return t < 0 ? Math.round(abs)+' BCE' : Math.round(abs)+' CE';
  if (abs >= 1)    return t < 0 ? Math.round(abs)+' BCE' : Math.round(abs)+' CE';
  return t.toExponential(2) + ' yrs';
}

function fmtBigBang(t) {
  const since = 13.8e9 + t;
  if (since <= 0) return 'At Big Bang';
  if (since >= 1e9) return (since/1e9).toPrecision(3) + 'B yrs after Big Bang';
  if (since >= 1e6) return (since/1e6).toPrecision(3) + 'M yrs after Big Bang';
  return Math.round(since) + ' yrs after Big Bang';
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

// ── Phase definitions ─────────────────────────────────────────────────────────
const PHASES = [
  { label:'Phase 1 — Cosmic Origins & Deep Time',  from:-13.8e9, to:-10e6  },
  { label:'Phase 2 — Hominins & Paleolithic',       from:-10e6,   to:-3000  },
  { label:'Phase 3 — Classical & Medieval',         from:-3000,   to:1500   },
  { label:'Phase 4 — Modern Era',                   from:1500,    to:2027   },
  { label:'Phase 5 — Future & Deep Time',           from:2027,    to:1e106  },
];

// ── State ─────────────────────────────────────────────────────────────────────
let allEvents    = [];
let zoomLevel    = 1;   // 1=normal, 2=2x density, 0.5=half density
let indiaFilter  = false;
let selEvent     = null;

// ── CSS variable for time column width ────────────────────────────────────────
const TIME_W = 110;
document.documentElement.style.setProperty('--time-w', TIME_W + 'px');

// ── Build column headers ──────────────────────────────────────────────────────
function buildHeader() {
  const hdr = document.getElementById('header');
  COLS.forEach(col => {
    const div = document.createElement('div');
    div.className = 'col-header';
    div.style.background = col.bg + '22';
    div.style.color = col.dot;
    div.textContent = col.label.replace('\n', ' ');
    hdr.appendChild(div);
  });
}

// ── Group events by time bucket ───────────────────────────────────────────────
// Each "era band" represents a time bucket. We group nearby events together.
function groupEvents(events, zoom) {
  if (!events.length) return [];

  // Sort by time
  const sorted = [...events].sort((a,b) => a.time - b.time);

  // Define bucket sizes based on time range
  // Each bucket = one row in the timeline
  // Bucket size adapts to zoom level
  const buckets = [];

  // Use the phase boundaries to create natural groupings
  // Within each phase, group events that are "close" in time
  const phases = [
    { from:-13.8e9, to:-1e9,    bucketSize: 200e6 / zoom },  // 200M yr buckets
    { from:-1e9,    to:-100e6,  bucketSize: 20e6  / zoom },  // 20M yr buckets
    { from:-100e6,  to:-10e6,   bucketSize: 2e6   / zoom },  // 2M yr buckets
    { from:-10e6,   to:-100e3,  bucketSize: 200e3 / zoom },  // 200K yr buckets
    { from:-100e3,  to:-3000,   bucketSize: 2000  / zoom },  // 2000 yr buckets
    { from:-3000,   to:0,       bucketSize: 100   / zoom },  // 100 yr buckets
    { from:0,       to:1500,    bucketSize: 100   / zoom },  // 100 yr buckets
    { from:1500,    to:2030,    bucketSize: 10    / zoom },  // 10 yr buckets
    { from:2030,    to:1e6,     bucketSize: 50    / zoom },  // 50 yr buckets
    { from:1e6,     to:1e100,   bucketSize: 1e9   / zoom },  // 1B yr buckets
  ];

  // Group events into buckets
  const bucketMap = new Map();

  for (const ev of sorted) {
    // Find which phase this event belongs to
    let bs = 1e9;
    for (const ph of phases) {
      if (ev.time >= ph.from && ev.time < ph.to) { bs = ph.bucketSize; break; }
    }
    const bucketKey = Math.floor(ev.time / bs) * bs;
    if (!bucketMap.has(bucketKey)) {
      bucketMap.set(bucketKey, { time: bucketKey, events: [] });
    }
    bucketMap.get(bucketKey).events.push(ev);
  }

  // Convert to sorted array
  return Array.from(bucketMap.values()).sort((a,b) => a.time - b.time);
}

// ── Render timeline ───────────────────────────────────────────────────────────
function renderTimeline() {
  const container = document.getElementById('timeline');
  container.innerHTML = '';

  const buckets = groupEvents(allEvents, zoomLevel);
  let lastPhaseIdx = -1;

  for (const bucket of buckets) {
    const t = bucket.time;

    // Phase divider
    const phaseIdx = PHASES.findIndex(p => t >= p.from && t < p.to);
    if (phaseIdx !== lastPhaseIdx && phaseIdx >= 0) {
      lastPhaseIdx = phaseIdx;
      const div = document.createElement('div');
      div.className = 'phase-divider';
      div.innerHTML = `
        <div class="pd-time">${fmtTime(t)}</div>
        <div class="pd-label">${PHASES[phaseIdx].label}</div>
      `;
      container.appendChild(div);
    }

    // Era band
    const band = document.createElement('div');
    band.className = 'era-band';

    // Time label
    const timeDiv = document.createElement('div');
    timeDiv.className = 'era-time';
    timeDiv.innerHTML = `
      <span class="t-main">${fmtTime(t)}</span>
      <span class="t-age">${getAge(t)}</span>
    `;
    band.appendChild(timeDiv);

    // Event cells
    const cells = document.createElement('div');
    cells.className = 'era-cells';

    COLS.forEach(col => {
      const cell = document.createElement('div');
      cell.className = 'era-cell';
      cell.style.background = col.bg + '18';

      const colEvents = bucket.events.filter(e => e.row === col.key);
      colEvents.forEach(ev => {
        const chip = makeChip(ev, col);
        cell.appendChild(chip);
      });

      cells.appendChild(cell);
    });

    band.appendChild(cells);
    container.appendChild(band);
  }
}

function makeChip(ev, col) {
  const chip = document.createElement('div');
  chip.className = 'event-chip' + (indiaFilter && !ev.india ? ' dimmed' : '');
  chip.dataset.time  = ev.time;
  chip.dataset.title = ev.title;
  chip.dataset.row   = ev.row;

  const dot = document.createElement('div');
  dot.className = 'chip-dot';
  dot.style.background = col.dot;

  const text = document.createElement('div');
  text.className = 'chip-text';

  const title = document.createElement('div');
  title.className = 'chip-title';
  title.textContent = ev.title;

  text.appendChild(title);

  if (ev.india && ev.row !== 'india') {
    const sub = document.createElement('div');
    sub.className = 'chip-sub';
    sub.style.color = '#FF9933';
    sub.textContent = ev.india;
    text.appendChild(sub);
  } else if (ev.world && !ev.row.startsWith('world')) {
    const sub = document.createElement('div');
    sub.className = 'chip-sub';
    sub.textContent = ev.world;
    text.appendChild(sub);
  }

  chip.appendChild(dot);
  chip.appendChild(text);

  chip.addEventListener('click', e => {
    e.stopPropagation();
    showPanel(ev);
  });

  return chip;
}

// ── Scroll-driven header update ───────────────────────────────────────────────
function updateHeader() {
  // Find the era band currently at the top of the viewport
  const bands = document.querySelectorAll('.era-band');
  const scrollY = window.scrollY + 60; // account for header

  let currentBand = null;
  for (const band of bands) {
    const rect = band.getBoundingClientRect();
    if (rect.top <= 60) currentBand = band;
    else break;
  }

  if (currentBand) {
    const timeEl = currentBand.querySelector('.t-main');
    const t = parseFloat(currentBand.querySelector('.era-time')?.dataset?.t || '0');
    if (timeEl) {
      document.getElementById('hdr-time').textContent = timeEl.textContent;
      document.getElementById('hdr-bb').textContent = '';
    }
  }

  // Update scroll progress bar
  const total = document.body.scrollHeight - window.innerHeight;
  const pct = total > 0 ? (window.scrollY / total * 100) : 0;
  document.getElementById('progress').style.width = pct + '%';
}

// ── Detail panel ──────────────────────────────────────────────────────────────
const panel  = document.getElementById('panel');
const pTitle = document.getElementById('panel-title');
const pBody  = document.getElementById('panel-body');
const pClose = document.getElementById('panel-close');
const pLink  = document.getElementById('panel-link');
const pTime  = document.getElementById('panel-time');

pClose.addEventListener('click', () => { panel.style.display = 'none'; selEvent = null; });
document.addEventListener('click', e => {
  if (panel.style.display === 'block' && !panel.contains(e.target)) {
    panel.style.display = 'none'; selEvent = null;
  }
});

function showPanel(ev) {
  selEvent = ev;
  pTitle.textContent = ev.title;
  pTime.textContent  = fmtTime(ev.time) + (ev.age ? ' · ' + ev.age : '') + ' · ' + getAge(ev.time);
  pBody.innerHTML    = '<em style="color:#555">Loading…</em>';
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
}

function buildFallback(ev) {
  let h = '';
  if (ev.india) h += `<p class="india-note"><strong>India:</strong> ${ev.india}</p>`;
  if (ev.world) h += `<p>${ev.world}</p>`;
  if (!h) h = '<p style="color:#555">No description available.</p>';
  return h;
}

// ── Controls ──────────────────────────────────────────────────────────────────
document.getElementById('btn-zoom-in').addEventListener('click', () => {
  zoomLevel = Math.min(8, zoomLevel * 2);
  document.getElementById('zoom-display').textContent = 'zoom ' + zoomLevel + '×';
  renderTimeline();
});
document.getElementById('btn-zoom-out').addEventListener('click', () => {
  zoomLevel = Math.max(0.25, zoomLevel / 2);
  document.getElementById('zoom-display').textContent = 'zoom ' + zoomLevel + '×';
  renderTimeline();
});
document.getElementById('btn-india').addEventListener('click', function() {
  indiaFilter = !indiaFilter;
  this.classList.toggle('active', indiaFilter);
  // Update chip visibility
  document.querySelectorAll('.event-chip').forEach(chip => {
    const row = chip.dataset.row;
    // We need to know if this event has india data — store it
    chip.classList.toggle('dimmed', indiaFilter && !chip.dataset.india);
  });
});
document.getElementById('btn-reset').addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Keyboard navigation
window.addEventListener('keydown', e => {
  if (e.key === 'Escape') { panel.style.display = 'none'; selEvent = null; }
  if (e.key === 'Home')   { window.scrollTo({ top: 0, behavior: 'smooth' }); }
  if (e.key === 'End')    { window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); }
});

// Scroll listener for header update
window.addEventListener('scroll', updateHeader, { passive: true });

// ── Data loading ──────────────────────────────────────────────────────────────
const BASE = (function() {
  const p = window.location.pathname;
  const dir = p.endsWith('/') ? p.slice(0,-1) : p.replace(/\/[^/]*$/, '');
  return dir || '';
})();

const fill = document.getElementById('loading-fill');

fetch(BASE + '/data.json')
  .then(r => {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    // Stream progress
    const total = parseInt(r.headers.get('content-length') || '0');
    if (total && r.body) {
      const reader = r.body.getReader();
      let received = 0;
      const chunks = [];
      function pump() {
        return reader.read().then(({ done, value }) => {
          if (done) {
            const blob = new Blob(chunks);
            return blob.text().then(text => JSON.parse(text));
          }
          chunks.push(value);
          received += value.length;
          if (fill) fill.style.width = Math.min(95, received/total*100) + '%';
          return pump();
        });
      }
      return pump();
    }
    return r.json();
  })
  .then(d => {
    allEvents = Array.isArray(d) ? d : [];
    // Store india flag on events for filter
    allEvents.forEach(ev => { if (!ev.india) ev._noIndia = true; });
    console.log('[chrono] Loaded', allEvents.length, 'events');
    if (fill) fill.style.width = '100%';
    setTimeout(() => {
      document.getElementById('loading').style.display = 'none';
      buildHeader();
      renderTimeline();
      updateHeader();
    }, 200);
  })
  .catch(err => {
    console.error('[chrono] Failed:', err);
    allEvents = [
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
    buildHeader();
    renderTimeline();
  });

