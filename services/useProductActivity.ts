import { useEffect, useRef } from 'react';
import { apiFetch } from './apiClient';
import { getTelegramInitDataHeaders, recordUserAppEvent, setProductActivitySessionId } from './sessionService';
import {
  ACTIVITY_HEARTBEAT_MS, ACTIVITY_IDLE_MS, ACTIVITY_VISIT_GAP_MS,
  activityScreen, foregroundIntervalMs, type ActivityPulse,
} from '../lib/productActivity';

function uuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Mount once after authentication. accountKey resets telemetry locally; it is never sent as identity. */
export function useProductActivity({ enabled, accountKey, screen }: {
  enabled: boolean; accountKey: string | number | null | undefined; screen: string;
}): void {
  const screenRef = useRef(activityScreen(screen));
  const screenChanged = useRef<((next: ReturnType<typeof activityScreen>) => void) | null>(null);
  useEffect(() => {
    if (!enabled || accountKey == null || typeof window === 'undefined') return;
    let sessionId = uuid();
    let sequence = 0;
    let totalActiveMs = 0;
    let lastInteraction = performance.now();
    let lastMeasured = lastInteraction;
    let lastForeground = lastInteraction;
    let foreground = document.visibilityState === 'visible' && document.hasFocus();
    let stopped = false;
    let inFlight = false;
    let pending: ActivityPulse | null = null;
    let lastScreen: string | null = null;
    const controllers = new Set<AbortController>();
    setProductActivitySessionId(sessionId);

    const send = async (pulse: ActivityPulse, keepalive = false) => {
      if (stopped) return;
      if (inFlight && !keepalive) { pending = pulse; return; }
      inFlight = true;
      const controller = new AbortController();
      controllers.add(controller);
      try {
        await apiFetch('/api/users/activity', {
          method: 'POST', credentials: 'include', keepalive, signal: controller.signal,
          headers: { 'Content-Type': 'application/json', ...getTelegramInitDataHeaders() },
          body: JSON.stringify(pulse),
        }, 10_000);
      } catch { /* A failed interval is not fabricated or replayed under a later account. */ }
      finally {
        controllers.delete(controller);
        inFlight = false;
        const next = pending;
        pending = null;
        if (next && !stopped) void send(next);
      }
    };
    const measure = () => {
      const now = performance.now();
      totalActiveMs += Math.floor(foregroundIntervalMs(lastMeasured, now, lastInteraction, foreground));
      lastMeasured = now;
    };
    const flush = (state?: ActivityPulse['state'], keepalive = false) => {
      measure();
      if (!foreground && sequence === 0) return;
      void send({ sessionId, eventId: uuid(), sequence: sequence++, totalActiveMs,
        screen: screenRef.current, state: state || (!foreground ? 'hidden'
          : performance.now() - lastInteraction >= ACTIVITY_IDLE_MS ? 'idle' : 'active') }, keepalive);
    };
    const screenView = () => {
      const nextScreen = screenRef.current;
      if (!foreground || !nextScreen || nextScreen === lastScreen) return;
      lastScreen = nextScreen;
      void recordUserAppEvent({ eventType: 'screen_view', section: nextScreen, source: 'app' });
    };
    const resume = () => {
      measure();
      const now = performance.now();
      const nextForeground = document.visibilityState === 'visible' && document.hasFocus();
      if (nextForeground && !foreground) {
        if (now - Math.max(lastInteraction, lastForeground) >= ACTIVITY_VISIT_GAP_MS) {
          sessionId = uuid(); sequence = 0; totalActiveMs = 0; lastScreen = null;
          setProductActivitySessionId(sessionId);
        }
        lastInteraction = now;
      }
      if (foreground) lastForeground = now;
      foreground = nextForeground;
      flush();
      screenView();
    };
    const interact = () => {
      measure();
      const now = performance.now();
      if (foreground && now - lastInteraction >= ACTIVITY_VISIT_GAP_MS) {
        flush('idle');
        sessionId = uuid(); sequence = 0; totalActiveMs = 0; lastScreen = null;
        setProductActivitySessionId(sessionId);
        flush('active');
      }
      lastInteraction = now;
      screenView();
    };
    const pagehide = () => { flush('closed', true); foreground = false; };
    screenChanged.current = (next) => { if (foreground) flush(); screenRef.current = next; screenView(); };
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('focus', resume);
    window.addEventListener('blur', resume);
    window.addEventListener('pageshow', resume);
    window.addEventListener('pagehide', pagehide);
    const inputs = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const;
    for (const event of inputs) window.addEventListener(event, interact, { passive: true });
    const timer = window.setInterval(() => {
      // An idle/hidden tab sends no repeated heartbeats; the transition was already flushed.
      if (foreground && performance.now() - lastInteraction <= ACTIVITY_IDLE_MS + ACTIVITY_HEARTBEAT_MS) flush();
    }, ACTIVITY_HEARTBEAT_MS);
    flush();
    screenView();
    return () => {
      stopped = true; pending = null; screenChanged.current = null;
      setProductActivitySessionId(null);
      controllers.forEach((controller) => controller.abort());
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('focus', resume); window.removeEventListener('blur', resume);
      window.removeEventListener('pageshow', resume); window.removeEventListener('pagehide', pagehide);
      for (const event of inputs) window.removeEventListener(event, interact);
    };
  }, [enabled, accountKey]);
  useEffect(() => {
    const next = activityScreen(screen);
    if (screenChanged.current) screenChanged.current(next);
    else screenRef.current = next;
  }, [screen]);
}
