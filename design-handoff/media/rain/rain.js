// Rain on a window over a soft garden, rendered frame by frame in Chromium.
// usage: node rain.js <background.jpg> <outDir> [frames]
const fs = require('fs');
const path = require('path');
const { chromium } = require('/opt/node-tools/node_modules/playwright');

const bgFile = process.argv[2];
const outDir = process.argv[3];
const total = Number(process.argv[4] || 288);
const bg = 'data:image/jpeg;base64,' + fs.readFileSync(bgFile).toString('base64');

const html = `<!doctype html><html><body style="margin:0;background:#000">
<canvas id="c" width="540" height="960"></canvas>
<script>
const W = 540, H = 960, FPS = 24;
const c = document.getElementById('c');
const ctx = c.getContext('2d');
function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const R = rng(20261022);
const rand = (a, b) => a + (b - a) * R();

let blurBg, sharpBg, trail;
function makeBg(img, filter) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const x = cv.getContext('2d');
  x.filter = filter;
  // cover-fit with overscan so the blur does not darken the edges
  // the upper part of the garden: trees and glass roof, fewer flowers
  const sh = img.height * 0.64;
  const s = Math.max(W / img.width, H / sh) * 1.12;
  const w = img.width * s, h = sh * s;
  x.drawImage(img, 0, 0, img.width, sh, (W - w) / 2, (H - h) / 2, w, h);
  return cv;
}
window.ready = new Promise((res) => {
  const img = new Image();
  img.onload = () => {
    blurBg = makeBg(img, 'blur(18px) hue-rotate(14deg) saturate(1.18) brightness(1.07) contrast(0.97)');
    sharpBg = makeBg(img, 'blur(2.5px) hue-rotate(14deg) saturate(1.2) brightness(1.08)');
    trail = document.createElement('canvas'); trail.width = W; trail.height = H;
    res();
  };
  img.src = '${bg}';
});

const micro = [];   // small droplets that sit on the glass
const drops = [];   // big drops that grow and slide down
const streaks = []; // rain falling outside, out of focus

function spawnMicro(n) {
  for (let i = 0; i < n; i++) {
    const r = Math.pow(R(), 2.4) * 4.8 + 0.9;
    micro.push({ x: rand(0, W), y: rand(-10, H), r, life: rand(5, 11), age: 0 });
  }
}
function spawnDrop() {
  drops.push({ x: rand(10, W - 10), y: rand(-40, H * 0.75), r: rand(7.5, 15), vy: 0, stall: rand(0.2, 1.4), age: 0, drift: rand(-0.4, 0.4), lastTrail: 0, dead: false });
}
spawnMicro(520);
for (let i = 0; i < 12; i++) spawnDrop();
for (let i = 0; i < 36; i++) streaks.push({ x: rand(0, W), y: rand(0, H), len: rand(40, 110), v: rand(700, 1100), a: rand(0.04, 0.09) });

function step(dt) {
  // new droplets land on the glass, old ones slowly dry
  spawnMicro(Math.round(rand(1, 4)));
  for (const m of micro) m.age += dt;
  for (let i = micro.length - 1; i >= 0; i--) if (micro[i].age > micro[i].life || micro[i].gone) micro.splice(i, 1);
  if (R() < dt * 1.6 && drops.length < 16) spawnDrop();
  for (const d of drops) {
    d.age += dt;
    if (d.stall > 0) { d.stall -= dt; d.r += dt * 0.6; continue; }
    const target = 90 + d.r * 26;
    d.vy += (target - d.vy) * Math.min(1, dt * 3.2);
    if (R() < dt * 0.9) { d.stall = rand(0.15, 0.6); d.vy *= 0.2; }
    const prevY = d.y;
    d.y += d.vy * dt;
    d.x += (d.drift + Math.sin(d.age * 3.1) * 0.35) * d.vy * dt * 0.06;
    // wipe and absorb the droplets in the path
    for (const m of micro) {
      if (m.gone) continue;
      if (Math.abs(m.x - d.x) < d.r * 0.95 + m.r && m.y > prevY - d.r && m.y < d.y + d.r) { m.gone = true; d.r = Math.min(18, Math.sqrt(d.r * d.r + m.r * m.r * 0.35)); }
    }
    // the drop leaves a clear wet track and tiny beads behind
    trail.getContext('2d').fillStyle = 'rgba(255,255,255,1)';
    const tc = trail.getContext('2d');
    tc.beginPath(); tc.ellipse(d.x, (prevY + d.y) / 2, d.r * 0.32, Math.abs(d.y - prevY) / 2 + d.r * 0.4, 0, 0, Math.PI * 2); tc.fill();
    if (d.y - d.lastTrail > rand(12, 26)) {
      d.lastTrail = d.y;
      micro.push({ x: d.x + rand(-1.5, 1.5), y: d.y - d.r * 1.6, r: rand(1.0, 2.2), life: rand(3, 6), age: 0 });
      d.r *= 0.985;
    }
    if (d.y > H + 30 || d.r < 3.2) d.dead = true;
  }
  for (let i = drops.length - 1; i >= 0; i--) if (drops[i].dead) drops.splice(i, 1);
  // the wet track fades back to fogged glass
  const tc = trail.getContext('2d');
  tc.globalCompositeOperation = 'destination-out';
  tc.fillStyle = 'rgba(0,0,0,' + (dt * 0.9).toFixed(4) + ')';
  tc.fillRect(0, 0, W, H);
  tc.globalCompositeOperation = 'source-over';
  for (const s of streaks) { s.y += s.v * dt; if (s.y > H + s.len) { s.y = -s.len; s.x = rand(0, W); } }
}

function lens(x, y, rx, ry, strength) {
  // refraction: a minified, upside-down view of the garden inside the drop
  ctx.save();
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.clip();
  const k = 3.6;
  ctx.translate(x, y); ctx.scale(1, -1);
  ctx.drawImage(sharpBg, x - rx * k, y - ry * k, rx * 2 * k, ry * 2 * k, -rx, -ry, rx * 2, ry * 2);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const g = ctx.createRadialGradient(x - rx * 0.15, y - ry * 0.2, Math.min(rx, ry) * 0.2, x, y, Math.max(rx, ry) * 1.05);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.78, 'rgba(20,40,40,' + (0.05 * strength).toFixed(3) + ')');
  g.addColorStop(1, 'rgba(10,25,30,' + (0.2 * strength).toFixed(3) + ')');
  ctx.fillStyle = g; ctx.fillRect(x - rx, y - ry, rx * 2, ry * 2);
  ctx.restore();
  // specular glint and a bright lower rim
  const hx = x - rx * 0.32, hy = y - ry * 0.38, hr = Math.max(0.6, Math.min(rx, ry) * 0.34);
  const h = ctx.createRadialGradient(hx, hy, 0, hx, hy, hr);
  h.addColorStop(0, 'rgba(255,255,255,' + (0.92 * strength).toFixed(3) + ')');
  h.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = h; ctx.beginPath(); ctx.arc(hx, hy, hr, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,' + (0.4 * strength).toFixed(3) + ')';
  ctx.lineWidth = Math.max(0.6, rx * 0.12);
  ctx.beginPath(); ctx.ellipse(x, y + ry * 0.05, rx * 0.86, ry * 0.86, 0, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
}

function render() {
  ctx.globalAlpha = 1;
  ctx.drawImage(blurBg, 0, 0);
  // light rain outside, softly out of focus
  ctx.save(); ctx.filter = 'blur(1.6px)'; ctx.lineCap = 'round';
  for (const s of streaks) { ctx.strokeStyle = 'rgba(255,255,255,' + s.a + ')'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(s.x, s.y - s.len); ctx.lineTo(s.x - s.len * 0.08, s.y); ctx.stroke(); }
  ctx.restore();
  // fogged glass everywhere except the fresh wet tracks
  ctx.fillStyle = 'rgba(236,244,246,0.10)'; ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.globalAlpha = 0.4;
  ctx.globalCompositeOperation = 'source-over';
  const clear = document.createElement('canvas'); clear.width = W; clear.height = H;
  const cx = clear.getContext('2d');
  cx.drawImage(trail, 0, 0); cx.globalCompositeOperation = 'source-in'; cx.drawImage(sharpBg, 0, 0);
  ctx.drawImage(clear, 0, 0);
  ctx.restore();
  for (const m of micro) {
    const fadeIn = Math.min(1, m.age / 0.25), fadeOut = Math.min(1, (m.life - m.age) / 1.2);
    const s = Math.max(0, Math.min(fadeIn, fadeOut));
    if (s <= 0.02) continue;
    lens(m.x, m.y, m.r, m.r * 0.94, s);
  }
  for (const d of drops) {
    const stretch = 1 + Math.min(0.35, d.vy / 900);
    // soft contact shadow under the bigger drops
    ctx.fillStyle = 'rgba(0,20,20,0.10)';
    ctx.beginPath(); ctx.ellipse(d.x + 0.6, d.y + d.r * 0.25, d.r * 1.05, d.r * stretch * 1.06, 0, 0, Math.PI * 2); ctx.fill();
    lens(d.x, d.y, d.r, d.r * stretch, 1);
  }
}

window.frame = function (i, simulateOnly) {
  step(1 / FPS);
  if (simulateOnly) return null;
  render();
  return c.toDataURL('image/png');
};
</script></body></html>`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 560, height: 980 } });
  await page.setContent(html);
  await page.evaluate(() => window.ready);
  // let the glass fill up before the first recorded frame
  for (let i = 0; i < 72; i++) await page.evaluate((k) => window.frame(k, true), i);
  fs.mkdirSync(outDir, { recursive: true });
  for (let i = 0; i < total; i++) {
    const url = await page.evaluate((k) => window.frame(k, false), i);
    fs.writeFileSync(path.join(outDir, 'r_' + String(i).padStart(3, '0') + '.png'), Buffer.from(url.split(',')[1], 'base64'));
  }
  await browser.close();
  console.log('done', total);
})();
