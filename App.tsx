
import React, { useEffect, useState } from 'react';
import { UserProfile, NatalChartData, ViewState } from './types';
import { getProfile, getChartData, saveProfile, saveChartData } from './services/storageService';
import { calculateNatalChart } from './services/geminiService';
import { Onboarding } from './views/Onboarding';
import { Dashboard } from './views/Dashboard';
import { NatalChart } from './views/NatalChart';
import { OracleChat } from './views/OracleChat';
import { Settings } from './views/Settings';
import { AdminPanel } from './views/AdminPanel';
import { Navigation } from './components/Navigation';
import { Header } from './components/Header';
import { Loading } from './components/ui/Loading';
import { getText } from './constants';
import { PremiumPreview } from './components/PremiumPreview';
import { requestStarsPayment } from './services/telegramService';

// OWNER TELEGRAM ID (Replace with real ID)
// Only this ID sees the Admin button initially.
const OWNER_ID = 123456789; 

const App: React.FC = () => {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [chartData, setChartData] = useState<NatalChartData | null>(null);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<ViewState>('onboarding');
    const [showPremiumPreview, setShowPremiumPreview] = useState(false);

    // Initialize Telegram WebApp
    useEffect(() => {
        const tg = (window as any).Telegram?.WebApp;
        if (tg) {
            tg.ready();
            tg.expand();
            tg.enableClosingConfirmation();
            tg.disableVerticalSwipes?.(); 
        }
    }, []);

    // GLOBAL THEME MANAGEMENT
    useEffect(() => {
        const theme = profile?.theme || 'dark';
        const body = document.body;
        
        if (theme === 'light') {
            body.classList.add('theme-light');
        } else {
            body.classList.remove('theme-light');
        }

        const tg = (window as any).Telegram?.WebApp;
        if (tg) {
            const headerColor = theme === 'light' ? '#F5F2EB' : '#050505'; 
            tg.setHeaderColor(headerColor);
            tg.setBackgroundColor(headerColor);
        }
    }, [profile?.theme]);

    useEffect(() => {
        const loadData = async () => {
            const storedProfile = await getProfile();
            const storedChart = await getChartData();

            const tg = (window as any).Telegram?.WebApp;
            const tgUser = tg?.initDataUnsafe?.user;
            const tgId = tgUser?.id;

            if (storedProfile && storedProfile.isSetup) {
                if (!storedProfile.language) storedProfile.language = 'ru';
                if (!storedProfile.theme) storedProfile.theme = 'dark';

                // Check Admin Status
                // Logic: User is admin if they are the Owner OR if their profile was previously promoted to admin
                const isAdmin = tgId === OWNER_ID || storedProfile.isAdmin || false;
                
                const updatedProfile = { ...storedProfile, id: tgId, isAdmin };
                
                setProfile(updatedProfile);
                
                if (storedChart) {
                    setChartData(storedChart);
                }
                // Default to Chart view instead of Dashboard for strict flow
                setView('chart');
            }
            setLoading(false);
        };
        loadData();
    }, []);

    const handleOnboardingComplete = async (newProfile: UserProfile) => {
        const tg = (window as any).Telegram?.WebApp;
        const tgUser = tg?.initDataUnsafe?.user;
        const tgId = tgUser?.id;

        const isAdmin = tgId === OWNER_ID; // First time setup: Only owner gets admin

        const fullProfile = { ...newProfile, id: tgId, isAdmin };

        setProfile(fullProfile);
        setLoading(true);
        await saveProfile(fullProfile);

        try {
            const generatedChart = await calculateNatalChart(fullProfile);
            setChartData(generatedChart);
            await saveChartData(generatedChart);
            setView('chart'); // Go to Chart first
        } catch (error) {
            console.error("AI Generation failed:", error);
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
       const success = await requestStarsPayment(profile);
       if (success) {
           const updated = { ...profile, isPremium: true };
           setProfile(updated);
           saveProfile(updated);
           setShowPremiumPreview(false);
       }
    };

    // Intercept navigation for locked features
    const handleSetView = (newView: ViewState) => {
        if (!profile) return;
        if (!profile.isPremium && (newView === 'dashboard' || newView === 'oracle')) {
            setShowPremiumPreview(true);
            return;
        }
        setView(newView);
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
            <Header profile={profile} />
            
            <main className="flex-1 relative w-full max-w-md mx-auto overflow-hidden">
                {view === 'admin' ? (
                    <AdminPanel profile={profile} onUpdate={handleProfileUpdate} onClose={() => setView('settings')} />
                ) : view === 'oracle' ? (
                    <OracleChat profile={profile} />
                ) : (
                    <div className="h-full overflow-y-auto scrollbar-hide pb-24">
                        {view === 'dashboard' && (
                            <Dashboard profile={profile} chartData={chartData} requestPremium={requestPremium} />
                        )}
                        {view === 'chart' && (
                            <NatalChart data={chartData} profile={profile} requestPremium={requestPremium} />
                        )}
                        {view === 'settings' && (
                            <Settings 
                                profile={profile} 
                                onUpdate={handleProfileUpdate} 
                                onShowPremiumPreview={() => setShowPremiumPreview(true)}
                                onOpenAdmin={() => setView('admin')}
                            />
                        )}
                    </div>
                )}
            </main>

            <Navigation 
                currentView={view} 
                setView={handleSetView} 
                language={profile.language} 
                isPremium={profile.isPremium}
            />

            {/* Premium Modal */}
            {showPremiumPreview && (
                <PremiumPreview onClose={() => setShowPremiumPreview(false)} onPurchase={requestPremium} />
            )}
        </div>
    );
};

export default App;
