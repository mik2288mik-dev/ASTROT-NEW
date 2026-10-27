// Screenshot one wide board. usage: node shotwide.js <Board> <w> <h> <out>
const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const [name, w, h, out] = process.argv.slice(2);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: Number(w), height: Number(h) }, deviceScaleFactor: 1 });
  const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto('http://localhost:8770/project/' + name + '.dc.html', { waitUntil: 'load' });
  await p.waitForTimeout(2500);
  await p.screenshot({ path: out });
  if (errors.length) console.log('ERRORS', errors.join(' | '));
  await b.close();
})();
