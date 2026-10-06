import React, { useEffect, useRef, useState } from 'react';
import { apiUrl } from '../../services/apiClient';
import { videoBackgroundPath, videoBackgroundPoster, type VideoBackgroundId } from '../../lib/videoBackgrounds';

type VideoBackgroundProps = {
  id: VideoBackgroundId;
  className?: string;
  /** `bottom` darkens the lower part under light text, `light` veils the whole clip under dark text. */
  scrim?: 'bottom' | 'light' | 'none';
  /** Show the poster only, never the clip. */
  still?: boolean;
};

type ConnectionInfo = { saveData?: boolean; effectiveType?: string };

/** The poster alone is shown on a data saver or a very slow connection. The system's «less animation» switch is not
    followed here: these muted backgrounds are the look of the screens. */
function motionAllowed(): boolean {
  if (typeof window === 'undefined') return false;
  const connection = (navigator as Navigator & { connection?: ConnectionInfo }).connection;
  if (connection?.saveData) return false;
  if (connection?.effectiveType === 'slow-2g' || connection?.effectiveType === '2g') return false;
  return true;
}

/**
 * A muted, looping video behind a screen. The poster is drawn at once. The
 * clip is requested only after the block has been on screen, plays only while
 * it is on screen, and quietly gives way to the poster if it cannot load.
 */
export function VideoBackground({ id, className, scrim = 'bottom', still = false }: VideoBackgroundProps) {
  const host = useRef<HTMLSpanElement | null>(null);
  const video = useRef<HTMLVideoElement | null>(null);
  const [motion, setMotion] = useState(false);
  const [seen, setSeen] = useState(false);
  const [inView, setInView] = useState(true);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setMotion(motionAllowed());
  }, []);

  useEffect(() => {
    setReady(false);
    setFailed(false);
    setSeen(false);
  }, [id]);

  useEffect(() => {
    const node = host.current;
    if (!node || typeof IntersectionObserver !== 'function') { setSeen(true); return undefined; }
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.some((entry) => entry.isIntersecting);
      setInView(visible);
      if (visible) setSeen(true);
    }, { threshold: 0.05 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [id]);

  const showVideo = motion && seen && !failed && !still;
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    if (inView && !document.hidden) void element.play().catch(() => undefined);
    else element.pause();
  }, [inView, showVideo]);

  useEffect(() => {
    const onVisibility = () => {
      const element = video.current;
      if (!element) return;
      if (document.hidden || !inView) element.pause();
      else void element.play().catch(() => undefined);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [inView]);

  return (
    <span ref={host} className={['video-bg', `is-scrim-${scrim}`, className].filter(Boolean).join(' ')} aria-hidden="true">
      <img className="video-bg-poster" src={videoBackgroundPoster(id)} alt="" decoding="async" draggable={false} />
      {showVideo ? (
        <video
          key={id}
          ref={video}
          className={`video-bg-clip${ready ? ' is-ready' : ''}`}
          src={apiUrl(videoBackgroundPath(id))}
          poster={videoBackgroundPoster(id)}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          disablePictureInPicture
          tabIndex={-1}
          onPlaying={() => setReady(true)}
          onError={() => setFailed(true)}
        />
      ) : null}
      {scrim === 'none' ? null : <span className="video-bg-scrim" />}
    </span>
  );
}
