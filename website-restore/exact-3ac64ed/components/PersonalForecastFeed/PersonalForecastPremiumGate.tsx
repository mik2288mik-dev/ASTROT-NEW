import React from 'react';
import type { PersonalForecastPeriod } from '../../lib/personalForecastContract';
import { NeboLogo } from '../brand/NeboLogo';

type PersonalForecastPremiumGateProps = {
  period: Exclude<PersonalForecastPeriod, 'day'>;
  language: 'ru' | 'en';
  onRequestPremium: () => void;
  canPromotePremium?: boolean;
};

const COPY = {
  ru: {
    week: {
      title: 'Хочешь узнать, какой будет неделя?',
      body: 'В Premium ты увидишь весь прогноз на неделю: что может порадовать и какие моменты потребуют больше внимания.',
      cta: 'Перейти в магазин',
    },
    month: {
      title: 'Хочешь узнать, каким будет месяц?',
      body: 'В Premium ты увидишь весь прогноз на месяц: что может сложиться удачно и какие моменты лучше не пропустить.',
      cta: 'Перейти в магазин',
    },
  },
  en: {
    week: {
      title: 'Want a look at your week?',
      body: 'With Premium, you will see the full forecast for the week: what may go well and which moments deserve more attention.',
      cta: 'Open Premium store',
    },
    month: {
      title: 'Want a look at your month?',
      body: 'With Premium, you will see the full forecast for the month: what may go well and which moments are worth noticing.',
      cta: 'Open Premium store',
    },
  },
} as const;

export function PersonalForecastPremiumGate({
  period,
  language,
  onRequestPremium,
  canPromotePremium = true,
}: PersonalForecastPremiumGateProps) {
  const copy = COPY[language][period];

  return (
    <section className="forecast-feed-status forecast-premium-gate" aria-live="polite">
      <h1>{copy.title}</h1>
      <p>{copy.body}</p>
      <NeboLogo
        decorative
        fullCloud
        size="standard"
        className="forecast-premium-gate-logo"
      />
      {canPromotePremium ? (
        <button
          type="button"
          className="forecast-premium-gate-cta"
          onClick={onRequestPremium}
        >
          {copy.cta}
        </button>
      ) : null}
    </section>
  );
}
