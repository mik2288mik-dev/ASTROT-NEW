import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('E2E smoke flow contracts', () => {
  it('startup and onboarding flow waits for Telegram/session identity before profile and chart work', () => {
    const app = read('App.tsx');
    expect(app).toContain('waitForTelegramInitData');
    expect(app).toContain('buildMinimalStartupProfile');
    expect(app).toContain('saveStartupProfileWithRetry');
    expect(app).toContain('getOrCalculateChart');
    expect(app).toContain('CACHE_ONLY_PREWARM_BUDGET_MS');
  });

  it('chart creation uses canonical /api/charts from client services instead of the legacy natal-chart route', () => {
    const chartService = read('services/chartService.ts');
    const astrologyService = read('services/astrologyService.ts');
    expect(chartService).toContain('/api/charts');
    expect(astrologyService).toContain('/api/charts');
    expect(chartService).not.toContain('/api/astrology/natal-chart');
    expect(astrologyService).not.toContain('/api/astrology/natal-chart');
  });

  it('horoscope smoke path keeps sign content chart-free and personal dayparts premium-gated', () => {
    const signDaily = read('pages/api/content/horoscope/sign-daily.ts');
    const daypart = read('pages/api/content/forecast/daypart.ts');
    expect(signDaily).toContain("accessTier: 'free'");
    expect(daypart).toContain('premiumRequired: true');
    expect(daypart).toContain('getPremiumEntitlementState');
  });

  it('natal Premium gate is chart-first and Premium-second', () => {
    const access = read('lib/accessMatrix.ts');
    expect(access).toContain("{ key: 'natal_basic', tier: 'free', needsChart: true");
    expect(access).toContain("{ key: 'natal_love', tier: 'pro', needsChart: true");
    expect(access).toContain("status: 'needs_chart'");
    expect(access).toContain("status: 'needs_premium'");
  });

  it('payment activation and admin notification self-test routes remain wired', () => {
    const createInvoice = read('pages/api/telegram/create-invoice.ts');
    const activate = read('pages/api/subscriptions/activate.ts');
    const selfTest = read('pages/api/admin/notifications/send-self-test.ts');
    expect(createInvoice).toContain('premium_week');
    expect(createInvoice).toContain('createInvoiceLink');
    expect(activate).toContain('activatePremium');
    expect(selfTest).toContain('sendTelegramTextMessage');
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
