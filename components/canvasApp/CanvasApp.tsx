import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import React, { useEffect, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import Component from '../../lib/canvasApp/canvasLogic';
import { CANVAS_CSS, CANVAS_FONTS } from '../../lib/canvasApp/canvasStyles';
import { buildCanvasChapters, buildCanvasPeople, buildCanvasRealData, buildCanvasToday, canvasDateLine, canvasSignKey, type CanvasRealData } from '../../lib/canvasApp/realData';
import { getCachedDailySignHoroscope, getCachedWeeklySignHoroscope, getCompatibilityPreview, type CompatibilityPreviewPerson } from '../../services/astrologyService';
import type { CompatibilityPreview } from '../../lib/synastry/compatibilityPreview';
import type { RelationshipContext } from '../../lib/synastry/relationshipContext';
import { loadPersonalForecast } from '../../services/personalForecastService';
import type { NatalUnifiedReading } from '../../lib/natalReading/unifiedReading';
import { ensureNatalUnifiedReading } from '../../services/natalUnifiedReadingService';
import type { NatalChartData, UserProfile } from '../../types';
import { readLocalNatalChartCache } from '../../lib/localNatalChartCache';
import { getChartData, getCharts, getProfile } from '../../services/storageService';
import { buyOneTimeProduct, canBuyOneTimeProducts } from '../../services/oneTimePurchaseService';
import { requestRuStorePayment } from '../../services/rustorePayService';
import {
  answerNativeNotificationsOffer,
  clearNativeNotifications,
  consumeNativeNotificationTap,
  listenNativeNotificationTap,
  markNativeTodayRead,
  nativeNotificationsAvailable,
  setNativeNotificationContext,
  setNativeNotificationForeground,
  shouldOfferNativeNotifications,
} from '../../services/nativeNotifications';
import { explainMapSelection } from '../NatalReading/mapExplanation';
import { setUiLanguage } from '../../lib/i18n';
import { buildLunarDays, phaseName, SIGNS_IN } from '../../lib/lunarCalendar';
import type { OneTimeProductId } from '../../lib/oneTimeProducts';
import type { PremiumPlanId } from '../../lib/premiumPricing';

type CanvasInstance = {
  state: { popup?: unknown; screen?: string };
  setState: (patch: Record<string, unknown>) => void;
  lastVals?: { bar?: { back?: boolean }; back?: () => void };
  paid: () => void;
  toast: (text: string) => void;
};
const CanvasRoot = Component as unknown as React.ComponentType<Record<string, unknown> & { ref?: React.Ref<CanvasInstance> }>;

const DESIGN_WIDTH = 390;
const MAX_SCALE = 1.3;

/** The design is drawn at 390px: every phone gets it scaled to its width, the height follows the screen. */
function fitToScreen(mount: HTMLElement): void {
  const scale = Math.min(window.innerWidth / DESIGN_WIDTH, MAX_SCALE);
  mount.style.setProperty('zoom', String(scale));
  mount.style.setProperty('--nb-h', `${window.innerHeight / scale}px`);
}

const PLAN_BY_LABEL: ReadonlyArray<[RegExp, PremiumPlanId]> = [[/месяц/, 'premium_month'], [/3 месяца/, 'premium_quarter'], [/год/, 'premium_year']];
const GIFT_BY_LABEL: ReadonlyArray<[RegExp, OneTimeProductId]> = [[/3 месяца/, 'gift_plus_3m'], [/год/, 'gift_plus_12m'], [/месяц/, 'gift_plus_1m']];
const ONE_TIME_BY_KIND: Record<string, OneTimeProductId> = { spread: 'spread_one', runes: 'spread_one', numbers: 'eso_year', tips: 'tips_149' };

const readPref = (key: string): string | undefined => {
  try { return window.localStorage.getItem(`nebo.canvas.${key}`) ?? undefined; } catch { return undefined; }
};
const writePref = (key: string, value: string): void => {
  try { window.localStorage.setItem(`nebo.canvas.${key}`, value); } catch { /* the choice lasts until the app closes */ }
};

type LoadedAccount = { profile: UserProfile; chart: NatalChartData | null; real: CanvasRealData };

async function loadAccount(): Promise<LoadedAccount | null> {
  try {
    const profile = await getProfile({ maxAttempts: 2 });
    if (!profile) return null;
    const chart = profile.isSetup
      ? readLocalNatalChartCache(profile)?.chartData ?? await getChartData().catch(() => null)
      : null;
    return { profile, chart, real: buildCanvasRealData(profile, chart) };
  } catch {
    return null;
  }
}

/** The saved reading only: this never asks for a new generation. */
async function loadReading({ profile, chart }: LoadedAccount): Promise<NatalUnifiedReading | null> {
  if (!chart || !profile.id) return null;
  try {
    return await ensureNatalUnifiedReading({ userId: String(profile.id), chartData: chart, language: 'ru', tier: profile.isPremium ? 'premium' : 'free' });
  } catch {
    return null;
  }
}

/**
 * The canvas as the app. It lives in a shadow root, so the old global CSS of the app
 * cannot touch it and it renders exactly as on the canvas.
 * Sign-in, payment, logout and account deletion are handed to the old screens.
 */
export default function CanvasApp() {
  const host = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const element = host.current;
    if (!element) return undefined;
    let root: Root | null = null;
    let cancelled = false;
    const links = CANVAS_FONTS.map((href) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
      return link;
    });
    const shadow = element.shadowRoot ?? element.attachShadow({ mode: 'open' });
    shadow.innerHTML = '';
    const style = document.createElement('style');
    style.textContent = `:host{all:initial;display:flex;justify-content:center;position:fixed;inset:0;overflow:hidden;overscroll-behavior:none;background:#fff;font-family:Onest,'Segoe UI',sans-serif;}\n${CANVAS_CSS}\n.nbs{overflow-x:hidden!important;overscroll-behavior-x:none;touch-action:pan-y;}`;
    shadow.appendChild(style);
    const mount = document.createElement('div');
    shadow.appendChild(mount);
    mount.style.overflow = 'clip';
    fitToScreen(mount);
    const onResize = () => fitToScreen(mount);
    window.addEventListener('resize', onResize);

    const params = new URLSearchParams(window.location.search);
    // The canvas splash holds the screen while the account loads.
    root = createRoot(mount);
    root.render(<CanvasRoot key="loading" start="splash" hold />);
    const instance = React.createRef<CanvasInstance>();
    const handoff = (flow: string) => window.location.assign(`/?classic=${flow}`);
    let currentProfile: UserProfile | null = null;
    // Real RuStore checkout. Anything RuStore does not sell yet opens the working Plus screen.
    const buy = async (kind: string, label: string) => {
      const app = instance.current;
      const profile = currentProfile;
      if (!app || !profile?.id) return;
      const planLabel = kind === 'plus' ? PLAN_BY_LABEL.slice().reverse().find(([pattern]) => pattern.test(label))?.[1] : undefined;
      const product = kind === 'gift' ? GIFT_BY_LABEL.find(([pattern]) => pattern.test(label))?.[1] : ONE_TIME_BY_KIND[kind];
      if (!canBuyOneTimeProducts() || (!planLabel && !product)) { handoff('pay'); return; }
      if (planLabel) {
        const result = await requestRuStorePayment(profile, planLabel);
        if (result.status === 'completed') {
          app.setState({ account: 'plus', owned: true });
          app.paid();
        } else if (result.status === 'pending') app.toast('Оплата проверяется. Plus включится, как только RuStore её подтвердит.');
        else if (result.status !== 'cancelled') app.toast('Оплата не прошла. Попробуй ещё раз.');
        return;
      }
      const result = await buyOneTimeProduct(String(profile.id), product as OneTimeProductId);
      if (result.status === 'completed') {
        if (result.giftCode) app.toast(`Код подарка: ${result.giftCode}`);
        else app.paid();
      } else if (result.status === 'pending') app.toast('Оплата проверяется. Покупка появится, как только RuStore её подтвердит.');
      else if (result.status !== 'cancelled') app.toast('Покупка сейчас недоступна. Попробуй позже.');
    };
    // Notifications: the same native plumbing the old app uses.
    const notifyCleanup: Array<() => void> = [];
    const startNotifications = (profile: UserProfile) => {
      if (!nativeNotificationsAvailable()) return;
      const accountId = String(profile.id);
      void setNativeNotificationContext({
        accountId, language: profile.language === 'en' ? 'en' : 'ru', isSetup: !!profile.isSetup,
        name: profile.name, birthDate: profile.birthDate, selectedSign: profile.selectedZodiacSign,
      });
      setNativeNotificationForeground(true);
      markNativeTodayRead(accountId);
      const openTap = () => void consumeNativeNotificationTap(accountId).then((route) => {
        const app = instance.current;
        if (!route || !app) return;
        const screen = route === 'today' ? 'today' : route === 'natal' ? 'mine' : route === 'horoscope' ? 'signs' : route === 'mood' ? 'today' : route === 'stories' ? 'rest' : 'pair';
        app.setState({ screen, popup: null });
      });
      openTap();
      void listenNativeNotificationTap(openTap)?.then((listener) => notifyCleanup.push(() => void listener.remove()));
      const onVisibility = () => {
        const visible = document.visibilityState !== 'hidden';
        setNativeNotificationForeground(visible);
        if (visible) openTap();
      };
      document.addEventListener('visibilitychange', onVisibility);
      notifyCleanup.push(() => document.removeEventListener('visibilitychange', onVisibility));
      const offer = window.setTimeout(() => {
        if (shouldOfferNativeNotifications(accountId)) instance.current?.setState({ popup: 'notify' });
      }, 4000);
      notifyCleanup.push(() => window.clearTimeout(offer));
    };
    const answerNotify = (accept: boolean) => {
      if (currentProfile?.id) void answerNativeNotificationsOffer(String(currentProfile.id), accept);
    };
    const backListener = Capacitor.isNativePlatform()
      ? CapacitorApp.addListener('backButton', () => {
        const app = instance.current;
        if (!app) return;
        if (app.state.popup) app.setState({ popup: null });
        else if (app.lastVals?.bar?.back) app.lastVals.back?.();
        else if (app.state.screen !== 'today') app.setState({ screen: 'today' });
        else void CapacitorApp.exitApp();
      })
      : null;
    void loadAccount().then((loaded) => {
      if (cancelled) return;
      const isDev = process.env.NODE_ENV !== 'production';
      // Sign-in and the first form stay on the working old screens until they are wired.
      const demo = isDev && window.location.pathname === '/canvas';
      if (!demo && !loaded?.profile.isSetup) {
        window.location.replace('/?classic=auth');
        return;
      }
      // Saved sign horoscopes only: reading them never starts a generation.
      const signTexts = new Map<string, string | null>();
      let renderNow: () => void = () => undefined;
      const isoDay = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
      const signText = (index: number, period: string): string | null => {
        const key = `${index}:${period}`;
        if (signTexts.has(key)) return signTexts.get(key) ?? null;
        signTexts.set(key, null);
        const sign = canvasSignKey(index);
        const request = period === 'week'
          ? getCachedWeeklySignHoroscope(sign, isoDay(0), 'ru')
          : getCachedDailySignHoroscope(sign, isoDay(period === 'tomorrow' ? 1 : 0), 'ru');
        void request.then((reading) => { if (!cancelled && reading?.text) { signTexts.set(key, reading.text); renderNow(); } }).catch(() => undefined);
        return null;
      };
      // A point of the chart explained from this person's own chart.
      const pointKeys: Record<string, string> = { asc: 'ascendant', dsc: 'descendant', node: 'northNode', snode: 'southNode' };
      const chartsByKey = new Map<string, NatalChartData>();
      let primaryChartId: number | null = null;
      const explainPoint = (whoKey: string, point: string): string | null => {
        const chart = whoKey === 'me' ? loaded?.chart : chartsByKey.get(whoKey);
        if (!chart) return null;
        try {
          const explanation = explainMapSelection(chart as never, { kind: 'point', id: pointKeys[point] ?? point }) as { meaning?: string } | null;
          return explanation?.meaning || null;
        } catch {
          return null;
        }
      };
      // Theme and language chosen on the profile stay after a restart.
      const onPrefs = (prefs: { theme?: string; lang?: string }) => {
        if (prefs.theme) writePref('theme', prefs.theme);
        if (prefs.lang) { writePref('lang', prefs.lang); setUiLanguage(prefs.lang as Parameters<typeof setUiLanguage>[0]); }
      };
      // Compatibility of two real charts: calculated on the server, no AI.
      const pairResults = new Map<string, { status: 'loading' | 'ready' | 'error'; preview?: CompatibilityPreview }>();
      const contextOf: Record<string, RelationshipContext> = { general: 'relationship', romance: 'romance', relationship: 'relationship', ex: 'ex', friendship: 'friendship', family: 'family', work: 'work', boss: 'work', business: 'work' };
      const personOf = (key: string): CompatibilityPreviewPerson | null => {
        if (key === 'me') return primaryChartId != null ? { source: 'saved', chartId: primaryChartId } : { source: 'birth', name: loaded?.profile.name, date: loaded?.profile.birthDate, place: loaded?.profile.birthPlace };
        const id = Number(key.replace('chart', ''));
        return Number.isFinite(id) ? { source: 'saved', chartId: id } : null;
      };
      const pairPreview = (a: string, b: string, context: string) => {
        const key = `${a}|${b}|${context}`;
        const known = pairResults.get(key);
        if (known) return known;
        const first = personOf(a);
        const second = b ? personOf(b) : null;
        if (!first || !second || !loaded) return { status: 'error' as const };
        const entry = { status: 'loading' as const };
        pairResults.set(key, entry);
        void getCompatibilityPreview(loaded.profile, first, second, contextOf[context] ?? 'relationship')
          .then((preview) => { pairResults.set(key, { status: 'ready', preview }); })
          .catch(() => { pairResults.set(key, { status: 'error' }); })
          .finally(() => { if (!cancelled) renderNow(); });
        return entry;
      };
      const render = (real: CanvasRealData | null) => root?.render(
        <CanvasRoot
          key="app"
          ref={instance}
          handoff={real ? handoff : undefined}
          buy={real ? buy : undefined}
          answerNotify={real && nativeNotificationsAvailable() ? answerNotify : undefined}
          start={params.get('start') ?? (real?.me.chartMissing ? 'error' : real ? 'today' : undefined)}
          account={params.get('account') ?? real?.account}
          real={real}
          signText={signText}
          pairPreview={real ? pairPreview : undefined}
          theme={readPref('theme') ?? (loaded?.profile.theme === 'dark' ? 'dark' : undefined)}
          lang={readPref('lang') ?? (loaded?.profile.language === 'en' ? 'en' : undefined)}
          onPrefs={onPrefs}
          explainPoint={real ? explainPoint : undefined}
        />,
      );
      currentProfile = loaded?.profile ?? null;
      if (loaded?.profile) startNotifications(loaded.profile);
      let people: NonNullable<CanvasRealData['people']> = [];
      let reading: NatalUnifiedReading | null = null;
      let today: Record<string, unknown> = { dateLine: canvasDateLine() };
      let moon: Record<string, string> | undefined;
      let retro: CanvasRealData['retro'];
      const compose = (): CanvasRealData | null => (loaded
        ? { ...loaded.real, retro, today: { ...today, moon }, people, me: { ...loaded.real.me, chReal: buildCanvasChapters(loaded.chart, reading, loaded.profile.isPremium) ?? undefined } }
        : null);
      renderNow = () => render(compose());
      render(compose());
      if (loaded) {
        void import('astronomy-engine').then((engine) => {
          const dayMs = 86400000;
          const days = buildLunarDays(engine, new Date(Date.now() - 40 * dayMs), 90);
          const todayIndex = 40;
          const day = days[todayIndex];
          if (day?.mercuryRetrograde) {
            let first = todayIndex; while (first > 0 && days[first - 1].mercuryRetrograde) first -= 1;
            let last = todayIndex; while (last < days.length - 1 && days[last + 1].mercuryRetrograde) last += 1;
            const label = (index: number) => new Date(Date.now() + (index - todayIndex) * dayMs).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
            retro = { active: true, from: label(first), to: label(last) };
          } else retro = { active: false };
          if (cancelled || !day) return;
          const signLine = `Луна ${SIGNS_IN[day.sign]}`;
          moon = {
            moonPhase: phaseName(day.phase),
            moonSign: signLine,
            moonIllum: `Освещена на ${Math.round(((1 - Math.cos((day.phase * Math.PI) / 180)) / 2) * 100)}%`,
            condition: signLine,
          };
          render(compose());
        }).catch(() => undefined);
        void getCharts(String(loaded.profile.id), { repairPrimary: false })
          .then((response) => { if (!cancelled) { primaryChartId = (response.charts ?? []).find((chart) => chart.is_primary)?.id ?? null; people = buildCanvasPeople(response.charts ?? []); (response.charts ?? []).forEach((chart) => chartsByKey.set(`chart${chart.id}`, chart.chart_data)); render(compose()); } })
          .catch(() => undefined);
        void loadReading(loaded).then((value) => { if (!cancelled && value) { reading = value; render(compose()); } });
        if (loaded.profile.isSetup) {
          void loadPersonalForecast({ profile: loaded.profile, period: 'day' })
            .then((result) => { if (!cancelled) { today = buildCanvasToday(result.forecast); render(compose()); } })
            .catch(() => undefined);
        }
      }
    });
    return () => {
      cancelled = true;
      notifyCleanup.forEach((stop) => stop());
      void backListener?.then((listener) => listener.remove());
      window.removeEventListener('resize', onResize);
      window.setTimeout(() => root?.unmount(), 0);
      links.forEach((link) => link.remove());
    };
  }, []);
  return <div ref={host} />;
}
