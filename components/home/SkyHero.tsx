import React, { type ReactNode } from 'react';
import { LiveSky, MoonCanvas } from './LiveSky';
import { useSkyNow } from './useSkyNow';

const MONTHS_GEN_RU = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const WEEKDAYS_RU = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

type SkyHeroProps = {
  /** Calendar day shown, YYYY-MM-DD in the user's zone. */
  dayKey: string;
  language: 'ru' | 'en';
  /** The top bar, drawn over the sky. */
  top?: ReactNode;
  kicker: string;
  title?: string;
  titleId?: string;
  children?: ReactNode;
  /** Tap on the Moon: scroll to «Небо сегодня». */
  onMoon?: () => void;
  /** A rounded card under the regular top bar (while the forecast loads). */
  compact?: boolean;
};

const HOME_CLOUDS = ['/assets/clouds/day.webp', '/assets/clouds/cumulus.webp', '/assets/clouds/cirrus.webp'];

/** The home cover: the real sky right now with today's date and the forecast on it. */
export function SkyHero({ dayKey, language, top, kicker, title, titleId, children, onMoon, compact = false }: SkyHeroProps) {
  const sky = useSkyNow();
  const [year, month, day] = dayKey.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, (month || 1) - 1, day || 1)).getUTCDay();
  const ru = language === 'ru';
  const night = sky ? sky.sunAltitude < -6 : false;

  return (
    <section className={`sky-hero${night ? ' is-night' : ''}${compact ? ' is-compact' : ''}`} aria-labelledby={titleId}>
      {sky ? (
        <LiveSky sunAltitude={sky.sunAltitude} clouds={HOME_CLOUDS} className="sky-hero-canvas" />
      ) : null}
      {top}
      <button
        type="button"
        className="sky-hero-moon"
        onClick={onMoon}
        aria-label={sky ? (ru ? `Луна сейчас: ${sky.moonIllumination}%. Подробнее` : `Moon now: ${sky.moonIllumination}%. More`) : (ru ? 'Луна' : 'Moon')}
      >
        {sky ? <MoonCanvas phase={sky.moonPhase} night={night} className="sky-hero-moon-canvas" /> : null}
      </button>
      <div className="sky-hero-content">
        <p className="sky-hero-date">
          <b>{day}</b>
          <span>{ru ? MONTHS_GEN_RU[month - 1] : MONTHS_EN[month - 1]}<br />{ru ? WEEKDAYS_RU[weekday] : WEEKDAYS_EN[weekday]}</span>
        </p>
        <p className="sky-hero-kicker">{kicker}</p>
        {title ? <h1 id={titleId} className="sky-hero-title">{title}</h1> : null}
        {children}
      </div>
    </section>
  );
}
