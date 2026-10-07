/**
 * What the studio voice reads for a sign horoscope and for the natal reading. The client names the reading
 * (sign and period, or story and topic); the server takes the text from its own stored copy.
 */
import type { SignHoroscopeReadingV2 } from '../../types';

export const SIGN_LISTEN_MAX_CHARS = 2_600;
export const NATAL_STORY_LISTEN_MAX_CHARS = 9_000;
export const NATAL_TOPIC_LISTEN_MAX_CHARS = 4_500;

const SIGN_NAMES_RU: Record<string, string> = {
  aries: 'Овен', taurus: 'Телец', gemini: 'Близнецы', cancer: 'Рак', leo: 'Лев', virgo: 'Дева',
  libra: 'Весы', scorpio: 'Скорпион', sagittarius: 'Стрелец', capricorn: 'Козерог', aquarius: 'Водолей', pisces: 'Рыбы',
};
const PERIOD_RU = { day: 'на сегодня', week: 'на неделю', month: 'на месяц' } as const;

/** Plain sentences for speech: no markup, no long dashes, calm paragraph breaks. */
export function cleanForSpeech(text: string): string {
  return String(text || '')
    .replace(/\r/g, '')
    .replace(/[*_#>`]/g, '')
    .replace(/\s+[—–]\s+/g, ', ')
    .replace(/[—–]/g, ', ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function cut(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const slice = text.slice(0, limit);
  const end = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('.\n'), slice.lastIndexOf('! '), slice.lastIndexOf('? '));
  return (end > limit * 0.5 ? slice.slice(0, end + 1) : slice).trim();
}

export function buildSignListenScript(
  reading: Pick<SignHoroscopeReadingV2, 'sign' | 'period' | 'headline' | 'text'>,
  language: 'ru' | 'en',
): string {
  const sign = SIGN_NAMES_RU[String(reading.sign).toLowerCase()] || reading.sign;
  const intro = language === 'ru' ? `Гороскоп для знака ${sign} ${PERIOD_RU[reading.period]}.` : `Horoscope for ${sign}.`;
  return cut([intro, cleanForSpeech(reading.headline), cleanForSpeech(reading.text)].filter(Boolean).join('\n\n'), SIGN_LISTEN_MAX_CHARS);
}

type NatalBlock = { text: string };
type NatalReadingLike = {
  story: ReadonlyArray<NatalBlock>;
  topics: ReadonlyArray<{ key: string; title: string; blocks: ReadonlyArray<NatalBlock> }>;
};

/** The whole story, or one topic by key; null when the topic does not exist. */
export function buildNatalListenScript(
  reading: NatalReadingLike,
  part: 'story' | 'topic',
  topicKey: string | null,
  language: 'ru' | 'en',
): string | null {
  if (part === 'story') {
    const body = reading.story.map((block) => cleanForSpeech(block.text)).filter(Boolean).join('\n\n');
    if (!body) return null;
    const intro = language === 'ru' ? 'Рассказ о твоей натальной карте.' : 'The story of your birth chart.';
    return cut(`${intro}\n\n${body}`, NATAL_STORY_LISTEN_MAX_CHARS);
  }
  const topic = reading.topics.find((item) => item.key === topicKey);
  if (!topic) return null;
  const body = topic.blocks.map((block) => cleanForSpeech(block.text)).filter(Boolean).join('\n\n');
  if (!body) return null;
  return cut(`${cleanForSpeech(topic.title)}.\n\n${body}`, NATAL_TOPIC_LISTEN_MAX_CHARS);
}
