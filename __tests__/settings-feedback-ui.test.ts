import fs from 'fs';
import path from 'path';
import { normalizeMobileBuildIdentity } from '../services/mobileBuildIdentity';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('Settings feedback flow', () => {
  it('keeps support inside Settings with the complete ticket categories', () => {
    const settings = read('views/Settings.tsx');

    expect(settings).toContain("| 'feedback'");
    expect(settings).toContain("case 'feedback'");
    expect(settings).toContain("openSettingsScreen('feedback')");
    expect(settings).toContain("apiFetch('/api/support/ticket'");
    expect(settings).not.toContain("href={'mailto:' + releaseConfig.supportEmail}");
    expect(settings).toContain("{ value: 'problem', ru: 'Ошибка'");
    expect(settings).toContain("{ value: 'idea', ru: 'Пожелание'");
    expect(settings).toContain("{ value: 'payment', ru: 'Оплата'");
    expect(settings).toContain("{ value: 'question', ru: 'Вопрос'");
    expect(settings).toContain("{ value: 'other', ru: 'Другое'");
    expect(settings).toContain('Новое обращение');
  });

  it('validates accessible fields without exposing a diagnostics control', () => {
    const settings = read('views/Settings.tsx');
    const styles = read('styles/settingsEditorial.css');

    expect(settings).toContain('minLength={10}');
    expect(settings).toContain('maxLength={4000}');
    expect(settings).toContain('type="email"');
    expect(settings).toContain('aria-invalid={!!feedbackErrors.message}');
    expect(settings).toContain('aria-invalid={!!feedbackErrors.email}');
    expect(settings).toContain('aria-live="polite"');
    expect(settings).not.toContain('settings-feedback-toggle');
    expect(settings).not.toContain('Приложить технические данные');
    expect(settings).not.toContain('Attach technical details');
    expect(settings).not.toContain('feedbackDiagnostics');
    expect(settings).not.toContain('setFeedbackDiagnostics');
    expect(settings).not.toContain('getMobileBuildIdentity()');
    expect(settings).toContain("closest<HTMLElement>('.lumia-main-scroll')");
    expect(settings).toContain("scrollRoot?.scrollTo({ top: 0, left: 0, behavior: 'auto' })");
    expect(settings).toContain("window.scrollTo({ top: 0, left: 0, behavior: 'auto' })");
    expect(settings).toContain('Сообщение получит команда NEBO. Не указывай пароли, коды, платёжные данные, данные рождения или сведения о здоровье.');
    expect(styles).toContain('.settings-feedback-categories label > span');
    expect(styles).toContain('min-height: 44px');
    expect(styles).toContain('.settings-feedback-submit');
  });

  it('uses a neutral email address in the local preview fixture', () => {
    const fixtures = read('components/ui-preview/uiPreviewFixtures.ts');

    expect(fixtures).toContain("email: 'preview@example.test'");
    expect(fixtures).not.toContain('alina.preview@example.test');
  });

  it('normalizes only public build identity fields', () => {
    expect(normalizeMobileBuildIdentity(
      { versionName: '1.0.2', versionCode: '5', channel: 'rustore' },
      { android: true, fallbackChannel: 'development' },
    )).toEqual({
      appVersion: '1.0.2',
      versionCode: 5,
      platform: 'android',
      distributionChannel: 'rustore',
    });

    const fallback = normalizeMobileBuildIdentity(
      { versionName: ' '.repeat(40), versionCode: 'not-a-number', channel: 'unknown' },
      { android: false, fallbackChannel: 'google_play' },
    );
    expect(fallback).toEqual({ platform: 'web', distributionChannel: 'google_play' });
    expect(fallback).not.toHaveProperty('deviceModel');
    expect(fallback).not.toHaveProperty('osVersion');
    expect(fallback).not.toHaveProperty('logs');
  });
});
