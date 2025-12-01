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
            {/* Логотип с медленным 3D вращением */}
            <motion.div
                className="relative mb-8"
                initial={{ opacity: 0, scale: 0.5, rotateY: 0 }}
                animate={{ 
                    opacity: 1, 
                    scale: 1,
                    rotateY: [0, 360]
                }}
                transition={{ 
                    opacity: { duration: 0.3 },
                    scale: { duration: 0.5 },
                    rotateY: { 
                        duration: 8, 
                        repeat: Infinity,
                        ease: "linear"
                    }
                }}
                style={{ perspective: 1000 }}
            >
                {/* Просто логотип без круга вокруг */}
                {hasLogo ? (
                    <img 
                        src="/logo.png" 
                        alt="ASTROT" 
                        className="w-32 h-32 object-contain drop-shadow-lg"
                        style={{
                            filter: 'brightness(0) invert(1) drop-shadow(0 0 10px rgba(255,255,255,0.3))'
                        }}
                    />
                ) : (
                    <div className="text-6xl font-bold text-white font-serif">
                        A
                    </div>
                )}
            </motion.div>
            
            {/* Элегантная тонкая 1px строка загрузки под логотип */}
            <div className="w-32 h-px bg-astro-border mb-8 relative overflow-hidden">
                <motion.div 
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-astro-highlight to-transparent"
                    initial={{ x: '-100%' }}
                    animate={{ x: '200%' }}
                    transition={{ 
                        duration: 1.5,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                />
            </div>
            
            {/* Прогресс-бар с процентами */}
            <div className="w-64 max-w-full">
                {/* Проценты с элегантным шрифтом */}
                <motion.div 
                    className="text-astro-text text-3xl font-light mb-3 tracking-wider"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
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
            </div>
        </div>
    );
};
