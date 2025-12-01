import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface LoadingProps {
    message?: string;
}

export const Loading: React.FC<LoadingProps> = ({ message }) => {
    const [progress, setProgress] = useState(0);
    const [hasLogo, setHasLogo] = useState(false);
    const loadingLabel = message || 'Загрузка...';

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
            {/* Логотип без обводок */}
            <motion.div
                className="mb-12"
                initial={{ opacity: 0, scale: 0.9, rotateY: 0 }}
                animate={{ 
                    opacity: 1, 
                    scale: 1,
                    rotateY: [0, 360]
                }}
                transition={{ 
                    opacity: { duration: 0.4, ease: "easeOut" },
                    scale: { duration: 0.6, ease: "easeOut" },
                    rotateY: { 
                        duration: 8, 
                        repeat: Infinity,
                        ease: "linear"
                    }
                }}
                style={{ perspective: 1000 }}
            >
                {hasLogo ? (
                    <img 
                        src="/logo.png" 
                        alt="ASTROT" 
                        className="w-28 h-28 object-contain drop-shadow-[0_25px_45px_rgba(0,0,0,0.45)]"
                    />
                ) : (
                    <div className="text-6xl font-serif text-white drop-shadow-[0_12px_32px_rgba(0,0,0,0.5)]">
                        ASTROT
                    </div>
                )}
            </motion.div>
            
            {/* Прогресс-бар с процентами */}
            <div className="w-64 max-w-full">
                {/* Проценты */}
                <motion.div 
                    className="text-astro-text text-3xl font-light tracking-[0.35em] uppercase mb-4"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                >
                    {Math.round(progress)}%
                </motion.div>
                
                {/* Прогресс-бар */}
                <div className="w-full h-2 bg-astro-card rounded-full overflow-hidden border border-astro-border">
                    <motion.div 
                        className="h-full bg-gradient-to-r from-astro-primary via-astro-accent to-astro-highlight rounded-full"
                        initial={{ width: '0%' }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.1 }}
                    />
                </div>

                {/* Текст оставляем только для скринридеров */}
                <span className="sr-only">{loadingLabel}</span>
            </div>
        </div>
    );
};
