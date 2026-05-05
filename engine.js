/**
 * Chrono of Life — engine.js v5
 * Neal.fun-inspired: smooth vertical scroll, events float freely,
 * gradient background shifts with era, big time indicator.
 */

// ── Row colours & labels ──────────────────────────────────────────────────────
const ROW = {
  physical:      { dot:'#4caf50', label:'Physical'  },
  evolution:     { dot:'#ff9800', label:'Evolution'  },
  science:       { dot:'#2196f3', label:'Science'    },
  india:         { dot:'#FF9933', label:'India'      },
  world_asia:    { dot:'#90caf9', label:'Asia'       },
  world_europe:  { dot:'#80cbc4', label:'Europe'     },
  world_america: { dot:'#ce93d8', label:'Americas'   },
};

// ── Era background gradients (Big Bang → Heat Death) ─────────────────────────
const ERA_BKGS = [
  { t:-13.8e9, bg:'#0a0010' },  // Cosmic — deep purple-black
  { t:-4.6e9,  bg:'#050a1a' },  // Solar system — dark navy
  { t:-3.8e9,  bg:'#051a10' },  // Life begins — dark green-black
  { t:-541e6,  bg:'#071520' },  // Cambrian — deep ocean
  { t:-252e6,  bg:'#0d1a08' },  // Mesozoic — dark forest
  { t:-66e6,   bg:'#1a0d05' },  // Cenozoic — warm dark
  { t:-2.8e6,  bg:'#0d1020' },  // Hominins — cool dark
  { t:-10000,  bg:'#0a1520' },  // Neolithic — slate
  { t:-3000,   bg:'#0d1525' },  // Bronze Age — deep blue
  { t:0,       bg:'#0a1020' },  // Classical — midnight
  { t:1500,    bg:'#0d1020' },  // Early Modern
  { t:1760,    bg:'#0a0d18' },  // Industrial — dark steel
  { t:1900,    bg:'#050710' },  // Modern — near black
  { t:2026,    bg:'#050a15' },  // Future — deep space
  { t:1e9,     bg:'#020308' },  // Deep future — void
];

function getBg(t) {
  for (let i = ERA_BKGS.length-1; i >= 0; i--) {
    if (t >= ERA_BKGS[i].t) return ERA_BKGS[i].bg;
  }
  return '#05070f';
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
  const s = 13.8e9 + t;
  if (s <= 0) return 'At the Big Bang';
  if (s >= 1e9) return (s/1e9).toPrecision(3) + 'B yrs after Big Bang';
  if (s >= 1e6) return (s/1e6).toPrecision(3) + 'M yrs after Big Bang';
  return Math.round(s) + ' yrs after Big Bang';
}

const AGES = [
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
  for (const [f,to,l] of AGES) if (t>=f&&t<to) return l;
  return '—';
}

// ── State ─────────────────────────────────────────────────────────────────────
let allEvents   = [];
let indiaFilter = false;

// ── Layout: group events into time buckets ────────────────────────────────────
// Each bucket becomes one "row" in the scroll world.
// Bucket height = 120px. Events float at random-ish X positions within the row.

const BUCKET_H = 140;  // px height per time bucket

// Bucket sizes by time range (years)
const BUCKET_SIZES = [
  [-13.8e9, -1e9,    500e6 ],
  [-1e9,    -100e6,  50e6  ],
  [-100e6,  -10e6,   5e6   ],
  [-10e6,   -100e3,  500e3 ],
  [-100e3,  -3000,   3000  ],
  [-3000,   0,       200   ],
  [0,       1500,    200   ],
  [1500,    2030,    15    ],
  [2030,    1e6,     100   ],
  [1e6,     1e9,     1e6   ],
  [1e9,     1e100,   1e9   ],
];

function getBucketSize(t) {
  for (const [from,to,sz] of BUCKET_SIZES) {
    if (t >= from && t < to) return sz;
  }
  return 1e9;
}

function groupIntoBuckets(events) {
  const map = new Map();
  for (const ev of events) {
    const sz = getBucketSize(ev.time);
    const key = Math.floor(ev.time / sz) * sz;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(ev);
  }
  return Array.from(map.entries())
    .sort((a,b) => a[0]-b[0])
    .map(([t,evs]) => ({ t, evs }));
}

// ── Age change detection ──────────────────────────────────────────────────────
function getAgeBoundaries(buckets) {
  const boundaries = new Set();
  let lastAge = null;
  for (const b of buckets) {
    const age = getAge(b.t);
    if (age !== lastAge) {
      boundaries.add(b.t);
      lastAge = age;
    }
  }
  return boundaries;
}

// ── Build the DOM ─────────────────────────────────────────────────────────────
function buildWorld(events) {
  const world = document.getElementById('scroll-world');
  world.innerHTML = '';

  const buckets = groupIntoBuckets(events);
  const ageBounds = getAgeBoundaries(buckets);

  // Horizontal positions for each row key (0-1 fraction of available width)
  // Stagger so different categories appear at different X positions
  const COL_X = {
    physical:      [0.05, 0.25, 0.45],
    evolution:     [0.15, 0.35, 0.55],
    science:       [0.60, 0.75, 0.88],
    india:         [0.10, 0.30, 0.50, 0.70],
    world_asia:    [0.20, 0.40, 0.60, 0.80],
    world_europe:  [0.55, 0.72, 0.85],
    world_america: [0.08, 0.28, 0.48, 0.68],
  };

  // Track X position index per row
  const xIdx = {};
  for (const k of Object.keys(COL_X)) xIdx[k] = 0;

  let lastAge = null;

  for (const bucket of buckets) {
    const { t, evs } = bucket;
    const age = getAge(t);

    // Age boundary banner
    if (ageBounds.has(t) && age !== lastAge) {
      lastAge = age;
      const banner = document.createElement('div');
      banner.className = 'age-banner';
      banner.dataset.t = t;
      banner.innerHTML = `<span class="age-banner-text">${age} · ${fmtTime(t)}</span>`;
      world.appendChild(banner);
    }

    // Events area for this bucket
    const area = document.createElement('div');
    area.className = 'events-area';
    area.dataset.t = t;
    area.style.height = Math.max(BUCKET_H, evs.length * 28 + 40) + 'px';
    area.style.background = getBg(t);

    // Place each event
    evs.forEach((ev, i) => {
      const r = ROW[ev.row];
      if (!r) return;

      const card = document.createElement('div');
      card.className = 'ev-card' + (indiaFilter && !ev.india ? ' dimmed' : '');
      card.dataset.row = ev.row;
      card.dataset.india = ev.india ? '1' : '';

      // X position: use column positions, cycling through them
      const positions = COL_X[ev.row] || [0.1, 0.4, 0.7];
      const xFrac = positions[xIdx[ev.row] % positions.length];
      xIdx[ev.row]++;

      // Y position: spread vertically within the area
      const yFrac = 0.1 + (i / Math.max(evs.length, 1)) * 0.75;

      card.style.left = (xFrac * 100) + '%';
      card.style.top  = (yFrac * 100) + '%';

      // Row badge
      const badge = document.createElement('div');
      badge.className = 'ev-row-badge';
      badge.style.color = r.dot;
      badge.textContent = r.label;

      // Title line
      const titleLine = document.createElement('div');
      titleLine.style.display = 'flex';
      titleLine.style.alignItems = 'flex-start';
      titleLine.style.gap = '5px';

      const dot = document.createElement('span');
      dot.className = 'ev-dot';
      dot.style.background = r.dot;
      dot.style.marginTop = '3px';

      const title = document.createElement('span');
      title.className = 'ev-title';
      title.textContent = ev.title;

      titleLine.appendChild(dot);
      titleLine.appendChild(title);

      card.appendChild(badge);
      card.appendChild(titleLine);

      // Sub-text
      const sub = ev.india && ev.row !== 'india' ? ev.india
                : ev.world && !ev.row.startsWith('world') ? ev.world
                : ev.age ? ev.age : '';
      if (sub) {
        const subEl = document.createElement('div');
        subEl.className = 'ev-sub';
        subEl.textContent = sub;
        card.appendChild(subEl);
      }

      card.addEventListener('click', e => { e.stopPropagation(); showPanel(ev); });
      area.appendChild(card);
    });

    world.appendChild(area);
  }

  // End cap
  const end = document.createElement('div');
  end.style.cssText = 'text-align:center;padding:80px 20px;color:rgba(255,255,255,.2);font-size:14px;';
  end.innerHTML = '<div style="font-size:32px;margin-bottom:12px">∞</div>Heat Death of the Universe<br><small>10<sup>106</sup> years from now</small>';
  world.appendChild(end);
}

// ── Scroll-driven HUD update ──────────────────────────────────────────────────
function onScroll() {
  // Find current time from visible area
  const areas = document.querySelectorAll('.events-area[data-t]');
  const mid = window.scrollY + window.innerHeight / 2;
  let currentT = -13.8e9;

  for (const area of areas) {
    const top = area.offsetTop;
    if (top <= mid) currentT = parseFloat(area.dataset.t);
    else break;
  }

  document.getElementById('hud-time').textContent = fmtTime(currentT);
  document.getElementById('hud-age').textContent  = getAge(currentT);

  // Progress bar
  const total = document.body.scrollHeight - window.innerHeight;
  const pct = total > 0 ? window.scrollY / total * 100 : 0;
  document.getElementById('prog').style.width = pct + '%';
}

// ── Detail panel ──────────────────────────────────────────────────────────────
document.getElementById('pc').addEventListener('click', () => {
  document.getElementById('panel').style.display = 'none';
});
document.addEventListener('click', e => {
  const p = document.getElementById('panel');
  if (p.style.display === 'block' && !p.contains(e.target)) {
    p.style.display = 'none';
  }
});

function showPanel(ev) {
  const p  = document.getElementById('panel');
  const pt = document.getElementById('pt');
  const pb = document.getElementById('pb');
  const pl = document.getElementById('pl');
  const ptime = document.getElementById('ptime');

  pt.textContent   = ev.title;
  ptime.textContent = fmtTime(ev.time) + ' · ' + getAge(ev.time);
  pb.innerHTML     = '<em style="color:#555">Loading…</em>';
  p.style.display  = 'block';

  if (ev.link) {
    pl.href = ev.link; pl.style.display = 'block';
    const slug = ev.link.split('/wiki/').pop() || ev.title.replace(/ /g,'_');
    fetch('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(slug))
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) { pb.innerHTML = fallback(ev); return; }
        let h = '';
        if (d.thumbnail) h += `<img src="${d.thumbnail.source}" alt="">`;
        h += `<p>${d.extract||''}</p>`;
        if (ev.india) h += `<p class="in"><strong>India:</strong> ${ev.india}</p>`;
        pb.innerHTML = h;
      })
      .catch(() => { pb.innerHTML = fallback(ev); });
  } else {
    pl.style.display = 'none';
    pb.innerHTML = fallback(ev);
  }
}

function fallback(ev) {
  let h = '';
  if (ev.india) h += `<p class="in"><strong>India:</strong> ${ev.india}</p>`;
  if (ev.world) h += `<p>${ev.world}</p>`;
  return h || '<p style="color:#555">No description available.</p>';
}

// ── Controls ──────────────────────────────────────────────────────────────────
document.getElementById('btn-india').addEventListener('click', function() {
  indiaFilter = !indiaFilter;
  this.classList.toggle('on', indiaFilter);
  document.querySelectorAll('.ev-card').forEach(c => {
    c.classList.toggle('dimmed', indiaFilter && !c.dataset.india);
  });
});

document.getElementById('btn-top').addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

window.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.getElementById('panel').style.display = 'none';
  if (e.key === 'Home')   window.scrollTo({ top: 0, behavior: 'smooth' });
  if (e.key === 'End')    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
});

window.addEventListener('scroll', onScroll, { passive: true });

// ── Load data ─────────────────────────────────────────────────────────────────
const BASE = (function() {
  const p = window.location.pathname;
  return p.endsWith('/') ? p.slice(0,-1) : p.replace(/\/[^/]*$/,'');
})();

const lfill = document.getElementById('lfill');

fetch(BASE + '/data.json')
  .then(r => {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const len = parseInt(r.headers.get('content-length')||'0');
    if (len && r.body) {
      const reader = r.body.getReader();
      let got = 0; const chunks = [];
      function pump() {
        return reader.read().then(({done,value}) => {
          if (done) return new Blob(chunks).text().then(t => JSON.parse(t));
          chunks.push(value); got += value.length;
          if (lfill) lfill.style.width = Math.min(95, got/len*100) + '%';
          return pump();
        });
      }
      return pump();
    }
    return r.json();
  })
  .then(d => {
    allEvents = Array.isArray(d) ? d : [];
    console.log('[chrono] Loaded', allEvents.length, 'events');
    if (lfill) lfill.style.width = '100%';
    setTimeout(() => {
      document.getElementById('loading').style.display = 'none';
      buildWorld(allEvents);
      onScroll();
    }, 150);
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
      {time:0,      title:'Year 0 CE',row:'physical'},
      {time:1526,   title:'Mughal Empire',row:'india',india:'Babur wins Panipat'},
      {time:1760,   title:'Industrial Revolution',row:'science'},
      {time:1947,   title:'India Independence',row:'india',india:'Aug 15 1947'},
      {time:2026,   title:'Present',row:'physical'},
    ];
    document.getElementById('loading').style.display = 'none';
    buildWorld(allEvents);
    onScroll();
  });

