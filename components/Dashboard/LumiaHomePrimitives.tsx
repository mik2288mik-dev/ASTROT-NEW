import React from 'react';
import { cn } from '../../lib/cn';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

export function LumiaHomePrimaryButton({
  className,
  type = 'button',
  children,
  ...props
}: ButtonProps) {
  return (
    <button type={type} className={cn('lumia-home-primary-button', className)} {...props}>
      {children}
    </button>
  );
}

export function LumiaHomeSecondaryButton({
  className,
  type = 'button',
  children,
  ...props
}: ButtonProps) {
  return (
    <button type={type} className={cn('lumia-home-secondary-button', className)} {...props}>
      {children}
    </button>
  );
}

export function LumiaHomeIconButton({
  className,
  type = 'button',
  children,
  ...props
}: ButtonProps) {
  return (
    <button type={type} className={cn('lumia-home-icon-button', className)} {...props}>
      {children}
    </button>
  );
}

type LargeCardProps = React.HTMLAttributes<HTMLElement> & {
  children: React.ReactNode;
};

export function LumiaHomeLargeCard({ className, children, ...props }: LargeCardProps) {
  return (
    <section className={cn('lumia-home-large-card', className)} {...props}>
      {children}
    </section>
  );
}

type QuickActionCardProps = Omit<ButtonProps, 'children'> & {
  title: string;
  imageSrc: string;
  body?: string;
  videoSources?: ReadonlyArray<{
    src: string;
    poster: string;
  }>;
  active?: boolean;
};

export function LumiaHomeQuickActionCard({
  title,
  imageSrc,
  body,
  videoSources = [],
  active = false,
  className,
  type = 'button',
  ...props
}: QuickActionCardProps) {
  const rootRef = React.useRef<HTMLButtonElement | null>(null);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const [variantIndex, setVariantIndex] = React.useState(0);
  const [canLoadVideo, setCanLoadVideo] = React.useState(false);
  const [isVisible, setIsVisible] = React.useState(false);
  const selectedVideo = videoSources[variantIndex] || videoSources[0] || null;
  const posterSrc = selectedVideo?.poster || imageSrc;

  React.useEffect(() => {
    if (!videoSources.length) return;
    const now = new Date();
    const daySeed = Math.floor(
      Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86_400_000,
    );
    const titleSeed = Array.from(title).reduce((sum, char) => sum + char.charCodeAt(0), 0);
    setVariantIndex((daySeed + titleSeed) % videoSources.length);
  }, [title, videoSources]);

  React.useEffect(() => {
    const element = rootRef.current;
    if (!element || !selectedVideo) return;

    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const saveData = Boolean((navigator as any)?.connection?.saveData);
    if (prefersReducedMotion || saveData || !('IntersectionObserver' in window)) {
      setCanLoadVideo(false);
      setIsVisible(false);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.isIntersecting && entry.intersectionRatio >= 0.35;
        setIsVisible(visible);
        if (visible) setCanLoadVideo(true);
      },
      {
        root: null,
        rootMargin: '96px 48px',
        threshold: [0, 0.2, 0.35, 0.65],
      },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [selectedVideo]);

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video || !selectedVideo || !canLoadVideo) return;

    if (isVisible) {
      video.play().catch(() => {
        /* Poster remains visible when autoplay is blocked. */
      });
    } else {
      video.pause();
    }
  }, [canLoadVideo, isVisible, selectedVideo]);

  return (
    <button
      ref={rootRef}
      type={type}
      className={cn('lumia-home-quick-action-card', className)}
      data-active={active ? 'true' : undefined}
      aria-label={props['aria-label'] || title}
      {...props}
    >
      <img
        className="lumia-home-quick-action-image"
        src={posterSrc}
        alt=""
        draggable={false}
        loading="eager"
      />
      {selectedVideo ? (
        <video
          ref={videoRef}
          className="lumia-home-quick-action-video"
          src={canLoadVideo ? selectedVideo.src : undefined}
          poster={posterSrc}
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden
        />
      ) : null}
      <span className="lumia-home-quick-action-shade" aria-hidden />
      <span className="lumia-home-quick-action-copy">
        <span className="lumia-home-quick-action-title">{title}</span>
        {body ? <span className="lumia-home-quick-action-body">{body}</span> : null}
      </span>
    </button>
  );
}

type BottomNavItemProps = ButtonProps & {
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  center?: boolean;
};

export function LumiaHomeBottomNavItem({
  label,
  icon,
  active = false,
  center = false,
  className,
  type = 'button',
  ...props
}: BottomNavItemProps) {
  return (
    <button
      type={type}
      className={cn('lumia-home-bottom-nav-item', className)}
      data-active={active ? 'true' : undefined}
      data-center={center ? 'true' : undefined}
      aria-label={props['aria-label'] || label}
      {...props}
    >
      <span className="lumia-home-bottom-nav-icon" aria-hidden>
        {icon}
      </span>
      <span className="lumia-home-bottom-nav-label">{label}</span>
    </button>
  );
}
