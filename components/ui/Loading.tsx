import React from 'react';
import { motion } from 'framer-motion';

interface LoadingProps {
    message?: string;
}

export const Loading: React.FC<LoadingProps> = ({ message }) => {
    return (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-astro-bg z-50 text-center">
            {/* Статичный логотип АСТРОТ с элегантным свечением */}
            <motion.div
                className="relative mb-8"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
            >
                <h1 className="text-6xl font-bold text-astro-text font-serif tracking-tighter">
                    АСТРОТ
                </h1>
                
                {/* Пульсирующее свечение вокруг логотипа */}
                <motion.div 
                    className="absolute inset-0 bg-astro-highlight blur-2xl opacity-20 -z-10"
                    animate={{ 
                        scale: [0.9, 1.1, 0.9], 
                        opacity: [0.1, 0.3, 0.1] 
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                />
            </motion.div>
            
            {/* Сообщение о загрузке */}
            <motion.p 
                className="text-astro-text text-xs font-bold uppercase tracking-[0.3em] font-serif"
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 2, repeat: Infinity }}
            >
                {message || "Проверка данных..."}
            </motion.p>
        </div>
    );
};
