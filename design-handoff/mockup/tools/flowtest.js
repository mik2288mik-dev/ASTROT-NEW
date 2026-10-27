// Tarot and questions flows in the full app board.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8770/project/Today.dc.html', { waitUntil: 'load' });
  await p.waitForTimeout(2000);
  const state = async (label) => {
    const r = await p.evaluate(() => {
      const h1 = document.querySelector('h1'); const segOn = [...document.querySelectorAll('button')].filter((x) => getComputedStyle(x).boxShadow.includes('rgba(0, 0, 0, 0.08)')).map((x) => x.textContent.trim());
      const tab = [...document.querySelectorAll('nav button')].map((x) => [x.textContent.trim(), getComputedStyle(x).backgroundColor]);
      const sc = [...document.querySelectorAll('div')].find((d) => getComputedStyle(d).overflowY === 'auto' && d.scrollHeight > d.clientHeight);
      return { h1: h1 ? h1.textContent : '', seg: segOn.join(','), scroll: sc ? sc.scrollTop : -1, title: (document.querySelector('strong') || {}).textContent };
    });
    console.log(label.padEnd(34), JSON.stringify(r));
  };
  await state('today');
  await p.locator('button', { hasText: 'Расклады на любой вопрос' }).first().click(); await p.waitForTimeout(700);
  await state('after tarot tile');
  await p.locator('button', { hasText: 'Перемешать колоду' }).first().click(); await p.waitForTimeout(700);
  await state('after shuffle cta (free: buy popup?)');
  const scrim = p.locator('button[aria-label="Закрыть"]'); if (await scrim.count()) { await scrim.click({ position: { x: 5, y: 5 } }); await p.waitForTimeout(400); }
  await p.locator('button', { hasText: 'Посмотреть пример' }).first().click(); await p.waitForTimeout(900);
  await state('example reading');
  await p.locator('button[aria-label="Назад"]').click(); await p.waitForTimeout(700);
  await state('back from reading');
  await p.locator('nav button', { hasText: 'Моя карта' }).click(); await p.waitForTimeout(300);
  await p.locator('button', { hasText: /^Карта$/ }).first().click(); await p.waitForTimeout(700);
  await state('tab Карта');
  await p.locator('button', { hasText: 'Какая работа мне подходит?' }).first().scrollIntoViewIfNeeded(); await p.waitForTimeout(500);
  await state('scrolled to questions');
  await p.locator('button', { hasText: 'Какая работа мне подходит?' }).first().click(); await p.waitForTimeout(900);
  await state('asked a chip');
  await p.locator('button[aria-label="Назад"]').click(); await p.waitForTimeout(700);
  await state('back from answer');
  if (errs.length) console.log('ERRORS', errs.join(' | '));
  await b.close();
})();
