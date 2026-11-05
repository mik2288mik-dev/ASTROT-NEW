import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import React, { useEffect, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import Component from '../../lib/canvasApp/canvasLogic';
import { CANVAS_CSS, CANVAS_FONTS } from '../../lib/canvasApp/canvasStyles';
import { buildCanvasChapters, buildCanvasMood, buildCanvasOracle, buildCanvasPeriod, buildCanvasPeople, buildCanvasYear, buildCanvasPurchases, buildCanvasRealData, buildCanvasToday, canvasDateLine, canvasSignKey, type CanvasRealData } from '../../lib/canvasApp/realData';
import { calculateExtendedSynastry, getCachedDailySignHoroscope, getCachedWeeklySignHoroscope, getCompatibilityPreview, type CompatibilityPreviewPerson } from '../../services/astrologyService';
import { apiFetch } from '../../services/apiClient';
import { drawPoster, savePoster } from '../../lib/canvasApp/poster';
import { isCanonicalNatalChart } from '../../lib/natalCalculationProof';
import type { NatalChartDataV2 } from '../../lib/natalChartV2Types';
import { RELATIONSHIP_CONTEXT_OPTIONS } from '../../lib/synastry/relationshipContext';
import type { CompatibilityPreview } from '../../lib/synastry/compatibilityPreview';
import type { RelationshipContext } from '../../lib/synastry/relationshipContext';
import { loadPersonalForecast } from '../../services/personalForecastService';
import type { NatalUnifiedReading } from '../../lib/natalReading/unifiedReading';
import { ensureNatalUnifiedReading } from '../../services/natalUnifiedReadingService';
import type { NatalChartData, UserProfile } from '../../types';
import { readLocalNatalChartCache } from '../../lib/localNatalChartCache';
import { getChartData, createChart, deleteChart, getCharts, getProfile } from '../../services/storageService';
import { addFriend, friendErrorText, inviteLink, loadFriends, loadMessages, postMessage, type FriendMessage, type FriendsState } from '../../services/friendsService';
import { getAmbientState, pauseAmbient, playSoundscape, resumeAmbient, setAmbientTimer, stopAmbient, subscribeAmbient } from '../../services/ambientPlayer';
import { tracksOfGroup, type SoundGroup } from '../../lib/soundscapes/library';
import { getCompatScore, sunSignFromDate } from '../../lib/synastry/compatScore';
import { buyOneTimeProduct, canBuyOneTimeProducts, redeemPlusCode, refreshPurchases, resumePendingPurchases, spendSpreadCredit } from '../../services/oneTimePurchaseService';
import { openRuStoreSubscriptionManagement, restoreRuStorePurchases } from '../../services/rustorePayService';
import { requestStoreReviewNow } from '../../services/rustoreReview';
import { reportClientError } from '../../services/clientErrorReport';
import { buildCalculationProof } from '../../lib/natalCalculationProof';
import { hasEsoAccess } from '../../lib/oneTimeProducts';
import { askNatalQuestion, loadNatalQuestionSnapshot } from '../../services/natalQuestionService';
import type { NatalQuestionSnapshot } from '../../lib/natalReading/natalQuestion';
import { requestRuStorePayment } from '../../services/rustorePayService';
import {
  answerNativeNotificationsOffer,
  getNativeNotificationSettings,
  saveNativeNotificationSettings,
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
import { SIGN_NOMINATIVE_RU } from '../../lib/natalMoments';
import { attachTranslatorRoot, initUiLanguage, setUiLanguage } from '../../lib/i18n';
import { getAuthSessionMode, hasTelegramMiniAppContext, requiresExplicitAuthentication, resetAuthSessionMode, setAuthSessionMode } from '../../services/authSessionIntent';
import { authenticateWithProvider, completePasswordReset, loginWithEmailPassword, registerEmailPassword, requestPasswordReset, verifyEmailPasswordRegistration } from '../../services/accountAuthService';
import { completeEntry, readableEntryError, searchBirthCities, type BirthCity } from '../../services/canvasAccess';
import { meetsMinimumPasswordLength } from '../../lib/auth/passwordPolicy';
import { STORE_RELEASE_CONFIG } from '../../lib/storeReleaseConfig';
import { readableAuthError } from '../../views/AuthGate';
import { startGuestAccount } from '../../services/storageService';
import { parseBirthDate } from '../../lib/numerology';
import { getMoscowIsoWeekKey, getMoscowTodayKey } from '../../lib/date-utils';
import { loadZodiacFuture } from '../../services/zodiacFutureService';
import type { SignFutureSelection } from '../../lib/horoscope/signFutureContract';
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

/** App-wide touches: no tap flash, no text selection, moving stars on the night buttons, calm painting while scrolling. */
const APP_CSS = `
.nbs{overflow-x:hidden!important;overscroll-behavior-x:none;touch-action:pan-y;-webkit-overflow-scrolling:touch;}
*{-webkit-tap-highlight-color:transparent;-webkit-touch-callout:none;-webkit-user-select:none;user-select:none;}
input,textarea{-webkit-user-select:text;user-select:text;}
img,video{-webkit-user-drag:none;pointer-events:none;}
button{touch-action:manipulation;outline:none;}
.nbCta{animation:none!important;position:relative;overflow:hidden;isolation:isolate;}
.nbCta::before{content:'';position:absolute;z-index:-1;left:0;top:0;width:200%;height:100%;pointer-events:none;background-image:radial-gradient(1.4px 1.4px at 8% 30%,rgba(255,255,255,.95),transparent),radial-gradient(1px 1px at 19% 72%,rgba(255,255,255,.7),transparent),radial-gradient(1.7px 1.7px at 33% 24%,rgba(255,231,170,.95),transparent),radial-gradient(1px 1px at 41% 60%,rgba(255,255,255,.7),transparent),radial-gradient(1.4px 1.4px at 58% 30%,rgba(255,255,255,.95),transparent),radial-gradient(1px 1px at 69% 72%,rgba(255,255,255,.7),transparent),radial-gradient(1.7px 1.7px at 83% 24%,rgba(255,231,170,.95),transparent),radial-gradient(1px 1px at 91% 60%,rgba(255,255,255,.7),transparent);animation:nbStars 16s linear infinite;will-change:transform;}
@keyframes nbStars{from{transform:translate3d(0,0,0)}to{transform:translate3d(-50%,0,0)}}
@keyframes nbRise{from{transform:translate3d(0,0,0)}to{transform:translate3d(0,-780px,0)}}
@keyframes nbSway{from{transform:translate3d(-9px,0,0) scale(1,.97)}to{transform:translate3d(9px,0,0) scale(.97,1)}}
@keyframes nbDrop0{from{transform:translateY(0) scale(1);opacity:1}to{transform:translateY(-34px) scale(.3);opacity:0}}
.nb-scrolling *{animation-play-state:paused!important;}
`;

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
const ONE_TIME_BY_KIND: Record<string, OneTimeProductId> = {
  spread: 'spread_one', runes: 'spread_one', numbers: 'eso_year', tips: 'tips_149',
  buyNatal: 'natal_full', year: 'year_ahead', packs: 'questions_10', buyPair: 'person_reading', buyPerson: 'person_reading', poster: 'poster_sky',
};

const readPref = (key: string): string | undefined => {
  try { return window.localStorage.getItem(`nebo.canvas.${key}`) ?? undefined; } catch { return undefined; }
};
const writePref = (key: string, value: string): void => {
  try { window.localStorage.setItem(`nebo.canvas.${key}`, value); } catch { /* the choice lasts until the app closes */ }
};

const BACKEND_CONTEXT = Object.fromEntries(RELATIONSHIP_CONTEXT_OPTIONS.map((option) => [option.value, option.backendValue])) as Record<RelationshipContext, string>;

type LoadedAccount = { profile: UserProfile; chart: NatalChartData | null; real: CanvasRealData };

/** Set when the server or the network failed, so the person sees a retry instead of the sign-in screen. */
let accountLoadBroken = false;

async function loadAccount(): Promise<LoadedAccount | null> {
  if (requiresExplicitAuthentication()) return null;
  try {
    const profile = await getProfile({ maxAttempts: 2 });
    if (!profile) return null;
    const chart = profile.isSetup
      ? readLocalNatalChartCache(profile)?.chartData ?? await getChartData().catch(() => null)
      : null;
    return { profile, chart, real: buildCanvasRealData(profile, chart) };
  } catch (error) {
    const status = (error as { status?: number }).status;
    accountLoadBroken = !(typeof status === 'number' && status >= 400 && status < 500);
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
    style.textContent = `:host{all:initial;display:flex;justify-content:center;position:fixed;inset:0;overflow:hidden;overscroll-behavior:none;background:#fff;font-family:Onest,'Segoe UI',sans-serif;}\n${CANVAS_CSS}\n${APP_CSS}`;
    shadow.appendChild(style);
    initUiLanguage();
    attachTranslatorRoot(shadow);
    const mount = document.createElement('div');
    shadow.appendChild(mount);
    mount.style.overflow = 'clip';
    mount.style.boxSizing = 'border-box';
    let scrollIdle = 0;
    const onScroll = () => {
      mount.classList.add('nb-scrolling');
      window.clearTimeout(scrollIdle);
      scrollIdle = window.setTimeout(() => mount.classList.remove('nb-scrolling'), 140);
    };
    shadow.addEventListener('scroll', onScroll, { capture: true, passive: true });
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
    let afterPurchase: ((product: OneTimeProductId) => Promise<void>) | null = null;
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
        if (product === 'spread_one') {
          const opened = await spendSpreadCredit(String(profile.id)).catch(() => false);
          if (!opened) { app.toast('Не получилось открыть купленный расклад. Проверь интернет.'); return; }
        }
        await afterPurchase?.(product as OneTimeProductId);
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
    const renderAccess = (profile: UserProfile | null) => {
      const cameIn = () => { try { window.localStorage.setItem('nebo.canvas.tour', '1'); } catch { /* the hints are optional */ } window.location.replace('/'); };
      let challengeId = '';
      let cityTimer = 0;
      const fail = (app: CanvasInstance, error: unknown) => {
        app.setState({ authBusy: false });
        const text = readableAuthError(error);
        if (text) app.toast(text);
      };
      const access = {
        provider: (provider: 'yandex' | 'vk', app: CanvasInstance) => {
          void authenticateWithProvider(provider, 'login').then((result) => { if (result) cameIn(); }).catch((error) => fail(app, error));
        },
        guest: (app: CanvasInstance) => {
          setAuthSessionMode('guest');
          void startGuestAccount().then(cameIn).catch((error: unknown) => { resetAuthSessionMode(); fail(app, error); });
        },
        submit: (mode: string, draft: { email?: string; password?: string; confirm?: string; code?: string }, app: CanvasInstance) => {
          const email = (draft.email ?? '').trim();
          const password = draft.password ?? '';
          const confirm = draft.confirm ?? '';
          if (mode !== 'reset' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) { app.toast('Проверь почту: похоже, в ней ошибка'); return; }
          if (mode !== 'forgot' && !password) { app.toast('Напиши пароль'); return; }
          if ((mode === 'register' || mode === 'reset') && !meetsMinimumPasswordLength(password)) { app.toast('Пароль должен быть не короче 8 символов'); return; }
          if ((mode === 'register' || mode === 'reset') && password !== confirm) { app.toast('Пароли не совпадают'); return; }
          if (mode === 'reset' && !/^\d{6}$/u.test((draft.code ?? '').trim())) { app.toast('В коде из письма шесть цифр'); return; }
          app.setState({ authBusy: true });
          const done = (patch: Record<string, unknown>) => app.setState({ authBusy: false, ...patch });
          if (mode === 'login') { void loginWithEmailPassword(email, password).then(cameIn).catch((error) => fail(app, error)); return; }
          if (mode === 'register') {
            void registerEmailPassword({ email, password, passwordConfirmation: confirm })
              .then((result) => { challengeId = result.challengeId; done({ screen: 'code', codeTyped: '', codeState: 'idle' }); app.toast('Код отправили на почту'); })
              .catch((error) => fail(app, error));
            return;
          }
          if (mode === 'forgot') {
            void requestPasswordReset(email)
              .then((result) => { challengeId = result.challengeId; done({ authMode: 'reset' }); })
              .catch((error) => fail(app, error));
            return;
          }
          void completePasswordReset({ challengeId, code: (draft.code ?? '').trim(), password, passwordConfirmation: confirm }).then(cameIn).catch((error) => fail(app, error));
        },
        verify: (code: string, app: CanvasInstance) => {
          void verifyEmailPasswordRegistration(challengeId, code).then(cameIn).catch(() => app.setState({ codeState: 'error' }));
        },
        cities: (text: string, app: CanvasInstance) => {
          window.clearTimeout(cityTimer);
          cityTimer = window.setTimeout(() => {
            void searchBirthCities(text).then((cities) => app.setState({ entCities: cities })).catch(() => undefined);
          }, 300);
        },
        open: (document: 'terms' | 'consent') => {
          window.open(document === 'terms' ? STORE_RELEASE_CONFIG.termsUrl : STORE_RELEASE_CONFIG.consentUrl, '_blank');
        },
        enter: (form: { d: number; m: number; y: number; noTime: boolean; time: string; city: string; pick: BirthCity | null; consent: boolean; name: string; gender: 'male' | 'female' | null }, app: CanvasInstance) => {
          const date = new Date(Date.UTC(form.y, form.m - 1, form.d));
          if (date.getUTCDate() !== form.d || date.getTime() > Date.now()) { app.toast('Проверь дату рождения'); return; }
          if (!form.noTime && !/^([01]\d|2[0-3]):[0-5]\d$/u.test(form.time)) { app.toast('Напиши время рождения или отметь, что не знаешь его'); return; }
          if (!form.city.trim()) { app.toast('Напиши город рождения'); return; }
          if (!form.name.trim()) { app.toast('Напиши, как тебя зовут'); return; }
          if (!form.consent) { app.toast('Отметь согласие, без него мы не можем посчитать карту'); return; }
          const account = profile;
          if (!account) return;
          app.setState({ screen: 'calc', calcStep: 0 });
          const steps = window.setInterval(() => app.setState({ calcStep: Math.min(4, Number((app.state as { calcStep?: number }).calcStep ?? 0) + 1) }), 900);
          void completeEntry(account, {
            name: form.name.trim(), gender: form.gender,
            birthDate: `${form.y}-${String(form.m).padStart(2, '0')}-${String(form.d).padStart(2, '0')}`,
            birthTime: form.noTime ? '' : form.time, birthPlace: form.city.trim(), city: form.pick,
          }).then(cameIn).catch((error) => {
            window.clearInterval(steps);
            app.setState({ screen: 'entry' });
            app.toast(readableEntryError(error));
          });
        },
      };
      const parts = profile ? parseBirthDate(profile.birthDate) : null;
      const firstName = profile && !profile.isGuest ? (profile.name ?? '').trim().split(/\s+/u)[0] : '';
      root?.render(
        <CanvasRoot
          key="access"
          ref={(app: CanvasInstance | null) => {
            if (app && !(app as unknown as { accessReady?: boolean }).accessReady) {
              (app as unknown as { accessReady?: boolean }).accessReady = true;
              app.setState({ uname: firstName, ...(parts ? { d: parts.day, m: parts.month, y: parts.year, prefill: 'ya' } : {}) });
            }
          }}
          access={access}
          start={profile ? 'entry' : 'auth'}
          account="guest"
          theme={readPref('theme') ?? undefined}
          lang={readPref('lang') ?? undefined}
          onPrefs={(prefs: { theme?: string; lang?: string }) => {
            if (prefs.theme) writePref('theme', prefs.theme);
            if (prefs.lang) { writePref('lang', prefs.lang); setUiLanguage(prefs.lang as Parameters<typeof setUiLanguage>[0]); }
          }}
        />,
      );
    };
    void loadAccount().then((loaded) => {
      if (cancelled) return;
      const isDev = process.env.NODE_ENV !== 'production';
      const demo = isDev && window.location.pathname === '/canvas';
      if (!demo && !loaded?.profile.isSetup) {
        if (hasTelegramMiniAppContext() || accountLoadBroken) {
          window.location.replace('/?classic=auth');
          return;
        }
        // A silent guest made by the first launch still gets to choose how to come in.
        const chooseFirst = !loaded || (loaded.profile.isGuest && getAuthSessionMode() !== 'guest');
        renderAccess(chooseFirst ? null : loaded.profile);
        return;
      }
      // Saved sign horoscopes only: reading them never starts a generation.
      const signTexts = new Map<string, string | null>();
      let renderNow: () => void = () => undefined;
      const signText = (index: number, period: string): string | null => {
        const key = `${index}:${period}`;
        if (signTexts.has(key)) return signTexts.get(key) ?? null;
        signTexts.set(key, null);
        const sign = canvasSignKey(index);
        const today = getMoscowTodayKey();
        if (period === 'tomorrow' && !loaded?.profile.isPremium) {
          signTexts.set(key, 'Гороскоп на завтра открывается в NEBO Plus.');
          return signTexts.get(key) ?? null;
        }
        const tomorrow = new Date(Date.parse(`${today}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);
        const request: Promise<{ text?: string } | null> = period === 'week'
          ? getCachedWeeklySignHoroscope(sign, getMoscowIsoWeekKey(), 'ru', true)
          : period === 'tomorrow'
            ? loadZodiacFuture({ sign: sign as SignFutureSelection['sign'], date: tomorrow, period: 'day', topic: 'general', language: 'ru' })
            : getCachedDailySignHoroscope(sign, today, 'ru', true);
        void request
          .then((reading) => {
            if (cancelled) return;
            if (reading?.text) { signTexts.set(key, reading.text); renderNow(); return; }
            window.setTimeout(() => signTexts.delete(key), 60000);
          })
          .catch(() => { window.setTimeout(() => signTexts.delete(key), 60000); });
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
      // Friends and messages: the same service as the old screen.
      let friends: NonNullable<CanvasRealData['friends']> = [];
      let friendCode = '';
      let soundFailed = false;
      notifyCleanup.push(subscribeAmbient(() => {
        const failed = getAmbientState().error;
        if (failed && !soundFailed) instance.current?.toast('Не получилось включить звук. Проверь интернет и попробуй ещё раз.');
        soundFailed = failed;
      }));
      notifyCleanup.push(stopAmbient);
      const ambient = {
        play: (sound: string) => {
          const groups: Record<string, SoundGroup> = { sea: 'sea', rain: 'rain', forest: 'forest', stream: 'stream' };
          const track = tracksOfGroup(groups[sound] ?? 'sea')[0];
          if (track) playSoundscape(track.id);
        },
        pause: pauseAmbient,
        resume: resumeAmbient,
        stop: stopAmbient,
        timer: (minutes: number | null) => setAmbientTimer(minutes),
      };
      const copyText = (text: string, app: CanvasInstance) => {
        void navigator.clipboard?.writeText(text).then(() => app.toast('Скопировано')).catch(() => app.toast(text));
      };
      const applyFriends = (state: FriendsState) => {
        friendCode = state.code;
        const mySign = sunSignFromDate(loaded?.profile.birthDate);
        friends = state.friends.map((friend) => {
          const sign = friend.birthDate ? sunSignFromDate(friend.birthDate) : null;
          return {
            id: friend.id, name: friend.name, sign: sign ? (SIGN_NOMINATIVE_RU[sign] ?? '') : '', last: friend.lastMessage?.body ?? '',
            match: mySign && sign ? `${getCompatScore(mySign, sign).overall}%` : '', unread: friend.unread,
          };
        });
      };
      // The week and month forecasts are written only when someone opens that tab.
      const periodTexts = new Map<string, { title: string; text: string; lock?: boolean } | null>();
      const periodText = (period: string) => {
        if (period !== 'week' && period !== 'month') return null;
        if (periodTexts.has(period)) return periodTexts.get(period) ?? null;
        periodTexts.set(period, null);
        if (!loaded) return null;
        if (!loaded.profile.isPremium) {
          const free = { title: period === 'week' ? 'Прогноз на эту неделю' : 'Прогноз на этот месяц', text: 'Личный текст о том, что ждёт тебя дальше, открывается в NEBO Plus.', lock: true };
          periodTexts.set(period, free);
          return free;
        }
        void loadPersonalForecast({ profile: loaded.profile, period })
          .then((result) => {
            const overview = result.forecast?.overview;
            if (cancelled || !overview?.text) { periodTexts.delete(period); return; }
            periodTexts.set(period, { title: overview.title || '', text: overview.text });
            renderNow();
          })
          .catch(() => { window.setTimeout(() => periodTexts.delete(period), 60000); });
        return null;
      };
      const reloadPeople = async () => {
        if (!loaded) return;
        const response = await getCharts(String(loaded.profile.id), { repairPrimary: false });
        if (cancelled) return;
        primaryChartId = (response.charts ?? []).find((chart) => chart.is_primary)?.id ?? null;
        people = buildCanvasPeople(response.charts ?? []);
        (response.charts ?? []).forEach((chart) => chartsByKey.set(`chart${chart.id}`, chart.chart_data));
        renderNow();
      };
      const chartAdd = (draft: { name?: string; date?: string; time?: string; place?: string }, app: CanvasInstance) => {
        const name = (draft.name ?? '').trim();
        const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(draft.date ?? '');
        const birth = match ? new Date(Date.UTC(+match[3], +match[2] - 1, +match[1])) : null;
        const validDate = !!match && !!birth && birth.getUTCDate() === +match[1] && birth.getUTCMonth() === +match[2] - 1 && birth.getTime() <= Date.now();
        const time = (draft.time ?? '').trim();
        const place = (draft.place ?? '').trim();
        if (!name) { app.toast('Напиши имя человека'); return; }
        if (!validDate) { app.toast('Проверь дату: день, месяц и год'); return; }
        if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) { app.toast('Проверь время: часы и минуты, например 14:30'); return; }
        if (!place) { app.toast('Напиши город рождения'); return; }
        if (!loaded) return;
        app.setState({ addBusy: true });
        void createChart(String(loaded.profile.id), {
          name, birthDate: `${match![3]}-${match![2]}-${match![1]}`, birthTime: time, birthTimeMode: time ? 'exact' : 'unknown',
          birthTimeUncertaintyMinutes: null, birthPlace: place, language: 'ru', relationLabel: null,
        }).then(async (chart) => {
          await reloadPeople();
          (app as unknown as { addDraft?: unknown }).addDraft = {};
          app.setState({ addBusy: false, popup: null, screen: 'mine', seg: 'natal', chartOf: `chart${chart.id}` });
          app.toast('Карта добавлена');
        }).catch((error: Error) => {
          app.setState({ addBusy: false });
          app.toast(/[а-яё]/i.test(error.message) ? error.message : 'Не получилось посчитать карту. Проверь город и попробуй ещё раз.');
        });
      };
      const chartDelete = (key: string, app: CanvasInstance) => {
        const id = Number(String(key).replace('chart', ''));
        if (!loaded || !Number.isSafeInteger(id) || id <= 0) return;
        void deleteChart(id, String(loaded.profile.id)).then(async () => {
          await reloadPeople();
          app.setState({ popup: null, chartOf: 'me' });
          app.toast('Карта удалена');
        }).catch(() => { app.setState({ popup: null }); app.toast('Не получилось удалить карту. Попробуй ещё раз.'); });
      };
      const friendAdd = (code: string, app: CanvasInstance) => {
        if (!code.trim()) { app.toast('Введи код друга'); return; }
        void addFriend(code.trim())
          .then((state) => { applyFriends(state); app.setState({ fScr: 'list' }); app.toast('Друг добавлен'); if (!cancelled) renderNow(); })
          .catch((error: Error) => app.toast(friendErrorText(error.message)));
      };
      const chats = new Map<string, FriendMessage[]>();
      let activeChat = '';
      const refreshChat = (id: string) => {
        void loadMessages(id).then(({ messages }) => { chats.set(id, messages); if (!cancelled) renderNow(); }).catch(() => undefined);
      };
      const chatPoll = window.setInterval(() => { if (activeChat && document.visibilityState !== 'hidden') refreshChat(activeChat); }, 6000);
      notifyCleanup.push(() => window.clearInterval(chatPoll));
      const clock = (at: string) => new Date(at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
      const friendMessages = (id: string, open: boolean) => {
        const nextActive = open ? id : '';
        if (nextActive && nextActive !== activeChat) refreshChat(nextActive);
        activeChat = nextActive;
        return (chats.get(id) ?? []).map((message) => [message.mine ? 'out' : 'in', message.kind === 'card' ? '' : message.body, clock(message.at), message.kind === 'card' ? [message.payload?.kicker ?? '', message.payload?.title ?? message.body] : undefined]);
      };
      const friendSend = (id: string, body: string) => {
        void postMessage(id, body)
          .then(({ message }) => { chats.set(id, [...(chats.get(id) ?? []), message]); if (!cancelled) renderNow(); })
          .catch((error: Error) => instance.current?.toast(friendErrorText(error.message)));
      };
      let notif: CanvasRealData['notif'] = null;
      let purchases: string[][] = [];
      let year: CanvasRealData['year'];
      let productState: Partial<CanvasRealData> = {};
      let natalOwned = false;
      const reloadPurchases = async () => {
        if (!loaded?.profile.id) return;
        const snapshot = await refreshPurchases(String(loaded.profile.id));
        esoAccess = hasEsoAccess(snapshot);
        natalOwned = Boolean(snapshot.natalFull);
        productState = { natalFull: natalOwned, yearAhead: Boolean(snapshot.yearAhead), questionCredits: snapshot.questionCredits ?? 0, personCredits: snapshot.personCredits ?? 0, posterCredits: snapshot.posterCredits ?? 0, posterPreview: posterSample() };
        purchases = buildCanvasPurchases(loaded.profile, snapshot);
        if (!cancelled) renderNow();
      };
      const canonicalChart = () => (loaded?.chart && isCanonicalNatalChart(loaded.chart) ? (loaded.chart as unknown as NatalChartDataV2) : null);
      const posterLines = () => ({ name: loaded?.profile.name || '', birth: String(loaded?.real.me.sub ?? '') });
      let posterCache: string | undefined;
      const posterSample = (): string | undefined => {
        const chart = canonicalChart();
        if (!chart) return undefined;
        if (!posterCache) { try { posterCache = drawPoster(chart, posterLines(), 700, true).toDataURL('image/jpeg', 0.8); } catch { posterCache = undefined; } }
        return posterCache;
      };
      afterPurchase = async (product) => {
        await reloadPurchases().catch(() => undefined);
        if (product === 'natal_full') {
          const value = await ensureNatalUnifiedReading({ userId: String(loaded?.profile.id), chartData: loaded?.chart as NatalChartData, language: 'ru', tier: 'premium' }).catch(() => null);
          if (value) reading = value;
        }
        if (product === 'poster_sky') {
          const chart = canonicalChart();
          if (!chart) throw new Error('POSTER_CHART_MISSING');
          await savePoster(drawPoster(chart, posterLines(), 2480, false), 'nebo-poster.png');
          await apiFetch('/api/me/purchases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'use_poster' }) }).catch(() => undefined);
          await reloadPurchases().catch(() => undefined);
        }
        renderNow();
      };
      // The full reading of a pair: the same paid reading as the old screen.
      const pairFull = (a: string, b: string, context: string, app: CanvasInstance) => {
        const first = personOf(a);
        const second = b ? personOf(b) : null;
        if (!loaded || !first || !second) return;
        app.toast('Готовим полный разбор, это займёт до минуты');
        void calculateExtendedSynastry(
          loaded.profile, second.name ?? '', second.date ?? '', undefined, second.place,
          BACKEND_CONTEXT[contextOf[context] ?? 'relationship'], second.chartId, first.chartId,
          { name: first.name ?? '', date: first.date ?? '', place: first.place, source: first.source },
        ).then((result) => {
          const typed = result as unknown as { storyParagraphs?: Array<{ text: string }>; summary?: string };
          const paragraphs = typed.storyParagraphs?.map((paragraph) => paragraph.text).filter(Boolean) ?? String(typed.summary ?? '').split(/\n\s*\n/u).filter(Boolean);
          app.setState({ screen: 'chapter', chOpen: { title: 'Полный разбор пары', sub: 'По вашим двум картам', paras: paragraphs, locked: false } });
          void reloadPurchases().catch(() => undefined);
        }).catch(() => app.toast('Сейчас не получилось подготовить разбор. Покупка сохранена, попробуй ещё раз позже.'));
      };
      const redeem = async (code: string, app: CanvasInstance) => {
        const result = await redeemPlusCode(code);
        if (result.ok) {
          app.setState({ popup: null, account: 'plus' });
          app.toast(result.days ? `Готово: NEBO Plus включён на ${result.days} дн.` : 'Готово: код применён');
          void reloadPurchases();
        } else app.toast(result.reason === 'NETWORK' ? 'Проверь интернет и попробуй ещё раз.' : 'Такой код не подошёл. Проверь буквы и цифры.');
      };
      const restorePurchases = async (app: CanvasInstance) => {
        try {
          if (loaded?.profile.id && canBuyOneTimeProducts()) {
            await restoreRuStorePurchases(String(loaded.profile.id));
            await resumePendingPurchases(String(loaded.profile.id));
          }
          await reloadPurchases();
          app.toast('Покупки проверены');
        } catch {
          app.toast('Не получилось проверить покупки. Попробуй позже.');
        }
        app.setState({ restoring: false });
      };
      const saveNotif = async (key: string, value: boolean | string, app: CanvasInstance) => {
        if (!loaded?.profile.id || !nativeNotificationsAvailable()) { app.toast('Уведомления настраиваются в приложении на телефоне.'); return; }
        const patch: Record<string, unknown> = key === 'all' ? { enabled: value }
          : key === 'morning' ? { mode: value ? 'daily' : 'important' }
            : key === 'quiet' ? { quietEnabled: value }
              : key === 'time' ? { morningTime: String(value).padStart(5, '0') }
                : { [key]: value };
        try {
          await saveNativeNotificationSettings(String(loaded.profile.id), patch, true);
          notif = await getNativeNotificationSettings(String(loaded.profile.id));
          if (!cancelled) renderNow();
        } catch (error) {
          app.toast((error as Error).message === 'permission_required' ? 'Разреши уведомления для NEBO в настройках телефона.' : 'Не получилось сохранить. Попробуй ещё раз.');
        }
      };
      // Questions about the chart: the same service and limits as the old screen.
      const ask: { question: string; answer: string; error: string; sending: boolean; remaining: number | null } = { question: '', answer: '', error: '', sending: false, remaining: null };
      const askState = () => ask;
      const applySnapshot = (snapshot: NatalQuestionSnapshot) => {
        const lastQuestion = snapshot.messages.filter((message) => message.role === 'user').at(-1);
        const lastAnswer = snapshot.messages.filter((message) => message.role === 'assistant').at(-1);
        ask.question = lastQuestion?.text ?? '';
        ask.answer = lastAnswer?.text ?? '';
        ask.remaining = snapshot.usage.remaining;
      };
      const askQuestion = (question: string) => {
        if (!loaded?.profile.id) return;
        if (!loaded.profile.isPremium && !productState.questionCredits) { instance.current?.setState({ popup: 'packs' }); return; }
        if (ask.sending) return;
        Object.assign(ask, { question, answer: '', error: '', sending: true });
        renderNow();
        void askNatalQuestion(String(loaded.profile.id), question)
          .then(applySnapshot)
          .catch(() => { ask.error = 'Сейчас не получилось ответить. Попробуй ещё раз чуть позже.'; })
          .finally(() => { ask.sending = false; if (!cancelled) renderNow(); });
      };
      if (loaded?.profile.id && loaded.profile.isPremium) void loadNatalQuestionSnapshot(String(loaded.profile.id)).then((snapshot) => { applySnapshot(snapshot); if (!cancelled) renderNow(); }).catch(() => undefined);
      // Canvas messages that stand for a real action.
      const toastAction = (text: string, app: CanvasInstance): boolean => {
        if (text === 'Откроем подписки в RuStore') { void openRuStoreSubscriptionManagement().catch(() => app.toast('Подписками можно управлять в приложении RuStore.')); return true; }
        if (text === 'Откроем чат поддержки' || text === 'Спасибо, прочитаем') { handoff('settings'); return true; }
        if (text.startsWith('Напомним')) return true;
        if (text === 'Спасибо! Отчёт ушёл разработчикам') reportClientError('canvas_error_screen', new Error('reported by user'));
        return false;
      };
      // «Как посчитана карта» for the chart that is open.
      const proofFor = (whoKey: string) => {
        const chart = whoKey === 'me' ? loaded?.chart : chartsByKey.get(whoKey);
        if (!chart) return null;
        try {
          const proof = buildCalculationProof(chart as never, whoKey === 'me' ? (loaded?.profile.name ?? '') : '', 'ru');
          const rows = [
            ['Дата', proof.localDate], ['Время', [proof.localTime ?? 'без времени', proof.utcOffsetText ? `(${proof.utcOffsetText})` : ''].filter(Boolean).join(' ')],
            ['Место', proof.place], ['Координаты', `${proof.latitude.toFixed(2)}°, ${proof.longitude.toFixed(2)}°`],
            ['Зодиак и дома', [proof.zodiac, proof.houseSystem].filter(Boolean).join(', ')],
          ];
          return { rows, text: rows.map(([label, value]) => `${label}: ${value}`).join('\n') };
        } catch {
          return null;
        }
      };
      const proofCopy = (text: string, app: CanvasInstance) => {
        void navigator.clipboard?.writeText(text).then(() => app.toast('Данные скопированы')).catch(() => undefined);
      };
      const proofOpen = () => { window.open('https://www.astro.com/horoscope', '_blank', 'noopener'); };
      let esoAccess = false;
      const oracle = buildCanvasOracle(() => Boolean(loaded?.profile.isPremium) || esoAccess);
      void reloadPurchases().catch(() => undefined);
      if (loaded?.profile.id && nativeNotificationsAvailable()) void getNativeNotificationSettings(String(loaded.profile.id)).then((value) => { notif = value; if (!cancelled) renderNow(); }).catch(() => undefined);
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
          periodText={real ? periodText : undefined}
          ambient={real ? ambient : undefined}
          friendAdd={real ? friendAdd : undefined}
          chartAdd={real ? chartAdd : undefined}
          chartDelete={real ? chartDelete : undefined}
          copyText={real ? copyText : undefined}
          pairFull={real ? pairFull : undefined}
          toastAction={real ? toastAction : undefined}
          requestReview={real ? requestStoreReviewNow : undefined}
          proofFor={real ? proofFor : undefined}
          proofCopy={real ? proofCopy : undefined}
          proofOpen={real ? proofOpen : undefined}
          askQuestion={real ? askQuestion : undefined}
          askState={real ? askState : undefined}
          redeem={real ? redeem : undefined}
          restorePurchases={real ? restorePurchases : undefined}
          saveNotif={real ? saveNotif : undefined}
          oracle={real ? oracle : undefined}
          friendMessages={real ? friendMessages : undefined}
          friendSend={real ? friendSend : undefined}
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
      let mood: CanvasRealData['mood'];
      let retro: CanvasRealData['retro'];
      let moonDays: unknown[][] | undefined;
      let period: CanvasRealData['period'];
      const compose = (): CanvasRealData | null => (loaded
        ? { ...loaded.real, ...productState, friendCode, friendLink: friendCode ? inviteLink(friendCode) : '', year, mood, retro, period, moonDays, friends, notif, purchases, today: { ...today, moon }, people, me: { ...loaded.real.me, chReal: buildCanvasChapters(loaded.chart, reading, loaded.profile.isPremium || natalOwned) ?? undefined } }
        : null);
      renderNow = () => render(compose());
      render(compose());
      if (loaded) {
        void import('astronomy-engine').then((engine) => {
          const dayMs = 86400000;
          // The calendar from the 1st of this month to the end of the next one.
          const nowDate = new Date();
          const firstOfMonth = new Date(Date.UTC(nowDate.getFullYear(), nowDate.getMonth(), 1));
          const span = new Date(nowDate.getFullYear(), nowDate.getMonth() + 1, 0).getDate() + new Date(nowDate.getFullYear(), nowDate.getMonth() + 2, 0).getDate() + new Date(nowDate.getFullYear(), nowDate.getMonth() + 3, 0).getDate();
          period = buildCanvasPeriod(engine, loaded.profile, loaded.chart) ?? undefined;
          mood = buildCanvasMood(engine, loaded.chart) ?? undefined;
          window.setTimeout(() => { if (!cancelled) { try { year = buildCanvasYear(engine, loaded.profile, loaded.chart); renderNow(); } catch { /* the year screen stays on its loading text */ } } }, 300);
          moonDays = buildLunarDays(engine, firstOfMonth, span).map((item) => [
            item.day, item.month, item.sign, item.phase, Math.round(((1 - Math.cos((item.phase * Math.PI) / 180)) / 2) * 100),
            item.exact ? (item.exact.q === 0 ? 1 : 2) : 0, item.eclipse ? 1 : 0, 0, item.mercuryRetrograde ? 1 : 0, '', -1, item.sign,
            Math.floor((item.phase / 360) * 29.53) + 1, -1, '', '', item.weekday,
          ]);
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
        void loadFriends().then((state) => {
          if (cancelled) return;
          applyFriends(state);
          render(compose());
        }).catch(() => undefined);
        void getCharts(String(loaded.profile.id), { repairPrimary: false })
          .then((response) => { if (!cancelled) { primaryChartId = (response.charts ?? []).find((chart) => chart.is_primary)?.id ?? null; people = buildCanvasPeople(response.charts ?? []); (response.charts ?? []).forEach((chart) => chartsByKey.set(`chart${chart.id}`, chart.chart_data)); render(compose()); } })
          .catch(() => undefined);
        try {
          if (window.localStorage.getItem('nebo.canvas.tour') === '1') {
            window.localStorage.removeItem('nebo.canvas.tour');
            window.setTimeout(() => instance.current?.setState({ tour: true, coach: 0, coachSet: 'today', coachRect: null }), 1200);
          }
        } catch { /* the hints are optional */ }
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
