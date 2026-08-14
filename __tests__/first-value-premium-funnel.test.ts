import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('first value before Premium', () => {
  it('opens birth data immediately and never asks for notifications in first-run', () => {
    const onboarding = read('views/Onboarding.tsx');

    expect(onboarding).not.toContain('const STORIES');
    expect(onboarding).not.toContain("useState<'stories'|'birth'>");
    expect(onboarding).not.toContain('onb-notify');
    expect(onboarding).not.toContain('Присылать уведомления');
    expect(onboarding).toContain('Данные для расчёта');
    expect(onboarding).toContain("notificationFrequency: 'quiet'");
  });

  it('routes a new account to birth setup and opens Today without an automatic paywall', () => {
    const app = read('App.tsx');
    const startupStart = app.indexOf('if (!updatedProfile.isSetup) {');
    const startup = app.slice(
      startupStart,
      app.indexOf('const localEntry = readLocalNatalChartCache', startupStart),
    );
    const completion = app.slice(
      app.indexOf('const handleOnboardingComplete'),
      app.indexOf('const handleProfileUpdate'),
    );

    expect(startup).toContain("showStartupDashboard('onboarding')");
    expect(startup).not.toContain("showStartupDashboard('dashboard')");
    expect(completion).toContain("setDashboardPeriod('day')");
    expect(completion).toContain("setView(targetView)");
    expect(completion).not.toContain("setView('paywall')");
    expect(completion).not.toContain('триал уже активен');
  });

  it('uses one inline Today offer only after readable Free AI horoscope content', () => {
    const dashboard = read('views/Dashboard.tsx');
    const reading = read('components/PersonalForecastFeed/AiPersonalHoroscopeReading.tsx');

    expect(dashboard).toContain("onPremiumAnalytics?.('first_value_viewed'");
    expect(dashboard).toContain("onPremiumAnalytics?.('premium_promo_impression'");
    expect(dashboard).toContain("onPremiumAnalytics?.('premium_promo_clicked'");
    expect(dashboard).toContain('lockedSectionIds={lockedIds}');
    expect(reading).toContain('hasLockedContinuation');
    expect(reading).toContain('data-premium-inline-teaser="today"');
    expect(reading).toContain('Главное открыто. Остальные точные советы — в Premium.');
    expect(reading).toContain('Показать всё');
    expect(reading).toContain('onClick={onRequestPremium}');
  });

  it('suppresses Premium promotion globally for an active Premium profile', () => {
    const app = read('App.tsx');
    expect(app).toContain(
      'const premiumPromotionAllowed = firstValueReached && !hasActivePremium(profile);',
    );
    expect(app).not.toContain('canPromotePremium={firstValueReached}');
    expect(app).not.toContain('canPromotePremium: firstValueReached');
  });

  it('removes every active 14-day and trial promise from the first-value surfaces', () => {
    const source = [
      read('views/Onboarding.tsx'),
      read('views/Paywall.tsx'),
      read('views/Settings.tsx'),
      read('App.tsx'),
    ].join('\n');

    expect(source).not.toMatch(/14\s*(?:дн|day)/i);
    expect(source).not.toContain('триал уже активен');
    expect(source).not.toContain('Пробуй всё бесплатно');
  });
});
