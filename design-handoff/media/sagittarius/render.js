// Renders the Sagittarius shooting loop frame by frame in Chromium.
// usage: node render.js <dir> [--test]
// Reads orig300.png, body300.png, arrow300.png and geometry.json from <dir>,
// writes frames/f_000.png ... frames/f_095.png (300x300, transparent).
const fs = require('fs');
const path = require('path');
const { chromium } = require('/opt/node-tools/node_modules/playwright');

const dir = process.argv[2];
const test = process.argv.includes('--test');
const b64 = (f) => 'data:image/png;base64,' + fs.readFileSync(path.join(dir, f)).toString('base64');
const geo = JSON.parse(fs.readFileSync(path.join(dir, 'geometry.json'), 'utf8'));

const page = `<!doctype html><html><body style="margin:0;background:transparent">
<canvas id="c" width="300" height="300"></canvas>
<script>
const GEO = ${JSON.stringify(geo)};
const SRC = { orig: '${b64('orig300.png')}', body: '${b64('body300.png')}', arrow: '${b64('arrow300.png')}' };
const img = {};
window.ready = Promise.all(Object.keys(SRC).map((k) => new Promise((res) => { const i = new Image(); i.onload = () => { img[k] = i; res(); }; i.src = SRC[k]; })));

const FPS = 24, FRAMES = 96, TR = 1.15, S = 300 / 512;
const T = GEO.top_tip, B = GEO.bottom_tip, N0 = GEO.nock, L0 = GEO.lower_hidden;
const NB = [T[0] + (N0[1] - T[1]) * (B[0] - T[0]) / (B[1] - T[1]), N0[1]];
const U = (() => { const k = GEO.arrow.k; const l = Math.hypot(1, k); return [1 / l, k / l]; })();
const POWER = 0.10, DRAW_FULL = NB[0] - N0[0];
const PIVOT = [300 * S, 470 * S];

const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);
const easeInOutCubic = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const clamp01 = (x) => Math.max(0, Math.min(1, x));

// string draw state: 0 = full draw (at the hand), 1 = straight at brace
function stringS(t) {
  if (t < TR) return 0;
  const tau = t - TR;
  if (tau < POWER) return Math.pow(tau / POWER, 2);
  if (t < 2.25) return 1 + 0.09 * Math.exp(-(tau - POWER) / 0.16) * Math.sin(2 * Math.PI * 6.5 * (tau - POWER));
  if (t < 2.95) return 1 - easeInOutCubic((t - 2.25) / 0.7);
  return 0;
}

// flying arrow displacement along its axis (source px); null when not drawn
function flight(t) {
  if (t < TR) return null;
  const tau = t - TR;
  if (tau < POWER) return DRAW_FULL * Math.pow(tau / POWER, 2);
  const v = 2 * DRAW_FULL / POWER * 0.92;
  const d = DRAW_FULL + v * (tau - POWER);
  return d > 560 ? null : d;
}

function swayAngle(t) {
  let a = 0.55 * Math.sin(2 * Math.PI * t / 4);
  if (t >= TR) {
    const tau = t - TR;
    a += -0.4 * Math.exp(-tau / 0.14) * (1 - Math.exp(-tau / 0.02));
  }
  return a * Math.PI / 180;
}

function stringLine(ctx, a, b, ghost) {
  // embossed silver line in source px: dark under-edge, light top
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
  const nx = -dy / l, ny = dx / l;
  const side = ny < 0 ? -1 : 1; // keep the dark edge on the lower side
  ctx.lineCap = 'round';
  ctx.globalAlpha = ghost;
  ctx.strokeStyle = 'rgba(64,68,76,0.92)';
  ctx.lineWidth = 3.0;
  ctx.beginPath(); ctx.moveTo(a[0] + nx * 0.55 * side, a[1] + ny * 0.55 * side); ctx.lineTo(b[0] + nx * 0.55 * side, b[1] + ny * 0.55 * side); ctx.stroke();
  ctx.strokeStyle = 'rgba(226,228,233,1)';
  ctx.lineWidth = 1.55;
  ctx.beginPath(); ctx.moveTo(a[0] - nx * 0.45 * side, a[1] - ny * 0.45 * side); ctx.lineTo(b[0] - nx * 0.45 * side, b[1] - ny * 0.45 * side); ctx.stroke();
  ctx.globalAlpha = 1;
}

const lerp = (p, q, s) => [p[0] + (q[0] - p[0]) * s, p[1] + (q[1] - p[1]) * s];

function drawStrings(ctx, s, which, t) {
  // ghost copies while the string is moving fast give it a little motion blur
  const prev = stringS(t - 1 / (FPS * 2));
  const copies = [];
  if (Math.abs(s - prev) > 0.02) {
    // a soft fan of faint positions between the previous half-frame and now
    const n = Math.min(8, Math.max(3, Math.round(Math.abs(s - prev) * 14)));
    for (let k = 1; k < n; k++) copies.push([prev + (s - prev) * k / n, 0.5 / n]);
  }
  copies.push([s, 1]);
  ctx.save();
  ctx.scale(S, S);
  for (const [sv, al] of copies) {
    if (which === 'upper') stringLine(ctx, T, lerp(N0, NB, sv), al);
    else stringLine(ctx, B, lerp(L0, NB, sv), al);
  }
  ctx.restore();
}

function drawArrowAt(ctx, d, alpha, clipX) {
  ctx.save();
  if (clipX != null) { ctx.beginPath(); ctx.rect(clipX * S, 0, 300, 300); ctx.clip(); }
  ctx.globalAlpha = alpha;
  ctx.drawImage(img.arrow, d * U[0] * S, d * U[1] * S, 300, 300);
  ctx.restore();
}

function composed(ctx, t) {
  const s = stringS(t);
  drawStrings(ctx, s, 'lower', t);
  ctx.drawImage(img.body, 0, 0, 300, 300);
  drawStrings(ctx, s, 'upper', t);
  const d = flight(t);
  if (t >= TR && t < 2.4) {
    // a faint trace along the flight path that fades out
    const tau = t - TR;
    const fade = 0.32 * Math.exp(-tau / 0.22) * clamp01(tau / 0.05);
    if (fade > 0.01) {
      const x0 = (N0[0] + 60) * S, tipD = d == null ? 900 : d;
      const x1 = Math.min(512, GEO.arrow.tip_x + tipD) * S;
      const y = (x) => (GEO.arrow.k * (x / S) + GEO.arrow.b) * S;
      const g = ctx.createLinearGradient(x0, 0, x1, 0);
      g.addColorStop(0, 'rgba(150,162,186,0)');
      g.addColorStop(1, 'rgba(150,162,186,' + fade.toFixed(3) + ')');
      ctx.strokeStyle = g; ctx.lineWidth = 0.9; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x0, y(x0)); ctx.lineTo(x1, y(x1)); ctx.stroke();
    }
  }
  if (d != null && t >= TR) {
    // motion blur: earlier sub-positions drawn fainter
    const subs = [0.8, 0.6, 0.4, 0.2];
    const w = [0.12, 0.18, 0.26, 0.38];
    subs.forEach((k, i) => { const dk = flight(t - k / FPS); if (dk != null) drawArrowAt(ctx, dk, w[i], null); });
    drawArrowAt(ctx, d, 1, null);
  }
  if (t >= 2.75) {
    // a new arrow slides out of the drawing hand into place
    const v = clamp01((t - 2.75) / 0.5);
    const e = easeOutCubic(v);
    drawArrowAt(ctx, -170 * (1 - e), Math.min(1, v * 3), 228);
    if (t >= 3.2 && t < 3.55) {
      // a soft glint runs along the new arrow once it settles
      const g = clamp01((t - 3.2) / 0.35);
      const gx = N0[0] + 40 + g * (GEO.arrow.tip_x - N0[0] - 40);
      const gy = GEO.arrow.k * gx + GEO.arrow.b;
      const r = ctx.createRadialGradient(gx * S, gy * S, 0, gx * S, gy * S, 7);
      const a = 0.55 * Math.sin(Math.PI * g);
      r.addColorStop(0, 'rgba(255,255,255,' + a.toFixed(3) + ')');
      r.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = r; ctx.beginPath(); ctx.arc(gx * S, gy * S, 7, 0, Math.PI * 2); ctx.fill();
    }
  }
}

function layer(t, what) {
  // one layer (the drawn scene or the untouched original) with the sway applied
  const cv = document.createElement('canvas');
  cv.width = 300; cv.height = 300;
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  const ang = swayAngle(t);
  ctx.translate(PIVOT[0], PIVOT[1]); ctx.rotate(ang); ctx.translate(-PIVOT[0], -PIVOT[1]);
  if (what === 'composed') composed(ctx, t);
  else ctx.drawImage(img.orig, 0, 0, 300, 300);
  return cv;
}

window.drawFrame = function (i, mode) {
  const c = document.getElementById('c');
  const ctx = c.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, 300, 300);
  const t = i / FPS;
  if (mode === 'composed') { ctx.drawImage(layer(t, 'composed'), 0, 0); return c.toDataURL('image/png'); }
  const XF0 = 3.45, XF1 = 3.7;
  if (t < TR || t >= XF1) {
    ctx.drawImage(layer(t, 'orig'), 0, 0);
  } else if (t < XF0) {
    ctx.drawImage(layer(t, 'composed'), 0, 0);
  } else {
    // exact linear blend of premultiplied pixels: composed*(1-k) + original*k
    const k = (t - XF0) / (XF1 - XF0);
    ctx.globalAlpha = 1 - k; ctx.drawImage(layer(t, 'composed'), 0, 0);
    ctx.globalAlpha = k; ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(layer(t, 'orig'), 0, 0);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }
  return c.toDataURL('image/png');
};
</script></body></html>`;

(async () => {
  const browser = await chromium.launch();
  const p = await browser.newPage({ viewport: { width: 320, height: 320 } });
  await p.setContent(page);
  await p.evaluate(() => window.ready);
  const out = path.join(dir, test ? 'test' : 'frames');
  fs.mkdirSync(out, { recursive: true });
  const list = test ? [[0, 'composed'], [0, 'normal']] : Array.from({ length: 96 }, (_, i) => [i, 'normal']);
  for (const [i, mode] of list) {
    const url = await p.evaluate(([i, m]) => window.drawFrame(i, m), [i, mode]);
    const name = test ? `t_${mode}_${i}.png` : `f_${String(i).padStart(3, '0')}.png`;
    fs.writeFileSync(path.join(out, name), Buffer.from(url.split(',')[1], 'base64'));
  }
  await browser.close();
  console.log('done', list.length);
})();
