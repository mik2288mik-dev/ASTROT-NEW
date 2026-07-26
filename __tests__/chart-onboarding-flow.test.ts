import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('chart onboarding and lazy sections', () => {
  it('shows a create-chart CTA instead of auto-starting onboarding from chart navigation', () => {
    const chart = read('views/v2/NatalMagazine.tsx');
    const app = read('App.tsx');
    expect(chart).toContain('Создай натальную карту');
    expect(chart).toContain('Астролог рассчитает карту по дате, времени и месту рождения');
    expect(chart).toContain('onCreateChart');
    expect(app).not.toContain("if (newView === 'chart' && getFeatureAccess('natal_basic').status === 'needs_chart')");
    expect(app).toContain("onCreateChart={() => openNatalSetupOnboarding('chart', 'chart')}");
  });

  it('returns completed chart onboarding to the requested target', () => {
    const app = read('App.tsx');
    expect(app).toContain("const targetView = isGuestOnboarding ? 'chart' : onboardingTargetViewRef.current || 'dashboard'");
    expect(app).toContain('setView(targetView)');
    expect(app).toContain('isSetup: true');
    expect(app).toContain('await saveProfile(fullProfile)');
  });

  it('lets a signed web guest complete onboarding without trusting newProfile identity or granting trial', () => {
    const app = read('App.tsx');
    expect(app).toContain('const currentProfileId = profile?.id');
    expect(app).toContain('const safeUserId = String(hasTelegramUserId ? tgId : currentProfileId)');
    expect(app).toContain('const hasGuestProfileId = isGuestUserId(currentProfileId)');
    expect(app).toContain('const isGuestOnboarding = !hasTelegramUserId');
    expect(app).toContain('id: safeUserId');
    expect(app).not.toContain('id: String(newProfile.id)');
    expect(app).toContain('isPremium: isGuestOnboarding');
    expect(app).toContain('trialStartedAt: isGuestOnboarding ? null');
    expect(app).toContain('await saveProfile(fullProfile)');
    expect(app).toContain('await getOrCalculateChart(pendingProfile)');
  });

  it('keeps Telegram identity authoritative and reports an invalid guest session clearly', () => {
    const app = read('App.tsx');
    expect(app).toContain('hasTelegramUserId ? tgId : currentProfileId');
    expect(app).toContain('Не удалось подтвердить гостевую сессию. Обнови страницу и попробуй ещё раз.');
    expect(app).not.toContain('Открой Lumia через Telegram, чтобы приложение смогло сохранить профиль и карту.');
  });

  it('keeps one free basic identity and lazy-loads paid sections on open', () => {
    const shared = read('lib/natalHumanShared.ts');
    const report = read('components/NatalReading/HumanReport.tsx');
    const prompt = read('lib/natalHumanInterpretation.ts');
    expect(shared).toContain("'base_portrait'");
    expect(report).toContain('loadHumanPaidSection');
    expect(report).toContain('getCachedHumanPaidSection');
    expect(prompt).toContain("getWordRangeInstruction('natal_section')");
    expect(prompt).toContain("contentVariant: 'living'");
  });

  it('uses human product names and exposes the personal forecast from Zodiac', () => {
    const shared = read('lib/natalHumanShared.ts');
    const horoscope = read('views/v2/HoroscopeReader.tsx');
    for (const title of ['Как ты любишь', 'Где твоя сила', 'Что тебя бесит', 'Тёмная сторона', 'Скрытые таланты', 'Деньги и решения', 'Как тебя видят другие']) {
      expect(shared).toContain(title);
    }
    expect(horoscope).toContain('onOpenPersonalForecast');
    expect(horoscope).toContain('Личный гороскоп');
  });

  it('passes the primary chart ID and report when no saved chart is active', () => {
    const app = read('App.tsx');
    expect(app).toContain('const isPrimaryChartView = activeChartId == null');
    expect(app).toContain('const effectiveChartId = activeChartId ?? primaryChartId ?? undefined');
    expect(app).toContain('chartId={effectiveChartId}');
    expect(app).toContain('preloadedReport={isPrimaryChartView ? preloadedHumanReport : null}');
  });

  it('keeps chart content visible while the human-base reading loads or fails', () => {
    const report = read('components/NatalReading/HumanReport.tsx');
    expect(report).not.toContain('if (loading) {');
    expect(report).toContain('data-testid="human-report-loading-area"');
    expect(report).toContain('<TechnicalDetails chartData={chartData} />');
    expect(report).toContain("report?.userName || profile.name || 'Твоя карта'");
    expect(report).toContain('Интерпретация сейчас недоступна');
  });

});
