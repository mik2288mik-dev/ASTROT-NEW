
import React, { useEffect, useState, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { UserProfile, NatalChartData, ViewState } from './types';
import type { PreloadedNatalReport } from './components/NatalReading/HumanReport';
import { ServiceScreen, type ServiceTab } from './views/v2/ServiceScreen';
import { Settings } from './views/Settings';
import { MyCharts } from './views/MyCharts';
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
    hasNativeAppSession,
    isNativeAppRuntime,
    type AppSessionInvalidatedDetail,
} from './services/apiClient';
import { getChartFromDB, getOrCalculateChart, getPrimaryChartId } from './services/chartService';
import { clearLocalNatalChart, readLocalNatalChartCache, writeLocalNatalChart } from './lib/localNatalChartCache';
import {
    clearLocalHumanBaseReport,
    readLocalHumanBaseReportWithFallback,
    writeLocalHumanBaseReport,
} from './lib/localHumanBaseReportCache';
import { resolveStartParamRoute } from './lib/notificationDeepLink';
import { Dashboard } from './views/Dashboard';
import { PromoBanner } from './components/PromoBanner';
import { AppTopBar } from './components/lumia-ui/AppTopBar';
import {
    LumiaBottomTabBar,
    LumiaNavigationSheet,
    shouldShowLumiaBottomNavigation,
    type LumiaNavigationSheetId,
} from './components/lumia-ui/LumiaBottomTabBar';
import {
    getPersonalForecastPeriodKey,
    normalizeForecastTimezone,
    type PersonalForecastPeriod,
} from './lib/personalForecastContract';
import {
    NATAL_PERMANENT_CONTRACT_VERSION,
    buildPermanentNatalChartFingerprint,
} from './lib/natalReading/permanentReport';
import { Loading } from './components/ui/Loading';
import { getText } from './constants';
import { getPaymentProvider, type PaymentResult } from './services/paymentProvider';
import {
    openRuStoreSubscriptionManagement,
    restoreRuStorePurchases,
} from './services/rustorePayService';
import type { PremiumPlanId } from './lib/premiumPricing';
import { getAdminStatus } from './services/adminService';
import { recordNotificationAttribution, recordUserAppEvent, recordUserSession, waitForTelegramInitData } from './services/sessionService';
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
import {
    clearPersonalForecastSessionCache,
    loadPersonalForecast,
} from './services/personalForecastService';
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
import {
    createPaywallContextFromRequest,
    resolvePaywallOutcome,
    type PaywallContext,
    type PaywallOutcome,
} from './lib/paywallContext';
import type { PaywallPurchaseStatus } from './views/Paywall';
const Onboarding = dynamic(() => import('./views/Onboarding').then((module) => module.Onboarding), {
    ssr: false,
});
const NatalMagazine = dynamic(() => import('./views/v2/NatalMagazine').then((module) => module.NatalMagazine), { ssr: false });
const PersonalityReport = dynamic(() => import('./views/PersonalityReport').then((module) => module.PersonalityReport), { ssr: false });
const HoroscopeReader = dynamic(() => import('./views/v2/HoroscopeReader').then((module) => module.HoroscopeReader), { ssr: false });
const AdminApp = dynamic(() => import('./views/admin2/AdminApp').then((module) => module.AdminApp), { ssr: false });
const Paywall = dynamic(() => import('./views/Paywall').then((module) => module.Paywall), { ssr: false });
const UnionRoom = dynamic(() => import('./views/v2/UnionRoom').then((module) => module.UnionRoom), { ssr: false });
const MatrixRoom = dynamic(() => import('./views/v2/MatrixRoom').then((module) => module.MatrixRoom), { ssr: false });
const AstrologyEncyclopedia = dynamic(
    () => import('./views/v2/AstrologyEncyclopedia').then((module) => module.AstrologyEncyclopedia),
    { ssr: false },
);
const AuthGate = dynamic(() => import('./views/AuthGate').then((module) => module.AuthGate), { ssr: false });

// Get owner ID from environment variables for security
const OWNER_ID = process.env.NEXT_PUBLIC_OWNER_ID || '';
const STARTUP_SAFETY_TIMEOUT_MS = 12_000;
const STARTUP_PROFILE_FETCH_TIMEOUT_MS = 8_000;

function firstValueStorageKey(userId: string | number): string {
    return `lumia.firstValue.today.${String(userId)}`;
}

function readFirstValueReached(userId: string | number): boolean {
    if (typeof window === 'undefined') return false;
    try {
        return window.localStorage.getItem(firstValueStorageKey(userId)) === '1';
    } catch {
        return false;
    }
}

function persistFirstValueReached(userId: string | number): void {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(firstValueStorageKey(userId), '1');
    } catch {
        // The in-memory gate remains authoritative for the current session.
    }
}

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
const hasReadableNatalChart = (chart: NatalChartData | null | undefined): chart is NatalChartData => {
    if (!chart?.sun || !chart?.moon) return false;
    const quality = chart.birthTimeQuality || chart.chartQuality?.birthTimeQuality;
    return quality === 'unknown' || !!chart.rising;
};
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

const PRIMARY_CHART_NAVIGATION_VIEWS = new Set<ViewState>([
    'dashboard',
    'horoscope',
    'synastry',
    'chart',
    'personality',
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

function millisecondsUntilNextForecastDay(now: Date, timezone: string): number {
    const start = now.getTime();
    const currentKey = getPersonalForecastPeriodKey('day', now, timezone);
    let lower = start;
    let upper = start + (36 * 60 * 60 * 1000);

    if (getPersonalForecastPeriodKey('day', new Date(upper), timezone) === currentKey) {
        return 60 * 60 * 1000;
    }

    while (upper - lower > 250) {
        const midpoint = Math.floor((lower + upper) / 2);
        if (getPersonalForecastPeriodKey('day', new Date(midpoint), timezone) === currentKey) {
            lower = midpoint;
        } else {
            upper = midpoint;
        }
    }

    return Math.max(250, (upper - start) + 50);
}

function loadStartupPersonalForecasts(
    targetProfile: UserProfile,
): void {
    const timezone = normalizeForecastTimezone(targetProfile.birthTimezone);
    const now = new Date();
    const load = (period: PersonalForecastPeriod) => loadPersonalForecast({
        profile: targetProfile,
        period,
        periodKey: getPersonalForecastPeriodKey(period, now, timezone),
        options: { maxInProgressRetries: 60 },
    }).catch((error) => console.warn('[App] Personal forecast background refresh could not start', error));
    void load('day');
    if (hasActivePremium(targetProfile)) {
        void Promise.allSettled(['week', 'month'].map((period) => load(period as PersonalForecastPeriod)));
    }
}

const App: React.FC = () => {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [chartData, setChartData] = useState<NatalChartData | null>(null);
    const [chartLoadState, setChartLoadState] = useState<ChartLoadState>('idle');
    const [preloadedHumanReport, setPreloadedHumanReport] = useState<PreloadedNatalReport | null>(null);
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
    const [onboardingInitialStep, setOnboardingInitialStep] = useState<'stories' | 'birth'>('stories');
    const [dashboardPeriod, setDashboardPeriod] = useState<PersonalForecastPeriod>('day');
    const [navigationSheet, setNavigationSheet] = useState<LumiaNavigationSheetId | null>(null);
    const [serviceTab, setServiceTab] = useState<ServiceTab>('knowledge');
    const [serviceStoreContext] = useState<PaywallContext>(() => createPaywallContextFromRequest({
        source: 'settings',
        currentView: 'services',
    }));
    const [natalQuestionRequest, setNatalQuestionRequest] = useState(0);
    const [paywallContext, setPaywallContext] = useState<PaywallContext | null>(null);
    const [premiumContinuation, setPremiumContinuation] = useState<PaywallContext | null>(null);
    const [pendingPremiumRecovery, setPendingPremiumRecovery] = useState<{
        context: PaywallContext;
        planId: PremiumPlanId;
    } | null>(null);
    const [paywallInitialPlanId, setPaywallInitialPlanId] = useState<PremiumPlanId>('premium_quarter');
    const [paywallResumeNotice, setPaywallResumeNotice] = useState<string | null>(null);
    const [firstValueReached, setFirstValueReached] = useState(false);
    const [checkoutNotice, setCheckoutNotice] = useState<string | null>(null);
    const [synastryPrefill, setSynastryPrefill] = useState<SynastryPrefill>(null);
    const [chartsReturnView, setChartsReturnView] = useState<ViewState>('settings');
    const [chartReturnView, setChartReturnView] = useState<ViewState>('dashboard');
    const [currentDateKey, setCurrentDateKey] = useState(() => (
        getPersonalForecastPeriodKey('day', new Date(), 'Europe/Moscow')
    ));
    const lastSessionPingRef = useRef(0);
    const primaryChartSessionRef = useRef<{
        key: string;
        data: NatalChartData | null;
        promise: Promise<NatalChartData | null> | null;
    }>({ key: '', data: null, promise: null });
    const primaryChartDataRef = useRef<NatalChartData | null>(null);
    const requestedViewRef = useRef<ViewState | null>(null);
    const notificationLaunchRef = useRef<NotificationLaunchParams | null>(null);
    const notificationAttributionSentRef = useRef(false);
    const dashboardScrollRef = useRef<HTMLDivElement | null>(null);
    const appScrollRef = useRef<HTMLDivElement | null>(null);
    const paywallHostRef = useRef<HTMLDivElement | null>(null);
    const currentDateTimezone = normalizeForecastTimezone(
        primaryChartDataRef.current?.timezone || profile?.birthTimezone || chartData?.timezone,
    );
    const viewRef = useRef<ViewState>('onboarding');
    const onboardingTargetViewRef = useRef<ViewState>('dashboard');
    const onboardingCompletionRef = useRef(false);
    const restoredRuStoreUserRef = useRef<string | null>(null);
    const firstValueReachedRef = useRef(false);
    const navigationHistoryRef = useRef<ViewState[]>([]);

    useEffect(() => {
        const reached = !!profile?.id
            && (hasActivePremium(profile) || readFirstValueReached(profile.id));
        firstValueReachedRef.current = reached;
        setFirstValueReached(reached);
        setPremiumContinuation(null);
    }, [profile?.id]);

    useEffect(() => {
        const userId = profile?.id ? String(profile.id) : '';
        const endsAt = getProfilePremiumUntil(profile);
        const endsAtMs = endsAt ? new Date(endsAt).getTime() : Number.NaN;
        if (!userId || !hasActivePremium(profile) || !Number.isFinite(endsAtMs)) return;

        let disposed = false;
        let timer = 0;
        const refreshEntitlementAtBoundary = async () => {
            const remaining = endsAtMs - Date.now() + 50;
            if (remaining > 0) {
                timer = window.setTimeout(
                    () => void refreshEntitlementAtBoundary(),
                    Math.min(2_147_000_000, Math.max(1, remaining)),
                );
                return;
            }

            let refreshed: UserProfile | null = null;
            try {
                refreshed = await getProfile();
            } catch {
                // The local canonical end still closes access if refresh is offline.
            }
            if (disposed) return;
            if (refreshed && String(refreshed.id) === userId) {
                if (!hasActivePremium(refreshed)) setDashboardPeriod('day');
                setProfile(refreshed);
                return;
            }
            setDashboardPeriod('day');
            setProfile((current) => (
                current && String(current.id) === userId ? { ...current } : current
            ));
        };

        void refreshEntitlementAtBoundary();
        return () => {
            disposed = true;
            window.clearTimeout(timer);
        };
    }, [
        profile?.id,
        profile?.premiumEntitlement?.state,
        profile?.premiumEntitlement?.endsAt,
        profile?.premiumUntil,
    ]);

    const markFirstValueReached = useCallback(() => {
        if (!profile?.id || firstValueReachedRef.current) return;
        firstValueReachedRef.current = true;
        setFirstValueReached(true);
        persistFirstValueReached(profile.id);
    }, [profile?.id]);

    const completePremiumContinuation = useCallback((paywallInstanceId: string) => {
        setPremiumContinuation((current) => (
            current?.paywallInstanceId === paywallInstanceId ? null : current
        ));
    }, []);

    const getFallbackAdminStatus = useCallback((userId?: string | number, storedIsAdmin?: boolean) => {
        // The server profile is authoritative. A stale public owner ID must not
        // downgrade an account that is already marked as an administrator.
        if (storedIsAdmin) return true;
        return !!(OWNER_ID && userId && String(userId) === String(OWNER_ID));
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
        if (!userId || !targetChartData) return null;
        const cacheContext = { chartData: targetChartData || null };
        const reportCacheIdentity = {
            chartFingerprint: buildPermanentNatalChartFingerprint(targetProfile, targetChartData),
            reportVersion: NATAL_PERMANENT_CONTRACT_VERSION,
        };

        const cached = getHumanBaseReportCached(userId, targetChartId, targetProfile.language, reportCacheIdentity)
            || readLocalHumanBaseReportWithFallback(targetProfile, targetChartId, cacheContext);
        if (cached) {
            setPreloadedHumanReport({ report: cached, ...reportCacheIdentity });
            return cached;
        }
        const dbCached = await getCachedHumanBaseReport(userId, targetChartId, targetProfile.language, reportCacheIdentity).catch((error: any) => {
            console.warn('[App] Human base report cache read failed:', error?.message || error);
            return null;
        });
        if (dbCached) {
            writeLocalHumanBaseReport(targetProfile, dbCached, targetChartId, cacheContext);
            setPreloadedHumanReport({ report: dbCached, ...reportCacheIdentity });
            return dbCached;
        }
        return null;
    }, []);


    const loadPrimaryChartOnce = useCallback(async (targetProfile: UserProfile): Promise<NatalChartData | null> => {
        const key = getPrimaryChartLoadKey(targetProfile);
        const current = primaryChartSessionRef.current;

        if (current.key === key && hasReadableNatalChart(current.data)) {
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
                if (hasReadableNatalChart(chart)) {
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
            setStartupError('Не удалось подготовить данные NEBO. Попробуй ещё раз.');
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

        const prepareStartupPersonalForecasts = (targetProfile: UserProfile) => {
            if (cancelled) return;
            loadStartupPersonalForecasts(targetProfile);
        };

        const scheduleStartupBackgroundWork = (
            targetProfile: UserProfile,
            initialChart: NatalChartData,
            initialChartId: number | null,
            refreshChartFromDb: boolean,
        ) => {
            const userId = String(targetProfile.id);
            const startHumanBasePrefetch = (
                chartId: number,
                reportChartData: NatalChartData,
                isCurrentSnapshot: () => boolean,
            ) => {
                const reportCacheIdentity = {
                    chartFingerprint: buildPermanentNatalChartFingerprint(targetProfile, reportChartData),
                    reportVersion: NATAL_PERMANENT_CONTRACT_VERSION,
                };
                void prefetchHumanBaseReport(userId, chartId, targetProfile.language, reportCacheIdentity)
                    .then((report) => {
                        writeLocalHumanBaseReport(targetProfile, report, chartId, {
                            chartData: reportChartData,
                        });
                        if (!cancelled && isCurrentSnapshot()) {
                            setPreloadedHumanReport({ report, ...reportCacheIdentity });
                        }
                    })
                    .catch((error: any) => {
                        console.warn('[App] Human base report background prefetch failed:', error?.message || error);
                    });
            };
            if (initialChartId != null) {
                startHumanBasePrefetch(initialChartId, initialChart, () => (
                    primaryChartDataRef.current === initialChart
                ));
            }

            void (async () => {
                let chart = initialChart;
                let chartId = initialChartId;

                const chartRefresh = refreshChartFromDb
                    ? getChartFromDB(String(targetProfile.id))
                        .then((freshChart) => {
                            if (!hasReadableNatalChart(freshChart)) return;
                            chart = freshChart;
                            const key = getPrimaryChartLoadKey(targetProfile);
                            primaryChartSessionRef.current = { key, data: freshChart, promise: null };
                            primaryChartDataRef.current = freshChart;
                            writeLocalNatalChart(targetProfile, freshChart, chartId ?? undefined);
                            if (!cancelled) {
                                const freshFingerprint = buildPermanentNatalChartFingerprint(targetProfile, freshChart);
                                setPreloadedHumanReport((current) => (
                                    current?.chartFingerprint === freshFingerprint ? current : null
                                ));
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
                        if (initialChartId == null) {
                            const reportChart = chart;
                            startHumanBasePrefetch(freshPrimaryChartId, reportChart, () => (
                                primaryChartDataRef.current === reportChart
                            ));
                        }
                        if (!cancelled) {
                            setPrimaryChartId(freshPrimaryChartId);
                        }
                    })
                    .catch((error: any) => {
                        console.warn('[App] Background primary chart ID refresh failed:', error?.message || error);
                    });

                await Promise.all([chartRefresh, chartIdRefresh]);

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

            if (
                isNativeAppRuntime()
                && sessionMode === 'automatic'
                && !(await hasNativeAppSession())
            ) {
                if (cancelled) return;
                startupVisible = true;
                clearSafety();
                setProfile(null);
                resetPrimaryChartState();
                setAuthSessionMode('signed_out');
                setAuthSessionModeState('signed_out');
                setAuthGateMessage(null);
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
                        storedProfile = await getProfile({
                            maxAttempts: 1,
                            timeoutMs: STARTUP_PROFILE_FETCH_TIMEOUT_MS,
                        });
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
                    prepareStartupPersonalForecasts(updatedProfile);
                    if (cancelled) return;
                    showStartupDashboard('dashboard');
                    scheduleStartupBackgroundWork(updatedProfile, localEntry.chartData, startupChartId, true);
                    return;
                }

                prepareStartupPersonalForecasts(updatedProfile);
                showStartupDashboard(requestedViewRef.current || 'dashboard');
                void loadPrimaryChartOnce(updatedProfile).then((chart) => {
                    if (cancelled || !chart?.sun || !chart?.moon) return;
                    logStartupMetric('startup_chart_ready_ms', startupElapsedMs());
                    scheduleStartupBackgroundWork(updatedProfile, chart, null, false);
                }).catch((error: any) => {
                    console.warn('[App] Background primary chart load failed:', error?.message || error);
                });
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
                    const isFreshNativeLaunch = sessionMode === 'automatic' && isNativeAppRuntime();
                    setAuthSessionMode('signed_out');
                    setAuthSessionModeState('signed_out');
                    setAuthGateMessage(isFreshNativeLaunch
                        ? null
                        : 'Сессия завершена. Войди снова — старый аккаунт и его данные никуда не пропали.');
                    setStartupError(null);
                } else {
                    setStartupError(
                        error?.message === 'PERSONAL_FORECAST_STARTUP_FAILED'
                            ? 'Не удалось подготовить личный гороскоп. Попробуй ещё раз.'
                            : error?.message === 'PROFILE_NOT_FOUND'
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
    }, [loadPrimaryChartOnce, resetPrimaryChartState, resolveAuthoritativeAdminStatus, getFallbackAdminStatus, startupRetryNonce]);

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
            premiumEntitlement: isGuestOnboarding ? null : profile?.premiumEntitlement ?? null,
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
            setLoadingMessage(
                fullProfile.language === 'en'
                    ? 'Preparing your horoscope'
                    : 'Готовим твой гороскоп',
            );
            setLoadingProgress(82);
            loadStartupPersonalForecasts(fullProfile);
            void getPrimaryChartId(String(fullProfile.id))
                .then((primaryChartId) => {
                    if (primaryChartId != null) {
                        clearLocalHumanBaseReport(fullProfile, primaryChartId);
                        setPrimaryChartId(primaryChartId);
                        writeLocalNatalChart(fullProfile, generatedChart, primaryChartId);
                    }
                    return undefined;
                })
                .catch((prewarmError: any) => {
                    console.warn('[App] Onboarding background content flow failed:', prewarmError?.message || prewarmError);
                });
            setLoadingProgress(90);

            setLoadingProgress(100);
            setLoadingMessage(undefined);
            const targetView = onboardingTargetViewRef.current || 'dashboard';
            if (targetView === 'chart' || targetView === 'personality') {
                setActiveChartId(undefined);
                setActiveChartSubject(null);
                setChartReturnView('dashboard');
            }
            // First value is the saved chart followed by the personal Today.
            // Premium remains absent until the user reaches and taps the inline teaser.
            setDashboardPeriod('day');
            setView(targetView);
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
        setPendingPremiumRecovery(null);
        setPaywallContext(null);
        setPaywallResumeNotice(null);
        resetPrimaryChartState();
        restoredRuStoreUserRef.current = null;
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

    const handleGuestStart = useCallback(async () => {
        const previousMode = getAuthSessionMode();
        setAuthSessionMode('guest');
        setAuthSessionModeState('guest');
        try {
            const guestProfile = await startGuestAccount();
            resumeAuthenticatedStartup(guestProfile, 'guest');
        } catch (error) {
            setAuthSessionMode(previousMode);
            setAuthSessionModeState(previousMode);
            throw error;
        }
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
        if (typeof window === 'undefined' || typeof document === 'undefined') return;
        let timer: number | null = null;

        const refreshDateKey = () => {
            if (timer !== null) window.clearTimeout(timer);
            const now = new Date();
            const nextDateKey = getPersonalForecastPeriodKey('day', now, currentDateTimezone);
            setCurrentDateKey((current) => current === nextDateKey ? current : nextDateKey);
            timer = window.setTimeout(
                refreshDateKey,
                millisecondsUntilNextForecastDay(now, currentDateTimezone),
            );
        };
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') refreshDateKey();
        };

        refreshDateKey();
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            if (timer !== null) window.clearTimeout(timer);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [currentDateTimezone]);

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

    useEffect(() => {
        if (!paywallContext || typeof window === 'undefined') return;
        const host = paywallHostRef.current;
        host?.focus();
        const frame = window.requestAnimationFrame(() => {
            const closeButton = host?.querySelector<HTMLButtonElement>('.pw2-close');
            (closeButton || host)?.focus();
        });
        return () => window.cancelAnimationFrame(frame);
    }, [paywallContext?.paywallInstanceId]);

    const paywallEventPayload = (
        context: PaywallContext,
        extra?: Record<string, unknown>,
    ) => ({
        placement: context.placement,
        featureKey: context.featureKey,
        triggerType: context.triggerType,
        returnView: context.returnView,
        returnScrollAnchor: context.returnScrollAnchor || undefined,
        paywallInstanceId: context.paywallInstanceId,
        ...(extra || {}),
    });

    const restoreScrollAnchor = (anchor: string | null) => {
        if (!anchor || typeof window === 'undefined') return;
        window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
                document.getElementById(anchor)?.scrollIntoView({ block: 'center' });
            });
        });
    };

    const returnFromPaywall = (
        context: PaywallContext,
        outcome: PaywallOutcome,
        notice?: string,
    ) => {
        const destination = resolvePaywallOutcome(context, outcome);
        if (context.placement === 'today') setDashboardPeriod('day');
        if (outcome === 'purchase_succeeded' && context.placement === 'week') setDashboardPeriod('week');
        if (outcome === 'purchase_succeeded' && context.placement === 'month') setDashboardPeriod('month');
        setPaywallContext(null);
        setPaywallResumeNotice(null);
        setPremiumContinuation(destination.shouldOpenFeature ? context : null);
        setView(destination.view);
        if (notice) setCheckoutNotice(notice);
        restoreScrollAnchor(destination.scrollAnchor);
    };

    const profileFromValidatedPayment = async (
        result: Extract<PaymentResult, { status: 'completed' }>,
    ): Promise<UserProfile | null> => {
        if (result.entitlement) {
            return {
                ...profile!,
                isPremium: result.entitlement.isPremium,
                premiumUntil: result.entitlement.endsAt,
                premiumEntitlement: result.entitlement,
            };
        }
        const fresh = await getProfile().catch(() => null);
        return fresh && hasActivePremium(fresh) ? fresh : null;
    };

    const purchasePremiumPlan = async (
        planId: PremiumPlanId,
        contextOverride?: PaywallContext,
    ): Promise<PaywallPurchaseStatus> => {
        const context = paywallContext || contextOverride;
        if (!profile || !context) return 'unavailable';
        const contextualOverlayOpen = paywallContext?.paywallInstanceId === context.paywallInstanceId;
        const finishPurchase = (outcome: PaywallOutcome, notice: string) => {
            if (contextualOverlayOpen) returnFromPaywall(context, outcome, notice);
            else setCheckoutNotice(notice);
        };
        void recordUserAppEvent({
            eventType: 'checkout_started',
            section: 'premium',
            source: context.placement,
            eventPayload: paywallEventPayload(context, { planId }),
        });

        const paymentResult = await getPaymentProvider().purchase(profile, planId);
        if (
            (paymentResult.status === 'unavailable' || paymentResult.status === 'failed')
            && paymentResult.reason === 'RECOVERY_IDENTITY_REQUIRED'
        ) {
            void recordUserAppEvent({
                eventType: 'purchase_failed',
                section: 'premium',
                source: context.placement,
                eventPayload: paywallEventPayload(context, { planId, reasonCode: paymentResult.reason }),
            });
            setPendingPremiumRecovery({ context, planId });
            setPaywallInitialPlanId(planId);
            setPaywallResumeNotice(null);
            setPaywallContext(null);
            setNavigationSheet(null);
            setView('settings');
            if (typeof window !== 'undefined') {
                window.requestAnimationFrame(() => {
                    window.requestAnimationFrame(() => {
                        document.getElementById('recovery-identity')?.scrollIntoView({ block: 'start' });
                    });
                });
            }
            return 'recovery_required';
        }
        if (paymentResult.status === 'pending') {
            setCheckoutNotice('Оплата ещё обрабатывается в RuStore. Дождись результата или нажми «Восстановить покупку».');
            return 'pending';
        }
        if (paymentResult.status === 'cancelled') {
            void recordUserAppEvent({
                eventType: 'purchase_cancelled',
                section: 'premium',
                source: context.placement,
                eventPayload: paywallEventPayload(context, { planId, reasonCode: 'CHECKOUT_CANCELLED' }),
            });
            finishPurchase('checkout_cancelled', 'Оплата не завершена. Деньги не списаны.');
            return 'cancelled';
        }
        if (paymentResult.status === 'unavailable') {
            void recordUserAppEvent({
                eventType: 'purchase_failed',
                section: 'premium',
                source: context.placement,
                eventPayload: paywallEventPayload(context, { planId, reasonCode: paymentResult.reason }),
            });
            finishPurchase('checkout_unavailable', 'Покупка сейчас недоступна. Уже действующий Premium продолжит работать.');
            return 'unavailable';
        }
        if (paymentResult.status === 'failed') {
            void recordUserAppEvent({
                eventType: 'purchase_failed',
                section: 'premium',
                source: context.placement,
                eventPayload: paywallEventPayload(context, { planId, reasonCode: paymentResult.reason }),
            });
            finishPurchase('checkout_failed', 'Не удалось открыть оплату. Проверь RuStore и подключение к интернету.');
            return 'failed';
        }

        const validatedProfile = await profileFromValidatedPayment(paymentResult);
        if (!validatedProfile || !hasActivePremium(validatedProfile)) {
            void recordUserAppEvent({
                eventType: 'purchase_failed',
                section: 'premium',
                source: context.placement,
                eventPayload: paywallEventPayload(context, { planId, reasonCode: 'BACKEND_ENTITLEMENT_MISSING' }),
            });
            finishPurchase('checkout_failed', 'Не удалось открыть оплату. Проверь RuStore и подключение к интернету.');
            return 'failed';
        }

        setProfile(validatedProfile);
        firstValueReachedRef.current = true;
        setFirstValueReached(true);
        clearPersonalForecastSessionCache();
        void recordUserAppEvent({
            eventType: 'purchase_succeeded',
            section: 'premium',
            source: context.placement,
            eventPayload: paywallEventPayload(context, {
                planId,
                entitlementState: validatedProfile.premiumEntitlement?.state || 'paid',
                entitlementEndsAt: validatedProfile.premiumEntitlement?.endsAt || undefined,
            }),
        });
        finishPurchase('purchase_succeeded', 'Premium открыт. Возвращаем туда, где ты остановился.');
        return 'completed';
    };

    const restorePremiumPurchases = async (context?: PaywallContext): Promise<void> => {
        const analyticsContext = context || createPaywallContextFromRequest({
            source: 'settings',
            currentView: viewRef.current,
        });
        void recordUserAppEvent({
            eventType: 'restore_started',
            section: 'premium',
            source: analyticsContext.placement,
            eventPayload: paywallEventPayload(analyticsContext),
        });
        const results = await restoreRuStorePurchases();
        const completed = results.find((result): result is Extract<PaymentResult, { status: 'completed' }> => (
            result.status === 'completed'
        ));
        const validatedProfile = completed
            ? await profileFromValidatedPayment(completed)
            : null;
        if (!validatedProfile || !hasActivePremium(validatedProfile)) {
            const reason = results.find((result) => result.status === 'failed' || result.status === 'unavailable');
            void recordUserAppEvent({
                eventType: 'restore_failed',
                section: 'premium',
                source: analyticsContext.placement,
                eventPayload: paywallEventPayload(analyticsContext, {
                    reasonCode: reason && 'reason' in reason ? reason.reason : 'NO_VALID_PURCHASE',
                }),
            });
            throw new Error('RUSTORE_RESTORE_NOT_CONFIRMED');
        }
        setProfile(validatedProfile);
        firstValueReachedRef.current = true;
        setFirstValueReached(true);
        clearPersonalForecastSessionCache();
        void recordUserAppEvent({
            eventType: 'restore_succeeded',
            section: 'premium',
            source: analyticsContext.placement,
            eventPayload: paywallEventPayload(analyticsContext, {
                entitlementState: validatedProfile.premiumEntitlement?.state || 'paid',
                entitlementEndsAt: validatedProfile.premiumEntitlement?.endsAt || undefined,
            }),
        });
        if (context) {
            returnFromPaywall(
                context,
                'purchase_succeeded',
                'Premium открыт. Возвращаем туда, где ты остановился.',
            );
        }
    };

    const requestPremium = async (
        source = 'app',
        eventPayload?: Record<string, unknown>,
        planId?: PremiumPlanId,
        options?: { bypassFirstValueGate?: boolean },
    ) => {
        if (!profile) return;
        if (planId) {
            await purchasePremiumPlan(planId);
            return;
        }
        const context = createPaywallContextFromRequest({
            source,
            payload: eventPayload,
            currentView: viewRef.current,
        });
        setPaywallInitialPlanId('premium_quarter');
        setPaywallResumeNotice(null);
        setPremiumContinuation(null);
        if (context.triggerType === 'locked_feature') {
            void recordUserAppEvent({
                eventType: 'locked_feature_tapped',
                section: 'premium',
                source,
                eventPayload: paywallEventPayload(context),
            });
        }
        if (
            !hasActivePremium(profile)
            && !firstValueReachedRef.current
            && !options?.bypassFirstValueGate
        ) {
            setPaywallContext(null);
            setDashboardPeriod('day');
            setView('dashboard');
            setCheckoutNotice(profile.language === 'en'
                ? 'Your personal Today comes first. Read the open part, then Premium options will appear.'
                : 'Сначала — твой личный Today. Прочитай открытую часть, и затем появятся возможности Premium.');
            return;
        }
        // A controlled Week/Month request can leave Today mounted behind the
        // paywall. Disarm it now so close/cancel cannot immediately retrigger;
        // purchase success restores the requested period in returnFromPaywall.
        if (!hasActivePremium(profile) && (context.placement === 'week' || context.placement === 'month')) {
            setDashboardPeriod('day');
        }
        setPaywallContext(context);
        void recordUserAppEvent({
            eventType: 'paywall_impression',
            section: 'premium',
            source,
            eventPayload: paywallEventPayload(context, { defaultPlanId: 'premium_quarter' }),
        });
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
        setOnboardingInitialStep('birth');
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
            void requestPremium('feature_gate', {
                placement: featureKey === 'synastry_by_charts'
                    ? 'compatibility_by_charts'
                    : 'deep_natal',
                featureKey,
                triggerType: 'locked_feature',
                returnView: viewRef.current,
            });
            return false;
        }

        return false;
    }, [getFeatureAccess, openNatalSetupOnboarding]);

    const navigateTo = useCallback((newView: ViewState, options?: { replace?: boolean }) => {
        if (!profile) return;
        const currentView = viewRef.current;

        if (PRIMARY_CHART_NAVIGATION_VIEWS.has(newView)) {
            setActiveChartId(undefined);
            setActiveChartSubject(null);
            if (primaryChartDataRef.current) {
                setChartData(primaryChartDataRef.current);
            }
        }

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
        } catch (error) {
            console.error('[App] Failed to refresh primary chart state:', error);
            // Keep the existing local/session chart on transient DB errors.
        }
    }, [prefetchBaseReportForChart, primaryChartId, profile]);

    const handleBack = useCallback(async () => {
        if (navigationSheet) {
            setNavigationSheet(null);
            return;
        }
        if (paywallContext) {
            returnFromPaywall(paywallContext, 'close');
            return;
        }
        const currentView = viewRef.current;
        const fallbackView =
            currentView === 'admin'
                ? 'settings'
                : currentView === 'charts'
                  ? chartsReturnView
                  : currentView === 'personality'
                    ? 'chart'
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
    }, [activeChartId, chartReturnView, chartsReturnView, navigationSheet, paywallContext]);

    const handleSurfaceBack = useCallback(() => {
        if (navigationSheet || paywallContext) {
            void handleBack();
            return;
        }
        const detail: NativeBackEventDetail = { handled: false };
        window.dispatchEvent(new CustomEvent<NativeBackEventDetail>(NATIVE_BACK_EVENT, { detail }));
        if (!detail.handled) void handleBack();
    }, [handleBack, navigationSheet, paywallContext]);

    useEffect(() => {
        setNavigationSheet(null);
    }, [view]);

    // Нативная кнопка «назад» Telegram заменяет нижний таб-бар:
    // на главной скрыта, на остальных экранах показывается и ведёт назад.
    useEffect(() => {
        const tg = (window as any).Telegram?.WebApp;
        const backButton = tg?.BackButton;
        if (!backButton) return;
        const handler = handleSurfaceBack;
        const isRoot = !paywallContext
            && !navigationSheet
            && (view === 'dashboard' || view === 'onboarding');
        if (isRoot) {
            backButton.hide?.();
            return;
        }
        backButton.onClick?.(handler);
        backButton.show?.();
        return () => { backButton.offClick?.(handler); };
    }, [handleSurfaceBack, navigationSheet, paywallContext, view]);

    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;

        let disposed = false;
        let backHandle: { remove: () => Promise<void> } | undefined;
        let appStateHandle: { remove: () => Promise<void> } | undefined;
        let lastRootBackAt = 0;

        void CapacitorApp.addListener('backButton', () => {
            if (navigationSheet || paywallContext) {
                void handleBack();
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
            const nextDateKey = getPersonalForecastPeriodKey(
                'day',
                new Date(),
                currentDateTimezone,
            );
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
    }, [currentDateTimezone, handleBack, navigationSheet, paywallContext]);

    const openCharts = useCallback((returnView: ViewState) => {
        setChartsReturnView(returnView);
        navigateTo('charts');
    }, [navigateTo]);

    const openSynastryWithPrefill = useCallback((prefill: SynastryPrefill) => {
        if (!gateFeatureAccess('synastry_by_charts', 'synastry')) return;
        setSynastryPrefill(prefill);
        navigateTo('synastry');
    }, [gateFeatureAccess, navigateTo]);

    const openPersonalityReport = useCallback(() => {
        if (!chartData) {
            openNatalSetupOnboarding(viewRef.current, 'personality');
            return;
        }
        navigateTo('personality');
    }, [chartData, navigateTo, openNatalSetupOnboarding]);

    const openBottomToday = useCallback(() => {
        setDashboardPeriod('day');
        navigateTo('dashboard', { replace: true });
    }, [navigateTo]);

    const openBottomZodiac = useCallback(() => {
        navigateTo('horoscope', { replace: true });
    }, [navigateTo]);

    const openBottomNatal = useCallback(() => {
        navigateTo('chart', { replace: true });
    }, [navigateTo]);

    const openSynastryFromHome = useCallback(() => {
        setSynastryPrefill(null);
        navigateTo('synastry');
    }, [navigateTo]);

    const openProfileSheet = useCallback(() => {
        setNavigationSheet('profile');
    }, []);
    const openNavigationServices = useCallback(() => {
        setNavigationSheet(null);
        navigateTo('services');
    }, [navigateTo]);
    const openNavigationCompatibility = useCallback(() => {
        setNavigationSheet(null);
        openSynastryFromHome();
    }, [openSynastryFromHome]);
    const openNavigationNatal = useCallback(() => {
        setNavigationSheet(null);
        openBottomNatal();
    }, [openBottomNatal]);
    const openProfileCharts = useCallback(() => {
        const returnView = viewRef.current === 'charts' ? 'dashboard' : viewRef.current;
        setNavigationSheet(null);
        openCharts(returnView);
    }, [openCharts]);
    const openServiceStore = useCallback(() => {
        setServiceTab('store');
        setNavigationSheet(null);
        if (viewRef.current !== 'services') navigateTo('services');
    }, [navigateTo]);
    const managePremiumSubscription = useCallback(async () => {
        const opened = await openRuStoreSubscriptionManagement();
        if (!opened) {
            setCheckoutNotice('Не удалось открыть управление подпиской. Открой раздел подписок в RuStore.');
        }
    }, []);
    const completePremiumRecoveryIdentity = useCallback(() => {
        if (!pendingPremiumRecovery) return;
        const pending = pendingPremiumRecovery;
        setPendingPremiumRecovery(null);
        setPaywallInitialPlanId(pending.planId);
        setPaywallResumeNotice('Способ восстановления привязан. Выбранный тариф сохранён — можно продолжить покупку.');
        setView(pending.context.returnView);
        setPaywallContext(pending.context);
    }, [pendingPremiumRecovery]);

    // Свайп назад от левого края (как в iOS) — на всех экранах, кроме корневых/модальных
    const canSwipeBack =
        view !== 'dashboard' &&
        view !== 'onboarding' &&
        view !== 'paywall';
    useSwipeBack({
        onSwipeBack: handleSurfaceBack,
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
                onGuestStart={handleGuestStart}
            />
        );
    }

    if (startupError) {
        return (
            <div className="fixed inset-0 flex h-[100dvh] items-center justify-center bg-white px-6 text-[#1f1f1f]">
                <div className="max-w-sm text-center">
                    <p className="lumia-brand-wordmark mb-6">NEBO</p>
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
                message="Сессия не найдена. Продолжи без аккаунта или войди в существующий."
                onAccountLogin={handleAccountLogin}
                onGuestStart={handleGuestStart}
            />
        );
    }

    const hasPendingOnboardingDraft = !profile.isSetup && Boolean(
        profile.birthDate?.trim()
        || profile.birthTime?.trim()
        || profile.birthPlace?.trim()
    );

    if (view === 'onboarding') {
        return (
            <div className="relative isolate fixed inset-0 h-[100dvh] overflow-hidden">
                <div className="relative z-10 h-full">
                    <Onboarding
                        onComplete={handleOnboardingComplete}
                        initialStep={hasPendingOnboardingDraft ? 'birth' : onboardingInitialStep}
                        initialProfile={hasPendingOnboardingDraft ? profile : undefined}
                        onSkip={() => {
                            setDashboardPeriod('day');
                            setView('dashboard');
                        }}
                        onSignIn={() => { void handleLogout(); }}
                    />
                </div>
            </div>
        );
    }

    const isSavedPersonChartView = activeChartSubject?.subject_type === 'saved_person'
        || activeChartSubject?.is_primary === false;
    const isPrimaryChartView = !isSavedPersonChartView;
    const effectiveChartId = activeChartId ?? primaryChartId ?? undefined;
    const showsBottomNavigation = !paywallContext && shouldShowLumiaBottomNavigation(view);

    const premiumPromotionAllowed = firstValueReached && !hasActivePremium(profile);
    const dashboardProps = {
        profile,
        currentDateKey,
        onCreateNatalChart: openBottomNatal,
        onOpenSynastry: openSynastryFromHome,
        onOpenHoroscope: openBottomZodiac,
        requestedPeriod: dashboardPeriod,
        onPeriodChange: setDashboardPeriod,
        onOpenCharts: openProfileCharts,
        onRequestPremium: requestPremium,
        canPromotePremium: premiumPromotionAllowed,
        onPremiumAnalytics: (
            eventType: 'first_value_viewed'
                | 'locked_feature_tapped'
                | 'premium_promo_impression'
                | 'premium_promo_clicked'
                | 'premium_promo_dismissed',
            eventPayload: Record<string, unknown>,
        ) => {
            if (eventType === 'first_value_viewed') markFirstValueReached();
            void recordUserAppEvent({
                eventType,
                section: 'personal_forecast',
                source: 'personal_forecast_feed',
                eventPayload,
            });
        },
    };

    const renderMyCharts = (returnView: ViewState, embedded = false) => (
        <MyCharts
            profile={profile}
            embedded={embedded}
            onProfileUpdate={handleProfileUpdate}
            onPrimaryChartUpdated={refreshPrimaryChartState}
            onRequestPremium={(source, payload) => void requestPremium(source || 'charts', payload)}
            premiumContinuation={premiumContinuation}
            onPremiumContinuationHandled={completePremiumContinuation}
            canPromotePremium={premiumPromotionAllowed}
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
                    returnView,
                    chartId: !!chart.id,
                });
                setChartData(chart.chart_data);
                setActiveChartId(chart.id);
                setActiveChartSubject(chart);
                setChartReturnView(returnView);
                pushReturnView(viewRef.current);
                setView('chart');
            }}
        />
    );

    return (
        <div
            className={`lumia-app-shell relative isolate flex w-full min-h-0 flex-col overflow-hidden font-sans selection:bg-astro-highlight selection:text-white ${
                showsBottomNavigation ? 'has-today-bottom-navigation' : ''
            } ${
                lumiaAirShell ? 'text-text-main' : 'text-astro-text'
            }`}
        >
            <main
                className="lumia-tg-main-gutter relative z-10 flex-1 w-full max-w-reading-wide mx-auto overflow-hidden min-h-0 bg-white"
                aria-hidden={navigationSheet || paywallContext ? true : undefined}
                inert={navigationSheet || paywallContext ? true : undefined}
            >
                <div
                    className={view === 'dashboard' ? 'flex h-full min-h-0 overflow-hidden' : 'hidden'}
                    aria-hidden={view !== 'dashboard'}
                >
                    <Dashboard {...dashboardProps} scrollRef={dashboardScrollRef} />
                </div>
                {view === 'admin' ? (
                    <AdminApp onClose={() => { void handleBack(); }} />
                ) : view === 'synastry' ? (
                    <div className="lumia-main-scroll lumia-bottom-tab-scroll scrollbar-hide" ref={appScrollRef}>
                        <UnionRoom
                            profile={profile}
                            chartData={chartData}
                            chartId={primaryChartId ?? null}
                            requestPremium={requestPremium}
                            initialPrefill={synastryPrefill}
                            onOpenCharts={openProfileCharts}
                            onCreateNatalChart={openBottomNatal}
                            onUpdateProfile={handleProfileUpdate}
                            premiumContinuation={premiumContinuation}
                            onPremiumContinuationHandled={completePremiumContinuation}
                            canPromotePremium={premiumPromotionAllowed}
                            onOpenEncyclopedia={() => navigateTo('encyclopedia')}
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
                        <MatrixRoom
                            profile={profile}
                            onBack={() => { void handleBack(); }}
                            onOpenProfile={openProfileSheet}
                        />
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
                            onOpenPersonalForecast={() => navigateTo('dashboard')}
                            onOpenCharts={openProfileCharts}
                        />
                    </div>
                ) : view === 'personality' && chartData ? (
                    <div className="lumia-main-scroll lumia-bottom-tab-scroll scrollbar-hide" ref={appScrollRef}>
                        <PersonalityReport
                            profile={profile}
                            primaryChartData={primaryChartDataRef.current || chartData}
                            primaryChartId={primaryChartId ?? undefined}
                            preloadedReport={preloadedHumanReport}
                            requestPremium={() => { void requestPremium('personality'); }}
                            onBack={() => { void handleBack(); }}
                            onOpenProfile={openProfileSheet}
                            onOpenNatalChart={(selected) => {
                                if (selected) {
                                    setChartData(selected.chart_data);
                                    setActiveChartId(selected.id);
                                    setActiveChartSubject(selected);
                                    setChartReturnView('personality');
                                } else {
                                    setChartData(primaryChartDataRef.current || chartData);
                                    setActiveChartId(undefined);
                                    setActiveChartSubject(null);
                                    setChartReturnView('personality');
                                }
                                pushReturnView('personality');
                                setView('chart');
                            }}
                            onCompareWithMe={(selected) => {
                                if (primaryChartDataRef.current) setChartData(primaryChartDataRef.current);
                                setActiveChartId(undefined);
                                setActiveChartSubject(null);
                                openSynastryWithPrefill({
                                    source: 'saved-chart',
                                    partnerChartId: selected.id,
                                    partnerName: selected.name,
                                    partnerDate: selected.birth_date,
                                    partnerTime: selected.birth_time || undefined,
                                    partnerPlace: selected.birth_place,
                                });
                            }}
                        />
                    </div>
                ) : view === 'chart' ? (
                    <div className="lumia-main-scroll lumia-bottom-tab-scroll scrollbar-hide" ref={appScrollRef}>
                        <NatalMagazine
                            data={chartData}
                            profile={profile}
                            chartLoadState={chartLoadState}
                            onRetryChart={() => { void loadPrimaryChartOnce(profile); }}
                            chartId={effectiveChartId}
                            chartSubject={activeChartSubject}
                            requestPremium={requestPremium}
                            onUpdateProfile={handleProfileUpdate}
                            preloadedReport={isPrimaryChartView ? preloadedHumanReport : null}
                            onCreateChart={() => openNatalSetupOnboarding('chart', 'chart')}
                            onOpenPersonalityReport={openPersonalityReport}
                            premiumContinuation={premiumContinuation}
                            onPremiumContinuationHandled={completePremiumContinuation}
                            canPromotePremium={premiumPromotionAllowed}
                            openQuestionRequest={natalQuestionRequest}
                            onQuestionRequestHandled={() => setNatalQuestionRequest(0)}
                            onOpenCharts={openProfileCharts}
                            onOpenEncyclopedia={() => navigateTo('encyclopedia')}
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
                ) : view === 'services' ? (
                    <div className="lumia-main-scroll lumia-bottom-tab-scroll scrollbar-hide" ref={appScrollRef}>
                        <ServiceScreen
                            profile={profile}
                            activeTab={serviceTab}
                            onTabChange={setServiceTab}
                            onOpenCharts={openProfileCharts}
                            premiumStoreContent={(
                                <Paywall
                                    embedded
                                    profile={profile}
                                    context={serviceStoreContext}
                                    onPurchase={(planId) => purchasePremiumPlan(planId, serviceStoreContext)}
                                    initialPlanId={paywallInitialPlanId}
                                    onClose={() => undefined}
                                    onContinueFree={() => undefined}
                                    onRestore={() => restorePremiumPurchases()}
                                    onManageSubscription={managePremiumSubscription}
                                    onPlanSelected={(planId) => {
                                        setPaywallInitialPlanId(planId);
                                        void recordUserAppEvent({
                                            eventType: 'plan_selected',
                                            section: 'premium',
                                            source: serviceStoreContext.placement,
                                            eventPayload: paywallEventPayload(serviceStoreContext, { planId }),
                                        });
                                    }}
                                />
                            )}
                            settingsContent={(
                                <Settings
                                    embedded
                                    profile={profile}
                                    onUpdate={handleProfileUpdate}
                                    onRequestPremium={openServiceStore}
                                    onRestorePurchase={() => restorePremiumPurchases()}
                                    onManageSubscription={managePremiumSubscription}
                                    onOpenAdmin={() => navigateTo('admin')}
                                    onOpenCharts={openProfileCharts}
                                    onLogout={handleLogout}
                                    onDeleteAccount={handleDeleteAccount}
                                    recoveryIdentityRequired={pendingPremiumRecovery !== null}
                                    onRecoveryIdentityReady={completePremiumRecoveryIdentity}
                                />
                            )}
                        />
                    </div>
                ) : view === 'encyclopedia' ? (
                    <div className="lumia-main-scroll lumia-bottom-tab-scroll scrollbar-hide" ref={appScrollRef}>
                        <AstrologyEncyclopedia
                            profile={profile}
                            onOpenCharts={openProfileCharts}
                        />
                    </div>
                ) : view === 'settings' ? (
                    <div className="lumia-main-scroll lumia-bottom-tab-scroll scrollbar-hide" ref={appScrollRef}>
                        <Settings
                            profile={profile}
                            onBack={() => { void handleBack(); }}
                            onUpdate={handleProfileUpdate}
                            onRequestPremium={openServiceStore}
                            onRestorePurchase={() => restorePremiumPurchases()}
                            onManageSubscription={managePremiumSubscription}
                            onOpenAdmin={() => navigateTo('admin')}
                            onOpenCharts={openProfileCharts}
                            onLogout={handleLogout}
                            onDeleteAccount={handleDeleteAccount}
                            recoveryIdentityRequired={pendingPremiumRecovery !== null}
                            onRecoveryIdentityReady={completePremiumRecoveryIdentity}
                        />
                    </div>
                ) : view === 'charts' ? (
                    <div className="lumia-main-scroll lumia-bottom-tab-scroll scrollbar-hide" ref={appScrollRef}>
                        <AppTopBar
                            title={profile.language === 'en' ? 'My charts' : 'Мои карты'}
                            onBack={() => { void handleBack(); }}
                        />
                        {renderMyCharts('charts')}
                    </div>
                ) : null}
            </main>

            {paywallContext ? (
                <div
                    ref={paywallHostRef}
                    className="fixed inset-0 z-[150] h-[100dvh] overflow-hidden bg-white"
                    role="dialog"
                    aria-modal="true"
                    aria-label={profile.language === 'en' ? 'Premium' : 'Premium'}
                    tabIndex={-1}
                >
                    <Paywall
                        profile={profile}
                        context={paywallContext}
                        onPurchase={purchasePremiumPlan}
                        initialPlanId={paywallInitialPlanId}
                        resumeNotice={paywallResumeNotice}
                        onClose={() => returnFromPaywall(paywallContext, 'close')}
                        onContinueFree={() => returnFromPaywall(paywallContext, 'close')}
                        onRestore={() => restorePremiumPurchases(paywallContext)}
                        onPlanSelected={(planId) => {
                            setPaywallInitialPlanId(planId);
                            void recordUserAppEvent({
                                eventType: 'plan_selected',
                                section: 'premium',
                                source: paywallContext.placement,
                                eventPayload: paywallEventPayload(paywallContext, { planId }),
                            });
                        }}
                    />
                </div>
            ) : null}

            {checkoutNotice && !paywallContext ? (
                <div
                    role="status"
                    aria-live="polite"
                    className="fixed inset-x-4 bottom-6 z-[120] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-mono-ink shadow-lg"
                >
                    <span className="min-w-0 flex-1">{checkoutNotice}</span>
                    <button
                        type="button"
                        className="min-h-[44px] shrink-0 px-2 font-semibold"
                        aria-label="Закрыть сообщение"
                        onClick={() => setCheckoutNotice(null)}
                    >
                        ×
                    </button>
                </div>
            ) : null}

            {showsBottomNavigation ? (
                <>
                    <LumiaBottomTabBar
                        profile={profile}
                        view={view}
                        onOpenToday={openBottomToday}
                        onOpenZodiac={openBottomZodiac}
                        onOpenServices={openNavigationServices}
                        onOpenCompatibility={openNavigationCompatibility}
                        onOpenNatal={openNavigationNatal}
                    />
                    <LumiaNavigationSheet
                        activeSheet={navigationSheet}
                        profile={profile}
                        onClose={() => setNavigationSheet(null)}
                        onOpenNatal={openNavigationNatal}
                        onOpenCharts={openProfileCharts}
                    />
                </>
            ) : null}
        </div>
    );
};

export default App;
