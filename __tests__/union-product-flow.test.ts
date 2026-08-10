import fs from 'fs';
import path from 'path';
import { buildSignCompatibilityCacheKey, normalizeSignPair } from '../lib/synastry/signCompatibility';
import { getContentPolicy } from '../lib/contentMatrix';
import { APP_VOICE_VERSION } from '../lib/appVoice';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('Union product flow', () => {
  it('keeps sign compatibility free, chart-free, short and shared', () => {
    const policy = getContentPolicy('sign_compatibility');
    expect(policy.featureKey).toBe('zodiac_compatibility');
    expect(policy.words).toEqual({ min: 120, max: 180 });
    expect(policy.cacheScope).toBe('shared');
    // Базовая версия + отпечаток голоса (последний инвалидирует кэш при смене голоса).
    expect(policy.promptVersion).toBe(`sign_compatibility.v2+voice.${APP_VOICE_VERSION}`);
  });

  it('uses an order-independent sign pair cache key with language and prompt version at persistence', () => {
    expect(normalizeSignPair('libra', 'aries')).toEqual(['Aries', 'Libra']);
    expect(buildSignCompatibilityCacheKey('aries', 'libra', 'ru')).toBe(buildSignCompatibilityCacheKey('libra', 'aries', 'ru'));
    expect(buildSignCompatibilityCacheKey('aries', 'libra', 'ru')).not.toBe(buildSignCompatibilityCacheKey('aries', 'libra', 'en'));
    const source = read('lib/synastry/signCompatibility.ts');
    expect(source).toContain('prompt_version = $2');
    expect(source).toContain("content_type = 'sign_compatibility'");
  });

  it('opens Union from home without a chart or Premium gate', () => {
    const app = read('App.tsx');
    const start = app.indexOf('const openSynastryFromHome');
    const block = app.slice(start, app.indexOf('const canSwipeBack', start));
    expect(block).toContain("navigateTo('synastry'");
    expect(block).not.toContain('gateFeatureAccess');
  });

  it('shows free and Pro modes with strict chart-first then Premium gates', () => {
    const source = read('views/Synastry.tsx');
    for (const label of ['Союз', 'По знакам', 'Что между вами', 'Что вас тянет', 'Где может быть сложно', 'Как лучше общаться']) expect(source).toContain(label);
    expect(source).toContain('hasNatalChart');
    expect(source).toContain("if (!hasChart) { onCreateNatalChart?.(); return; } if (!premium) { requestPremium(); return; }");
    expect(source).toContain('Без точного времени или места рождения');
  });

  it('adds Telegram initData and rejects free full-chart requests before reading selected charts', () => {
    for (const file of ['services/astrologyService.ts', 'services/natalReadingService.ts', 'services/chartService.ts']) {
      expect(read(file)).not.toContain("headers: { 'Content-Type': 'application/json' }");
    }
    const fullApi = read('pages/api/content/synastry/extended.ts');
    expect(fullApi).toContain("code: 'NEEDS_CHART'");
    expect(fullApi.indexOf("code: 'PREMIUM_REQUIRED'")).toBeLessThan(fullApi.indexOf('db.natal_charts.getById(requestedSubjectChartId)'));
  });
});
