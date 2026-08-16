import React from 'react';
import {
  readAiPersonalHoroscopeReading,
  type AiPersonalHoroscopePackage,
} from '../../lib/aiPersonalHoroscope';

type AiPersonalHoroscopeReadingProps = {
  horoscope: AiPersonalHoroscopePackage;
  lockedAdviceIndexes: ReadonlySet<number>;
  language: 'ru' | 'en';
  canPromotePremium: boolean;
  onRequestPremium: () => void;
};

export function AiPersonalHoroscopeReading({
  horoscope,
  lockedAdviceIndexes,
  language,
  canPromotePremium,
  onRequestPremium,
}: AiPersonalHoroscopeReadingProps) {
  const reading = readAiPersonalHoroscopeReading(horoscope);
  const hasLockedContinuation = lockedAdviceIndexes.size > 0;

  return (
    <article
      className="ai-personal-horoscope-reading"
      data-ai-personal-horoscope="true"
      data-period={horoscope.period}
      lang={language}
    >
      {reading.opening ? (
        <section
          className="ai-personal-horoscope-opening"
          aria-label={language === 'ru' ? 'Вход в период' : 'Opening'}
        >
          <p>{reading.opening}</p>
        </section>
      ) : null}

      {reading.forecast ? (
        <>
          <div className="ai-personal-horoscope-divider" aria-hidden>
            <span />
            <i />
            <span />
          </div>
          <section
            className="ai-personal-horoscope-forecast"
            aria-label={language === 'ru' ? 'Прогноз' : 'Forecast'}
          >
            <p>{reading.forecast}</p>
          </section>
        </>
      ) : null}

      {reading.advice.length ? (
        <>
          <div className="ai-personal-horoscope-divider" aria-hidden>
            <span />
            <i />
            <span />
          </div>
          <section
            className="ai-personal-horoscope-advice"
            aria-label={language === 'ru' ? 'Советы на период' : 'Advice'}
          >
            {reading.advice.map((advice, index) => (
              <p key={`${horoscope.periodKey}:advice:${index + 1}`}>{advice}</p>
            ))}
          </section>
        </>
      ) : null}

      {hasLockedContinuation && canPromotePremium ? (
        <section className="ai-personal-horoscope-premium" data-premium-inline-teaser="today">
          <p>
            {language === 'ru'
              ? 'Главное открыто. Остальные точные советы — в Premium.'
              : 'The main reading is open. The remaining direct advice is in Premium.'}
          </p>
          <button type="button" onClick={onRequestPremium}>
            {language === 'ru' ? 'Показать всё' : 'Show everything'}
          </button>
        </section>
      ) : null}
    </article>
  );
}
