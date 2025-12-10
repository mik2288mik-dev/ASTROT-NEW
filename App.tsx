
import React, { useEffect, useState } from 'react';
import { UserProfile, NatalChartData, ViewState } from './types';
import { getProfile, getChartData, saveProfile, saveChartData } from './services/storageService';
import { calculateNatalChart } from './services/astrologyService';
import { generateAllContent, shouldUpdateContent, getOrGenerateHoroscope } from './services/contentGenerationService';
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

const OWNER_ID = 123456789; 

const App: React.FC = () => {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [chartData, setChartData] = useState<NatalChartData | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [view, setView] = useState<ViewState>('onboarding');
    const [showPremiumPreview, setShowPremiumPreview] = useState(false);

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
        const loadData = async () => {
            console.log('[App] Loading user data from database...');
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
                // Загружаем профиль из БД
                setLoadingProgress(30);
                const storedProfile = await getProfile();
                
                // Загружаем данные карты из БД
                setLoadingProgress(50);
                const storedChart = await getChartData();

                console.log('[App] Loaded data from database:', {
                    hasProfile: !!storedProfile,
                    hasChart: !!storedChart,
                    tgId,
                    profileIsSetup: storedProfile?.isSetup,
                    profileData: storedProfile ? JSON.stringify(storedProfile) : 'null'
                });

                // Если профиль найден в БД и он настроен - показываем натальную карту
                if (storedProfile && storedProfile.isSetup) {
                    if (!storedProfile.language) storedProfile.language = 'ru';
                    if (!storedProfile.theme) storedProfile.theme = 'dark';

                    const isAdmin = tgId === OWNER_ID || storedProfile.isAdmin || false;
                    const updatedProfile = { ...storedProfile, id: tgId, isAdmin };
                    
                    console.log('[App] User data found in database, preparing to show chart:', {
                        userId: updatedProfile.id,
                        isAdmin,
                        isPremium: updatedProfile.isPremium,
                        hasChart: !!storedChart
                    });
                    
                    setProfile(updatedProfile);
                    
                    if (storedChart) {
                        // Если карта найдена в БД - используем её и показываем сразу
                        // Натальная карта сохраняется в БД и просто отображается при входе
                        // Обновление контента натальной карты только через кнопку регенерации
                        console.log('[App] Setting chart data from database');
                        setLoadingProgress(80);
                        setChartData(storedChart);
                        setLoadingProgress(100);
                        setView('dashboard');
                        
                        // ВАЖНО: Проверяем, нужно ли сгенерировать контент (если его нет)
                        // Это может произойти, если пользователь был создан до добавления generatedContent
                        // НО: НЕ генерируем контент каждый раз при загрузке!
                        setTimeout(async () => {
                            try {
                                // Проверяем, есть ли вообще generatedContent или threeKeys
                                const hasGeneratedContent = updatedProfile.generatedContent && 
                                    Object.keys(updatedProfile.generatedContent).length > 0;
                                const hasThreeKeys = (updatedProfile.generatedContent?.threeKeys || updatedProfile.threeKeys) &&
                                    updatedProfile.generatedContent?.threeKeys?.key1?.text && 
                                    updatedProfile.generatedContent?.threeKeys?.key1?.text !== "...";
                                
                                // Генерируем контент ТОЛЬКО если его действительно нет
                                if (!hasGeneratedContent || !hasThreeKeys) {
                                    console.log('[App] Missing content or threeKeys, generating all content ONCE...', {
                                        hasGeneratedContent,
                                        hasThreeKeys,
                                        hasThreeKeysInGenerated: !!updatedProfile.generatedContent?.threeKeys,
                                        hasThreeKeysInProfile: !!updatedProfile.threeKeys
                                    });
                                    
                                    const allContent = await generateAllContent(updatedProfile, storedChart);
                                    const updatedProfileWithContent = { ...updatedProfile, generatedContent: allContent };
                                    await saveProfile(updatedProfileWithContent);
                                    setProfile(updatedProfileWithContent);
                                    console.log('[App] All content generated and saved successfully');
                                } else {
                                    // Если контент есть - НЕ обновляем daily horoscope здесь
                                    // Dashboard сам проверит кэш и загрузит гороскоп если нужно
                                    // Это избегает лишних API запросов при первой загрузке
                                    console.log('[App] Content is up to date, Dashboard will load horoscope from cache if needed');
                                }
                            } catch (error) {
                                console.error('[App] Error updating content:', error);
                                // Не прерываем работу, если обновление не удалось
                            }
                        }, 100);
                    } else {
                        // Если карты нет в БД, но профиль есть - пересчитываем карту
                        console.log('[App] Chart not found in database, recalculating...');
                        setLoadingProgress(60);
                        try {
                            const generatedChart = await calculateNatalChart(updatedProfile);
                            setLoadingProgress(80);
                            if (generatedChart && generatedChart.sun) {
                                setChartData(generatedChart);
                                // Сохраняем пересчитанную карту в БД
                                await saveChartData(generatedChart);
                                console.log('[App] Chart recalculated and saved');
                            }
                            setLoadingProgress(100);
                            setView('dashboard'); // Показываем Dashboard с космическим паспортом
                        } catch (error) {
                            console.error('[App] Error recalculating chart:', error);
                            setLoadingProgress(100);
                            // При ошибке пересчета показываем onboarding
                            setView('onboarding');
                        }
                    }
                } else {
                    // Если данных нет в БД - показываем форму ввода данных
                    console.log('[App] No user data found in database, showing onboarding form');
                    setLoadingProgress(100);
                    setView('onboarding');
                }
            } catch (error) {
                console.error('[App] Error loading user data:', error);
                setLoadingProgress(100);
                // При ошибке загрузки показываем onboarding
                setView('onboarding');
            } finally {
                setTimeout(() => {
                    setLoading(false);
                }, 300); // Небольшая задержка для плавного перехода
            }
        };
        loadData();
    }, []);

    const handleOnboardingComplete = async (newProfile: UserProfile) => {
        console.log('[App] Onboarding complete, saving profile...', {
            name: newProfile.name,
            birthDate: newProfile.birthDate
        });

        const tg = (window as any).Telegram?.WebApp;
        const tgUser = tg?.initDataUnsafe?.user;
        const tgId = tgUser?.id;
        const isAdmin = tgId === OWNER_ID;
        const fullProfile = { ...newProfile, id: tgId, isAdmin };

        console.log('[App] Full profile prepared:', {
            userId: fullProfile.id,
            isAdmin,
            isSetup: fullProfile.isSetup
        });

        setProfile(fullProfile);
        setLoading(true);
        setLoadingProgress(10);
        
        // Сохраняем данные только если пользователь отметил галочку "запомнить данные"
        if (fullProfile.isSetup) {
            try {
                setLoadingProgress(20);
                await saveProfile(fullProfile);
                console.log('[App] Profile saved successfully');
            } catch (error) {
                console.error('[App] Failed to save profile:', error);
            }
        } else {
            console.log('[App] User chose not to save data, skipping profile save');
        }

        try {
            console.log('[App] Calculating natal chart...', {
                name: fullProfile.name,
                birthDate: fullProfile.birthDate,
                birthTime: fullProfile.birthTime,
                birthPlace: fullProfile.birthPlace
            });
            
            setLoadingProgress(30);
            const generatedChart = await calculateNatalChart(fullProfile);
            setLoadingProgress(70);
            
            if (!generatedChart || !generatedChart.sun) {
                throw new Error('Invalid chart data received');
            }
            
            console.log('[App] Chart generated, saving...', {
                hasSun: !!generatedChart.sun,
                hasMoon: !!generatedChart.moon,
                element: generatedChart.element
            });
            
            setChartData(generatedChart);
            setLoadingProgress(80);
            
            // Сохраняем карту только если пользователь отметил галочку "запомнить данные"
            if (fullProfile.isSetup) {
                try {
                    await saveChartData(generatedChart);
                    console.log('[App] Chart saved successfully');
                } catch (error) {
                    console.error('[App] Failed to save chart:', error);
                    // Не прерываем процесс, если сохранение не удалось
                }
                
                // НОВОЕ: Генерируем ВСЕ данные сразу при первом входе
                console.log('[App] Generating all content for first-time user...');
                setLoadingProgress(85);
                try {
                    const allContent = await generateAllContent(fullProfile, generatedChart);
                    fullProfile.generatedContent = allContent;
                    
                    // Сохраняем обновленный профиль со всеми генерациями
                    await saveProfile(fullProfile);
                    setProfile(fullProfile);
                    console.log('[App] All content generated and saved successfully');
                    setLoadingProgress(95);
                } catch (error) {
                    console.error('[App] Failed to generate all content:', error);
                    // Не прерываем процесс, если генерация не удалась
                }
            } else {
                console.log('[App] User chose not to save data, skipping content generation');
            }
            
            setLoadingProgress(100);
            // Funnel: Onboarding -> Hook -> Dashboard (not Paywall)
            setTimeout(() => {
                setView('hook');
            }, 300); 
        } catch (error: any) {
            console.error("[App] Error calculating natal chart:", error);
            console.error("[App] Error details:", {
                message: error?.message,
                stack: error?.stack,
                name: error?.name,
                code: error?.code
            });
            
            // Показываем более информативное сообщение об ошибке
            let errorMessage = error?.message || 'Неизвестная ошибка';
            
            // Если сообщение уже на русском и понятное, используем его
            // Иначе показываем общее сообщение
            if (!errorMessage.includes('Ошибка') && !errorMessage.includes('ошибка')) {
                // Если сообщение на английском или техническое, показываем общее
                if (errorMessage.includes('initialize') || errorMessage.includes('ephemeris') || errorMessage.includes('Swiss')) {
                    errorMessage = 'Ошибка инициализации астрономических расчетов. Пожалуйста, попробуйте позже или обновите страницу.';
                } else if (errorMessage.includes('location') || errorMessage.includes('coordinates')) {
                    errorMessage = 'Не удалось найти указанное место рождения. Пожалуйста, проверьте правильность написания.';
                } else {
                    errorMessage = 'Не удалось рассчитать натальную карту. Пожалуйста, проверьте правильность введенных данных и попробуйте снова.';
                }
            }
            
            alert(`Ошибка при расчете карты: ${errorMessage}`);
            
            // Возвращаемся к onboarding, чтобы пользователь мог попробовать снова
            setView('onboarding');
        } finally {
            setLoadingProgress(100);
            setTimeout(() => {
                setLoading(false);
            }, 300);
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
                        onUpdateProfile={handleProfileUpdate}
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
                        <Horoscope profile={profile} chartData={chartData} />
                    </div>
                ) : view === 'chart' ? (
                    <div className="h-full overflow-y-auto scrollbar-hide">
                        <NatalChart data={chartData} profile={profile} requestPremium={requestPremium} />
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
                            requestPremium={requestPremium} 
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
