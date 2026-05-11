import React, { useEffect, useMemo, useState } from 'react';
import { Bell } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { HoroscopeLayer, UserProfile, ViewState } from '../../types';
import { LumiaHomeIconButton, LumiaHomeStoryCircle } from '../Dashboard/LumiaHomePrimitives';
import { getLumiaHomeCopy, type LumiaHomeLanguage } from '../Dashboard/lumiaHomeContent';

type LumiaStoryId = 'today' | 'love' | 'money' | 'work' | 'rhythm';

type LumiaAppHeaderProps = {
  profile: UserProfile;
  view: ViewState;
  collapseProgress?: number;
  onOpenSettings: () => void;
  onOpenHoroscopeLayer: (layer: HoroscopeLayer) => void;
};

const SCREEN_TITLES: Partial<Record<ViewState, { ru: string; en: string }>> = {
  chart: { ru: 'Натальная карта', en: 'Natal Chart' },
  charts: { ru: 'Мои карты', en: 'My Charts' },
  settings: { ru: 'Настройки', en: 'Settings' },
  synastry: { ru: 'Союз', en: 'Union' },
  oracle: { ru: 'Дневник', en: 'Diary' },
  wallet: { ru: 'Магазин', en: 'Store' },
  admin: { ru: 'Админ-панель', en: 'Admin Panel' },
};

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function getScreenTitle(profile: UserProfile, view: ViewState) {
  const language = profile.language === 'en' ? 'en' : 'ru';
  return SCREEN_TITLES[view]?.[language] || null;
}

export function LumiaAppHeader({
  profile,
  view,
  collapseProgress = 0,
  onOpenSettings,
  onOpenHoroscopeLayer,
}: LumiaAppHeaderProps) {
  const language: LumiaHomeLanguage = profile.language === 'en' ? 'en' : 'ru';
  const copy = getLumiaHomeCopy(language);
  const progress = clamp01(collapseProgress);
  const initial = (profile.name || 'L').trim().slice(0, 1).toUpperCase();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const locked = !profile.isPremium;
  const screenTitle = getScreenTitle(profile, view);
  const activeStory: LumiaStoryId | null = view === 'dashboard' ? 'today' : null;

  useEffect(() => {
    try {
      const tgUser = (window as any)?.Telegram?.WebApp?.initDataUnsafe?.user;
      setPhotoUrl(typeof tgUser?.photo_url === 'string' ? tgUser.photo_url : null);
    } catch {
      setPhotoUrl(null);
    }
  }, []);

  const stories = useMemo(
    () => [
      {
        id: 'today' as const,
        label: copy.stories.today,
        imageSrc: '/natal-gateway/daily-horoscope-v2.webp',
        locked: false,
        onClick: () => onOpenHoroscopeLayer('sign'),
      },
      {
        id: 'love' as const,
        label: copy.stories.love,
        imageSrc: '/natal-gateway/synastry-union-v2.webp',
        locked,
        onClick: () => onOpenHoroscopeLayer('love'),
      },
      {
        id: 'money' as const,
        label: copy.stories.money,
        imageSrc: '/natal-backgrounds/work-money.webp',
        locked,
        onClick: () => onOpenHoroscopeLayer('work_money'),
      },
      {
        id: 'work' as const,
        label: copy.stories.work,
        imageSrc: '/natal-gateway/personality-map-v2.webp',
        locked,
        onClick: () => onOpenHoroscopeLayer('work_money'),
      },
      {
        id: 'rhythm' as const,
        label: copy.stories.rhythm,
        imageSrc: '/natal-backgrounds/daily.webp',
        locked,
        onClick: () => onOpenHoroscopeLayer('chart'),
      },
    ],
    [copy.stories.love, copy.stories.money, copy.stories.rhythm, copy.stories.today, copy.stories.work, locked, onOpenHoroscopeLayer]
  );

  const headerStyle = {
    '--lumia-app-collapse': progress,
  } as CSSProperties;
  const logoStyle: CSSProperties = {
    fontSize: `${2.9 - progress * 0.88}rem`,
    transform: `translateY(${-progress * 2}px)`,
  };
  const taglineStyle: CSSProperties = {
    opacity: Math.max(0, 1 - progress * 1.35),
    maxHeight: `${Math.max(0, (1 - progress) * 16)}px`,
    marginTop: `${Math.max(0, (1 - progress) * 8)}px`,
  };
  const titleStyle: CSSProperties = {
    opacity: Math.max(0, 1 - progress * 1.25),
    maxHeight: `${screenTitle ? Math.max(0, (1 - progress) * 24) : 0}px`,
    marginTop: `${screenTitle ? Math.max(0, (1 - progress) * 8) : 0}px`,
  };
  const storiesStyle: CSSProperties = {
    opacity: Math.max(0, 1 - progress * 1.15),
    maxHeight: `${Math.max(0, (1 - progress) * 124)}px`,
    transform: `translateY(${-progress * 12}px) scale(${1 - progress * 0.04})`,
  };

  return (
    <header
      className="lumia-app-header"
      data-view={view}
      data-collapsed={progress > 0.72 ? 'true' : undefined}
      style={headerStyle}
    >
      <div className="lumia-app-header-inner">
        <div className="lumia-app-brand-grid">
          <div aria-hidden className="lumia-app-header-side" />

          <div className="lumia-app-brand-center">
            <p className="lumia-app-logo" style={logoStyle}>
              LUMIA
            </p>
            <p className="lumia-app-tagline" style={taglineStyle}>
              {copy.tagline}
            </p>
          </div>

          <div className="lumia-app-header-actions">
            <LumiaHomeIconButton
              aria-label={copy.notifications}
              onClick={onOpenSettings}
              className="lumia-app-action-button"
            >
              <Bell size={18} strokeWidth={2.05} />
              <span className="lumia-home-notification-dot" aria-hidden />
            </LumiaHomeIconButton>
            <button
              type="button"
              onClick={onOpenSettings}
              aria-label={copy.settings}
              className="lumia-home-avatar-button lumia-app-avatar-button active:scale-[0.98]"
            >
              {photoUrl ? (
                <img src={photoUrl} alt="" className="h-full w-full object-cover" draggable={false} />
              ) : (
                initial
              )}
            </button>
          </div>
        </div>

        {screenTitle ? (
          <p className="lumia-app-screen-title" style={titleStyle}>
            {screenTitle}
          </p>
        ) : null}

        <div className="lumia-app-stories-shell" style={storiesStyle}>
          <div className="scrollbar-hide lumia-app-stories-scroll">
            {stories.map((story) => (
              <LumiaHomeStoryCircle
                key={story.id}
                label={story.label}
                imageSrc={story.imageSrc}
                active={activeStory === story.id}
                locked={story.locked}
                onClick={story.onClick}
              />
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}
