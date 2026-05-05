/**
 * Chrono of Life — engine.js v6
 * Column-based layout: zero overlap, strong era gradients,
 * scroll-triggered animations, clean event cards.
 */

// ── Category definitions ──────────────────────────────────────────────────────
const CATS = [
  { key:'physical',      label:'Physical\n& Natural', dot:'#4caf50', col:0 },
  { key:'evolution',     label:'Evolution\n& Life',   dot:'#ff9800', col:1 },
  { key:'science',       label:'Science\n& Tech',     dot:'#2196f3', col:2 },
  { key:'india',         label:'India',               dot:'#FF9933', col:3 },
  { key:'world_asia',    label:'World\nAsia',         dot:'#90caf9', col:4 },
  { key:'world_europe',  label:'World\nEurope',       dot:'#80cbc4', col:5 },
  { key:'world_america', label:'World\nAmericas',     dot:'#ce93d8', col:6 },
];
const CAT_MAP = Object.fromEntries(CATS.map(c => [c.key, c]));

// ── Era backgrounds — strong, distinct gradients ──────────────────────────────
const ERA_BKGS = [
  { t:-13.8e9, bg:'#08001a', accent:'#3d0066' },  // Cosmic — deep purple
  { t:-10e9,   bg:'#050a1a', accent:'#003366' },  // Galactic — dark navy
  { t:-4.6e9,  bg:'#030d08', accent:'#004d1a' },  // Solar system — dark green
  { t:-3.8e9,  bg:'#050d15', accent:'#003344' },  // Life begins — teal-black
  { t:-541e6,  bg:'#040d18', accent:'#001a44' },  // Cambrian — ocean deep
  { t:-252e6,  bg:'#0a0d04', accent:'#1a2200' },  // Mesozoic — jungle dark
  { t:-66e6,   bg:'#0d0804', accent:'#2a1500' },  // Cenozoic — warm amber-black
  { t:-2.8e6,  bg:'#050810', accent:'#0d1a33' },  // Hominins — slate
  { t:-10000,  bg:'#060a12', accent:'#0d1f33' },  // Neolithic — deep blue
  { t:-3000,   bg:'#080a14', accent:'#0d1a3d' },  // Classical — midnight blue
  { t:0,       bg:'#060810', accent:'#0a1428' },  // CE era
  { t:1500,    bg:'#060810', accent:'#0a1020' },  // Early Modern
  { t:1760,    bg:'#050710', accent:'#080f1a' },  // Industrial
  { t:1900,    bg:'#040608', accent:'#060c14' },  // Modern — near black
  { t:2026,    bg:'#030508', accent:'#050a14' },  // Future
];

function getEraBg(t) {
  for (let i = ERA_BKGS.length-1; i >= 0; i--) {
    if (t >= ERA_BKGS[i].t) return ERA_BKGS[i];
  }
  return ERA_BKGS[0];
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

function fmtShort(t) {
  if (t === 0) return '0 CE';
  const abs = Math.abs(t);
  if (abs >= 1e9)  return (abs/1e9).toPrecision(3) + 'B yrs ' + (t<0?'ago':'from now');
  if (abs >= 1e6)  return (abs/1e6).toPrecision(3) + 'M yrs ' + (t<0?'ago':'from now');
  if (abs >= 1000) return t < 0 ? Math.round(abs)+' BCE' : Math.round(abs)+' CE';
  return t < 0 ? Math.round(abs)+' BCE' : Math.round(abs)+' CE';
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

// ── Group by exact timestamp — chronologically correct ───────────────────────
// Each unique time value gets its own row. Events at the same time
// appear side-by-side in their category columns. 633 unique timestamps = 633 rows.
function groupIntoBuckets(events) {
  const map = new Map();
  for (const ev of events) {
    const key = ev.time;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(ev);
  }
  return Array.from(map.entries())
    .sort((a,b) => a[0]-b[0])
    .map(([t,evs]) => ({ t, evs }));
}

// ── State ─────────────────────────────────────────────────────────────────────
let allEvents   = [];
let indiaFilter = false;

// ── Build DOM ─────────────────────────────────────────────────────────────────
function buildWorld(events) {
  const world = document.getElementById('world');
  world.innerHTML = '';

  const buckets = groupIntoBuckets(events);

  // Group buckets into eras (by age boundary)
  const eras = [];
  let currentEra = null;
  let lastAge = null;

  for (const bucket of buckets) {
    const age = getAge(bucket.t);
    if (age !== lastAge) {
      lastAge = age;
      currentEra = { age, t: bucket.t, buckets: [] };
      eras.push(currentEra);
    }
    currentEra.buckets.push(bucket);
  }

  // Render each era
  for (const era of eras) {
    const eraBg = getEraBg(era.t);

    const eraEl = document.createElement('div');
    eraEl.className = 'era';
    eraEl.dataset.t = era.t;
    eraEl.style.background = `linear-gradient(180deg, ${eraBg.bg} 0%, ${eraBg.accent}22 50%, ${eraBg.bg} 100%)`;

    // Sticky era label
    const label = document.createElement('div');
    label.className = 'era-label';
    label.innerHTML = `
      <div class="era-label-inner">
        <span class="era-label-time">${fmtShort(era.t)}</span>
        <span class="era-label-name">${era.age}</span>
      </div>`;
    eraEl.appendChild(label);

    // Column headers (only for first era)
    if (era === eras[0]) {
      const grid = document.createElement('div');
      grid.className = 'col-grid';
      CATS.forEach(cat => {
        const hdr = document.createElement('div');
        hdr.className = 'col-hdr';
        hdr.style.color = cat.dot;
        hdr.textContent = cat.label.replace('\n', ' ');
        grid.appendChild(hdr);
      });
      eraEl.appendChild(grid);
    }

    // Render buckets within this era
    for (const bucket of era.buckets) {
      const grid = document.createElement('div');
      grid.className = 'col-grid';

      // Check if this bucket has events in any column
      const hasMilestone = era.buckets.indexOf(bucket) === 0 && era !== eras[0];

      if (hasMilestone) {
        const ms = document.createElement('div');
        ms.className = 'milestone';
        ms.innerHTML = `
          <div class="milestone-line"></div>
          <div class="milestone-text">${era.age} · ${fmtShort(bucket.t)}</div>
          <div class="milestone-line"></div>`;
        grid.appendChild(ms);
      }

      // Create 7 column cells
      const cells = CATS.map(() => {
        const cell = document.createElement('div');
        cell.style.minHeight = '8px';
        return cell;
      });

      // Place events into their column cells
      let hasAnyEvent = false;
      for (const ev of bucket.evs) {
        const cat = CAT_MAP[ev.row];
        if (!cat) continue;
        hasAnyEvent = true;

        const card = makeCard(ev, cat);
        cells[cat.col].appendChild(card);
      }

      if (hasAnyEvent) {
        cells.forEach(cell => grid.appendChild(cell));
        eraEl.appendChild(grid);
      }
    }

    world.appendChild(eraEl);
  }

  // End cap
  const end = document.createElement('div');
  end.id = 'endcap';
  end.innerHTML = `
    <div class="big">∞</div>
    <strong>Heat Death of the Universe</strong><br>
    <small>10<sup>106</sup> years from now — maximum entropy</small>`;
  world.appendChild(end);

  // Set up intersection observer for scroll animations
  setupAnimations();
}

function makeCard(ev, cat) {
  const card = document.createElement('div');
  card.className = 'ev';
  card.dataset.row = ev.row;
  card.dataset.india = ev.india ? '1' : '';
  card.style.borderLeftColor = cat.dot;
  if (indiaFilter && !ev.india) card.classList.add('dimmed');

  // Stagger animation delay based on column
  card.style.animationDelay = (cat.col * 40) + 'ms';

  const titleLine = document.createElement('div');
  const dot = document.createElement('span');
  dot.className = 'ev-dot';
  dot.style.background = cat.dot;
  const title = document.createElement('span');
  title.className = 'ev-title';
  title.textContent = ev.title;
  titleLine.appendChild(dot);
  titleLine.appendChild(title);
  card.appendChild(titleLine);

  // Sub-text: show india context for non-india rows, or world context
  // Never duplicate the title
  let sub = '';
  if (ev.row !== 'india' && ev.india && ev.india !== ev.title) {
    sub = ev.india;
  } else if (!ev.row.startsWith('world') && ev.world && ev.world !== ev.title) {
    sub = ev.world;
  } else if (ev.age && ev.age !== ev.title) {
    sub = ev.age;
  }

  if (sub) {
    const subEl = document.createElement('div');
    subEl.className = 'ev-sub';
    subEl.textContent = sub;
    card.appendChild(subEl);
  }

  card.addEventListener('click', e => { e.stopPropagation(); showPanel(ev); });
  return card;
}

// ── Intersection observer for fade-in animations ──────────────────────────────
function setupAnimations() {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.animationPlayState = 'running';
        observer.unobserve(entry.target);
      }
    });
  }, { rootMargin: '0px 0px -50px 0px' });

  document.querySelectorAll('.ev').forEach(el => {
    el.style.animationPlayState = 'paused';
    observer.observe(el);
  });
}

// ── Scroll-driven HUD ─────────────────────────────────────────────────────────
function onScroll() {
  const eras = document.querySelectorAll('.era[data-t]');
  const mid = window.scrollY + 80;
  let currentT = -13.8e9;

  for (const era of eras) {
    if (era.offsetTop <= mid) currentT = parseFloat(era.dataset.t);
    else break;
  }

  document.getElementById('hud-time').textContent = fmtTime(currentT);
  document.getElementById('hud-age').textContent  = getAge(currentT);

  const total = document.body.scrollHeight - window.innerHeight;
  document.getElementById('prog').style.width = (total > 0 ? window.scrollY/total*100 : 0) + '%';
}

// ── Detail panel ──────────────────────────────────────────────────────────────
document.getElementById('pc').addEventListener('click', () => {
  document.getElementById('panel').style.display = 'none';
});
document.addEventListener('click', e => {
  const p = document.getElementById('panel');
  if (p.style.display === 'block' && !p.contains(e.target)) p.style.display = 'none';
});

function showPanel(ev) {
  const p = document.getElementById('panel');
  document.getElementById('pt').textContent    = ev.title;
  document.getElementById('ptime').textContent = fmtTime(ev.time) + ' · ' + getAge(ev.time);
  document.getElementById('pb').innerHTML      = '<em style="color:#555">Loading…</em>';
  p.style.display = 'block';

  const pl = document.getElementById('pl');
  if (ev.link) {
    pl.href = ev.link; pl.style.display = 'block';
    const slug = ev.link.split('/wiki/').pop() || ev.title.replace(/ /g,'_');
    fetch('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(slug))
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) { document.getElementById('pb').innerHTML = fallback(ev); return; }
        let h = '';
        if (d.thumbnail) h += `<img src="${d.thumbnail.source}" alt="">`;
        h += `<p>${d.extract||''}</p>`;
        if (ev.india) h += `<p class="in"><strong>India:</strong> ${ev.india}</p>`;
        document.getElementById('pb').innerHTML = h;
      })
      .catch(() => { document.getElementById('pb').innerHTML = fallback(ev); });
  } else {
    pl.style.display = 'none';
    document.getElementById('pb').innerHTML = fallback(ev);
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
  document.querySelectorAll('.ev').forEach(c => {
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

