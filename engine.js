const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const modal = document.getElementById('modal');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let scale = 1;
let offsetX = 0;
let events = [];

// 🔥 FIX: correct path handling for GitHub Pages
const BASE_PATH = window.location.pathname.includes('/chrono') ? '/chrono/' : '/';

// Try loading dataset
fetch(BASE_PATH + 'data.json')
  .then(r => {
    if (!r.ok) throw new Error("Failed to load data.json");
    return r.json();
  })
  .then(d => {
    console.log("Data loaded:", d.length, "events");
    events = d;
    draw();
  })
  .catch(err => {
    console.error(err);
    // fallback minimal data (so screen never blank)
    events = [
      { time: -13.8e9, title: "Big Bang" },
      { time: 0, title: "Present" },
      { time: 1e10, title: "Future" }
    ];
    draw();
  });

// 🔥 time compression
function tx(t) {
  return Math.sign(t) * Math.log10(Math.abs(t) + 1) * 500;
}

// 🔥 elliptical projection
function ty(x) {
  return Math.sin(x / 800) * 120;
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(canvas.width / 2 + offsetX, canvas.height / 2);
  ctx.scale(scale, 1);

  // axis
  ctx.strokeStyle = "#333";
  ctx.beginPath();
  ctx.moveTo(-5000, 0);
  ctx.lineTo(5000, 0);
  ctx.stroke();

  events.forEach(e => {
    let x = tx(e.time);
    let y = ty(x);

    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = "white";
    ctx.fill();

    // semantic zoom
    if (scale > 0.8) {
      ctx.fillText(e.title, x + 6, y - 6);
    }
  });

  ctx.restore();
}

// zoom
canvas.addEventListener('wheel', e => {
  scale += e.deltaY * -0.001;
  scale = Math.max(0.2, Math.min(5, scale));
  draw();
});

// pan
canvas.addEventListener('mousemove', e => {
  if (e.buttons === 1) {
    offsetX += e.movementX;
    draw();
  }
});

// click
canvas.addEventListener('click', e => {
  const x = (e.clientX - canvas.width / 2 - offsetX) / scale;
  const y = (e.clientY - canvas.height / 2);

  events.forEach(ev => {
    let ex = tx(ev.time);
    let ey = ty(ex);

    if (Math.hypot(ex - x, ey - y) < 8) {
      show(ev);
    }
  });
});

function show(ev) {
  modal.style.display = "block";
  modal.innerHTML = `<h3>${ev.title}</h3><p>Loading...</p>`;

  if (ev.link) {
    fetch("https://en.wikipedia.org/api/rest_v1/page/summary/" + ev.title.replace(/ /g, "_"))
      .then(r => r.json())
      .then(d => {
        modal.innerHTML = `
          <h3>${ev.title}</h3>
          <p>${d.extract || "No summary available"}</p>
          <a href="${ev.link}" target="_blank">Read more</a>
        `;
      });
  }
}

// initial draw (so screen not blank)
draw();
