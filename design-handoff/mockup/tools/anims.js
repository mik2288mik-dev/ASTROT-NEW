// List running CSS animations on a board. usage: node anims.js Board
const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p.goto('http://localhost:8770/project/' + process.argv[2] + '.dc.html', { waitUntil: 'load' });
  await p.waitForTimeout(2000);
  const list = await p.evaluate(() => document.getAnimations().map((a) => { const el = a.effect && a.effect.target; const r = el && el.getBoundingClientRect ? el.getBoundingClientRect() : null; return [a.animationName, el ? el.tagName : '', r ? Math.round(r.width) + 'x' + Math.round(r.height) + '@' + Math.round(r.x) + ',' + Math.round(r.y) : '']; }));
  const count = {};
  list.forEach((x) => { const k = x[0] + ' ' + x[1]; count[k] = (count[k] || 0) + 1; });
  console.log(JSON.stringify(count, null, 1));
  console.log(list.filter((x) => !/nbTwinkle/.test(x[0])).slice(0, 30).map((x) => x.join(' ')).join('\n'));
  await b.close();
})();
