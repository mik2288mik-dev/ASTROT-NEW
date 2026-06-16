
import React from 'react';
import { motion } from 'framer-motion';
import { UserProfile } from '../types';
import { getText } from '../constants';
import { MonoIllustWelcome } from '../components/mono-ui';
import { FreshPageTitle, FreshHeroCard } from '../components/fresh-ui';

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
            className="fresh-page lumia-main-scroll"
            style={{ display: 'flex', flexDirection: 'column', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }}
        >
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 16px 4px' }}>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    style={{
                        width: 34, height: 34, borderRadius: '50%', border: 'none',
                        background: 'var(--fresh-surface)', color: 'var(--fresh-muted)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                    }}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <FreshPageTitle kicker="Premium" title={getText(profile.language, 'paywall.title')} />

            <FreshHeroCard color="lavender">
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <MonoIllustWelcome size={110} className="opacity-90" />
                </div>
            </FreshHeroCard>

            <p style={{ padding: '0 20px', margin: '0 0 14px', fontSize: 14, lineHeight: 1.55, color: 'var(--fresh-muted)' }}>
                {getText(profile.language, 'paywall.subtitle')}
            </p>

            <div className="fresh-item-list">
                {features.map((feat, i) => (
                    <motion.div
                        key={i}
                        initial={{ x: -12, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: i * 0.08 + 0.1 }}
                        className="fresh-item"
                    >
                        <div
                            className="fresh-item-sign"
                            style={{ color: 'var(--fresh-link)', fontWeight: 800, fontSize: 13 }}
                        >
                            {String(i + 1).padStart(2, '0')}
                        </div>
                        <div className="fresh-item-info">
                            <div className="fresh-item-title">{feat}</div>
                        </div>
                    </motion.div>
                ))}
            </div>

            <div style={{ marginTop: 'auto', paddingTop: 20 }}>
                <button type="button" className="fresh-btn-primary" onClick={onPurchase}>
                    {getText(profile.language, 'paywall.cta')}
                </button>
                <p style={{ marginTop: 14, textAlign: 'center', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--fresh-muted)' }}>
                    {getText(profile.language, 'paywall.footer')}
                </p>
            </div>
        </div>
    );
};
