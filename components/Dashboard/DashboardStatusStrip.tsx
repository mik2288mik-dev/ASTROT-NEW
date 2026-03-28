import React, { memo } from 'react';
import { translateMoonPhaseLabel, translateWeatherCondition } from '../../lib/dashboard-weather-utils';

interface DashboardStatusStripProps {
  language: 'ru' | 'en';
  city?: string | null;
  temp?: number | null;
  condition?: string | null;
  moonPhase?: string | null;
  emptyHint: string;
  onOpenSettings?: () => void;
}

export const DashboardStatusStrip = memo<DashboardStatusStripProps>(
  ({ language, city, temp, condition, moonPhase, emptyHint, onOpenSettings }) => {
    const hasWeather = city != null && city !== '' && typeof temp === 'number';
    const moon = moonPhase ? translateMoonPhaseLabel(moonPhase, language) : null;
    const cond = condition ? translateWeatherCondition(condition, language) : null;

    if (!hasWeather && !moon) {
      return (
        <button
          type="button"
          onClick={onOpenSettings}
          className="w-full rounded-lg border border-dashed border-astro-border/40 bg-transparent px-3 py-2 text-center text-[11px] text-astro-subtext/90 transition-colors hover:border-astro-highlight/25 hover:text-astro-text"
        >
          {emptyHint}
        </button>
      );
    }

    const parts: string[] = [];
    if (hasWeather) {
      parts.push(city!);
      parts.push(`${Math.round(temp!)}°`);
      if (cond) parts.push(cond);
    }
    if (moon) parts.push(moon);

    return (
      <div className="rounded-lg border border-astro-border/25 bg-astro-card/35 px-3 py-2 text-center">
        <p className="text-[11px] leading-snug text-astro-subtext/85 [text-wrap:balance]">{parts.join(' · ')}</p>
      </div>
    );
  }
);

DashboardStatusStrip.displayName = 'DashboardStatusStrip';
