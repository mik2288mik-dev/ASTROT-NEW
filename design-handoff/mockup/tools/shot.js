// Screenshot canvas boards from the local preview server.
// usage: node shot.js <outDir> <Board[:scrollY][@waitMs]> ...
// Prints missing /_blob ids and page errors so they can be fixed.
const fs = require('fs');
const path = require('path');
const { chromium } = require('/opt/node-tools/node_modules/playwright');

const out = process.argv[2];
const boards = process.argv.slice(3);
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const missing = new Set();
  for (const spec of boards) {
    const m = /^([^:@]+)(?::(\d+))?(?:@(\d+))?$/.exec(spec);
    const name = m[1], scroll = Number(m[2] || 0), wait = Number(m[3] || 2500);
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('response', (r) => { const u = r.url(); if (u.includes('/_blob/') && r.status() === 404) missing.add(u.split('/_blob/')[1]); });
    await page.goto('http://localhost:8770/project/' + name + '.dc.html', { waitUntil: 'load' });
    await page.waitForTimeout(wait);
    if (scroll) {
      await page.evaluate((y) => { const els = [...document.querySelectorAll('*')].filter((e) => { const s = getComputedStyle(e); return (s.overflowY === 'auto' || s.overflowY === 'scroll') && e.scrollHeight > e.clientHeight; }); els.forEach((e) => { e.scrollTop = y; }); }, scroll);
      await page.waitForTimeout(600);
    }
    await page.screenshot({ path: path.join(out, name + (scroll ? '_' + scroll : '') + '.png') });
    if (errors.length) console.log(name, 'ERRORS:', errors.slice(0, 5).join(' | '));
    await page.close();
  }
  await browser.close();
  console.log('missing blobs:', [...missing].join(' '));
})();
