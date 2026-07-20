import { useEffect, useMemo, useState } from 'react';
import type { DailyCanvas } from './natalHumanShared';
import {
  getDailyQuestionCardBackground,
  type CardBackgroundAsset,
  type DailyQuestionTheme,
} from './cardBackgrounds';
import type {
  PersonalizedDailyQuestion,
  PersonalizedDailyQuestionsPayload,
} from './dailyQuestionTypes';
import { getTelegramInitDataHeaders } from '../services/sessionService';

export type DailyQuestionStory = {
  id: string;
  theme: DailyQuestionTheme;
  question: string;
  teaser: string;
  answer: string;
  background: CardBackgroundAsset | null;
};

type Locale = 'ru' | 'en';

const THEMES: DailyQuestionTheme[] = ['conversation', 'advantage', 'attention'];
const memoryCache = new Map<string, PersonalizedDailyQuestion[]>();
const inFlight = new Map<string, Promise<PersonalizedDailyQuestion[]>>();

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function requestKey(
  canvas: DailyCanvas,
  userId: string,
  dateKey: string,
  locale: Locale,
  premium: boolean,
): string {
  const contentKey = [
    canvas.meta?.voice_version || 'voice',
    canvas.hero_title,
    canvas.hero_hook,
    canvas.overview.slice(0, 180),
  ].join('|');
  return `${userId}|${dateKey}|${locale}|${premium ? 'premium' : 'free'}|${stableHash(contentKey)}`;
}

function localStorageKey(key: string): string {
  return `your-horoscope:daily-questions:v2:${key}`;
}

function normalizeClientQuestions(value: unknown): PersonalizedDailyQuestion[] {
  const raw = Array.isArray((value as PersonalizedDailyQuestionsPayload | undefined)?.questions)
    ? (value as PersonalizedDailyQuestionsPayload).questions
    : [];

  return raw.slice(0, 3).filter((item) => (
    item &&
    typeof item.id === 'string' &&
    typeof item.topic === 'string' &&
    typeof item.question === 'string' &&
    item.question.trim().endsWith('?') &&
    typeof item.teaser === 'string' &&
    typeof item.answer === 'string'
  )).map((item) => ({
    id: item.id,
    topic: item.topic,
    question: item.question.trim(),
    teaser: item.teaser.trim(),
    answer: item.answer.trim(),
  })) as PersonalizedDailyQuestion[];
}

function readLocal(key: string): PersonalizedDailyQuestion[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(localStorageKey(key));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return normalizeClientQuestions(parsed);
  } catch {
    return [];
  }
}

function writeLocal(key: string, questions: PersonalizedDailyQuestion[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(localStorageKey(key), JSON.stringify({ questions }));
  } catch {
    // Storage can be unavailable in private or restricted WebViews. Server cache still works.
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function fetchPersonalizedQuestions(
  key: string,
  canvas: DailyCanvas,
  userId: string,
  dateKey: string,
): Promise<PersonalizedDailyQuestion[]> {
  const existing = inFlight.get(key);
  if (existing) return existing;

  const request = (async () => {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const response = await fetch('/api/content/natal/daily-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getTelegramInitDataHeaders(),
        },
        body: JSON.stringify({
          userId,
          date: dateKey,
          dailyPackage: canvas,
        }),
      });

      if (response.status === 202) {
        const pending = await response.json().catch(() => ({}));
        const retryAfterMs = Number(pending?.retryAfterMs);
        await wait(Number.isFinite(retryAfterMs) ? Math.min(Math.max(retryAfterMs, 500), 2500) : 900);
        continue;
      }

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.message || payload?.error || `Daily questions failed (${response.status})`);
      }

      const payload = await response.json();
      const questions = normalizeClientQuestions(payload);
      if (questions.length !== 3) throw new Error('Daily questions response is incomplete');
      memoryCache.set(key, questions);
      writeLocal(key, questions);
      return questions;
    }

    throw new Error('Daily questions are still being generated');
  })().finally(() => {
    inFlight.delete(key);
  });

  inFlight.set(key, request);
  return request;
}

export function useDailyQuestionStories(
  canvas: DailyCanvas | null,
  userId: string,
  dateKey: string,
  locale: Locale,
  premium: boolean,
): DailyQuestionStory[] {
  const key = useMemo(
    () => canvas ? requestKey(canvas, userId, dateKey, locale, premium) : '',
    [canvas, dateKey, locale, premium, userId],
  );
  const [questions, setQuestions] = useState<PersonalizedDailyQuestion[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (!canvas || !key || !userId || userId === 'guest') {
      setQuestions([]);
      return () => { cancelled = true; };
    }

    const cached = memoryCache.get(key) || readLocal(key);
    if (cached.length === 3) {
      memoryCache.set(key, cached);
      setQuestions(cached);
      return () => { cancelled = true; };
    }

    setQuestions([]);
    void fetchPersonalizedQuestions(key, canvas, userId, dateKey)
      .then((next) => {
        if (!cancelled) setQuestions(next);
      })
      .catch((error) => {
        if (!cancelled) setQuestions([]);
        console.warn('[dailyQuestions] personalized questions unavailable:', error instanceof Error ? error.message : error);
      });

    return () => { cancelled = true; };
  }, [canvas, dateKey, key, userId]);

  return useMemo(() => questions.map((item, index) => {
    const theme = THEMES[index % THEMES.length];
    return {
      id: item.id,
      theme,
      question: item.question,
      teaser: item.teaser,
      answer: item.answer,
      background: getDailyQuestionCardBackground(theme, userId, dateKey),
    };
  }), [dateKey, questions, userId]);
}
