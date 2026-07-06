import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NatalChartData, UserProfile } from '../../types';
import type { HumanDailySectionKey } from '../../lib/natalHumanShared';
import { loadHumanDailySection } from '../../services/natalReadingService';
import { getMoscowTodayKey } from '../../lib/date-utils';
import { StoriesViewer, type StorySlide } from './StoriesViewer';

type TabDef = { id: string; sectionKey: HumanDailySectionKey; ru: string; en: string };

// One slide per разбор; the sign horoscope lives in its own set elsewhere.
// Все слайды режутся из ЕДИНОГО дневного полотна (один запрос к модели на сутки):
// overview — это summary полотна (free), остальные — сферы (premium).
const TABS: TabDef[] = [
  { id: 'overview', sectionKey: 'daily_overview', ru: 'Главный фокус дня', en: 'Main focus today' },
  { id: 'love', sectionKey: 'daily_love', ru: 'Любовь', en: 'Love' },
  { id: 'work', sectionKey: 'daily_work_business', ru: 'Работа и бизнес', en: 'Work & business' },
  { id: 'money', sectionKey: 'daily_money', ru: 'Деньги', en: 'Money' },
  { id: 'goals', sectionKey: 'daily_goals', ru: 'Дела и цели', en: 'Goals' },
];

type SectionState = { content?: string; loading?: boolean; error?: boolean };

/** Personal "horoscope for today" as a story set — each разбор is one slide. */
export function PersonalDailyStories({
  open,
  profile,
  chartData,
  chartId,
  language,
  onClose,
}: {
  open: boolean;
  profile: UserProfile;
  chartData: NatalChartData | null;
  chartId?: number | null;
  language: 'ru' | 'en';
  onClose: () => void;
}) {
  const dateKey = useMemo(() => getMoscowTodayKey(), []);
  const [states, setStates] = useState<Record<string, SectionState>>({});
  const [active, setActive] = useState(0);
  const requestedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      requestedRef.current = new Set();
      setStates({});
      setActive(0);
    }
  }, [open]);

  const loadSection = useCallback((i: number) => {
    const tab = TABS[i];
    if (!tab || !chartData || !profile.id) return;
    if (requestedRef.current.has(tab.id)) return;
    requestedRef.current.add(tab.id);
    setStates((s) => ({ ...s, [tab.id]: { loading: true } }));

    loadHumanDailySection(String(profile.id), tab.sectionKey, chartId ?? undefined, dateKey, {
      accessTier: 'premium',
      maxInProgressRetries: 3,
      profile,
      chartData,
    })
      .then((r) => r.content?.content?.trim() || '')
      .then((text) => setStates((s) => ({ ...s, [tab.id]: text ? { content: text } : { error: true } })))
      .catch(() => setStates((s) => ({ ...s, [tab.id]: { error: true } })));
  }, [chartData, chartId, dateKey, profile]);

  useEffect(() => {
    if (!open) return;
    loadSection(active);
    loadSection(active + 1); // prefetch the next разбор
  }, [open, active, loadSection]);

  const slides: StorySlide[] = TABS.map((t) => {
    const st = states[t.id];
    const body = st?.content
      ? st.content
      : st?.error
      ? (language === 'ru' ? 'Не удалось загрузить этот разбор.' : 'Could not load this section.')
      : undefined;
    return {
      id: t.id,
      eyebrow: language === 'ru' ? 'Личный гороскоп на сегодня' : 'Personal horoscope today',
      title: language === 'ru' ? t.ru : t.en,
      body,
      loading: !!st?.loading && !st?.content && !st?.error,
    };
  });

  return <StoriesViewer open={open} slides={slides} onClose={onClose} onIndexChange={setActive} accent="#111111" variant="mono" />;
}
