import React, { memo } from 'react';
import { Language } from '../../types';

interface HoroscopeContentProps {
  content: string;
  moonImpact?: string;
  mood?: string;
  color?: string;
  language: Language;
}

export const HoroscopeContent = memo<HoroscopeContentProps>(({ 
  content, 
  moonImpact, 
  mood, 
  color, 
  language 
}) => {
  const paragraphs = content?.split('\n').filter((p: string) => p.trim()) || [];

  return (
    <div className="bg-astro-card rounded-2xl p-6 md:p-8 border border-astro-border shadow-sm">
      <div className="space-y-4 md:space-y-5">
        {/* Разбиваем текст на абзацы */}
        {paragraphs.map((paragraph: string, index: number) => (
          <p 
            key={index}
            className="card-text text-base md:text-[17px] text-astro-text"
            style={{ 
              lineHeight: '1.7',
              maxWidth: '65ch'
            }}
          >
            {paragraph.trim()}
          </p>
        ))}

        {/* Если есть дополнительная информация */}
        {moonImpact && (
          <div className="pt-5 mt-5 border-t border-astro-border/40">
            <h3 className="text-base md:text-lg font-semibold text-astro-text mb-3">
              {language === 'ru' ? 'Влияние Луны' : 'Moon Impact'}
            </h3>
            <p className="text-[15px] md:text-base text-astro-subtext" style={{ lineHeight: '1.6', maxWidth: '60ch' }}>
              {moonImpact}
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
