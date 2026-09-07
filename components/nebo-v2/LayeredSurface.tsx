import React, { useEffect, useRef } from 'react';
import { animate } from 'framer-motion';
import { LayeredSurfaceController } from '../../lib/neboDesign/layeredSurface';
import type { SurfaceState } from '../../lib/neboDesign/contract';
import { NATIVE_BACK_EVENT, type NativeBackEventDetail } from '../../lib/nativeBack';
export function LayeredSurface({ back, children, initial, onChange, active = true, controlRef }: {
  back: React.ReactNode; children: React.ReactNode; initial: SurfaceState; onChange?: (state: SurfaceState) => void; active?: boolean; controlRef?: React.MutableRefObject<LayeredSurfaceController | null>;
}) {
  const root = useRef<HTMLDivElement>(null), rear = useRef<HTMLDivElement>(null), front = useRef<HTMLElement>(null);
  const handle = useRef<HTMLButtonElement>(null), scroll = useRef<HTMLDivElement>(null);
  const callback = useRef(onChange), activeRef = useRef(active); callback.current = onChange; activeRef.current = active;
  const start = useRef(initial);
  useEffect(() => {
    if (!root.current || !rear.current || !front.current || !handle.current || !scroll.current) return;
    const controller = new LayeredSurfaceController({
      root: root.current, back: rear.current, front: front.current, handle: handle.current, scroll: scroll.current,
      initial: start.current, onChange: value => callback.current?.(value),
      animate: (from, to, onUpdate, onComplete) => {
        const animation = animate(from, to, { type: 'spring', stiffness: 420, damping: 42, mass: 1, restDelta: .3, restSpeed: .3, onUpdate, onComplete });
        return () => animation.stop();
      },
    });
    if (controlRef) controlRef.current = controller;
    const backEvent = (event: Event) => {
      const detail = (event as CustomEvent<NativeBackEventDetail>).detail;
      if (!activeRef.current || detail?.handled) return;
      if (controller.collapseOne() && detail) { detail.handled = true; event.preventDefault(); }
    };
    window.addEventListener(NATIVE_BACK_EVENT, backEvent);
    return () => { start.current = controller.snapshot; controller.destroy(); if (controlRef) controlRef.current = null; window.removeEventListener(NATIVE_BACK_EVENT, backEvent); };
  }, [controlRef]);
  return <div ref={root} className="nebo-layer-root"><div ref={rear} className="nebo-layer-back">{back}</div><section ref={front} className="nebo-layer-front" aria-label="Разделы"><button ref={handle} type="button" className="nebo-layer-handle" aria-label="Развернуть разделы" aria-expanded={false}><span aria-hidden="true"/></button><div ref={scroll} className="nebo-layer-scroll">{children}</div></section></div>;
}
