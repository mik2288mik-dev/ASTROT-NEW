/**
 * «Радио NEBO»: one spoken issue for the day, like the morning news on the radio. The pieces come from the
 * server's own stored content (the personal forecast, the sign horoscope, the sky, the question of the day);
 * the client only names the day.
 */
import type { DailyQuestion } from '../dailyQuestion';
import { cleanForSpeech } from './readingListenScript';

export const RADIO_PIECE_MAX_CHARS = { forecast: 1_500, sign: 1_000, sky: 700 } as const;

const WEEKDAYS_RU = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const MONTHS_RU = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

function cutToSentence(text: string, limit: number): string {
  const clean = cleanForSpeech(text);
  if (clean.length <= limit) return clean;
  const slice = clean.slice(0, limit);
  const end = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('! '), slice.lastIndexOf('? '));
  return (end > limit * 0.5 ? slice.slice(0, end + 1) : slice).trim();
}

export function formatRadioDate(dayKey: string): string {
  const [year, month, day] = dayKey.split('-').map(Number);
  const date = new Date(Date.UTC(year || 1970, (month || 1) - 1, day || 1));
  return `${WEEKDAYS_RU[date.getUTCDay()]}, ${day} ${MONTHS_RU[(month || 1) - 1]}`;
}

export type RadioPieces = {
  dayKey: string;
  name?: string | null;
  /** Personal forecast of the day, already spoken-form text. */
  forecast?: string | null;
  /** Sign horoscope of the day. */
  sign?: { label: string; headline: string; text: string } | null;
  /** The Moon and Mercury today, one short paragraph. */
  sky?: string | null;
  question?: DailyQuestion | null;
};

export function buildDailyRadioScript(pieces: RadioPieces): string {
  const first = cleanForSpeech(pieces.name || '').split(' ')[0];
  const parts: string[] = [
    `${first ? `Привет, ${first}.` : 'Привет.'} Это Радио NEBO, твой день вслух. Сегодня ${formatRadioDate(pieces.dayKey)}.`,
  ];
  if (pieces.sky) parts.push(`Начнём с неба. ${cutToSentence(pieces.sky, RADIO_PIECE_MAX_CHARS.sky)}`);
  if (pieces.forecast) parts.push(`Теперь про тебя лично. ${cutToSentence(pieces.forecast, RADIO_PIECE_MAX_CHARS.forecast)}`);
  if (pieces.sign) {
    parts.push(`А вот что сегодня говорят звёзды твоему знаку, ${pieces.sign.label}. ${cutToSentence(`${pieces.sign.headline}. ${pieces.sign.text}`, RADIO_PIECE_MAX_CHARS.sign)}`);
  }
  if (pieces.question) {
    const options = pieces.question.options.map((option) => option.ru).join(', ');
    parts.push(`И вопрос дня: ${pieces.question.text.ru} Варианты: ${options}. Ответь в приложении и посмотри, что выбрали люди твоего знака.`);
  }
  parts.push('Это был твой день вслух. Хорошего дня, и до встречи в эфире.');
  return parts.join('\n\n');
}
