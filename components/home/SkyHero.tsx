import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import { skyPaletteForSunAltitude } from '../../lib/skyPalette';
import { LiveSky } from './LiveSky';
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
  /** A rounded card under the regular top bar (while the forecast loads). */
  compact?: boolean;
};

const HOME_CLOUDS = ['/assets/clouds/day.webp', '/assets/clouds/cumulus.webp', '/assets/clouds/cirrus.webp'];

/** The home cover: the real sky right now with today's date and the forecast on it. */
export function SkyHero({ dayKey, language, top, kicker, title, titleId, children, compact = false }: SkyHeroProps) {
  const sky = useSkyNow();
  const [year, month, day] = dayKey.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, (month || 1) - 1, day || 1)).getUTCDay();
  const ru = language === 'ru';
  const night = sky ? sky.sunAltitude < -6 : false;
  const heroRef = useRef<HTMLElement | null>(null);
  const [underBar, setUnderBar] = useState(true);
  // The glass bar is see-through: its ink follows the sky behind it, and goes dark again once the page scrolls under it.
  const zenith = sky ? skyPaletteForSunAltitude(sky.sunAltitude).colors[0] : [30, 90, 190];
  const lightSky = (0.2126 * zenith[0] + 0.7152 * zenith[1] + 0.0722 * zenith[2]) / 255 > 0.55;
  useEffect(() => {
    const node = heroRef.current;
    if (!node || typeof IntersectionObserver !== 'function') return undefined;
    const observer = new IntersectionObserver(
      (entries) => setUnderBar(entries.some((entry) => entry.isIntersecting)),
      { rootMargin: '-72px 0px 0px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  // The bar sits outside the hero, so its ink is set on the document.
  const barInk = underBar && !lightSky ? 'light' : null;
  useEffect(() => {
    if (!barInk) return undefined;
    document.documentElement.dataset.barInk = barInk;
    return () => { delete document.documentElement.dataset.barInk; };
  }, [barInk]);

  return (
    <section ref={heroRef} className={`sky-hero${night ? ' is-night' : ''}${compact ? ' is-compact' : ''}`} aria-labelledby={titleId}>
      {sky ? (
        <LiveSky sunAltitude={sky.sunAltitude} clouds={HOME_CLOUDS} className="sky-hero-canvas" />
      ) : null}
      {top}
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
