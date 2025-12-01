import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface LoadingProps {
    message?: string;
}

export const Loading: React.FC<LoadingProps> = ({ message: _message }) => {
    const [progress, setProgress] = useState(0);
    const [hasLogo, setHasLogo] = useState(false);

    useEffect(() => {
        // Проверяем наличие файла logo.png
        const img = new Image();
        img.onload = () => setHasLogo(true);
        img.onerror = () => setHasLogo(false);
        img.src = '/logo.png';
    }, []);

    useEffect(() => {
        // Симуляция загрузки от 0 до 100%
        const duration = 2000; // 2 секунды
        const interval = 20; // обновление каждые 20мс
        const steps = duration / interval;
        const increment = 100 / steps;

        const timer = setInterval(() => {
            setProgress(prev => {
                const next = prev + increment;
                return next >= 100 ? 100 : next;
            });
        }, interval);

        return () => clearInterval(timer);
    }, []);

    return (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-astro-bg z-50 text-center px-4">
            {/* Логотип без дополнительного обрамления */}
            <motion.div
                className="relative mb-12"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
            >
                {hasLogo ? (
                    <motion.img 
                        src="/logo.png" 
                        alt="ASTROT" 
                        className="w-28 h-28 object-contain drop-shadow-[0_20px_45px_rgba(147,129,255,0.55)]"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                    />
                ) : (
                    <motion.div 
                        className="text-6xl font-serif text-astro-text"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                    >
                        A
                    </motion.div>
                )}
                <div className="absolute -inset-8 bg-astro-highlight/20 blur-3xl opacity-70 -z-10"></div>
            </motion.div>
            
            {/* Прогресс-бар с процентами */}
            <div className="w-64 max-w-full">
                {/* Проценты */}
                <motion.div 
                    className="text-astro-text text-3xl font-light tracking-[0.35em] uppercase mb-5 font-serif"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                >
                    {Math.round(progress)}%
                </motion.div>
                
                {/* Прогресс-бар */}
                <div className="w-full h-1.5 bg-astro-card/60 rounded-full overflow-hidden">
                    <motion.div 
                        className="h-full bg-gradient-to-r from-astro-primary via-astro-accent to-astro-highlight rounded-full"
                        initial={{ width: '0%' }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.15 }}
                    />
                </div>
            </div>
        </div>
    );
};
