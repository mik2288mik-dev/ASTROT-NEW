import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CircleAlert, LoaderCircle, LockKeyhole, MoonStar, WifiOff } from 'lucide-react';
import { ForecastSectionBlock } from '../PersonalForecastFeed/ForecastSectionBlock';
import { TodayEditorialFeed } from '../PersonalForecastFeed/TodayEditorialFeed';
import { selectForecastEndEditorialAsset } from '../../lib/personalForecastVisuals';
import { formatPersonalForecastAttribution } from '../../lib/personalForecastPresentation';
import { resolvePersonalForecastWindow } from '../../lib/personalForecastContract';
import {
  EditorialChartsButton,
  EditorialProfileButton,
  EditorialTabs,
} from '../editorial/EditorialScreenChrome';
import { AppTopBar } from '../lumia-ui/AppTopBar';
import {
  LumiaBottomTabBar,
  LumiaNavigationSheet,
  type LumiaNavigationSheetId,
} from '../lumia-ui/LumiaBottomTabBar';
import { HoroscopeReader } from '../../views/v2/HoroscopeReader';
import { NatalMagazine } from '../../views/v2/NatalMagazine';
import { PersonalityReport } from '../../views/PersonalityReport';
import { UnionRoom } from '../../views/v2/UnionRoom';
import { AstrologyEncyclopedia } from '../../views/v2/AstrologyEncyclopedia';
import { ServiceScreen, type ServiceTab } from '../../views/v2/ServiceScreen';
import { Settings } from '../../views/Settings';
import { MyCharts } from '../../views/MyCharts';
import { Paywall } from '../../views/Paywall';
import type { PaywallContext } from '../../lib/paywallContext';
import {
  UI_PREVIEW_ACCESS,
  UI_PREVIEW_BIRTH_TIMES,
  UI_PREVIEW_COMPATIBILITY,
  UI_PREVIEW_COMPATIBILITY_STEADY,
  UI_PREVIEW_HOROSCOPE,
  UI_PREVIEW_MONTH_SECTIONS,
  UI_PREVIEW_PAYWALL_PLANS,
  UI_PREVIEW_SCREEN_LABELS,
  UI_PREVIEW_SCREENS,
  UI_PREVIEW_STATES,
  UI_PREVIEW_SETTINGS,
  UI_PREVIEW_TODAY_SECTIONS,
  UI_PREVIEW_WEEK_SECTIONS,
  createUiPreviewChart,
  createUiPreviewCharts,
  createUiPreviewNatalReport,
  createUiPreviewNatalPremiumReport,
  createUiPreviewProfile,
  parseUiPreviewScenario,
  previewViewForScreen,
  scenarioToSearch,
  type UiPreviewScenario,
  type UiPreviewScreen,
  type UiPreviewState,
} from './uiPreviewFixtures';

const PERIOD_TABS = [
  { id: 'today', label: 'Сегодня' },
  { id: 'week', label: 'Неделя' },
  { id: 'month', label: 'Месяц' },
] as const;

const previewCompatibilityVerdict = (score: number) => score >= 85
  ? 'Очень сильная связь'
  : score >= 70
    ? 'Сильная связь'
    : score >= 55
      ? 'Живая, смешанная связь'
      : score >= 40
        ? 'Требовательная связь'
        : 'Сложная связь';

function localHostnameAllowed(): boolean {
  if (typeof window === 'undefined') return false;
  return ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
}

function StateScene({
  state,
  onRetry,
  onPremium,
}: {
  state: Exclude<UiPreviewState, 'ready'>;
  onRetry: () => void;
  onPremium: () => void;
}) {
  const states = {
    loading: {
      icon: <LoaderCircle className="ui-preview-status-spinner" aria-hidden="true" />,
      title: 'Собираем экран',
      copy: 'Синтетические данные уже готовы. Проверяем композицию и размеры элементов.',
      action: null,
    },
    error: {
      icon: <CircleAlert aria-hidden="true" />,
      title: 'Не получилось показать экран',
      copy: 'Это локальное состояние ошибки: настоящие сервисы и данные не затронуты.',
      action: 'retry',
    },
    empty: {
      icon: <MoonStar aria-hidden="true" />,
      title: 'Здесь пока пусто',
      copy: 'Добавь данные, чтобы увидеть содержание этого раздела.',
      action: 'retry',
    },
    offline: {
      icon: <WifiOff aria-hidden="true" />,
      title: 'Нет соединения',
      copy: 'Сохраняем спокойный экран и предлагаем повторить попытку, когда связь вернётся.',
      action: 'retry',
    },
    'premium-locked': {
      icon: <LockKeyhole aria-hidden="true" />,
      title: 'Продолжение в Premium',
      copy: 'Основная ценность видна, а полный материал открывается после покупки.',
      action: 'premium',
    },
  } as const;
  const content = states[state];

  return (
    <section className="ui-preview-status" role={state === 'loading' ? 'status' : undefined}>
      <div className="ui-preview-status-icon">{content.icon}</div>
      <h1>{content.title}</h1>
      <p>{content.copy}</p>
      {content.action ? (
        <button
          type="button"
          className="ui-preview-primary-button"
          onClick={content.action === 'premium' ? onPremium : onRetry}
        >
          {content.action === 'premium' ? 'Посмотреть Premium' : 'Попробовать снова'}
        </button>
      ) : null}
    </section>
  );
}

function ProfileAction({ onOpen }: { onOpen: () => void }) {
  return <EditorialProfileButton label="Открыть профиль" onClick={onOpen} />;
}

function DiaryScene({
  screen,
  premium,
  profile,
  onNavigate,
  onOpenCharts,
}: {
  screen: 'today' | 'week' | 'month';
  premium: boolean;
  profile: ReturnType<typeof createUiPreviewProfile>;
  onNavigate: (screen: UiPreviewScreen) => void;
  onOpenCharts: () => void;
}) {
  const period = screen === 'today' ? 'day' : screen;
  const periodKey = screen === 'today'
    ? '2026-08-26'
    : screen === 'week'
      ? '2026-W35'
      : '2026-08';
  const personalForecastAttribution = formatPersonalForecastAttribution({
    profile,
    window: resolvePersonalForecastWindow(period, periodKey, profile.birthTimezone),
    language: 'ru',
  });
  const longSections = screen === 'week' ? UI_PREVIEW_WEEK_SECTIONS : UI_PREVIEW_MONTH_SECTIONS;
  const periodEndVisual = screen === 'today'
    ? null
    : selectForecastEndEditorialAsset({
        userId: 'ui-preview-user',
        period,
        periodKey,
        sections: longSections,
      });
  const periodAdviceSectionId = [...longSections]
    .reverse()
    .find((section) => section.contentBlocks.some((block) => block.role === 'action'))
    ?.id || null;
  const personalForecastNote = {
    today: 'Личный прогноз на сегодня — по твоим данным рождения.',
    week: 'Личный прогноз на неделю — по твоим данным рождения.',
    month: 'Личный прогноз на месяц — по твоим данным рождения.',
  }[screen];

  return (
    <div className={`forecast-feed-page ui-preview-page is-${period}`}>
      <AppTopBar
        title="NEBO"
        rightAction={<EditorialChartsButton label="Открыть мои карты" onClick={onOpenCharts} />}
      />
      <EditorialTabs
        label="Период личного прогноза"
        tabs={PERIOD_TABS}
        activeTab={screen}
        onTabChange={onNavigate}
        className="ui-preview-period-tabs"
      />
      <p className="today-period-personal-note">{personalForecastNote}</p>
      {screen === 'today' ? (
        <TodayEditorialFeed
          sections={UI_PREVIEW_TODAY_SECTIONS}
          lockedSectionIds={premium
            ? new Set<string>()
            : new Set(UI_PREVIEW_TODAY_SECTIONS.slice(2, -1).map((section) => section.id))}
          userId="ui-preview-user-114"
          periodKey={periodKey}
          timezone="Europe/Moscow"
          language="ru"
          tone="favorable"
          personalAttribution={personalForecastAttribution}
          onRequestPremium={() => onNavigate('paywall')}
        />
      ) : (
        <article
          className="forecast-feed-story forecast-editorial-reading forecast-period-editorial-feed ui-preview-long-forecast"
          data-forecast-period={period}
          lang="ru"
        >
          {longSections.map((section, index) => (
            !premium && index > 0 ? null : (
              <ForecastSectionBlock
                key={`${period}:${section.id}`}
                section={section}
                period={period}
                language="ru"
                locked={!premium}
                onRequestPremium={() => onNavigate('paywall')}
                endVisualAsset={section.id === periodAdviceSectionId ? periodEndVisual : null}
              />
            )
          ))}
          {premium && periodAdviceSectionId && personalForecastAttribution ? (
            <p className="today-period-personal-note forecast-personal-attribution">
              {personalForecastAttribution}
            </p>
          ) : null}
        </article>
      )}
    </div>
  );
}

function CompatibilityScene({
  screen,
  profile,
  chart,
  onNavigate,
  onOpenCharts,
  state,
}: {
  screen: 'compatibility-input' | 'compatibility-signs' | 'compatibility-result';
  profile: ReturnType<typeof createUiPreviewProfile>;
  chart: ReturnType<typeof createUiPreviewChart>;
  onNavigate: (screen: UiPreviewScreen) => void;
  onOpenCharts: () => void;
  state: UiPreviewState;
}) {
  const previewScreen: 'input' | 'signs' | 'result' = screen === 'compatibility-input'
    ? 'input'
    : screen === 'compatibility-signs'
      ? 'signs'
      : 'result';
  const previewScore = useMemo(() => {
    if (typeof window === 'undefined') return UI_PREVIEW_COMPATIBILITY.deepResult.overallScore || 78;
    const params = new URLSearchParams(window.location.search);
    const fallbackScore = params.get('pair') === 'steady'
      ? UI_PREVIEW_COMPATIBILITY_STEADY.deepResult.overallScore || 66
      : UI_PREVIEW_COMPATIBILITY.deepResult.overallScore || 78;
    const requestedValue = params.get('score');
    const requested = requestedValue === null ? Number.NaN : Number(requestedValue);
    return Number.isFinite(requested) && requested >= 0 && requested <= 100
      ? Math.round(requested)
      : fallbackScore;
  }, [screen, state]);
  const useLongNames = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('names') === 'long';
  }, [screen, state]);
  const useSteadyPair = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('pair') === 'steady';
  }, [screen, state]);
  const compatibilityFixture = useSteadyPair
    ? UI_PREVIEW_COMPATIBILITY_STEADY
    : UI_PREVIEW_COMPATIBILITY;
  const unionPreview = useMemo(() => ({
    ...compatibilityFixture,
    subject: {
      ...compatibilityFixture.subject,
      name: useLongNames ? 'Александра-Мария Волконская' : compatibilityFixture.subject.name,
    },
    partner: {
      ...compatibilityFixture.partner,
      name: useLongNames ? 'Константин Вениаминович' : compatibilityFixture.partner.name,
    },
    deepResult: {
      ...compatibilityFixture.deepResult,
      overallScore: previewScore,
      compatibilityScore: previewScore,
      verdict: previewCompatibilityVerdict(previewScore),
      calculationLevel: chart.birthTimeQuality === 'exact' ? 'full' as const : 'reduced' as const,
      limitations: chart.birthTimeQuality === 'exact'
        ? []
        : ['Точное время рождения известно не для обоих: ненадёжные дома, Асцендент и MC не использовались.'],
    },
    screen: previewScreen,
    resultKind: profile.isPremium ? 'person' as const : 'sign' as const,
    ...(state === 'loading' || state === 'error' ? { resultState: state } : {}),
  }), [chart.birthTimeQuality, compatibilityFixture, previewScore, previewScreen, profile.isPremium, state, useLongNames]);

  return (
    <UnionRoom
      key={`${screen}:${state}`}
      profile={profile}
      chartData={chart}
      chartId={null}
      requestPremium={() => onNavigate('paywall')}
      onOpenCharts={onOpenCharts}
      canPromotePremium
      uiPreview={unionPreview}
    />
  );
}

function SettingsScene({
  profile,
  onNavigate,
  onBack,
  onOpenCharts,
  embedded = false,
}: {
  profile: ReturnType<typeof createUiPreviewProfile>;
  onNavigate: (screen: UiPreviewScreen) => void;
  onBack: () => void;
  onOpenCharts: () => void;
  embedded?: boolean;
}) {
  const [localProfile, setLocalProfile] = useState(profile);

  useEffect(() => {
    setLocalProfile(profile);
  }, [profile]);

  return (
    <Settings
      embedded={embedded}
      profile={localProfile}
      onBack={onBack}
      onUpdate={setLocalProfile}
      onRequestPremium={() => onNavigate('paywall')}
      canPromotePremium
      onRestorePurchase={async () => undefined}
      onManageSubscription={() => undefined}
      onOpenCharts={onOpenCharts}
      onLogout={async () => undefined}
      onDeleteAccount={async () => undefined}
      uiPreview={UI_PREVIEW_SETTINGS}
    />
  );
}

function OnboardingScene({
  birthTime,
  onBirthTime,
  onContinue,
}: {
  birthTime: UiPreviewScenario['birthTime'];
  onBirthTime: (birthTime: UiPreviewScenario['birthTime']) => void;
  onContinue: () => void;
}) {
  return (
    <div className="ui-preview-onboarding">
      <p className="ui-preview-wordmark">NEBO</p>
      <h1>Начнём с тебя</h1>
      <p>Эти данные нужны только для персонального опыта. В Preview они никуда не отправляются.</p>
      <label>Имя<input defaultValue="Алина" /></label>
      <label>Дата рождения<input type="date" defaultValue="1990-03-14" /></label>
      <fieldset>
        <legend>Насколько точно известно время?</legend>
        {UI_PREVIEW_BIRTH_TIMES.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={birthTime === item}
            onClick={() => onBirthTime(item)}
          >
            {item === 'exact' ? 'Точное' : item === 'approximate' ? 'Примерное' : 'Неизвестно'}
          </button>
        ))}
      </fieldset>
      <button type="button" className="ui-preview-primary-button" onClick={onContinue}>Продолжить</button>
    </div>
  );
}

function PaywallScene({
  profile,
  onClose,
  embedded = false,
}: {
  profile: ReturnType<typeof createUiPreviewProfile>;
  onClose: () => void;
  embedded?: boolean;
}) {
  const context: PaywallContext = {
    placement: 'settings',
    featureKey: 'personal_daily_full',
    triggerType: 'settings',
    returnView: 'settings',
    returnScrollAnchor: null,
    returnAction: null,
    returnEntityId: null,
    paywallInstanceId: 'ui-preview-paywall',
  };

  return (
    <Paywall
      embedded={embedded}
      profile={profile}
      context={context}
      onPurchase={async () => undefined}
      onClose={onClose}
      onContinueFree={onClose}
      onRestore={async () => undefined}
      onManageSubscription={() => undefined}
      uiPreview={embedded ? undefined : { plans: UI_PREVIEW_PAYWALL_PLANS }}
    />
  );
}

function PreviewControls({
  scenario,
  onChange,
}: {
  scenario: UiPreviewScenario;
  onChange: (patch: Partial<UiPreviewScenario>) => void;
}) {
  return (
    <details className="ui-preview-controls">
      <summary>UI Preview</summary>
      <div>
        <label>Экран<select value={scenario.screen} onChange={(event) => onChange({ screen: event.target.value as UiPreviewScreen })}>
          {UI_PREVIEW_SCREENS.map((screen) => <option key={screen} value={screen}>{UI_PREVIEW_SCREEN_LABELS[screen]}</option>)}
        </select></label>
        <label>Доступ<select value={scenario.access} onChange={(event) => onChange({ access: event.target.value as UiPreviewScenario['access'] })}>
          {UI_PREVIEW_ACCESS.map((access) => <option key={access}>{access}</option>)}
        </select></label>
        <label>Состояние<select value={scenario.state} onChange={(event) => onChange({ state: event.target.value as UiPreviewState })}>
          {UI_PREVIEW_STATES.map((state) => <option key={state}>{state}</option>)}
        </select></label>
        <label>Время рождения<select value={scenario.birthTime} onChange={(event) => onChange({ birthTime: event.target.value as UiPreviewScenario['birthTime'] })}>
          {UI_PREVIEW_BIRTH_TIMES.map((birthTime) => <option key={birthTime}>{birthTime}</option>)}
        </select></label>
      </div>
    </details>
  );
}

export default function UiPreviewApp() {
  const [scenario, setScenario] = useState<UiPreviewScenario>(() => (
    parseUiPreviewScenario(typeof window === 'undefined' ? '' : window.location.search)
  ));
  const [navigationSheet, setNavigationSheet] = useState<LumiaNavigationSheetId | null>(null);
  const [serviceTab, setServiceTab] = useState<ServiceTab>('knowledge');
  const [paywallReturnScreen, setPaywallReturnScreen] = useState<UiPreviewScreen>('today');
  const [settingsReturnScreen] = useState<UiPreviewScreen>('today');
  const [chartsReturnScreen, setChartsReturnScreen] = useState<UiPreviewScreen>('menu');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const profile = useMemo(
    () => createUiPreviewProfile(scenario.access, scenario.birthTime),
    [scenario.access, scenario.birthTime],
  );
  const chart = useMemo(() => createUiPreviewChart(scenario.birthTime), [scenario.birthTime]);
  const natalProfile = useMemo(() => ({ ...profile, id: '' }), [profile]);
  const natalReport = useMemo(
    () => createUiPreviewNatalReport(natalProfile, chart),
    [chart, natalProfile],
  );
  const natalPremiumReport = useMemo(
    () => createUiPreviewNatalPremiumReport(natalProfile, chart),
    [chart, natalProfile],
  );
  const natalCharts = useMemo(
    () => createUiPreviewCharts(natalProfile, chart),
    [chart, natalProfile],
  );
  const view = previewViewForScreen(scenario.screen);
  const showsBottomNavigation = !['onboarding', 'paywall'].includes(scenario.screen);

  useEffect(() => {
    const className = 'ui-preview-document-scroll';
    const roots = [document.documentElement, document.body, document.getElementById('__next')]
      .filter((node): node is HTMLElement => node instanceof HTMLElement);

    roots.forEach((node) => node.classList.add(className));
    return () => roots.forEach((node) => node.classList.remove(className));
  }, []);

  const changeScenario = (patch: Partial<UiPreviewScenario>) => {
    setScenario((current) => {
      const next = { ...current, ...patch };
      window.history.replaceState(null, '', scenarioToSearch(next));
      return next;
    });
  };
  const navigate = (screen: UiPreviewScreen) => {
    if (screen === 'paywall') {
      setPaywallReturnScreen(
        scenario.screen === 'menu' || scenario.screen === 'settings' || scenario.screen === 'charts'
          ? scenario.screen
          : 'today',
      );
    }
    changeScenario({ screen, state: 'ready' });
  };
  const openCharts = () => {
    if (scenario.screen !== 'charts') setChartsReturnScreen(scenario.screen);
    navigate('charts');
  };
  useEffect(() => {
    if (!localHostnameAllowed()) return;
    const handlePopState = () => setScenario(parseUiPreviewScenario(window.location.search));
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('/_next/')) return originalFetch(input, init);
      return Promise.reject(new Error(`[UI Preview] Network request blocked: ${url}`));
    };
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    scrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [scenario.screen, scenario.state]);

  const openProfile = () => setNavigationSheet('profile');

  let scene: React.ReactNode;
  const usesRealNatalState = scenario.screen === 'natal'
    || scenario.screen === 'natal-reading'
    || scenario.screen === 'question';
  const usesRealCompatibilityState = scenario.screen.startsWith('compatibility-')
    && (scenario.state === 'loading' || scenario.state === 'error');
  if (scenario.state !== 'ready' && !usesRealNatalState && !usesRealCompatibilityState) {
    const stateHeaderAction = scenario.screen === 'settings' ? (
      <EditorialChartsButton label="Открыть мои карты" onClick={openCharts} />
    ) : scenario.screen === 'charts' ? undefined : (
      <EditorialChartsButton label="Открыть мои карты" onClick={openCharts} />
    );
    scene = (
      <div className="ui-preview-page">
        <AppTopBar title={UI_PREVIEW_SCREEN_LABELS[scenario.screen]} rightAction={stateHeaderAction} />
        <StateScene
          state={scenario.state}
          onRetry={() => changeScenario({ state: 'ready' })}
          onPremium={() => navigate('paywall')}
        />
      </div>
    );
  } else if (scenario.screen === 'onboarding') {
    scene = (
      <OnboardingScene
        birthTime={scenario.birthTime}
        onBirthTime={(birthTime) => changeScenario({ birthTime })}
        onContinue={() => navigate('zodiac-picker')}
      />
    );
  } else if (scenario.screen === 'paywall') {
    scene = <PaywallScene profile={profile} onClose={() => navigate(paywallReturnScreen)} />;
  } else if (scenario.screen === 'encyclopedia') {
    scene = <AstrologyEncyclopedia profile={profile} onOpenCharts={openCharts} />;
  } else if (scenario.screen === 'today' || scenario.screen === 'week' || scenario.screen === 'month') {
    scene = <DiaryScene screen={scenario.screen} premium={scenario.access === 'premium'} profile={profile} onNavigate={navigate} onOpenCharts={openCharts} />;
  } else if (scenario.screen === 'horoscope' || scenario.screen === 'zodiac-picker') {
    scene = (
      <HoroscopeReader
        key={scenario.screen}
        profile={profile}
        chartData={scenario.access === 'guest' ? null : chart}
        onOpenCharts={openCharts}
        uiPreview={{
          ...UI_PREVIEW_HOROSCOPE,
          pickerOpen: scenario.screen === 'zodiac-picker',
        }}
      />
    );
  } else if (scenario.screen === 'natal-reading' && scenario.state !== 'empty') {
    scene = (
      <PersonalityReport
        key={`${scenario.screen}:${scenario.access}:${scenario.state}:${scenario.birthTime}`}
        profile={natalProfile}
        primaryChartData={chart}
        primaryChartId={1}
        preloadedReport={natalReport}
        requestPremium={() => navigate('paywall')}
        onBack={() => navigate('natal')}
        onOpenProfile={openProfile}
        onOpenNatalChart={() => navigate('natal')}
        onCompareWithMe={() => navigate('compatibility-input')}
        uiPreview={{
          charts: natalCharts,
          reportState: scenario.state === 'loading' || scenario.state === 'error'
            ? scenario.state
            : 'ready',
          premiumReport: scenario.access === 'premium' ? natalPremiumReport : null,
        }}
      />
    );
  } else if (scenario.screen === 'natal' || scenario.screen === 'natal-reading' || scenario.screen === 'question') {
    scene = (
      <NatalMagazine
        key={`${scenario.screen}:${scenario.access}:${scenario.birthTime}`}
        data={scenario.state === 'empty' ? null : chart}
        profile={natalProfile}
        requestPremium={() => navigate('paywall')}
        preloadedReport={natalReport}
        onCreateChart={() => navigate('onboarding')}
        onOpenPersonalityReport={() => navigate('natal-reading')}
        canPromotePremium={scenario.access !== 'premium'}
        onOpenCharts={openCharts}
        onOpenEncyclopedia={() => navigate('encyclopedia')}
        uiPreview={{
          initialTab: scenario.screen === 'natal'
            ? 'map'
            : scenario.screen === 'question'
              ? 'questions'
              : 'reading',
          openQuestion: scenario.screen === 'question',
          reportState: scenario.state === 'loading' || scenario.state === 'error'
            ? scenario.state
            : 'ready',
          premiumReport: scenario.access === 'premium' ? natalPremiumReport : null,
        }}
      />
    );
  } else if (scenario.screen.startsWith('compatibility-')) {
    scene = (
      <CompatibilityScene
        screen={scenario.screen as 'compatibility-input' | 'compatibility-signs' | 'compatibility-result'}
        profile={profile}
        chart={chart}
        onNavigate={navigate}
        onOpenCharts={openCharts}
        state={scenario.state}
      />
    );
  } else if (scenario.screen === 'settings') {
    scene = (
      <SettingsScene
        profile={profile}
        onNavigate={navigate}
        onBack={() => navigate(settingsReturnScreen)}
        onOpenCharts={openCharts}
      />
    );
  } else if (scenario.screen === 'charts') {
    scene = (
      <div className="fresh-page">
        <AppTopBar title="Мои карты" onBack={() => navigate(chartsReturnScreen)} />
        <MyCharts
          profile={profile}
          canPromotePremium={scenario.access !== 'premium'}
          onRequestPremium={() => navigate('paywall')}
          uiPreview={{
            charts: createUiPreviewCharts(profile, chart),
            chartSlots: scenario.access === 'premium' ? 5 : 1,
            canAddMore: false,
            canAddSavedPeople: false,
            isPremium: scenario.access === 'premium',
          }}
        />
      </div>
    );
  } else if (scenario.screen === 'menu') {
    scene = (
      <ServiceScreen
        profile={profile}
        activeTab={serviceTab}
        onTabChange={setServiceTab}
        onOpenCharts={openCharts}
        premiumStoreContent={(
          <PaywallScene
            embedded
            profile={profile}
            onClose={() => undefined}
          />
        )}
        settingsContent={(
          <SettingsScene
            profile={profile}
            embedded
            onNavigate={navigate}
            onBack={() => undefined}
            onOpenCharts={openCharts}
          />
        )}
      />
    );
  } else {
    scene = null;
  }

  const sheetOpen = navigationSheet !== null;

  return (
    <div className={`lumia-app-shell ui-preview-app ${showsBottomNavigation ? 'has-today-bottom-navigation' : ''}`} data-ui-preview="true">
      <main
        className="lumia-tg-main-gutter relative z-10 flex-1 w-full max-w-reading-wide mx-auto overflow-hidden min-h-0 bg-white"
        aria-hidden={sheetOpen ? true : undefined}
        inert={sheetOpen ? true : undefined}
      >
        <div ref={scrollRef} className="lumia-main-scroll lumia-bottom-tab-scroll">
          {scene}
        </div>
      </main>

      {showsBottomNavigation ? (
        <>
          <LumiaBottomTabBar
            profile={profile}
            view={view}
            onOpenToday={() => navigate('today')}
            onOpenZodiac={() => navigate('horoscope')}
            onOpenServices={() => navigate('menu')}
            onOpenCompatibility={() => navigate('compatibility-input')}
            onOpenNatal={() => navigate('natal')}
          />
          <LumiaNavigationSheet
            activeSheet={navigationSheet}
            profile={profile}
            onClose={() => setNavigationSheet(null)}
            onOpenNatal={() => navigate('natal')}
            onOpenCharts={openCharts}
          />
        </>
      ) : null}

      <PreviewControls scenario={scenario} onChange={changeScenario} />
    </div>
  );
}
