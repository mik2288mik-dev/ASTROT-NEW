import { useEffect, useRef } from 'react';
import { JourneyClock } from '../lib/journeyTelemetry';
import { ViewportBlockClock, traceControlKey } from '../lib/appTelemetry';
import { apiFetch } from './apiClient';
import { getTelegramInitDataHeaders } from './sessionService';
import { bindTraceAccount, captureAppTrace, flushAppTrace, startAppTrace, stopAppTrace, traceScreen, isTraceForeground, setTraceForeground } from './appTelemetryClient';

export function useAppTelemetry(accountKey: string | number | null | undefined, currentScreen: string, active = true) {
  const current = useRef(currentScreen);
  const transition = useRef<((screen: string, reset?: boolean) => void) | null>(null);
  useEffect(() => {
    let screen = current.current;
    let viewId = crypto.randomUUID();
    let clock = new JourneyClock(Date.now(), Date.now);
    const depths = new WeakMap<Element,number>();
    let dominant:Element | null=null;
    let scrollTimer:ReturnType<typeof setTimeout> | undefined;
    let lastScroller:Element | null=null;
    const blocks = new Map<Element, { name: string; clock:ViewportBlockClock; inView: boolean; control: string | null; emitted: boolean; lastSent:number }>();
    const readable = (element:Element) => !element.closest('[inert],[aria-hidden=true],[data-telemetry-exclude]');
    traceScreen(screen);
    startAppTrace((body, keepalive, signal) => apiFetch('/api/telemetry', { method: 'POST', credentials: 'include', keepalive, signal,
      headers: { 'Content-Type': 'application/json', ...getTelegramInitDataHeaders() }, body: JSON.stringify(body) }, 10_000));
    clock.sample(isTraceForeground());
    const emit = (type: 'screen_progress' | 'screen_exit') => captureAppTrace(type, { view_id: viewId, ...clock.sample() });
    const flushBlocks = () => {
      selectDominant();
      for (const block of blocks.values()) {
        const measured=block.clock.sample();
        if (measured.visible_ms >= 1000 && measured.visible_ms>block.lastSent && (!block.control || !block.emitted)) {
          captureAppTrace(block.control ? 'control_view' : 'content_view', { view_id: viewId, ...(block.control ? { control: block.control, label: block.name } : { block: block.name }), ...measured });
          block.emitted = true;
          block.lastSent=measured.visible_ms;
        }
      }
    };
    captureAppTrace('screen_view', { view_id: viewId });
    transition.current = (next, reset = false) => {
      if (screen === next && !reset) return;
      if (!reset) { flushBlocks(); snapshotPosition('leave'); emit('screen_exit'); }
      observer?.disconnect(); blocks.clear(); dominant=null; clearTimeout(scrollTimer);lastScroller=null;
      screen = next; traceScreen(screen); viewId = crypto.randomUUID(); clock = new JourneyClock(Date.now(), Date.now);
      clock.sample(isTraceForeground()); captureAppTrace('screen_view', { view_id: viewId }); observeBlocks();
    };
    const visibility = () => {
      flushBlocks(); clock.sample(isTraceForeground());
      captureAppTrace('visibility', { state: !isTraceForeground() ? 'hidden' : 'visible', view_id: viewId });
      emit('screen_progress'); void flushAppTrace(!isTraceForeground());
    };
    const hide = () => { flushBlocks(); snapshotPosition('leave'); emit('screen_exit'); clock.sample(false); void flushAppTrace(true); };
    const click = (event: Event) => {
      const target = event.target instanceof Element ? event.target.closest('button,a,[role=button],[role=tab],input[type=checkbox],input[type=radio],summary') : null;
      if (!target || !readable(target)) return;
      const privateContent = Boolean(target.closest('[data-telemetry-private]'));
      const label = privateContent ? 'Действие в переписке' : (target.getAttribute('aria-label') || target.getAttribute('title') || target.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80);
      flushBlocks(); // Record an already measured exposure before its click, even between timer ticks.
      const control = traceControlKey(target);
      captureAppTrace('ui_click', { view_id: viewId, label, control });
    };
    const field = (event: Event) => {
      const element = event.target;
      if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement)
        || element.type === 'password' || element.closest('[data-telemetry-exclude]')) return;
      captureAppTrace(event.type === 'focusin' ? 'field_focus' : 'field_changed', { view_id: viewId,
        field: (element.name || element.id || element.tagName.toLowerCase()).slice(0, 80), filled: Boolean(element.value) });
    };
    const scroll = (event: Event) => {
      const el = event.target instanceof Element ? event.target : document.scrollingElement;
      if (!el || el.scrollHeight <= el.clientHeight + 5) return;
      const depth = Math.min(100, Math.floor(el.scrollTop / (el.scrollHeight - el.clientHeight) * 100 / 25) * 25);
      if(depth>(depths.get(el) || 0)) {depths.set(el,depth);captureAppTrace('scroll_depth',{view_id:viewId,depth});}
      lastScroller=el;clearTimeout(scrollTimer);
      scrollTimer=setTimeout(()=> {selectDominant();snapshotPosition('scroll_stop');flushBlocks();},350);
    };
    const media = (event: Event) => {
      const el = event.target;
      if (!(el instanceof HTMLMediaElement) || el.closest('.video-bg')) return; // Background onboarding clips have their own instrument.
      captureAppTrace('media_action', { view_id: viewId, state: event.type, media: el.tagName.toLowerCase(), elapsed_ms: Math.round(el.currentTime * 1000) });
    };
    const error = () => captureAppTrace('client_error', { view_id: viewId, error_kind: 'runtime' });
    const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
      for (const entry of entries) {
        const b = blocks.get(entry.target); if (!b) continue;
        b.inView = entry.isIntersecting && entry.intersectionRatio > 0;
        b.clock.sample(b.inView && isTraceForeground(),entry.target===dominant && isTraceForeground());
      }
      selectDominant();
    }, { threshold: [0,.5] }) : null;
    function selectDominant() {
      const visible=[...blocks].filter(([el,b])=>b.inView && !b.control && el.isConnected && readable(el));
      const explicit=visible.filter(([el])=>el.hasAttribute('data-telemetry-content'));
      const candidates=(explicit.length ? explicit : visible).filter(([el])=>!explicit.some(([child])=>child!==el && el.contains(child)));
      let largest=0,next:Element | null=null;
      if(isTraceForeground()) for(const [el] of candidates) {
        const rect=el.getBoundingClientRect();
        const area=Math.max(0,Math.min(rect.bottom,window.innerHeight)-Math.max(rect.top,0))*Math.max(0,Math.min(rect.right,window.innerWidth)-Math.max(rect.left,0));
        if(area>largest) {largest=area;next=el;}
      }
      dominant=next;
      for(const [el,b] of blocks) b.clock.sample(b.inView && isTraceForeground() && readable(el),el===dominant && isTraceForeground());
    }
    function snapshotPosition(state: 'scroll_stop' | 'leave') {
      const el=lastScroller || document.querySelector('.lumia-main-scroll') || document.scrollingElement;
      if(!el) return;
      const block=dominant ? blocks.get(dominant) : null;
      captureAppTrace('feed_position',{view_id:viewId,state,block:block?.name || 'Блок не определён',scroll_y:Math.max(0,Math.round(el.scrollTop)),
        scroll_height:Math.round(el.scrollHeight),viewport_height:Math.round(el.clientHeight),
        depth:el.scrollHeight>el.clientHeight ? Math.min(100,Math.max(0,Math.round(el.scrollTop/(el.scrollHeight-el.clientHeight)*100))) : 0});
    }
    function observeBlocks() {
      if (!observer) return;
      for(const [el,b] of blocks) if(!el.isConnected) {
        const measured=b.clock.sample(false,false);
        if(!b.control && measured.visible_ms>=1000) captureAppTrace('content_view',{view_id:viewId,block:b.name,...measured});
        observer.unobserve(el);blocks.delete(el);
      }
      const elements = document.querySelectorAll('[data-telemetry-content],main section,main article,main h1,main h2,main h3,.lumia-main-scroll section,.lumia-main-scroll article,[role=status],button,[role=button],[role=tab],input[type=checkbox],input[type=radio],summary,a');
      for (const element of elements) {
        if (blocks.size >= 500 || blocks.has(element) || !readable(element) || (element.closest('[data-telemetry-private]') && !element.hasAttribute('data-telemetry-content'))) continue;
        const isControl = element.matches('button,a,[role=button],[role=tab],input[type=checkbox],input[type=radio],summary');
        if(!isControl && !element.hasAttribute('data-telemetry-content') && (element.querySelector('section,article,[data-telemetry-content]') || element.parentElement?.closest('[data-telemetry-content]'))) continue;
        const headingId=element.getAttribute('aria-labelledby');
        const name = (element.getAttribute('data-telemetry-content') || element.getAttribute('aria-label') || (headingId ? document.getElementById(headingId)?.textContent : '')
          || (isControl || element.matches('h1,h2,h3,[role=status]') ? element.textContent : element.querySelector('h1,h2,h3')?.textContent) || `Блок ${element.id || element.classList[0] || element.tagName.toLowerCase()}`).replace(/\s+/g, ' ').trim().slice(0, 80);
        if (!name) continue;
        blocks.set(element, { name, clock:new ViewportBlockClock(Date.now), inView: false, emitted:false,lastSent:0,
          control: isControl ? traceControlKey(element) : null }); observer.observe(element);
      }
    }
    let mutationTimer: ReturnType<typeof setTimeout> | undefined;
    const mutations = typeof MutationObserver === 'function' ? new MutationObserver(() => {
      if (!mutationTimer) mutationTimer = setTimeout(() => { mutationTimer = undefined; observeBlocks(); selectDominant(); }, 250);
    }) : null;
    mutations?.observe(document.body, { childList: true, subtree: true, attributes:true,attributeFilter:['inert','aria-hidden'] }); observeBlocks();
    const timer = window.setInterval(() => { if (isTraceForeground()) { flushBlocks(); emit('screen_progress'); } }, 10_000);
    const sender = window.setInterval(() => { void flushAppTrace(); }, 5000);
    document.addEventListener('visibilitychange', visibility); window.addEventListener('pagehide', hide); window.addEventListener('online', flushOnline);
    window.addEventListener('nebo-app-visibility', visibility);
    document.addEventListener('click', click, true); document.addEventListener('focusin', field, true); document.addEventListener('change', field, true);
    document.addEventListener('scroll', scroll, { capture: true, passive: true }); window.addEventListener('error', error); window.addEventListener('unhandledrejection', error);
    const mediaEvents = ['play', 'pause', 'ended', 'waiting', 'error'];
    for (const type of mediaEvents) document.addEventListener(type, media, true);
    function flushOnline() { void flushAppTrace(); }
    return () => {
      flushBlocks(); snapshotPosition('leave'); emit('screen_exit'); void flushAppTrace(true); stopAppTrace(); transition.current = null;
      clearInterval(timer); clearInterval(sender); clearTimeout(mutationTimer);clearTimeout(scrollTimer); observer?.disconnect(); mutations?.disconnect();
      document.removeEventListener('visibilitychange', visibility); window.removeEventListener('pagehide', hide); window.removeEventListener('online', flushOnline);
      window.removeEventListener('nebo-app-visibility', visibility);
      document.removeEventListener('click', click, true); document.removeEventListener('focusin', field, true); document.removeEventListener('change', field, true);
      document.removeEventListener('scroll', scroll, true); window.removeEventListener('error', error); window.removeEventListener('unhandledrejection', error);
      for (const type of mediaEvents) document.removeEventListener(type, media, true);
    };
  }, []);
  useEffect(() => { current.current = currentScreen; transition.current?.(currentScreen); }, [currentScreen]);
  useEffect(() => {
    if ((currentScreen !== 'startup' || accountKey != null) && bindTraceAccount(accountKey)) {
      transition.current?.(currentScreen, true);
      window.dispatchEvent(new Event('nebo-trace-reset'));
    }
  }, [accountKey, currentScreen]);
  useEffect(() => { setTraceForeground(active); window.dispatchEvent(new Event('nebo-app-visibility')); }, [active]);
}

/** Nested tabs are distinct from the app route, including automatic openings. */
export function useTelemetrySection(screen: string, detail: string, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    let viewId = crypto.randomUUID(); let clock = new JourneyClock(Date.now(), Date.now);
    clock.sample(isTraceForeground()); captureAppTrace('section_view', { view_id: viewId, detail }, screen);
    const flush = () => captureAppTrace('section_exit', { view_id: viewId, detail, ...clock.sample() }, screen);
    const visibility = () => { flush(); clock.sample(isTraceForeground()); };
    const reset = () => { viewId = crypto.randomUUID(); clock = new JourneyClock(Date.now(), Date.now);
      clock.sample(isTraceForeground()); captureAppTrace('section_view', { view_id: viewId, detail }, screen); };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('nebo-app-visibility', visibility);
    window.addEventListener('nebo-trace-reset', reset);
    const timer = setInterval(() => { if (isTraceForeground()) flush(); }, 10_000);
    return () => { flush(); clearInterval(timer); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('nebo-app-visibility', visibility); window.removeEventListener('nebo-trace-reset', reset); };
  }, [screen, detail, enabled]);
}
