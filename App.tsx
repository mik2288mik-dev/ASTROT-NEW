
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { UserProfile, NatalChartData, ViewState } from './types';
import {
    getProfile,
    saveProfile,
    getLumiBalance,
    processDailyLogin,
    getChartData,
    runReferralFromStartParam,
} from './services/storageService';
import { getOrCalculateChart } from './services/chartService';
import { generateAllContent } from './services/contentGenerationService';
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
import { recordUserSession } from './services/sessionService';
import { useSwipeBack } from './lib/useSwipeBack';
import { BackgroundLayers } from './components/BackgroundLayers';
import { installTelegramFullscreenGuard } from './lib/telegramFullscreen';

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

const App: React.FC = () => {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [chartData, setChartData] = useState<NatalChartData | null>(null);
    const [activeChartId, setActiveChartId] = useState<number | undefined>(undefined);
    const [loading, setLoading] = useState(true);
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [view, setView] = useState<ViewState>('onboarding');
    const [showPremiumPreview, setShowPremiumPreview] = useState(false);
    const [synastryPrefill, setSynastryPrefill] = useState<SynastryPrefill>(null);
    const [chartsReturnView, setChartsReturnView] = useState<ViewState>('settings');
    const [walletReturnView, setWalletReturnView] = useState<ViewState>('dashboard');
    const [chartReturnView, setChartReturnView] = useState<ViewState>('dashboard');
    
    // Ref для предотвращения двойной загрузки
    const dataLoadedRef = useRef(false);
    // Ref для однократного вызова daily login за сессию
    const dailyLoginProcessedRef = useRef(false);
    const lastSessionPingRef = useRef(0);

    const getFallbackAdminStatus = useCallback((userId?: string | number, storedIsAdmin?: boolean) => {
        return OWNER_ID && userId ? String(userId) === String(OWNER_ID) : !!storedIsAdmin;
    }, []);

    const resolveAuthoritativeAdminStatus = useCallback(async (userId?: string | number, storedIsAdmin?: boolean) => {
        const fallbackIsAdmin = getFallbackAdminStatus(userId, storedIsAdmin);

        try {
            const result = await getAdminStatus();
            return result.isAdmin;
        } catch (error: any) {
            console.warn('[App] Failed to fetch authoritative admin status:', error?.message || error);
            return fallbackIsAdmin;
        }
    }, [getFallbackAdminStatus]);

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
        tg?.enableClosingConfirmation?.();

        const cleanupFullscreenGuard = installTelegramFullscreenGuard();
        return cleanupFullscreenGuard;
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
            if (lumiaAirShell) {
                tg.setHeaderColor('#FFFFFF');
                tg.setBackgroundColor('#FFFFFF');
            } else {
                const headerColor = theme === 'light' ? '#F5F2EB' : '#050505';
                tg.setHeaderColor(headerColor);
                tg.setBackgroundColor(headerColor);
            }
        }

        return () => {
            body.classList.remove('theme-lumia-air');
        };
    }, [profile?.theme, lumiaAirShell]);

    useEffect(() => {
        // Защита от двойной загрузки
        if (dataLoadedRef.current) return;
        dataLoadedRef.current = true;
        
        const loadData = async () => {
            console.log('[App] === LOADING USER DATA ===');
            setLoadingProgress(10);
            
            // Ждём Telegram Web App (может загружаться асинхронно)
            let tgId: string | number | undefined;
            for (let attempt = 0; attempt < 5; attempt++) {
                const tg = (window as any).Telegram?.WebApp;
                tgId = tg?.initDataUnsafe?.user?.id;
                if (tgId) break;
                await new Promise(r => setTimeout(r, 300));
            }

            if (!tgId) {
                console.log('[App] No Telegram user ID found after retries, showing onboarding');
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

                // Шаг 3: Загружаем карту через chartService
                // Он сам проверит БД и рассчитает только если нужно
                setLoadingProgress(50);
                console.log('[App] Loading chart via chartService...');
                
                try {
                    const chart = await getOrCalculateChart(updatedProfile);
                    
                    if (chart && chart.sun && chart.moon) {
                        console.log('[App] Chart loaded successfully:', {
                            sunSign: chart.sun.sign,
                            moonSign: chart.moon.sign
                        });
                        setChartData(chart);
                        setLoadingProgress(100);
                        setView('dashboard');
                    } else {
                        console.log('[App] Invalid chart data, going to dashboard');
                        setLoadingProgress(100);
                        setChartData(null);
                        setView('dashboard');
                    }
                } catch (chartError) {
                    console.error('[App] Error loading chart:', chartError);
                    setLoadingProgress(100);
                    // Профиль есть — не возвращаем в онбординг. Пробуем ещё раз через 2 сек.
                    setChartData(null);
                    setView('dashboard');
                    setTimeout(async () => {
                        try {
                            const retryChart = await getOrCalculateChart(updatedProfile);
                            if (retryChart?.sun && retryChart?.moon) {
                                setChartData(retryChart);
                            }
                        } catch {}
                    }, 2000);
                }
            } catch (error) {
                console.error('[App] Error loading user data:', error);
                setLoadingProgress(100);
                setView('onboarding');
            } finally {
                setTimeout(() => setLoading(false), 300);
            }
        };
        
        loadData();
    }, [resolveAuthoritativeAdminStatus]);

    const handleOnboardingComplete = async (newProfile: UserProfile) => {
        console.log('[App] === ONBOARDING COMPLETE ===', {
            name: newProfile.name,
            birthDate: newProfile.birthDate
        });

        const tg = (window as any).Telegram?.WebApp;
        const tgUser = tg?.initDataUnsafe?.user;
        const tgId = tgUser?.id;
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
            
            setChartData(generatedChart);
            setLoadingProgress(70);

            // Шаг 3: Генерируем контент для первого входа (не критично)
            console.log('[App] Generating initial content...');
            setLoadingProgress(80);
            
            try {
                const allContent = await generateAllContent(fullProfile, generatedChart);
                fullProfile.generatedContent = allContent;
                
                // Обновляем профиль только если получилось сохранить ранее
                if (profileSaved && fullProfile.isSetup) {
                    try {
                        await saveProfile(fullProfile);
                    } catch (e) {
                        console.warn('[App] Failed to save content (non-critical):', e);
                    }
                }
                setProfile(fullProfile);
            } catch (contentError) {
                console.error('[App] Content generation failed (non-critical):', contentError);
            }
            
            setLoadingProgress(100);
            
            // Переходим сразу в dashboard — чистый первый экран продукта
            setTimeout(() => setView('dashboard'), 300);
            
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

    const requestPremium = async () => {
       if (!profile) return;
       console.log('[App] Requesting premium for user:', profile.id);
       const success = await requestStarsPayment(profile);
       if (success) {
           console.log('[App] Premium payment successful, refreshing profile...');
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

    // Navigation Logic
    const navigateTo = (newView: ViewState) => {
        if (!profile) return;
        
        if (newView === 'chart') {
            setActiveChartId(undefined);
            setChartReturnView('dashboard');
        }
        setView(newView);
    };

    const refreshPrimaryChartState = useCallback(async () => {
        try {
            const freshChart = await getChartData();
            setChartData(freshChart);
            setActiveChartId(undefined);
        } catch (error) {
            console.error('[App] Failed to refresh primary chart state:', error);
        }
    }, []);

    const handleBack = useCallback(async () => {
        // Keep screen-specific return paths explicit for management flows.
        if (view === 'admin') {
            setView('settings');
            return;
        }
        if (view === 'charts') {
            setView(chartsReturnView);
            return;
        }
        if (view === 'wallet') {
            setView(walletReturnView);
            return;
        }
        if (view === 'chart') {
            const returnView = activeChartId ? chartReturnView : 'dashboard';

            if (activeChartId) {
                await refreshPrimaryChartState();
            } else {
                setActiveChartId(undefined);
            }

            setChartReturnView('dashboard');
            setView(returnView);
            return;
        }
        // Otherwise return to Hub
        setView('dashboard');
    }, [activeChartId, chartReturnView, chartsReturnView, refreshPrimaryChartState, view, walletReturnView]);

    const openCharts = useCallback((returnView: ViewState) => {
        setChartsReturnView(returnView);
        setView('charts');
    }, []);

    const openSynastryWithPrefill = useCallback((prefill: SynastryPrefill) => {
        setSynastryPrefill(prefill);
        setView('synastry');
    }, []);

    const openWallet = useCallback((returnView: ViewState) => {
        setWalletReturnView(returnView);
        setView('wallet');
    }, []);

    // Свайп назад от левого края (как в iOS)
    const canSwipeBack = view !== 'dashboard' && view !== 'onboarding' && view !== 'hook' && view !== 'paywall';
    useSwipeBack({
        onSwipeBack: handleBack,
        enabled: canSwipeBack,
        threshold: 80,
        edgeWidth: 25
    });

    if (loading) {
        return <Loading message={getText(profile?.language || 'ru', 'loading')} progress={loadingProgress} />;
    }

    if (!profile || view === 'onboarding') {
        return (
            <div 
                className="relative isolate fixed inset-0 overflow-y-auto bg-transparent"
                style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)', paddingLeft: 'env(safe-area-inset-left, 0px)', paddingRight: 'env(safe-area-inset-right, 0px)' }}
            >
                <BackgroundLayers theme="dark" view="onboarding" />
                <Onboarding onComplete={handleOnboardingComplete} />
            </div>
        );
    }

    return (
        <div
            className={`relative isolate flex h-full w-full min-h-0 flex-col overflow-hidden font-sans selection:bg-astro-highlight selection:text-white ${
                lumiaAirShell ? 'text-text-main' : 'text-astro-text'
            }`}
        >
            <BackgroundLayers theme={profile.theme} view={view} lumiaAir={lumiaAirShell} />
            
            {/* Header handles Title, Settings button, and Back button */}
            <Header 
                profile={profile} 
                view={view} 
                onOpenSettings={() => setView('settings')}
                onBack={handleBack}
                onOpenWallet={() => openWallet(view)}
            />
            
            <main 
                className="flex-1 relative w-full max-w-md md:max-w-reading-wide mx-auto overflow-hidden min-h-0"
                style={{ paddingLeft: 'env(safe-area-inset-left, 0px)', paddingRight: 'env(safe-area-inset-right, 0px)' }}
            >
                {view === 'admin' ? (
                    <AdminPanel
                        profile={profile}
                        onPatchOwnProfile={handleAdminOwnProfilePatch}
                        onClose={() => setView('settings')}
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
                    <OracleChat
                        profile={profile}
                        onPremiumRequired={() => setView('paywall')}
                        onOpenWallet={() => openWallet('oracle')}
                        onUpdateProfile={handleProfileUpdate}
                    />
                ) : view === 'synastry' ? (
                    <Synastry
                        profile={profile}
                        chartData={chartData}
                        requestPremium={requestPremium}
                        initialPrefill={synastryPrefill}
                        onOpenCharts={() => openCharts('synastry')}
                        onUpdateProfile={handleProfileUpdate}
                    />
                ) : view === 'horoscope' ? (
                    <div className="h-full overflow-y-auto scrollbar-hide">
                        <Horoscope 
                            profile={profile} 
                            chartData={chartData} 
                            onUpdateProfile={handleProfileUpdate}
                            onOpenChart={() => setView('chart')}
                            onRequestPremium={() => setShowPremiumPreview(true)}
                        />
                    </div>
                ) : view === 'chart' ? (
                    <div className="h-full overflow-y-auto scrollbar-hide">
                        <NatalChart 
                            data={chartData} 
                            profile={profile} 
                            chartId={activeChartId}
                            requestPremium={requestPremium}
                            onUpdateProfile={handleProfileUpdate}
                            onOpenCharts={() => openCharts('chart')}
                            onBalanceUpdate={(balance) => setProfile((prev) => (prev ? { ...prev, lumiBalance: balance } : prev))}
                        />
                    </div>
                ) : view === 'settings' ? (
                    <div className="h-full overflow-y-auto scrollbar-hide">
                        <Settings 
                            profile={profile} 
                            onUpdate={handleProfileUpdate} 
                            onShowPremiumPreview={() => setShowPremiumPreview(true)}
                            onOpenAdmin={() => setView('admin')}
                            onOpenCharts={() => openCharts('settings')}
                            onOpenWallet={() => openWallet('settings')}
                        />
                    </div>
                ) : view === 'charts' ? (
                    <div className="h-full overflow-y-auto scrollbar-hide">
                        <MyCharts 
                            profile={profile} 
                            onBack={() => setView(chartsReturnView)}
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
                                setChartData(chartData);
                                setActiveChartId(chartId);
                                setChartReturnView('charts');
                                setView('chart');
                            }}
                        />
                    </div>
                ) : view === 'wallet' ? (
                    <div className="h-full overflow-y-auto scrollbar-hide">
                        <Wallet
                            profile={profile}
                            onUpdateProfile={handleProfileUpdate}
                        />
                    </div>
                ) : (
                    // Default to Dashboard
                    <div className="h-full overflow-y-auto scrollbar-hide">
                        <Dashboard 
                            profile={profile} 
                            chartData={chartData}
                            activeChartId={activeChartId}
                            onNavigate={(newView) => {
                                if (newView === 'synastry') {
                                    setSynastryPrefill(null);
                                }
                                navigateTo(newView);
                            }} 
                            onOpenSettings={() => setView('settings')}
                            onRequestPremium={() => setShowPremiumPreview(true)}
                        />
                    </div>
                )}
            </main>

            {showPremiumPreview && (
                <PremiumPreview language={profile?.language || 'ru'} onClose={() => setShowPremiumPreview(false)} onPurchase={requestPremium} />
            )}
        </div>
    );
};

export default App;
