import type { StrictJsonSchema } from '../openaiResponses';
import type { StorySeries } from './series';

/** About 4–7 minutes of reading. */
export const EPISODE_MIN_WORDS = 650;
export const EPISODE_MAX_WORDS = 1250;

export type PreviousEpisode = { number: number; title: string; summary: string; facts: string[] };

export type WrittenEpisode = {
  title: string;
  text: string;
  summary: string;
  facts: string[];
  hook: string;
  charactersUsed: string[];
  newCharacters: string[];
};

export const EPISODE_SCHEMA: StrictJsonSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    text: { type: 'string' },
    summary: { type: 'string' },
    facts: { type: 'array', items: { type: 'string' } },
    hook: { type: 'string' },
    charactersUsed: { type: 'array', items: { type: 'string' } },
    newCharacters: { type: 'array', items: { type: 'string' } },
  },
  required: ['title', 'text', 'summary', 'facts', 'hook', 'charactersUsed', 'newCharacters'],
  additionalProperties: false,
};

/** The story-line beat for this episode: lines take turns, beats go in order. */
export function episodeBeat(series: StorySeries, number: number): { arc: string; beat: string } {
  const arc = series.arcs[(number - 1) % series.arcs.length];
  const round = Math.floor((number - 1) / series.arcs.length);
  return { arc: arc.name, beat: arc.beats[round % arc.beats.length] };
}

export function buildEpisodePrompt(
  series: StorySeries,
  number: number,
  previous: readonly PreviousEpisode[],
  /** What must happen in this episode, chosen or written in the admin; replaces the arc beat. */
  direction?: string | null,
): { instructions: string; input: string } {
  const beat = episodeBeat(series, number);
  const recent = previous.slice(-12);
  const facts = previous.flatMap((episode) => episode.facts).slice(-40);
  const instructions = [
    'Ты пишешь ежедневный сериал для приложения NEBO. Пиши по-русски, живым простым языком, как хорошая современная проза: сцены, диалоги, детали, без канцелярита и пафоса.',
    'Запрещено: эзотерика («энергия», «вселенная», «карма», «судьба»), эмодзи, жестокость, кровь, секс, мат, реклама, реальные бренды и знаменитости.',
    `Объём серии — от ${EPISODE_MIN_WORDS} до ${EPISODE_MAX_WORDS} слов (4–7 минут чтения). Абзацы разделяй пустой строкой.`,
    'Серия должна опираться на прошлые события, не противоречить им и не повторять их. Имена, возраст, профессии, места и уже известные факты не меняй.',
    'Последний абзац — крючок: неожиданная деталь, вопрос или поворот, из-за которого хочется прочитать завтрашнюю серию.',
    'Новых персонажей вводи редко и только второстепенных; перечисли их имена в newCharacters.',
    'Ответ строго в JSON по схеме: title — название серии (2–6 слов, без номера); text — текст серии; summary — 2–3 предложения, что случилось; facts — 3–6 коротких фактов, которые важно помнить дальше; hook — последний абзац отдельно; charactersUsed — имена героев, которые появились в серии.',
  ].join('\n');
  const input = [
    `СЕРИАЛ: «${series.title}» (${series.genre}). ${series.tagline}.`,
    `МИР: ${series.world}`,
    'ГЕРОИ:',
    ...series.characters.map((character) => `- ${character.name}${character.aliases.length ? ` (${character.aliases.join(', ')})` : ''}: ${character.role}`),
    'ПРАВИЛА СЕРИАЛА:',
    ...series.rules.map((rule) => `- ${rule}`),
    series.style ? `СТИЛЬ И ТОН: ${series.style}` : '',
    direction
      ? `СЕРИЯ № ${number}. Сюжет этой серии задан автором — следуй ему: ${direction}`
      : `СЕРИЯ № ${number}. Линия: «${beat.arc}». Что должно произойти: ${beat.beat}.`,
    recent.length ? 'ЧТО УЖЕ БЫЛО (по порядку):' : 'Это первая серия: познакомь читателя с героями и миром через действие, а не описание.',
    ...recent.map((episode) => `- Серия ${episode.number} «${episode.title}»: ${episode.summary}`),
    facts.length ? 'ВАЖНЫЕ ФАКТЫ, КОТОРЫЕ НЕЛЬЗЯ НАРУШАТЬ:' : '',
    ...facts.map((fact) => `- ${fact}`),
    recent.length ? `Последняя серия закончилась так: ${previous[previous.length - 1].summary}` : '',
  ].filter(Boolean).join('\n');
  return { instructions, input };
}

export function parseWrittenEpisode(content: string): WrittenEpisode | null {
  try {
    const value = JSON.parse(content) as Partial<WrittenEpisode>;
    const strings = (items: unknown) => (Array.isArray(items) ? items.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim()) : []);
    if (typeof value.title !== 'string' || typeof value.text !== 'string' || typeof value.summary !== 'string' || typeof value.hook !== 'string') return null;
    return {
      title: value.title.trim().replace(/^[«"]|[»"]$/gu, ''),
      text: value.text.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim(),
      summary: value.summary.trim(),
      facts: strings(value.facts).slice(0, 8),
      hook: value.hook.trim(),
      charactersUsed: strings(value.charactersUsed),
      newCharacters: strings(value.newCharacters).slice(0, 4),
    };
  } catch {
    return null;
  }
}

export function countWords(text: string): number {
  return (text.match(/[\p{L}\p{N}]+(?:[-’'][\p{L}\p{N}]+)*/gu) ?? []).length;
}

const BANNED = /\p{Extended_Pictographic}|энерги|вселенн|карм|судьб/iu;

/**
 * Connectedness checks before release: size, the known cast, names that the
 * story already introduced, a hook at the end. Any issue holds the episode for
 * a human in Admin v2.
 */
export function checkEpisodeConsistency(series: StorySeries, episode: WrittenEpisode, previous: readonly PreviousEpisode[]): string[] {
  const issues: string[] = [];
  const words = countWords(episode.text);
  if (words < EPISODE_MIN_WORDS) issues.push(`Слишком коротко: ${words} слов (нужно от ${EPISODE_MIN_WORDS})`);
  if (words > EPISODE_MAX_WORDS + 150) issues.push(`Слишком длинно: ${words} слов (нужно до ${EPISODE_MAX_WORDS})`);
  if (!episode.title || episode.title.split(/\s+/u).length > 8) issues.push('Название пустое или слишком длинное');
  if (!episode.hook || !episode.text.includes(episode.hook.slice(0, Math.min(40, episode.hook.length)))) issues.push('Нет крючка в конце серии');
  if (BANNED.test(`${episode.title} ${episode.text}`)) issues.push('Запрещённые слова или эмодзи');

  const known = new Set(series.characters.flatMap((character) => [character.name, ...character.aliases, character.name.split(' ')[0]]).map((name) => name.toLowerCase()));
  const introduced = new Set(previous.flatMap((episode) => episode.facts).join(' ').match(/\p{Lu}\p{Ll}+/gu)?.map((name) => name.toLowerCase()) ?? []);
  const declaredNew = new Set(episode.newCharacters.map((name) => name.toLowerCase()));
  const lowerText = episode.text.toLowerCase();
  if (!series.characters.some((character) => [character.name, ...character.aliases].some((name) => lowerText.includes(name.toLowerCase())))) {
    issues.push('В серии нет ни одного главного героя');
  }
  for (const name of episode.charactersUsed) {
    const lower = name.toLowerCase();
    const first = lower.split(' ')[0];
    if (!known.has(lower) && !known.has(first) && !declaredNew.has(lower) && !introduced.has(first)) {
      issues.push(`Незнакомый герой «${name}» — проверь, не путаница ли это с именами`);
    }
  }
  if (episode.newCharacters.length > 2) issues.push('Слишком много новых персонажей за серию');
  return issues;
}
