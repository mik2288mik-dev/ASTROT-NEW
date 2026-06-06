
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { UserProfile, NatalChartData, ViewState, HoroscopeLayer, NatalInterpretationReport, type HoroscopeOpenOptions, type PersonalDailySection } from './types';
import {
    getProfile,
    saveProfile,
    getChartData,
    runReferralFromStartParam,
} from './services/storageService';
import { getOrCalculateChart, getPrimaryChartId } from './services/chartService';
import { updateContentIfNeeded } from './services/contentGenerationService';
import { prewarmUserContent } from './services/contentPrewarmService';
import {
    CACHE_ONLY_PREWARM_BUDGET_MS,
    ENABLE_LEGACY_DASHBOARD_CONTENT_SYNC,
} from './lib/appStartupFlags';
import { getMoscowTodayKey } from './lib/date-utils';
import { Onboarding } from './views/Onboarding';
import { Dashboard } from './views/Dashboard';
import { NatalChart } from './views/NatalChart';
import { Horoscope } from './views/Horoscope';
import { PersonalDailyScreen } from './views/DailyContentScreens';
import { OracleChat } from './views/OracleChat';
import { Settings } from './views/Settings';
import { AdminPanel } from './views/AdminPanel';
import { Header } from './components/Header';
import { Loading } from './components/ui/Loading';
import { getText } from './constants';
import { PremiumPreview } from './components/PremiumPreview';
import { requestStarsPayment } from './services/telegramService';
import { HookChat } from './views/HookChat';
import { Paywall } from './views/Paywall';
import { Synastry } from './views/Synastry';
import { MyCharts } from './views/MyCharts';
import { getAdminStatus } from './services/adminService';
import { recordNotificationAttribution, recordUserAppEvent, recordUserSession } from './services/sessionService';
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
import { LumiaDebugOverlay } from './components/lumia-ui/LumiaDebugOverlay';
import { LumiaBottomTabBar } from './components/lumia-ui/LumiaBottomTabBar';
import { captureLumiaHomeLayout, installLumiaDebugGlobal, lumiaDebugLog } from './lib/lumiaDebug';
import {
    clearHumanReadingSessionCache,
    getCachedHumanBaseReport,
    getHumanBaseReportCached,
} from './services/natalReadingService';

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

function wait(ms: number): Promise<null> {
    return new Promise((resolve) => setTimeout(() => resolve(null), ms));
}

const NOTIFICATION_QUERY_VIEWS = new Set<ViewState>([
    'dashboard',
    'horoscope',
    'personal_daily',
    'synastry',
    'oracle',
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

function getRequestedViewFromQuery(): ViewState | null {
    if (typeof window === 'undefined') return null;
    const requested = new URLSearchParams(window.location.search).get('view');
    if (!requested) return null;
    if (LEGACY_NOTIFICATION_VIEW_ALIASES[requested]) return LEGACY_NOTIFICATION_VIEW_ALIASES[requested];
    return NOTIFICATION_QUERY_VIEWS.has(requested as ViewState) ? (requested as ViewState) : null;
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
    const [chartLoadState, setChartLoadState] = useState<ChartLoadState>('idle');
    const [preloadedHumanReport, setPreloadedHumanReport] = useState<NatalInterpretationReport | null>(null);
    const [activeChartId, setActiveChartId] = useState<number | undefined>(undefined);
    const [primaryChartId, setPrimaryChartId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [loadingMessage, setLoadingMessage] = useState<string | undefined>(undefined);
    const [startupError, setStartupError] = useState<string | null>(null);
    const [view, setView] = useState<ViewState>('onboarding');
    const [showPremiumPreview, setShowPremiumPreview] = useState(false);
    const [synastryPrefill, setSynastryPrefill] = useState<SynastryPrefill>(null);
    const [chartsReturnView, setChartsReturnView] = useState<ViewState>('settings');
    const [chartReturnView, setChartReturnView] = useState<ViewState>('dashboard');
    const [personalDailyInitialSection, setPersonalDailyInitialSection] = useState<PersonalDailySection>('overview');
    const [, setHoroscopeBackground] = useState<{
        sign: string | null;
        tone: 'sign' | 'chart' | 'love' | 'work';
    }>({ sign: null, tone: 'sign' });
    
    const lastSessionPingRef = useRef(0);
    const contentSyncGenRef = useRef(0);
    const contentSyncedKeyRef = useRef<string | null>(null);
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

        const cached = getHumanBaseReportCached(userId, targetChartId);
        if (cached) {
            setPreloadedHumanReport(cached);
            return cached;
        }
        const dbCached = await getCachedHumanBaseReport(userId, targetChartId).catch((error: any) => {
            console.warn('[App] Human base report cache read failed:', error?.message || error);
            return null;
        });
        if (dbCached) {
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

        setChartLoadState('loading');
        setPreloadedHumanReport(null);

        const promise = getOrCalculateChart(targetProfile)
            .then((chart) => {
                if (chart?.sun && chart?.moon && chart?.rising) {
                    primaryChartSessionRef.current = { key, data: chart, promise: null };
                    primaryChartDataRef.current = chart;
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
    }, []);

    useEffect(() => {
        installLumiaDebugGlobal();
        viewRef.current = view;
        lumiaDebugLog('navigation', {
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
            window.setTimeout(() => captureLumiaHomeLayout('view_dashboard'), 180);
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
        lumiaDebugLog('telegram_init', {
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
        view !== 'hook' &&
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
        const safetyTimer = window.setTimeout(() => {
            if (cancelled || safetyCleared) return;
            console.error('[App] Startup exceeded safety budget - unlocking loading UI');
            setStartupError('Lumia не успела загрузить профиль. Закрой мини-приложение и открой его снова из Telegram.');
            setLoadingProgress(100);
            setView('dashboard');
            setLoading(false);
        }, STARTUP_SAFETY_TIMEOUT_MS);

        const clearSafety = () => {
            if (safetyCleared) return;
            safetyCleared = true;
            window.clearTimeout(safetyTimer);
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
            setInitialTodaySection(notificationLaunchRef.current?.section || null);
            
            // Ждём Telegram Web App (может загружаться асинхронно)
            let tgId: string | number | undefined;
            for (let attempt = 0; attempt < 12; attempt++) {
                if (cancelled) return;
                const tg = (window as any).Telegram?.WebApp;
                tgId = tg?.initDataUnsafe?.user?.id;
                if (tgId) {
                    applyTelegramSafeAreaCssVars();
                    break;
                }
                await new Promise(r => setTimeout(r, 300));
            }

            if (!isValidUserId(tgId)) {
                console.log('[App] No Telegram user ID found after retries, showing safe startup error');
                clearSafety();
                setStartupError('Не удалось получить Telegram ID. Открой Lumia через Telegram Mini App и попробуй ещё раз.');
                setLoadingProgress(100);
                setView('dashboard');
                setLoading(false);
                return;
            }
            const safeTgId = tgId as string | number;

            try {
                // Шаг 1: Загружаем профиль из БД
                setStartupError(null);
                const tg = (window as any).Telegram?.WebApp;
                const tgUser = tg?.initDataUnsafe?.user as TelegramWebAppUser | undefined;

                setLoadingProgress(30);
                const storedProfile = await getProfile();

                console.log('[App] Profile loaded:', {
                    hasProfile: !!storedProfile,
                    isSetup: storedProfile?.isSetup,
                    tgId: safeTgId
                });

                // Создаём или нормализуем минимальный профиль без требования натальной карты.
                let updatedProfile: UserProfile;
                if (!storedProfile) {
                    setLoadingProgress(42);
                    const isAdmin = await resolveAuthoritativeAdminStatus(safeTgId, false);
                    updatedProfile = {
                        ...buildMinimalStartupProfile(safeTgId, tgUser),
                        isAdmin,
                    };
                    console.log('[App] Creating minimal startup profile without natal setup');
                    await saveProfile(updatedProfile);
                } else {
                    const isAdmin = await resolveAuthoritativeAdminStatus(safeTgId, storedProfile.isAdmin);
                    updatedProfile = normalizeStartupProfile(storedProfile, safeTgId, tgUser, isAdmin);
                    if (needsStartupProfileNormalizationSave(storedProfile)) {
                        void saveProfile(updatedProfile).catch((saveError: any) => {
                            console.warn('[App] Startup profile normalization save failed:', saveError?.message || saveError);
                        });
                    }
                }

                // Шаг 2: Профиль готов для входа в приложение.
                setProfile(updatedProfile);

                runReferralFromStartParam(String(safeTgId), (r) => {
                    if (r.ok) {
                        setProfile((p) => (p ? { ...p, referralApplied: true } : p));
                    } else if (r.status === 409) {
                        setProfile((p) => (p ? { ...p, referralApplied: true } : p));
                    }
                });

                // Шаг 3: Загружаем карту только для уже настроенного профиля.
                if (!updatedProfile.isSetup) {
                    console.log('[App] Profile is not setup; opening dashboard without chart/prewarm');
                    resetPrimaryChartState();
                    setLoadingProgress(100);
                    setLoadingMessage(undefined);
                    setView('dashboard');
                    return;
                }

                setLoadingMessage(
                    updatedProfile.language === 'en' ? 'Loading LUMIA' : 'Загружаем LUMIA'
                );
                setLoadingProgress(50);
                console.log('[App] Loading primary chart once...');

                const chart = await loadPrimaryChartOnce(updatedProfile);

                if (chart?.sun && chart?.moon) {
                    console.log('[App] Chart loaded successfully:', {
                        sunSign: chart.sun.sign,
                        moonSign: chart.moon.sign
                    });
                    setLoadingProgress(68);
                    const primaryChartId = await getPrimaryChartId(String(updatedProfile.id));
                    if (primaryChartId != null) {
                        setPrimaryChartId(primaryChartId);
                        setActiveChartId(primaryChartId);
                        if (process.env.NODE_ENV !== 'production') {
                            console.warn('[App] primaryChartId', primaryChartId);
                        }
                    }
                    const dateKey = getMoscowTodayKey();
                    try {
                        await prepareUserContentDbFirst({
                            userId: String(updatedProfile.id),
                            chartId: primaryChartId,
                            profile: updatedProfile,
                            chartData: chart,
                            isPremium: hasActivePremium(updatedProfile),
                            dateKey,
                            progressStart: 68,
                            progressSpan: 20,
                        });
                    } catch (prewarmError: any) {
                        console.warn('[App] Startup DB-first content flow failed:', prewarmError?.message || prewarmError);
                    }
                    setLoadingProgress(88);
                } else {
                    console.log('[App] Chart unavailable after startup load, going to dashboard');
                }

                setLoadingProgress(100);
                setLoadingMessage(undefined);
                setView(requestedViewRef.current || 'dashboard');
            } catch (error) {
                console.error('[App] Error loading user data:', error);
                setStartupError('Не удалось загрузить профиль Lumia. Проверь, что приложение открыто внутри Telegram, и попробуй ещё раз.');
                resetPrimaryChartState();
                setLoadingProgress(100);
                setView('dashboard');
            } finally {
                clearSafety();
                if (!cancelled) {
                    setTimeout(() => setLoading(false), 300);
                }
            }
        };
        
        void loadData();
        return () => {
            cancelled = true;
            clearSafety();
        };
    }, [loadPrimaryChartOnce, prepareUserContentDbFirst, resetPrimaryChartState, resolveAuthoritativeAdminStatus]);

    // Legacy profile.generatedContent sync — disabled on ordinary login (see appStartupFlags).
    useEffect(() => {
        if (!ENABLE_LEGACY_DASHBOARD_CONTENT_SYNC) return;
        if (!chartData || loading || view !== 'dashboard' || !profile?.id) {
            if (!chartData) contentSyncedKeyRef.current = null;
            return;
        }

        const syncKey = `${profile.id}:${chartData.sun?.sign ?? ''}-${chartData.moon?.sign ?? ''}`;
        const prewarmKey = `${profile.id}:${activeChartId ?? 'primary'}:${getMoscowTodayKey()}:${hasActivePremium(profile) ? 'premium' : 'free'}`;
        if (prewarmCompletedKeyRef.current === prewarmKey) return;
        if (contentSyncedKeyRef.current === syncKey) return;
        contentSyncedKeyRef.current = syncKey;

        const gen = ++contentSyncGenRef.current;
        const snapshot = profile;
        const chartSnapshot = chartData;

        void (async () => {
            try {
                const next = await updateContentIfNeeded(snapshot, chartSnapshot);
                if (gen !== contentSyncGenRef.current) return;
                setProfile((prev) => {
                    if (!prev || prev.id !== snapshot.id) return prev;
                    return { ...prev, generatedContent: next };
                });
            } catch (e: any) {
                console.warn('[App] Content sync failed:', e?.message || e);
                contentSyncedKeyRef.current = null;
            }
        })();
    }, [activeChartId, loading, view, profile, chartData]);

    const handleOnboardingComplete = async (newProfile: UserProfile) => {
        console.log('[App] === ONBOARDING COMPLETE ===', {
            name: newProfile.name,
            birthDate: newProfile.birthDate
        });

        const tg = (window as any).Telegram?.WebApp;
        const tgUser = tg?.initDataUnsafe?.user;
        const tgId = tgUser?.id;
        if (!isValidUserId(tgId)) {
            console.error('[App] Cannot complete onboarding without a valid Telegram user id');
            window.alert?.('Открой Lumia через Telegram, чтобы приложение смогло сохранить профиль и карту.');
            setView('onboarding');
            setLoading(false);
            return;
        }
        const safeTgId = tgId as string | number;
        const isAdmin = await resolveAuthoritativeAdminStatus(safeTgId, false);
        const retainedPremiumUntil = getProfilePremiumUntil(profile) ?? getProfilePremiumUntil(newProfile);
        const fullProfile = {
            ...newProfile,
            isSetup: true,
            id: String(safeTgId),
            isAdmin,
            isPremium: hasActivePremium({ ...newProfile, premiumUntil: retainedPremiumUntil, isAdmin }),
            premiumUntil: retainedPremiumUntil,
            trialStartedAt: profile?.trialStartedAt ?? newProfile.trialStartedAt,
            loginStreak: profile?.loginStreak ?? newProfile.loginStreak,
            chartSlots: profile?.chartSlots ?? newProfile.chartSlots,
            refCode: profile?.refCode ?? newProfile.refCode,
            referralApplied: profile?.referralApplied ?? newProfile.referralApplied,
            notificationFrequency: profile?.notificationFrequency ?? newProfile.notificationFrequency,
        };

        setProfile(fullProfile);
        setLoading(true);
        setLoadingProgress(10);

        try {
            // Шаг 1: Сохраняем профиль в БД (критично для persistence)
            setLoadingProgress(20);
            let profileSaved = false;
            for (let attempt = 1; attempt <= 2; attempt++) {
                try {
                    await saveProfile(fullProfile);
                    profileSaved = true;
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

            runReferralFromStartParam(String(safeTgId), (r) => {
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
            setChartLoadState('ready');
            setChartData(generatedChart);
            setLoadingMessage(
                fullProfile.language === 'en' ? 'Preparing your day' : 'Готовим твой день'
            );
            setLoadingProgress(72);
            const primaryChartId = await getPrimaryChartId(String(fullProfile.id));
            if (primaryChartId != null) {
                setPrimaryChartId(primaryChartId);
                setActiveChartId(primaryChartId);
            }
            const dateKey = getMoscowTodayKey();
            try {
                await prepareUserContentDbFirst({
                    userId: String(fullProfile.id),
                    chartId: primaryChartId,
                    profile: fullProfile,
                    chartData: generatedChart,
                    isPremium: hasActivePremium(fullProfile),
                    dateKey,
                    progressStart: 72,
                    progressSpan: 18,
                });
            } catch (prewarmError: any) {
                console.warn('[App] Onboarding DB-first content flow failed:', prewarmError?.message || prewarmError);
            }
            setLoadingProgress(90);
            setLoadingProgress(100);
            setLoadingMessage(undefined);
            const targetView = onboardingTargetViewRef.current || 'dashboard';
            if (targetView === 'chart') {
                setActiveChartId(undefined);
                setChartReturnView('dashboard');
            }
            setTimeout(() => {
                setView(targetView);
                onboardingTargetViewRef.current = 'dashboard';
            }, 300);
            
        } catch (error: any) {
            console.error('[App] Error during onboarding:', error);
            console.error('[App] Error message:', error?.message);
            console.error('[App] Error stack:', error?.stack);
            
            // Получаем оригинальное сообщение ошибки
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
        setProfile(updatedProfile);
    }, []);

    const handleAdminOwnProfilePatch = useCallback((
        patch: Partial<Pick<UserProfile, 'isPremium' | 'chartSlots' | 'loginStreak'>>
    ) => {
        setProfile((prev) => {
            if (!prev) return prev;
            return {
                ...prev,
                ...patch,
                isAdmin: prev.isAdmin,
            };
        });
    }, []);

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

    const requestPremium = async (source = 'app', eventPayload?: Record<string, any>) => {
       if (!profile) return;
       console.log('[App] Requesting premium for user:', profile.id);
       const success = await requestStarsPayment(profile);
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
               if (chartId != null) setActiveChartId(chartId);
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
        if (fromView === 'onboarding' || fromView === 'hook' || fromView === 'paywall') return;
        const stack = navigationHistoryRef.current;
        if (stack[stack.length - 1] !== fromView) {
            navigationHistoryRef.current = [...stack, fromView].slice(-12);
            lumiaDebugLog('navigation', {
                action: 'push_return',
                from: fromView,
                history: navigationHistoryRef.current,
            });
        }
    }, []);

    const openNatalSetupOnboarding = useCallback((returnView?: ViewState, targetView: ViewState = 'chart') => {
        const currentView = viewRef.current;
        const safeReturnView =
            returnView && returnView !== 'onboarding' && returnView !== 'hook' && returnView !== 'paywall'
                ? returnView
                : 'dashboard';

        lumiaDebugLog('navigation', {
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

        lumiaDebugLog('navigation', {
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

        lumiaDebugLog('navigation', {
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

    const openPersonalDailyView = useCallback((section: PersonalDailySection = 'overview') => {
        lumiaDebugLog('navigation', {
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
            };
            openPersonalDailyView(sectionByKey[options?.dailySectionKey ?? 'daily_work_business'] ?? 'work');
            return;
        }

        if (layer === 'chart') {
            openPersonalDailyView('overview');
            return;
        }

        lumiaDebugLog('navigation', {
            action: 'open_horoscope_layer',
            from: viewRef.current,
            to: 'horoscope',
            source: options?.source ?? null,
            historyBeforeSet: navigationHistoryRef.current,
        });
        navigateTo('horoscope');
    }, [navigateTo, openPersonalDailyView]);

    const refreshPrimaryChartState = useCallback(async () => {
        try {
            const freshChart = await getChartData();
            if (profile?.id) {
                const key = getPrimaryChartLoadKey(profile);
                primaryChartSessionRef.current = { key, data: freshChart, promise: null };
                primaryChartDataRef.current = freshChart;
                clearHumanReadingSessionCache(String(profile.id));
                setPreloadedHumanReport(null);
                void prefetchBaseReportForChart(profile);
            }
            setChartLoadState(freshChart?.sun && freshChart?.moon ? 'ready' : 'error');
            setChartData(freshChart);
            setActiveChartId(undefined);
        } catch (error) {
            console.error('[App] Failed to refresh primary chart state:', error);
            setChartLoadState('error');
        }
    }, [prefetchBaseReportForChart, profile]);

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

        lumiaDebugLog('navigation', {
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
        setInitialTodaySection(null);
        navigateTo('dashboard', { replace: true });
    }, [navigateTo]);

    const openBottomHoroscope = useCallback(() => {
        navigateTo('horoscope', { replace: true });
    }, [navigateTo]);

    const openBottomNatal = useCallback(() => {
        navigateTo('chart', { replace: true });
    }, [navigateTo]);

    const openBottomSynastry = useCallback(() => {
        if (!gateFeatureAccess('synastry_by_charts', 'synastry')) return;
        setSynastryPrefill(null);
        navigateTo('synastry', { replace: true });
    }, [gateFeatureAccess, navigateTo]);

    const openBottomAvatar = useCallback(() => {
        navigateTo('settings', { replace: true });
    }, [navigateTo]);

    // Свайп назад от левого края (как в iOS)
    const canSwipeBack =
        view !== 'dashboard' &&
        view !== 'onboarding' &&
        view !== 'hook' &&
        view !== 'paywall' &&
        view !== 'horoscope';
    useSwipeBack({
        onSwipeBack: handleBack,
        enabled: canSwipeBack,
        threshold: 80,
        edgeWidth: 25,
    });

    if (loading) {
        return (
            <Loading
                message={loadingMessage || getText(profile?.language || 'ru', 'loading')}
                progress={loadingProgress}
            />
        );
    }

    if (!profile && startupError) {
        return (
            <div className="fixed inset-0 flex h-[100dvh] items-center justify-center bg-white px-6 text-[#1f1f1f]">
                <div className="max-w-sm text-center">
                    <p className="lumia-brand-wordmark mb-6">LUMIA</p>
                    <h1 className="mb-3 font-serif text-[2rem] leading-none">Не удалось открыть профиль</h1>
                    <p className="mb-0 text-[15px] leading-relaxed text-[#4f4b45]">{startupError}</p>
                </div>
            </div>
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

    const dailyScreenProps = {
        profile,
        chartData,
        chartId: primaryChartId,
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
                        onOpenHoroscopeLayer={openHoroscopeLayer}
                        onOpenPersonalDaily={openPersonalDailyView}
                        onCreateNatalChart={openBottomNatal}
                        onOpenSettings={openBottomAvatar}
                        scrollRef={dashboardScrollRef}
                        initialTodaySection={initialTodaySection}
                    />
                </div>
                {view === 'admin' ? (
                    <AdminPanel
                        profile={profile}
                        onPatchOwnProfile={handleAdminOwnProfilePatch}
                        onClose={() => {
                            void handleBack();
                        }}
                    />
                ) : view === 'hook' && chartData ? (
                    <HookChat 
                        profile={profile} 
                        chartData={chartData} 
                        onComplete={() => setView('dashboard')}
                    />
                ) : view === 'paywall' ? (
                    <Paywall 
                        profile={profile} 
                        onPurchase={requestPremium} 
                        onClose={() => setView('dashboard')}
                    />
                ) : view === 'oracle' ? (
                    <div className="lumia-main-scroll scrollbar-hide" ref={appScrollRef}>
                        {renderAppScrollHeader()}
                        <OracleChat
                            profile={profile}
                            onPremiumRequired={() => setView('paywall')}
                            onUpdateProfile={handleProfileUpdate}
                        />
                    </div>
                ) : view === 'synastry' ? (
                    <div className="lumia-main-scroll lumia-bottom-tab-scroll scrollbar-hide" ref={appScrollRef}>
                        {renderAppScrollHeader()}
                        <Synastry
                            profile={profile}
                            chartData={chartData}
                            requestPremium={requestPremium}
                            initialPrefill={synastryPrefill}
                            onOpenCharts={() => openCharts('synastry')}
                            onUpdateProfile={handleProfileUpdate}
                        />
                    </div>
                ) : view === 'horoscope' ? (
                    <div className="lumia-main-scroll lumia-bottom-tab-scroll scrollbar-hide" ref={appScrollRef}>
                        <Horoscope 
                            profile={profile} 
                            chartData={chartData} 
                            chartId={primaryChartId ?? undefined}
                            onUpdateProfile={handleProfileUpdate}
                            onOpenChart={() => {
                                navigateTo('chart');
                            }}
                            onRequestPremium={requestPremium}
                            onOpenPersonalDaily={() => openPersonalDailyView('overview')}
                            onBack={handleBack}
                            onBackgroundChange={(next) =>
                                setHoroscopeBackground(next || { sign: null, tone: 'sign' })
                            }
                        />
                    </div>
                ) : view === 'personal_daily' ? (
                    <div className="lumia-main-scroll scrollbar-hide" ref={appScrollRef}>
                        <PersonalDailyScreen {...dailyScreenProps} />
                    </div>
                ) : view === 'chart' ? (
                    <div className="lumia-main-scroll lumia-bottom-tab-scroll scrollbar-hide" ref={appScrollRef}>
                        {renderAppScrollHeader()}
                        <NatalChart 
                            data={chartData} 
                            profile={profile} 
                            chartId={activeChartId}
                            requestPremium={requestPremium}
                            onUpdateProfile={handleProfileUpdate}
                            preloadedReport={activeChartId ? null : preloadedHumanReport}
                            onCreateChart={() => openNatalSetupOnboarding('chart', 'chart')}
                            onOpenPersonalDaily={() => openPersonalDailyView('overview')}
                        />
                    </div>
                ) : view === 'settings' ? (
                    <div className="lumia-main-scroll lumia-bottom-tab-scroll scrollbar-hide" ref={appScrollRef}>
                        {renderAppScrollHeader()}
                        <Settings 
                            profile={profile} 
                            onUpdate={handleProfileUpdate} 
                            onShowPremiumPreview={() => setShowPremiumPreview(true)}
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
                                lumiaDebugLog('navigation', {
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

            {profile ? (
                <LumiaBottomTabBar
                    profile={profile}
                    view={view}
                    onOpenToday={openBottomToday}
                    onOpenHoroscope={openBottomHoroscope}
                    onOpenNatal={openBottomNatal}
                    onOpenSynastry={openBottomSynastry}
                    onOpenAvatar={openBottomAvatar}
                />
            ) : null}

            {showPremiumPreview && (
                <PremiumPreview language={profile?.language || 'ru'} onClose={() => setShowPremiumPreview(false)} onPurchase={requestPremium} />
            )}
            <LumiaDebugOverlay />
        </div>
    );
};

export default App;
