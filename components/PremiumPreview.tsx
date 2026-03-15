
import React from 'react';
import { motion } from 'framer-motion';
import { getText } from '../constants';

interface PremiumPreviewProps {
    language: 'ru' | 'en';
    onClose: () => void;
    onPurchase: () => void;
}

export const PremiumPreview: React.FC<PremiumPreviewProps> = ({ language, onClose, onPurchase }) => {
    const features = [
        { title: getText(language, 'premium_preview.feature_oracle'), desc: getText(language, 'premium_preview.feature_oracle_desc') },
        { title: getText(language, 'premium_preview.feature_forecast'), desc: getText(language, 'premium_preview.feature_forecast_desc') },
        { title: getText(language, 'premium_preview.feature_deep'), desc: getText(language, 'premium_preview.feature_deep_desc') },
        { title: getText(language, 'premium_preview.feature_passport'), desc: getText(language, 'premium_preview.feature_passport_desc') }
    ];

    return (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-lg flex items-center justify-center p-4" style={{ paddingTop: 'calc(1rem + 24px)' }}>
            <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-astro-bg w-full max-w-md rounded-2xl border border-astro-highlight p-6 relative overflow-hidden"
            >
                <div className="absolute -top-20 -right-20 w-64 h-64 bg-astro-highlight/20 rounded-full blur-3xl" aria-hidden />

                <button onClick={onClose} className="absolute top-4 right-4 text-astro-subtext hover:text-astro-text" aria-label="Close">✕</button>

                <h2 className="text-2xl font-bold font-serif text-astro-text mb-2 text-center">{getText(language, 'premium_preview.title')}</h2>
                <p className="text-center text-[10px] uppercase tracking-widest text-astro-highlight mb-8">{getText(language, 'premium_preview.tagline')}</p>

                <div className="space-y-4 mb-8">
                    {features.map((f, i) => (
                        <div key={i} className="flex items-center gap-4 bg-astro-card p-3 rounded-lg border border-astro-border">
                            <div className="w-8 h-8 rounded-full bg-astro-highlight/10 flex items-center justify-center text-astro-highlight shrink-0">*</div>
                            <div className="min-w-0">
                                <h4 className="text-astro-text text-sm font-bold">{f.title}</h4>
                                <p className="text-astro-subtext text-xs">{f.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <button 
                    onClick={onPurchase}
                    className="w-full bg-astro-text text-astro-bg py-4 rounded-xl font-bold uppercase tracking-widest text-xs hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-glow"
                >
                    {getText(language, 'premium_preview.cta')}
                </button>
            </motion.div>
        </div>
    );
};
