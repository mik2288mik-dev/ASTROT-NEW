import React, { memo, useMemo } from 'react';
import { getText } from '../../constants';
import { Language } from '../../types';

interface HoroscopeContentProps {
  content: string;
  moonImpact?: string;
  transitFocus?: string;
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
  transitFocus,
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
    <div className="space-y-5">
      <div className="rounded-[24px] border border-astro-border bg-gradient-to-b from-astro-card to-astro-card/65 p-6 shadow-sm">
        <p className="text-[10px] uppercase tracking-[0.2em] text-astro-subtext">
          {getText(language, 'horoscope.reading_title')}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-astro-subtext">
          {getText(language, 'horoscope.reading_body')}
        </p>

        <div className="mt-5 space-y-4 md:space-y-5">
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
        </div>
      </div>

      {(moonImpact || transitFocus) && (
        <div className="rounded-[24px] border border-astro-border bg-astro-card/60 p-5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-astro-subtext">
            {getText(language, 'horoscope.context_title')}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-astro-subtext">
            {getText(language, 'horoscope.context_body')}
          </p>

          <div className="mt-4 space-y-3">
            {moonImpact && (
              <div className="rounded-2xl border border-astro-border/70 bg-astro-bg/25 p-4">
                <h3 className="text-sm font-semibold text-astro-text">
                  {getText(language, 'horoscope.moon_impact_title')}
                </h3>
                <p className="mt-2 font-serif text-[15px] leading-relaxed text-astro-text/85">
                  {cleanText(moonImpact)}
                </p>
              </div>
            )}

            {transitFocus && (
              <div className="rounded-2xl border border-astro-border/70 bg-astro-bg/25 p-4">
                <h3 className="text-sm font-semibold text-astro-text">
                  {getText(language, 'horoscope.transit_focus_title')}
                </h3>
                <p className="mt-2 font-serif text-[15px] leading-relaxed text-astro-text/85">
                  {cleanText(transitFocus)}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

HoroscopeContent.displayName = 'HoroscopeContent';
