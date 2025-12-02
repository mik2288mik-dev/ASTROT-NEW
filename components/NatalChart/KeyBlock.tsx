import React, { memo } from 'react';

/**
 * Компонент для отображения одного из трех ключей натальной карты
 * 
 * Три ключа - это основные инсайты о человеке:
 * - Энергия (Солнце)
 * - Стиль любви (Венера)
 * - Карьера (Марс/Юпитер)
 */
interface KeyBlockProps {
    title: string;
    planetSymbol: string;
    text: string;
    advice?: string[];
    language: 'ru' | 'en';
}

export const KeyBlock = memo<KeyBlockProps>(({ title, planetSymbol, text, advice, language }) => {
    return (
        <div className="w-full max-w-2xl mx-auto">
            {/* Заголовок блока */}
            <h3 className="text-left text-base font-semibold text-astro-subtext uppercase tracking-wider mb-3">
                {title}
            </h3>

            {/* Иконка планеты слева + текст справа */}
            <div className="flex gap-3 items-start">
                {/* Иконка планеты сбоку */}
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-astro-card border-2 border-astro-border flex items-center justify-center shadow-md">
                    <span className="text-2xl text-astro-highlight">
                        {planetSymbol}
                    </span>
                </div>

                {/* Основной текст интерпретации */}
                <div className="flex-1 space-y-2">
                    {text.split('\n\n').filter(p => p.trim()).map((paragraph, idx) => (
                        <p 
                            key={idx}
                            className="text-[14px] leading-relaxed text-astro-text"
                            style={{ lineHeight: '1.5' }}
                        >
                            {paragraph.trim()}
                        </p>
                    ))}
                </div>
            </div>

            {/* Советы (если есть) */}
            {advice && advice.length > 0 && (
                <div className="mt-3 pt-3 border-t border-astro-border/30 ml-16">
                    <h4 className="text-xs font-semibold text-astro-text mb-2">
                        {language === 'ru' ? 'Советы' : 'Advice'}
                    </h4>
                    <div className="space-y-1.5">
                        {advice.map((item, index) => (
                            <p 
                                key={index}
                                className="text-[13px] leading-relaxed text-astro-subtext"
                            >
                                {item}
                            </p>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
});

KeyBlock.displayName = 'KeyBlock';
