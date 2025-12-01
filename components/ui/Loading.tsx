import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface LoadingProps {
    message?: string;
}

export const Loading: React.FC<LoadingProps> = ({ message }) => {
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
            {/* Логотип с 3D вращением как монета */}
            <motion.div
                className="relative mb-12"
                initial={{ opacity: 0, scale: 0.5, rotateY: 0 }}
                animate={{ 
                    opacity: 1, 
                    scale: 1,
                    rotateY: [0, 360, 720, 1080]
                }}
                transition={{ 
                    opacity: { duration: 0.3 },
                    scale: { duration: 0.5 },
                    rotateY: { 
                        duration: 3, 
                        repeat: Infinity,
                        ease: "linear"
                    }
                }}
                style={{ perspective: 1000 }}
            >
                {/* Круглый логотип */}
                <div className="relative w-32 h-32 rounded-full bg-gradient-to-br from-astro-primary to-astro-accent flex items-center justify-center shadow-2xl border-4 border-astro-highlight/30">
                    {hasLogo ? (
                        <img 
                            src="/logo.png" 
                            alt="ASTROT" 
                            className="w-20 h-20 object-contain"
                        />
                    ) : (
                        <div className="text-6xl font-bold text-white font-serif">
                            A
                        </div>
                    )}
                    
                    {/* Свечение вокруг логотипа */}
                    <motion.div 
                        className="absolute inset-0 bg-astro-highlight rounded-full blur-2xl opacity-30 -z-10"
                        animate={{ 
                            scale: [1, 1.2, 1], 
                            opacity: [0.2, 0.4, 0.2] 
                        }}
                        transition={{ duration: 2, repeat: Infinity }}
                    />
                </div>
            </motion.div>
            
            {/* Прогресс-бар с процентами */}
            <div className="w-64 max-w-full">
                {/* Проценты */}
                <motion.div 
                    className="text-astro-text text-2xl font-bold mb-3 font-serif"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
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
                
                {/* Сообщение о загрузке */}
                <motion.p 
                    className="text-astro-subtext text-xs uppercase tracking-[0.2em] mt-4 font-serif"
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 2, repeat: Infinity }}
                >
                    {message || "Загрузка..."}
                </motion.p>
            </div>
        </div>
    );
};
