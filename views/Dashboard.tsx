import React, { useEffect, useState } from 'react';
import { UserProfile, NatalChartData, DailyHoroscope, WeeklyHoroscope, MonthlyHoroscope } from '../types';
import { getDailyHoroscope, getWeeklyHoroscope, getMonthlyHoroscope } from '../services/geminiService';
import { Loading } from '../components/ui/Loading';
import { getText } from '../constants';
import { SolarSystem } from '../components/SolarSystem';
import { motion, AnimatePresence } from 'framer-motion';

interface DashboardProps {
    profile: UserProfile;
    chartData: NatalChartData | null;
    requestPremium: () => void;
}

type Tab = 'daily' | 'weekly' | 'monthly';

export const Dashboard: React.FC<DashboardProps> = ({ profile, chartData, requestPremium }) => {
    const [activeTab, setActiveTab] = useState<Tab>(profile.isPremium ? 'daily' : 'weekly');
    const [dailyData, setDailyData] = useState<DailyHoroscope | null>(null);
    const [weeklyData, setWeeklyData] = useState<WeeklyHoroscope | null>(null);
    const [monthlyData, setMonthlyData] = useState<MonthlyHoroscope | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!chartData) return;
        
        const fetchData = async () => {
            setLoading(true);
            try {
                if (activeTab === 'daily') {
                    if (!dailyData && profile.isPremium) {
                        const data = await getDailyHoroscope(profile, chartData);
                        setDailyData(data);
                    }
                } else if (activeTab === 'weekly') {
                    if (!weeklyData) {
                        const data = await getWeeklyHoroscope(profile, chartData);
                        setWeeklyData(data);
                    }
                } else if (activeTab === 'monthly') {
                    if (!monthlyData && profile.isPremium) {
                         const data = await getMonthlyHoroscope(profile, chartData);
                         setMonthlyData(data);
                    }
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [activeTab, profile, chartData]);

    useEffect(() => {
        if (!profile.isPremium && activeTab === 'daily') {
            setActiveTab('weekly');
        }
    }, [profile.isPremium]);

    const PremiumLock = () => (
        <div className="absolute inset-0 z-20 bg-astro-card/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center rounded-xl border border-astro-border">
            <div className="w-12 h-12 rounded-full border border-astro-highlight flex items-center justify-center mb-4 text-astro-highlight text-xl">
                ★
            </div>
            <h3 className="text-astro-text font-serif text-lg mb-2 uppercase tracking-wider">{getText(profile.language, 'dashboard.locked_title')}</h3>
            <p className="text-astro-subtext text-xs mb-6 leading-relaxed max-w-[200px]">{getText(profile.language, 'dashboard.locked_desc')}</p>
            <button 
                onClick={requestPremium}
                className="bg-astro-text text-astro-bg font-bold py-3 px-8 rounded-lg shadow-soft hover:scale-105 transition-transform text-[10px] uppercase tracking-widest"
            >
                {getText(profile.language, 'dashboard.get_premium')}
            </button>
        </div>
    );

    if (!chartData) return <Loading />;

    return (
        <div className="p-4 pb-24 space-y-6">
            
            {/* Cosmic Passport Header */}
            <div className="bg-astro-card rounded-xl p-6 border border-astro-border shadow-soft relative overflow-hidden">
                <div className="flex justify-between items-start relative z-10">
                    <div>
                        <p className="text-[10px] uppercase tracking-widest text-astro-subtext mb-1">{getText(profile.language, 'dashboard.passport')}</p>
                        <h2 className="text-2xl font-serif text-astro-text">{profile.name}</h2>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] uppercase tracking-widest text-astro-subtext mb-1">{getText(profile.language, 'dashboard.element')}</p>
                        <h2 className="text-lg font-serif text-astro-text">{chartData.element || "Ether"}</h2>
                    </div>
                </div>
                <div className="mt-6 flex justify-between items-end relative z-10">
                     <div>
                        <p className="text-[10px] uppercase tracking-widest text-astro-subtext mb-1">Sun Sign</p>
                        <div className="flex items-center gap-2">
                            <span className="text-xl text-astro-highlight">☉</span>
                            <span className="text-xl font-serif text-astro-text">{chartData.sun.sign}</span>
                        </div>
                    </div>
                     <div className="text-right">
                        <p className="text-[10px] uppercase tracking-widest text-astro-subtext mb-1">{getText(profile.language, 'dashboard.ruler')}</p>
                        <div className="flex items-center gap-2 justify-end">
                            <span className="text-lg font-serif text-astro-text">{chartData.rulingPlanet || "Unknown"}</span>
                        </div>
                    </div>
                </div>
                {/* Background graphic - subtle gradient based on theme vars */}
                <div className="absolute -top-10 -right-10 w-48 h-48 bg-astro-highlight rounded-full blur-3xl opacity-10"></div>
            </div>

            {/* Solar System */}
            <SolarSystem language={profile.language} />

            {/* Tabs */}
            <div className="flex bg-astro-card rounded-lg p-1 border border-astro-border relative shadow-sm">
                <button 
                    onClick={() => setActiveTab('daily')}
                    className={`flex-1 py-3 text-[10px] font-bold tracking-widest uppercase rounded-md transition-all relative z-10 ${activeTab === 'daily' ? 'bg-astro-bg text-astro-text border border-astro-border shadow-sm' : 'text-astro-subtext hover:text-astro-text'}`}
                >
                    {getText(profile.language, 'tabs.daily')} {profile.isPremium ? '' : '🔒'}
                </button>
                <button 
                    onClick={() => setActiveTab('weekly')}
                    className={`flex-1 py-3 text-[10px] font-bold tracking-widest uppercase rounded-md transition-all relative z-10 ${activeTab === 'weekly' ? 'bg-astro-bg text-astro-text border border-astro-border shadow-sm' : 'text-astro-subtext hover:text-astro-text'}`}
                >
                    {getText(profile.language, 'tabs.weekly')}
                </button>
                <button 
                    onClick={() => setActiveTab('monthly')}
                    className={`flex-1 py-3 text-[10px] font-bold tracking-widest uppercase rounded-md transition-all relative z-10 ${activeTab === 'monthly' ? 'bg-astro-bg text-astro-text border border-astro-border shadow-sm' : 'text-astro-subtext hover:text-astro-text'}`}
                >
                    {getText(profile.language, 'tabs.monthly')} {profile.isPremium ? '' : '🔒'}
                </button>
            </div>

            <div className="min-h-[300px] relative">
                {loading ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-astro-card/50 rounded-xl z-30 backdrop-blur-sm">
                         <Loading message={getText(profile.language, 'loading')} />
                    </div>
                ) : (
                    <AnimatePresence mode="wait">
                        {/* DAILY VIEW */}
                        {activeTab === 'daily' && (
                            <motion.div 
                                key="daily"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="space-y-6"
                            >
                                {!profile.isPremium ? <PremiumLock /> : dailyData && (
                                    <>
                                        {/* Moon Impact Card */}
                                        <div className="bg-astro-card border-l-2 border-astro-highlight p-6 rounded-r-xl shadow-soft">
                                             <h4 className="text-[10px] font-bold text-astro-subtext mb-2 uppercase tracking-widest">
                                                {getText(profile.language, 'dashboard.moon_impact')}
                                            </h4>
                                            <p className="text-sm text-astro-text leading-relaxed font-light">
                                                {dailyData.moonImpact || "The moon is quiet today."}
                                            </p>
                                        </div>

                                        <div className="bg-astro-card rounded-xl p-6 border border-astro-border shadow-soft relative overflow-hidden">
                                            <div className="relative z-10">
                                                <span className="inline-block mb-4 text-[10px] font-bold tracking-widest text-astro-highlight uppercase">
                                                    {getText(profile.language, 'dashboard.cosmic_vibe')}
                                                </span>
                                                <h3 className="text-3xl font-serif text-astro-text mb-4 leading-tight">
                                                    {dailyData.mood}
                                                </h3>
                                                <div className="h-[1px] w-12 bg-astro-border mb-4"></div>
                                                <p className="text-astro-text/80 leading-8 text-sm font-light">
                                                    {dailyData.content}
                                                </p>
                                            </div>
                                        </div>

                                        {dailyData.transitFocus && (
                                            <div className="p-5 rounded-xl border border-astro-highlight/30 bg-astro-highlight/5">
                                                <h4 className="text-astro-highlight text-[10px] font-bold mb-2 uppercase tracking-widest">
                                                    {getText(profile.language, 'dashboard.transit')}
                                                </h4>
                                                <p className="text-sm text-astro-text leading-relaxed font-light">
                                                    {dailyData.transitFocus}
                                                </p>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-astro-card rounded-xl p-4 border border-astro-border flex flex-col items-center shadow-soft">
                                                <span className="text-astro-subtext text-[10px] uppercase mb-2 tracking-widest">{getText(profile.language, 'dashboard.color')}</span>
                                                <div className="w-6 h-6 rounded-full mb-2 shadow-sm border border-astro-border" style={{ backgroundColor: dailyData.color || '#fff' }}></div>
                                                <span className="text-astro-text text-xs font-medium uppercase">{dailyData.color}</span>
                                            </div>
                                            <div className="bg-astro-card rounded-xl p-4 border border-astro-border flex flex-col items-center shadow-soft">
                                                <span className="text-astro-subtext text-[10px] uppercase mb-2 tracking-widest">{getText(profile.language, 'dashboard.number')}</span>
                                                <span className="text-2xl font-serif text-astro-text">{dailyData.number}</span>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </motion.div>
                        )}

                        {/* WEEKLY VIEW */}
                        {activeTab === 'weekly' && weeklyData && (
                            <motion.div 
                                key="weekly"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="space-y-6"
                            >
                                <div className="bg-astro-card rounded-xl p-6 border border-astro-border relative shadow-soft">
                                    <div className="mb-4">
                                        <p className="text-astro-highlight text-[10px] font-bold tracking-widest uppercase mb-2">{weeklyData.weekRange}</p>
                                        <h3 className="text-astro-text font-serif text-2xl">{weeklyData.theme}</h3>
                                    </div>
                                    <p className="text-astro-text/80 text-sm leading-8 font-light">{weeklyData.advice}</p>
                                </div>

                                <div className="grid gap-4">
                                    <div className="bg-astro-card p-5 rounded-xl border border-astro-border shadow-sm">
                                        <div className="flex items-center gap-3 mb-3">
                                            <span className="text-xs uppercase tracking-widest font-bold text-astro-text">Love</span>
                                            <div className="h-[1px] flex-1 bg-astro-border"></div>
                                        </div>
                                        <p className="text-astro-subtext text-sm leading-relaxed font-light">{weeklyData.love}</p>
                                    </div>
                                    <div className="bg-astro-card p-5 rounded-xl border border-astro-border shadow-sm">
                                        <div className="flex items-center gap-3 mb-3">
                                            <span className="text-xs uppercase tracking-widest font-bold text-astro-text">Career</span>
                                            <div className="h-[1px] flex-1 bg-astro-border"></div>
                                        </div>
                                        <p className="text-astro-subtext text-sm leading-relaxed font-light">{weeklyData.career}</p>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                         {/* MONTHLY VIEW */}
                         {activeTab === 'monthly' && (
                             <motion.div 
                                key="monthly"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="space-y-6"
                            >
                                {!profile.isPremium ? <PremiumLock /> : monthlyData && (
                                    <div className="bg-astro-card p-8 rounded-xl border border-astro-border shadow-soft">
                                        <h3 className="text-3xl text-astro-text font-serif mb-2">{monthlyData.month}</h3>
                                        <span className="text-astro-subtext text-[10px] uppercase tracking-[0.2em] mb-8 block">{monthlyData.theme}</span>
                                        
                                        <div className="prose prose-invert prose-sm">
                                            <p className="text-astro-text/80 leading-8 font-light mb-8">{monthlyData.content}</p>
                                        </div>
                                        
                                        <div className="p-4 border-l-2 border-astro-highlight bg-astro-highlight/5">
                                            <span className="text-[10px] text-astro-highlight uppercase tracking-widest block mb-2">Key Focus</span>
                                            <p className="text-astro-text text-sm font-serif italic">"{monthlyData.focus}"</p>
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                         )}
                    </AnimatePresence>
                )}
            </div>

            {/* Big Three Footer */}
            <div className="border-t border-astro-border pt-8 pb-4">
                <h4 className="text-[10px] font-bold text-astro-subtext mb-6 uppercase tracking-widest text-center">{getText(profile.language, 'dashboard.big_three')}</h4>
                <div className="flex justify-center gap-12">
                    <div className="text-center">
                        <span className="text-astro-text text-xl mb-2 block">☉</span>
                        <span className="text-astro-subtext text-[10px] uppercase tracking-wider font-bold">{chartData.sun.sign}</span>
                    </div>
                    <div className="text-center">
                        <span className="text-astro-text text-xl mb-2 block">☽</span>
                        <span className="text-astro-subtext text-[10px] uppercase tracking-wider font-bold">{chartData.moon.sign}</span>
                    </div>
                    <div className="text-center">
                        <span className="text-astro-text text-xl mb-2 block">↑</span>
                        <span className="text-astro-subtext text-[10px] uppercase tracking-wider font-bold">{chartData.rising.sign}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};