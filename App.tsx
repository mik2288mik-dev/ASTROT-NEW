
import React, { useEffect, useState, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { UserProfile, NatalChartData, ViewState, HoroscopeLayer, NatalInterpretationReport, type HoroscopeOpenOptions, type PersonalDailySection } from './types';
import {
    getProfile,
    saveProfile,
    runReferralFromStartParam,
} from './services/storageService';
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
import { Header } from './components/Header';
import { LumiaBottomTabBar } from './components/lumia-ui/LumiaBottomTabBar';
import { Loading } from './components/ui/Loading';
import { getText } from './constants';
import { requestStarsPayment } from './services/telegramService';
import type { PremiumPlanId } from './lib/premiumPricing';
import { getAdminStatus } from './services/adminService';
import { recordNotificationAttribution, recordUserAppEvent, recordUserSession, updateUserNotificationSettings, waitForTelegramInitData } from './services/sessionService';
import { installTelegramFullscreenGuard } from './lib/telegramFullscreen';
import { applyTelegramSafeAreaCssVars, subscribeTelegramContentSafeAreaChanges } from './lib/telegramSafeAreaInsets';
import { useSwipeBack } from './lib/useSwipeBack';
import { isGuestUserId, isValidUserId } from './lib/userId';
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
    loadHumanDailyPackage,
    prefetchHumanBaseReport,
} from './services/natalReadingService';
import type { DailyCanvas } from './lib/natalHumanShared';

const Onboarding = dynamic(() => import('./views/Onboarding').then((module) => module.Onboarding), {
    ssr: false,
    loading: () => <Loading />,
});
const NatalMagazine = dynamic(() => import('./views/v2/NatalMagazine').then((module) => module.NatalMagazine), { ssr: false });
const HoroscopeReader = dynamic(() => import('./views/v2/HoroscopeReader').then((module) => module.HoroscopeReader), { ssr: false });
const PersonalDailyScreen = dynamic(() => import('./views/DailyContentScreens').then((module) => module.PersonalDailyScreen), { ssr: false });
const Settings = dynamic(() => import('./views/Settings').then((module) => module.Settings), { ssr: false });
const AdminApp = dynamic(() => import('./views/admin2/AdminApp').then((module) => module.AdminApp), { ssr: false });
const PremiumPreview = dynamic(() => import('./components/PremiumPreview').then((module) => module.PremiumPreview), { ssr: false });
const Paywall = dynamic(() => import('./views/Paywall').then((module) => module.Paywall), { ssr: false });
const UnionRoom = dynamic(() => import('./views/v2/UnionRoom').then((module) => module.UnionRoom), { ssr: false });
const MatrixRoom = dynamic(() => import('./views/v2/MatrixRoom').then((module) => module.MatrixRoom), { ssr: false });
const MyCharts = dynamic(() => import('./views/MyCharts').then((module) => module.MyCharts), { ssr: false });

// Get owner ID from environment variables for security
const OWNER_ID = process.env.NEXT_PUBLIC_OWNER_ID || '';
const STARTUP_SAFETY_TIMEOUT_MS = 45_000;
const NEW_USER_TRIAL_DAYS = 14;

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
    return username || 'Гость';
}

function getTrialWindow(): { trialStartedAt: string; premiumUntil: string } {
    const startedAt = Date.now();
    return {
        trialStartedAt: new Date(startedAt).toISOString(),
        premiumUntil: new Date(startedAt + NEW_USER_TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    };
}

function buildMinimalStartupProfile(tgId: string | number, tgUser?: TelegramWebAppUser | null): UserProfile {
    const trial = getTrialWindow();
    return {
        id: String(tgId),
        name: getTelegramDisplayName(tgUser),
        birthDate: '',
        birthTime: '',
        birthPlace: '',
        isSetup: false,
        language: 'ru',
        theme: 'light',
        isPremium: true,
        premiumUntil: trial.premiumUntil,
        trialStartedAt: trial.trialStartedAt,
        loginStreak: 0,
        chartSlots: 1,
    };
}

function normalizeStartupProfile(
    storedProfile: UserProfile,
    tgId: string | number,
    tgUser: TelegramWebAppUser | null | undefined,
    isAdmin: boolean
): UserProfile {
    const premiumUntil = getProfilePremiumUntil(storedProfile);
    const accessProfile = { ...storedProfile, premiumUntil, isAdmin };
    return {
        ...storedProfile,
        id: String(tgId),
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
    return !storedProfile.name?.trim() || !storedProfile.language || !storedProfile.theme;
}

async function saveStartupProfileWithRetry(profile: UserProfile, maxAttempts = 3): Promise<boolean> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            await saveProfile(profile);
            return true;
        } catch (saveError: any) {
            console.warn(
                `[App] Startup profile save attempt ${attempt}/${maxAttempts} failed:`,
                saveError?.message || saveError
            );
            if (attempt < maxAttempts) {
                await new Promise((resolve) => setTimeout(resolve, 500));
            }
        }
    }
    return false;
}


const NOTIFICATION_QUERY_VIEWS = new Set<ViewState>([
    'dashboard',
    'horoscope',
    'personal_daily',
    'synastry',
    'settings',
    'charts',
]);

const LEGACY_NOTIFICATION_VIEW_ALIASES: Record<string, ViewState> = {
    daily_love: 'personal_daily',
    daily_money: 'personal_daily',
    daily_work: 'personal_daily',
    daily_goals: 'personal_daily',
    personal_forecast: 'personal_daily',
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

function getRequestedPersonalDailySectionFromQuery(): PersonalDailySection | null {
    if (typeof window === 'undefined') return null;
    const requested = new URLSearchParams(window.location.search).get('view');
    switch (requested) {
        case 'daily_love':
            return 'love';
        case 'daily_money':
            return 'money';
        case 'daily_work':
            return 'work';
        case 'daily_goals':
            return 'goals';
        case 'daily_family':
            return 'family';
        case 'daily_friendship':
            return 'friendship';
        case 'daily_energy':
            return 'energy';
        case 'daily_communication':
            return 'communication';
        case 'personal_forecast':
        case 'personal_daily':
            return 'overview';
        default:
            return null;
    }
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
    const [dailyPackage, setDailyPackage] = useState<DailyCanvas | null>(null);
    const [activeChartId, setActiveChartId] = useState<number | undefined>(undefined);
    const [primaryChartId, setPrimaryChartId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [loadingMessage, setLoadingMessage] = useState<string | undefined>(undefined);
    const [startupError, setStartupError] = useState<string | null>(null);
    const [startupRetryNonce, setStartupRetryNonce] = useState(0);
    const [view, setView] = useState<ViewState>('onboarding');
    // Когда задан — paywall показан после онбординга; close/«продолжить бесплатно» ведут сюда.
    const [paywallTarget, setPaywallTarget] = useState<ViewState | null>(null);
    const [showPremiumPreview, setShowPremiumPreview] = useState(false);
    const [synastryPrefill, setSynastryPrefill] = useState<SynastryPrefill>(null);
    const [chartsReturnView, setChartsReturnView] = useState<ViewState>('settings');
    const [chartReturnView, setChartReturnView] = useState<ViewState>('dashboard');
    const [personalDailyInitialSection, setPersonalDailyInitialSection] = useState<PersonalDailySection>('overview');
    const lastSessionPingRef = useRef(0);
    const prewarmCompletedKeyRef = useRef<string | null>(null);
    const primaryChartSessionRef = useRef<{
        key: string;
        data: NatalChartData | null;
        promise: Promise<NatalChartData | null> | null;
    }>({ key: '', data: null, promise: null });
    const dailyPackageSessionRef = useRef<{
        key: string;
        data: DailyCanvas | null;
        promise: Promise<DailyCanvas | null> | null;
    }>({ key: '', data: null, promise: null });
    const primaryChartDataRef = useRef<NatalChartData | null>(null);
    const requestedViewRef = useRef<ViewState | null>(null);
    const notificationLaunchRef = useRef<NotificationLaunchParams | null>(null);
    const notificationAttributionSentRef = useRef(false);
    const dashboardScrollRef = useRef<HTMLDivElement | null>(null);
    const appScrollRef = useRef<HTMLDivElement | null>(null);
    const [initialTodaySection, setInitialTodaySection] = useState<string | null>(null);
    const viewRef = useRef<ViewState>('onboarding');
    const onboardingTargetViewRef = useRef<ViewState>('dashboard');
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
        targetChartId?: number
    ) => {
        const userId = targetProfile.id ? String(targetProfile.id) : '';
        if (!userId) return null;

        const cached = getHumanBaseReportCached(userId, targetChartId)
            || readLocalHumanBaseReportWithFallback(targetProfile, targetChartId);
        if (cached) {
            setPreloadedHumanReport(cached);
            return cached;
        }
        const dbCached = await getCachedHumanBaseReport(userId, targetChartId).catch((error: any) => {
            console.warn('[App] Human base report cache read failed:', error?.message || error);
            return null;
        });
        if (dbCached) {
            writeLocalHumanBaseReport(targetProfile, dbCached, targetChartId);
            setPreloadedHumanReport(dbCached);
            return dbCached;
        }
        return null;
    }, []);

    const prepareStartupDailyPackage = useCallback(async (input: {
        profile: UserProfile;
        chartData: NatalChartData | null;
        chartId: number | null;
        progressStart?: number;
        progressSpan?: number;
        reportProgress?: boolean;
    }): Promise<DailyCanvas | null> => {
        const userId = input.profile.id ? String(input.profile.id) : '';
        if (!userId || isGuestUserId(userId) || !input.chartData?.sun || !input.chartData?.moon || !input.chartData?.rising) {
            setDailyPackage(null);
            return null;
        }

        const dateKey = getMoscowTodayKey();
        const key = `${userId}:${input.chartId ?? 'primary'}:${dateKey}`;
        const current = dailyPackageSessionRef.current;
        if (current.key === key && current.data) {
            setDailyPackage(current.data);
            return current.data;
        }
        if (current.key === key && current.promise) {
            const existing = await current.promise;
            setDailyPackage(existing);
            return existing;
        }

        const progressStart = input.progressStart ?? 70;
        const progressSpan = input.progressSpan ?? 24;
        const reportProgress = input.reportProgress !== false;
        if (reportProgress) {
            setLoadingMessage(input.profile.language === 'en' ? 'Preparing your personal day' : '\u0413\u043e\u0442\u043e\u0432\u0438\u043c \u0442\u0432\u043e\u0439 \u043b\u0438\u0447\u043d\u044b\u0439 \u0434\u0435\u043d\u044c');
            setLoadingProgress(progressStart);
        }

        const request = loadHumanDailyPackage(userId, input.chartId ?? undefined, dateKey, {
            accessTier: 'premium',
            profile: input.profile,
            chartData: input.chartData,
        })
            .then((canvas) => {
                dailyPackageSessionRef.current = { key, data: canvas, promise: null };
                setDailyPackage(canvas);
                if (reportProgress) setLoadingProgress(progressStart + progressSpan);
                return canvas;
            })
            .catch((error) => {
                if (dailyPackageSessionRef.current.key === key) {
                    dailyPackageSessionRef.current = { key: '', data: null, promise: null };
                }
                const err = error as { code?: string; status?: number; message?: string };
                console.warn('[App] Startup personal daily package failed; continuing without blocking app entry', {
                    code: err?.code || 'UNKNOWN_STARTUP_DAILY_ERROR',
                    status: err?.status || null,
                    message: err?.message || String(error),
                });
                setDailyPackage(null);
                if (reportProgress) setLoadingProgress(progressStart + progressSpan);
                return null;
            });

        dailyPackageSessionRef.current = { key, data: null, promise: request };
        return request;
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
        void prefetchBaseReportForChart(input.profile, input.chartId ?? undefined).catch((error: any) => {
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
        setPreloadedHumanReport(null);
        dailyPackageSessionRef.current = { key: '', data: null, promise: null };
        setDailyPackage(null);
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

        const showStartupError = (message: string, error?: unknown) => {
            if (cancelled || startupVisible) return;
            startupVisible = true;
            clearSafety();
            if (error) {
                const err = error as { code?: string; status?: number; message?: string };
                console.warn('[App] Startup personal daily package failed', {
                    code: err?.code || 'UNKNOWN_STARTUP_DAILY_ERROR',
                    status: err?.status || null,
                    message: err?.message || String(error),
                });
            }
            setStartupError(message);
            setLoadingProgress(100);
            setLoadingMessage(undefined);
            setLoading(false);
        };

        const scheduleStartupBackgroundWork = (
            targetProfile: UserProfile,
            initialChart: NatalChartData,
            initialChartId: number | null,
            refreshChartFromDb: boolean,
        ) => {
            const userId = String(targetProfile.id);
            const startHumanBasePrefetch = (chartId: number) => {
                void prefetchHumanBaseReport(userId, chartId)
                    .then((report) => {
                        writeLocalHumanBaseReport(targetProfile, report, chartId);
                        if (!cancelled) setPreloadedHumanReport(report);
                    })
                    .catch((error: any) => {
                        console.warn('[App] Human base report background prefetch failed:', error?.message || error);
                    });
            };
            let dailyPackageStarted = false;
            const startDailyPackage = (chart: NatalChartData, chartId: number | null) => {
                if (dailyPackageStarted) return;
                dailyPackageStarted = true;
                void prepareStartupDailyPackage({
                    profile: targetProfile,
                    chartData: chart,
                    chartId,
                    reportProgress: false,
                }).finally(() => {
                    logStartupMetric('startup_daily_done_ms', startupElapsedMs());
                });
            };

            // Cached data is already sufficient for the exact same daily request; do not
            // keep the app loader visible while the model/cache endpoint finishes.
            if (initialChartId != null) {
                startHumanBasePrefetch(initialChartId);
                startDailyPackage(initialChart, initialChartId);
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
                        if (initialChartId == null) startHumanBasePrefetch(freshPrimaryChartId);
                        if (!cancelled) {
                            setPrimaryChartId(freshPrimaryChartId);
                        }
                    })
                    .catch((error: any) => {
                        console.warn('[App] Background primary chart ID refresh failed:', error?.message || error);
                    });

                await Promise.all([chartRefresh, chartIdRefresh]);

                if (!dailyPackageStarted) {
                    startDailyPackage(chart, chartId);
                }

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
            const requestedPersonalSection = getRequestedPersonalDailySectionFromQuery();
            if (requestedPersonalSection) {
                setPersonalDailyInitialSection(requestedPersonalSection);
            }
            notificationLaunchRef.current = getNotificationLaunchParams();
            const startParamSection = resolveStartParamRoute(getStartParamRaw())?.route.todaySection || null;
            setInitialTodaySection(notificationLaunchRef.current?.section || startParamSection);
            
            // Ждём Telegram Web App (может загружаться асинхронно)
            const telegramWebApp = (window as any).Telegram?.WebApp;
            if (telegramWebApp) {
                const initData = await waitForTelegramInitData({ maxAttempts: 8, delayMs: 250 });
                if (!initData) {
                    console.warn('[App] Telegram initData not available after bounded wait; proceeding with local profile fallback');
                    logStartupMetric('startup_init_data_missing', true);
                }
                applyTelegramSafeAreaCssVars();
            }
            if (cancelled) return;
            let tgId: string | number | undefined = telegramWebApp?.initDataUnsafe?.user?.id;

            let webGuestProfile: UserProfile | null = null;
            if (!isValidUserId(tgId)) {
                console.log('[App] Telegram unavailable; bootstrapping signed web guest session');
                try {
                    webGuestProfile = await getProfile();
                    tgId = webGuestProfile?.id;
                } catch (guestError: any) {
                    console.error('[App] Guest session bootstrap failed:', guestError?.message || guestError);
                }
            }
            if (!isValidUserId(tgId)) {
                clearSafety();
                setStartupError('Не удалось открыть гостевую сессию. Обнови страницу и попробуй ещё раз.');
                setLoadingProgress(100);
                setView('dashboard');
                setLoading(false);
                return;
            }
            const safeTgId = tgId as string | number;

            try {
                setStartupError(null);
                const tg = (window as any).Telegram?.WebApp;
                const tgUser = tg?.initDataUnsafe?.user as TelegramWebAppUser | undefined;

                setLoadingProgress(30);
                const storedProfile = webGuestProfile || await getProfile();

                console.log('[App] Profile loaded:', {
                    hasProfile: !!storedProfile,
                    isSetup: storedProfile?.isSetup,
                    tgId: safeTgId
                });

                let updatedProfile: UserProfile;
                if (!storedProfile) {
                    setLoadingProgress(42);
                    const isAdmin = getFallbackAdminStatus(safeTgId, false);
                    updatedProfile = {
                        ...buildMinimalStartupProfile(safeTgId, tgUser),
                        isAdmin,
                    };
                    console.log('[App] Creating minimal startup profile without natal setup');
                    const profileSaved = await saveStartupProfileWithRetry(updatedProfile);
                    if (!profileSaved) {
                        console.warn('[App] Startup profile save failed; continuing with local profile');
                        void saveProfile(updatedProfile).catch((saveError: any) => {
                            console.warn('[App] Background startup profile save failed:', saveError?.message || saveError);
                        });
                    }
                } else {
                    const isAdmin = getFallbackAdminStatus(safeTgId, storedProfile.isAdmin);
                    updatedProfile = normalizeStartupProfile(storedProfile, safeTgId, tgUser, isAdmin);
                    if (needsStartupProfileNormalizationSave(storedProfile)) {
                        void saveProfile(updatedProfile).catch((saveError: any) => {
                            console.warn('[App] Startup profile normalization save failed:', saveError?.message || saveError);
                        });
                    }
                }

                setProfile(updatedProfile);
                if (!isGuestUserId(String(safeTgId))) {
                    void resolveAuthoritativeAdminStatus(safeTgId, updatedProfile.isAdmin)
                        .then((isAdmin) => {
                            if (cancelled) return;
                            setProfile((current) => current && String(current.id) === String(safeTgId)
                                ? { ...current, isAdmin }
                                : current);
                        });
                }
                logStartupMetric('startup_profile_loaded_ms', startupElapsedMs());

                runReferralFromStartParam(String(safeTgId), (r) => {
                    if (r.ok) {
                        setProfile((p) => (p ? { ...p, referralApplied: true } : p));
                    } else if (r.status === 409) {
                        setProfile((p) => (p ? { ...p, referralApplied: true } : p));
                    }
                });

                if (!updatedProfile.isSetup) {
                    console.log('[App] Profile is not setup; opening dashboard without chart/prewarm');
                    logStartupMetric('startup_local_chart_hit', false);
                    resetPrimaryChartState();
                    showStartupDashboard('dashboard');
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
                    console.log('[App] Chart loaded successfully:', {
                        sunSign: chart.sun.sign,
                        moonSign: chart.moon.sign
                    });
                    logStartupMetric('startup_chart_ready_ms', startupElapsedMs());
                    showStartupDashboard(requestedViewRef.current || 'dashboard');
                    scheduleStartupBackgroundWork(updatedProfile, chart, null, false);
                } else {
                    console.log('[App] Chart unavailable after startup load, going to dashboard');
                    showStartupDashboard(requestedViewRef.current || 'dashboard');
                }
            } catch (error) {
                console.error('[App] Error loading user data:', error);
                const tg = (window as any).Telegram?.WebApp;
                const tgUser = tg?.initDataUnsafe?.user as TelegramWebAppUser | undefined;
                if (isValidUserId(safeTgId)) {
                    const fallbackProfile = {
                        ...buildMinimalStartupProfile(safeTgId, tgUser),
                        isAdmin: getFallbackAdminStatus(safeTgId, false),
                    };
                    setProfile(fallbackProfile);
                    setStartupError(null);
                    resetPrimaryChartState();
                    showStartupDashboard('dashboard');
                } else {
                    setStartupError('Не удалось загрузить профиль. Проверь, что приложение открыто внутри Telegram, и попробуй ещё раз.');
                    resetPrimaryChartState();
                    showStartupDashboard('dashboard');
                }
            } finally {
                clearSafety();
                if (!cancelled && !startupVisible) {
                    showStartupDashboard('dashboard');
                }
            }
        };
        
        void loadData();
        return () => {
            cancelled = true;
            clearSafety();
        };
    }, [loadPrimaryChartOnce, prepareStartupDailyPackage, prepareUserContentDbFirst, resetPrimaryChartState, resolveAuthoritativeAdminStatus, getFallbackAdminStatus, startupRetryNonce]);

    const handleOnboardingComplete = async (newProfile: UserProfile) => {
        console.log('[App] === ONBOARDING COMPLETE ===', {
            name: newProfile.name,
            birthDate: newProfile.birthDate
        });

        const tg = (window as any).Telegram?.WebApp;
        const tgUser = tg?.initDataUnsafe?.user;
        const tgId = tgUser?.id;
        const hasTelegramUserId = isValidUserId(tgId);
        const currentProfileId = profile?.id;
        const hasGuestProfileId = isGuestUserId(currentProfileId);
        if (!hasTelegramUserId && !hasGuestProfileId) {
            console.error('[App] Cannot complete onboarding without a confirmed guest session');
            window.alert?.('Не удалось подтвердить гостевую сессию. Обнови страницу и попробуй ещё раз.');
            setView('onboarding');
            setLoading(false);
            return;
        }
        // Telegram remains authoritative when present. A web guest may only use the
        // identity loaded into the current profile from its signed server session.
        const safeUserId = String(hasTelegramUserId ? tgId : currentProfileId);
        const isGuestOnboarding = !hasTelegramUserId;
        const isAdmin = isGuestOnboarding ? false : getFallbackAdminStatus(safeUserId, profile?.isAdmin);
        const retainedPremiumUntil = isGuestOnboarding
            ? null
            : getProfilePremiumUntil(profile) ?? getProfilePremiumUntil(newProfile);
        const fullProfile = {
            ...newProfile,
            isSetup: true,
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
            notificationFrequency: profile?.notificationFrequency ?? newProfile.notificationFrequency,
        };

        setProfile(fullProfile);
        if (!isGuestOnboarding) {
            void resolveAuthoritativeAdminStatus(safeUserId, fullProfile.isAdmin)
                .then((authoritativeIsAdmin) => {
                    setProfile((current) => current && String(current.id) === safeUserId
                        ? { ...current, isAdmin: authoritativeIsAdmin }
                        : current);
                });
        }
        setLoading(true);
        setLoadingProgress(10);

        try {
            // Шаг 1: Сохраняем профиль в БД (критично для persistence)
            setLoadingProgress(20);
            for (let attempt = 1; attempt <= 2; attempt++) {
                try {
                    await saveProfile(fullProfile);
                    console.log('[App] Profile saved successfully');
                    break;
                } catch (saveError: any) {
                    console.warn(`[App] Profile save attempt ${attempt}/2 failed:`, saveError.message);
                    if (attempt === 2) {
                        console.warn('[App] Profile save failed twice, continuing — natal-chart API will create user');
                    } else {
                        await new Promise(r => setTimeout(r, 500));
                    }
                }
            }

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
            
            const generatedChart = await getOrCalculateChart(fullProfile);
            
            if (!generatedChart || !generatedChart.sun || !generatedChart.moon || !generatedChart.rising) {
                throw new Error('Не удалось получить данные карты. Попробуйте ещё раз.');
            }
            
            console.log('[App] Chart calculated:', {
                sunSign: generatedChart.sun.sign,
                moonSign: generatedChart.moon.sign
            });

            const primaryKey = getPrimaryChartLoadKey(fullProfile);
            primaryChartSessionRef.current = { key: primaryKey, data: generatedChart, promise: null };
            primaryChartDataRef.current = generatedChart;
            clearHumanReadingSessionCache(fullProfile.id);
            clearLocalHumanBaseReport(fullProfile);
            setChartLoadState('ready');
            setChartData(generatedChart);
            writeLocalNatalChart(fullProfile, generatedChart);
            setLoadingMessage(
                fullProfile.language === 'en' ? 'Preparing your day' : 'Готовим твой день'
            );
            void prepareStartupDailyPackage({
                profile: fullProfile,
                chartData: generatedChart,
                chartId: null,
                reportProgress: false,
            });
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
                setChartReturnView('dashboard');
            }
            // Первая регистрация → показываем тарифы (триал уже активен). Повторное
            // редактирование карты ведёт сразу в приложение, без пейвола.
            const isFirstSetup = !profile?.isSetup;
            setTimeout(() => {
                if (isFirstSetup) {
                    setPaywallTarget(targetView);
                    setView('paywall');
                } else {
                    setView(targetView);
                }
                onboardingTargetViewRef.current = 'dashboard';
            }, 300);
            
        } catch (error: any) {
            console.error('[App] Error during onboarding:', error);
            console.error('[App] Error message:', error?.message);
            console.error('[App] Error stack:', error?.stack);
            
            // Получаем оригинальное сообщение ошибки
            const dailyErrorCode = String(error?.code || '');
            if (
                dailyErrorCode.includes('DAILY_PACKAGE') ||
                dailyErrorCode.includes('CONTENT_GENERATION') ||
                dailyErrorCode.includes('SAVE_READING') ||
                dailyErrorCode.includes('CACHE_READ')
            ) {
                setStartupError(
                    fullProfile.language === 'en'
                        ? 'Your personal day could not be prepared. Try again.'
                        : 'Не удалось подготовить личный день. Попробуй ещё раз.'
                );
                return;
            }

            const originalMessage = error?.message || 'Неизвестная ошибка';
            
            // Если сообщение уже на русском - показываем его как есть
            if (/[а-яА-ЯёЁ]/.test(originalMessage)) {
                alert(originalMessage);
            } else {
                // Определяем тип ошибки для user-friendly сообщения
                const lowerMessage = originalMessage.toLowerCase();
                let errorMessage = originalMessage;
                
                if (lowerMessage.includes('database') || lowerMessage.includes('db')) {
                    errorMessage = 'Ошибка базы данных. Попробуйте позже.';
                } else if (lowerMessage.includes('initialize') || lowerMessage.includes('ephemeris')) {
                    errorMessage = 'Ошибка инициализации расчетов. Попробуйте позже.';
                } else if (lowerMessage.includes('location') || lowerMessage.includes('coordinates') || lowerMessage.includes('not found')) {
                    errorMessage = 'Не удалось найти место рождения. Проверьте написание (например: "Москва, Россия").';
                } else if (lowerMessage.includes('validation') || lowerMessage.includes('invalid')) {
                    errorMessage = `Ошибка данных: ${originalMessage}`;
                } else if (lowerMessage.includes('network') || lowerMessage.includes('fetch')) {
                    errorMessage = 'Ошибка сети. Проверьте интернет-соединение.';
                } else if (lowerMessage.includes('timeout')) {
                    errorMessage = 'Превышено время ожидания. Попробуйте позже.';
                } else {
                    errorMessage = 'Произошла ошибка при расчёте. Попробуйте снова.';
                }
                
                alert(errorMessage);
            }
            setView('onboarding');
        } finally {
            setLoadingProgress(100);
            setTimeout(() => setLoading(false), 300);
        }
    };

    const handleProfileUpdate = useCallback((updatedProfile: UserProfile) => {
        if (profile && getPrimaryChartLoadKey(profile) !== getPrimaryChartLoadKey(updatedProfile)) {
            clearLocalHumanBaseReport(profile);
        }
        setProfile(updatedProfile);
    }, [profile]);

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
           void recordUserAppEvent({
               eventType: 'paywall_view',
               section: 'premium',
               source,
               eventPayload: { entry_point: source, ...(eventPayload || {}) },
           });
           setView('paywall');
           return;
       }
       console.log('[App] Requesting premium for user:', profile.id, 'plan:', planId);
       const success = await requestStarsPayment(profile, planId);
       if (success) {
           console.log('[App] Premium payment successful, refreshing profile...');
           setLoading(true);
           setLoadingMessage(profile.language === 'en' ? 'Preparing Premium' : 'Готовим Premium');
           setLoadingProgress(15);
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
           if (hasActivePremium(premiumProfile) && chartData) {
               const chartId = activeChartId ?? await getPrimaryChartId(String(premiumProfile.id));
               if (activeChartId == null && chartId != null) setPrimaryChartId(chartId);
               dailyPackageSessionRef.current = { key: '', data: null, promise: null };
               setDailyPackage(null);
               await prepareStartupDailyPackage({
                   profile: premiumProfile,
                   chartData,
                   chartId,
                   progressStart: 35,
                   progressSpan: 35,
               }).catch((dailyError: any) => {
                   console.warn('[App] Premium daily package reload failed:', dailyError?.message || dailyError);
               });
               await prepareUserContentDbFirst({
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
           setShowPremiumPreview(false);
           setLoadingProgress(100);
           setLoadingMessage(undefined);
           setLoading(false);
           setView('dashboard');
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

    const openPersonalDailyView = useCallback((section: PersonalDailySection = 'overview') => {
        appDebugLog('navigation', {
            action: 'open_personal_daily',
            from: viewRef.current,
            to: 'personal_daily',
            section,
            historyBeforeSet: navigationHistoryRef.current,
        });
        setPersonalDailyInitialSection(section);
        if (!gateFeatureAccess('personal_daily', 'personal_daily')) return;
        navigateTo('personal_daily');
    }, [gateFeatureAccess, navigateTo]);

    const openHoroscopeLayer = useCallback((layer: HoroscopeLayer, options?: HoroscopeOpenOptions) => {
        if (layer === 'love') {
            openPersonalDailyView('love');
            return;
        }

        if (layer === 'work_money') {
            const sectionByKey: Record<string, PersonalDailySection> = {
                daily_love: 'love',
                daily_work_business: 'work',
                daily_money: 'money',
                daily_goals: 'goals',
                daily_family: 'family',
                daily_friendship: 'friendship',
                daily_energy: 'energy',
                daily_communication: 'communication',
            };
            openPersonalDailyView(sectionByKey[options?.dailySectionKey ?? 'daily_work_business'] ?? 'work');
            return;
        }

        if (layer === 'chart') {
            openPersonalDailyView('overview');
            return;
        }

        appDebugLog('navigation', {
            action: 'open_horoscope_layer',
            from: viewRef.current,
            to: 'horoscope',
            source: options?.source ?? null,
            historyBeforeSet: navigationHistoryRef.current,
        });
        navigateTo('horoscope');
    }, [navigateTo, openPersonalDailyView]);

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
            dailyPackageSessionRef.current = { key: '', data: null, promise: null };
            setDailyPackage(null);
            clearLocalHumanBaseReport(profile, primaryChartId ?? undefined);
            setPreloadedHumanReport(null);
            if (freshChart) {
                writeLocalNatalChart(profile, freshChart, freshPrimaryChartId ?? undefined);
                void prefetchBaseReportForChart(profile, freshPrimaryChartId ?? undefined);
            } else {
                clearLocalNatalChart(profile);
            }
            setPrimaryChartId(freshPrimaryChartId);
            setChartLoadState(freshChart?.sun && freshChart?.moon ? 'ready' : 'error');
            setChartData(freshChart);
            setActiveChartId(undefined);
        } catch (error) {
            console.error('[App] Failed to refresh primary chart state:', error);
            // Keep the existing local/session chart on transient DB errors.
        }
    }, [prefetchBaseReportForChart, primaryChartId, profile]);

    const handleBack = useCallback(async () => {
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
            } else {
                setActiveChartId(undefined);
            }

            setChartReturnView('dashboard');
            setView(returnView);
            return;
        }
        setView(returnView);
    }, [activeChartId, chartReturnView, chartsReturnView]);

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
    }, [view, handleBack]);

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

    const openMatrix = useCallback(() => {
        navigateTo('matrix');
    }, [navigateTo]);

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

    if (!profile || view === 'onboarding') {
        return (
            <div className="relative isolate fixed inset-0 h-[100dvh] overflow-hidden">
                <div className="relative z-10 h-full">
                    <Onboarding onComplete={handleOnboardingComplete} />
                </div>
            </div>
        );
    }

    const renderAppScrollHeader = () => (
        <>
            <Header
                profile={profile}
                view={view}
                scrollContainerRef={appScrollRef}
            />
            <div className="lumia-app-header-spacer" aria-hidden />
        </>
    );

    const isPrimaryChartView = activeChartId == null;
    const effectiveChartId = activeChartId ?? primaryChartId ?? undefined;

    const dailyScreenProps = {
        profile,
        chartData,
        chartId: primaryChartId,
        dailyPackage,
        initialSection: personalDailyInitialSection,
        onBack: handleBack,
        requestPremium,
        onCreateNatalChart: openBottomNatal,
    };

    return (
        <div
            className={`lumia-app-shell relative isolate flex w-full min-h-0 flex-col overflow-hidden font-sans selection:bg-astro-highlight selection:text-white ${
                lumiaAirShell ? 'text-text-main' : 'text-astro-text'
            }`}
        >
            <main
                className="lumia-tg-main-gutter relative z-10 flex-1 w-full max-w-md md:max-w-reading-wide mx-auto overflow-hidden min-h-0 bg-white"
            >
                <div
                    className={view === 'dashboard' ? 'flex h-full min-h-0 overflow-hidden' : 'hidden'}
                    aria-hidden={view !== 'dashboard'}
                >
                    <Dashboard
                        profile={profile}
                        chartData={chartData}
                        chartId={primaryChartId}
                        dailyPackage={dailyPackage}
                        onOpenHoroscopeLayer={openHoroscopeLayer}
                        onOpenPersonalDaily={openPersonalDailyView}
                        onCreateNatalChart={openBottomNatal}
                        onOpenSynastry={openSynastryFromHome}
                        onOpenMatrix={openMatrix}
                        onRequestPremium={requestPremium}
                        scrollRef={dashboardScrollRef}
                        initialTodaySection={initialTodaySection}
                    />
                </div>
                {view === 'admin' ? (
                    <AdminApp onClose={() => { void handleBack(); }} />
                ) : view === 'paywall' ? (
                    <Paywall
                        profile={profile}
                        onPurchase={(planId) => { void requestPremium('paywall', undefined, planId); }}
                        onClose={() => { const t = paywallTarget; setPaywallTarget(null); setView(t ?? 'dashboard'); }}
                        onContinueFree={() => { const t = paywallTarget; setPaywallTarget(null); setView(t ?? 'dashboard'); }}
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
                            onOpenPersonalDaily={() => openPersonalDailyView('overview')}
                        />
                    </div>
                ) : view === 'personal_daily' ? (
                    <div className="lumia-main-scroll scrollbar-hide" ref={appScrollRef}>
                        <PersonalDailyScreen {...dailyScreenProps} />
                    </div>
                ) : view === 'chart' ? (
                    <div className="lumia-main-scroll lumia-bottom-tab-scroll scrollbar-hide" ref={appScrollRef}>
                        <NatalMagazine
                            data={chartData}
                            profile={profile}
                            chartId={effectiveChartId}
                            requestPremium={requestPremium}
                            onUpdateProfile={handleProfileUpdate}
                            preloadedReport={isPrimaryChartView ? preloadedHumanReport : null}
                            onCreateChart={() => openNatalSetupOnboarding('chart', 'chart')}
                            onOpenPersonalDaily={() => openPersonalDailyView('overview')}
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
                        />
                    </div>
                ) : view === 'charts' ? (
                    <div className="lumia-main-scroll scrollbar-hide" ref={appScrollRef}>
                        {renderAppScrollHeader()}
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
                                    partnerTime: chart.birth_time,
                                    partnerPlace: chart.birth_place,
                                });
                            }}
                            onChartSelect={(chartData, chartId) => {
                                appDebugLog('navigation', {
                                    action: 'select_saved_chart',
                                    from: viewRef.current,
                                    to: 'chart',
                                    returnView: 'charts',
                                    chartId: !!chartId,
                                });
                                setChartData(chartData);
                                setActiveChartId(chartId);
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
            {!showPremiumPreview && (
                <LumiaBottomTabBar
                    profile={profile}
                    view={view}
                    onOpenToday={openBottomToday}
                    onOpenZodiac={openBottomZodiac}
                    onOpenNatal={openBottomNatal}
                    onOpenSynastry={openSynastryFromHome}
                    onOpenMore={openBottomAvatar}
                />
            )}
        </div>
    );
};

export default App;
