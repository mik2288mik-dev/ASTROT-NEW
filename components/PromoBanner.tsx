import React, { useMemo } from 'react';
import {
  selectPromoBanner,
  type PromoBannerCategory,
  type PromoBannerLayout,
} from '../lib/promoBannerManifest';

type PromoBannerProps = {
  category: PromoBannerCategory;
  userId: string;
  dayKey: string;
  placementKey: string;
  language: 'ru' | 'en';
  layout?: PromoBannerLayout;
  onOpen: () => void;
};

const LABELS: Record<
  'ru' | 'en',
  Record<PromoBannerCategory, string>
> = {
  ru: {
    natal: 'Открыть натальную карту',
    compatibility: 'Открыть совместимость',
    zodiac: 'Открыть гороскоп по знакам зодиака',
  },
  en: {
    natal: 'Open natal chart',
    compatibility: 'Open compatibility',
    zodiac: 'Open zodiac horoscope',
  },
};

export function PromoBanner({
  category,
  userId,
  dayKey,
  placementKey,
  language,
  layout = 'standalone',
  onOpen,
}: PromoBannerProps) {
  const banner = useMemo(
    () => selectPromoBanner({
      category,
      userId,
      dayKey,
      placementKey,
      layout,
    }),
    [category, dayKey, layout, placementKey, userId],
  );
  const mobileRatio = banner.responsiveVersions.mobile.width
    / banner.responsiveVersions.mobile.height;
  const shape = mobileRatio < 1.15
    ? 'square'
    : mobileRatio < 1.55
      ? 'compact'
      : 'wide';

  return (
    <aside
      className={[
        'forecast-feed-promo-space',
        `forecast-feed-promo-space--${layout}`,
      ].join(' ')}
    >
      <button
        type="button"
        className={[
          'forecast-feed-promo',
          `forecast-feed-promo--${category}`,
          `forecast-feed-promo--layout-${layout}`,
        ].join(' ')}
        aria-label={LABELS[language][category]}
        data-banner-id={banner.id}
        data-banner-route={banner.targetRoute}
        data-banner-shape={shape}
        data-banner-layout={layout}
        onClick={onOpen}
      >
        <picture>
          <source
            media="(max-width: 640px)"
            srcSet={banner.responsiveVersions.mobile.filename}
            width={banner.responsiveVersions.mobile.width}
            height={banner.responsiveVersions.mobile.height}
          />
          <img
            src={banner.responsiveVersions.desktop.filename}
            width={banner.responsiveVersions.desktop.width}
            height={banner.responsiveVersions.desktop.height}
            alt=""
            loading="lazy"
            decoding="async"
          />
        </picture>
      </button>
    </aside>
  );
}
