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
        <div className="w-full max-w-3xl mx-auto">
            {/* Заголовок блока */}
            <h3 className="text-left text-sm md:text-base font-semibold text-astro-subtext uppercase tracking-wide mb-4">
                {title}
            </h3>

            {/* Иконка планеты слева + текст справа */}
            <div className="flex gap-4 md:gap-5 items-start">
                {/* Иконка планеты сбоку */}
                <div className="flex-shrink-0 w-14 h-14 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-astro-card to-astro-bg border-2 border-astro-border flex items-center justify-center shadow-lg">
                    <span className="text-3xl md:text-4xl text-astro-highlight opacity-90" style={{ 
                        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))'
                    }}>
                        {planetSymbol}
                    </span>
                </div>

                {/* Основной текст интерпретации */}
                <div className="flex-1 space-y-3.5 md:space-y-4">
                    {text.split('\n\n').filter(p => p.trim()).map((paragraph, idx) => (
                        <p 
                            key={idx}
                            className="card-text text-base md:text-[17px] text-astro-text"
                            style={{ 
                                lineHeight: '1.7',
                                maxWidth: '65ch'
                            }}
                        >
                            {paragraph.trim()}
                        </p>
                    ))}
                </div>
            </div>

            {/* Советы (если есть) */}
            {advice && advice.length > 0 && (
                <div className="mt-5 md:mt-6 pt-5 border-t border-astro-border/40 ml-[72px] md:ml-[84px]">
                    <h4 className="text-xs md:text-sm font-semibold text-astro-text mb-3 uppercase tracking-wide">
                        {language === 'ru' ? 'Советы' : 'Advice'}
                    </h4>
                    <div className="space-y-2.5">
                        {advice.map((item, index) => (
                            <p 
                                key={index}
                                className="text-sm md:text-[15px] text-astro-subtext"
                                style={{ 
                                    lineHeight: '1.6',
                                    maxWidth: '60ch'
                                }}
                            >
                                • {item}
                            </p>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
});

KeyBlock.displayName = 'KeyBlock';
