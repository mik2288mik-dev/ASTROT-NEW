import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('development-only UI Preview mode', () => {
  it('requires development, the public flag, the query flag, and a local hostname', () => {
    const entry = read('pages/index.tsx');

    expect(entry).toContain("process.env.NODE_ENV === 'development'");
    expect(entry).toContain("process.env.NEXT_PUBLIC_UI_PREVIEW === '1'");
    expect(entry).toContain("router.query.uiPreview === '1'");
    expect(entry).toContain("['localhost', '127.0.0.1', '::1']");
    expect(entry).toContain("ssr: false");
    expect(entry).toContain("UI_PREVIEW_BUILD_ENABLED ? 'pending' : 'app'");
    expect(entry).toContain("if (previewSurface === 'pending') return null");
    expect(entry).toContain("if (previewSurface === 'preview') return <UiPreviewApp />");
  });

  it('keeps the production Telegram SDK behavior while removing its local preview loading block', () => {
    const document = read('pages/_document.tsx');

    expect(document).toContain("process.env.NODE_ENV === 'development'");
    expect(document).toContain("process.env.NEXT_PUBLIC_UI_PREVIEW === '1'");
    expect(document).toContain('const loadTelegramAppDependencies = !publicDocument && !isUiPreviewBuild');
    expect(document).toContain('PUBLIC_ROUTES.has(ctx.pathname)');
    expect(document).toContain('{loadTelegramAppDependencies ? (');
    expect(document).toContain('<script src="https://telegram.org/js/telegram-web-app.js"></script>');
  });

  it('keeps the native Live View URL development-only', () => {
    const capacitor = read('capacitor.config.ts');

    expect(capacitor).toContain("process.env.CAPACITOR_LIVE_RELOAD === '1'");
    expect(capacitor).toContain('process.env.CAPACITOR_LIVE_URL?.trim()');
    expect(capacitor).toContain('...(liveReloadUrl ? { url: liveReloadUrl } : {})');
  });

  it('keeps all requested synthetic scenarios inside the isolated preview surface', () => {
    const preview = read('components/ui-preview/UiPreviewApp.tsx');
    const fixtures = read('components/ui-preview/uiPreviewFixtures.ts');

    [
      'onboarding',
      'zodiac-picker',
      'today',
      'week',
      'month',
      'horoscope',
      'natal',
      'natal-reading',
      'compatibility-input',
      'compatibility-signs',
      'compatibility-result',
      'settings',
      'more',
      'paywall',
      'question',
    ].forEach((screen) => expect(fixtures).toContain(`'${screen}'`));

    ['ready', 'loading', 'error', 'empty', 'offline', 'premium-locked']
      .forEach((state) => expect(fixtures).toContain(`'${state}'`));
    ['guest', 'free', 'premium']
      .forEach((access) => expect(fixtures).toContain(`'${access}'`));
    ['exact', 'approximate', 'unknown']
      .forEach((birthTime) => expect(fixtures).toContain(`'${birthTime}'`));

    expect(preview).toContain('[UI Preview] Network request blocked');
    expect(preview).toContain('data-ui-preview="true"');
    expect(preview).toContain('<NatalMagazine');
    expect(preview).toContain('<LumiaBottomTabBar');
    expect(preview).toContain('<LumiaNavigationSheet');
    expect(preview).toContain('<MoreHub');
    expect(preview).not.toContain("'services'");
    expect(preview).not.toContain("from '../../services/");
    expect(preview).not.toContain('swisseph');
  });
});
