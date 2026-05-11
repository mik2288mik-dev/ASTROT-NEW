import React, { useEffect, useMemo, useState } from 'react';
import {
  motion,
  useReducedMotion,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion';
import { Bell } from 'lucide-react';
import type { RefObject } from 'react';
import type { HoroscopeLayer, UserProfile, ViewState } from '../../types';
import { LumiaHomeIconButton, LumiaHomeStoryCircle } from '../Dashboard/LumiaHomePrimitives';
import { getLumiaHomeCopy, type LumiaHomeLanguage } from '../Dashboard/lumiaHomeContent';

type LumiaStoryId = 'today' | 'love' | 'money' | 'work' | 'rhythm';

type LumiaAppHeaderProps = {
  profile: UserProfile;
  view: ViewState;
  scrollContainerRef?: RefObject<HTMLDivElement | null>;
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

function getScreenTitle(profile: UserProfile, view: ViewState) {
  const language = profile.language === 'en' ? 'en' : 'ru';
  return SCREEN_TITLES[view]?.[language] || null;
}

export function LumiaAppHeader({
  profile,
  view,
  scrollContainerRef,
  onOpenSettings,
  onOpenHoroscopeLayer,
}: LumiaAppHeaderProps) {
  const language: LumiaHomeLanguage = profile.language === 'en' ? 'en' : 'ru';
  const copy = getLumiaHomeCopy(language);
  const initial = (profile.name || 'L').trim().slice(0, 1).toUpperCase();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const locked = !profile.isPremium;
  const screenTitle = getScreenTitle(profile, view);
  const activeStory: LumiaStoryId | null = view === 'dashboard' ? 'today' : null;
  const shouldReduceMotion = useReducedMotion();
  const isDashboard = view === 'dashboard' && !!scrollContainerRef;
  const { scrollY } = useScroll({
    container: scrollContainerRef as RefObject<HTMLElement | null> | undefined,
  });
  const rawProgress = useTransform(scrollY, [0, 150], [0, isDashboard ? 1 : 0], { clamp: true });
  const smoothProgress = useSpring(rawProgress, {
    stiffness: 360,
    damping: 44,
    mass: 0.85,
    restDelta: 0.001,
  });
  const visualProgress = shouldReduceMotion ? rawProgress : smoothProgress;
  const [isCollapsed, setIsCollapsed] = useState(false);

  const headerBodyHeight = useTransform(rawProgress, [0, 0.42, 1], [214, 150, 56]);
  const headerHeight = useTransform(headerBodyHeight, (latest) => `calc(var(--lumia-app-safe-top) + ${latest}px)`);
  const expandedOpacity = useTransform(visualProgress, [0, 0.34, 0.66], [1, 0.42, 0]);
  const expandedY = useTransform(visualProgress, [0, 1], [0, -38]);
  const expandedScale = useTransform(visualProgress, [0, 1], [1, 0.92]);
  const actionOpacity = useTransform(visualProgress, [0, 0.22, 0.52], [1, 0.35, 0]);
  const actionY = useTransform(visualProgress, [0, 1], [0, -28]);
  const storiesOpacity = useTransform(visualProgress, [0, 0.38, 0.68], [1, 0.52, 0]);
  const storiesY = useTransform(visualProgress, [0, 0.56, 1], [0, -28, -62]);
  const storiesScale = useTransform(visualProgress, [0, 0.64, 1], [1, 0.86, 0.74]);
  const storyLabelOpacity = useTransform(visualProgress, [0, 0.16, 0.38], [1, 0.18, 0]);
  const compactLogoOpacity = useTransform(visualProgress, [0, 0.48, 0.74], [0, 0, 1]);
  const compactLogoY = useTransform(visualProgress, [0, 1], [16, 0]);
  const compactLogoScale = useTransform(visualProgress, [0, 1], [0.92, 1]);

  useMotionValueEvent(rawProgress, 'change', (latest) => {
    setIsCollapsed((current) => {
      const next = latest > 0.62;
      return current === next ? current : next;
    });
  });

  useEffect(() => {
    setIsCollapsed(rawProgress.get() > 0.62);
  }, [rawProgress]);

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

  return (
    <motion.header
      className="lumia-app-header"
      data-view={view}
      data-collapsed={isCollapsed ? 'true' : undefined}
      style={{ height: headerHeight }}
    >
      <div className="lumia-app-header-canvas">
        <motion.div
          className="lumia-app-expanded-brand-layer"
          style={{ opacity: expandedOpacity, y: expandedY, scale: expandedScale }}
        >
          <div className="lumia-app-brand-center">
            <p className="lumia-app-logo">LUMIA</p>
            <p className="lumia-app-tagline">{copy.tagline}</p>
            {screenTitle ? <p className="lumia-app-screen-title">{screenTitle}</p> : null}
          </div>

          <motion.div
            className="lumia-app-header-actions"
            style={{ opacity: actionOpacity, y: actionY }}
          >
            <LumiaHomeIconButton aria-label={copy.notifications} onClick={onOpenSettings} className="lumia-app-action-button">
              <Bell size={18} strokeWidth={2.05} />
              <span className="lumia-home-notification-dot" aria-hidden />
            </LumiaHomeIconButton>
            <button type="button" onClick={onOpenSettings} aria-label={copy.settings} className="lumia-home-avatar-button lumia-app-avatar-button active:scale-[0.98]">
              {photoUrl ? <img src={photoUrl} alt="" className="h-full w-full object-cover" draggable={false} /> : initial}
            </button>
          </motion.div>
        </motion.div>

        <motion.div
          className="lumia-app-expanded-stories-layer"
          style={{ opacity: storiesOpacity, y: storiesY, scale: storiesScale, '--lumia-story-label-opacity': storyLabelOpacity } as any}
        >
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
        </motion.div>

        <motion.div
          className="lumia-app-compact-brand-layer"
          style={{ opacity: compactLogoOpacity, y: compactLogoY, scale: compactLogoScale }}
        >
          <p className="lumia-app-compact-logo">LUMIA</p>
        </motion.div>
      </div>
    </motion.header>
  );
}
