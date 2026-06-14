
import React from 'react';
import { motion } from 'framer-motion';
import { UserProfile } from '../types';
import { getText } from '../constants';
import { MonoButton } from '../components/mono-ui';

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
        <div 
            className="mono-page flex h-full flex-col items-center justify-center p-6 text-center relative"
            style={{
                paddingTop: 'calc(max(env(safe-area-inset-top, 0px), var(--tg-content-safe-area-inset-top, 0px)) + 1.5rem)',
                paddingBottom: 'calc(max(env(safe-area-inset-bottom, 0px), var(--tg-content-safe-area-inset-bottom, 0px)) + 1.5rem)',
            }}
        >
            <button 
                onClick={onClose}
                className="absolute z-50 p-2 text-mono-muted transition-colors hover:text-mono-ink"
                style={{
                    top: 'calc(max(env(safe-area-inset-top, 0px), var(--tg-content-safe-area-inset-top, 0px)) + 0.5rem)',
                    right: 'calc(max(env(safe-area-inset-right, 0px), var(--tg-content-safe-area-inset-right, 0px)) + 0.75rem)',
                }}
                aria-label="Close"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>

            <motion.div 
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="relative w-full max-w-md space-y-8"
            >
                <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-mono-muted">
                        Premium
                    </p>
                    <h1 className="mt-2 text-[28px] font-bold tracking-[-0.02em] text-mono-ink">
                        {getText(profile.language, 'paywall.title')}
                    </h1>
                    <p className="mt-3 text-[14px] leading-relaxed text-mono-muted">
                        {getText(profile.language, 'paywall.subtitle')}
                    </p>
                </div>

                <div className="rounded-mono-card border border-mono-line bg-mono-white p-6 text-left">
                    <div className="space-y-4">
                        {features.map((feat, i) => (
                            <motion.div 
                                key={i}
                                initial={{ x: -12, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: i * 0.08 + 0.1 }}
                                className="flex items-center gap-4"
                            >
                                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-mono-plate text-[10px] font-bold text-mono-ink">
                                    {String(i + 1).padStart(2, '0')}
                                </div>
                                <span className="text-[14px] font-medium text-mono-ink">{feat}</span>
                            </motion.div>
                        ))}
                    </div>
                </div>

                <div>
                    <MonoButton fullWidth onClick={onPurchase}>
                        {getText(profile.language, 'paywall.cta')}
                    </MonoButton>
                    <p className="mt-4 text-[10px] uppercase tracking-widest text-mono-muted">
                        {getText(profile.language, 'paywall.footer')}
                    </p>
                </div>
            </motion.div>
        </div>
    );
};
