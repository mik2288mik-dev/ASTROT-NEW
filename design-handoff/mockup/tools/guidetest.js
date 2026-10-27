// Open guide tabs and tap rows; print the cards. usage: node guidetest.js
const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('http://localhost:8770/project/Guide.dc.html', { waitUntil: 'load' });
  await page.waitForTimeout(2200);
  const card = async () => page.evaluate(() => { const sc = document.querySelector('button[aria-label="Закрыть"]'); return sc ? sc.nextElementSibling.innerText.replace(/\n+/g, ' / ').slice(0, 700) : 'NO POPUP'; });
  const close = async () => { const sc = page.locator('button[aria-label="Закрыть"]'); if (await sc.count()) { await sc.click({ position: { x: 5, y: 5 } }); await page.waitForTimeout(300); } };
  for (const [tab, row] of [['Планеты', 'Венера'], ['Знаки', 'Скорпион'], ['Дома', '7 дом'], ['Аспекты', 'Трин'], ['Точки', 'Северный узел'], ['Точки', 'Десцендент']]) {
    await page.getByRole('button', { name: tab, exact: true }).first().click();
    await page.waitForTimeout(400);
    await page.locator('button', { hasText: row }).first().click();
    await page.waitForTimeout(450);
    console.log('==', tab, '/', row, '->', await card());
    if (tab === 'Точки' && row === 'Северный узел') await page.screenshot({ path: 'shots/r/GuideNode.png' });
    await close();
  }
  await page.getByRole('button', { name: 'Точки', exact: true }).first().click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'shots/r/GuidePoints.png' });
  if (errors.length) console.log('ERRORS', errors.join(' | '));
  await browser.close();
})();
