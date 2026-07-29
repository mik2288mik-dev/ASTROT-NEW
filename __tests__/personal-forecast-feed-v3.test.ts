import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const exists = (file: string) => fs.existsSync(path.join(ROOT, file));

describe('personal forecast feed V3 wiring', () => {
  it('Dashboard uses one continuous personal contract for all periods and no Zodiac forecasts', () => {
    const dashboard = read('views/Dashboard.tsx');
    const contract = read('lib/personalForecastContract.ts');

    expect(dashboard).toContain('type PersonalForecastPeriod');
    expect(dashboard).toContain('loadPersonalForecast');
    expect(dashboard).toContain('readLocalPersonalForecast');
    expect(dashboard).toContain('forecast.overview');
    expect(dashboard).toContain('forecast.sections.map');
    expect(contract).toContain('FIXED_FORECAST_SECTION_KEYS');
    expect(dashboard).not.toMatch(/DailyCanvas|periodExtras|ensurePeriodExtras/);
    expect(dashboard).not.toMatch(/SignHoroscope|selectedSign|sunSignFromDate/);
  });

  it('renders sections, navigation, explanations and evidence inside the continuous Dashboard', () => {
    const dashboard = read('views/Dashboard.tsx');
    const sectionBlock = read(
      'components/PersonalForecastFeed/ForecastSectionBlock.tsx',
    );

    expect(exists('views/PersonalForecastScreen.tsx')).toBe(false);
    expect(dashboard).toContain('ForecastSectionBlock');
    expect(dashboard).toContain('ForecastSideNavigator');
    expect(dashboard).toContain('ForecastBottomSheet');
    expect(dashboard).toContain('ForecastPromotion');
    expect(dashboard).toContain('resolvePersonalForecastVisuals');
    expect(dashboard).toContain('evidence={forecast.evidence}');
    expect(sectionBlock).toContain('expandedAnchor.evidenceIds.map');
    expect(dashboard).not.toMatch(/home-day-hero|home-sphere-card|pd-reading-card/);
    expect(dashboard).not.toContain('Показать расчёт');
  });

  it('keys retained feed state and question requests by the complete chart fingerprint', () => {
    const dashboard = read('views/Dashboard.tsx');
    const questions = read('components/PersonalForecastFeed/ForecastQuestions.tsx');
    const questionService = read('services/personalForecastQuestionService.ts');

    expect(dashboard).toContain('buildPersonalForecastChartFingerprint');
    expect(dashboard).toContain('const chartFingerprint = chartData');
    expect(dashboard).toContain('contextFingerprint={chartFingerprint}');
    expect(questions).toContain('contextFingerprint: string');
    expect(questions).toContain('contextIdentityRef.current === request.contextIdentity');
    expect(questions).toContain('requestSequenceRef.current === request.sequence');
    expect(questions).toContain('if (!isRequestCurrent(request)) return null');
    expect(questionService).toContain('chartFingerprint: string');
    expect(questionService).toContain('input.chartFingerprint');
  });

  it('uses real feed topics, hides the compact topic trigger from keyboard, and keeps info copy', () => {
    const dashboard = read('views/Dashboard.tsx');
    const feedStyles = read('styles/personalForecastFeed.css');
    const sectionBlock = read(
      'components/PersonalForecastFeed/ForecastSectionBlock.tsx',
    );
    const topicNavigation = read(
      'components/PersonalForecastFeed/ForecastTopicNavigation.tsx',
    );

    expect(dashboard).toContain('ForecastTopicNavigation');
    expect(dashboard).toContain('const title = section.title?.trim()');
    expect(dashboard).toContain('return title ? [{ id: section.id, title }] : []');
    expect(dashboard).toContain(
      'Личный прогноз на сегодня по твоей натальной карте и расчётам дня.',
    );
    expect(topicNavigation).toContain(
      'tabIndex={compactVisible ? undefined : -1}',
    );
    expect(topicNavigation).toContain("language === 'ru' ? 'Сейчас:' : 'Now:'");
    expect(topicNavigation).toContain('row.scrollTo({');
    expect(topicNavigation).not.toContain('scrollIntoView');
    expect(sectionBlock).toContain("day: 'Личный гороскоп на сегодня'");
    expect(sectionBlock).not.toContain('overviewAnchor');
    expect(sectionBlock).not.toContain('forecast-feed-info-icon');
    expect(sectionBlock).toContain('forecast-feed-inline-explanation-toggle');
    expect(sectionBlock).toContain('aria-expanded=');
    expect(sectionBlock).toContain('<ChevronDown');
    expect(feedStyles).toContain('justify-content: flex-start');
    expect(feedStyles).toContain('scroll-padding-inline: 18px');
    expect(feedStyles).toContain('text-align: center');
    expect(feedStyles).not.toContain('content-visibility');
    expect(feedStyles).not.toContain('contain-intrinsic-size');
    expect(dashboard).toContain('function personalForecastGreeting');
    expect(dashboard).toContain('timeZone: timezone');
    expect(dashboard).toContain(
      'const [greetingVariant] = useState(() => Math.floor(Math.random() * 3))',
    );
    expect(dashboard).toContain('className="forecast-feed-date-zone"');
    expect(dashboard).toContain('className="forecast-feed-global-info"');
    expect(dashboard).toContain('const retained = options?.retry ? null');
    expect(feedStyles).toContain('.forecast-feed-page .home-period-tabs');
    expect(feedStyles).toContain('margin-top: 0');
    expect(dashboard).toContain('Точное время рождения влияет на Асцендент и дома.');
    expect(dashboard).toContain('ИИ формулирует текст только по переданной карте');
    expect(dashboard).toContain('Дата, время и место рождения используются');
    expect(dashboard).toContain('не медицинская, психологическая, юридическая или финансовая рекомендация');
  });

  it('shows a pending moderation confirmation with approved alternatives', () => {
    const questions = read('components/PersonalForecastFeed/ForecastQuestions.tsx');

    expect(questions).toContain("snapshot.moderation.status === 'pending'");
    expect(questions).toContain('На модерации.');
    expect(questions).toContain('snapshot.moderation.suggestions.map');
    expect(questions).toContain('activeMutationRef.current');
    expect(questions).toContain('Найди вопрос или напиши свой');
    expect(questions).toContain('Мои вопросы и ответы');
  });

  it('startup does not own or await personal forecast generation', () => {
    const source = read('App.tsx');
    expect(source).not.toMatch(/DailyCanvas|loadHumanDailyPackage|prepareStartupDailyPackage/);
    expect(source).toContain("mode: 'cache-only'");
    expect(source).toContain("mode: 'generate-missing'");
    expect(source).toContain('void prewarmUserContent');
  });

  it('keeps the separate Zodiac system intact', () => {
    const zodiac = read('views/v2/HoroscopeReader.tsx');
    expect(zodiac).toContain('getCachedWeeklySignHoroscope');
    expect(zodiac).toContain('ensureWeeklySignHoroscope');
    expect(zodiac).toContain('getCachedMonthlySignHoroscope');
    expect(zodiac).toContain('ensureMonthlySignHoroscope');
  });

  it('has no working imports of the incompatible personal systems', () => {
    const sourceFiles = [
      'App.tsx',
      'views/Dashboard.tsx',
      'services/contentPrewarmService.ts',
      'lib/personalForecastPrewarm.ts',
    ].filter(exists).map(read).join('\n');

    expect(sourceFiles).not.toMatch(
      /DailyCanvas|periodExtras|human-daily|PersonalForecastScreen|personal_daily/,
    );
  });
});
