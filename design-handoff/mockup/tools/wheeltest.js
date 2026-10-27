// Click points on the natal wheel and print which card opens. usage: node wheeltest.js <Board> [shotDir]
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const board = process.argv[2] || 'Natal';
const shotDir = process.argv[3] || '';
const NAT = { sun: 346.2, moon: 333.3, mercury: 324.1, venus: 338.9, mars: 57.3, jupiter: 59.4, saturn: 282.2, uranus: 274.9, neptune: 282.0, pluto: 225.1 };
const ASC = 217.0;
const keys = Object.keys(NAT);
const order = keys.slice().sort((a, b) => NAT[a] - NAT[b]);
const rad = {}; let last = -99, lvl = 0;
order.forEach((k) => { const l = NAT[k]; lvl = l - last < 8 ? lvl + 1 : 0; rad[k] = 118 - (lvl % 3) * 18; last = l; });
const xy = (lon, r) => { const a = (180 + lon - ASC) * Math.PI / 180; return [175 + r * Math.cos(a), 175 - r * Math.sin(a)]; };
const targets = [
  ['sun', xy(NAT.sun, rad.sun)], ['venus', xy(NAT.venus, rad.venus)], ['pluto', xy(NAT.pluto, rad.pluto)], ['jupiter', xy(NAT.jupiter, rad.jupiter)],
  ['house 4 (empty spot)', xy(300, 100)], ['house 10', xy(160, 110)], ['sign Лев', xy(135, 156)], ['sign Рыбы', xy(350, 160)],
  ['centre', [175, 175]], ['MC label', null], ['ASC label', null],
];
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('http://localhost:8770/project/' + board + '.dc.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const btn = page.locator('button[aria-label^="Натальная карта"]');
  const box = await btn.boundingBox();
  const k = box.width / 350;
  for (const [name, pt0] of targets) {
    let pt = pt0;
    if (!pt) {
      const lbl = name.startsWith('MC') ? 'MC' : 'ASC';
      const sp = page.locator('span', { hasText: new RegExp('^' + lbl + '$') }).first();
      const b = await sp.boundingBox();
      pt = [(b.x + b.width / 2 - box.x) / k, (b.y + b.height / 2 - box.y) / k];
    }
    await page.mouse.click(box.x + pt[0] * k, box.y + pt[1] * k);
    await page.waitForTimeout(500);
    const info = await page.evaluate(() => {
      const scrim = document.querySelector('button[aria-label="Закрыть"]');
      if (!scrim) return null;
      const card = scrim.nextElementSibling;
      const over = card.querySelector('span[style*="text-transform: uppercase"]');
      const title = card.querySelector('strong');
      const steps = [...card.querySelectorAll('b')].map((b) => b.textContent + ': ' + (b.nextElementSibling ? b.nextElementSibling.textContent : ''));
      return { over: over ? over.textContent : '', title: title ? title.textContent : '', steps, text: card.innerText.slice(0, 900) };
    });
    console.log('==', name, '->', info ? (info.over + ' | ' + info.title) : 'NO POPUP');
    if (info && process.env.FULL) console.log(info.text.replace(/\n+/g, ' / '));
    if (info && shotDir) await page.screenshot({ path: shotDir + '/' + board + '_' + name.replace(/[^a-zA-Zа-яА-Я0-9]+/g, '_') + '.png' });
    if (info) { await page.locator('button[aria-label="Закрыть"]').click({ position: { x: 5, y: 5 } }); await page.waitForTimeout(350); }
  }
  if (errors.length) console.log('ERRORS', errors.join(' | '));
  await browser.close();
})();
