// Scroll Today down, open the moon calendar, then go back: report scroll positions.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8770/project/Today.dc.html'); await p.waitForTimeout(2500);
  const sc = () => p.evaluate(() => { const e = [...document.querySelectorAll('.nbs')][0]; return e ? Math.round(e.scrollTop) : -1; });
  await p.evaluate(() => { const e = document.querySelector('.nbs'); e.scrollTop = 520; });
  await p.waitForTimeout(400);
  console.log('today scrolled to', await sc());
  await p.getByText('Лунные календари', { exact: false }).first().click();
  await p.waitForTimeout(1200);
  console.log('moon opened at', await sc());
  await p.screenshot({ path: 'shots/nav_moon.png' });
  await p.getByRole('button', { name: 'Назад' }).first().click();
  await p.waitForTimeout(900);
  console.log('back on today at', await sc());
  await p.screenshot({ path: 'shots/nav_back.png' });
  // tap the active tab: scrolls to the top
  await p.getByRole('button', { name: 'Сегодня' }).last().click();
  await p.waitForTimeout(1200);
  console.log('after tapping active tab', await sc());
  console.log('errors', errs.join(' | ') || 'none');
  await b.close();
})();
