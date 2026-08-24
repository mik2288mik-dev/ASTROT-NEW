import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CircleAlert, LoaderCircle, LockKeyhole, MoonStar, Sparkles, WifiOff } from 'lucide-react';
import { ForecastSectionBlock } from '../PersonalForecastFeed/ForecastSectionBlock';
import { TodayEditorialFeed } from '../PersonalForecastFeed/TodayEditorialFeed';
import { EditorialProfileButton, EditorialTabs } from '../editorial/EditorialScreenChrome';
import { AppTopBar } from '../lumia-ui/AppTopBar';
import {
  LumiaBottomTabBar,
  LumiaNavigationSheet,
  type LumiaNavigationSheetId,
} from '../lumia-ui/LumiaBottomTabBar';
import { HoroscopeReader } from '../../views/v2/HoroscopeReader';
import { NatalMagazine } from '../../views/v2/NatalMagazine';
import type { NatalQuestionOpenRequest } from '../NatalReading/HumanReport';
import { MoreHub, type MoreHubTab } from '../../views/v2/MoreHub';
import { PersonalityReport } from '../../views/PersonalityReport';
import { UnionRoom } from '../../views/v2/UnionRoom';
import { AstrologyEncyclopedia } from '../../views/v2/AstrologyEncyclopedia';
import { Settings } from '../../views/Settings';
import { Paywall } from '../../views/Paywall';
import type { PaywallContext } from '../../lib/paywallContext';
import { getPermanentNatalReliability } from '../../lib/natalReading/permanentReport';
import type { NatalChartData } from '../../types';
import {
  UI_PREVIEW_ACCESS,
  UI_PREVIEW_BIRTH_TIMES,
  UI_PREVIEW_COMPATIBILITY,
  UI_PREVIEW_HOROSCOPE,
  UI_PREVIEW_MONTH_SECTION,
  UI_PREVIEW_PAYWALL_PLANS,
  UI_PREVIEW_SCREEN_LABELS,
  UI_PREVIEW_SCREENS,
  UI_PREVIEW_STATES,
  UI_PREVIEW_SETTINGS,
  UI_PREVIEW_TODAY_SECTIONS,
  UI_PREVIEW_WEEK_SECTION,
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

const UI_PREVIEW_TODAY_WITH_CLOSING = UI_PREVIEW_TODAY_SECTIONS.map((section, index) => {
  if (index !== UI_PREVIEW_TODAY_SECTIONS.length - 1) return section;
  return {
    ...section,
    contentBlocks: section.contentBlocks.map((block, blockIndex) => (
      blockIndex === 0 ? { ...block, role: 'insight' as const } : block
    )),
  };
});

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
  onNavigate,
  onOpenProfile,
}: {
  screen: 'today' | 'week' | 'month';
  premium: boolean;
  onNavigate: (screen: UiPreviewScreen) => void;
  onOpenProfile: () => void;
}) {
  const period = screen === 'today' ? 'day' : screen;
  const longSection = screen === 'week' ? UI_PREVIEW_WEEK_SECTION : UI_PREVIEW_MONTH_SECTION;

  return (
    <div className="forecast-feed-page ui-preview-page">
      <AppTopBar
        title="Твой гороскоп"
        rightAction={<ProfileAction onOpen={onOpenProfile} />}
      />
      <EditorialTabs
        label="Период личного прогноза"
        tabs={PERIOD_TABS}
        activeTab={screen}
        onTabChange={onNavigate}
        className="ui-preview-period-tabs"
      />
      {screen === 'today' ? (
        <TodayEditorialFeed
          sections={UI_PREVIEW_TODAY_WITH_CLOSING}
          lockedSectionIds={premium
            ? new Set<string>()
            : new Set(UI_PREVIEW_TODAY_WITH_CLOSING.slice(2).map((section) => section.id))}
          userId="ui-preview-user"
          periodKey="2026-08-22"
          timezone="Europe/Moscow"
          language="ru"
          tone="mixed"
          premium={premium}
          onRequestPremium={() => onNavigate('paywall')}
        />
      ) : (
        <article className="forecast-feed-story forecast-editorial-reading forecast-period-editorial-feed ui-preview-long-forecast">
          <ForecastSectionBlock
            section={longSection}
            period={period}
            language="ru"
            locked={!premium}
            onRequestPremium={() => onNavigate('paywall')}
          />
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
  onOpenProfile,
  state,
}: {
  screen: 'compatibility-input' | 'compatibility-signs' | 'compatibility-result';
  profile: ReturnType<typeof createUiPreviewProfile>;
  chart: ReturnType<typeof createUiPreviewChart>;
  onNavigate: (screen: UiPreviewScreen) => void;
  onOpenProfile: () => void;
  state: UiPreviewState;
}) {
  const previewScreen: 'input' | 'signs' | 'result' = screen === 'compatibility-input'
    ? 'input'
    : screen === 'compatibility-signs'
      ? 'signs'
      : 'result';
  const unionPreview = useMemo(() => ({
    ...UI_PREVIEW_COMPATIBILITY,
    screen: previewScreen,
    ...(state === 'loading' || state === 'error' ? { resultState: state } : {}),
  }), [previewScreen, state]);

  return (
    <UnionRoom
      key={`${screen}:${state}`}
      profile={profile}
      chartData={chart}
      chartId={null}
      requestPremium={() => onNavigate('paywall')}
      onOpenCharts={() => onNavigate('natal')}
      canPromotePremium={profile.isPremium}
      onOpenProfile={onOpenProfile}
      uiPreview={unionPreview}
    />
  );
}

function SettingsScene({
  profile,
  onNavigate,
  onOpenProfile,
}: {
  profile: ReturnType<typeof createUiPreviewProfile>;
  onNavigate: (screen: UiPreviewScreen) => void;
  onOpenProfile: () => void;
}) {
  const [localProfile, setLocalProfile] = useState(profile);

  useEffect(() => {
    setLocalProfile(profile);
  }, [profile]);

  return (
    <Settings
      profile={localProfile}
      onUpdate={setLocalProfile}
      onRequestPremium={() => onNavigate('paywall')}
      canPromotePremium
      onRestorePurchase={async () => undefined}
      onManageSubscription={() => undefined}
      onOpenCharts={() => onNavigate('natal')}
      onOpenProfile={onOpenProfile}
      onLogout={async () => undefined}
      onDeleteAccount={async () => undefined}
      uiPreview={UI_PREVIEW_SETTINGS}
    />
  );
}

function MoreScene({
  profile,
  chart,
  activeTab,
  onTabChange,
  onOpenPremium,
  onAskAboutSelf,
  onSpecifyBirthTime,
  onNavigate,
  onOpenProfile,
}: {
  profile: ReturnType<typeof createUiPreviewProfile>;
  chart: NatalChartData;
  activeTab: MoreHubTab;
  onTabChange: (tab: MoreHubTab) => void;
  onOpenPremium: () => void;
  onAskAboutSelf: (question: string) => void;
  onSpecifyBirthTime: () => void;
  onNavigate: (screen: UiPreviewScreen) => void;
  onOpenProfile: () => void;
}) {
  const [localProfile, setLocalProfile] = useState(profile);

  useEffect(() => {
    setLocalProfile(profile);
  }, [profile]);

  return (
    <MoreHub
      profile={localProfile}
      activeTab={activeTab}
      onTabChange={onTabChange}
      onOpenPremium={onOpenPremium}
      onUpdate={setLocalProfile}
      canPromotePremium={!localProfile.isPremium}
      onRestorePurchase={async () => undefined}
      onManageSubscription={() => undefined}
      onOpenCharts={() => onNavigate('natal')}
      onOpenProfile={onOpenProfile}
      onLogout={async () => undefined}
      onDeleteAccount={async () => undefined}
      primaryChartData={chart}
      personalReliability={getPermanentNatalReliability(chart)}
      onAskAboutSelf={onAskAboutSelf}
      onSpecifyBirthTime={onSpecifyBirthTime}
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
      <div className="ui-preview-brand-mark"><Sparkles aria-hidden="true" /></div>
      <p className="ui-preview-kicker">ASTROT</p>
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
}: {
  profile: ReturnType<typeof createUiPreviewProfile>;
  onClose: () => void;
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
      profile={profile}
      context={context}
      onPurchase={async () => undefined}
      onClose={onClose}
      onContinueFree={onClose}
      onRestore={async () => undefined}
      uiPreview={{ plans: UI_PREVIEW_PAYWALL_PLANS }}
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
  const [moreTab, setMoreTab] = useState<MoreHubTab>('knowledge');
  const [paywallReturnScreen, setPaywallReturnScreen] = useState<UiPreviewScreen>('today');
  const [natalQuestionRequest, setNatalQuestionRequest] = useState<NatalQuestionOpenRequest | null>(null);
  const natalQuestionRequestIdRef = useRef(0);
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
      setPaywallReturnScreen(scenario.screen === 'more' ? 'more' : 'today');
    }
    changeScenario({ screen, state: 'ready' });
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
    scene = (
      <div className="ui-preview-page">
        <AppTopBar title={UI_PREVIEW_SCREEN_LABELS[scenario.screen]} rightAction={<ProfileAction onOpen={openProfile} />} />
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
    scene = (
      <AstrologyEncyclopedia
        profile={profile}
        onOpenProfile={openProfile}
        primaryChartData={chart}
        personalReliability={getPermanentNatalReliability(chart)}
        onAskAboutSelf={(question) => {
          natalQuestionRequestIdRef.current += 1;
          setNatalQuestionRequest({ requestId: natalQuestionRequestIdRef.current, text: question });
          navigate('natal');
        }}
        onSpecifyBirthTime={() => navigate('onboarding')}
      />
    );
  } else if (scenario.screen === 'today' || scenario.screen === 'week' || scenario.screen === 'month') {
    scene = <DiaryScene screen={scenario.screen} premium={scenario.access === 'premium'} onNavigate={navigate} onOpenProfile={openProfile} />;
  } else if (scenario.screen === 'horoscope' || scenario.screen === 'zodiac-picker') {
    scene = (
      <HoroscopeReader
        key={scenario.screen}
        profile={profile}
        chartData={scenario.access === 'guest' ? null : chart}
        onOpenProfile={openProfile}
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
        openQuestionRequest={natalQuestionRequest}
        onQuestionRequestHandled={() => setNatalQuestionRequest(null)}
        onOpenProfile={openProfile}
        onOpenEncyclopedia={() => navigate('encyclopedia')}
        uiPreview={{
          initialTab: scenario.screen === 'natal' ? 'map' : 'reading',
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
        onOpenProfile={openProfile}
        state={scenario.state}
      />
    );
  } else if (scenario.screen === 'settings') {
    scene = <SettingsScene profile={profile} onNavigate={navigate} onOpenProfile={openProfile} />;
  } else if (scenario.screen === 'more') {
    scene = (
      <MoreScene
        profile={profile}
        chart={chart}
        activeTab={moreTab}
        onTabChange={setMoreTab}
        onOpenPremium={() => {
          setMoreTab('premium');
          navigate('paywall');
        }}
        onAskAboutSelf={(question) => {
          natalQuestionRequestIdRef.current += 1;
          setNatalQuestionRequest({ requestId: natalQuestionRequestIdRef.current, text: question });
          navigate('natal');
        }}
        onSpecifyBirthTime={() => navigate('onboarding')}
        onNavigate={navigate}
        onOpenProfile={openProfile}
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
            onOpenMore={() => navigate('more')}
            onOpenCompatibility={() => navigate('compatibility-input')}
            onOpenNatal={() => navigate('natal')}
          />
          <LumiaNavigationSheet
            activeSheet={navigationSheet}
            profile={profile}
            onClose={() => setNavigationSheet(null)}
            onOpenNatal={() => navigate('natal')}
            onOpenCharts={() => navigate('natal')}
          />
        </>
      ) : null}

      <PreviewControls scenario={scenario} onChange={changeScenario} />
    </div>
  );
}
