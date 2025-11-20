
import React from 'react';
import { motion } from 'framer-motion';
import { UserProfile } from '../types';
import { getText } from '../constants';

interface PaywallProps {
    profile: UserProfile;
    onPurchase: () => void;
    onClose: () => void;
}

export const Paywall: React.FC<PaywallProps> = ({ profile, onPurchase, onClose }) => {
    const features = [
        getText(profile.language, 'paywall.feature1'),
        getText(profile.language, 'paywall.feature2'),
        getText(profile.language, 'paywall.feature3'),
        getText(profile.language, 'paywall.feature4'),
    ];

    return (
        <div className="flex flex-col items-center justify-center h-full p-6 bg-astro-bg text-center perspective-1000 relative">
            {/* Close Button */}
            <button 
                onClick={onClose}
                className="absolute top-6 right-6 text-astro-subtext hover:text-astro-text transition-colors z-50 p-2 opacity-60 hover:opacity-100"
                aria-label="Close"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>

            <motion.div 
                initial={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
                animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                transition={{ duration: 0.8 }}
                className="w-full max-w-md space-y-8 relative"
            >
                {/* Background Glow */}
                <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-64 bg-astro-highlight/20 rounded-full blur-3xl pointer-events-none"></div>

                <div>
                    <h1 className="text-3xl font-serif font-bold text-astro-text mb-3">
                        {getText(profile.language, 'paywall.title')}
                    </h1>
                    <p className="text-astro-subtext text-sm font-light">
                        {getText(profile.language, 'paywall.subtitle')}
                    </p>
                </div>

                <div className="bg-astro-card/50 backdrop-blur-sm border border-astro-border rounded-2xl p-6 shadow-soft">
                    <div className="space-y-4 text-left">
                        {features.map((feat, i) => (
                            <motion.div 
                                key={i}
                                initial={{ x: -20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: i * 0.1 + 0.2 }}
                                className="flex items-center gap-4"
                            >
                                <div className="w-6 h-6 rounded-full bg-astro-highlight flex items-center justify-center text-astro-bg font-bold text-xs">✓</div>
                                <span className="text-astro-text text-sm font-medium">{feat}</span>
                            </motion.div>
                        ))}
                    </div>
                </div>

                <div className="pt-4">
                    <button 
                        onClick={onPurchase}
                        className="w-full bg-astro-text text-astro-bg py-5 rounded-xl font-bold uppercase tracking-widest text-sm shadow-glow hover:scale-[1.02] transition-transform relative overflow-hidden"
                    >
                        <span className="relative z-10">{getText(profile.language, 'paywall.cta')}</span>
                        <div className="absolute inset-0 bg-white/20 translate-y-full hover:translate-y-0 transition-transform duration-300"></div>
                    </button>
                    <p className="mt-4 text-[10px] uppercase tracking-widest text-astro-subtext">
                        {getText(profile.language, 'paywall.footer')}
                    </p>
                </div>
            </motion.div>
        </div>
    );
};
