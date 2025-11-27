
import React from 'react';
import { motion } from 'framer-motion';

interface PremiumPreviewProps {
    onClose: () => void;
    onPurchase: () => void;
}

export const PremiumPreview: React.FC<PremiumPreviewProps> = ({ onClose, onPurchase }) => {
    const features = [
        { title: "Oracle Chat", desc: "Unlimited AI conversations with Astra." },
        { title: "Daily Forecast", desc: "Deep personal transits & Moon impact." },
        { title: "Deep Dives", desc: "Interactive analysis of Love & Career." },
        { title: "Cosmic Passport", desc: "Full planetary breakdown & aspects." }
    ];

    return (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-lg flex items-center justify-center p-4" style={{ paddingTop: 'calc(1rem + 24px)' }}>
            <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-astro-bg w-full max-w-md rounded-2xl border border-astro-highlight p-6 relative overflow-hidden"
            >
                {/* Background decor */}
                <div className="absolute -top-20 -right-20 w-64 h-64 bg-astro-highlight/20 rounded-full blur-3xl"></div>

                <button onClick={onClose} className="absolute top-4 right-4 text-astro-subtext hover:text-astro-text">✕</button>

                <h2 className="text-2xl font-bold font-serif text-astro-text mb-2 text-center">ASTROT PRO</h2>
                <p className="text-center text-[10px] uppercase tracking-widest text-astro-highlight mb-8">Unlock the Stars</p>

                <div className="space-y-4 mb-8">
                    {features.map((f, i) => (
                        <div key={i} className="flex items-center gap-4 bg-astro-card p-3 rounded-lg border border-astro-border">
                            <div className="w-8 h-8 rounded-full bg-astro-highlight/10 flex items-center justify-center text-astro-highlight">★</div>
                            <div>
                                <h4 className="text-astro-text text-sm font-bold">{f.title}</h4>
                                <p className="text-astro-subtext text-xs">{f.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <button 
                    onClick={onPurchase}
                    className="w-full bg-astro-text text-astro-bg py-4 rounded-xl font-bold uppercase tracking-widest text-xs hover:scale-105 transition-transform shadow-glow"
                >
                    Unlock 1 Week • 250 Stars
                </button>
            </motion.div>
        </div>
    );
};
