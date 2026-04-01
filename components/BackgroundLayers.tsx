import Image, { type StaticImageData } from 'next/image';
import React, { useMemo } from 'react';
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
  /** Warm white Studio AIR — no cosmic plates */
  lumiaAir?: boolean;
}

type OverlayLayer = {
  src: StaticImageData;
  opacity: number;
};

/** Distinct cosmic plates per main flow (muted by scrim so UI stays readable). */
const BACKGROUND_BY_VIEW: Record<ViewState, StaticImageData> = {
  onboarding: bgDarkStars,
  hook: bgVioletNebula,
  paywall: bgGoldNebula,
  dashboard: bgMainDeepSpace,
  chart: bgVioletNebula,
  horoscope: bgGoldNebula,
  synastry: bgVioletNebula,
  oracle: bgDarkStars,
  wallet: bgSoftGradient,
  settings: bgSoftGradient,
  admin: bgSoftGradient,
  charts: bgSoftGradient,
};

const OVERLAYS_BY_VIEW: Partial<Record<ViewState, OverlayLayer[]>> = {
  onboarding: [
    { src: overlaySoftFog2, opacity: 0.22 },
    { src: overlaySparkles, opacity: 0.14 },
  ],
  hook: [
    { src: overlayVioletGlow, opacity: 0.24 },
    { src: overlaySparkles, opacity: 0.14 },
  ],
  paywall: [
    { src: overlayGoldGlow, opacity: 0.22 },
    { src: overlayLightRays, opacity: 0.14 },
  ],
  dashboard: [
    { src: overlaySoftFog, opacity: 0.2 },
    { src: overlayLightRays, opacity: 0.12 },
  ],
  chart: [
    { src: overlayVioletGlow, opacity: 0.2 },
    { src: overlaySoftFog2, opacity: 0.1 },
  ],
  horoscope: [
    { src: overlayGoldGlow, opacity: 0.18 },
    { src: overlaySparkles, opacity: 0.14 },
  ],
  synastry: [
    { src: overlayVioletGlow, opacity: 0.2 },
    { src: overlayLightRays, opacity: 0.1 },
  ],
  oracle: [
    { src: overlaySoftFog2, opacity: 0.2 },
    { src: overlaySparkles, opacity: 0.12 },
  ],
  wallet: [
    { src: overlayGoldGlow, opacity: 0.14 },
    { src: overlaySoftFog2, opacity: 0.1 },
  ],
  settings: [
    { src: overlayGoldGlow, opacity: 0.14 },
    { src: overlaySoftFog2, opacity: 0.1 },
  ],
  admin: [
    { src: overlayGoldGlow, opacity: 0.14 },
    { src: overlaySoftFog2, opacity: 0.1 },
  ],
};

const getWeatherOverlay = (theme: Theme, context?: UserContext | null): StaticImageData | null => {
  const condition = context?.weatherData?.condition?.toLowerCase() || '';
  if (!condition) return null;

  if (condition.includes('fog') || condition.includes('mist')) return overlaySoftFog2;
  if (condition.includes('rain') || condition.includes('drizzle') || condition.includes('storm')) return overlaySoftFog;
  if (condition.includes('snow')) return overlaySparkles;
  if (condition.includes('clear') || condition.includes('sun')) return overlayLightRays;
  if (condition.includes('cloud')) return overlaySparkles;

  return theme === 'light' ? overlayGoldGlow : overlayVioletGlow;
};

export const BackgroundLayers: React.FC<BackgroundLayersProps> = ({
  theme = 'dark',
  view,
  context,
  lumiaAir = false,
}) => {
  const overlays = useMemo(() => OVERLAYS_BY_VIEW[view] ?? [], [view]);
  const weatherOverlay = useMemo(() => getWeatherOverlay(theme, context), [theme, context]);
  const background = useMemo(() => BACKGROUND_BY_VIEW[view], [view]);

  const isSoftShell = view === 'wallet' || view === 'settings' || view === 'admin';

  if (lumiaAir) {
    return <div className="fixed inset-0 -z-10 overflow-hidden bg-white" aria-hidden />;
  }

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 scale-105">
        <Image
          src={background}
          alt=""
          fill
          priority={view === 'onboarding' || view === 'paywall'}
          sizes="100vw"
          className="object-cover object-center"
        />
      </div>

      {overlays.map((layer, index) => (
        <div
          key={`${layer.src.src}-${index}`}
          className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${layer.src.src})`, opacity: layer.opacity }}
        />
      ))}

      {weatherOverlay && !isSoftShell && (
        <div
          className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat opacity-[0.14]"
          style={{ backgroundImage: `url(${weatherOverlay.src})` }}
        />
      )}

      {/* One frosted scrim: readable text, cosmos still visible (no double-stack like before) */}
      {theme === 'light' ? (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(245,242,235,0.82) 0%, rgba(245,242,235,0.58) 45%, rgba(245,242,235,0.72) 100%)',
          }}
        />
      ) : (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(5,5,5,0.42) 0%, rgba(5,5,5,0.18) 40%, rgba(5,5,5,0.48) 100%)',
          }}
        />
      )}

      {/* Subtle vignette so edges don’t compete with cards */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          boxShadow: theme === 'light' ? 'inset 0 0 120px rgba(60,47,47,0.08)' : 'inset 0 0 100px rgba(0,0,0,0.35)',
        }}
      />
    </div>
  );
};
