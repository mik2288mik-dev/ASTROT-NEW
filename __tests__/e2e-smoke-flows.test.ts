import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('E2E smoke flow contracts', () => {
  it('startup resolves an explicit app session before profile and chart work', () => {
    const app = read('App.tsx');
    expect(app).toContain('waitForTelegramInitData');
    expect(app).toContain('getAuthSessionMode');
    expect(app).toContain('loginWithTelegram');
    expect(app).toContain('startGuestAccount');
    expect(app).toContain('const canonicalUserId = String(storedProfile.id)');
    expect(app).not.toContain('buildMinimalStartupProfile');
    expect(app).toContain('getOrCalculateChart');
    expect(app).toContain('CACHE_ONLY_PREWARM_BUDGET_MS');
  });

  it('chart creation reads and calculates through /api/charts', () => {
    const chartService = read('services/chartService.ts');
    const astrologyService = read('services/astrologyService.ts');
    // chartService reads charts via /api/charts and uses the primary upsert mode
    // on the same route for onboarding and repair flows.
    expect(chartService).toContain('/api/charts');
    expect(chartService).toContain('primary: true');
    expect(chartService).not.toContain('/api/astrology/natal-chart');
    expect(astrologyService).toContain('/api/charts');
    expect(astrologyService).not.toContain('/api/astrology/natal-chart');
  });

  it('keeps Zodiac chart-free and slices personal forecast access server-side', () => {
    const signDaily = read('pages/api/content/horoscope/sign-daily.ts');
    const signLocks = read('lib/horoscope/signGenerationLock.ts');
    const personal = read('pages/api/content/forecast/personal.ts');
    expect(signDaily).toContain("buildSignHoroscopeLockKey('day'");
    expect(signLocks).toContain("period === 'day' ? 'free' : 'premium'");
    expect(personal).toContain('getPremiumEntitlementState');
    expect(personal).toContain('slicePersonalForecastForAccess');
    expect(personal).toContain("accessTier: isPremium ? 'premium' : 'free'");
  });

  it('natal Premium gate is chart-first and Premium-second', () => {
    const access = read('lib/accessMatrix.ts');
    expect(access).toContain("{ key: 'natal_basic', tier: 'free', needsChart: true");
    expect(access).toContain("{ key: 'natal_love', tier: 'pro', needsChart: true");
    expect(access).toContain("status: 'needs_chart'");
    expect(access).toContain("status: 'needs_premium'");
  });

  it('payment activation routes remain wired', () => {
    const createInvoice = read('pages/api/telegram/create-invoice.ts');
    const activate = read('pages/api/subscriptions/activate.ts');
    expect(createInvoice).toContain('premium_week');
    expect(createInvoice).toContain('createInvoiceLink');
    expect(activate).toContain('activatePremium');
    // NOTE: admin notification self-test route was part of the legacy admin (removed in
    // the admin v2 rebuild) and will return with the Communications phase. The live
    // notification scheduler is in-process and unaffected.
  });

  it('production observability is exposed through health checks for notification and error signals', () => {
    const health = read('pages/api/health.ts');
    const observability = read('lib/productionObservability.ts');
    expect(health).toContain('getProductionObservabilitySnapshot');
    expect(observability).toContain('scheduled_notifications');
    expect(observability).toContain('STALE_NOTIFICATION_DISPATCH_LOCKS');
    expect(observability).toContain('NOTIFICATION_FAILURES_LAST_24H');
    expect(observability).toContain('getRecentErrors');
  });

  it('Telegram Mini App manual QA checklist is tracked for release acceptance', () => {
    const docs = read('docs/NEXT_TASK_CONTEXT.md');
    expect(docs).toContain('safe areas');
    expect(docs).toContain('back/swipe');
    expect(docs).toContain('deep links');
    expect(docs).toContain('slow network');
  });
});
