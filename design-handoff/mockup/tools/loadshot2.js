// Frames of the full-screen loader at several moments. usage: node loadshot2.js <Board> <outPrefix>
const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto('http://localhost:8770/project/' + process.argv[2] + '.dc.html', { waitUntil: 'load' });
  for (const t of [1500, 3400, 5600]) { await p.waitForTimeout(t === 1500 ? 1500 : (t === 3400 ? 1900 : 2200)); await p.screenshot({ path: process.argv[3] + '_' + t + '.png' }); }
  if (errors.length) console.log('ERRORS', errors.join(' | '));
  await b.close();
})();
