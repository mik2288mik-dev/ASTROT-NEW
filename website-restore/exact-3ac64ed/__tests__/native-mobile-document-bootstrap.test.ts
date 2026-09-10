import fs from 'fs';

describe('native mobile document bootstrap', () => {
  const documentSource = fs.readFileSync('pages/_document.tsx', 'utf8');
  const mobileBuildSource = fs.readFileSync('scripts/build-mobile.mjs', 'utf8');

  it('does not inject Telegram or remote font dependencies into mobile builds', () => {
    expect(documentSource).toContain("process.env.NEXT_PUBLIC_MOBILE_BUILD === '1'");
    expect(documentSource).toContain("process.env.MOBILE_BUILD === '1'");
    expect(documentSource).toContain('&& !isNativeMobileBuild');
    expect(documentSource).toContain('https://telegram.org/js/telegram-web-app.js');
    expect(documentSource).toContain('https://fonts.googleapis.com');
  });

  it('keeps server-rendered SEO routes out of the static Capacitor export and restores the source tree', () => {
    expect(mobileBuildSource).toContain("path.resolve('pages', 'sitemap.xml.ts')");
    expect(mobileBuildSource).toContain('parkServerRenderedPages()');
    expect(mobileBuildSource).toContain('restoreServerRenderedPages(parkedPages)');
    expect(mobileBuildSource).toContain('finally {');
    expect(mobileBuildSource).toContain("`${sourcePath}.mobile-excluded`");
    expect(mobileBuildSource).toContain("spawnSync(process.execPath, [nextBin, 'build']");
  });
});
