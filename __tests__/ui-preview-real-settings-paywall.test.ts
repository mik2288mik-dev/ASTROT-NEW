import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('UI Preview production settings and paywall adapters', () => {
  it('renders the real Settings and Paywall views instead of preview-only copies', () => {
    const preview = read('components/ui-preview/UiPreviewApp.tsx');

    expect(preview).toContain("import { Settings } from '../../views/Settings'");
    expect(preview).toContain("import { Paywall } from '../../views/Paywall'");
    expect(preview).toContain('<Settings');
    expect(preview).toContain('<Paywall');
    expect(preview).toContain('uiPreview={UI_PREVIEW_SETTINGS}');
    expect(preview).toContain('UI_PREVIEW_PAYWALL_PLANS');
    expect(preview).toContain("scenario.screen === 'menu' || scenario.screen === 'settings'");
    expect(preview).not.toContain('ui-preview-settings-group');
    expect(preview).not.toContain('ui-preview-paywall-mark');
  });

  it('keeps settings storage, session, auth, OAuth and API effects inert in Preview', () => {
    const settings = read('views/Settings.tsx');

    expect(settings).toContain("process.env.NODE_ENV === 'development' ? uiPreview : undefined");
    expect(settings).toContain('previewFixture ? 0 : hasActivePremium(profile)');
    expect(settings).toContain('if (previewFixture) return;');
    expect(settings).toContain('!previewFixture && hasTelegramMiniAppContext()');
    expect(settings).toContain('В Preview вход и отправка кода отключены.');
    expect(settings).toContain('В Preview удаление аккаунта отключено.');
  });

  it('uses synthetic plans, blocks payment actions and shares the AppTopBar', () => {
    const paywall = read('views/Paywall.tsx');
    const fixtures = read('components/ui-preview/uiPreviewFixtures.ts');

    expect(paywall).toContain("process.env.NODE_ENV === 'development' ? uiPreview : undefined");
    expect(paywall).toContain('Object.fromEntries(previewFixture.plans.map');
    expect(paywall).toContain('Оплата отключена в локальном Preview.');
    expect(paywall).toContain('Восстановление покупок отключено в локальном Preview.');
    expect(paywall).toContain('<AppTopBar title="Premium" onBack={onClose} />');
    expect(paywall).not.toContain('className="pw2-topbar"');
    expect(fixtures).toContain('UI_PREVIEW_SETTINGS');
    expect(fixtures).toContain('UI_PREVIEW_PAYWALL_PLANS');
  });
});
