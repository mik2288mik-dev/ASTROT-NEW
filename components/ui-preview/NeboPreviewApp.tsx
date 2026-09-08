import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { PersonalMicroForecast } from '../../lib/personalMicroForecastContract';
import type { PersonalFutureForecast } from '../../lib/personalFutureForecastContract';
import { NeboDashboard, type NeboDashboardPreview } from '../nebo-v2/NeboDashboard';
import { NeboNatal } from '../nebo-v2/NeboNatal';
import { NeboUnionRoom } from '../nebo-v2/NeboUnionRoom';
import { NeboMatrixRoom } from '../nebo-v2/NeboMatrixRoom';
import { NeboMyCharts } from '../nebo-v2/NeboMyCharts';
import { NeboHoroscopeReader } from '../nebo-v2/NeboHoroscopeReader';
import { NeboTabBar } from '../nebo-v2/NeboBottomTabBar';
import { Settings } from '../../views/Settings';
import { Paywall } from '../../views/Paywall';
import { Onboarding } from '../../views/Onboarding';
import { createUnavailablePersonalForecast, getPersonalForecastPeriodKey, type PersonalForecastPeriod } from '../../lib/personalForecastContract';
import type { PaywallContext } from '../../lib/paywallContext';
import type { UserProfile, ViewState } from '../../types';
import type { NatalQuestionStoredMessage } from '../../lib/natalReading/natalQuestionStore';
import {
  createUiPreviewProfile, createUiPreviewChart, createUiPreviewCharts, createUiPreviewNatalCatalog,
  createUiPreviewCompatibilityStory, UI_PREVIEW_COMPATIBILITY, UI_PREVIEW_HOROSCOPE, UI_PREVIEW_SETTINGS,
  UI_PREVIEW_PAYWALL_PLANS,
} from './uiPreviewFixtures';
import styles from './NeboPreviewApp.module.css';
import readingSamples from './readingSamples.json';
import type { NatalChartData } from '../../types';
import type { PersonalForecastPackage } from '../../lib/personalForecastContract';
import type { NatalReportCategoryKey, NatalReportCategoryPack } from '../../lib/natalReading/reportCatalog';

const SAMPLE_PEOPLE = [{ id: 'alina', name: 'Алина' }, { id: 'artem', name: 'Артём' }, { id: 'mira', name: 'Мира' }] as const;
type SamplePerson = 'demo' | typeof SAMPLE_PEOPLE[number]['id'];
type ReadingSample = { id: SamplePerson; profile: UserProfile; chart: NatalChartData; forecasts: Partial<Record<PersonalForecastPeriod, PersonalForecastPackage>>; categoryPacks: Partial<Record<NatalReportCategoryKey, NatalReportCategoryPack>>; microForecasts?: Partial<Record<PersonalForecastPeriod, PersonalMicroForecast>>; futureForecasts?: PersonalFutureForecast[]; errors: Record<string, string> };
const samples = readingSamples.people as unknown as ReadingSample[];

export const NEBO_PREVIEW_SCREENS = ['today', 'natal', 'natal-map', 'question', 'compatibility', 'compatibility-input', 'compatibility-result', 'matrix', 'matrix-scheme', 'settings', 'menu', 'paywall', 'onboarding', 'horoscope', 'charts'] as const;
type Screen = typeof NEBO_PREVIEW_SCREENS[number];
type Scenario = { screen: Screen; theme: 'light' | 'dark'; access: 'free' | 'premium'; state: 'ready' | 'loading' | 'error'; controls: boolean; person: SamplePerson };
export function parseNeboPreviewScenario(search: string): Scenario {
  const query = new URLSearchParams(search);
  return {
    person: SAMPLE_PEOPLE.some(person => person.id === query.get('person')) ? query.get('person') as SamplePerson : 'alina',
    screen: NEBO_PREVIEW_SCREENS.includes(query.get('screen') as Screen) ? query.get('screen') as Screen : 'today',
    theme: query.get('theme') === 'dark' ? 'dark' : 'light', access: query.get('access') === 'free' ? 'free' : 'premium',
    state: query.get('state') === 'loading' ? 'loading' : query.get('state') === 'error' ? 'error' : 'ready', controls: query.get('controls') !== '0',
  };
}
const LABELS: Record<Screen, string> = { today: 'Сегодня', natal: 'Натальный разбор', 'natal-map': 'Натальная карта', question: 'Спросить о себе', compatibility: 'Совместимость', 'compatibility-input': 'Данные пары', 'compatibility-result': 'Разбор пары', matrix: 'Матрица', 'matrix-scheme': 'Схема матрицы', settings: 'Настройки', menu: 'Меню', paywall: 'Premium', onboarding: 'Онбординг', horoscope: 'Зодиак', charts: 'Люди и сохранённое' };
const context: PaywallContext = { entryPoint: 'preview', placement: 'settings', featureKey: 'personal_daily_full', triggerType: 'settings', returnView: 'settings', returnScrollAnchor: null, returnAction: null, returnEntityId: null, paywallInstanceId: 'nebo-ui-preview-paywall' };
function viewFor(screen: Screen): ViewState {
  if (screen.startsWith('compatibility')) return 'synastry';
  if (screen.startsWith('matrix')) return 'matrix';
  if (screen.startsWith('natal') || screen === 'question') return 'chart';
  if (screen === 'horoscope' || screen === 'charts' || screen === 'settings') return screen;
  return screen === 'menu' ? 'services' : 'dashboard';
}

const DEVICE_WIDTH = 393;
const DEVICE_HEIGHT = 873;

function isLocalPreviewAllowed(): boolean {
  return process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_UI_PREVIEW === '1'
    && typeof window !== 'undefined' && ['localhost', '127.0.0.1', '[::1]', '::1'].includes(window.location.hostname);
}

/** Keep the app's CSS viewport fixed while fitting the complete phone into the side pane. */
function DevicePreview() {
  const stage = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const [src, setSrc] = useState(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete('device');
    url.searchParams.set('uiPreview', '1');
    url.searchParams.set('design', 'nebo');
    url.searchParams.set('controls', '0');
    url.searchParams.set('sampleControls', '0');
    return url.toString();
  });
  const samplePerson = new URL(src).searchParams.get('person');
  const selectSample = (person: string, screen?: string) => {
    const url = new URL(src);
    url.searchParams.set('person', person);
    if (screen) url.searchParams.set('screen', screen);
    setSrc(url.toString());
    const outer = new URL(window.location.href);
    outer.searchParams.set('person', person);
    if (screen) outer.searchParams.set('screen', screen);
    window.history.replaceState(null, '', outer.toString());
  };
  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setScale(Math.max(0, Math.min(1, entry.contentRect.width / DEVICE_WIDTH, entry.contentRect.height / DEVICE_HEIGHT)));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <div className={styles.deviceRoot}>
    {samplePerson && <aside className={styles.sampleTools} aria-label="Сравнить три примера"><p>Вымышленные люди · тексты Luna · 8 сентября</p><div>{SAMPLE_PEOPLE.map(person => <button type="button" key={person.id} aria-pressed={samplePerson === person.id} onClick={() => selectSample(person.id)}>{person.name}</button>)}</div><div><button type="button" onClick={() => selectSample(samplePerson, 'today')}>Личные прогнозы</button><button type="button" onClick={() => selectSample(samplePerson, 'natal')}>Натальная карта</button></div></aside>}
    <div ref={stage} className={styles.deviceStage}>
      <div className={styles.deviceFrame} style={{ width: DEVICE_WIDTH * scale, height: DEVICE_HEIGHT * scale, visibility: scale ? 'visible' : 'hidden' }}>
        <iframe className={styles.deviceIframe} src={src} title="NEBO — Xiaomi 11 Lite" width={DEVICE_WIDTH} height={DEVICE_HEIGHT} style={{ transform: `scale(${scale})` }}/>
      </div>
    </div>
    <p className={styles.deviceCaption}>Xiaomi 11 Lite · 393 × 873</p>
  </div>;
}

/** This component is mounted only behind the local development preview route. */
export default function NeboPreviewApp() {
  if (!isLocalPreviewAllowed()) return null;
  return new URLSearchParams(window.location.search).get('device') === 'mi11lite'
    ? <DevicePreview/>
    : <NeboPreviewContent/>;
}

function NeboPreviewContent() {
  const [scenario, setScenario] = useState<Scenario>(() => parseNeboPreviewScenario(typeof window === 'undefined' ? '' : window.location.search));
  const [period, setPeriod] = useState<PersonalForecastPeriod>('day');
  const [profilePatch, setProfilePatch] = useState<Partial<UserProfile>>({});
  const sample = samples.find(person => person.id === scenario.person);
  const allowed = isLocalPreviewAllowed();
  const profile = useMemo(() => {
    const base = createUiPreviewProfile(scenario.access, 'exact');
    return { ...base, ...sample?.profile, ...profilePatch, theme: scenario.theme, isAdmin: false, isPremium: base.isPremium, premiumUntil: base.premiumUntil, premiumEntitlement: base.premiumEntitlement };
  }, [scenario.access, scenario.theme, profilePatch, sample]);
  const chart = useMemo(() => sample?.chart || createUiPreviewChart('exact'), [sample]);
  const charts = useMemo(() => createUiPreviewCharts(profile, chart), [profile, chart]);
  const catalog = useMemo(() => sample ? { categoryPacks: sample.categoryPacks, answers: {} } : createUiPreviewNatalCatalog(), [sample]);
  const compatibility = useMemo(() => ({ ...UI_PREVIEW_COMPATIBILITY.deepResult, storyParagraphs: createUiPreviewCompatibilityStory(UI_PREVIEW_COMPATIBILITY.deepResult) }), []);
  const questions = useMemo(() => {
    const limit = scenario.access === 'premium' ? 5 : 0;
    const snapshot = { chartId: 1, messages: [] as NatalQuestionStoredMessage[], usage: { usageDate: new Date().toISOString().slice(0, 10), used: 0, limit, remaining: limit }, access: { freeQuestionRemaining: 0, isPremium: scenario.access === 'premium' }, promptVersion: 'ui-preview', voiceVersion: 'ui-preview' };
    let current = snapshot;
    return { get snapshot() { return current; }, phase: scenario.state, onAsk: async (question: string) => {
      const reject = (code: string): never => { throw Object.assign(new Error(code), { code }); };
      if (scenario.access !== 'premium') reject('PREMIUM_REQUIRED');
      if (question.length < 6 || question.length > 500 || /(?:рецепт|борщ|погод[ауы]|напиши\s+код|sql|linux|купить\s+акци|recipe)/iu.test(question)) reject('NATAL_QUESTION_REJECTED');
      if (!current.usage.remaining) reject('NATAL_QUESTION_DAILY_LIMIT');
      const paragraphs = catalog.categoryPacks.main?.summary || [];
      const observation = paragraphs[/решени|decision/iu.test(question) ? 2 : /сильн|работ|work/iu.test(question) ? 4 : /люди|людям|people/iu.test(question) ? 6 : 0] || paragraphs[0];
      if (!observation) reject('NATAL_QUESTION_GENERATION_FAILED');
      const id = current.messages.length + 1;
      const common = { threadId: 1, userId: String(profile.id), chartId: 1, createdAt: new Date().toISOString() };
      const used = current.usage.used + 1;
      current = { ...current, usage: { ...current.usage, used, remaining: limit - used }, access: { ...current.access, freeQuestionRemaining: Math.max(0, 1 - used) }, messages: [...current.messages,
        { ...common, id, role: 'user', text: question, payload: null },
        { ...common, id: id + 1, role: 'assistant', text: observation.text, payload: { questionMessageId: id, evidenceIds: observation.evidenceIds } },
      ] };
      return current;
    } };
  }, [scenario.access, scenario.state, profile.id, catalog]);
  const partner = UI_PREVIEW_COMPATIBILITY.partner;
  const prefill = useMemo(() => ({ source: 'manual' as const, partnerName: partner.name, partnerDate: partner.date, partnerTime: partner.time, partnerPlace: partner.place }), [partner]);
  const forecasts = useMemo(() => {
    const result: NeboDashboardPreview['forecasts'] = {};
    for (const item of ['day', 'week', 'month'] as const) {
      const base = createUnavailablePersonalForecast(item, getPersonalForecastPeriodKey(item, new Date(), 'Europe/Moscow'), 'Europe/Moscow', 'ru', 'generating', 'UI_PREVIEW');
      if (sample) {
        result[item] = { forecast: sample.forecasts[item] || { ...base, meta: { ...base.meta, status: 'unavailable', diagnosticCode: 'SAMPLE_GENERATION_PENDING' } }, accessTier: scenario.access, lockedSectionIds: [], periodLocked: false, source: 'local' };
        continue;
      }
      result[item] = { forecast: base, accessTier: scenario.access, lockedSectionIds: [], periodLocked: false, source: 'local' };
    }
    return result;
  }, [scenario.access, sample]);
  const update = (change: Partial<Scenario>) => {
    const next = { ...scenario, ...change };
    setScenario(next);
    const query = new URLSearchParams(window.location.search);
    query.set('uiPreview', '1'); query.set('design', 'nebo');
    for (const key of ['screen', 'theme', 'access', 'state', 'person'] as const) query.set(key, next[key]);
    if (!next.controls) query.set('controls', '0'); else query.delete('controls');
    window.history.replaceState(null, '', `${window.location.pathname}?${query.toString()}`);
  };
  const routeHistory = React.useRef<Array<{ scenario: Scenario; scroll: number[] }>>([]);
  const restoreScroll = React.useRef<number[] | null>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => { if (restoreScroll.current) { Array.from(document.querySelectorAll<HTMLElement>('.nebo-reader-scroll,.nebo-layer-back,.nebo-layer-scroll')).filter(el => el.offsetParent !== null).forEach((el,i) => { el.scrollTop = restoreScroll.current![i] || 0; }); restoreScroll.current = null; } });
    return () => cancelAnimationFrame(frame);
  }, [scenario.screen]);
  const go = (screen: Screen) => { if (screen !== scenario.screen) routeHistory.current.push({ scenario, scroll: Array.from(document.querySelectorAll<HTMLElement>('.nebo-reader-scroll,.nebo-layer-back,.nebo-layer-scroll')).filter(el => el.offsetParent !== null).map(el => el.scrollTop) }); update({ screen, state: 'ready' }); };
  useEffect(() => {
    const back = () => { const previous = routeHistory.current.pop(); if (previous) { restoreScroll.current = previous.scroll; update(previous.scenario); } };
    window.addEventListener('nebo:header-back', back);
    return () => window.removeEventListener('nebo:header-back', back);
  });
  useEffect(() => {
    const pop = () => setScenario(parseNeboPreviewScenario(window.location.search));
    window.addEventListener('popstate', pop); return () => window.removeEventListener('popstate', pop);
  }, []);
  useEffect(() => {
    const wasDark = document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', scenario.theme === 'dark');
    return () => { document.documentElement.classList.toggle('dark', wasDark); };
  }, [scenario.theme]);
  const previewKey = `${scenario.screen}:${scenario.access}:${scenario.state}:${scenario.person}`;
  const openPremium = () => go('paywall');
  const settings = <Settings profile={profile} onUpdate={(next) => setProfilePatch(next)} onRequestPremium={openPremium} onOpenCharts={() => go('charts')} onBack={() => go('menu')} onLogout={async () => go('onboarding')} onDeleteAccount={async () => go('onboarding')} onRestorePurchase={async () => 'completed'} presentation="nebo" embedded uiPreview={UI_PREVIEW_SETTINGS}/>;
  const paywall = <Paywall profile={profile} context={context} onPurchase={async () => { update({ access: 'premium', screen: 'today' }); }} onClose={() => go('today')} onContinueFree={() => go('today')} onRestore={async () => 'completed'} presentation="nebo" embedded uiPreview={{ plans: UI_PREVIEW_PAYWALL_PLANS }}/>;
  let content: React.ReactNode;
  if (scenario.screen === 'today') content = <NeboDashboard profile={profile} requestedPeriod={period} onPeriodChange={setPeriod} onCreateNatalChart={() => go('natal')} onOpenCharts={() => go('charts')} onOpenSynastry={() => go('compatibility')} onOpenMatrix={() => go('matrix')} onOpenSettings={() => go('settings')} onRequestPremium={openPremium} uiPreview={{ forecasts, chartData: sample?.chart || chart, questions, topicsByPeriod: sample ? Object.fromEntries(Object.entries(sample.microForecasts || {}).map(([key, pack]) => [key, pack.topics])) : {}, futureForecasts: sample ? sample.futureForecasts || [] : [], charts, phase: scenario.state }}/>;
  else if (scenario.screen.startsWith('natal') || scenario.screen === 'question') content = <NeboNatal profile={profile} data={chart} chartId={1} requestPremium={openPremium} onOpenPersonalityReport={() => go('natal')} onOpenMatrix={() => go('matrix')} onOpenSettings={() => go('settings')} onOpenCharts={() => go('charts')} onCreateChart={() => go('onboarding')} uiPreview={{ questions, futureReadings: sample?.futureForecasts || [], initialTab: scenario.screen === 'natal-map' ? 'map' : scenario.screen === 'question' ? 'questions' : 'reading', catalog: { ...catalog, state: scenario.state } }}/>;
  else if (scenario.screen.startsWith('compatibility')) content = <NeboUnionRoom profile={profile} chartData={chart} chartId={1} initialPrefill={prefill} onOpenCharts={() => go('charts')} onOpenProfile={() => go('settings')} requestPremium={openPremium} uiPreview={{ result: compatibility, signResult: UI_PREVIEW_COMPATIBILITY.signCompatibility, charts, screen: scenario.screen === 'compatibility-input' ? 'create' : scenario.screen === 'compatibility-result' ? 'result' : 'home', mode: 'birth', phase: scenario.state }}/>;
  else if (scenario.screen.startsWith('matrix')) content = <NeboMatrixRoom onOpenCharts={() => go('charts')} profile={profile} onBack={() => go('today')} onOpenProfile={() => go('settings')} uiPreview={{ initialView: scenario.screen === 'matrix-scheme' ? 'scheme' : 'overview' }}/>;
  else if (scenario.screen === 'charts') content = <NeboMyCharts profile={profile} onOpenProfile={() => go('settings')} onChartSelect={() => go('natal')} onUseInSynastry={() => go('compatibility-input')} onRequestPremium={openPremium} uiPreview={{ charts, chartSlots: 10, canAddMore: true, canAddSavedPeople: true, isPremium: scenario.access === 'premium' }} uiPreviewPhase={scenario.state}/>;
  else if (scenario.screen === 'horoscope') content = <NeboHoroscopeReader profile={profile} chartData={chart} onOpenCharts={() => go('charts')} onOpenProfile={() => go('settings')} onRequestPremium={openPremium} uiPreview={{ readings: UI_PREVIEW_HOROSCOPE.readings, phase: scenario.state }}/>;
  else if (scenario.screen === 'paywall') content = paywall;
  else if (scenario.screen === 'onboarding') content = <Onboarding presentation="nebo" initialProfile={profile} onComplete={async (next) => { setProfilePatch(next); go('today'); }} onSkip={() => go('today')} onSignIn={() => go('settings')}/>;
  else content = settings;
  if (!allowed) return null;
  const shell = ['settings', 'menu', 'paywall', 'onboarding'].includes(scenario.screen);
  return <div className={styles.root}>
    {scenario.person !== 'demo' && new URLSearchParams(window.location.search).get('sampleControls') !== '0' && <aside className={styles.sampleTools} aria-label="Выбрать пример"><p>Три вымышленных человека · тексты Luna</p><div>{SAMPLE_PEOPLE.map(person => <button type="button" key={person.id} aria-pressed={scenario.person === person.id} onClick={() => { setProfilePatch({}); update({ person: person.id }); }}>{person.name}</button>)}</div></aside>}
    {scenario.controls && <aside className={styles.controls} aria-label="Локальный предпросмотр"><span>NEBO · тестовые данные</span><label>Экран<select value={scenario.screen} onChange={(event) => update({ screen: event.target.value as Screen })}>{NEBO_PREVIEW_SCREENS.map((screen) => <option value={screen} key={screen}>{LABELS[screen]}</option>)}</select></label><label>Тема<select value={scenario.theme} onChange={(event) => update({ theme: event.target.value as Scenario['theme'] })}><option value="light">Светлая</option><option value="dark">Тёмная</option></select></label><label>Доступ<select value={scenario.access} onChange={(event) => { setProfilePatch({}); update({ access: event.target.value as Scenario['access'] }); }}><option value="free">Бесплатно</option><option value="premium">Premium</option></select></label><label>Состояние<select value={scenario.state} onChange={(event) => update({ state: event.target.value as Scenario['state'] })}><option value="ready">Готово</option><option value="loading">Загрузка</option><option value="error">Ошибка</option></select></label></aside>}
    <div className={`nebo-v2 lumia-app-shell ${styles.app}`} data-nebo-theme={scenario.theme} data-nebo-view={viewFor(scenario.screen)}><main className={`${styles.main} ${shell ? `nebo-v2-shell ${styles.scroll}` : ''}`} key={previewKey}>{content}</main>{!['paywall', 'onboarding'].includes(scenario.screen) && <NeboTabBar profile={profile} view={viewFor(scenario.screen)} onOpenToday={() => go('today')} onOpenZodiac={() => go('horoscope')} onOpenNatal={() => go('natal')} onOpenCompatibility={() => go('compatibility')} onOpenServices={() => go('menu')}/>}</div>
  </div>;
}
