// Frames of the loading scene at several moments (animations run in real time).
const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8770/project/Skeleton.dc.html'); await p.waitForTimeout(1500);
  for (const [i, wait] of [[0, 0], [1, 1300], [2, 2100], [3, 2400]].entries()) {
    await p.waitForTimeout(wait[1]);
    await p.screenshot({ path: 'shots/load_' + i + '.png' });
  }
  console.log('errors', errs.join(' | ') || 'none');
  await b.close();
})();
