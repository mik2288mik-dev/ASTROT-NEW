
import React, { useEffect, useState } from 'react';
import { UserProfile, NatalChartData, ViewState } from './types';
import { getProfile, getChartData, saveProfile, saveChartData } from './services/storageService';
import { calculateNatalChart } from './services/astrologyService';
import { Onboarding } from './views/Onboarding';
import { Dashboard } from './views/Dashboard';
import { NatalChart } from './views/NatalChart';
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
            console.log('[App] Loading user data...');
            const storedProfile = await getProfile();
            const storedChart = await getChartData();

            const tg = (window as any).Telegram?.WebApp;
            const tgUser = tg?.initDataUnsafe?.user;
            const tgId = tgUser?.id;

            console.log('[App] Loaded data:', {
                hasProfile: !!storedProfile,
                hasChart: !!storedChart,
                tgId,
                profileIsSetup: storedProfile?.isSetup
            });

            if (storedProfile && storedProfile.isSetup) {
                if (!storedProfile.language) storedProfile.language = 'ru';
                if (!storedProfile.theme) storedProfile.theme = 'dark';

                const isAdmin = tgId === OWNER_ID || storedProfile.isAdmin || false;
                const updatedProfile = { ...storedProfile, id: tgId, isAdmin };
                
                console.log('[App] Setting up profile:', {
                    userId: updatedProfile.id,
                    isAdmin,
                    isPremium: updatedProfile.isPremium
                });
                
                setProfile(updatedProfile);
                
                if (storedChart) {
                    console.log('[App] Setting chart data');
                    setChartData(storedChart);
                }

                // If user is set up, go straight to Dashboard (Hub)
                setView('dashboard');
            } else {
                console.log('[App] No profile found or not set up, showing onboarding');
            }
            setLoading(false);
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
        
        // Сохраняем данные только если пользователь отметил галочку "запомнить данные"
        if (fullProfile.isSetup) {
            try {
                await saveProfile(fullProfile);
                console.log('[App] Profile saved successfully');
            } catch (error) {
                console.error('[App] Failed to save profile:', error);
            }
        } else {
            console.log('[App] User chose not to save data, skipping profile save');
        }

        try {
            console.log('[App] Calculating natal chart...');
            const generatedChart = await calculateNatalChart(fullProfile);
            console.log('[App] Chart generated, saving...', {
                hasSun: !!generatedChart.sun,
                hasMoon: !!generatedChart.moon,
                element: generatedChart.element
            });
            
            setChartData(generatedChart);
            
            // Сохраняем карту только если пользователь отметил галочку "запомнить данные"
            if (fullProfile.isSetup) {
                try {
                    await saveChartData(generatedChart);
                    console.log('[App] Chart saved successfully');
                } catch (error) {
                    console.error('[App] Failed to save chart:', error);
                }
            } else {
                console.log('[App] User chose not to save data, skipping chart save');
            }
            
            // Funnel: Onboarding -> Hook -> Dashboard (not Paywall)
            setView('hook'); 
        } catch (error) {
            console.error("[App] AI Generation failed:", error);
            alert("Error connecting to stars. Please try again.");
        } finally {
            setLoading(false);
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
        
        // Premium Gating - показываем Paywall при попытке доступа к закрытым функциям
        if (!profile.isPremium && (newView === 'synastry' || newView === 'oracle')) {
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
        return (
            <div className="fixed inset-0 flex items-center justify-center bg-astro-bg z-50">
                <Loading message={getText(profile?.language || 'ru', 'loading')} />
            </div>
        );
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
