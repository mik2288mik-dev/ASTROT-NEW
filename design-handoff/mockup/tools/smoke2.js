// Load boards and report JS errors only (missing local blobs are ignored). usage: node smoke2.js Board...
const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  let bad = 0;
  for (const name of process.argv.slice(2)) {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    const errs = [];
    p.on('pageerror', (e) => errs.push(String(e)));
    p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
    await p.goto('http://localhost:8770/project/' + name + '.dc.html', { waitUntil: 'load' });
    await p.waitForTimeout(1500);
    const empty = await p.evaluate(() => document.body.innerText.trim().length < 20);
    if (errs.length || empty) { bad++; console.log('FAIL', name, empty ? '(empty)' : '', errs.slice(0, 3).join(' | ')); }
    await p.close();
  }
  console.log('checked', process.argv.length - 2, 'bad', bad);
  await b.close();
})();
