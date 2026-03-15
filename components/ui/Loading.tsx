import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface LoadingProps {
    message?: string;
    progress?: number; // Реальный прогресс загрузки от 0 до 100
}

export const Loading: React.FC<LoadingProps> = ({ message, progress: externalProgress }) => {
    const [progress, setProgress] = useState(0);

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
                    <div className="relative w-48 h-48 md:w-56 md:h-56 flex items-center justify-center">
                        <span
                            className="text-5xl md:text-6xl font-bold font-serif text-astro-text tracking-tight"
                            style={{
                                filter: 'drop-shadow(0 0 40px rgba(191, 161, 255, 0.4)) drop-shadow(0 4px 20px rgba(0, 0, 0, 0.3))'
                            }}
                        >
                            Lumia
                        </span>
                    </div>
                </motion.div>
            </motion.div>
            
            {/* Сообщение загрузки */}
            {message && (
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="mt-6 text-astro-subtext text-sm font-medium"
                >
                    {message}
                </motion.p>
            )}
            
            {/* Индикатор прогресса */}
            {progress > 0 && progress < 100 && (
                <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: '200px' }}
                    transition={{ delay: 0.5 }}
                    className="mt-4 h-1 bg-astro-border rounded-full overflow-hidden"
                >
                    <motion.div
                        className="h-full bg-astro-highlight rounded-full"
                        style={{ width: `${progress}%` }}
                        transition={{ duration: 0.3 }}
                    />
                </motion.div>
            )}
        </div>
    );
};
