
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { UserProfile, NatalChartData, ViewState, HoroscopeLayer, NatalInterpretationReport } from './types';
import {
    getProfile,
    saveProfile,
    getLumiBalance,
    processDailyLogin,
    getChartData,
    runReferralFromStartParam,
    completeDailyLumiTask,
} from './services/storageService';
import { getOrCalculateChart } from './services/chartService';
import { generateAllContent, updateContentIfNeeded } from './services/contentGenerationService';
import { Onboarding } from './views/Onboarding';
import { Dashboard } from './views/Dashboard';
import { NatalChart } from './views/NatalChart';
import { Horoscope } from './views/Horoscope';
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
import { Wallet } from './views/Wallet';
import { getAdminStatus } from './services/adminService';
import { recordNotificationAttribution, recordUserAppEvent, recordUserSession } from './services/sessionService';
import { installTelegramFullscreenGuard } from './lib/telegramFullscreen';
import { applyTelegramSafeAreaCssVars, subscribeTelegramContentSafeAreaChanges } from './lib/telegramSafeAreaInsets';
import { useSwipeBack } from './lib/useSwipeBack';
import { getMoscowTodayKey } from './lib/date-utils';
import { isValidUserId } from './lib/userId';
import { LumiaDebugOverlay } from './components/lumia-ui/LumiaDebugOverlay';
import { LumiaBottomTabBar } from './components/lumia-ui/LumiaBottomTabBar';
import { captureLumiaHomeLayout, installLumiaDebugGlobal, lumiaDebugLog } from './lib/lumiaDebug';
import {
    clearHumanReadingSessionCache,
    getHumanBaseReportCached,
    prefetchHumanBaseReport,
} from './services/natalReadingService';

// Get owner ID from environment variables for security
const OWNER_ID = process.env.NEXT_PUBLIC_OWNER_ID || '';

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

function getPrimaryChartLoadKey(profile: UserProfile): string {
    return [
        profile.id || '',
        profile.birthDate || '',
        profile.birthTime || '',
        profile.birthPlace || '',
    ].join('|');
}

function wait(ms: number): Promise<null> {
    return new Promise((resolve) => setTimeout(() => resolve(null), ms));
}

const NOTIFICATION_QUERY_VIEWS = new Set<ViewState>([
    'dashboard',
    'horoscope',
    'wallet',
    'synastry',
    'oracle',
    'settings',
    'charts',
]);

function getRequestedViewFromQuery(): ViewState | null {
    if (typeof window === 'undefined') return null;
    const requested = new URLSearchParams(window.location.search).get('view');
    if (!requested) return null;
    return NOTIFICATION_QUERY_VIEWS.has(requested as ViewState) ? (requested as ViewState) : null;
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
    const [loading, setLoading] = useState(true);
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [view, setView] = useState<ViewState>('onboarding');
    const [showPremiumPreview, setShowPremiumPreview] = useState(false);
    const [synastryPrefill, setSynastryPrefill] = useState<SynastryPrefill>(null);
    const [chartsReturnView, setChartsReturnView] = useState<ViewState>('settings');
    const [walletReturnView, setWalletReturnView] = useState<ViewState>('dashboard');
    const [chartReturnView, setChartReturnView] = useState<ViewState>('dashboard');
    const [horoscopeInitialLayer, setHoroscopeInitialLayer] = useState<HoroscopeLayer>('sign');
    const [, setHoroscopeBackground] = useState<{
        sign: string | null;
        tone: 'sign' | 'chart' | 'love' | 'work';
    }>({ sign: null, tone: 'sign' });
    
    // Ref для однократного вызова daily login за сессию
    const dailyLoginProcessedRef = useRef(false);
    const lastSessionPingRef = useRef(0);
    const contentSyncGenRef = useRef(0);
    const contentSyncedKeyRef = useRef<string | null>(null);
    const primaryChartSessionRef = useRef<{
        key: string;
        data: NatalChartData | null;
        promise: Promise<NatalChartData | null> | null;
    }>({ key: '', data: null, promise: null });
    const primaryChartDataRef = useRef<NatalChartData | null>(null);
    const requestedViewRef = useRef<ViewState | null>(null);
    const notificationLaunchRef = useRef<NotificationLaunchParams | null>(null);
    const notificationAttributionSentRef = useRef(false);
    const dailyTaskSyncedRef = useRef<Record<string, string>>({});
    const dashboardScrollRef = useRef<HTMLDivElement | null>(null);
    const appScrollRef = useRef<HTMLDivElement | null>(null);
    const [initialTodaySection, setInitialTodaySection] = useState<string | null>(null);
    const viewRef = useRef<ViewState>('onboarding');
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
        timeoutMs = 9000
    ) => {
        const userId = targetProfile.id ? String(targetProfile.id) : '';
        if (!userId) return null;

        const cached = getHumanBaseReportCached(userId, targetChartId);
        if (cached) {
            setPreloadedHumanReport(cached);
            return cached;
        }

        const request = prefetchHumanBaseReport(userId, targetChartId)
            .then((report) => {
                setPreloadedHumanReport(report);
                return report;
            })
            .catch((error: any) => {
                console.warn('[App] Human base prefetch failed:', error?.message || error);
                return null;
            });

        return Promise.race([request, wait(timeoutMs)]);
    }, []);

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
                    isPremium: !!profile.isPremium,
                    language: profile.language || 'ru',
                    isSetup: !!profile.isSetup,
                }
                : { hasProfile: false },
        });
        if (view === 'dashboard') {
            window.setTimeout(() => captureLumiaHomeLayout('view_dashboard'), 180);
        }
    }, [profile?.isPremium, profile?.isSetup, profile?.language, view]);

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
            console.error('[App] Startup exceeded 40s — unlocking loading UI');
            setLoadingProgress(100);
            setLoading(false);
        }, 40_000);

        const clearSafety = () => {
            if (safetyCleared) return;
            safetyCleared = true;
            window.clearTimeout(safetyTimer);
        };

        const loadData = async () => {
            console.log('[App] === LOADING USER DATA ===');
            setLoadingProgress(10);
            requestedViewRef.current = getRequestedViewFromQuery();
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
                console.log('[App] No Telegram user ID found after retries, showing onboarding');
                clearSafety();
                setLoadingProgress(100);
                setView('onboarding');
                setLoading(false);
                return;
            }

            try {
                // Шаг 1: Загружаем профиль из БД
                setLoadingProgress(30);
                const storedProfile = await getProfile();

                console.log('[App] Profile loaded:', {
                    hasProfile: !!storedProfile,
                    isSetup: storedProfile?.isSetup,
                    tgId
                });

                // Если профиля нет или он не настроен - показываем onboarding
                if (!storedProfile || !storedProfile.isSetup) {
                    console.log('[App] No profile or not setup, showing onboarding');
                    clearSafety();
                    setLoadingProgress(100);
                    setView('onboarding');
                    setLoading(false);
                    return;
                }

                // Шаг 2: Нормализуем профиль
                if (!storedProfile.language) storedProfile.language = 'ru';
                if (!storedProfile.theme) storedProfile.theme = 'dark';
                
                const isAdmin = await resolveAuthoritativeAdminStatus(tgId, storedProfile.isAdmin);
                const updatedProfile = { ...storedProfile, id: String(tgId), isAdmin };
                setProfile(updatedProfile);

                runReferralFromStartParam(String(tgId), (r) => {
                    if (r.ok && typeof r.newBalance === 'number') {
                        setProfile((p) =>
                            p ? { ...p, lumiBalance: r.newBalance, referralApplied: true } : p
                        );
                    } else if (r.status === 409) {
                        setProfile((p) => (p ? { ...p, referralApplied: true } : p));
                    }
                });

                // Шаг 3: Загружаем карту один раз на входе в приложение.
                setLoadingProgress(50);
                console.log('[App] Loading primary chart once...');

                const chart = await loadPrimaryChartOnce(updatedProfile);

                if (chart?.sun && chart?.moon) {
                    console.log('[App] Chart loaded successfully:', {
                        sunSign: chart.sun.sign,
                        moonSign: chart.moon.sign
                    });
                    setLoadingProgress(78);
                    await prefetchBaseReportForChart(updatedProfile);
                } else {
                    console.log('[App] Chart unavailable after startup load, going to dashboard');
                }

                setLoadingProgress(100);
                setView(requestedViewRef.current || 'dashboard');
            } catch (error) {
                console.error('[App] Error loading user data:', error);
                setLoadingProgress(100);
                setView('onboarding');
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
    }, [loadPrimaryChartOnce, prefetchBaseReportForChart, resolveAuthoritativeAdminStatus]);

    // Гороскоп / интро / deep dive: добираем в фоне, если в БД пусто или обрыв после онбординга (бесплатно и премиум).
    useEffect(() => {
        if (!chartData || loading || view !== 'dashboard' || !profile?.id) {
            if (!chartData) contentSyncedKeyRef.current = null;
            return;
        }

        const syncKey = `${profile.id}:${chartData.sun?.sign ?? ''}-${chartData.moon?.sign ?? ''}`;
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
    }, [loading, view, profile, chartData]);

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
        const isAdmin = await resolveAuthoritativeAdminStatus(tgId, false);
        const fullProfile = { ...newProfile, id: String(tgId), isAdmin };

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

            runReferralFromStartParam(String(tgId), (r) => {
                if (r.ok && typeof r.newBalance === 'number') {
                    setProfile((p) =>
                        p ? { ...p, lumiBalance: r.newBalance, referralApplied: true } : p
                    );
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
            setLoadingProgress(78);
            await prefetchBaseReportForChart(fullProfile);
            setLoadingProgress(100);

            // Сразу уходим с лоадера: generateAllContent — несколько AI-вызовов и может «висеть» минутами.
            setTimeout(() => setView('dashboard'), 300);

            void (async () => {
                try {
                    console.log('[App] Generating initial content (background, non-blocking)...');
                    const allContent = await generateAllContent(fullProfile, generatedChart);
                    setProfile((prev) => {
                        if (!prev) return prev;
                        const next = { ...prev, generatedContent: allContent };
                        if (profileSaved && next.isSetup) {
                            void saveProfile(next).catch((e) =>
                                console.warn('[App] Failed to save generated content (non-critical):', e)
                            );
                        }
                        return next;
                    });
                } catch (contentError) {
                    console.error('[App] Background content generation failed (non-critical):', contentError);
                }
            })();
            
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
        patch: Partial<Pick<UserProfile, 'isPremium' | 'lumiBalance' | 'chartSlots' | 'loginStreak'>>
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

    const refreshLumiOnDashboard = useCallback(async () => {
        if (!profile?.id) return;
        try {
            const balance = await getLumiBalance(profile.id);
            setProfile(prev => prev ? { ...prev, lumiBalance: balance } : prev);
        } catch (error: any) {
            console.warn('[App] Failed to refresh Lumi balance on dashboard:', error?.message || error);
        }
    }, [profile?.id]);

    useEffect(() => {
        if (view === 'dashboard' && profile?.id) {
            refreshLumiOnDashboard();
        }
    }, [view, profile?.id, refreshLumiOnDashboard]);

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

    // Daily login bonus: process once per session when user reaches dashboard
    useEffect(() => {
        if (view !== 'dashboard' || !profile?.id || dailyLoginProcessedRef.current) return;
        dailyLoginProcessedRef.current = true;
        processDailyLogin(profile.id)
            .then((result) => {
                setProfile((prev) =>
                    prev
                        ? {
                              ...prev,
                              lumiBalance: result.newBalance,
                              loginStreak: result.streak,
                          }
                        : prev
                );
            })
            .catch((err) => {
                console.warn('[App] Daily login failed (non-critical):', err?.message);
                dailyLoginProcessedRef.current = false; // Allow retry on next dashboard visit
            });
    }, [view, profile?.id]);

    const syncDailyTask = useCallback(
        async (taskKey: 'open_horoscope' | 'open_chart') => {
            if (!profile?.id) return;

            const todayKey = getMoscowTodayKey();
            const cacheKey = `${profile.id}:${taskKey}`;
            if (dailyTaskSyncedRef.current[cacheKey] === todayKey) {
                return;
            }

            try {
                const result = await completeDailyLumiTask(profile.id, taskKey);
                dailyTaskSyncedRef.current[cacheKey] = result.date || todayKey;
                setProfile((prev) =>
                    prev
                        ? {
                              ...prev,
                              lumiBalance: result.lumiBalance,
                          }
                        : prev
                );
            } catch (error: any) {
                console.warn('[App] Daily Lumi task failed (non-critical):', error?.message || error);
            }
        },
        [profile?.id]
    );

    useEffect(() => {
        if (!profile?.id || !chartData) return;

        if (view === 'horoscope') {
            void syncDailyTask('open_horoscope');
        } else if (view === 'chart') {
            void syncDailyTask('open_chart');
        }
    }, [chartData, profile?.id, syncDailyTask, view]);

    const requestPremium = async (source = 'app', eventPayload?: Record<string, any>) => {
       if (!profile) return;
       console.log('[App] Requesting premium for user:', profile.id);
       const success = await requestStarsPayment(profile);
       if (success) {
           console.log('[App] Premium payment successful, refreshing profile...');
           void recordUserAppEvent({
               eventType: 'natal_upgrade_success',
               section: source === 'natal_story_unlock' ? 'natal_story' : 'premium',
               source,
               eventPayload: {
                   entry_point: source,
                   ...(eventPayload || {}),
               },
           });
           try {
               for (let i = 0; i <= 2; i++) {
                   if (i > 0) await new Promise((r) => setTimeout(r, 1200));
                   const fresh = await getProfile();
                   if (fresh) {
                       const isAdmin = await resolveAuthoritativeAdminStatus(profile.id, fresh.isAdmin);
                       setProfile({ ...fresh, id: profile.id, isAdmin });
                       if (fresh.isPremium) break;
                   }
               }
           } catch (error) {
               console.error('[App] Failed to refresh profile:', error);
               setProfile((prev) => prev ? { ...prev, isPremium: true } : prev);
           }
           setShowPremiumPreview(false);
           setView('dashboard');
       } else {
           console.log('[App] Premium payment cancelled or failed');
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
    }, [profile, pushReturnView]);

    const openHoroscopeLayer = useCallback((layer: HoroscopeLayer) => {
        lumiaDebugLog('navigation', {
            action: 'open_horoscope_layer',
            from: viewRef.current,
            to: 'horoscope',
            layer,
            historyBeforeSet: navigationHistoryRef.current,
        });
        setHoroscopeInitialLayer(layer);
        navigateTo('horoscope');
    }, [navigateTo]);

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
                  : currentView === 'wallet'
                    ? walletReturnView
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
            walletReturnView,
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
    }, [activeChartId, chartReturnView, chartsReturnView, walletReturnView]);

    const openCharts = useCallback((returnView: ViewState) => {
        setChartsReturnView(returnView);
        navigateTo('charts');
    }, [navigateTo]);

    const openSynastryWithPrefill = useCallback((prefill: SynastryPrefill) => {
        setSynastryPrefill(prefill);
        navigateTo('synastry');
    }, [navigateTo]);

    const openWallet = useCallback((returnView: ViewState) => {
        setWalletReturnView(returnView);
        navigateTo('wallet');
    }, [navigateTo]);

    const openBottomToday = useCallback(() => {
        setInitialTodaySection(null);
        navigateTo('dashboard', { replace: true });
    }, [navigateTo]);

    const openBottomNatal = useCallback(() => {
        navigateTo('chart', { replace: true });
    }, [navigateTo]);

    const openBottomSynastry = useCallback(() => {
        setSynastryPrefill(null);
        navigateTo('synastry', { replace: true });
    }, [navigateTo]);

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
        return <Loading message={getText(profile?.language || 'ru', 'loading')} progress={loadingProgress} />;
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

    return (
        <div
            className={`lumia-app-shell relative isolate flex w-full min-h-0 flex-col overflow-hidden font-sans selection:bg-astro-highlight selection:text-white ${
                lumiaAirShell ? 'text-text-main' : 'text-astro-text'
            }`}
        >
            <main
                className="lumia-tg-main-gutter relative z-10 flex-1 w-full max-w-md md:max-w-reading-wide mx-auto overflow-hidden min-h-0 bg-white"
            >
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
                            onOpenWallet={() => openWallet('oracle')}
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
                    <div className="lumia-main-scroll scrollbar-hide" ref={appScrollRef}>
                        <Horoscope 
                            profile={profile} 
                            chartData={chartData} 
                            chartId={activeChartId}
                            initialLayer={horoscopeInitialLayer}
                            onUpdateProfile={handleProfileUpdate}
                            onOpenChart={() => {
                                navigateTo('chart');
                            }}
                            onRequestPremium={requestPremium}
                            onOpenWallet={() => openWallet('horoscope')}
                            onBack={handleBack}
                            onBackgroundChange={(next) =>
                                setHoroscopeBackground(next || { sign: null, tone: 'sign' })
                            }
                        />
                    </div>
                ) : view === 'chart' ? (
                    <div className="lumia-main-scroll lumia-bottom-tab-scroll scrollbar-hide" ref={appScrollRef}>
                        {renderAppScrollHeader()}
                        <NatalChart 
                            data={chartData} 
                            profile={profile} 
                            chartId={activeChartId}
                            requestPremium={requestPremium}
                            onOpenWallet={() => openWallet('chart')}
                            onUpdateProfile={handleProfileUpdate}
                            preloadedReport={activeChartId ? null : preloadedHumanReport}
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
                            onOpenWallet={() => openWallet('settings')}
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
                            onOpenWallet={() => openWallet('charts')}
                            onPrimaryChartUpdated={refreshPrimaryChartState}
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
                ) : view === 'wallet' ? (
                    <div className="lumia-main-scroll scrollbar-hide" ref={appScrollRef}>
                        {renderAppScrollHeader()}
                        <Wallet
                            profile={profile}
                            onUpdateProfile={handleProfileUpdate}
                        />
                    </div>
                ) : (
                    // Default to Dashboard
                    <div className="flex h-full min-h-0 overflow-hidden">
                        <Dashboard 
                            profile={profile} 
                            chartData={chartData}
                            chartId={activeChartId ?? null}
                            onOpenHoroscopeLayer={openHoroscopeLayer}
                            onOpenSettings={openBottomAvatar}
                            scrollRef={dashboardScrollRef}
                            initialTodaySection={initialTodaySection}
                        />
                    </div>
                )}
            </main>

            {profile ? (
                <LumiaBottomTabBar
                    profile={profile}
                    view={view}
                    onOpenToday={openBottomToday}
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
