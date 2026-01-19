import React, { useMemo } from 'react';
import { ViewState } from '../types';
import { Theme, UserContext, ViewState } from '../types';
import bgDarkStars from '../ASTROT_ASSETS/backgrounds/bg_dark_stars.jpg.png';
import bgGoldNebula from '../ASTROT_ASSETS/backgrounds/bg_gold_nebula.jpg.png';
import bgMainDeepSpace from '../ASTROT_ASSETS/backgrounds/bg_main_deep_space.jpg.png';
import bgSoftGradient from '../ASTROT_ASSETS/backgrounds/bg_soft_gradient.jpg.png';
import bgVioletNebula from '../ASTROT_ASSETS/backgrounds/bg_violet_nebula.jpg.png';
import overlayGoldGlow from '../ASTROT_ASSETS/overlays/overlay_gold_glow.png.png';
import overlayLightRays from '../ASTROT_ASSETS/overlays/overlay_light_rays.png.png';
import overlaySoftFog from '../ASTROT_ASSETS/overlays/overlay_soft_fog.png.png';
import overlaySoftFog2 from '../ASTROT_ASSETS/overlays/overlay_soft_fog2.png.png';
import overlaySparkles from '../ASTROT_ASSETS/overlays/overlay_sparkles.png.png';
import overlayVioletGlow from '../ASTROT_ASSETS/overlays/overlay_violet_glow.png.png';

interface BackgroundLayersProps {
  view: ViewState;
  theme?: Theme;
  context?: UserContext | null;
}

type OverlayLayer = {
  src: string;
  opacity: number;
};

const BACKGROUND_BY_VIEW: Record<ViewState, string> = {
  onboarding: bgDarkStars,
  hook: bgVioletNebula,
  paywall: bgGoldNebula,
  dashboard: bgMainDeepSpace,
  chart: bgMainDeepSpace,
  horoscope: bgMainDeepSpace,
  synastry: bgMainDeepSpace,
  oracle: bgMainDeepSpace,
  settings: bgSoftGradient,
  admin: bgSoftGradient
};

const OVERLAYS_BY_VIEW: Partial<Record<ViewState, OverlayLayer[]>> = {
  onboarding: [
    { src: overlaySoftFog2, opacity: 0.18 },
    { src: overlaySparkles, opacity: 0.12 }
  ],
  hook: [
    { src: overlayVioletGlow, opacity: 0.2 },
    { src: overlaySparkles, opacity: 0.12 }
  ],
  paywall: [
    { src: overlayGoldGlow, opacity: 0.2 },
    { src: overlayLightRays, opacity: 0.12 }
  ],
  dashboard: [
    { src: overlaySoftFog, opacity: 0.16 },
    { src: overlayLightRays, opacity: 0.1 }
  ],
  chart: [{ src: overlayVioletGlow, opacity: 0.18 }],
  horoscope: [
    { src: overlaySparkles, opacity: 0.18 },
    { src: overlayVioletGlow, opacity: 0.1 }
  ],
  synastry: [
    { src: overlayVioletGlow, opacity: 0.18 },
    { src: overlaySparkles, opacity: 0.1 }
  ],
  oracle: [
    { src: overlayVioletGlow, opacity: 0.18 },
    { src: overlaySoftFog2, opacity: 0.12 }
  ],
  settings: [
    { src: overlayGoldGlow, opacity: 0.12 },
    { src: overlaySoftFog2, opacity: 0.1 }
  ],
  admin: [
    { src: overlayGoldGlow, opacity: 0.12 },
    { src: overlaySoftFog2, opacity: 0.1 }
  ]
};

export const BackgroundLayers: React.FC<BackgroundLayersProps> = ({ view }) => {
  const background = useMemo(() => BACKGROUND_BY_VIEW[view], [view]);
  const overlays = useMemo(() => OVERLAYS_BY_VIEW[view] ?? [], [view]);
  theme: Theme;
  view: ViewState;
  context?: UserContext | null;
}

const getBackgroundAsset = (theme: Theme, view: ViewState) => {
  if (view === 'hook') return bgVioletNebula;
  if (view === 'paywall') return bgGoldNebula;
  if (view === 'onboarding') return bgDarkStars;
  return theme === 'light' ? bgSoftGradient : bgMainDeepSpace;
};

const getOverlayAsset = (theme: Theme, context?: UserContext | null) => {
  const condition = context?.weatherData?.condition?.toLowerCase() || '';

  if (condition.includes('fog') || condition.includes('mist')) return overlaySoftFog2;
  if (condition.includes('rain') || condition.includes('drizzle') || condition.includes('storm')) return overlaySoftFog;
  if (condition.includes('snow')) return overlaySparkles;
  if (condition.includes('clear') || condition.includes('sun')) return overlayLightRays;
  if (condition.includes('cloud')) return overlaySparkles;

  return theme === 'light' ? overlayGoldGlow : overlayVioletGlow;
};

export const BackgroundLayers: React.FC<BackgroundLayersProps> = ({ theme, view, context }) => {
  const background = useMemo(() => getBackgroundAsset(theme, view), [theme, view]);
  const overlay = useMemo(() => getOverlayAsset(theme, context), [theme, context]);

  return (
    <div className="fixed inset-0 -z-10">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${background})` }}
      />
      {overlays.map((layer, index) => (
        <div
          key={`${layer.src}-${index}`}
          className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none"
          style={{ backgroundImage: `url(${layer.src})`, opacity: layer.opacity }}
        />
      ))}
      <div className="absolute inset-0 bg-astro-bg/65 pointer-events-none" />
      {overlay && (
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20"
          style={{ backgroundImage: `url(${overlay})` }}
        />
      )}
      <div className="absolute inset-0 bg-astro-bg/65" />
    </div>
  );
};
