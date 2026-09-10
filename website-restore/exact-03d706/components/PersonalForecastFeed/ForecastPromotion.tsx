import React from 'react';
import { PromoBanner } from '../PromoBanner';
import type {
  PersonalForecastPromoPlacement,
} from '../../lib/personalForecastPromo';
import type { PromoBannerLayout } from '../../lib/promoBannerManifest';

type ForecastPromotionProps = {
  placement: PersonalForecastPromoPlacement;
  userId: string;
  periodKey: string;
  dayKey: string;
  language: 'ru' | 'en';
  layout: PromoBannerLayout;
  onOpenNatal: () => void;
  onOpenCompatibility: () => void;
  onOpenZodiac: () => void;
};

export function ForecastPromotion({
  placement,
  userId,
  periodKey,
  dayKey,
  language,
  layout,
  onOpenNatal,
  onOpenCompatibility,
  onOpenZodiac,
}: ForecastPromotionProps) {
  const open = placement.product === 'natal'
    ? onOpenNatal
    : placement.product === 'compatibility'
      ? onOpenCompatibility
      : onOpenZodiac;

  return (
    <PromoBanner
      category={placement.product}
      userId={userId}
      dayKey={dayKey}
      placementKey={`${periodKey}:${placement.id}`}
      language={language}
      layout={layout}
      onOpen={open}
    />
  );
}
