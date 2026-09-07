import type { SurfacePosition, SurfaceState } from './contract';
export type SurfaceStops = Record<SurfacePosition, number>;
export function surfaceStops(height: number): SurfaceStops {
  const h = Number.isFinite(height) ? Math.max(96, height) : 640;
  return { expanded: 0, middle: Math.round(h * .34), collapsed: Math.max(48, h - 48) };
}
export function nearestSurfaceStop(y: number, velocity: number, stops: SurfaceStops): SurfacePosition {
  const projected = Math.max(stops.expanded, Math.min(stops.collapsed, y + Math.max(-1800, Math.min(1800, velocity)) * .16));
  return (['expanded', 'middle', 'collapsed'] as const).reduce((best, p) => Math.abs(stops[p] - projected) < Math.abs(stops[best] - projected) ? p : best, 'expanded' as SurfacePosition);
}
export type AnimateSurface = (from: number, to: number, update: (n: number) => void, complete: () => void) => () => void;
export type LayeredSurfaceOptions = { root: HTMLElement; back: HTMLElement; front: HTMLElement; scroll: HTMLElement; handle: HTMLButtonElement; initial: SurfaceState; animate?: AnimateSurface; onChange?: (state: SurfaceState) => void };
export function browserSurfaceSpring(from: number, to: number, update: (n: number) => void, complete: () => void): () => void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || Math.abs(to - from) < .3) { update(to); complete(); return () => {}; }
  let x = from, v = 0, previous = performance.now(), raf = 0, cancelled = false, elapsed = 0;
  const frame = (now: number) => {
    if (cancelled) return;
    const dt = Math.min(.024, Math.max(.001, (now - previous) / 1000)); previous = now; elapsed += dt;
    v += (-420 * (x - to) - 42 * v) * dt; x += v * dt; update(x);
    if ((Math.abs(v) < .25 && Math.abs(x - to) < .25) || elapsed > 1.2) { update(to); complete(); } else raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => { cancelled = true; cancelAnimationFrame(raf); };
}
/** Persistent two-surface interaction, not a modal. Motion animates the shared controller. */
export class LayeredSurfaceController {
  private state: SurfaceState;
  private y = 0;
  private stops: SurfaceStops;
  private cancelAnimation: (() => void) | null = null;
  private pointer: { id: number; startY: number; startX: number; startOffset: number; lastY: number; lastTime: number; velocity: number; moved: boolean } | null = null;
  private touch: { x: number; y: number; lastY: number; lastTime: number; startOffset: number; velocity: number; claimed: boolean } | null = null;
  private ignoreClickUntil = 0;
  private scrollTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;
  private originalBackInert: boolean;
  private observer: ResizeObserver;
  constructor(private o: LayeredSurfaceOptions) {
    this.state = { ...o.initial }; this.stops = surfaceStops(o.root.clientHeight);
    this.originalBackInert = o.back.inert; this.y = this.stops[this.state.position];
    this.paint(this.y); o.scroll.scrollTop = this.state.scrollTop; this.applyState();
    o.handle.addEventListener('pointerdown', this.pointerDown); o.handle.addEventListener('pointermove', this.pointerMove);
    o.handle.addEventListener('pointerup', this.pointerUp); o.handle.addEventListener('pointercancel', this.pointerCancel);
    o.handle.addEventListener('click', this.click); o.handle.addEventListener('keydown', this.keyDown);
    o.scroll.addEventListener('scroll', this.scrolled, { passive: true });
    o.scroll.addEventListener('touchstart', this.touchStart, { passive: true });
    o.scroll.addEventListener('touchmove', this.touchMove, { passive: false });
    o.scroll.addEventListener('touchend', this.touchEnd, { passive: true });
    o.scroll.addEventListener('touchcancel', this.touchCancel, { passive: true });
    this.observer = new ResizeObserver(this.resize); this.observer.observe(o.root);
  }
  get snapshot(): SurfaceState { return { ...this.state }; }
  private paint = (value: number) => {
    this.y = Math.max(0, Math.min(this.stops.collapsed, value));
    this.o.front.style.transform = `translate3d(0, ${this.y.toFixed(2)}px, 0)`;
    this.o.root.style.setProperty('--nebo-sheet-offset', `${this.y}px`);
  };
  private applyState() {
    const { back, root, handle, scroll } = this.o;
    root.dataset.neboPosition = this.state.position;
    const expanded = this.state.position === 'expanded';
    if (expanded && back.contains(document.activeElement)) handle.focus({ preventScroll: true });
    back.inert = expanded || this.originalBackInert; back.setAttribute('aria-hidden', expanded ? 'true' : 'false');
    handle.setAttribute('aria-expanded', this.state.position === 'collapsed' ? 'false' : 'true');
    handle.setAttribute('aria-label', expanded ? 'Свернуть разделы' : 'Развернуть разделы');
    scroll.inert = this.state.position === 'collapsed'; scroll.style.overflowY = expanded ? 'auto' : 'hidden';
  }
  setPosition(position: SurfacePosition, immediate = false) {
    if (this.destroyed) return;
    this.cancelAnimation?.(); this.cancelAnimation = null; this.state.position = position;
    this.o.front.dataset.moving = 'true'; this.applyState();
    const done = () => { if (this.destroyed) return; this.o.front.dataset.moving = 'false'; this.state.scrollTop = Math.round(this.o.scroll.scrollTop); this.o.onChange?.(this.snapshot); };
    const target = this.stops[position];
    if (immediate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { this.paint(target); done(); }
    else this.cancelAnimation = (this.o.animate || browserSurfaceSpring)(this.y, target, this.paint, done);
  }
  collapseOne(): boolean { if (this.state.position === 'collapsed') return false; this.setPosition(this.state.position === 'expanded' ? 'middle' : 'collapsed'); return true; }
  private resize = () => {
    if (this.destroyed) return;
    this.cancelAnimation?.(); this.pointer = null; this.touch = null;
    this.stops = surfaceStops(this.o.root.clientHeight); this.paint(this.stops[this.state.position]); this.applyState();
  };
  private pointerDown = (e: PointerEvent) => {
    if (!e.isPrimary || e.button !== 0) return;
    this.cancelAnimation?.();
    this.pointer = { id: e.pointerId, startY: e.clientY, startX: e.clientX, startOffset: this.y, lastY: e.clientY, lastTime: e.timeStamp, velocity: 0, moved: false };
    this.o.handle.setPointerCapture(e.pointerId);
  };
  private pointerMove = (e: PointerEvent) => {
    const p = this.pointer; if (!p || p.id !== e.pointerId) return;
    const dy = e.clientY - p.startY, dx = e.clientX - p.startX;
    if (!p.moved && Math.abs(dy) < 7) return;
    if (!p.moved && Math.abs(dx) > Math.abs(dy)) return;
    p.moved = true; e.preventDefault();
    const dt = Math.max(1, e.timeStamp - p.lastTime); p.velocity = (e.clientY - p.lastY) / dt * 1000;
    p.lastY = e.clientY; p.lastTime = e.timeStamp; this.paint(p.startOffset + dy);
  };
  private pointerUp = (e: PointerEvent) => {
    const p = this.pointer; if (!p || p.id !== e.pointerId) return;
    this.pointer = null;
    if (this.o.handle.hasPointerCapture(e.pointerId)) this.o.handle.releasePointerCapture(e.pointerId);
    if (p.moved) { this.ignoreClickUntil = performance.now() + 300; this.setPosition(nearestSurfaceStop(this.y, p.velocity, this.stops)); }
  };
  private pointerCancel = () => { if (!this.pointer) return; this.pointer = null; this.ignoreClickUntil = performance.now() + 300; this.setPosition(nearestSurfaceStop(this.y, 0, this.stops)); };
  private click = () => { if (performance.now() < this.ignoreClickUntil) return; this.setPosition(this.state.position === 'expanded' ? 'collapsed' : 'expanded'); };
  private keyDown = (e: KeyboardEvent) => {
    const positions = { ArrowUp: 'expanded', ArrowDown: 'collapsed', Home: 'expanded', End: 'collapsed', Escape: 'collapsed' } as const;
    const position = positions[e.key as keyof typeof positions];
    if (!position) return; e.preventDefault(); this.setPosition(position);
  };
  private touchStart = (e: TouchEvent) => {
    if (e.touches.length !== 1 || this.o.scroll.scrollTop > 1 || this.state.position === 'collapsed') { this.touch = null; return; }
    const target = e.target as HTMLElement;
    if (target.closest('button,a,input,textarea,select,[data-nebo-no-drag]')) return;
    const t = e.touches[0];
    this.touch = { x: t.clientX, y: t.clientY, lastY: t.clientY, lastTime: e.timeStamp, startOffset: this.y, velocity: 0, claimed: false };
  };
  private touchMove = (e: TouchEvent) => {
    const t = this.touch; if (!t || e.touches.length !== 1) return;
    const p = e.touches[0], dy = p.clientY - t.y, dx = p.clientX - t.x;
    if (!t.claimed && ((this.state.position === 'expanded' && dy < -5) || Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy))) { this.touch = null; return; }
    if (!t.claimed && (dy > 8 || (this.state.position === 'middle' && dy < -8)) && Math.abs(dy) > Math.abs(dx) * 1.2 && this.o.scroll.scrollTop <= 1) {
      if (!e.cancelable) { this.touch = null; return; } t.claimed = true; this.cancelAnimation?.();
    }
    if (!t.claimed) return;
    if (e.cancelable) e.preventDefault();
    const dt = Math.max(1, e.timeStamp - t.lastTime); t.velocity = (p.clientY - t.lastY) / dt * 1000; t.lastY = p.clientY; t.lastTime = e.timeStamp;
    this.paint(t.startOffset + dy);
  };
  private touchEnd = () => { const t = this.touch; this.touch = null; if (t?.claimed) { this.ignoreClickUntil = performance.now() + 300; this.setPosition(nearestSurfaceStop(this.y, t.velocity, this.stops)); } };
  private touchCancel = () => { if (this.touch?.claimed) this.setPosition(nearestSurfaceStop(this.y, 0, this.stops)); this.touch = null; };
  private scrolled = () => {
    if (this.scrollTimer) clearTimeout(this.scrollTimer);
    this.scrollTimer = setTimeout(() => { if (this.destroyed) return; this.state.scrollTop = Math.round(this.o.scroll.scrollTop); this.o.onChange?.(this.snapshot); }, 500);
  };
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true; this.cancelAnimation?.(); this.observer.disconnect(); if (this.scrollTimer) clearTimeout(this.scrollTimer);
    const { handle, scroll, back } = this.o;
    handle.removeEventListener('pointerdown', this.pointerDown); handle.removeEventListener('pointermove', this.pointerMove);
    handle.removeEventListener('pointerup', this.pointerUp); handle.removeEventListener('pointercancel', this.pointerCancel);
    handle.removeEventListener('click', this.click); handle.removeEventListener('keydown', this.keyDown);
    scroll.removeEventListener('scroll', this.scrolled); scroll.removeEventListener('touchstart', this.touchStart);
    scroll.removeEventListener('touchmove', this.touchMove); scroll.removeEventListener('touchend', this.touchEnd); scroll.removeEventListener('touchcancel', this.touchCancel);
    back.inert = this.originalBackInert; back.removeAttribute('aria-hidden');
  }
}
