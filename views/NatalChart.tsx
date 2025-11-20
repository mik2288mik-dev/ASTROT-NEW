
import React, { useState } from 'react';
import { NatalChartData, PlanetPosition, UserProfile } from '../types';
import { getText } from '../constants';
import { getDeepDiveAnalysis } from '../services/geminiService';
import { motion, AnimatePresence } from 'framer-motion';

interface NatalChartProps {
    data: NatalChartData | null;
    profile: UserProfile;
    requestPremium: () => void;
}

const PlanetCard: React.FC<{ 
    position: PlanetPosition; 
    icon: string; 
    isPremium: boolean;
    onAnalyze: () => void;
    label: string;
    blurred?: boolean;
}> = ({ position, icon, isPremium, onAnalyze, label, blurred }) => (
    <div className={`bg-astro-card border border-astro-border p-5 rounded-xl mb-4 relative overflow-hidden shadow-soft transition-all duration-500 ${blurred ? 'opacity-60' : 'opacity-100'}`}>
        <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-astro-bg border border-astro-border flex items-center justify-center text-lg text-astro-highlight">
                    {icon}
                </div>
                <div>
                    <h4 className="font-bold text-astro-text text-lg font-serif">{position.sign}</h4>
                    <p className="text-[10px] text-astro-subtext uppercase tracking-widest font-medium">{position.planet}</p>
                </div>
            </div>
        </div>
        
        <p className={`text-sm text-astro-text/80 leading-relaxed mb-4 font-light ${blurred ? 'blur-sm select-none' : ''}`}>
            {position.description}
        </p>

        {isPremium && !blurred && (
            <button 
                onClick={onAnalyze}
                className="text-[10px] text-astro-highlight font-bold uppercase tracking-widest flex items-center gap-2 hover:text-astro-text transition-colors"
            >
                <span>{label}</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
            </button>
        )}
    </div>
);

export const NatalChart: React.FC<NatalChartProps> = ({ data, profile, requestPremium }) => {
    const [activeAnalysis, setActiveAnalysis] = useState<string | null>(null);
    const [analysisResult, setAnalysisResult] = useState<string>("");
    const [loadingAnalysis, setLoadingAnalysis] = useState(false);

    if (!data) return <div className="p-6 text-center text-astro-subtext">Chart not available.</div>;

    const handleDeepDive = async (topic: string) => {
        if (!profile.isPremium) {
            requestPremium();
            return;
        }
        setActiveAnalysis(topic);
        setLoadingAnalysis(true);
        try {
            const result = await getDeepDiveAnalysis(profile, topic, data);
            setAnalysisResult(result);
        } catch (e) {
            setAnalysisResult("Stars are quiet. Try again.");
        } finally {
            setLoadingAnalysis(false);
        }
    };

    return (
        <div className="p-4 space-y-6">
            
            {/* Centered Title as requested */}
            <div className="pt-4 pb-2 text-center">
                 <h2 className="text-2xl font-bold text-astro-text font-serif tracking-wide uppercase">
                     {profile.language === 'ru' ? 'Ваша натальная карта' : 'Your Natal Chart'}
                 </h2>
                 <div className="h-[1px] w-24 bg-astro-highlight mx-auto mt-2 opacity-50"></div>
            </div>

            {/* Summary */}
            <div className="bg-astro-card p-6 rounded-2xl border border-astro-highlight/30 shadow-soft relative overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-astro-highlight/10 rounded-full blur-2xl"></div>
                <h3 className="text-[10px] font-bold text-astro-highlight mb-3 uppercase tracking-widest">{getText(profile.language, 'chart.summary')}</h3>
                <p className="text-astro-text leading-7 text-sm font-light relative z-10">
                    {data.summary}
                </p>
            </div>

            {/* Deep Dive Interactive Buttons */}
            <div className="grid grid-cols-2 gap-3">
                {['Love', 'Career', 'Wealth', 'Karma'].map((topic) => (
                    <button
                        key={topic}
                        onClick={() => handleDeepDive(topic)}
                        className="p-4 bg-astro-card rounded-xl border border-astro-border text-left relative overflow-hidden group shadow-sm hover:border-astro-highlight/50 transition-colors"
                    >
                        <span className="text-astro-text text-xs font-bold uppercase tracking-wider relative z-10">{topic}</span>
                        {!profile.isPremium && <span className="absolute top-3 right-3 text-xs opacity-50">🔒</span>}
                        <div className="absolute inset-0 bg-astro-highlight/5 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300"></div>
                    </button>
                ))}
            </div>

            <div>
                <h3 className="text-[10px] font-bold text-astro-subtext mb-4 uppercase tracking-widest ml-2">{getText(profile.language, 'chart.placements')}</h3>
                
                <PlanetCard 
                    position={data.sun} icon="☉" 
                    isPremium={profile.isPremium}
                    onAnalyze={() => handleDeepDive('Sun Sign')}
                    label={getText(profile.language, 'chart.tap_to_analyze')}
                />
                <PlanetCard 
                    position={data.moon} icon="☽" 
                    isPremium={profile.isPremium}
                    onAnalyze={() => handleDeepDive('Moon Sign')}
                    label={getText(profile.language, 'chart.tap_to_analyze')}
                />
                <PlanetCard 
                    position={data.rising} icon="↑" 
                    isPremium={profile.isPremium}
                    onAnalyze={() => handleDeepDive('Rising Sign')}
                    label={getText(profile.language, 'chart.tap_to_analyze')}
                />
                
                {/* Locked Content Section */}
                <div className="relative mt-8">
                    {/* Render cards but blurred if not premium */}
                    <div className="pointer-events-none">
                         <PlanetCard 
                            position={data.mercury} icon="☿"
                            isPremium={profile.isPremium}
                            onAnalyze={() => {}}
                            label=""
                            blurred={!profile.isPremium}
                        />
                        <PlanetCard 
                            position={data.venus} icon="♀"
                            isPremium={profile.isPremium}
                            onAnalyze={() => {}}
                            label=""
                            blurred={!profile.isPremium}
                        />
                        <PlanetCard 
                            position={data.mars} icon="♂"
                            isPremium={profile.isPremium}
                            onAnalyze={() => {}}
                            label=""
                            blurred={!profile.isPremium}
                        />
                    </div>

                    {/* CTA Button placed visibly AFTER/OVER the blurred content but without obscuring readable text */}
                    {!profile.isPremium && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
                             <div className="bg-astro-bg/50 backdrop-blur-sm absolute inset-0 rounded-xl"></div>
                             <div className="relative z-30 text-center p-6">
                                <h4 className="text-astro-text font-serif text-lg mb-2">Unlock Deep Cosmos</h4>
                                <button 
                                    onClick={requestPremium} 
                                    className="bg-astro-text text-astro-bg px-8 py-4 rounded-full text-[10px] uppercase tracking-widest font-bold shadow-xl hover:scale-105 transition-transform border border-astro-highlight"
                                >
                                    {getText(profile.language, 'chart.premium_lock')}
                                </button>
                             </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Analysis Modal */}
            <AnimatePresence>
                {activeAnalysis && (
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-6"
                        onClick={() => !loadingAnalysis && setActiveAnalysis(null)}
                    >
                        <motion.div 
                            initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
                            className="bg-astro-card w-full max-w-sm rounded-2xl p-8 border border-astro-border shadow-2xl max-h-[80vh] flex flex-col"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex justify-between items-center mb-6 border-b border-astro-border pb-4 shrink-0">
                                <h3 className="text-xl text-astro-text font-serif">{activeAnalysis}</h3>
                                <button onClick={() => setActiveAnalysis(null)} className="text-astro-subtext hover:text-astro-text">✕</button>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto scrollbar-hide">
                                {loadingAnalysis ? (
                                    <div className="py-12 flex flex-col items-center">
                                        <div className="w-10 h-10 border-2 border-astro-highlight border-t-transparent rounded-full animate-spin mb-4"></div>
                                        <p className="text-[10px] uppercase tracking-widest text-astro-subtext">Consulting the Oracle...</p>
                                    </div>
                                ) : (
                                    <p className="text-astro-text text-sm leading-8 font-light pr-2">
                                        {analysisResult}
                                    </p>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
