import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('chart onboarding and lazy sections', () => {
  it('shows a create-chart CTA instead of auto-starting onboarding from chart navigation', () => {
    const chart = read('views/v2/NatalMagazine.tsx');
    const app = read('App.tsx');
    expect(chart).toContain('Рассчитай натальную карту');
    expect(chart).toContain('Для расчёта нужны дата, время и место рождения');
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
    expect(app).toContain('const safeUserId = String(currentProfileId)');
    expect(app).toContain('const isGuestOnboarding = profile?.isGuest === true || isGuestUserId(safeUserId)');
    expect(app).toContain('id: safeUserId');
    expect(app).not.toContain('id: String(newProfile.id)');
    expect(app).toContain('isPremium: isGuestOnboarding');
    expect(app).toContain('trialStartedAt: isGuestOnboarding ? null');
    expect(app).toContain('await saveProfile(fullProfile)');
    expect(app).toContain('await getOrCalculateChart(pendingProfile)');
  });

  it('keeps the canonical server profile authoritative and reports a missing session clearly', () => {
    const app = read('App.tsx');
    expect(app).toContain('The server profile is the canonical account');
    expect(app).toContain('Cannot complete onboarding without an authenticated account');
    expect(app).not.toContain('hasTelegramUserId ? tgId : currentProfileId');
    expect(app).not.toContain('const safeUserId = String(newProfile.id)');
  });

  it('keeps one free basic identity and lazy-loads paid sections on open', () => {
    const shared = read('lib/natalHumanShared.ts');
    const semantics = read('lib/natalSemanticCompiler.ts');
    const report = read('components/NatalReading/HumanReport.tsx');
    const prompt = read('lib/natalHumanInterpretation.ts');
    expect(semantics).toContain("'base_portrait'");
    expect(semantics).toContain("'work_money'");
    expect(shared).toContain('FREE_NATAL_SECTION_KEYS');
    expect(report).toContain('loadHumanPaidSection');
    expect(report).toContain('getCachedHumanPaidSection');
    expect(prompt).toContain('natalPromptPayload({ ...compilation, sections: plans })');
    expect(semantics).toContain('requiredBlocks');
    expect(prompt).toContain('validateGeneratedNatalPayload');
    expect(prompt).not.toContain('raw.freeSections');
    expect(prompt).toContain("contentVariant: 'full'");
  });

  it('uses direct product names and exposes the personal forecast from Zodiac', () => {
    const shared = read('lib/natalHumanShared.ts');
    const horoscope = read('views/v2/HoroscopeReader.tsx');
    for (const title of [
      'Внутренние реакции',
      'Общение',
      'Отношения подробно',
      'Конфликты',
      'Работа',
      'Деньги',
      'Способности',
      'Главные противоречия',
      'Важные аспекты',
    ]) {
      expect(shared).toContain(title);
    }
    expect(horoscope).toContain('onOpenPersonalForecast');
    expect(horoscope).toContain('Личный гороскоп');
  });

  it('passes the primary chart ID and report when no saved chart is active', () => {
    const app = read('App.tsx');
    expect(app).toContain("const isSavedPersonChartView = activeChartSubject?.subject_type === 'saved_person'");
    expect(app).toContain('const isPrimaryChartView = !isSavedPersonChartView');
    expect(app).toContain('const effectiveChartId = activeChartId ?? primaryChartId ?? undefined');
    expect(app).toContain('chartId={effectiveChartId}');
    expect(app).toContain('chartSubject={activeChartSubject}');
    expect(app).toContain('preloadedReport={isPrimaryChartView ? preloadedHumanReport : null}');
  });

  it('keeps chart content visible while the human-base reading loads or fails', () => {
    const report = read('components/NatalReading/HumanReport.tsx');
    expect(report).not.toContain('if (loading) {');
    expect(report).toContain('data-testid="human-report-loading-area"');
    expect(report).toContain('<TechnicalDetails chartData={chartData} />');
    expect(report).toContain("report?.userName || subjectName || 'Твоя карта'");
    expect(report).toContain('Интерпретация сейчас недоступна');
  });
});
