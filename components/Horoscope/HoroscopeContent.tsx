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
    <div className="bg-astro-card rounded-2xl p-6 border border-astro-border shadow-sm">
      <div className="max-w-[90%] mx-auto space-y-4">
        {/* Разбиваем текст на абзацы */}
        {paragraphs.map((paragraph: string, index: number) => (
          <p 
            key={index}
            className="text-[15px] leading-relaxed text-astro-text"
            style={{ lineHeight: '1.6' }}
          >
            {paragraph.trim()}
          </p>
        ))}

        {/* Если есть дополнительная информация */}
        {moonImpact && (
          <div className="pt-4 border-t border-astro-border/30">
            <h3 className="text-base font-semibold text-astro-text mb-2">
              {language === 'ru' ? 'Влияние Луны' : 'Moon Impact'}
            </h3>
            <p className="text-[14px] leading-relaxed text-astro-subtext">
              {moonImpact}
            </p>
          </div>
        )}

        {/* Настроение дня */}
        {mood && (
          <div className="flex items-center justify-center gap-4 pt-4">
            <div className="text-center">
              <p className="text-xs text-astro-subtext mb-1">
                {language === 'ru' ? 'Настроение' : 'Mood'}
              </p>
              <p className="text-base font-medium text-astro-text">
                {mood}
              </p>
            </div>
            {color && (
              <div className="text-center">
                <p className="text-xs text-astro-subtext mb-1">
                  {language === 'ru' ? 'Цвет дня' : 'Lucky Color'}
                </p>
                <p className="text-base font-medium text-astro-text">
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
