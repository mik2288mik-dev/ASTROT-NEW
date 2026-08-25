import fs from 'fs';

describe('forecast delivery orchestration contract', () => {
  const personalRoute = fs.readFileSync('pages/api/content/forecast/personal.ts', 'utf8');
  const personalCache = fs.readFileSync('lib/personalForecastCache.ts', 'utf8');
  const userRoute = fs.readFileSync('pages/api/users/[id].ts', 'utf8');
  const cronRoute = fs.readFileSync('pages/api/cron/tick.ts', 'utf8');
  const rustorePayments = fs.readFileSync('lib/rustorePayments.ts', 'utf8');
  const premiumService = fs.readFileSync('services/premiumService.ts', 'utf8');
  const metrics = fs.readFileSync('lib/forecastDeliveryMetrics.ts', 'utf8');

  it('rejects Free Week and Month before cache lookup or generation', () => {
    const handler = personalRoute.slice(personalRoute.indexOf('export default async function handler'));
    const entitlementGuard = handler.indexOf("if (!entitlement.isPremium && period !== 'day')");
    expect(entitlementGuard).toBeGreaterThan(0);
    expect(entitlementGuard).toBeLessThan(handler.indexOf('getCachedPersonalForecast(cacheInput)'));
    expect(entitlementGuard).toBeLessThan(handler.indexOf('ensurePersonalForecast(cacheInput'));
  });

  it('reads, writes, and locks personal forecasts using the actual entitlement tier', () => {
    expect(personalCache).not.toContain("const CACHE_TIER = 'premium'");
    expect(personalCache).toContain('getByUser(input.userId, input.accessTier');
    expect(personalCache).toContain('accessTier: input.accessTier');
    expect(personalCache).toContain('generationTier: input.accessTier');
  });

  it('prewarms on profile completion and active app reads without adding a personal user cron', () => {
    expect(userRoute).toContain("reason:'birth_profile_completed'");
    expect(userRoute).toContain("reason:'app_open'");
    expect(userRoute).toContain('await prewarmPersonalForecastHorizon');
    expect(cronRoute).not.toContain('personalForecastPrewarm');
    expect(cronRoute).not.toContain('db.users');
  });

  it('starts Premium prewarm only from validated activation and restore paths', () => {
    expect(rustorePayments).toContain("reason: 'premium_activated'");
    expect(rustorePayments).toContain("reason: 'premium_restored'");
    expect(rustorePayments).toContain('if (entitlement.isPremium)');
    expect(premiumService).toContain("reason: 'premium_activated'");
    expect(premiumService).toContain('if (premiumUntil > new Date())');
  });

  it('emits structured counters without user identity, copy, or birth data', () => {
    expect(metrics).toContain("generationCount?: number");
    expect(metrics).toContain("signBatchGenerationCount?: number");
    expect(metrics).not.toContain('userId');
    expect(metrics).not.toContain('birthDate');
    expect(metrics).not.toContain('forecastText');
  });
});
