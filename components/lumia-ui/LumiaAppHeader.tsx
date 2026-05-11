import React, { useEffect, useMemo, useState } from 'react';
import {
  motion,
  useReducedMotion,
  useMotionValueEvent,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
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

function LumiaCompactStoryItem({
  index,
  progress,
  label,
  imageSrc,
  active,
  locked,
  onClick,
}: {
  index: number;
  progress: MotionValue<number>;
  label: string;
  imageSrc: string;
  active?: boolean;
  locked?: boolean;
  onClick: () => void;
}) {
  const expandedOffsets = [-156, -78, 0, 78, 156];
  const compactOffsets = [-26, -13, 0, 13, 26];
  const collapsedOpacity = index < 3 ? 1 : index === 3 ? 0.66 : 0.38;
  const x = useTransform(progress, [0, 0.48, 1], [expandedOffsets[index] ?? 0, compactOffsets[index] ?? 0, compactOffsets[index] ?? 0]);
  const scale = useTransform(progress, [0, 0.42, 0.72, 1], [0.62, 0.68, 0.9, 1]);
  const opacity = useTransform(progress, [0, 0.34, 0.64, 1], [0, 0, 0.88, collapsedOpacity]);
  const y = useTransform(progress, [0, 0.64, 1], [18, 8, 0]);
  const zIndex = active ? 60 : 50 - index * 4;

  return (
    <motion.button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="lumia-app-mini-story-button"
      data-active={active ? 'true' : undefined}
      data-locked={locked ? 'true' : undefined}
      style={{ x, y, scale, opacity, zIndex }}
    >
      <img src={imageSrc} alt="" draggable={false} className="h-full w-full object-cover" />
      <span className="lumia-app-mini-story-wash" aria-hidden />
    </motion.button>
  );
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
  const progress = shouldReduceMotion ? rawProgress : smoothProgress;
  const staticExpandedProgress = useMotionValue(0);
  const clusterProgress = isDashboard ? progress : staticExpandedProgress;
  const [isCollapsed, setIsCollapsed] = useState(false);

  const headerBodyHeight = useTransform(progress, [0, 0.48, 1], [214, 138, 48]);
  const headerHeight = useTransform(headerBodyHeight, (latest) => `calc(var(--lumia-app-safe-top) + ${latest}px)`);
  const expandedOpacity = useTransform(progress, [0, 0.42, 0.78], [1, 0.4, 0]);
  const expandedY = useTransform(progress, [0, 1], [0, -42]);
  const expandedScale = useTransform(progress, [0, 1], [1, 0.9]);
  const actionOpacity = useTransform(progress, [0, 0.28, 0.58], [1, 0.32, 0]);
  const actionY = useTransform(progress, [0, 1], [0, -28]);
  const storiesOpacity = useTransform(progress, [0, 0.46, 0.78], [1, 0.48, 0]);
  const storiesY = useTransform(progress, [0, 0.52, 1], [0, -40, -78]);
  const storiesScale = useTransform(progress, [0, 0.62, 1], [1, 0.74, 0.46]);
  const storyLabelOpacity = useTransform(progress, [0, 0.18, 0.42], [1, 0.2, 0]);
  const miniOpacity = useTransform(progress, [0, 0.32, 0.68], [0, 0, 1]);
  const miniY = useTransform(progress, [0, 0.58, 1], [18, 8, 0]);
  const miniScale = useTransform(progress, [0, 0.62, 1], [0.88, 0.94, 1]);

  useMotionValueEvent(rawProgress, 'change', (latest) => {
    setIsCollapsed((current) => {
      const next = latest > 0.68;
      return current === next ? current : next;
    });
  });

  useEffect(() => {
    setIsCollapsed(rawProgress.get() > 0.68);
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
          className="lumia-app-compact-stories-rail"
          style={{ opacity: miniOpacity, y: miniY, scale: miniScale }}
        >
          <div className="lumia-app-mini-story-cluster">
            {stories.map((story, index) => (
              <LumiaCompactStoryItem
                key={story.id}
                index={index}
                progress={clusterProgress}
                label={story.label}
                imageSrc={story.imageSrc}
                active={activeStory === story.id}
                locked={story.locked}
                onClick={story.onClick}
              />
            ))}
          </div>
        </motion.div>
      </div>
    </motion.header>
  );
}
