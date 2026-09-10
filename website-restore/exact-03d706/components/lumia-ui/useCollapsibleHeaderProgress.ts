import { useEffect, useRef, type RefObject } from 'react';
import {
  useMotionValue,
  useReducedMotion,
  useSpring,
  type MotionValue,
} from 'framer-motion';
import { lumiaImpactHaptic } from '../../lib/haptics';
import { appDebugLog } from '../../lib/appDebug';

type UseCollapsibleHeaderProgressOptions = {
  scrollRef?: RefObject<HTMLDivElement | null>;
  collapseDistance: number;
  source: string;
  expandedBodyHeight: number;
  collapsedBodyHeight: number;
  hapticEdges?: boolean;
};

type CollapsibleHeaderProgress = {
  rawProgress: MotionValue<number>;
  visualProgress: MotionValue<number>;
};

function clampProgress(value: number) {
  return Math.max(0, Math.min(1, value));
}

function phaseFor(progress: number) {
  if (progress >= 0.92) return 'collapsed';
  if (progress <= 0.08) return 'expanded';
  return 'transition';
}

export function useCollapsibleHeaderProgress({
  scrollRef,
  collapseDistance,
  source,
  expandedBodyHeight,
  collapsedBodyHeight,
  hapticEdges = false,
}: UseCollapsibleHeaderProgressOptions): CollapsibleHeaderProgress {
  const shouldReduceMotion = useReducedMotion();
  const rawProgress = useMotionValue(0);
  const smoothProgress = useSpring(rawProgress, {
    stiffness: 430,
    damping: 52,
    mass: 0.78,
    restDelta: 0.001,
  });
  const lastDebugSampleRef = useRef(0);
  const lastDebugPhaseRef = useRef('');
  const lastHapticPhaseRef = useRef<string | null>(null);
  const lastFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const node = scrollRef?.current;
    if (!node) {
      rawProgress.set(0);
      return;
    }

    let frame = 0;
    const update = () => {
      frame = 0;
      const now = performance.now();
      const next = clampProgress(node.scrollTop / collapseDistance);
      const phase = phaseFor(next);
      const previousFrame = lastFrameRef.current;
      const frameDelta = previousFrame === null ? null : Math.round((now - previousFrame) * 10) / 10;

      lastFrameRef.current = now;
      rawProgress.set(next);

      if (hapticEdges) {
        const previousHapticPhase = lastHapticPhaseRef.current;
        if (
          previousHapticPhase !== null &&
          phase !== previousHapticPhase &&
          (phase === 'expanded' || phase === 'collapsed')
        ) {
          lumiaImpactHaptic('soft', 220);
        }
        lastHapticPhaseRef.current = phase;
      }

      if (phase !== lastDebugPhaseRef.current || now - lastDebugSampleRef.current > 350) {
        lastDebugPhaseRef.current = phase;
        lastDebugSampleRef.current = now;
        appDebugLog('collapse_state', {
          source,
          phase,
          scrollTop: Math.round(node.scrollTop),
          progress: Math.round(next * 1000) / 1000,
          frameDelta,
          railHeight: `safeTop + ${collapsedBodyHeight}px`,
          spacerHeight: expandedBodyHeight - collapsedBodyHeight,
          layoutHeightStable: true,
          scrollHeight: node.scrollHeight,
          clientHeight: node.clientHeight,
        });
      }
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
  }, [collapsedBodyHeight, collapseDistance, expandedBodyHeight, hapticEdges, rawProgress, scrollRef, source]);

  return {
    rawProgress,
    visualProgress: shouldReduceMotion ? rawProgress : smoothProgress,
  };
}
