import React, { memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loading } from '../ui/Loading';

/**
 * Полноэкранный компонент для отображения детального анализа натальной карты
 * 
 * Используется для показа:
 * - Deep Dive анализов (личность, любовь, карьера, слабости, карма)
 * - Прогнозов (дневной, недельный, месячный)
 * 
 * Особенности:
 * - Полноэкранный режим с красивой типографикой
 * - Автоматическая очистка текста от лишних символов markdown
 * - Правильное разбиение на параграфы с учетом списков
 */
interface AnalysisModalProps {
    isOpen: boolean;
    title: string;
    content: string;
    isLoading: boolean;
    onClose: () => void;
}

/**
 * Очищает и форматирует текст от AI
 * Убирает лишние символы markdown, которые плохо отображаются
 */
const cleanText = (text: string): string => {
    if (!text) return '';
    
    return text
        // Убираем markdown заголовки (##, ###, **текст**)
        .replace(/#{1,6}\s+/g, '')
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/\*(.+?)\*/g, '$1')
        // Убираем лишние пробелы и переносы строк
        .replace(/\n{3,}/g, '\n\n')
        .trim();
};

/**
 * Разбивает текст на секции для красивого отображения
 */
const parseContent = (text: string) => {
    if (!text) return [];
    
    const cleaned = cleanText(text);
    const paragraphs = cleaned.split('\n\n').filter(p => p.trim());
    
    return paragraphs.map(paragraph => {
        const trimmed = paragraph.trim();
        
        // Проверяем, это список (начинается с •, -, числа)
        const isList = /^[•\-\d]/.test(trimmed);
        
        // Разбиваем список на элементы
        if (isList) {
            const items = trimmed
                .split('\n')
                .filter(line => line.trim())
                .map(line => line.replace(/^[•\-\d]+[\.)]\s*/, '').trim());
            
            return {
                type: 'list' as const,
                content: items
            };
        }
        
        // Обычный параграф
        return {
            type: 'paragraph' as const,
            content: trimmed
        };
    });
};

export const AnalysisModal = memo<AnalysisModalProps>(({ 
    isOpen, 
    title, 
    content, 
    isLoading, 
    onClose 
}) => {
    // Парсим контент один раз при изменении
    const parsedContent = useMemo(() => parseContent(content), [content]);
    
    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div 
                initial={{ x: '100%' }} 
                animate={{ x: 0 }} 
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="fixed inset-0 z-[70] bg-astro-bg overflow-y-auto"
            >
                {/* Заголовок с кнопкой закрытия */}
                <div className="sticky top-0 z-10 bg-astro-bg/95 backdrop-blur-md border-b border-astro-border">
                    <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
                        <button 
                            onClick={onClose}
                            className="flex items-center gap-2 text-astro-subtext hover:text-astro-text transition-colors"
                            aria-label="Back"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            <span className="text-sm uppercase tracking-wider">Назад</span>
                        </button>
                        <h1 className="text-lg font-serif text-astro-text text-center flex-1 mx-4">
                            {title}
                        </h1>
                        <div className="w-16"></div> {/* Spacer для центрирования заголовка */}
                    </div>
                </div>

                {/* Контент */}
                <div className="max-w-3xl mx-auto px-6 py-8 pb-24">
                    {isLoading ? (
                        <div className="flex items-center justify-center min-h-[50vh]">
                            <Loading />
                        </div>
                    ) : (
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="space-y-6"
                        >
                            {parsedContent.map((section, idx) => (
                                <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.1 + idx * 0.05 }}
                                >
                                    {section.type === 'paragraph' ? (
                                        <p className="text-base md:text-lg text-astro-text leading-relaxed font-serif" style={{ lineHeight: '1.8' }}>
                                            {section.content}
                                        </p>
                                    ) : (
                                        <ul className="space-y-3 pl-1">
                                            {section.content.map((item, itemIdx) => (
                                                <li key={itemIdx} className="flex items-start gap-3">
                                                    <span className="text-astro-highlight mt-1.5 flex-shrink-0">✦</span>
                                                    <span className="text-base md:text-lg text-astro-text leading-relaxed font-serif" style={{ lineHeight: '1.8' }}>
                                                        {item}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </motion.div>
                            ))}
                            
                            {/* Если текст пустой */}
                            {parsedContent.length === 0 && (
                                <div className="text-center text-astro-subtext py-12">
                                    <p className="text-lg font-serif">Контент отсутствует</p>
                                </div>
                            )}
                        </motion.div>
                    )}
                </div>
            </motion.div>
        </AnimatePresence>
    );
});

AnalysisModal.displayName = 'AnalysisModal';
