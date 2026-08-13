
import React, { useEffect, useState, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { UserProfile, NatalChartData, ViewState, NatalInterpretationReport } from './types';
import {
    getProfile,
    saveProfile,
    runReferralFromStartParam,
    deleteCurrentAccount,
    logoutCurrentAccount,
    startGuestAccount,
    isProfileAuthenticationError,
    isProfileBlockedError,
    type ChartListItem,
} from './services/storageService';
import {
    APP_SESSION_INVALIDATED_EVENT,
    clearAppSessionAndLocalData,
    isNativeAppRuntime,
    type AppSessionInvalidatedDetail,
} from './services/apiClient';
import { getChartFromDB, getOrCalculateChart, getPrimaryChartId } from './services/chartService';
import { prewarmUserContent } from './services/contentPrewarmService';
import { CACHE_ONLY_PREWARM_BUDGET_MS } from './lib/appStartupFlags';
import { clearLocalNatalChart, readLocalNatalChartCache, writeLocalNatalChart } from './lib/localNatalChartCache';
import {
    clearLocalHumanBaseReport,
    readLocalHumanBaseReportWithFallback,
    writeLocalHumanBaseReport,
} from './lib/localHumanBaseReportCache';
import { getMoscowTodayKey } from './lib/date-utils';
import { resolveStartParamRoute } from './lib/notificationDeepLink';
import { Dashboard } from './views/Dashboard';
import { PromoBanner } from './components/PromoBanner';
import { AppTopBar } from './components/lumia-ui/AppTopBar';
import { LumiaSideDrawer } from './components/lumia-ui/LumiaSideDrawer';
import type { PersonalForecastPeriod } from './lib/personalForecastContract';
import { Loading } from './components/ui/Loading';
import { getText } from './constants';
import { getPaymentProvider } from './services/paymentProvider';
import { restoreRuStorePurchases } from './services/rustorePayService';
import type { PremiumPlanId } from './lib/premiumPricing';
import { getAdminStatus } from './services/adminService';
import { recordNotificationAttribution, recordUserAppEvent, recordUserSession, updateUserNotificationSettings, waitForTelegramInitData } from './services/sessionService';
import { installTelegramFullscreenGuard } from './lib/telegramFullscreen';
import { applyTelegramSafeAreaCssVars, subscribeTelegramContentSafeAreaChanges } from './lib/telegramSafeAreaInsets';
import { useSwipeBack } from './lib/useSwipeBack';
import { isValidUserId } from './lib/userId';
import {
    canAccessFeature,
    getProfilePremiumUntil,
    hasActivePremium,
    type FeatureKey,
} from './lib/accessMatrix';
import { captureAppHomeLayout, installAppDebugGlobal, appDebugLog } from './lib/appDebug';
import {
    clearHumanReadingSessionCache,
    getCachedHumanBaseReport,
    getHumanBaseReportCached,
    prefetchHumanBaseReport,
} from './services/natalReadingService';
import { clearPersonalForecastSessionCache } from './services/personalForecastService';
import { NATIVE_BACK_EVENT, type NativeBackEventDetail } from './lib/nativeBack';
import {
    clearNativeProviderCredentialState,
    loginWithTelegram,
} from './services/accountAuthService';
import {
    getAuthSessionMode,
    hasTelegramMiniAppContext,
    requiresExplicitAuthentication,
    setAuthSessionMode,
    shouldUseTelegramSession,
    type AuthSessionMode,
} from './services/authSessionIntent';

const Onboarding = dynamic(() => import('./views/Onboarding').then((module) => module.Onboarding), {
    ssr: false,
    loading: () => <Loading />,
});
const NatalMagazine = dynamic(() => import('./views/v2/NatalMagazine').then((module) => module.NatalMagazine), { ssr: false });
const HoroscopeReader = dynamic(() => import('./views/v2/HoroscopeReader').then((module) => module.HoroscopeReader), { ssr: false });
const Settings = dynamic(() => import('./views/Settings').then((module) => module.Settings), { ssr: false });
const AdminApp = dynamic(() => import('./views/admin2/AdminApp').then((module) => module.AdminApp), { ssr: false });
const PremiumPreview = dynamic(() => import('./components/PremiumPreview').then((module) => module.PremiumPreview), { ssr: false });
const Paywall = dynamic(() => import('./views/Paywall').then((module) => module.Paywall), { ssr: false });
const UnionRoom = dynamic(() => import('./views/v2/UnionRoom').then((module) => module.UnionRoom), { ssr: false });
const MatrixRoom = dynamic(() => import('./views/v2/MatrixRoom').then((module) => module.MatrixRoom), { ssr: false });
const MyCharts = dynamic(() => import('./views/MyCharts').then((module) => module.MyCharts), { ssr: false });
const AuthGate = dynamic(() => import('./views/AuthGate').then((module) => module.AuthGate), { ssr: false });

// Get owner ID from environment variables for security
const OWNER_ID = process.env.NEXT_PUBLIC_OWNER_ID || '';
const STARTUP_SAFETY_TIMEOUT_MS = 45_000;

if (!OWNER_ID) {
    console.warn('[App] OWNER_ID not configured. Admin features will not be available.');
}

type SynastryPrefill = {
    source: 'saved-chart' | 'manual';
    partnerChartId?: number;
    partnerName?: string;
    partnerDate?: string;
    partnerTime?: string;
    partnerPlace?: string;
} | null;

type ChartLoadState = 'idle' | 'loading' | 'ready' | 'error';
type TelegramWebAppUser = {
    id?: string | number;
    first_name?: string;
    last_name?: string;
    username?: string;
};

function getPrimaryChartLoadKey(profile: UserProfile): string {
    return [
        profile.id || '',
        profile.birthDate || '',
        profile.birthTime || '',
        profile.birthPlace || '',
    ].join('|');
}

function getTelegramDisplayName(tgUser?: TelegramWebAppUser | null): string {
    const fullName = [tgUser?.first_name, tgUser?.last_name]
        .map((part) => String(part || '').trim())
        .filter(Boolean)
        .join(' ')
        .trim();
    if (fullName) return fullName;
    const username = String(tgUser?.username || '').trim();
    return username;
}

function normalizeStartupProfile(
    storedProfile: UserProfile,
    accountId: string | number,
    tgUser: TelegramWebAppUser | null | undefined,
    isAdmin: boolean
): UserProfile {
    const premiumUntil = getProfilePremiumUntil(storedProfile);
    const accessProfile = { ...storedProfile, premiumUntil, isAdmin };
    return {
        ...storedProfile,
        id: String(accountId),
        name: storedProfile.name?.trim() || getTelegramDisplayName(tgUser),
        birthDate: storedProfile.birthDate || '',
        birthTime: storedProfile.birthTime || '',
        birthPlace: storedProfile.birthPlace || '',
        isSetup: !!storedProfile.isSetup,
        language: storedProfile.language || 'ru',
        theme: storedProfile.theme || 'light',
        isPremium: hasActivePremium(accessProfile),
        premiumUntil,
        isAdmin,
    };
}

function needsStartupProfileNormalizationSave(storedProfile: UserProfile): boolean {
    return !storedProfile.language || !storedProfile.theme;
}

const NOTIFICATION_QUERY_VIEWS = new Set<ViewState>([
    'dashboard',
    'horoscope',
    'synastry',
    'settings',
    'charts',
]);

const LEGACY_NOTIFICATION_VIEW_ALIASES: Record<string, ViewState> = {
    daily_love: 'dashboard',
    daily_money: 'dashboard',
    daily_work: 'dashboard',
    daily_goals: 'dashboard',
    personal_forecast: 'dashboard',
};

/**
 * start_param из ссылки пуша (t.me/<bot>?startapp=<code>). Берём из Telegram WebApp,
 * с запасными вариантами из query/hash — на случай, если SDK ещё не инициализировался.
 */
function getStartParamRaw(): string | null {
    if (typeof window === 'undefined') return null;
    const fromTg = (window as any).Telegram?.WebApp?.initDataUnsafe?.start_param;
    if (fromTg) return String(fromTg);
    const search = new URLSearchParams(window.location.search);
    const fromSearch = search.get('startapp') || search.get('tgWebAppStartParam');
    if (fromSearch) return fromSearch;
    const hash = window.location.hash.replace(/^#/, '');
    return new URLSearchParams(hash).get('tgWebAppStartParam') || null;
}

function getStartParamView(): ViewState | null {
    const resolved = resolveStartParamRoute(getStartParamRaw());
    if (!resolved) return null;
    const v = resolved.route.view as ViewState;
    return NOTIFICATION_QUERY_VIEWS.has(v) || v === 'chart' ? v : null;
}

function getRequestedViewFromQuery(): ViewState | null {
    if (typeof window === 'undefined') return null;
    const requested = new URLSearchParams(window.location.search).get('view');
    if (requested) {
        if (LEGACY_NOTIFICATION_VIEW_ALIASES[requested]) return LEGACY_NOTIFICATION_VIEW_ALIASES[requested];
        if (NOTIFICATION_QUERY_VIEWS.has(requested as ViewState)) return requested as ViewState;
    }
    return getStartParamView();
}

type NotificationLaunchParams = {
    source: string | null;
    scenario: string | null;
    nl: string | null;
    section: string | null;
};

function getNotificationLaunchParams(): NotificationLaunchParams | null {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const source = params.get('source');
    if (source !== 'tg_notification') return null;
    return {
        source,
        scenario: params.get('scenario'),
        nl: params.get('nl'),
        section: params.get('todaySection') || null,
    };
}

const App: React.FC = () => {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [chartData, setChartData] = useState<NatalChartData | null>(null);
    const [_chartLoadState, setChartLoadState] = useState<ChartLoadState>('idle');
    const [preloadedHumanReport, setPreloadedHumanReport] = useState<NatalInterpretationReport | null>(null);
    const [activeChartId, setActiveChartId] = useState<number | undefined>(undefined);
    const [activeChartSubject, setActiveChartSubject] = useState<ChartListItem | null>(null);
    const [primaryChartId, setPrimaryChartId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [loadingMessage, setLoadingMessage] = useState<string | undefined>(undefined);
    const [startupError, setStartupError] = useState<string | null>(null);
    const [startupRetryNonce, setStartupRetryNonce] = useState(0);
    const [authSessionMode, setAuthSessionModeState] = useState<AuthSessionMode>('automatic');
    const [authGateMessage, setAuthGateMessage] = useState<string | null>(null);
    const [view, setView] = useState<ViewState>('onboarding');
    const [sideDrawerOpen, setSideDrawerOpen] = useState(false);
    const [dashboardPeriod, setDashboardPeriod] = useState<PersonalForecastPeriod>('day');
    // Когда задан — paywall показан после онбординга; close/«продолжить бесплатно» ведут сюда.
    const [paywallTarget, setPaywallTarget] = useState<ViewState | null>(null);
    const [showPremiumPreview, setShowPremiumPreview] = useState(false);
    const [synastryPrefill, setSynastryPrefill] = useState<SynastryPrefill>(null);
    const [chartsReturnView, setChartsReturnView] = useState<ViewState>('settings');
    const [chartReturnView, setChartReturnView] = useState<ViewState>('dashboard');
    const [currentDateKey, setCurrentDateKey] = useState(() => getMoscowTodayKey());
    const lastSessionPingRef = useRef(0);
    const prewarmCompletedKeyRef = useRef<string | null>(null);
    const primaryChartSessionRef = useRef<{
        key: string;
        data: NatalChartData | null;
        promise: Promise<NatalChartData | null> | null;
    }>({ key: '', data: null, promise: null });
    const primaryChartDataRef = useRef<NatalChartData | null>(null);
    const requestedViewRef = useRef<ViewState | null>(null);
    const notificationLaunchRef = useRef<NotificationLaunchParams | null>(null);
    const notificationAttributionSentRef = useRef(false);
    const premiumReturnInPlaceRef = useRef(false);
    const dashboardScrollRef = useRef<HTMLDivElement | null>(null);
    const appScrollRef = useRef<HTMLDivElement | null>(null);
    const viewRef = useRef<ViewState>('onboarding');
    const onboardingTargetViewRef = useRef<ViewState>('dashboard');
    const onboardingCompletionRef = useRef(false);
    const restoredRuStoreUserRef = useRef<string | null>(null);
    const navigationHistoryRef = useRef<ViewState[]>([]);

    const getFallbackAdminStatus = useCallback((userId?: string | number, storedIsAdmin?: boolean) => {
        return OWNER_ID && userId ? String(userId) === String(OWNER_ID) : !!storedIsAdmin;
    }, []);

    const ADMIN_STATUS_TIMEOUT_MS = 4500;

    const resolveAuthoritativeAdminStatus = useCallback(async (userId?: string | number, storedIsAdmin?: boolean) => {
        const fallbackIsAdmin = getFallbackAdminStatus(userId, storedIsAdmin);

        try {
            const result = await Promise.race([
                getAdminStatus(),
                new Promise<{ isAdmin: boolean }>((_, reject) =>
                    setTimeout(() => reject(new Error('admin-status-timeout')), ADMIN_STATUS_TIMEOUT_MS)
                ),
            ]);
            return result.isAdmin;
        } catch (error: any) {
            console.warn('[App] Failed to fetch authoritative admin status:', error?.message || error);
            return fallbackIsAdmin;
        }
    }, [getFallbackAdminStatus]);

    const prefetchBaseReportForChart = useCallback(async (
        targetProfile: UserProfile,
        targetChartId?: number,
        targetChartData?: NatalChartData | null,
    ) => {
        const userId = targetProfile.id ? String(targetProfile.id) : '';
        if (!userId) return null;
        const cacheContext = { chartData: targetChartData || null };

        const cached = getHumanBaseReportCached(userId, targetChartId, targetProfile.language)
            || readLocalHumanBaseReportWithFallback(targetProfile, targetChartId, cacheContext);
        if (cached) {
            setPreloadedHumanReport(cached);
            return cached;
        }
        const dbCached = await getCachedHumanBaseReport(userId, targetChartId, targetProfile.language).catch((error: any) => {
            console.warn('[App] Human base report cache read failed:', error?.message || error);
            return null;
        });
        if (dbCached) {
            writeLocalHumanBaseReport(targetProfile, dbCached, targetChartId, cacheContext);
            setPreloadedHumanReport(dbCached);
            return dbCached;
        }
        return null;
    }, []);

    const prepareUserContentDbFirst = useCallback(async (input: {
        userId: string;
        chartId: number | null;
        profile: UserProfile;
        chartData: NatalChartData;
        isPremium: boolean;
        dateKey: string;
        progressStart?: number;
        progressSpan?: number;
    }) => {
        const prewarmKey = `${input.userId}:${input.chartId ?? 'primary'}:${input.dateKey}:${input.isPremium ? 'premium' : 'free'}`;
        const progressStart = input.progressStart ?? 68;
        const progressSpan = input.progressSpan ?? 20;

        const cacheResult = await prewarmUserContent({
            userId: input.userId,
            chartId: input.chartId,
            profile: input.profile,
            chartData: input.chartData,
            isPremium: input.isPremium,
            dateKey: input.dateKey,
            mode: 'cache-only',
            blockingBudgetMs: CACHE_ONLY_PREWARM_BUDGET_MS,
            onProgress: (ratio) => setLoadingProgress(progressStart + Math.round(ratio * progressSpan)),
        });

        prewarmCompletedKeyRef.current = prewarmKey;
        void prewarmUserContent({
            userId: input.userId,
            chartId: input.chartId,
            profile: input.profile,
            chartData: input.chartData,
            isPremium: input.isPremium,
            dateKey: input.dateKey,
            mode: 'generate-missing',
        }).catch((error: any) => {
            console.warn('[App] Background personal forecast prewarm failed:', error?.message || error);
        });
        void prefetchBaseReportForChart(
            input.profile,
            input.chartId ?? undefined,
            input.chartData,
        ).catch((error: any) => {
            console.warn('[App] Human base report cache prefetch failed:', error?.message || error);
        });
        return cacheResult;
    }, [prefetchBaseReportForChart]);

    const loadPrimaryChartOnce = useCallback(async (targetProfile: UserProfile): Promise<NatalChartData | null> => {
        const key = getPrimaryChartLoadKey(targetProfile);
        const current = primaryChartSessionRef.current;

        if (current.key === key && current.data?.sun && current.data?.moon && current.data?.rising) {
            setChartData(current.data);
            setChartLoadState('ready');
            return current.data;
        }

        if (current.key === key && current.promise) {
            return current.promise;
        }

        setPreloadedHumanReport(null);
        const localEntry = readLocalNatalChartCache(targetProfile);
        if (localEntry) {
            const cachedChart = localEntry.chartData;
            primaryChartSessionRef.current = { key, data: cachedChart, promise: null };
            primaryChartDataRef.current = cachedChart;
            setChartData(cachedChart);
            setChartLoadState('ready');
            if (localEntry.chartId != null) {
                setPrimaryChartId(localEntry.chartId);
            }

            // DB remains source of truth, but a temporary DB error must not replace a usable local chart.
            void getChartFromDB(String(targetProfile.id))
                .then((freshChart) => {
                    if (!freshChart) return; // Do not recalculate a DB miss while a valid local chart exists.
                    primaryChartSessionRef.current = { key, data: freshChart, promise: null };
                    primaryChartDataRef.current = freshChart;
                    writeLocalNatalChart(targetProfile, freshChart, localEntry.chartId);
                    setChartData(freshChart);
                    setChartLoadState('ready');
                })
                .catch((error: any) => {
                    console.warn('[App] Background primary chart refresh failed; keeping local cache:', error?.message || error);
                });

            return cachedChart;
        }

        setChartLoadState('loading');
        const promise = getOrCalculateChart(targetProfile)
            .then((chart) => {
                if (chart?.sun && chart?.moon && chart?.rising) {
                    primaryChartSessionRef.current = { key, data: chart, promise: null };
                    primaryChartDataRef.current = chart;
                    writeLocalNatalChart(targetProfile, chart);
                    setChartData(chart);
                    setChartLoadState('ready');
                    return chart;
                }

                primaryChartSessionRef.current = { key, data: null, promise: null };
                primaryChartDataRef.current = null;
                setChartData(null);
                setChartLoadState('error');
                return null;
            })
            .catch((error: any) => {
                console.error('[App] Primary chart load failed:', error?.message || error);
                primaryChartSessionRef.current = { key, data: null, promise: null };
                primaryChartDataRef.current = null;
                setChartData(null);
                setChartLoadState('error');
                return null;
            });

        primaryChartSessionRef.current = { key, data: null, promise };
        return promise;
    }, []);

    const resetPrimaryChartState = useCallback(() => {
        primaryChartSessionRef.current = { key: '', data: null, promise: null };
        primaryChartDataRef.current = null;
        setChartData(null);
        setChartLoadState('idle');
        setPrimaryChartId(null);
        setActiveChartId(undefined);
        setActiveChartSubject(null);
        setPreloadedHumanReport(null);
    }, []);

    useEffect(() => {
        installAppDebugGlobal();
        viewRef.current = view;
        appDebugLog('navigation', {
            action: 'view_state',
            view,
            historyDepth: navigationHistoryRef.current.length,
            profileState: profile
                ? {
                    hasProfile: true,
                    isPremium: hasActivePremium(profile),
                    language: profile.language || 'ru',
                    isSetup: !!profile.isSetup,
                }
                : { hasProfile: false },
        });
        if (view === 'dashboard') {
            window.setTimeout(() => captureAppHomeLayout('view_dashboard'), 180);
        }
    }, [profile?.isPremium, profile?.premiumUntil, profile?.isAdmin, profile?.isSetup, profile?.language, view]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const resetScroll = () => {
            const scrollContainer =
                view === 'dashboard' ? dashboardScrollRef.current : appScrollRef.current;
            scrollContainer?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        };

        const frame = window.requestAnimationFrame(resetScroll);
        let nestedFrame: number | null = null;
        const lateFrame = window.requestAnimationFrame(() => {
            nestedFrame = window.requestAnimationFrame(resetScroll);
        });

        return () => {
            window.cancelAnimationFrame(frame);
            window.cancelAnimationFrame(lateFrame);
            if (nestedFrame != null) window.cancelAnimationFrame(nestedFrame);
        };
    }, [loading, view]);

    const trackSessionActivity = useCallback(async (force = false) => {
        if (!profile?.id || typeof window === 'undefined') return;

        const now = Date.now();
        if (!force && now - lastSessionPingRef.current < 30000) {
            return;
        }

        lastSessionPingRef.current = now;

        try {
            const tg = (window as any).Telegram?.WebApp;
            await recordUserSession(tg?.platform || null);
        } catch (error: any) {
            console.warn('[App] Failed to track user session:', error?.message || error);
        }
    }, [profile?.id]);

    useEffect(() => {
        const tg = (window as any).Telegram?.WebApp;
        tg?.ready?.();
        tg?.expand?.();
        tg?.setHeaderColor?.('#FFFFFF');
        tg?.setBackgroundColor?.('#FFFFFF');
        tg?.setBottomBarColor?.('#FFFFFF');
        tg?.enableClosingConfirmation?.();
        appDebugLog('telegram_init', {
            platform: tg?.platform,
            version: tg?.version,
            viewportHeight: tg?.viewportHeight,
            viewportStableHeight: tg?.viewportStableHeight,
            safeAreaInset: tg?.safeAreaInset,
            contentSafeAreaInset: tg?.contentSafeAreaInset,
        });

        const cleanupFullscreenGuard = installTelegramFullscreenGuard();
        return cleanupFullscreenGuard;
    }, []);

    useEffect(() => {
        applyTelegramSafeAreaCssVars();
        return subscribeTelegramContentSafeAreaChanges(applyTelegramSafeAreaCssVars);
    }, []);

    const lumiaAirShell =
        !!profile &&
        !loading &&
        view !== 'onboarding' &&
        view !== 'paywall';

    useEffect(() => {
        const body = document.body;
        body.classList.toggle('theme-lumia-air', lumiaAirShell);

        const theme = profile?.theme || 'dark';
        if (theme === 'light') body.classList.add('theme-light');
        else body.classList.remove('theme-light');

        const tg = (window as any).Telegram?.WebApp;
        if (tg) {
            tg.setHeaderColor?.('#FFFFFF');
            tg.setBackgroundColor?.('#FFFFFF');
            tg.setBottomBarColor?.('#FFFFFF');
        }

        return () => {
            body.classList.remove('theme-lumia-air');
        };
    }, [profile?.theme, lumiaAirShell]);

    useEffect(() => {
        let cancelled = false;
        let safetyCleared = false;
        let startupVisible = false;
        const startupStartedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const startupElapsedMs = () => Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startupStartedAt);
        const logStartupMetric = (name: string, value: number | boolean) => {
            console.info(`[App][Startup] ${name}`, value);
        };
        const safetyTimer = window.setTimeout(() => {
            if (cancelled || safetyCleared) return;
            console.error('[App] Startup exceeded safety budget - unlocking loading UI');
            startupVisible = true;
            safetyCleared = true;
            setStartupError('«Твой Гороскоп» не успел загрузить профиль. Обнови страницу и попробуй ещё раз.');
            setLoadingProgress(100);
            setLoadingMessage(undefined);
            setLoading(false);
        }, STARTUP_SAFETY_TIMEOUT_MS);

        const clearSafety = () => {
            if (safetyCleared) return;
            safetyCleared = true;
            window.clearTimeout(safetyTimer);
        };

        const showStartupDashboard = (targetView: ViewState = 'dashboard') => {
            if (cancelled || startupVisible) return;
            startupVisible = true;
            clearSafety();
            setLoadingProgress(100);
            setLoadingMessage(undefined);
            setView(targetView);
            setLoading(false);
            logStartupMetric('startup_dashboard_visible_ms', startupElapsedMs());
        };

        const scheduleStartupBackgroundWork = (
            targetProfile: UserProfile,
            initialChart: NatalChartData,
            initialChartId: number | null,
            refreshChartFromDb: boolean,
        ) => {
            const userId = String(targetProfile.id);
            const startHumanBasePrefetch = (chartId: number, reportChartData: NatalChartData) => {
                void prefetchHumanBaseReport(userId, chartId, targetProfile.language)
                    .then((report) => {
                        writeLocalHumanBaseReport(targetProfile, report, chartId, {
                            chartData: reportChartData,
                        });
                        if (!cancelled) setPreloadedHumanReport(report);
                    })
                    .catch((error: any) => {
                        console.warn('[App] Human base report background prefetch failed:', error?.message || error);
                    });
            };
            if (initialChartId != null) {
                startHumanBasePrefetch(initialChartId, initialChart);
            }

            void (async () => {
                let chart = initialChart;
                let chartId = initialChartId;

                const chartRefresh = refreshChartFromDb
                    ? getChartFromDB(String(targetProfile.id))
                        .then((freshChart) => {
                            if (!freshChart?.sun || !freshChart?.moon || !freshChart?.rising) return;
                            chart = freshChart;
                            const key = getPrimaryChartLoadKey(targetProfile);
                            primaryChartSessionRef.current = { key, data: freshChart, promise: null };
                            primaryChartDataRef.current = freshChart;
                            writeLocalNatalChart(targetProfile, freshChart, chartId ?? undefined);
                            if (!cancelled) {
                                setChartData(freshChart);
                                setChartLoadState('ready');
                            }
                        })
                        .catch((error: any) => {
                            console.warn('[App] Background primary chart refresh failed; keeping local cache:', error?.message || error);
                        })
                    : Promise.resolve();

                const chartIdRefresh = getPrimaryChartId(String(targetProfile.id))
                    .then((freshPrimaryChartId) => {
                        if (freshPrimaryChartId == null) return;
                        chartId = freshPrimaryChartId;
                        writeLocalNatalChart(targetProfile, chart, freshPrimaryChartId);
                        if (initialChartId == null) startHumanBasePrefetch(freshPrimaryChartId, chart);
                        if (!cancelled) {
                            setPrimaryChartId(freshPrimaryChartId);
                        }
                    })
                    .catch((error: any) => {
                        console.warn('[App] Background primary chart ID refresh failed:', error?.message || error);
                    });

                await Promise.all([chartRefresh, chartIdRefresh]);

                void prepareUserContentDbFirst({
                    userId: String(targetProfile.id),
                    chartId,
                    profile: targetProfile,
                    chartData: chart,
                    isPremium: hasActivePremium(targetProfile),
                    dateKey: getMoscowTodayKey(),
                })
                    .catch((prewarmError: any) => {
                        console.warn('[App] Startup DB-first content flow failed:', prewarmError?.message || prewarmError);
                    })
                    .finally(() => {
                        logStartupMetric('startup_prewarm_done_ms', startupElapsedMs());
                    });
            })();
        };

        const loadData = async () => {
            console.log('[App] === LOADING USER DATA ===');
            setLoadingProgress(10);
            requestedViewRef.current = getRequestedViewFromQuery();
            notificationLaunchRef.current = getNotificationLaunchParams();

            const sessionMode = getAuthSessionMode();
            setAuthSessionModeState(sessionMode);
            const telegramWebApp = (window as any).Telegram?.WebApp;
            if (telegramWebApp) {
                const initData = await waitForTelegramInitData({ maxAttempts: 8, delayMs: 250 });
                if (!initData) {
                    console.warn('[App] Telegram initData not available after bounded wait');
                    logStartupMetric('startup_init_data_missing', true);
                }
                applyTelegramSafeAreaCssVars();
            }
            if (cancelled) return;

            if (requiresExplicitAuthentication(sessionMode)) {
                startupVisible = true;
                clearSafety();
                setProfile(null);
                resetPrimaryChartState();
                setStartupError(null);
                setLoadingProgress(100);
                setLoadingMessage(undefined);
                setLoading(false);
                return;
            }

            try {
                setStartupError(null);
                const tg = (window as any).Telegram?.WebApp;
                const tgUser = tg?.initDataUnsafe?.user as TelegramWebAppUser | undefined;
                const shouldAuthenticateTelegram =
                    shouldUseTelegramSession(sessionMode) && hasTelegramMiniAppContext();

                setLoadingProgress(30);
                let storedProfile: UserProfile | null = null;
                if (shouldAuthenticateTelegram) {
                    // A stale guest cookie must not win over a verified Telegram
                    // launch. The login endpoint resolves account_identities by
                    // Telegram user id and replaces that cookie with the canonical
                    // account session.
                    storedProfile = await loginWithTelegram();
                } else {
                    try {
                        storedProfile = await getProfile();
                    } catch (profileError) {
                        if (!isProfileAuthenticationError(profileError)) throw profileError;

                        if (sessionMode === 'guest' || (!isNativeAppRuntime() && sessionMode === 'automatic')) {
                            setAuthSessionMode('guest');
                            storedProfile = await startGuestAccount();
                        } else {
                            throw profileError;
                        }
                    }
                }

                if (!storedProfile || !isValidUserId(storedProfile.id)) {
                    if (sessionMode === 'guest' || (!isNativeAppRuntime() && sessionMode === 'automatic')) {
                        setAuthSessionMode('guest');
                        storedProfile = await startGuestAccount();
                    }
                }
                if (!storedProfile || !isValidUserId(storedProfile.id)) {
                    throw new Error('PROFILE_NOT_FOUND');
                }
                if (cancelled) return;

                const canonicalUserId = String(storedProfile.id);
                const activeMode: AuthSessionMode = storedProfile.isGuest
                    ? 'guest'
                    : getAuthSessionMode() === 'telegram'
                        ? 'telegram'
                        : 'account';
                setAuthSessionMode(activeMode);
                setAuthSessionModeState(activeMode);
                setAuthGateMessage(null);

                console.log('[App] Profile state loaded:', {
                    hasProfile: true,
                    isSetup: storedProfile.isSetup,
                });

                const isAdmin = storedProfile.isGuest
                    ? false
                    : getFallbackAdminStatus(canonicalUserId, storedProfile.isAdmin);
                const updatedProfile = normalizeStartupProfile(
                    storedProfile,
                    canonicalUserId,
                    tgUser,
                    isAdmin,
                );
                if (needsStartupProfileNormalizationSave(storedProfile)) {
                    void saveProfile(updatedProfile).catch((saveError: any) => {
                        console.warn('[App] Startup profile normalization save failed:', saveError?.message || saveError);
                    });
                }

                setProfile(updatedProfile);
                if (!updatedProfile.isGuest) {
                    void resolveAuthoritativeAdminStatus(canonicalUserId, updatedProfile.isAdmin)
                        .then((isAdmin) => {
                            if (cancelled) return;
                            setProfile((current) => current && String(current.id) === canonicalUserId
                                ? { ...current, isAdmin }
                                : current);
                        });
                }
                logStartupMetric('startup_profile_loaded_ms', startupElapsedMs());

                runReferralFromStartParam(canonicalUserId, (r) => {
                    if (r.ok) {
                        setProfile((p) => (p ? { ...p, referralApplied: true } : p));
                    } else if (r.status === 409) {
                        setProfile((p) => (p ? { ...p, referralApplied: true } : p));
                    }
                });

                if (!updatedProfile.isSetup) {
                    console.log('[App] Profile is not setup; opening birth data without chart/prewarm');
                    logStartupMetric('startup_local_chart_hit', false);
                    resetPrimaryChartState();
                    showStartupDashboard('onboarding');
                    return;
                }

                const localEntry = readLocalNatalChartCache(updatedProfile);
                logStartupMetric('startup_local_chart_hit', !!localEntry);
                if (localEntry) {
                    const key = getPrimaryChartLoadKey(updatedProfile);
                    primaryChartSessionRef.current = { key, data: localEntry.chartData, promise: null };
                    primaryChartDataRef.current = localEntry.chartData;
                    setChartData(localEntry.chartData);
                    setChartLoadState('ready');
                    const startupChartId = localEntry.chartId ?? null;
                    if (startupChartId != null) {
                        setPrimaryChartId(startupChartId);
                        writeLocalNatalChart(updatedProfile, localEntry.chartData, startupChartId);
                    }
                    logStartupMetric('startup_chart_ready_ms', startupElapsedMs());
                    showStartupDashboard('dashboard');
                    scheduleStartupBackgroundWork(updatedProfile, localEntry.chartData, startupChartId, true);
                    return;
                }

                setLoadingMessage(
                    updatedProfile.language === 'en' ? 'Loading Your Horoscope' : 'Загружаем Твой Гороскоп'
                );
                setLoadingProgress(50);
                console.log('[App] Loading primary chart once...');

                const chart = await loadPrimaryChartOnce(updatedProfile);
                if (chart?.sun && chart?.moon) {
                    console.log('[App] Chart loaded successfully');
                    logStartupMetric('startup_chart_ready_ms', startupElapsedMs());
                    showStartupDashboard(requestedViewRef.current || 'dashboard');
                    scheduleStartupBackgroundWork(updatedProfile, chart, null, false);
                } else {
                    console.log('[App] Chart unavailable after startup load, going to dashboard');
                    showStartupDashboard(requestedViewRef.current || 'dashboard');
                }
            } catch (error: any) {
                console.error('[App] Error loading user data:', error);
                resetPrimaryChartState();
                startupVisible = true;
                if (isProfileBlockedError(error)) {
                    await Promise.all([
                        clearAppSessionAndLocalData().catch(() => undefined),
                        clearNativeProviderCredentialState().catch(() => undefined),
                    ]);
                    setAuthSessionMode('signed_out');
                    setAuthSessionModeState('signed_out');
                    setAuthGateMessage('Этот аккаунт заблокирован. Войди в другой аккаунт или обратись в поддержку.');
                    setStartupError(null);
                } else if (isProfileAuthenticationError(error)) {
                    setAuthSessionMode('signed_out');
                    setAuthSessionModeState('signed_out');
                    setAuthGateMessage('Сессия завершена. Войди снова — старый аккаунт и его данные никуда не пропали.');
                    setStartupError(null);
                } else {
                    setStartupError(
                        error?.message === 'PROFILE_NOT_FOUND'
                            ? 'Аккаунт для этой сессии не найден. Выйди на экран входа и авторизуйся снова.'
                            : 'Не удалось загрузить профиль. Проверь соединение и попробуй ещё раз.'
                    );
                }
                setLoadingProgress(100);
                setLoadingMessage(undefined);
                setLoading(false);
            } finally {
                clearSafety();
            }
        };
        
        void loadData();
        return () => {
            cancelled = true;
            clearSafety();
        };
    }, [loadPrimaryChartOnce, prepareUserContentDbFirst, resetPrimaryChartState, resolveAuthoritativeAdminStatus, getFallbackAdminStatus, startupRetryNonce]);

    const handleOnboardingComplete = async (newProfile: UserProfile) => {
        if (onboardingCompletionRef.current) return;
        onboardingCompletionRef.current = true;
        console.log('[App] Onboarding completed');

        const currentProfileId = profile?.id;
        if (!isValidUserId(currentProfileId)) {
            console.error('[App] Cannot complete onboarding without an authenticated account');
            onboardingCompletionRef.current = false;
            throw new Error('Сессия завершена. Войди снова и повтори создание карты.');
        }
        // The server profile is the canonical account. Telegram launch data is
        // only login proof and must never replace a linked guest users.id.
        const safeUserId = String(currentProfileId);
        const isGuestOnboarding = profile?.isGuest === true;
        const isAdmin = isGuestOnboarding ? false : getFallbackAdminStatus(safeUserId, profile?.isAdmin);
        const retainedPremiumUntil = isGuestOnboarding
            ? null
            : getProfilePremiumUntil(profile) ?? getProfilePremiumUntil(newProfile);
        const pendingProfile = {
            ...newProfile,
            isSetup: false,
            id: safeUserId,
            isAdmin,
            isPremium: isGuestOnboarding
                ? false
                : hasActivePremium({ ...newProfile, premiumUntil: retainedPremiumUntil, isAdmin }),
            premiumUntil: retainedPremiumUntil,
            trialStartedAt: isGuestOnboarding ? null : profile?.trialStartedAt ?? newProfile.trialStartedAt,
            loginStreak: profile?.loginStreak ?? newProfile.loginStreak,
            chartSlots: profile?.chartSlots ?? newProfile.chartSlots,
            refCode: profile?.refCode ?? newProfile.refCode,
            referralApplied: profile?.referralApplied ?? newProfile.referralApplied,
            notificationFrequency: newProfile.notificationFrequency ?? profile?.notificationFrequency,
        };
        const fullProfile = { ...pendingProfile, isSetup: true };
        setLoadingProgress(10);

        try {
            // Шаг 1: сохраняем данные без флага завершения. isSetup станет true
            // только после успешного canonical-расчёта карты.
            setLoadingProgress(20);
            let pendingSaveError: any = null;
            for (let attempt = 1; attempt <= 2; attempt++) {
                try {
                    await saveProfile(pendingProfile);
                    pendingSaveError = null;
                    console.log('[App] Pending onboarding profile saved successfully');
                    break;
                } catch (saveError: any) {
                    pendingSaveError = saveError;
                    console.warn(`[App] Profile save attempt ${attempt}/2 failed:`, saveError.message);
                    if (attempt < 2) {
                        await new Promise(r => setTimeout(r, 500));
                    }
                }
            }
            if (pendingSaveError) throw pendingSaveError;

            runReferralFromStartParam(safeUserId, (r) => {
                if (r.ok) {
                    setProfile((p) => (p ? { ...p, referralApplied: true } : p));
                } else if (r.status === 409) {
                    setProfile((p) => (p ? { ...p, referralApplied: true } : p));
                }
            });

            // Шаг 2: Рассчитываем карту через chartService
            // API сам сохранит результат в БД (если БД доступна)
            setLoadingProgress(40);
            console.log('[App] Calculating natal chart...');
            
            const generatedChart = await getOrCalculateChart(pendingProfile);
            
            const birthTimeUnknown = generatedChart?.birthTimeQuality === 'unknown'
                || generatedChart?.birth?.time?.mode === 'unknown';
            if (!generatedChart || !generatedChart.sun || !generatedChart.moon || (!birthTimeUnknown && !generatedChart.rising)) {
                throw new Error('Не удалось получить данные карты. Попробуйте ещё раз.');
            }
            
            console.log('[App] Chart calculated');

            // Завершение фиксируется только после готовой карты. Повтор после сбоя
            // безопасен: профиль обновляется по тому же ID, а chartService читает
            // уже созданную primary chart вместо параллельного расчёта.
            await saveProfile(fullProfile);
            setProfile(fullProfile);
            if (!isGuestOnboarding) {
                void resolveAuthoritativeAdminStatus(safeUserId, fullProfile.isAdmin)
                    .then((authoritativeIsAdmin) => {
                        setProfile((current) => current && String(current.id) === safeUserId
                            ? { ...current, isAdmin: authoritativeIsAdmin }
                            : current);
                    });
            }

            const primaryKey = getPrimaryChartLoadKey(fullProfile);
            primaryChartSessionRef.current = { key: primaryKey, data: generatedChart, promise: null };
            primaryChartDataRef.current = generatedChart;
            clearHumanReadingSessionCache(fullProfile.id);
            clearLocalHumanBaseReport(fullProfile);
            setChartLoadState('ready');
            setChartData(generatedChart);
            writeLocalNatalChart(fullProfile, generatedChart);
            void getPrimaryChartId(String(fullProfile.id))
                .then((primaryChartId) => {
                    if (primaryChartId != null) {
                        clearLocalHumanBaseReport(fullProfile, primaryChartId);
                        setPrimaryChartId(primaryChartId);
                        writeLocalNatalChart(fullProfile, generatedChart, primaryChartId);
                    }
                    return prepareUserContentDbFirst({
                        userId: String(fullProfile.id),
                        chartId: primaryChartId,
                        profile: fullProfile,
                        chartData: generatedChart,
                        isPremium: hasActivePremium(fullProfile),
                        dateKey: getMoscowTodayKey(),
                    });
                })
                .catch((prewarmError: any) => {
                    console.warn('[App] Onboarding background content flow failed:', prewarmError?.message || prewarmError);
                });
            setLoadingProgress(90);

            // Опт-ин уведомлений из онбординга — регистрируем настройки в движке (best-effort).
            if (newProfile.notificationFrequency && newProfile.notificationFrequency !== 'quiet') {
                const freq = newProfile.notificationFrequency;
                void updateUserNotificationSettings({
                        enabled: true,
                        morningEnabled: true,
                        dayEnabled: freq === 'twice_daily',
                        eveningEnabled: freq === 'daily' || freq === 'twice_daily',
                        reactivationEnabled: true,
                        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
                    })
                    .catch((notifyError: any) => {
                        console.warn('[App] notification opt-in registration failed:', notifyError?.message || notifyError);
                    });
            }

            setLoadingProgress(100);
            setLoadingMessage(undefined);
            const targetView = isGuestOnboarding ? 'chart' : onboardingTargetViewRef.current || 'dashboard';
            if (targetView === 'chart') {
                setActiveChartId(undefined);
                setActiveChartSubject(null);
                setChartReturnView('dashboard');
            }
            // Первая регистрация → показываем тарифы (триал уже активен). Повторное
            // редактирование карты ведёт сразу в приложение, без пейвола.
            const isFirstSetup = !profile?.isSetup;
            await new Promise((resolve) => setTimeout(resolve, 300));
            if (isFirstSetup) {
                setPaywallTarget(targetView);
                setView('paywall');
            } else {
                setView(targetView);
            }
            onboardingTargetViewRef.current = 'dashboard';
            
        } catch (error: any) {
            console.error('[App] Error during onboarding:', error);
            const originalMessage = error?.message || 'Неизвестная ошибка';
            const lowerMessage = originalMessage.toLowerCase();
            const errorMessage = lowerMessage.includes('location')
                || lowerMessage.includes('coordinates')
                || lowerMessage.includes('not found')
                ? 'Не удалось найти место рождения. Проверь написание и попробуй ещё раз.'
                : lowerMessage.includes('network')
                    || lowerMessage.includes('fetch')
                    || lowerMessage.includes('timeout')
                    ? 'Не удалось связаться с сервисом. Проверь интернет и попробуй ещё раз.'
                    : lowerMessage.includes('validation') || lowerMessage.includes('invalid')
                        ? 'Проверь введённые данные и попробуй ещё раз.'
                        : 'Не удалось сохранить данные и рассчитать карту. Попробуй ещё раз.';
            throw new Error(errorMessage);
        } finally {
            setLoadingProgress(100);
            setLoadingMessage(undefined);
            setLoading(false);
            onboardingCompletionRef.current = false;
        }
    };

    const handleProfileUpdate = useCallback((updatedProfile: UserProfile) => {
        if (profile && String(profile.id) !== String(updatedProfile.id)) {
            clearLocalNatalChart(profile);
            clearLocalHumanBaseReport(profile);
            clearHumanReadingSessionCache(String(profile.id));
            clearPersonalForecastSessionCache();
            resetPrimaryChartState();
            const nextMode: AuthSessionMode = updatedProfile.isGuest ? 'guest' : 'account';
            setAuthSessionMode(nextMode);
            setAuthSessionModeState(nextMode);
            setProfile(updatedProfile);
            setLoadingProgress(0);
            setLoading(true);
            setStartupRetryNonce((value) => value + 1);
            return;
        }
        if (profile && getPrimaryChartLoadKey(profile) !== getPrimaryChartLoadKey(updatedProfile)) {
            clearLocalHumanBaseReport(profile);
        }
        setProfile(updatedProfile);
    }, [profile, resetPrimaryChartState]);

    const resetLocalAccountState = useCallback(async (
        nextMode: 'signed_out' | 'deleted',
        message: string,
    ) => {
        if (profile) {
            clearLocalNatalChart(profile);
            clearLocalHumanBaseReport(profile);
            clearHumanReadingSessionCache(String(profile.id));
        }
        clearPersonalForecastSessionCache();
        await Promise.allSettled([
            clearAppSessionAndLocalData(),
            clearNativeProviderCredentialState(),
        ]);
        setAuthSessionMode(nextMode);
        setAuthSessionModeState(nextMode);
        setAuthGateMessage(message);
        setProfile(null);
        resetPrimaryChartState();
        restoredRuStoreUserRef.current = null;
        prewarmCompletedKeyRef.current = null;
        navigationHistoryRef.current = [];
        setStartupError(null);
        setLoadingMessage(undefined);
        setLoadingProgress(100);
        setView('onboarding');
        setLoading(false);
    }, [profile, resetPrimaryChartState]);

    const handleDeleteAccount = useCallback(async () => {
        await deleteCurrentAccount();
        await resetLocalAccountState(
            'deleted',
            'Аккаунт и связанные данные удалены. Можно создать новый аккаунт или войти в существующий.',
        );
    }, [resetLocalAccountState]);

    const handleLogout = useCallback(async () => {
        await logoutCurrentAccount();
        await resetLocalAccountState(
            'signed_out',
            'Ты вышел с этого устройства. Войди снова, чтобы вернуть карту, историю и Premium.',
        );
    }, [resetLocalAccountState]);

    useEffect(() => {
        const handleInvalidatedSession = (event: Event) => {
            const detail = (event as CustomEvent<AppSessionInvalidatedDetail>).detail;
            const blocked = detail?.code === 'ACCOUNT_BLOCKED';
            void resetLocalAccountState(
                'signed_out',
                blocked
                    ? 'Этот аккаунт заблокирован. Войди в другой аккаунт или обратись в поддержку.'
                    : 'Сессия завершена. Войди снова, чтобы вернуть карту, историю и Premium.',
            );
        };
        window.addEventListener(APP_SESSION_INVALIDATED_EVENT, handleInvalidatedSession);
        return () => window.removeEventListener(APP_SESSION_INVALIDATED_EVENT, handleInvalidatedSession);
    }, [resetLocalAccountState]);

    const resumeAuthenticatedStartup = useCallback((
        nextProfile: UserProfile,
        nextMode: 'telegram' | 'guest' | 'account',
    ) => {
        if (profile && String(profile.id) !== String(nextProfile.id)) {
            clearLocalNatalChart(profile);
            clearLocalHumanBaseReport(profile);
            clearHumanReadingSessionCache(String(profile.id));
            clearPersonalForecastSessionCache();
            resetPrimaryChartState();
            restoredRuStoreUserRef.current = null;
            prewarmCompletedKeyRef.current = null;
        }
        setAuthSessionMode(nextMode);
        setAuthSessionModeState(nextMode);
        setAuthGateMessage(null);
        setStartupError(null);
        setProfile(nextProfile);
        setLoadingMessage(undefined);
        setLoadingProgress(0);
        setLoading(true);
        setStartupRetryNonce((value) => value + 1);
    }, [profile, resetPrimaryChartState]);

    const handleAccountLogin = useCallback((nextProfile: UserProfile) => {
        resumeAuthenticatedStartup(nextProfile, 'account');
    }, [resumeAuthenticatedStartup]);

    useEffect(() => {
        const userId = profile?.id ? String(profile.id) : '';
        if (!userId || restoredRuStoreUserRef.current === userId) return;
        restoredRuStoreUserRef.current = userId;

        // The bridge is a no-op outside the explicit RuStore Android channel.
        // A returned SDK purchase still becomes Premium only after backend
        // validation; the next profile load is therefore authoritative.
        void restoreRuStorePurchases().then(async (results) => {
            if (!results.some((result) => result.status === 'completed')) return;
            const refreshed = await getProfile();
            if (refreshed) setProfile(refreshed);
        }).catch(() => undefined);
    }, [profile?.id]);

    useEffect(() => {
        if (!profile?.id || notificationAttributionSentRef.current) return;
        const launch = notificationLaunchRef.current;
        if (!launch?.source) return;
        notificationAttributionSentRef.current = true;
        void recordNotificationAttribution({
            source: launch.source,
            scenario: launch.scenario,
            nl: launch.nl,
            section: launch.section,
            eventType: 'click',
        });
    }, [profile?.id]);

    useEffect(() => {
        if (!profile?.id || typeof document === 'undefined') return;

        void trackSessionActivity(true);

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                void trackSessionActivity();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [profile?.id, trackSessionActivity]);

    const requestPremium = async (source = 'app', eventPayload?: Record<string, any>, planId?: PremiumPlanId) => {
       if (!profile) return;
       // Без выбранного тарифа ведём пользователя в 3-тарифный пейвол (месяц/3мес/год),
       // а не запускаем молча покупку недели. Тариф выбирается уже в пейволе.
       if (!planId) {
           const returnInPlace = eventPayload?.returnInPlace === true;
           premiumReturnInPlaceRef.current = returnInPlace;
           if (returnInPlace) setPaywallTarget(viewRef.current);
           void recordUserAppEvent({
               eventType: 'paywall_view',
               section: 'premium',
               source,
               eventPayload: { entry_point: source, ...(eventPayload || {}) },
           });
           setView('paywall');
           return;
       }
       console.log('[App] Requesting premium for configured payment provider');
       const paymentResult = await getPaymentProvider().purchase(profile, planId);
       const success = paymentResult.status === 'completed';
       if (!success) {
           // The current paywall remains visually unchanged. Store channels do
           // not fall back to Telegram or pretend that a purchase succeeded.
           if (paymentResult.status !== 'cancelled') {
               console.warn('[App] Premium purchase was not completed:', paymentResult.reason);
           }
           return;
       }
       if (success) {
           console.log('[App] Premium payment successful, refreshing profile...');
           const returnInPlace = premiumReturnInPlaceRef.current;
           if (!returnInPlace) {
               setLoading(true);
               setLoadingMessage(profile.language === 'en' ? 'Preparing Premium' : 'Готовим Premium');
               setLoadingProgress(15);
           }
           void recordUserAppEvent({
               eventType: 'natal_upgrade_success',
               section: source === 'natal_story_unlock' ? 'natal_story' : 'premium',
               source,
               eventPayload: {
                   entry_point: source,
                   ...(eventPayload || {}),
               },
           });
           let refreshedProfile: UserProfile | null = null;
           try {
               for (let i = 0; i <= 2; i++) {
                   if (i > 0) await new Promise((r) => setTimeout(r, 1200));
                   const fresh = await getProfile();
                   if (fresh) {
                       const isAdmin = await resolveAuthoritativeAdminStatus(profile.id, fresh.isAdmin);
                       refreshedProfile = { ...fresh, id: profile.id, isAdmin };
                       setProfile(refreshedProfile);
                       if (hasActivePremium(refreshedProfile)) break;
                   }
               }
           } catch (error) {
               console.error('[App] Failed to refresh profile:', error);
               refreshedProfile = { ...profile, isPremium: true };
               setProfile(refreshedProfile);
           }
           const premiumProfile = refreshedProfile && hasActivePremium(refreshedProfile)
               ? refreshedProfile
               : { ...(refreshedProfile || profile), id: profile.id, isPremium: true };
            setProfile(premiumProfile);
            try {
                if (hasActivePremium(premiumProfile) && chartData) {
                    const chartId = activeChartId ?? await getPrimaryChartId(String(premiumProfile.id));
                    if (activeChartId == null && chartId != null) setPrimaryChartId(chartId);
                    void prepareUserContentDbFirst({
                        userId: String(premiumProfile.id),
                        chartId,
                        profile: premiumProfile,
                        chartData,
                        isPremium: true,
                        dateKey: getMoscowTodayKey(),
                        progressStart: 35,
                        progressSpan: 60,
                    }).catch((prewarmError: any) => {
                        console.warn('[App] Premium DB-first content flow failed:', prewarmError?.message || prewarmError);
                    });
                }
            } catch (contentRefreshError: any) {
                console.warn(
                    '[App] Premium activated, but the background content refresh could not start:',
                    contentRefreshError?.message || contentRefreshError,
                );
            } finally {
                setShowPremiumPreview(false);
                if (!returnInPlace) {
                    setLoadingProgress(100);
                    setLoadingMessage(undefined);
                    setLoading(false);
                }
                const returnView = returnInPlace ? (paywallTarget || 'dashboard') : 'dashboard';
                premiumReturnInPlaceRef.current = false;
                setPaywallTarget(null);
                setView(returnView);
            }
       } else {
           console.log('[App] Premium payment cancelled or failed');
           setLoading(false);
           setLoadingMessage(undefined);
       }
    };

    // Navigation logic: user-facing screens should return to the screen they were opened from.
    const pushReturnView = useCallback((fromView: ViewState) => {
        if (fromView === 'onboarding' || fromView === 'paywall') return;
        const stack = navigationHistoryRef.current;
        if (stack[stack.length - 1] !== fromView) {
            navigationHistoryRef.current = [...stack, fromView].slice(-12);
            appDebugLog('navigation', {
                action: 'push_return',
                from: fromView,
                history: navigationHistoryRef.current,
            });
        }
    }, []);

    const openNatalSetupOnboarding = useCallback((returnView?: ViewState, targetView: ViewState = 'chart') => {
        const currentView = viewRef.current;
        const safeReturnView =
            returnView && returnView !== 'onboarding' && returnView !== 'paywall'
                ? returnView
                : 'dashboard';

        appDebugLog('navigation', {
            action: 'open_natal_setup',
            from: currentView,
            to: 'onboarding',
            returnView: safeReturnView,
            targetView,
            historyBeforeSet: navigationHistoryRef.current,
        });

        onboardingTargetViewRef.current = targetView;
        setChartReturnView(safeReturnView === 'chart' ? 'dashboard' : safeReturnView);
        setView('onboarding');
    }, []);

    const getFeatureAccess = useCallback((featureKey: FeatureKey) => (
        canAccessFeature(featureKey, profile, {
            chartData: chartData ?? primaryChartDataRef.current,
            primaryChartId: primaryChartId ?? activeChartId ?? null,
        })
    ), [activeChartId, chartData, primaryChartId, profile]);

    const gateFeatureAccess = useCallback((featureKey: FeatureKey, targetView: ViewState) => {
        const access = getFeatureAccess(featureKey);
        if (access.allowed) return true;

        appDebugLog('navigation', {
            action: 'feature_gate',
            featureKey,
            status: access.status,
            targetView,
            hasPremium: access.hasPremium,
            hasChart: access.hasChart,
        });

        if (access.status === 'needs_chart') {
            openNatalSetupOnboarding(viewRef.current, targetView);
            return false;
        }

        if (access.status === 'needs_premium') {
            setView('paywall');
            return false;
        }

        return false;
    }, [getFeatureAccess, openNatalSetupOnboarding]);

    const navigateTo = useCallback((newView: ViewState, options?: { replace?: boolean }) => {
        if (!profile) return;
        const currentView = viewRef.current;
        if (newView === currentView) return;

        if (!options?.replace) {
            pushReturnView(currentView);
        }

        appDebugLog('navigation', {
            action: 'navigate_to',
            from: currentView,
            to: newView,
            replace: !!options?.replace,
            historyBeforeSet: navigationHistoryRef.current,
        });

        if (newView === 'chart') {
            setActiveChartId(undefined);
            setActiveChartSubject(null);
            if (primaryChartDataRef.current) {
                setChartData(primaryChartDataRef.current);
            }
            setChartReturnView(currentView === 'chart' ? 'dashboard' : currentView);
        }

        setView(newView);
    }, [getFeatureAccess, openNatalSetupOnboarding, profile, pushReturnView]);

    // Аналитика экранов: фиксируем каждый вход на экран ровно один раз при смене.
    // Завязано на view + profile.id (стабильный примитив), чтобы обновления полей
    // профиля (Premium, баланс) не накручивали лишние события.
    useEffect(() => {
        if (!profile?.id) return;
        void recordUserAppEvent({ eventType: 'screen_view', section: view });
    }, [view, profile?.id]);

    const refreshPrimaryChartState = useCallback(async () => {
        if (!profile?.id) return;
        try {
            const [freshChart, freshPrimaryChartId] = await Promise.all([
                getChartFromDB(String(profile.id)),
                getPrimaryChartId(String(profile.id)),
            ]);
            const key = getPrimaryChartLoadKey(profile);
            primaryChartSessionRef.current = { key, data: freshChart, promise: null };
            primaryChartDataRef.current = freshChart;
            clearHumanReadingSessionCache(String(profile.id));
            clearLocalHumanBaseReport(profile, primaryChartId ?? undefined);
            setPreloadedHumanReport(null);
            if (freshChart) {
                writeLocalNatalChart(profile, freshChart, freshPrimaryChartId ?? undefined);
                void prefetchBaseReportForChart(
                    profile,
                    freshPrimaryChartId ?? undefined,
                    freshChart,
                );
            } else {
                clearLocalNatalChart(profile);
            }
            setPrimaryChartId(freshPrimaryChartId);
            setChartLoadState(freshChart?.sun && freshChart?.moon ? 'ready' : 'error');
            setChartData(freshChart);
            setActiveChartId(undefined);
            setActiveChartSubject(null);
            if (freshChart?.sun && freshChart?.moon && freshChart?.rising) {
                void prepareUserContentDbFirst({
                    userId: String(profile.id),
                    chartId: freshPrimaryChartId,
                    profile,
                    chartData: freshChart,
                    isPremium: hasActivePremium(profile),
                    dateKey: getMoscowTodayKey(),
                }).catch((error: any) => {
                    console.warn('[App] Refreshed chart prewarm failed:', error?.message || error);
                });
            }
        } catch (error) {
            console.error('[App] Failed to refresh primary chart state:', error);
            // Keep the existing local/session chart on transient DB errors.
        }
    }, [prefetchBaseReportForChart, prepareUserContentDbFirst, primaryChartId, profile]);

    const handleBack = useCallback(async () => {
        if (sideDrawerOpen) {
            setSideDrawerOpen(false);
            return;
        }
        const currentView = viewRef.current;
        const fallbackView =
            currentView === 'admin'
                ? 'settings'
                : currentView === 'charts'
                  ? chartsReturnView
                  : currentView === 'chart'
                      ? chartReturnView
                      : 'dashboard';
        const returnView = navigationHistoryRef.current.pop() || fallbackView;

        appDebugLog('navigation', {
            action: 'go_back',
            from: currentView,
            to: returnView,
            fallbackView,
            chartReturnView,
            chartsReturnView,
            historyAfterPop: navigationHistoryRef.current,
            activeChartId: !!activeChartId,
        });

        // Keep screen-specific return paths explicit for management flows.
        if (currentView === 'chart') {
            if (activeChartId) {
                if (primaryChartDataRef.current) {
                    setChartData(primaryChartDataRef.current);
                }
                setActiveChartId(undefined);
                setActiveChartSubject(null);
            } else {
                setActiveChartId(undefined);
                setActiveChartSubject(null);
            }

            setChartReturnView('dashboard');
            setView(returnView);
            return;
        }
        setView(returnView);
    }, [activeChartId, chartReturnView, chartsReturnView, sideDrawerOpen]);

    useEffect(() => {
        setSideDrawerOpen(false);
    }, [view]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setSideDrawerOpen(false);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    // Нативная кнопка «назад» Telegram заменяет нижний таб-бар:
    // на главной скрыта, на остальных экранах показывается и ведёт назад.
    useEffect(() => {
        const tg = (window as any).Telegram?.WebApp;
        const backButton = tg?.BackButton;
        if (!backButton) return;
        const handler = () => { void handleBack(); };
        const isRoot = view === 'dashboard' || view === 'onboarding';
        if (isRoot) {
            backButton.hide?.();
            return;
        }
        backButton.onClick?.(handler);
        backButton.show?.();
        return () => { backButton.offClick?.(handler); };
    }, [view, handleBack, sideDrawerOpen]);

    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;

        let disposed = false;
        let backHandle: { remove: () => Promise<void> } | undefined;
        let appStateHandle: { remove: () => Promise<void> } | undefined;
        let lastRootBackAt = 0;

        void CapacitorApp.addListener('backButton', () => {
            if (sideDrawerOpen) {
                setSideDrawerOpen(false);
                return;
            }
            if (showPremiumPreview) {
                setShowPremiumPreview(false);
                return;
            }

            const detail: NativeBackEventDetail = { handled: false };
            window.dispatchEvent(new CustomEvent<NativeBackEventDetail>(NATIVE_BACK_EVENT, { detail }));
            if (detail.handled) return;

            const currentView = viewRef.current;
            if (currentView !== 'dashboard' && currentView !== 'onboarding') {
                void handleBack();
                return;
            }

            const now = Date.now();
            if (now - lastRootBackAt <= 1_800) {
                void CapacitorApp.exitApp();
                return;
            }
            lastRootBackAt = now;
        }).then((handle) => {
            if (disposed) void handle.remove();
            else backHandle = handle;
        });

        void CapacitorApp.addListener('appStateChange', ({ isActive }) => {
            if (!isActive) return;
            const nextDateKey = getMoscowTodayKey();
            setCurrentDateKey((current) => current === nextDateKey ? current : nextDateKey);
        }).then((handle) => {
            if (disposed) void handle.remove();
            else appStateHandle = handle;
        });

        return () => {
            disposed = true;
            void backHandle?.remove();
            void appStateHandle?.remove();
        };
    }, [handleBack, showPremiumPreview, sideDrawerOpen]);

    const openCharts = useCallback((returnView: ViewState) => {
        setChartsReturnView(returnView);
        navigateTo('charts');
    }, [navigateTo]);

    const openSynastryWithPrefill = useCallback((prefill: SynastryPrefill) => {
        if (!gateFeatureAccess('synastry_by_charts', 'synastry')) return;
        setSynastryPrefill(prefill);
        navigateTo('synastry');
    }, [gateFeatureAccess, navigateTo]);

    const openBottomToday = useCallback(() => {
        navigateTo('dashboard', { replace: true });
    }, [navigateTo]);

    const openBottomZodiac = useCallback(() => {
        navigateTo('horoscope', { replace: true });
    }, [navigateTo]);

    const openBottomNatal = useCallback(() => {
        navigateTo('chart', { replace: true });
    }, [navigateTo]);

    const openBottomAvatar = useCallback(() => {
        navigateTo('settings', { replace: true });
    }, [navigateTo]);

    const openSynastryFromHome = useCallback(() => {
        setSynastryPrefill(null);
        navigateTo('synastry');
    }, [navigateTo]);

    const openDrawerDiary = useCallback(() => {
        setSideDrawerOpen(false);
        openBottomToday();
    }, [openBottomToday]);
    const openDrawerPeriod = useCallback((period: PersonalForecastPeriod) => {
        setDashboardPeriod(period);
        setSideDrawerOpen(false);
        openBottomToday();
    }, [openBottomToday]);
    const openDrawerHoroscope = useCallback(() => {
        setSideDrawerOpen(false);
        openBottomZodiac();
    }, [openBottomZodiac]);
    const openDrawerCompatibility = useCallback(() => {
        setSideDrawerOpen(false);
        openSynastryFromHome();
    }, [openSynastryFromHome]);
    const openDrawerNatalChart = useCallback(() => {
        setSideDrawerOpen(false);
        openBottomNatal();
    }, [openBottomNatal]);
    const openDrawerSettings = useCallback(() => {
        setSideDrawerOpen(false);
        openBottomAvatar();
    }, [openBottomAvatar]);

    // Свайп назад от левого края (как в iOS) — на всех экранах, кроме корневых/модальных
    const canSwipeBack =
        view !== 'dashboard' &&
        view !== 'onboarding' &&
        view !== 'paywall';
    useSwipeBack({
        onSwipeBack: handleBack,
        enabled: canSwipeBack,
        threshold: 70,
        edgeWidth: 30,
    });

    const retryStartup = () => {
        setStartupError(null);
        setLoadingMessage(undefined);
        setLoadingProgress(0);
        setLoading(true);
        setStartupRetryNonce((value) => value + 1);
    };

    if (!loading && requiresExplicitAuthentication(authSessionMode)) {
        return (
            <AuthGate
                deleted={authSessionMode === 'deleted'}
                message={authGateMessage}
                onAccountLogin={handleAccountLogin}
            />
        );
    }

    if (startupError) {
        return (
            <div className="fixed inset-0 flex h-[100dvh] items-center justify-center bg-white px-6 text-[#1f1f1f]">
                <div className="max-w-sm text-center">
                    <p className="lumia-brand-wordmark mb-6">Твой Гороскоп</p>
                    <h1 className="mb-3 font-serif text-[2rem] leading-none">Не удалось открыть профиль</h1>
                    <p className="mb-6 text-[15px] leading-relaxed text-[#4f4b45]">{startupError}</p>
                    <button
                        type="button"
                        className="rounded-full border border-[#1f1f1f] px-6 py-3 text-[15px] font-medium text-[#1f1f1f]"
                        onClick={retryStartup}
                    >
                        Попробовать снова
                    </button>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <Loading
                message={loadingMessage || getText(profile?.language || 'ru', 'loading')}
                progress={loadingProgress}
            />
        );
    }

    if (!profile) {
        return (
            <AuthGate
                message="Сессия не найдена. Войди в существующий аккаунт или создай новый."
                onAccountLogin={handleAccountLogin}
            />
        );
    }

    if (view === 'onboarding') {
        return (
            <div className="relative isolate fixed inset-0 h-[100dvh] overflow-hidden">
                <div className="relative z-10 h-full">
                    <Onboarding
                        onComplete={handleOnboardingComplete}
                        initialStep={profile && !profile.isGuest && !profile.isSetup ? 'birth' : 'stories'}
                    />
                </div>
            </div>
        );
    }

    const isSavedPersonChartView = activeChartSubject?.subject_type === 'saved_person'
        || activeChartSubject?.is_primary === false;
    const isPrimaryChartView = !isSavedPersonChartView;
    const effectiveChartId = activeChartId ?? primaryChartId ?? undefined;
    const isTelegramMiniApp = hasTelegramMiniAppContext();

    const dashboardProps = {
        profile,
        chartData,
        chartId: primaryChartId,
        currentDateKey,
        onCreateNatalChart: openBottomNatal,
        onOpenSynastry: openSynastryFromHome,
        onOpenHoroscope: openBottomZodiac,
        requestedPeriod: dashboardPeriod,
        onPeriodChange: setDashboardPeriod,
        onRequestPremium: requestPremium,
    };

    return (
        <div
            className={`lumia-app-shell relative isolate flex w-full min-h-0 flex-col overflow-hidden font-sans selection:bg-astro-highlight selection:text-white ${
                sideDrawerOpen ? 'side-drawer-open' : ''
            } ${isTelegramMiniApp && view === 'dashboard' ? 'telegram-diary-menu-offset' : ''} ${
                lumiaAirShell ? 'text-text-main' : 'text-astro-text'
            }`}
        >
            {profile && !loading && !showPremiumPreview && ['dashboard', 'horoscope', 'synastry', 'chart', 'settings'].includes(view) && (
                <button
                    type="button"
                    className={`lumia-side-drawer-menu-button${isTelegramMiniApp ? ' is-telegram' : ''}`}
                    aria-label={sideDrawerOpen
                        ? (profile.language === 'en' ? 'Close navigation' : 'Закрыть навигацию')
                        : (profile.language === 'en' ? 'Open navigation' : 'Открыть навигацию')}
                    aria-expanded={sideDrawerOpen}
                    onClick={() => setSideDrawerOpen((open) => !open)}
                >
                    <svg aria-hidden="true" className="lumia-side-drawer-menu-icon" viewBox="0 0 24 24" fill="none">
                        <line x1="1.25" y1="8" x2="23" y2="8" />
                        <line x1="1.25" y1="16" x2="15.25" y2="16" />
                    </svg>
                </button>
            )}
            <main
                className="lumia-tg-main-gutter relative z-10 flex-1 w-full max-w-reading-wide mx-auto overflow-hidden min-h-0 bg-white"
                aria-hidden={sideDrawerOpen ? true : undefined}
                inert={sideDrawerOpen ? true : undefined}
            >
                <div
                    className={view === 'dashboard' ? 'flex h-full min-h-0 overflow-hidden' : 'hidden'}
                    aria-hidden={view !== 'dashboard'}
                >
                    <Dashboard {...dashboardProps} scrollRef={dashboardScrollRef} />
                </div>
                {view === 'admin' ? (
                    <AdminApp onClose={() => { void handleBack(); }} />
                ) : view === 'paywall' ? (
                    <Paywall
                        profile={profile}
                        onPurchase={(planId) => { void requestPremium('paywall', undefined, planId); }}
                        onClose={() => {
                            const t = paywallTarget;
                            premiumReturnInPlaceRef.current = false;
                            setPaywallTarget(null);
                            setView(t ?? 'dashboard');
                        }}
                        onContinueFree={() => {
                            const t = paywallTarget;
                            premiumReturnInPlaceRef.current = false;
                            setPaywallTarget(null);
                            setView(t ?? 'dashboard');
                        }}
                    />
                ) : view === 'synastry' ? (
                    <div className="lumia-main-scroll lumia-bottom-tab-scroll scrollbar-hide" ref={appScrollRef}>
                        <UnionRoom
                            profile={profile}
                            chartData={chartData}
                            chartId={primaryChartId ?? null}
                            requestPremium={requestPremium}
                            initialPrefill={synastryPrefill}
                            onOpenCharts={() => openCharts('synastry')}
                            onCreateNatalChart={openBottomNatal}
                            onUpdateProfile={handleProfileUpdate}
                        />
                        <PromoBanner
                            category="natal"
                            userId={String(profile.id || 'guest')}
                            dayKey={currentDateKey}
                            placementKey="screen:synastry:natal"
                            language={profile.language === 'en' ? 'en' : 'ru'}
                            onOpen={openBottomNatal}
                        />
                    </div>
                ) : view === 'matrix' ? (
                    <div className="lumia-main-scroll lumia-bottom-tab-scroll scrollbar-hide" ref={appScrollRef}>
                        <MatrixRoom profile={profile} onBack={() => { void handleBack(); }} />
                    </div>
                ) : view === 'horoscope' ? (
                    <div className="lumia-main-scroll lumia-bottom-tab-scroll scrollbar-hide" ref={appScrollRef}>
                        <HoroscopeReader
                            profile={profile}
                            chartData={chartData}
                            chartId={primaryChartId ?? undefined}
                            onUpdateProfile={handleProfileUpdate}
                            onOpenChart={() => {
                                navigateTo('chart');
                            }}
                            onRequestPremium={requestPremium}
                            onOpenPersonalForecast={() => navigateTo('dashboard')}
                        />
                    </div>
                ) : view === 'chart' ? (
                    <div className="lumia-main-scroll lumia-bottom-tab-scroll scrollbar-hide" ref={appScrollRef}>
                        <NatalMagazine
                            data={chartData}
                            profile={profile}
                            chartId={effectiveChartId}
                            chartSubject={activeChartSubject}
                            requestPremium={requestPremium}
                            onUpdateProfile={handleProfileUpdate}
                            preloadedReport={isPrimaryChartView ? preloadedHumanReport : null}
                            onCreateChart={() => openNatalSetupOnboarding('chart', 'chart')}
                        />
                        <PromoBanner
                            category="zodiac"
                            userId={String(profile.id || 'guest')}
                            dayKey={currentDateKey}
                            placementKey="screen:natal:zodiac"
                            language={profile.language === 'en' ? 'en' : 'ru'}
                            onOpen={openBottomZodiac}
                        />
                    </div>
                ) : view === 'settings' ? (
                    <div className="lumia-main-scroll lumia-bottom-tab-scroll scrollbar-hide" ref={appScrollRef}>
                        <Settings
                            profile={profile}
                            onUpdate={handleProfileUpdate}
                            onShowPremiumPreview={() => setShowPremiumPreview(true)}
                            onRequestPremium={() => { void requestPremium('settings'); }}
                            onOpenAdmin={() => navigateTo('admin')}
                            onOpenCharts={() => openCharts('settings')}
                            onLogout={handleLogout}
                            onDeleteAccount={handleDeleteAccount}
                        />
                    </div>
                ) : view === 'charts' ? (
                    <div className="lumia-main-scroll scrollbar-hide" ref={appScrollRef}>
                        <AppTopBar
                            title={profile.language === 'en' ? 'My charts' : 'Мои карты'}
                            onBack={() => { void handleBack(); }}
                        />
                        <MyCharts 
                            profile={profile} 
                            onBack={() => {
                                void handleBack();
                            }}
                            onProfileUpdate={handleProfileUpdate}
                            onPrimaryChartUpdated={refreshPrimaryChartState}
                            onRequestPremium={() => void requestPremium('charts')}
                            onUseInSynastry={(chart) => {
                                openSynastryWithPrefill({
                                    source: 'saved-chart',
                                    partnerChartId: chart.id,
                                    partnerName: chart.name,
                                    partnerDate: chart.birth_date,
                                    partnerTime: chart.birth_time || undefined,
                                    partnerPlace: chart.birth_place,
                                });
                            }}
                            onChartSelect={(chart) => {
                                appDebugLog('navigation', {
                                    action: 'select_saved_chart',
                                    from: viewRef.current,
                                    to: 'chart',
                                    returnView: 'charts',
                                    chartId: !!chart.id,
                                });
                                setChartData(chart.chart_data);
                                setActiveChartId(chart.id);
                                setActiveChartSubject(chart);
                                setChartReturnView('charts');
                                pushReturnView(viewRef.current);
                                setView('chart');
                            }}
                        />
                    </div>
                ) : null}
            </main>

            {showPremiumPreview && (
                <PremiumPreview language={profile?.language || 'ru'} onClose={() => setShowPremiumPreview(false)} onPurchase={requestPremium} />
            )}
            <LumiaSideDrawer
                open={sideDrawerOpen}
                currentView={view}
                profile={profile}
                sunSign={chartData?.sun?.sign || primaryChartDataRef.current?.sun?.sign || null}
                onClose={() => setSideDrawerOpen(false)}
                onOpenDiary={openDrawerDiary}
                activePeriod={dashboardPeriod}
                onSelectPeriod={openDrawerPeriod}
                onOpenSignHoroscope={openDrawerHoroscope}
                onOpenCompatibility={openDrawerCompatibility}
                onOpenNatalChart={openDrawerNatalChart}
                onOpenSettings={openDrawerSettings}
            />
        </div>
    );
};

export default App;
