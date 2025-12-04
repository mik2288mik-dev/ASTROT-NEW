import React, { memo } from 'react';
import { motion, Variants } from 'framer-motion';
import { getText } from '../../constants';

const item: Variants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } }
};

/**
 * Компонент для отображения секции глубокого анализа натальной карты
 * 
 * Используется для отображения премиум-контента:
 * - Личность и Судьба
 * - Любовь и Отношения
 * - Карьера и Финансы
 * - Слабые стороны и Зоны роста
 * - Кармическая задача
 */
interface DeepDiveSectionProps {
    sectionKey: string;
    icon: string;
    language: 'ru' | 'en';
    isPremium: boolean;
    onOpen: () => void;
    onRequestPremium: () => void;
}

export const DeepDiveSection = memo<DeepDiveSectionProps>(({ 
    sectionKey, 
    icon, 
    language, 
    isPremium, 
    onOpen, 
    onRequestPremium 
}) => {
    const title = getText(language, `chart.${sectionKey}`);
    const tapToLearn = getText(language, 'chart.tap_to_learn');
    const premiumLock = getText(language, 'chart.premium_lock');

    return (
        <motion.div
            variants={item}
            className="bg-astro-card rounded-xl p-5 md:p-6 border border-astro-border shadow-sm cursor-pointer hover:border-astro-highlight transition-all hover:shadow-lg group"
            onClick={isPremium ? onOpen : onRequestPremium}
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-gradient-to-br from-astro-highlight/20 to-astro-highlight/5 border-2 border-astro-highlight/30 flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow">
                        <span className="text-2xl md:text-3xl text-astro-highlight opacity-90">{icon}</span>
                    </div>
                    <div>
                        <h4 className="text-base md:text-[17px] font-semibold text-astro-text">{title}</h4>
                        {!isPremium && (
                            <p className="text-xs md:text-sm text-astro-subtext mt-1">{premiumLock}</p>
                        )}
                    </div>
                </div>
                {isPremium ? (
                    <span className="text-xs md:text-sm text-astro-highlight font-medium group-hover:translate-x-1 transition-transform">{tapToLearn}</span>
                ) : (
                    <span className="text-sm text-astro-subtext">🔒</span>
                )}
            </div>
        </motion.div>
    );
});

DeepDiveSection.displayName = 'DeepDiveSection';
