import React, { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loading } from '../ui/Loading';

/**
 * Модальное окно для отображения детального анализа натальной карты
 * 
 * Используется для показа:
 * - Deep Dive анализов (личность, любовь, карьера, слабости, карма)
 * - Прогнозов (дневной, недельный, месячный)
 */
interface AnalysisModalProps {
    isOpen: boolean;
    title: string;
    content: string;
    isLoading: boolean;
    onClose: () => void;
}

export const AnalysisModal = memo<AnalysisModalProps>(({ 
    isOpen, 
    title, 
    content, 
    isLoading, 
    onClose 
}) => {
    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-6"
                onClick={onClose}
            >
                <motion.div 
                    initial={{ scale: 0.95 }} 
                    animate={{ scale: 1 }} 
                    exit={{ scale: 0.95 }}
                    className="bg-astro-card w-full max-w-lg rounded-3xl p-8 border border-astro-border max-h-[80vh] flex flex-col"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Заголовок модалки */}
                    <div className="flex justify-between items-center mb-6 pb-4 border-b border-astro-border shrink-0">
                        <h3 className="text-xl font-semibold text-astro-text">{title}</h3>
                        <button 
                            onClick={onClose} 
                            className="text-astro-subtext hover:text-astro-text text-2xl leading-none"
                            aria-label="Close"
                        >
                            ×
                        </button>
                    </div>

                    {/* Содержимое */}
                    <div className="flex-1 overflow-y-auto scrollbar-hide pr-2">
                        {isLoading ? (
                            <Loading />
                        ) : (
                            <div className="space-y-4">
                                {content.split('\n\n').filter(p => p.trim()).map((paragraph, idx) => (
                                    <p 
                                        key={idx}
                                        className="card-text text-base md:text-[17px] text-astro-text"
                                        style={{ 
                                            lineHeight: '1.7',
                                            maxWidth: '55ch'
                                        }}
                                    >
                                        {paragraph.trim()}
                                    </p>
                                ))}
                            </div>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
});

AnalysisModal.displayName = 'AnalysisModal';
