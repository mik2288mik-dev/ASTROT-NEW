import React, { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'tvoi-goroskop:show-astrology-details';
const CHANGE_EVENT = 'tvoi-goroskop:astrology-details-change';

type AstrologyDetailsChangeEvent = CustomEvent<boolean>;

export function useAstrologyDetailsPreference() {
  const [showAstrology, setShowAstrologyState] = useState(false);

  useEffect(() => {
    try {
      setShowAstrologyState(window.sessionStorage.getItem(STORAGE_KEY) === 'true');
    } catch {
      setShowAstrologyState(false);
    }

    const syncPreference = (event: Event) => {
      const next = (event as AstrologyDetailsChangeEvent).detail;
      if (typeof next === 'boolean') setShowAstrologyState(next);
    };
    window.addEventListener(CHANGE_EVENT, syncPreference);
    return () => window.removeEventListener(CHANGE_EVENT, syncPreference);
  }, []);

  const setShowAstrology = useCallback((next: boolean) => {
    setShowAstrologyState(next);
    try {
      window.sessionStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // Session storage can be unavailable in restricted webviews. Local state still works.
    }
    window.dispatchEvent(new CustomEvent<boolean>(CHANGE_EVENT, { detail: next }));
  }, []);

  return { showAstrology, setShowAstrology };
}

type AstrologyDetailsToggleProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  language?: 'ru' | 'en';
  className?: string;
};

export const AstrologyDetailsToggle: React.FC<AstrologyDetailsToggleProps> = ({
  checked,
  onChange,
  language = 'ru',
  className = '',
}) => {
  const label = language === 'ru' ? 'Астрологические пояснения' : 'Astrology details';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`astrology-details-toggle ${checked ? 'is-active' : ''} ${className}`.trim()}
      onClick={() => onChange(!checked)}
    >
      <span className="astrology-details-toggle-label">{label}</span>
      <span className="astrology-details-toggle-track" aria-hidden="true">
        <span className="astrology-details-toggle-thumb" />
      </span>
    </button>
  );
};
