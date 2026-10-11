import React, { useEffect, useRef, useState } from 'react';
import { apiUrl } from '../../services/apiClient';
import type { StoryScene } from '../../lib/stories/scenes';

/** Silent moving pictures and existing clips. Offscreen media rests on its poster. */
export function StoryInlineScene({ scene, paused }: { scene: StoryScene; paused: boolean }) {
  const host = useRef<HTMLSpanElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(false);
  const [seen, setSeen] = useState(false);
  const [foreground, setForeground] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
    setSeen(false);
    const node = host.current;
    if (!node || typeof IntersectionObserver !== 'function') { setVisible(true); setSeen(true); return; }
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(entry.isIntersecting);
      if (entry.isIntersecting) setSeen(true);
    }, { threshold: 0.01 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [scene.src]);

  useEffect(() => {
    const onVisibility = () => setForeground(!document.hidden);
    onVisibility();
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    const preference = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!preference) return;
    const update = () => setReducedMotion(preference.matches);
    update();
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);

  const active = visible && foreground && !paused && !reducedMotion && !failed;
  const playing = active && loaded;
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    if (active) void element.play().catch(() => setFailed(true));
    else element.pause();
  }, [active, seen, scene.src]);

  // Keep the reserved space stable if media fails, so the reader never loses their place.
  return (
    <span ref={host} className={`stories-scene is-${scene.side} is-${scene.kind}${failed ? ' is-failed' : ''}`}
      role="img" aria-label={scene.alt} data-playing={playing}>
      <img className="stories-scene-poster" src={apiUrl(scene.poster)} alt="" aria-hidden="true" loading="lazy" hidden={playing} />
      {scene.kind === 'image' && active ? <img className="stories-scene-motion" src={apiUrl(scene.src)} alt="" aria-hidden="true"
        onLoad={() => setLoaded(true)} onError={() => setFailed(true)} /> : null}
      {scene.kind === 'video' && seen && !failed ? <video ref={video} src={apiUrl(scene.src)} poster={apiUrl(scene.poster)} muted playsInline loop hidden={!playing}
        preload="metadata" disablePictureInPicture tabIndex={-1} aria-hidden="true"
        onLoadedData={() => setLoaded(true)} onError={() => setFailed(true)} /> : null}
    </span>
  );
}
