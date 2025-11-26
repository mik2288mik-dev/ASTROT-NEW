
import React, { useState } from 'react';
import { UserProfile, SynastryResult } from '../types';
import { calculateSynastry } from '../services/astrologyService';
import { getText } from '../constants';
import { motion } from 'framer-motion';
import { Loading } from '../components/ui/Loading';

interface SynastryProps {
    profile: UserProfile;
    requestPremium: () => void;
}

export const Synastry: React.FC<SynastryProps> = ({ profile, requestPremium }) => {
    const [partnerName, setPartnerName] = useState("");
    const [partnerDate, setPartnerDate] = useState("");
    const [result, setResult] = useState<SynastryResult | null>(null);
    const [loading, setLoading] = useState(false);

    if (!profile.isPremium) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                <h2 className="text-2xl font-serif text-astro-text mb-4">{getText(profile.language, 'synastry.title')}</h2>
                <p className="text-astro-subtext mb-8">{getText(profile.language, 'synastry.desc')}</p>
                <button onClick={requestPremium} className="bg-astro-text text-astro-bg px-8 py-3 rounded-full font-bold uppercase tracking-widest text-xs">
                    {getText(profile.language, 'dashboard.get_premium')}
                </button>
            </div>
        );
    }

    const handleCalculate = async () => {
        if (!partnerName || !partnerDate) return;
        setLoading(true);
        try {
            const data = await calculateSynastry(profile, partnerName, partnerDate);
            setResult(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <Loading message="Reading Stars..." />;

    return (
        <div className="p-6 pb-24 space-y-8">
            <h2 className="text-3xl font-serif font-bold text-astro-text text-center">
                {getText(profile.language, 'synastry.title')}
            </h2>

            {!result ? (
                <div className="bg-astro-card border border-astro-border p-6 rounded-xl shadow-soft">
                    <h3 className="text-[10px] uppercase tracking-widest text-astro-subtext mb-6 font-bold">
                        {getText(profile.language, 'synastry.input_title')}
                    </h3>
                    <div className="space-y-6">
                        <div>
                            <label className="block text-xs text-astro-text mb-2 font-serif">{getText(profile.language, 'synastry.partner_name')}</label>
                            <input 
                                type="text" 
                                value={partnerName}
                                onChange={(e) => setPartnerName(e.target.value)}
                                className="w-full bg-astro-bg border-b border-astro-border p-3 outline-none focus:border-astro-highlight transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-astro-text mb-2 font-serif">Birth Date</label>
                            <input 
                                type="date" 
                                value={partnerDate}
                                onChange={(e) => setPartnerDate(e.target.value)}
                                className="w-full bg-astro-bg border-b border-astro-border p-3 outline-none focus:border-astro-highlight transition-colors"
                            />
                        </div>
                        <button 
                            onClick={handleCalculate}
                            disabled={!partnerName || !partnerDate}
                            className="w-full bg-astro-highlight text-white py-4 rounded-lg font-bold uppercase tracking-widest text-[10px] shadow-lg disabled:opacity-50 mt-4"
                        >
                            {getText(profile.language, 'synastry.calc_btn')}
                        </button>
                    </div>
                </div>
            ) : (
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                >
                    <div className="text-center">
                        <div className="relative w-32 h-32 mx-auto mb-4 flex items-center justify-center">
                            <svg className="w-full h-full transform -rotate-90">
                                <circle cx="64" cy="64" r="60" fill="transparent" stroke="var(--bg-card)" strokeWidth="8" />
                                <circle 
                                    cx="64" cy="64" r="60" fill="transparent" stroke="var(--highlight)" strokeWidth="8" 
                                    strokeDasharray={377}
                                    strokeDashoffset={377 - (377 * result.compatibilityScore) / 100}
                                />
                            </svg>
                            <span className="absolute text-3xl font-serif font-bold text-astro-text">
                                {result.compatibilityScore}%
                            </span>
                        </div>
                        <button onClick={() => setResult(null)} className="text-[10px] uppercase tracking-widest text-astro-subtext underline">
                            New Calculation
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div className="bg-astro-card p-5 rounded-xl border border-astro-border">
                            <h4 className="text-astro-highlight text-[10px] font-bold uppercase tracking-widest mb-2">{getText(profile.language, 'synastry.emotional')}</h4>
                            <p className="text-sm font-light leading-relaxed">{result.emotionalConnection}</p>
                        </div>
                         <div className="bg-astro-card p-5 rounded-xl border border-astro-border">
                            <h4 className="text-astro-highlight text-[10px] font-bold uppercase tracking-widest mb-2">{getText(profile.language, 'synastry.intellectual')}</h4>
                            <p className="text-sm font-light leading-relaxed">{result.intellectualConnection}</p>
                        </div>
                         <div className="bg-astro-card p-5 rounded-xl border border-astro-border">
                            <h4 className="text-astro-subtext text-[10px] font-bold uppercase tracking-widest mb-2">{getText(profile.language, 'synastry.challenge')}</h4>
                            <p className="text-sm font-light leading-relaxed">{result.challenge}</p>
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    );
};
