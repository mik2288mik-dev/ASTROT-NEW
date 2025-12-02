import React, { useState, useEffect } from 'react';
import NextImage from 'next/image';
import { motion } from 'framer-motion';

interface LoadingProps {
    message?: string;
    progress?: number; // Реальный прогресс загрузки от 0 до 100
}

export const Loading: React.FC<LoadingProps> = ({ message, progress: externalProgress }) => {
    const [progress, setProgress] = useState(0);
    const [logoLoaded, setLogoLoaded] = useState(false);

    useEffect(() => {
        // Проверяем наличие файла logo.png
        if (typeof window === 'undefined') return;
        const img = new window.Image();
        img.onload = () => {
            setLogoLoaded(true);
        };
        img.onerror = () => {
            setLogoLoaded(false);
        };
        img.src = '/logo.png';
    }, []);

    useEffect(() => {
        // Если передан внешний прогресс - используем его, иначе симулируем
        if (externalProgress !== undefined) {
            setProgress(externalProgress);
        } else {
            // Симуляция загрузки только если нет внешнего прогресса
            const duration = 2000;
            const interval = 20;
            const steps = duration / interval;
            const increment = 100 / steps;

            const timer = setInterval(() => {
                setProgress(prev => {
                    const next = prev + increment;
                    return next >= 100 ? 100 : next;
                });
            }, interval);

            return () => clearInterval(timer);
        }
    }, [externalProgress]);

    return (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-astro-bg z-50 text-center px-4">
            {/* Логотип с красивым крутящимся вращением */}
            <motion.div
                className="relative mb-8"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ 
                    opacity: 1, 
                    scale: 1,
                }}
                transition={{ 
                    opacity: { duration: 0.3 },
                    scale: { duration: 0.5 },
                }}
            >
                {/* Крутящийся логотип */}
                <motion.div
                    animate={{ 
                        rotate: 360
                    }}
                    transition={{ 
                        duration: 3, 
                        repeat: Infinity,
                        ease: "linear"
                    }}
                    className="relative"
                >
                    {logoLoaded ? (
                        <div className="relative w-32 h-32">
                            <NextImage 
                                src="/logo.png" 
                                alt="ASTROT" 
                                width={128}
                                height={128}
                                className="object-contain drop-shadow-lg"
                                style={{
                                    filter: 'brightness(0) invert(1) drop-shadow(0 0 20px rgba(255,255,255,0.5))'
                                }}
                                priority
                            />
                        </div>
                    ) : (
                        <div className="w-32 h-32 flex items-center justify-center">
                            <motion.div
                                className="text-6xl font-bold text-white font-serif"
                                animate={{ 
                                    rotate: 360
                                }}
                                transition={{ 
                                    duration: 2, 
                                    repeat: Infinity,
                                    ease: "linear"
                                }}
                            >
                                A
                            </motion.div>
                        </div>
                    )}
                </motion.div>
            </motion.div>
            
            {/* Сообщение загрузки */}
            {message && (
                <motion.p 
                    className="text-sm text-astro-subtext mb-6 uppercase tracking-wider"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                >
                    {message}
                </motion.p>
            )}
            
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
            
            {/* Прогресс-бар */}
            <div className="w-64 max-w-full">
                <div className="w-full h-2 bg-astro-card rounded-full overflow-hidden border border-astro-border">
                    <motion.div 
                        className="h-full bg-gradient-to-r from-astro-primary via-astro-accent to-astro-highlight rounded-full"
                        initial={{ width: '0%' }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                    />
                </div>
            </div>
        </div>
    );
};
