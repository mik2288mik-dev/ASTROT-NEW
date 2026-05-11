import React, { useEffect, useMemo, useState } from 'react';
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'framer-motion';
import { Bell } from 'lucide-react';
import type { HoroscopeLayer, UserProfile } from '../../types';
import { LumiaHomeIconButton, LumiaHomeStoryCircle } from '../Dashboard/LumiaHomePrimitives';
import { getLumiaHomeCopy, type LumiaHomeLanguage } from '../Dashboard/lumiaHomeContent';

type CollapsibleHomeHeaderProps = {
  profile: UserProfile;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  onOpenSettings: () => void;
  onOpenHoroscopeLayer: (layer: HoroscopeLayer) => void;
};

const HOME_HEADER_COLLAPSE_DISTANCE = 96;

function clampProgress(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function CollapsibleHomeHeader({
  profile,
  scrollRef,
  onOpenSettings,
  onOpenHoroscopeLayer,
}: CollapsibleHomeHeaderProps) {
  const language: LumiaHomeLanguage = profile.language === 'en' ? 'en' : 'ru';
  const copy = getLumiaHomeCopy(language);
  const shouldReduceMotion = useReducedMotion();
  const progressValue = useMotionValue(0);
  const visualProgress = useSpring(progressValue, {
    stiffness: 380,
    damping: 42,
    mass: 0.82,
    restDelta: 0.001,
  });
  const progress = shouldReduceMotion ? progressValue : visualProgress;
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const initial = (profile.name || 'L').trim().slice(0, 1).toUpperCase();
  const locked = !profile.isPremium;

  useEffect(() => {
    const node = scrollRef?.current;
    if (!node) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      progressValue.set(clampProgress(node.scrollTop / HOME_HEADER_COLLAPSE_DISTANCE));
    };
    const requestUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    update();
    node.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      node.removeEventListener('scroll', requestUpdate);
      window.removeEventListener('resize', requestUpdate);
    };
  }, [progressValue, scrollRef]);

  useEffect(() => {
    try {
      const tgUser = (window as any)?.Telegram?.WebApp?.initDataUnsafe?.user;
      setPhotoUrl(typeof tgUser?.photo_url === 'string' ? tgUser.photo_url : null);
    } catch {
      setPhotoUrl(null);
    }
  }, []);

  const headerBodyHeight = useTransform(progressValue, [0, 1], [202, 58]);
  const headerHeight = useTransform(
    headerBodyHeight,
    (latest) => `calc(var(--lumia-home-content-safe-top) + ${latest}px)`
  );
  const solidOpacity = useTransform(progress, [0, 0.5, 1], [0, 0.64, 1]);
  const expandedOpacity = useTransform(progress, [0, 0.42, 0.78], [1, 0.32, 0]);
  const expandedY = useTransform(progress, [0, 1], [0, -22]);
  const expandedScale = useTransform(progress, [0, 1], [1, 0.92]);
  const compactOpacity = useTransform(progress, [0, 0.42, 0.78], [0, 0.22, 1]);
  const compactY = useTransform(progress, [0, 1], [12, 0]);
  const compactScale = useTransform(progress, [0, 1], [0.92, 1]);
  const storiesOpacity = useTransform(progress, [0, 0.34, 0.72], [1, 0.42, 0]);
  const storiesY = useTransform(progress, [0, 1], [0, -18]);
  const storiesScale = useTransform(progress, [0, 1], [1, 0.94]);
  const labelOpacity = useTransform(progress, [0, 0.24, 0.54], [1, 0.2, 0]);

  const stories = useMemo(
    () => [
      {
        id: 'today',
        label: copy.stories.today,
        imageSrc: '/natal-gateway/daily-horoscope-v2.webp',
        locked: false,
        onClick: () => onOpenHoroscopeLayer('sign'),
      },
      {
        id: 'love',
        label: copy.stories.love,
        imageSrc: '/natal-gateway/synastry-union-v2.webp',
        locked,
        onClick: () => onOpenHoroscopeLayer('love'),
      },
      {
        id: 'money',
        label: copy.stories.money,
        imageSrc: '/natal-backgrounds/work-money.webp',
        locked,
        onClick: () => onOpenHoroscopeLayer('work_money'),
      },
      {
        id: 'work',
        label: copy.stories.work,
        imageSrc: '/natal-gateway/personality-map-v2.webp',
        locked,
        onClick: () => onOpenHoroscopeLayer('work_money'),
      },
      {
        id: 'rhythm',
        label: copy.stories.rhythm,
        imageSrc: '/natal-backgrounds/daily.webp',
        locked,
        onClick: () => onOpenHoroscopeLayer('chart'),
      },
    ],
    [copy.stories.love, copy.stories.money, copy.stories.rhythm, copy.stories.today, copy.stories.work, locked, onOpenHoroscopeLayer]
  );

  return (
    <motion.header className="lumia-home-collapsible-header" style={{ height: headerHeight }}>
      <motion.div className="lumia-home-header-solid" style={{ opacity: solidOpacity }} aria-hidden />

      <motion.div
        className="lumia-home-compact-brand-row"
        style={{ opacity: compactOpacity, y: compactY, scale: compactScale }}
      >
        <p className="lumia-home-compact-wordmark">LUMIA</p>
        <div className="lumia-home-compact-actions">
          <LumiaHomeIconButton aria-label={copy.notifications} onClick={onOpenSettings} className="lumia-home-header-icon-button">
            <Bell size={17} strokeWidth={2.05} />
            <span className="lumia-home-notification-dot" aria-hidden />
          </LumiaHomeIconButton>
          <button type="button" onClick={onOpenSettings} aria-label={copy.settings} className="lumia-home-avatar-button lumia-home-header-avatar-button active:scale-[0.98]">
            {photoUrl ? <img src={photoUrl} alt="" className="h-full w-full object-cover" draggable={false} /> : initial}
          </button>
        </div>
      </motion.div>

      <motion.div
        className="lumia-home-expanded-brand-row"
        style={{ opacity: expandedOpacity, y: expandedY, scale: expandedScale }}
      >
        <div className="lumia-home-expanded-brand-center">
          <p className="lumia-home-expanded-wordmark">LUMIA</p>
          <p className="lumia-home-expanded-tagline">{copy.tagline}</p>
        </div>
        <div className="lumia-home-expanded-actions">
          <LumiaHomeIconButton aria-label={copy.notifications} onClick={onOpenSettings} className="lumia-home-header-icon-button">
            <Bell size={17} strokeWidth={2.05} />
            <span className="lumia-home-notification-dot" aria-hidden />
          </LumiaHomeIconButton>
          <button type="button" onClick={onOpenSettings} aria-label={copy.settings} className="lumia-home-avatar-button lumia-home-header-avatar-button active:scale-[0.98]">
            {photoUrl ? <img src={photoUrl} alt="" className="h-full w-full object-cover" draggable={false} /> : initial}
          </button>
        </div>
      </motion.div>

      <motion.div
        className="lumia-home-stories-layer"
        style={{ opacity: storiesOpacity, y: storiesY, scale: storiesScale, '--lumia-story-label-opacity': labelOpacity } as any}
      >
        <div className="scrollbar-hide lumia-home-stories-scroll">
          {stories.map((story) => (
            <LumiaHomeStoryCircle
              key={story.id}
              label={story.label}
              imageSrc={story.imageSrc}
              active={story.id === 'today'}
              locked={story.locked}
              onClick={story.onClick}
            />
          ))}
        </div>
      </motion.div>
    </motion.header>
  );
}
