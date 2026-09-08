import { useCallback, useEffect, useState } from 'react';
import type { PublishedHomeCard } from '../lib/homeCards';
import { HOME_CARDS_CHANGED_EVENT, HOME_CARDS_STORAGE_SIGNAL, homeCardsCacheKey, invalidateHomeCards, loadHomeCards, type HomeCardsCache, type HomeCardsRequest } from '../services/homeCardsService';

export function useHomeCards(input: HomeCardsRequest): { cards: PublishedHomeCard[]; loading: boolean; error: boolean; refresh: () => void } {
  const key = homeCardsCacheKey(input);
  const [state, setState] = useState<{ key: string; data: HomeCardsCache | null; loading: boolean; error: boolean }>({ key, data: null, loading: true, error: false });
  const refresh = useCallback(() => invalidateHomeCards(), []);
  const { userId, isPremium, locale } = input;
  useEffect(() => {
    let active = true;
    let sequence = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const update = async (force = false) => {
      const current = ++sequence;
      if (timer) clearTimeout(timer);
      setState((previous) => ({ key, data: !force && previous.key === key && previous.data && previous.data.expiresAt > Date.now() ? previous.data : null, loading: true, error: false }));
      try {
        const data = await loadHomeCards({ userId, isPremium, locale }, force);
        if (!active || current !== sequence) return;
        setState({ key, data, loading: false, error: false });
        timer = setTimeout(() => { void update(); }, Math.max(100, data.expiresAt - Date.now()));
      } catch {
        if (!active || current !== sequence) return;
        setState({ key, data: null, loading: false, error: true });
        timer = setTimeout(() => { void update(); }, 30_000);
      }
    };
    const changed = () => { void update(true); };
    const visible = () => { if (document.visibilityState === 'visible') void update(); };
    const storage = (event: StorageEvent) => { if (event.key === HOME_CARDS_STORAGE_SIGNAL) invalidateHomeCards(false); };
    void update();
    window.addEventListener(HOME_CARDS_CHANGED_EVENT, changed);
    window.addEventListener('storage', storage);
    window.addEventListener('focus', visible);
    document.addEventListener('visibilitychange', visible);
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      window.removeEventListener(HOME_CARDS_CHANGED_EVENT, changed);
      window.removeEventListener('storage', storage);
      window.removeEventListener('focus', visible);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [key, userId, isPremium, locale]);
  const now = Date.now();
  const cards = state.key === key && state.data && state.data.expiresAt > now ? state.data.cards.filter((card) => (
    (!card.startsAt || Date.parse(card.startsAt) <= now) && (!card.endsAt || Date.parse(card.endsAt) > now)
    && (card.audience === 'all' || card.audience === (isPremium ? 'premium' : 'free'))
  )) : [];
  return { cards, loading: state.key !== key || state.loading, error: state.key === key && state.error, refresh };
}
