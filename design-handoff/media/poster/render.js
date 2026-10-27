// Draws the «Небо в день рождения» poster from sky.json. A3 proportions, 1754x2480 px.
// usage: node render.js <logo.webp> <outDir>
const fs = require('fs');
const path = require('path');
const { chromium } = require('/opt/node-tools/node_modules/playwright');

const here = __dirname;
const logo = 'data:image/webp;base64,' + fs.readFileSync(process.argv[2]).toString('base64');
const outDir = process.argv[3];
const sky = fs.readFileSync(path.join(here, 'sky.json'), 'utf8');
const faces = fs.readFileSync(path.join(here, 'fonts/list.txt'), 'utf8').trim().split('\n').map((l) => {
  const [fam, style, weight, file, range] = l.split('|');
  const b64 = fs.readFileSync(path.join(here, 'fonts', file)).toString('base64');
  return `@font-face{font-family:'${fam}';font-style:${style};font-weight:${weight};src:url(data:font/woff2;base64,${b64}) format('woff2');unicode-range:${range};}`;
}).join('\n');

const html = `<!doctype html><html><head><meta charset="utf-8"><style>${faces} body{margin:0}</style></head><body>
<canvas id="c" width="1754" height="2480"></canvas>
<script>
const SKY = ${sky};
const W = 1754, H = 2480;
const THEMES = {
  light: { paper: '#FBFAF7', skyIn: '#1E2766', skyOut: '#0B1036', rim: '#1E2766', tick: 'rgba(30,39,102,.55)', letter: '#1E2766', title: '#151B4E', sub: '#3B4068', meta: '#6E7392', foot: '#9A9FB8', divider: 'rgba(30,39,102,.25)' },
  dark: { paper: '#0C1132', skyIn: '#1A2363', skyOut: '#0E1440', rim: 'rgba(220,226,255,.55)', tick: 'rgba(220,226,255,.45)', letter: '#DCE2FF', title: '#F3F4FB', sub: '#C9CDE6', meta: '#9DA3C4', foot: '#6F76A0', divider: 'rgba(220,226,255,.25)' },
};
function starColor(bv) {
  if (bv < 0.0) return [205, 222, 255];
  if (bv < 0.4) return [226, 236, 255];
  if (bv < 0.8) return [255, 255, 255];
  if (bv < 1.2) return [255, 240, 220];
  return [255, 224, 196];
}
window.draw = function (themeName) {
  const T = THEMES[themeName];
  const c = document.getElementById('c'), ctx = c.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = T.paper; ctx.fillRect(0, 0, W, H);
  const cx = W / 2, cy = 860, R = 660;
  const P = (p) => [cx + p[0] * R, cy + p[1] * R];

  // outer rim with azimuth ticks and the four directions
  ctx.strokeStyle = T.rim; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(cx, cy, R + 26, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(cx, cy, R + 14, 0, Math.PI * 2); ctx.stroke();
  for (let a = 0; a < 360; a += 5) {
    const long = a % 15 === 0;
    const t = a * Math.PI / 180;
    const x = -Math.sin(t), y = -Math.cos(t);
    ctx.strokeStyle = T.tick; ctx.lineWidth = long ? 2 : 1.2;
    ctx.beginPath(); ctx.moveTo(cx + x * (R + 26), cy + y * (R + 26)); ctx.lineTo(cx + x * (R + 26 + (long ? 18 : 10)), cy + y * (R + 26 + (long ? 18 : 10))); ctx.stroke();
  }
  ctx.fillStyle = T.letter; ctx.font = "600 34px 'Onest'"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  [['С', 0], ['В', 90], ['Ю', 180], ['З', 270]].forEach(([l, a]) => { const t = a * Math.PI / 180; ctx.fillText(l, cx - Math.sin(t) * (R + 78), cy - Math.cos(t) * (R + 78)); });

  // the sky disc
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
  const g = ctx.createRadialGradient(cx, cy - R * 0.2, R * 0.1, cx, cy, R);
  g.addColorStop(0, T.skyIn); g.addColorStop(1, T.skyOut);
  ctx.fillStyle = g; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);

  // Milky Way, layered and softened
  ctx.save(); ctx.filter = 'blur(7px)';
  for (const band of SKY.milky) {
    ctx.fillStyle = 'rgba(190,205,255,' + (0.035 + band.level * 0.012).toFixed(3) + ')';
    ctx.beginPath();
    for (const ring of band.rings) {
      let pen = false;
      for (const p of ring) { if (!p) { pen = false; continue; } const [x, y] = P(p); if (!pen) { ctx.moveTo(x, y); pen = true; } else ctx.lineTo(x, y); }
      ctx.closePath();
    }
    ctx.fill('evenodd');
  }
  ctx.restore();

  // altitude rings at 30 and 60 degrees
  ctx.setLineDash([4, 10]); ctx.strokeStyle = 'rgba(255,255,255,.10)'; ctx.lineWidth = 1.2;
  [30, 60].forEach((alt) => { const r = Math.tan((90 - alt) / 2 * Math.PI / 180) * R; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke(); });
  ctx.setLineDash([]);

  // constellation figures
  ctx.strokeStyle = 'rgba(214,224,255,.42)'; ctx.lineWidth = 1.7; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  for (const line of SKY.lines) { ctx.beginPath(); line.forEach((p, i) => { const [x, y] = P(p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); }

  // stars
  const sorted = SKY.stars.slice().sort((a, b) => b[2] - a[2]);
  for (const [sx, sy, mag, bv] of sorted) {
    const [x, y] = P([sx, sy]);
    const r = 1.0 + Math.pow(Math.max(0, 6.3 - mag), 1.6) * 0.24;
    const [cr, cg, cb] = starColor(bv);
    if (mag < 2.2) {
      const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 4.2);
      glow.addColorStop(0, 'rgba(' + cr + ',' + cg + ',' + cb + ',.35)');
      glow.addColorStop(1, 'rgba(' + cr + ',' + cg + ',' + cb + ',0)');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, r * 4.2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = 'rgba(' + cr + ',' + cg + ',' + cb + ',' + (mag > 5 ? 0.75 : 1) + ')';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  // labels never overlap: planets first, then bright stars, then constellations
  const placed = [];
  const free = (b) => placed.every((q) => b.x1 < q.x0 || b.x0 > q.x1 || b.y1 < q.y0 || b.y0 > q.y1) && Math.hypot((b.x0 + b.x1) / 2 - cx, (b.y0 + b.y1) / 2 - cy) < R - 30;
  for (const p of SKY.planets.filter((q) => q.x != null)) { const [x, y] = P([p.x, p.y]); placed.push({ x0: x - 150, x1: x + 22, y0: y - 34, y1: y + 34 }); }
  ctx.font = "500 21px 'Onest'"; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  for (const [nx, ny, name] of SKY.starNames) {
    const [x, y] = P([nx, ny]); const w = ctx.measureText(name).width;
    for (const [dx, dy] of [[13, 1], [13, 24], [13, -22], [-13 - w, 1]]) {
      const b = { x0: x + dx - 3, x1: x + dx + w + 3, y0: y + dy - 13, y1: y + dy + 13 };
      if (free(b)) { placed.push(b); ctx.fillStyle = 'rgba(255,255,255,.78)'; ctx.fillText(name, x + dx, y + dy); break; }
    }
  }
  ctx.font = "italic 500 27px 'Cormorant Garamond'"; ctx.textAlign = 'center';
  for (const [nx, ny, name] of SKY.names.slice().sort((a, b) => a[3] - b[3])) {
    const [x, y] = P([nx, ny]); const w = ctx.measureText(name).width;
    for (const dy of [0, 30, -30, 60, -60]) {
      const b = { x0: x - w / 2 - 6, x1: x + w / 2 + 6, y0: y + dy - 16, y1: y + dy + 16 };
      if (free(b)) { placed.push(b); ctx.fillStyle = 'rgba(214,224,255,.55)'; ctx.fillText(name, x, y + dy); break; }
    }
  }

  // planets above the horizon
  for (const p of SKY.planets.filter((q) => q.x != null)) {
    const [x, y] = P([p.x, p.y]);
    const col = p.body === 'Mars' ? [255, 170, 130] : [255, 230, 180];
    const halo = ctx.createRadialGradient(x, y, 0, x, y, 30);
    halo.addColorStop(0, 'rgba(' + col.join(',') + ',.55)'); halo.addColorStop(1, 'rgba(' + col.join(',') + ',0)');
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(x, y, 30, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgb(' + col.join(',') + ')'; ctx.beginPath(); ctx.arc(x, y, p.body === 'Jupiter' ? 7.5 : 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(' + col.join(',') + ',.8)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(' + col.join(',') + ',.95)'; ctx.font = "600 22px 'Onest'"; ctx.textAlign = 'right';
    ctx.fillText(p.name, x - 22, y + (p.body === 'Mars' ? -12 : 14));
  }
  ctx.restore();

  // text block
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = T.title; ctx.font = "600 98px 'Cormorant Garamond'";
  ctx.fillText('Небо над Сергиевым Посадом', cx, 1745);
  ctx.fillStyle = T.divider; ctx.fillRect(cx - 40, 1800, 80, 2);
  ctx.fillStyle = T.sub; ctx.font = "500 44px 'Onest'";
  ctx.fillText('6 марта 1989  ·  23:15', cx, 1880);
  ctx.fillStyle = T.meta; ctx.font = "400 31px 'Onest'";
  ctx.fillText('56°19′ с. ш.  ·  38°08′ в. д.', cx, 1938);
  ctx.fillStyle = T.sub; ctx.font = "italic 500 46px 'Cormorant Garamond'";
  ctx.fillText('Так выглядело небо в минуту, когда родился Михаил', cx, 2052);
  ctx.fillStyle = T.meta; ctx.font = "400 27px 'Onest'";
  ctx.fillText('На западе рядом Юпитер и Марс. Луна под горизонтом, наутро новолуние.', cx, 2112);

  // footer with the app mark
  const lg = document.getElementById('logo');
  ctx.globalAlpha = themeName === 'dark' ? 0.85 : 1;
  ctx.drawImage(lg, cx - 118, 2322, 40, 40);
  ctx.globalAlpha = 1;
  ctx.fillStyle = T.foot; ctx.font = "600 24px 'Onest'"; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText('NEBO  ·  небо в день рождения', cx - 66, 2343);
  return c.toDataURL('image/png');
};
</script><img id="logo" src="${logo}" style="display:none"></body></html>`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1754, height: 2480 } });
  await page.setContent(html);
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all(["600 98px 'Cormorant Garamond'", "italic 500 27px 'Cormorant Garamond'", "500 44px 'Onest'", "400 31px 'Onest'", "600 22px 'Onest'"].map((f) => document.fonts.load(f, 'АБВ abc'))); });
  fs.mkdirSync(outDir, { recursive: true });
  for (const t of ['light', 'dark']) {
    const url = await page.evaluate((th) => window.draw(th), t);
    fs.writeFileSync(path.join(outDir, 'poster_' + t + '.png'), Buffer.from(url.split(',')[1], 'base64'));
  }
  await browser.close();
  console.log('done');
})();
