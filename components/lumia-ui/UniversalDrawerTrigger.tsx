import React, { useCallback, useEffect, useState } from 'react';
import { hasTelegramMiniAppContext } from '../../services/authSessionIntent';

const DRAWER_TOGGLE_EVENT = 'lumia:toggle-side-drawer';
const DRAWER_STATE_EVENT = 'lumia:side-drawer-state';
const BLOCKED_VIEWS = new Set(['onboarding', 'paywall', 'admin']);

type DrawerStateDetail = {
  open: boolean;
};

type TriggerState = {
  visible: boolean;
  expanded: boolean;
  language: 'ru' | 'en';
  telegram: boolean;
};

const INITIAL_STATE: TriggerState = {
  visible: false,
  expanded: false,
  language: 'ru',
  telegram: false,
};

function readTriggerState(): TriggerState {
  if (typeof document === 'undefined') return INITIAL_STATE;

  const drawerRoot = document.querySelector<HTMLElement>(
    '.lumia-side-drawer-root[data-drawer-enabled="true"]',
  );
  if (!drawerRoot) return INITIAL_STATE;

  const currentView = drawerRoot.dataset.currentView || '';
  const expanded = drawerRoot.classList.contains('is-open');
  const main = document.querySelector<HTMLElement>('.lumia-app-shell > main');
  const modalOwnsScreen = !expanded
    && !!main
    && (main.getAttribute('aria-hidden') === 'true' || main.inert);

  return {
    visible: !BLOCKED_VIEWS.has(currentView) && !modalOwnsScreen,
    expanded,
    language: drawerRoot.dataset.language === 'en' ? 'en' : 'ru',
    telegram: hasTelegramMiniAppContext(),
  };
}

export function UniversalDrawerTrigger() {
  const [state, setState] = useState<TriggerState>(INITIAL_STATE);

  const syncState = useCallback(() => {
    const next = readTriggerState();
    setState((current) => (
      current.visible === next.visible
      && current.expanded === next.expanded
      && current.language === next.language
      && current.telegram === next.telegram
        ? current
        : next
    ));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    let frame = 0;
    const scheduleSync = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(syncState);
    };
    const handleDrawerState = (event: Event) => {
      const detail = (event as CustomEvent<DrawerStateDetail>).detail;
      if (detail && typeof detail.open === 'boolean') {
        setState((current) => ({ ...current, expanded: detail.open }));
      }
      scheduleSync();
    };

    const observer = new MutationObserver(scheduleSync);
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: [
        'class',
        'data-current-view',
        'data-drawer-enabled',
        'data-language',
        'aria-hidden',
        'inert',
      ],
    });
    window.addEventListener(DRAWER_STATE_EVENT, handleDrawerState);
    scheduleSync();

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener(DRAWER_STATE_EVENT, handleDrawerState);
    };
  }, [syncState]);

  if (!state.visible) return null;

  const label = state.language === 'en'
    ? (state.expanded ? 'Close navigation' : 'Open navigation')
    : (state.expanded ? 'Закрыть навигацию' : 'Открыть навигацию');

  return (
    <button
      type="button"
      className={`lumia-universal-drawer-button${state.telegram ? ' is-telegram' : ''}${
        state.expanded ? ' is-expanded' : ''
      }`}
      aria-label={label}
      aria-expanded={state.expanded}
      onClick={() => window.dispatchEvent(new CustomEvent(DRAWER_TOGGLE_EVENT))}
    >
      <span className="lumia-universal-drawer-mark" aria-hidden="true" />
    </button>
  );
}
