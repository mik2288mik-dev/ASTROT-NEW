import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('chart onboarding and lazy sections', () => {
  it('shows a create-chart CTA instead of auto-starting onboarding from chart navigation', () => {
    const chart = read('views/v2/NatalMagazine.tsx');
    const app = read('App.tsx');
    expect(chart).toContain('Соберём твою натальную карту');
    expect(chart).toContain('Для расчёта нужны дата, время и место рождения.');
    expect(chart).toContain('Ввести данные');
    expect(chart).toContain('onCreateChart');
    expect(app).not.toContain("if (newView === 'chart' && getFeatureAccess('natal_basic').status === 'needs_chart')");
    expect(app).toContain("onCreateChart={() => openNatalSetupOnboarding('chart', 'chart')}");
  });

  it('returns completed chart onboarding to the requested target', () => {
    const app = read('App.tsx');
    expect(app).toContain("const targetView = onboardingTargetViewRef.current || 'dashboard'");
    expect(app).toContain("setDashboardPeriod('day')");
    expect(app).toContain('setView(targetView)');
    expect(app).toContain('isSetup: true');
    expect(app).toContain('await saveProfile(canonicalFullProfile)');
    expect(app).toContain('buildNatalChartCacheKey(canonicalFullProfile)');
  });

  it('coalesces the full chart read/calculate flow and never returns a stale lock-loser chart', () => {
    const service = read('services/chartService.ts');
    const route = read('pages/api/charts/index.ts');
    expect(service.indexOf('calculationInFlight.set(requestKey,request)'))
      .toBeLessThan(service.indexOf('return request;'));
    expect(service).toContain('const requestKey=buildNatalChartCacheKey(profile)');
    expect(service).toContain('natalChartMatchesProfile(stored,profile)');
    expect(route).toContain('await ensureCanonicalPrimaryChart(common)');
    expect(route).not.toContain('tryAcquireLock');
  });

  it('guards every direct primary-chart refresh against a changed profile identity', () => {
    const app = read('App.tsx');
    expect(app).toContain('natalChartMatchesProfile');
    expect(app.match(/natalChartMatchesProfile\(freshChart, targetProfile\)/g)).toHaveLength(3);
    expect(app).toContain('freshChart = await getOrCalculateChart(');
  });

  it('lets a signed web guest complete onboarding without trusting newProfile identity or granting trial', () => {
    const app = read('App.tsx');
    expect(app).toContain('const currentProfileId = profile?.id');
    expect(app).toContain('const safeUserId = String(currentProfileId)');
    expect(app).toContain('const isGuestOnboarding = profile?.isGuest === true;');
    expect(app).toContain('id: safeUserId');
    expect(app).not.toContain('id: String(newProfile.id)');
    expect(app).toContain('isPremium: isGuestOnboarding');
    expect(app).toContain('trialStartedAt: isGuestOnboarding ? null');
    expect(app).toContain('await saveProfile(canonicalFullProfile)');
    expect(app).toContain('const generatedChart = await getOrCalculateChart(');
    expect(app).toContain('primaryChartRequestGuardRef.current.isCurrent(onboardingChartToken)');
  });

  it('keeps the canonical server profile authoritative and reports a missing session clearly', () => {
    const app = read('App.tsx');
    expect(app).toContain('The server profile is the canonical account');
    expect(app).toContain('Cannot complete onboarding without an authenticated account');
    expect(app).not.toContain('hasTelegramUserId ? tgId : currentProfileId');
    expect(app).not.toContain('const safeUserId = String(newProfile.id)');
  });

  it('keeps one free basic identity and loads the paid report only for Premium', () => {
    const shared = read('lib/natalHumanShared.ts');
    const semantics = read('lib/natalSemanticCompiler.ts');
    const report = read('components/NatalReading/HumanReport.tsx');
    const prompt = read('lib/natalHumanInterpretation.ts');
    expect(semantics).toContain("'base_portrait'");
    expect(semantics).toContain("'work_money'");
    expect(shared).toContain('FREE_NATAL_SECTION_KEYS');
    expect(report).toContain('ensureHumanBaseReport');
    expect(report).toContain('ensureHumanPremiumReport');
    expect(report).toContain('getHumanPremiumReportCached');
    expect(report).toContain('if (!isPremium || !userId || !report)');
    expect(prompt).toContain('natalPromptPayload({ ...compilation, sections: plans })');
    expect(semantics).toContain('requiredBlocks');
    expect(prompt).toContain('validateGeneratedNatalPayload');
    expect(prompt).not.toContain('raw.freeSections');
    expect(prompt).toContain("contentVariant: 'full'");
  });

  it('uses direct product names and exposes personal and Zodiac forecasts in navigation', () => {
    const shared = read('lib/natalHumanShared.ts');
    const navigation = read('components/lumia-ui/LumiaBottomTabBar.tsx');
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
    expect(navigation).toContain("data-nav-id=\"personal\"");
    expect(navigation).toContain('Личный гороскоп');
    expect(navigation).toContain("data-nav-id=\"zodiac\"");
    expect(navigation).toContain('Гороскоп по знакам');
  });

  it('passes the primary chart ID and report when no saved chart is active', () => {
    const app = read('App.tsx');
    expect(app).toContain("const isSavedPersonChartView = activeChartSubject?.subject_type === 'saved_person'");
    expect(app).toContain('const isPrimaryChartView = !isSavedPersonChartView');
    expect(app).toContain('const effectiveChartId = activeChartId ?? primaryChartId ?? undefined');
    expect(app).toContain('chartId={effectiveChartId}');
    expect(app).toContain('chartSubject={activeChartSubject}');
    expect(app).toContain('preloadedReport={isPrimaryChartView ? preloadedHumanReport : null}');
    expect(app).toContain('PRIMARY_CHART_NAVIGATION_VIEWS.has(newView)');
    expect(app).toContain("'dashboard',");
    expect(app).toContain("'horoscope',");
    expect(app).toContain("'synastry',");
    expect(app).toContain("'chart',");
    expect(app).toContain('setActiveChartId(undefined)');
    expect(app).toContain('setChartData(primaryChartDataRef.current)');
  });

  it('keeps chart content visible while the human-base reading loads or fails', () => {
    const report = read('components/NatalReading/HumanReport.tsx');
    expect(report).not.toContain('if (loading) {');
    expect(report).toContain('data-testid="human-report-loading-area"');
    expect(report).toContain('<TechnicalDetails chartData={chartData} language={language} />');
    expect(report).toContain("subjectName || report?.userName || (language === 'ru' ? 'Твоя карта' : 'Your chart')");
    expect(report).toContain('Интерпретация сейчас недоступна');
  });
});
