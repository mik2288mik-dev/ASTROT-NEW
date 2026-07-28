import React, { useEffect, useRef, useState } from 'react';

export type ForecastTopicNavigationSection = {
  id: string;
  title: string;
};

type ForecastTopicNavigationProps = {
  sections: ForecastTopicNavigationSection[];
  activeId?: string | null;
  compactVisible: boolean;
  language: 'ru' | 'en';
  onNavigate: (id: string) => void;
};

export function ForecastTopicNavigation({
  sections,
  activeId,
  compactVisible,
  language,
  onNavigate,
}: ForecastTopicNavigationProps) {
  const rowRef = useRef<HTMLDivElement | null>(null);
  const compactRef = useRef<HTMLDivElement | null>(null);
  const lastActiveRef = useRef<ForecastTopicNavigationSection | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const currentActive = sections.find((section) => section.id === activeId);
  if (currentActive) lastActiveRef.current = currentActive;
  const active = currentActive || lastActiveRef.current || sections[0];

  useEffect(() => {
    const row = rowRef.current;
    if (!row || !active) return;
    const target = Array.from(
      row.querySelectorAll<HTMLElement>('[data-forecast-topic]'),
    ).find((item) => item.dataset.forecastTopic === active.id);
    target?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    });
  }, [active]);

  useEffect(() => {
    if (!compactVisible) setMenuOpen(false);
  }, [compactVisible]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: PointerEvent) => {
      if (!compactRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [menuOpen]);

  if (!sections.length) return null;

  const navigate = (id: string) => {
    setMenuOpen(false);
    onNavigate(id);
  };

  return (
    <>
      <nav
        className="forecast-topic-navigation"
        aria-label={language === 'ru' ? 'Темы прогноза' : 'Forecast topics'}
      >
        <div ref={rowRef} className="forecast-topic-navigation-row">
          {sections.map((section) => (
            <button
              key={section.id}
              type="button"
              data-forecast-topic={section.id}
              className={section.id === active?.id ? 'is-active' : undefined}
              aria-current={section.id === active?.id ? 'location' : undefined}
              onClick={() => navigate(section.id)}
            >
              {section.title}
            </button>
          ))}
        </div>
      </nav>

      <div
        ref={compactRef}
        className={`forecast-topic-compact${compactVisible ? ' is-visible' : ''}`}
        aria-hidden={!compactVisible}
      >
        <button
          type="button"
          className="forecast-topic-compact-trigger"
          aria-expanded={menuOpen}
          tabIndex={compactVisible ? undefined : -1}
          onClick={() => setMenuOpen((current) => !current)}
        >
          <span>{language === 'ru' ? 'Сейчас:' : 'Now:'}</span>
          <strong>{active?.title}</strong>
          <span aria-hidden>·</span>
        </button>
        {menuOpen ? (
          <div
            className="forecast-topic-compact-menu"
            role="menu"
            aria-label={language === 'ru' ? 'Быстрый переход' : 'Quick navigation'}
          >
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                role="menuitem"
                className={section.id === active?.id ? 'is-active' : undefined}
                onClick={() => navigate(section.id)}
              >
                {section.title}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </>
  );
}
