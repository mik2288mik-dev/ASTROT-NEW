
import React, { useEffect, useState, useRef } from 'react';
import { UserProfile, NatalChartData, ViewState } from './types';
import { getProfile, saveProfile } from './services/storageService';
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

// Get owner ID from environment variables for security
const OWNER_ID = process.env.NEXT_PUBLIC_OWNER_ID || '';

if (!OWNER_ID) {
    console.warn('[App] OWNER_ID not configured. Admin features will not be available.');
}

const App: React.FC = () => {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [chartData, setChartData] = useState<NatalChartData | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [view, setView] = useState<ViewState>('onboarding');
    const [showPremiumPreview, setShowPremiumPreview] = useState(false);
    
    // Ref для предотвращения двойной загрузки
    const dataLoadedRef = useRef(false);

    useEffect(() => {
        const tg = (window as any).Telegram?.WebApp;
        if (tg) {
            tg.ready();
            tg.expand();
            tg.enableClosingConfirmation();
            tg.disableVerticalSwipes?.(); 
        }
    }, []);

    useEffect(() => {
        const theme = profile?.theme || 'dark';
        const body = document.body;
        if (theme === 'light') body.classList.add('theme-light');
        else body.classList.remove('theme-light');

        const tg = (window as any).Telegram?.WebApp;
        if (tg) {
            const headerColor = theme === 'light' ? '#F5F2EB' : '#050505'; 
            tg.setHeaderColor(headerColor);
            tg.setBackgroundColor(headerColor);
        }
    }, [profile?.theme]);

    useEffect(() => {
        // Защита от двойной загрузки
        if (dataLoadedRef.current) return;
        dataLoadedRef.current = true;
        
        const loadData = async () => {
            console.log('[App] === LOADING USER DATA ===');
            setLoadingProgress(10);
            
            const tg = (window as any).Telegram?.WebApp;
            const tgUser = tg?.initDataUnsafe?.user;
            const tgId = tgUser?.id;

            if (!tgId) {
                console.log('[App] No Telegram user ID found, showing onboarding');
                setLoadingProgress(100);
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
                
                const isAdmin = OWNER_ID && String(tgId) === String(OWNER_ID) ? true : storedProfile.isAdmin;
                const updatedProfile = { ...storedProfile, id: tgId, isAdmin };
                setProfile(updatedProfile);

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
                        console.log('[App] Invalid chart data, showing onboarding');
                        setLoadingProgress(100);
                        setView('onboarding');
                    }
                } catch (chartError) {
                    console.error('[App] Error loading chart:', chartError);
                    setLoadingProgress(100);
                    setView('onboarding');
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
    }, []);

    const handleOnboardingComplete = async (newProfile: UserProfile) => {
        console.log('[App] === ONBOARDING COMPLETE ===', {
            name: newProfile.name,
            birthDate: newProfile.birthDate
        });

        const tg = (window as any).Telegram?.WebApp;
        const tgUser = tg?.initDataUnsafe?.user;
        const tgId = tgUser?.id;
        
        if (!tgId) {
            console.error('[App] No Telegram user ID - cannot save data');
            alert('Ошибка: Приложение должно быть открыто в Telegram');
            return;
        }
        
        const isAdmin = OWNER_ID && String(tgId) === String(OWNER_ID) ? true : undefined;
        const fullProfile = { ...newProfile, id: tgId, isAdmin };

        setProfile(fullProfile);
        setLoading(true);
        setLoadingProgress(10);

        try {
            // Шаг 1: Пытаемся сохранить профиль (не критично если не получится)
            setLoadingProgress(20);
            let profileSaved = false;
            try {
                await saveProfile(fullProfile);
                profileSaved = true;
                console.log('[App] Profile saved successfully');
            } catch (saveError: any) {
                console.warn('[App] Failed to save profile (will continue with calculation):', saveError.message);
                // Продолжаем без сохранения - расчёт карты всё равно сработает
            }

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
            
            // Переходим к Hook
            setTimeout(() => setView('hook'), 300);
            
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

    const handleProfileUpdate = (updatedProfile: UserProfile) => {
        setProfile(updatedProfile);
    };

    const requestPremium = async () => {
       if (!profile) return;
       console.log('[App] Requesting premium for user:', profile.id);
       const success = await requestStarsPayment(profile);
       if (success) {
           console.log('[App] Premium payment successful, updating profile...');
           const updated = { ...profile, isPremium: true };
           setProfile(updated);
           try {
               await saveProfile(updated);
               console.log('[App] Premium status saved successfully');
           } catch (error) {
               console.error('[App] Failed to save premium status:', error);
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
        
        // Premium Gating - показываем Paywall только для Oracle
        // Synastry доступна всем, но с ограниченным функционалом для бесплатных пользователей
        if (!profile.isPremium && newView === 'oracle') {
            setView('paywall');
            return;
        }
        setView(newView);
    };

    const handleBack = () => {
        // If in Admin, return to Settings
        if (view === 'admin') {
            setView('settings');
            return;
        }
        // Otherwise return to Hub
        setView('dashboard');
    };

    if (loading) {
        return <Loading message={getText(profile?.language || 'ru', 'loading')} progress={loadingProgress} />;
    }

    if (!profile || view === 'onboarding') {
        return (
            <div className="fixed inset-0 overflow-y-auto bg-astro-bg">
                <Onboarding onComplete={handleOnboardingComplete} />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full w-full overflow-hidden text-astro-text font-sans selection:bg-astro-highlight selection:text-white">
            
            {/* Header handles Title, Settings button, and Back button */}
            <Header 
                profile={profile} 
                view={view} 
                onOpenSettings={() => setView('settings')}
                onBack={handleBack}
            />
            
            <main className="flex-1 relative w-full max-w-md mx-auto overflow-hidden">
                {view === 'admin' ? (
                    <AdminPanel profile={profile} onUpdate={handleProfileUpdate} onClose={() => setView('settings')} />
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
                    <OracleChat profile={profile} />
                ) : view === 'synastry' ? (
                    <Synastry profile={profile} requestPremium={requestPremium} />
                ) : view === 'horoscope' ? (
                    <div className="h-full overflow-y-auto scrollbar-hide">
                        <Horoscope 
                            profile={profile} 
                            chartData={chartData} 
                            onUpdateProfile={handleProfileUpdate}
                        />
                    </div>
                ) : view === 'chart' ? (
                    <div className="h-full overflow-y-auto scrollbar-hide">
                        <NatalChart 
                            data={chartData} 
                            profile={profile} 
                            requestPremium={requestPremium}
                            onUpdateProfile={handleProfileUpdate}
                        />
                    </div>
                ) : view === 'settings' ? (
                    <div className="h-full overflow-y-auto scrollbar-hide">
                        <Settings 
                            profile={profile} 
                            onUpdate={handleProfileUpdate} 
                            onShowPremiumPreview={() => setShowPremiumPreview(true)}
                            onOpenAdmin={() => setView('admin')}
                        />
                    </div>
                ) : (
                    // Default to Dashboard
                    <div className="h-full overflow-y-auto scrollbar-hide">
                        <Dashboard 
                            profile={profile} 
                            chartData={chartData} 
                            onNavigate={navigateTo} 
                            onOpenSettings={() => setView('settings')}
                        />
                    </div>
                )}
            </main>

            {showPremiumPreview && (
                <PremiumPreview onClose={() => setShowPremiumPreview(false)} onPurchase={requestPremium} />
            )}
        </div>
    );
};

export default App;
