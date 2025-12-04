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
            {/* 3D Вращение логотипа как монета */}
            <motion.div
                className="relative"
                style={{ perspective: 1000 }}
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ 
                    opacity: 1, 
                    scale: 1,
                }}
                transition={{ 
                    duration: 0.6,
                    ease: "easeOut"
                }}
            >
                {/* Крутящийся логотип - 3D flip как монета */}
                <motion.div
                    animate={{ 
                        rotateY: 360
                    }}
                    transition={{ 
                        duration: 2.5,
                        repeat: Infinity,
                        ease: "linear"
                    }}
                    style={{
                        transformStyle: "preserve-3d",
                    }}
                    className="relative"
                >
                    {logoLoaded ? (
                        <div className="relative w-48 h-48 md:w-56 md:h-56">
                            <NextImage 
                                src="/logo.png" 
                                alt="ASTROT" 
                                width={224}
                                height={224}
                                className="object-contain"
                                style={{
                                    filter: 'drop-shadow(0 0 40px rgba(191, 161, 255, 0.4)) drop-shadow(0 4px 20px rgba(0, 0, 0, 0.3))'
                                }}
                                priority
                            />
                        </div>
                    ) : (
                        <div className="w-48 h-48 md:w-56 md:h-56 flex items-center justify-center">
                            <div className="text-8xl md:text-9xl font-bold text-astro-highlight opacity-90" style={{ fontFamily: 'Outfit, sans-serif' }}>
                                A
                            </div>
                        </div>
                    )}
                </motion.div>
            </motion.div>
        </div>
    );
};
