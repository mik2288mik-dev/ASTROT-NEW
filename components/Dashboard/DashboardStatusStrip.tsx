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
          className="w-full rounded-xl border border-dashed border-astro-border/50 bg-astro-card/40 px-4 py-2.5 text-center text-xs text-astro-subtext transition-colors hover:border-astro-highlight/30 hover:text-astro-text"
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
      <div className="rounded-xl border border-astro-border/35 bg-astro-card/50 px-4 py-2.5 text-center">
        <p className="text-[12px] leading-snug text-astro-subtext [text-wrap:balance]">{parts.join(' · ')}</p>
      </div>
    );
  }
);

DashboardStatusStrip.displayName = 'DashboardStatusStrip';
