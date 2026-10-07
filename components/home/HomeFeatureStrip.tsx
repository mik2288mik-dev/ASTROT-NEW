import React, { useMemo } from 'react';
import { STORY_GENRE_LABELS, STORY_SERIES } from '../../lib/stories/series';
import { SLEEP_STORIES } from '../../lib/sleepStories';
import { SELF_TESTS } from '../../lib/selfTests/engine';
import { VideoBackground } from '../lumia-ui/VideoBackground';
import type { VideoBackgroundId } from '../../lib/videoBackgrounds';

type Card = {
  id: string;
  kicker: string;
  title: string;
  line: string;
  video: VideoBackgroundId | null;
  onOpen: () => void;
};

type HomeFeatureStripProps = {
  todayKey: string;
  onOpenStories?: () => void;
  onOpenSounds?: () => void;
  onOpenAntistress?: () => void;
  onOpenTests?: (testId?: string) => void;
  onOpenMatrix?: () => void;
};

const SLEEP_VIDEOS: Record<string, VideoBackgroundId> = {
  'sea-house': 'sleep-sea-house',
  'night-train': 'sleep-night-train',
  'garden-rain': 'sleep-garden-rain',
};

function dayNumber(dayKey: string): number {
  const [y, m, d] = dayKey.split('-').map(Number);
  return Math.floor(Date.UTC(y || 1970, (m || 1) - 1, d || 1) / 86_400_000);
}

function pick<T>(items: readonly T[], day: number, shift = 0): T {
  return items[(((day + shift) % items.length) + items.length) % items.length];
}

/**
 * «Загляни»: one invitation from every section, taken from the section's own content.
 * The story, the bedtime story and the test change from day to day, so the row is never the same twice.
 */
export function HomeFeatureStrip({ todayKey, onOpenStories, onOpenSounds, onOpenAntistress, onOpenTests, onOpenMatrix }: HomeFeatureStripProps) {
  const cards = useMemo<Card[]>(() => {
    const day = dayNumber(todayKey);
    const list: Card[] = [];
    if (onOpenStories) {
      const series = pick(STORY_SERIES, day);
      list.push({
        id: 'stories',
        kicker: `Рассказы, ${STORY_GENRE_LABELS[series.genre].ru.toLowerCase()}`,
        title: series.title,
        line: 'Новая серия каждый день',
        video: `story-${series.id}` as VideoBackgroundId,
        onOpen: onOpenStories,
      });
    }
    if (onOpenSounds) {
      const story = pick(SLEEP_STORIES, day);
      list.push({
        id: 'sleep',
        kicker: story.kind === 'sleep' ? 'Сегодня на ночь' : 'Для спокойствия',
        title: story.title.ru,
        line: story.teaser.ru,
        video: SLEEP_VIDEOS[story.id] ?? 'sleep-sea-house',
        onOpen: onOpenSounds,
      });
    }
    if (onOpenAntistress) {
      list.push({
        id: 'antistress',
        kicker: 'Антистресс',
        title: 'Минута, чтобы выдохнуть',
        line: 'Дыхание, тело, звуки',
        video: 'breathing',
        onOpen: onOpenAntistress,
      });
    }
    if (onOpenTests) {
      const test = pick(SELF_TESTS, day, 1);
      list.push({
        id: 'tests',
        kicker: `Тест на ${test.minutes} мин`,
        title: test.title.ru,
        line: 'Без оценок, в конце сравним с твоей картой',
        video: 'tests',
        onOpen: () => onOpenTests(test.id),
      });
    }
    if (onOpenMatrix) {
      list.push({
        id: 'matrix',
        kicker: 'Матрица судьбы',
        title: 'Твой код по дате рождения',
        line: 'Бесплатно, считается за секунду',
        video: null,
        onOpen: onOpenMatrix,
      });
    }
    return list;
  }, [todayKey, onOpenStories, onOpenSounds, onOpenAntistress, onOpenTests, onOpenMatrix]);

  if (!cards.length) return null;
  // One section a day: the invitation rotates through the sections, so every day shows something new.
  const card = pick(cards, dayNumber(todayKey));

  return (
    <section className="feature-strip" aria-labelledby="feature-strip-title">
      <h2 id="feature-strip-title" className="today-explore-heading">Загляни сегодня</h2>
      <button type="button" className={`feature-strip-item${card.video ? '' : ' is-plain'}`} onClick={card.onOpen}>
        {card.video ? <VideoBackground key={card.video} id={card.video} scrim="none" /> : null}
        <span className="feature-strip-fade" aria-hidden="true" />
        <span className="feature-strip-text">
          <em>{card.kicker}</em>
          <b>{card.title}</b>
          <span>{card.line}</span>
        </span>
      </button>
    </section>
  );
}
