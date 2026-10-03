import { getZodiacSign } from '../../constants';
import { ZODIAC_KEYS } from '../zodiacKeys';
import { DIMENSION_LABELS, getCompatScore } from './compatScore';
import { buildLocalSignCompatibility } from './localSignText';

export type CompatibilityLiveSample = {
  you: string;
  partner: string;
  youName: string;
  partnerName: string;
  score: number;
  verdict: string;
  topics: Array<{ title: string; text: string }>;
  quote: string;
};

function sentences(text: string): string[] {
  return (text.match(/[^.!?…]+[.!?…]+(?:\s|$)/gu) ?? [text]).map((item) => item.trim()).filter(Boolean);
}

/**
 * A real sample of the compatibility reading for this person's Sun sign and the
 * sign they match best with: match scale, first lines of the topics and the
 * closing thought, from the same local engine as the free sign reading.
 */
export function buildCompatibilityLiveSample(yourSign: string, ru: boolean): CompatibilityLiveSample | null {
  const language = ru ? 'ru' : 'en';
  const you = String(yourSign || 'aries').toLowerCase();
  const partner = ZODIAC_KEYS
    .map((key) => key.toLowerCase())
    .filter((key) => key !== you)
    .map((key) => ({ key, score: getCompatScore(you, key, language).overall }))
    .sort((a, b) => b.score - a.score)[0]?.key || 'libra';
  const score = getCompatScore(you, partner, language);
  const text = buildLocalSignCompatibility(you, partner, language, null, null, 'romance');
  if (!text) return null;
  const strongest = DIMENSION_LABELS[score.strongest][language];
  return {
    you,
    partner,
    youName: getZodiacSign(language, you),
    partnerName: getZodiacSign(language, partner),
    score: score.overall,
    verdict: score.verdict,
    topics: [
      { title: ru ? 'Что вас притягивает' : 'What draws you together', text: sentences(text.attraction).slice(0, 2).join(' ') },
      { title: ru ? 'Где будет непросто' : 'Where it gets hard', text: sentences(text.difficulty).slice(0, 2).join(' ') },
      { title: ru ? 'Как понимать друг друга' : 'How to understand each other', text: sentences(text.communication).slice(0, 1).join(' ') },
      {
        title: ru ? 'Сильная сторона пары' : 'The pair’s strong side',
        text: ru
          ? `${strongest}: здесь вам проще всего договориться и поддержать друг друга.`
          : `${strongest}: this is where agreeing and supporting each other comes easiest.`,
      },
    ],
    quote: sentences(text.communication).slice(-1)[0] || '',
  };
}
