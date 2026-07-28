import React, { useMemo } from 'react';
import {
  cardBackgroundStyle,
  getUniversalCardBackground,
} from '../../lib/cardBackgrounds';
import type {
  PersonalForecastPromoPlacement,
  PersonalForecastPromoProduct,
} from '../../lib/personalForecastPromo';

type ForecastPromotionProps = {
  placement: PersonalForecastPromoPlacement;
  userId: string;
  periodKey: string;
  language: 'ru' | 'en';
  onOpenNatal: () => void;
  onOpenCompatibility: () => void;
  onOpenZodiac: () => void;
};

const COPY: Record<
  'ru' | 'en',
  Record<PersonalForecastPromoProduct, {
    kicker: string;
    title: string;
    text: string;
    action: string;
  }>
> = {
  ru: {
    natal: {
      kicker: 'Натальная карта',
      title: 'Почему это проявляется именно так',
      text: 'Характер, сильные стороны и повторяющиеся сценарии — по карте рождения.',
      action: 'Открыть карту',
    },
    compatibility: {
      kicker: 'Совместимость',
      title: 'Что происходит между вами',
      text: 'Сравни две карты и посмотри, где вы совпадаете, а где расходятся ожидания.',
      action: 'Проверить пару',
    },
    zodiac: {
      kicker: 'Зодиак',
      title: 'Общий фон для твоего знака',
      text: 'Посмотри прогноз по знаку отдельно от личного расчёта.',
      action: 'Перейти в Зодиак',
    },
  },
  en: {
    natal: {
      kicker: 'Natal chart',
      title: 'Why this shows up this way',
      text: 'Character, strengths, and recurring patterns from your birth chart.',
      action: 'Open the chart',
    },
    compatibility: {
      kicker: 'Compatibility',
      title: 'What is happening between you',
      text: 'Compare two charts to see where you align and where expectations diverge.',
      action: 'Check a pair',
    },
    zodiac: {
      kicker: 'Zodiac',
      title: 'The shared backdrop for your sign',
      text: 'Read the sign forecast separately from your personal calculation.',
      action: 'Open Zodiac',
    },
  },
};

export function ForecastPromotion({
  placement,
  userId,
  periodKey,
  language,
  onOpenNatal,
  onOpenCompatibility,
  onOpenZodiac,
}: ForecastPromotionProps) {
  const background = useMemo(
    () => getUniversalCardBackground(placement.product, userId, periodKey),
    [periodKey, placement.product, userId],
  );
  const copy = COPY[language][placement.product];
  const open = placement.product === 'natal'
    ? onOpenNatal
    : placement.product === 'compatibility'
      ? onOpenCompatibility
      : onOpenZodiac;

  return (
    <aside
      className={[
        'forecast-feed-promo',
        `forecast-feed-promo--${placement.product}`,
        `forecast-feed-promo--${placement.format}`,
        background ? 'has-card-background' : '',
      ].filter(Boolean).join(' ')}
      style={cardBackgroundStyle(background)}
      aria-label={copy.kicker}
    >
      <span className="forecast-feed-promo-shade" aria-hidden />
      <div className="forecast-feed-promo-content">
        <p className="forecast-feed-promo-kicker">{copy.kicker}</p>
        <h3 className="forecast-feed-promo-title">{copy.title}</h3>
        <p className="forecast-feed-promo-text">{copy.text}</p>
        <button type="button" className="forecast-feed-promo-action" onClick={open}>
          {copy.action}
        </button>
      </div>
    </aside>
  );
}
