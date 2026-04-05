
import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { motion } from 'framer-motion';
import { ensureTelegramFullscreen } from '../lib/telegramFullscreen';

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
        ensureTelegramFullscreen();
    }, []);

    const stepDescription =
        step === 1
            ? "Начнём с простого."
            : step === 2
                ? "Пара деталей, чтобы всё собрать точнее."
                : "Последний шаг перед твоим личным разбором.";

    const handleNext = () => {
        // Валидация на каждом шаге
        if (step === 1) {
            if (!name || name.trim() === '') {
                alert('Пожалуйста, введите ваше имя');
                return;
            }
            setStep(2);
        } else if (step === 2) {
            if (!date) {
                alert('Пожалуйста, выберите дату рождения');
                return;
            }
            if (!time) {
                alert('Пожалуйста, выберите время рождения');
                return;
            }
            setStep(3);
        } else if (step === 3) {
            if (!place || place.trim() === '') {
                alert('Пожалуйста, введите место рождения');
                return;
            }
            
            // Создаем профиль с валидированными данными
            const profile: UserProfile = {
                name: name.trim(),
                birthDate: date,
                birthTime: time,
                birthPlace: place.trim(),
                isSetup: true, // Всегда true при завершении онбординга — данные сохраняются в БД
                language: 'ru', // Default to Russian
                theme: 'dark', // Default to Dark/Strict
                isPremium: false
            };
            
            console.log('[Onboarding] Submitting profile:', {
                name: profile.name,
                birthDate: profile.birthDate,
                birthTime: profile.birthTime,
                birthPlace: profile.birthPlace,
                isSetup: profile.isSetup
            });
            
            onComplete(profile);
        }
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-transparent p-6 font-sans text-[#2d2d2d]">
            <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md"
            >
                {/* Header */}
                <div className="mb-16 text-center">
                    <h1 className="mb-3 font-serif text-5xl font-bold tracking-tighter text-[#2d2d2d]">
                        Lumia
                    </h1>
                    <p className="text-[10px] uppercase tracking-[0.4em] text-[#717171]">
                        Ясность для жизни и решений
                    </p>
                    <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-[#5d5d5d]">
                        Пара шагов, чтобы Lumia точнее подсветила то, что сейчас важно: выбор, отношения и твой внутренний фокус.
                    </p>
                </div>

                <div className="rounded-2xl border border-black/[0.08] bg-white/95 p-8 shadow-sm ring-1 ring-black/[0.04]">
                    <div className="mb-8">
                        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#717171]">
                            Шаг {step} из 3
                        </p>
                        <p className="mt-2 text-sm leading-relaxed text-[#5d5d5d]">
                            {stepDescription}
                        </p>
                    </div>

                    {step === 1 && (
                        <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="space-y-6">
                            <div>
                                <label className="mb-3 block text-[10px] font-bold uppercase tracking-widest text-[#717171]">
                                    Ваше Имя
                                </label>
                                <input 
                                    type="text" 
                                    value={name} 
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full border-b border-black/15 bg-transparent py-3 font-serif text-2xl text-[#2d2d2d] outline-none transition-colors placeholder:text-black/25 focus:border-astro-highlight"
                                    placeholder="Введите имя"
                                />
                            </div>
                        </motion.div>
                    )}

                    {step === 2 && (
                        <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="space-y-8">
                             <div>
                                <label className="mb-3 block text-[10px] font-bold uppercase tracking-widest text-[#717171]">
                                    Дата Рождения
                                </label>
                                <input 
                                    type="date" 
                                    value={date} 
                                    onChange={(e) => setDate(e.target.value)}
                                    className="w-full border-b border-black/15 bg-transparent py-3 font-serif text-xl text-[#2d2d2d] outline-none focus:border-astro-highlight"
                                />
                            </div>
                            <div>
                                <label className="mb-3 block text-[10px] font-bold uppercase tracking-widest text-[#717171]">
                                    Время Рождения
                                </label>
                                <input 
                                    type="time" 
                                    value={time} 
                                    onChange={(e) => setTime(e.target.value)}
                                    className="w-full border-b border-black/15 bg-transparent py-3 font-serif text-xl text-[#2d2d2d] outline-none focus:border-astro-highlight"
                                />
                            </div>
                        </motion.div>
                    )}

                    {step === 3 && (
                        <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="space-y-6">
                            <div>
                                <label className="mb-3 block text-[10px] font-bold uppercase tracking-widest text-[#717171]">
                                    Место Рождения
                                </label>
                                <input 
                                    type="text" 
                                    value={place} 
                                    onChange={(e) => setPlace(e.target.value)}
                                    className="w-full border-b border-black/15 bg-transparent py-3 font-serif text-xl text-[#2d2d2d] outline-none placeholder:text-black/25 focus:border-astro-highlight"
                                    placeholder="Москва, Россия"
                                />
                            </div>
                        </motion.div>
                    )}

                    <button 
                        onClick={handleNext}
                        className="mt-12 w-full rounded-xl bg-[#2d2d2d] py-4 text-[10px] font-bold uppercase tracking-widest text-white shadow-lg transition-all hover:opacity-90 active:scale-[0.98]"
                    >
                        {step === 3 ? "Рассчитать Карту" : "Продолжить"}
                    </button>
                </div>
                
                <div className="flex justify-center mt-10 space-x-2">
                    {[1, 2, 3].map(i => (
                        <div key={i} className={`h-[2px] transition-all duration-500 ${step >= i ? 'w-8 bg-astro-highlight' : 'w-4 bg-black/15'}`} />
                    ))}
                </div>
            </motion.div>
        </div>
    );
};
