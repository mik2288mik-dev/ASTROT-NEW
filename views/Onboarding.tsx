
import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { motion } from 'framer-motion';

interface OnboardingProps {
    onComplete: (profile: UserProfile) => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
    const [step, setStep] = useState(1);
    const [name, setName] = useState("");
    const [date, setDate] = useState("");
    const [time, setTime] = useState("");
    const [place, setPlace] = useState("");

    // Telegram integration
    useEffect(() => {
        const tg = (window as any).Telegram?.WebApp;
        if (tg?.initDataUnsafe?.user) {
            setName(tg.initDataUnsafe.user.first_name || "");
        }
        tg?.expand();
    }, []);

    const handleNext = () => {
        if (step === 1 && name) setStep(2);
        else if (step === 2 && date && time) setStep(3);
        else if (step === 3 && place) {
            const profile: UserProfile = {
                name,
                birthDate: date,
                birthTime: time,
                birthPlace: place,
                isSetup: true,
                language: 'ru', // Default to Russian
                theme: 'dark', // Default to Dark/Strict
                isPremium: false
            };
            onComplete(profile);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-astro-bg font-sans">
            <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md"
            >
                {/* Header */}
                <div className="mb-16 text-center">
                    <h1 className="text-5xl font-bold text-astro-text mb-3 font-serif tracking-tighter">
                        ASTROT
                    </h1>
                    <p className="text-astro-subtext text-[10px] uppercase tracking-[0.4em]">
                        Персональный Оракул
                    </p>
                </div>

                <div className="bg-astro-card p-8 rounded-2xl border border-astro-border shadow-sm">
                    {step === 1 && (
                        <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="space-y-6">
                            <div>
                                <label className="block text-[10px] uppercase tracking-widest font-bold text-astro-subtext mb-3">
                                    Ваше Имя
                                </label>
                                <input 
                                    type="text" 
                                    value={name} 
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full bg-transparent border-b border-astro-border py-3 text-2xl text-astro-text focus:border-astro-highlight outline-none transition-colors font-serif placeholder-astro-subtext/20"
                                    placeholder="Введите имя"
                                />
                            </div>
                        </motion.div>
                    )}

                    {step === 2 && (
                        <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="space-y-8">
                             <div>
                                <label className="block text-[10px] uppercase tracking-widest font-bold text-astro-subtext mb-3">
                                    Дата Рождения
                                </label>
                                <input 
                                    type="date" 
                                    value={date} 
                                    onChange={(e) => setDate(e.target.value)}
                                    className="w-full bg-transparent border-b border-astro-border py-3 text-xl text-astro-text focus:border-astro-highlight outline-none font-serif"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] uppercase tracking-widest font-bold text-astro-subtext mb-3">
                                    Время Рождения
                                </label>
                                <input 
                                    type="time" 
                                    value={time} 
                                    onChange={(e) => setTime(e.target.value)}
                                    className="w-full bg-transparent border-b border-astro-border py-3 text-xl text-astro-text focus:border-astro-highlight outline-none font-serif"
                                />
                            </div>
                        </motion.div>
                    )}

                    {step === 3 && (
                        <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="space-y-6">
                            <div>
                                <label className="block text-[10px] uppercase tracking-widest font-bold text-astro-subtext mb-3">
                                    Место Рождения
                                </label>
                                <input 
                                    type="text" 
                                    value={place} 
                                    onChange={(e) => setPlace(e.target.value)}
                                    className="w-full bg-transparent border-b border-astro-border py-3 text-xl text-astro-text focus:border-astro-highlight outline-none font-serif placeholder-astro-subtext/20"
                                    placeholder="Москва, Россия"
                                />
                            </div>
                        </motion.div>
                    )}

                    <button 
                        onClick={handleNext}
                        className="mt-12 w-full bg-astro-text text-astro-bg font-bold py-4 rounded-xl shadow-lg hover:opacity-90 transition-all active:scale-[0.98] tracking-widest uppercase text-[10px]"
                    >
                        {step === 3 ? "Рассчитать Карту" : "Продолжить"}
                    </button>
                </div>
                
                <div className="flex justify-center mt-10 space-x-2">
                    {[1, 2, 3].map(i => (
                        <div key={i} className={`h-[2px] transition-all duration-500 ${step >= i ? 'w-8 bg-astro-highlight' : 'w-4 bg-astro-border'}`} />
                    ))}
                </div>
            </motion.div>
        </div>
    );
};
