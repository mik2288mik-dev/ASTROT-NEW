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
        const duration = 1500; // 1.5 секунды для более быстрой загрузки
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
            {/* Логотип с плавным вращением (без круга) */}
            <motion.div
                className="relative mb-12"
                initial={{ opacity: 0, scale: 0.8, rotateY: 0 }}
                animate={{ 
                    opacity: 1, 
                    scale: 1,
                    rotateY: [0, 360]
                }}
                transition={{ 
                    opacity: { duration: 0.4 },
                    scale: { duration: 0.5 },
                    rotateY: { 
                        duration: 8, 
                        repeat: Infinity,
                        ease: "linear"
                    }
                }}
                style={{ perspective: 1000 }}
            >
                {/* Логотип без круга */}
                <div className="relative w-32 h-32 flex items-center justify-center">
                    {hasLogo ? (
                        <img 
                            src="/logo.png" 
                            alt="ASTROT" 
                            className="w-32 h-32 object-contain"
                            style={{
                                filter: 'drop-shadow(0 0 20px rgba(191, 161, 255, 0.4))'
                            }}
                        />
                    ) : (
                        <div className="text-7xl font-light text-astro-highlight tracking-tighter" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                            A
                        </div>
                    )}
                </div>
            </motion.div>
            
            {/* Прогресс-бар с элегантными процентами */}
            <div className="w-48 max-w-full">
                {/* Проценты с элегантным шрифтом */}
                <motion.div 
                    className="text-astro-highlight text-3xl font-light mb-4 tracking-wider"
                    style={{ fontFamily: "'Cormorant Garamond', serif" }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                >
                    {Math.round(progress)}%
                </motion.div>
                
                {/* Тонкий прогресс-бар */}
                <div className="w-full h-[1px] bg-astro-border rounded-full overflow-hidden">
                    <motion.div 
                        className="h-full bg-astro-highlight rounded-full"
                        initial={{ width: '0%' }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.1 }}
                    />
                </div>
            </div>
        </div>
    );
};
