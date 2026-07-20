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

/**
 * These are not horoscope headings. They are questions a person could actually
 * ask themselves during the day. The personal hook and answer still come from
 * the generated DailyCanvas, so the visible copy stays tied to this user's day.
 */
const BANK: Record<Locale, Record<DailyQuestionTheme, QuestionTemplate[]>> = {
  ru: {
    advantage: [
      { question: 'Брать ещё одну задачу?', sources: ['work', 'goals'] },
      { question: 'Соглашаться на это предложение?', sources: ['work', 'communication'] },
      { question: 'Дожимать дело или уже хватит?', sources: ['goals', 'energy'] },
      { question: 'Тебе правда надо это доказывать?', sources: ['work', 'friendship'] },
    ],
    conversation: [
      { question: 'Писать первым — нормальная идея?', sources: ['love', 'communication'] },
      { question: 'Поднимать эту тему сейчас?', sources: ['communication', 'family'] },
      { question: 'Соглашаться на встречу?', sources: ['friendship', 'love'] },
      { question: 'Отвечать на это сообщение?', sources: ['communication', 'friendship'] },
    ],
    attention: [
      { question: 'Эта покупка тебе правда нужна?', sources: ['money', 'goals'] },
      { question: 'Тратить на это деньги?', sources: ['money', 'energy'] },
      { question: 'Отменять планы из-за усталости?', sources: ['energy', 'friendship'] },
      { question: 'Тебя злит человек — или просто всё навалилось?', sources: ['energy', 'communication'] },
    ],
  },
  en: {
    advantage: [
      { question: 'Take on one more task?', sources: ['work', 'goals'] },
      { question: 'Say yes to this offer?', sources: ['work', 'communication'] },
      { question: 'Push this through or call it done?', sources: ['goals', 'energy'] },
      { question: 'Do you really need to prove this?', sources: ['work', 'friendship'] },
    ],
    conversation: [
      { question: 'Text first?', sources: ['love', 'communication'] },
      { question: 'Bring this up now?', sources: ['communication', 'family'] },
      { question: 'Say yes to the meeting?', sources: ['friendship', 'love'] },
      { question: 'Reply to that message?', sources: ['communication', 'friendship'] },
    ],
    attention: [
      { question: 'Do you actually need this purchase?', sources: ['money', 'goals'] },
      { question: 'Spend money on this?', sources: ['money', 'energy'] },
      { question: 'Cancel plans because you are tired?', sources: ['energy', 'friendship'] },
      { question: 'Are you mad at them — or just overloaded?', sources: ['energy', 'communication'] },
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

function buildTeaser(canvas: DailyCanvas, primary: DailyCanvasTopicKey): string {
  const hook = String(canvas[primary]?.hook || '').trim();
  if (hook) return limitWords(hook, 20);
  return limitWords(sentences(canvas[primary]?.body || '')[0] || '', 20);
}

function buildAnswer(canvas: DailyCanvas, first: DailyCanvasTopicKey, second: DailyCanvasTopicKey): string {
  const firstPart = sentences(canvas[first]?.body || '').slice(0, 3).join(' ');
  const secondPart = sentences(canvas[second]?.body || '').slice(0, 2).join(' ');
  const overviewFallback = sentences(canvas.overview || '').slice(0, 2).join(' ');
  const main = limitWords(firstPart || overviewFallback, 72);
  const extra = limitWords(secondPart, 34);
  return [main, extra].filter(Boolean).join('\n\n');
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
    const [primary, secondary] = template.sources;
    return {
      id: `${theme}-${index}`,
      theme,
      question: template.question,
      teaser: buildTeaser(canvas, primary),
      answer: buildAnswer(canvas, primary, secondary),
      background: getDailyQuestionCardBackground(theme, userId, dateKey),
    };
  });
}
