import type { ForecastSection, PersonalForecastPackage } from '../personalForecastContract';

/** About two minutes of calm Russian speech. */
export const LISTEN_SCRIPT_MAX_CHARS = 1_800;

function clean(text: string): string {
  return text
    .replace(/[*_#>`]+/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function sectionText(section: ForecastSection): string {
  const fromBlocks = section.contentBlocks.map((block) => clean(block.text)).filter(Boolean).join(' ');
  return fromBlocks || clean(section.text || '');
}

function cutToSentences(text: string, budget: number): string {
  if (text.length <= budget) return text;
  let result = '';
  for (const sentence of text.match(/[^.!?…]+[.!?…]+(?:\s|$)/gu) ?? []) {
    if (result.length + sentence.length > budget) break;
    result += sentence;
  }
  return result.trim();
}

const INTRO: Record<PersonalForecastPackage['period'], { ru: string; en: string }> = {
  day: { ru: 'Твой прогноз на сегодня.', en: 'Your forecast for today.' },
  week: { ru: 'Твоя неделя.', en: 'Your week.' },
  month: { ru: 'Твой месяц.', en: 'Your month.' },
};

/**
 * The text NEBO reads aloud: the opening reading in full, then the other open
 * sections while they fit into about two minutes, the advice section last.
 * Locked sections are never read.
 */
export function buildForecastListenScript(input: {
  forecast: PersonalForecastPackage;
  name?: string | null;
  language: 'ru' | 'en';
  lockedSectionIds?: readonly string[];
}): string {
  const locked = new Set(input.lockedSectionIds ?? []);
  const { forecast, language } = input;
  const name = clean(input.name || '').split(' ')[0];
  const greeting = name ? (language === 'ru' ? `Привет, ${name}.` : `Hi, ${name}.`) : (language === 'ru' ? 'Привет.' : 'Hi.');
  const parts: string[] = [`${greeting} ${INTRO[forecast.period][language]}`];
  let budget = LISTEN_SCRIPT_MAX_CHARS - parts[0].length;

  const take = (section: ForecastSection, withTitle: boolean) => {
    if (budget < 80 || locked.has(section.id) || section.status !== 'ready') return;
    const body = sectionText(section);
    if (!body) return;
    const title = withTitle && section.title ? `${clean(section.title).replace(/[.:!?]+$/u, '')}.` : '';
    const text = cutToSentences(`${title ? `${title} ` : ''}${body}`, budget);
    if (!text) return;
    parts.push(text);
    budget -= text.length + 2;
  };

  take(forecast.overview, true);
  const sections = forecast.sections.filter((section) => section.id !== forecast.overview.id);
  const advice = [...sections].reverse().find((section) => section.contentBlocks.some((block) => block.role === 'action'));
  const reserve = advice ? Math.min(sectionText(advice).length + 40, 420) : 0;
  budget -= reserve;
  for (const section of sections) {
    if (section === advice) continue;
    take(section, true);
  }
  budget += reserve;
  if (advice) take(advice, true);
  return parts.join('\n\n');
}
