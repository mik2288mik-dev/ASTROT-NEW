import React, { memo, useMemo } from 'react';
import { Language } from '../../types';

interface HoroscopeContentProps {
  content: string;
  moonImpact?: string;
  mood?: string;
  color?: string;
  language: Language;
}

/**
 * Очищает текст от лишних символов markdown
 */
const cleanText = (text: string): string => {
  if (!text) return '';
  
  return text
    // Убираем markdown заголовки и форматирование
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    // Убираем лишние пробелы
    .replace(/\s+/g, ' ')
    .trim();
};

export const HoroscopeContent = memo<HoroscopeContentProps>(({ 
  content, 
  moonImpact, 
  mood, 
  color, 
  language 
}) => {
  // Очищаем и разбиваем текст на параграфы
  const paragraphs = useMemo(() => {
    const cleaned = cleanText(content);
    // Разбиваем по двойным переносам строк или по одиночным если их нет
    const split = cleaned.includes('\n\n') 
      ? cleaned.split('\n\n') 
      : cleaned.split('\n');
    
    return split
      .filter((p: string) => p.trim())
      .map((p: string) => p.trim());
  }, [content]);

  return (
    <div className="bg-astro-card rounded-2xl p-6 md:p-8 border border-astro-border shadow-sm">
      <div className="space-y-5 md:space-y-6">
        {/* Разбиваем текст на абзацы с улучшенной типографикой */}
        {paragraphs.map((paragraph: string, index: number) => (
          <p 
            key={index}
            className="font-serif text-base md:text-lg text-astro-text"
            style={{ 
              lineHeight: '1.8',
              maxWidth: '70ch'
            }}
          >
            {paragraph}
          </p>
        ))}

        {/* Если есть дополнительная информация */}
        {moonImpact && (
          <div className="pt-6 mt-6 border-t border-astro-border/40">
            <h3 className="text-base md:text-lg font-semibold text-astro-text mb-3">
              {language === 'ru' ? 'Влияние Луны' : 'Moon Impact'}
            </h3>
            <p className="font-serif text-[15px] md:text-base text-astro-text/80" style={{ lineHeight: '1.7', maxWidth: '65ch' }}>
              {cleanText(moonImpact)}
            </p>
          </div>
        )}

        {/* Настроение дня */}
        {mood && (
          <div className="flex items-center justify-center gap-6 md:gap-8 pt-5 mt-5 border-t border-astro-border/30">
            <div className="text-center">
              <p className="text-xs md:text-sm text-astro-subtext mb-2 uppercase tracking-wide">
                {language === 'ru' ? 'Настроение' : 'Mood'}
              </p>
              <p className="text-base md:text-lg font-medium text-astro-text">
                {mood}
              </p>
            </div>
            {color && (
              <div className="text-center">
                <p className="text-xs md:text-sm text-astro-subtext mb-2 uppercase tracking-wide">
                  {language === 'ru' ? 'Цвет дня' : 'Lucky Color'}
                </p>
                <p className="text-base md:text-lg font-medium text-astro-text">
                  {color}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

HoroscopeContent.displayName = 'HoroscopeContent';
