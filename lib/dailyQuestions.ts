import type { DailyCanvas, DailyCanvasTopicKey } from './natalHumanShared';
import {
  getDailyQuestionCardBackground,
  type CardBackgroundAsset,
  type DailyQuestionTheme,
} from './cardBackgrounds';

export type DailyQuestionStory = {
  id: string;
  theme: DailyQuestionTheme;
  question: string;
  teaser: string;
  answer: string;
  background: CardBackgroundAsset | null;
};

type Locale = 'ru' | 'en';

type QuestionTemplate = {
  question: string;
  sources: [DailyCanvasTopicKey, DailyCanvasTopicKey];
};

const BANK: Record<Locale, Record<DailyQuestionTheme, QuestionTemplate[]>> = {
  ru: {
    advantage: [
      { question: 'Что сегодня может сыграть тебе на руку?', sources: ['goals', 'work'] },
      { question: 'Где у тебя больше шансов, чем кажется?', sources: ['work', 'communication'] },
      { question: 'На чём сегодня можно выиграть время?', sources: ['energy', 'goals'] },
      { question: 'Что получится легче, если заметить момент?', sources: ['friendship', 'work'] },
    ],
    conversation: [
      { question: 'Какой разговор лучше не оставлять на потом?', sources: ['communication', 'love'] },
      { question: 'Где одна фраза поменяет весь тон?', sources: ['communication', 'family'] },
      { question: 'На какое сообщение не стоит отвечать на автомате?', sources: ['communication', 'friendship'] },
      { question: 'С кем сегодня проще договориться, чем спорить?', sources: ['communication', 'work'] },
    ],
    attention: [
      { question: 'Что сегодня потянет внимание сильнее, чем должно?', sources: ['money', 'energy'] },
      { question: 'Где легко принять чужое настроение за своё?', sources: ['love', 'friendship'] },
      { question: 'Какой момент дня легко переоценить?', sources: ['energy', 'goals'] },
      { question: 'Что стоит заметить до вечера?', sources: ['family', 'friendship'] },
    ],
  },
  en: {
    advantage: [
      { question: 'What could quietly work in your favor today?', sources: ['goals', 'work'] },
      { question: 'Where are your odds better than they look?', sources: ['work', 'communication'] },
      { question: 'Where can you save more time than expected?', sources: ['energy', 'goals'] },
      { question: 'What gets easier once you catch the moment?', sources: ['friendship', 'work'] },
    ],
    conversation: [
      { question: 'Which conversation should not be left for later?', sources: ['communication', 'love'] },
      { question: 'Where could one sentence change the whole tone?', sources: ['communication', 'family'] },
      { question: 'Which message deserves more than an automatic reply?', sources: ['communication', 'friendship'] },
      { question: 'Who is easier to agree with than argue with today?', sources: ['communication', 'work'] },
    ],
    attention: [
      { question: 'What may pull more attention than it deserves?', sources: ['money', 'energy'] },
      { question: 'Where could someone else’s mood feel like your own?', sources: ['love', 'friendship'] },
      { question: 'Which part of the day is easy to overestimate?', sources: ['energy', 'goals'] },
      { question: 'What is worth noticing before the evening?', sources: ['family', 'friendship'] },
    ],
  },
};

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function sentences(value: string): string[] {
  return String(value || '')
    .match(/[^.!?…]+(?:[.!?…]+|$)/gu)
    ?.map((sentence) => sentence.trim())
    .filter(Boolean) || [];
}

function limitWords(value: string, maxWords: number): string {
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return value.trim();
  return `${words.slice(0, maxWords).join(' ').replace(/[,:;—-]+$/u, '')}…`;
}

function buildAnswer(canvas: DailyCanvas, first: DailyCanvasTopicKey, second: DailyCanvasTopicKey): string {
  const firstSentences = sentences(canvas[first]?.body || '').slice(0, 2);
  const secondSentences = sentences(canvas[second]?.body || '').slice(0, 2);
  const overviewSentence = sentences(canvas.overview || '').slice(0, 1);
  const combined = [...firstSentences, ...secondSentences, ...overviewSentence].join(' ');
  return limitWords(combined, 88);
}

export function buildDailyQuestionStories(
  canvas: DailyCanvas | null,
  userId: string,
  dateKey: string,
  locale: Locale,
): DailyQuestionStory[] {
  if (!canvas) return [];

  return (['advantage', 'conversation', 'attention'] as const).map((theme, index) => {
    const templates = BANK[locale][theme];
    const template = templates[stableHash(`${userId}|${dateKey}|${theme}`) % templates.length];
    const answer = buildAnswer(canvas, template.sources[0], template.sources[1]);
    return {
      id: `${theme}-${index}`,
      theme,
      question: template.question,
      teaser: locale === 'ru'
        ? 'Короткий личный ответ по твоему расчёту на день.'
        : 'A short personal answer based on your day calculation.',
      answer,
      background: getDailyQuestionCardBackground(theme, userId, dateKey),
    };
  });
}
