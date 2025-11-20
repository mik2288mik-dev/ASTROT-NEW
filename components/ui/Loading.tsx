import React from 'react';
import { motion } from 'framer-motion';

interface LoadingProps {
    message?: string;
}

export const Loading: React.FC<LoadingProps> = ({ message }) => {
    return (
        <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-6 text-center perspective-1000">
            {/* 3D Container */}
            <motion.div
                className="relative w-32 h-32 mb-12 flex items-center justify-center"
                style={{ transformStyle: "preserve-3d" }}
                animate={{ 
                    rotateY: 360,
                }}
                transition={{ 
                    duration: 6, 
                    repeat: Infinity, 
                    ease: "linear" 
                }}
            >
                {/* The North Star Shape (SVG) */}
                <svg 
                    viewBox="0 0 24 24" 
                    className="w-24 h-24 text-astro-highlight drop-shadow-[0_0_15px_rgba(255,255,255,0.6)]"
                    fill="currentColor"
                >
                    <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z" />
                </svg>
                
                {/* Pulsing Aura Behind */}
                <motion.div 
                    className="absolute inset-0 bg-astro-highlight rounded-full blur-2xl opacity-20"
                    animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.1, 0.3, 0.1] }}
                    transition={{ duration: 3, repeat: Infinity }}
                />
            </motion.div>
            
            <motion.p 
                className="text-astro-text text-xs font-bold uppercase tracking-[0.3em] font-serif"
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 2, repeat: Infinity }}
            >
                {message}
            </motion.p>
        </div>
    );
};
