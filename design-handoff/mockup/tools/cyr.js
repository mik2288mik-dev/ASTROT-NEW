// List visible Cyrillic text on EN/ES boards. usage: node cyr.js Board...
const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  for (const name of process.argv.slice(2)) {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    await p.goto('http://localhost:8770/project/' + name + '.dc.html', { waitUntil: 'load' });
    await p.waitForTimeout(2200);
    const found = await p.evaluate(() => {
      const out = new Set();
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n; while ((n = w.nextNode())) { const t = n.textContent.trim(); if (!/[А-Яа-яЁё]/.test(t)) continue; const el = n.parentElement; if (!el || el.closest('script,style,title')) continue; const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue; out.add(t.slice(0, 90)); }
      document.querySelectorAll('[aria-label]').forEach((el) => { const t = el.getAttribute('aria-label'); if (/[А-Яа-яЁё]/.test(t)) out.add('aria: ' + t); });
      return [...out];
    });
    console.log('==', name, found.length);
    found.forEach((t) => console.log('   ', t));
    await p.close();
  }
  await b.close();
})();
