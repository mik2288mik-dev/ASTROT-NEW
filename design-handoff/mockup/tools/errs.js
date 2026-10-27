const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  for (const f of process.argv.slice(2)) {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    const errs = [];
    p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
    p.on('pageerror', (e) => errs.push(String(e)));
    await p.goto('http://localhost:8770/' + f, { waitUntil: 'load' });
    await p.waitForTimeout(1500);
    console.log(f, errs.length); errs.forEach((e) => console.log('  ', e.slice(0, 160)));
    await p.close();
  }
  await b.close();
})();
