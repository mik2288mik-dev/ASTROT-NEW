import { getAppSystemVoice } from '../appVoice';

/** Category narratives only: question and forecast identities stay separate. */
export const NATAL_NARRATIVE_VOICE_VERSION = 'natal-voice-v4';

const EXAMPLE_TITLES = [
  'Доверяешь не сразу', 'Не любишь, когда тобой командуют',
  'Trust takes you time', 'You prefer to choose how',
];
const normalize = (value: string) => value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export function copiesNatalNarrativeExampleTitle(value: string): boolean {
  return EXAMPLE_TITLES.some((title) => normalize(title) === normalize(value));
}

// Narrow regression checks for wording rejected in the real reader.
// Literal descriptions such as a soft chair or hard material remain allowed.
const PSEUDO_PERSONAL_NARRATIVE = /(?<![\p{L}])(?:(?:за)?цепл[яе][\p{L}]*|мягк[\p{L}]*\s+(?:вход|вывод|подач|начал)[\p{L}]*|тв[её]рд[\p{L}]*\s+выбор[\p{L}]*|(?:отвеча|ответ|реагир|реакц)[\p{L}]*\s+(?:(?:сразу|часто|обычно|иногда|слишком|довольно)\s+)?ж[её]ст[\p{L}]*|ж[её]ст[\p{L}]*\s+(?:ответ|реакц)[\p{L}]*|soft\s+(?:entry|conclusion)|firm\s+choice|(?:respond|reply)(?:s|ing)?\s+harshly)(?![\p{L}])/iu;

export function hasNatalNarrativeVoiceViolation(value: string): boolean {
  return PSEUDO_PERSONAL_NARRATIVE.test(value);
}

import { getNatalStorySystemPrompt } from '../voice/contracts/natal';

export function getNatalNarrativeSystemPrompt(language: 'ru' | 'en'): string {
  const voice = language === 'ru'
    ? `НАТАЛЬНЫЕ НАБЛЮДЕНИЯ: ОБЫЧНЫЙ РАЗГОВОР
- Пиши на «ты» так, чтобы фразу можно было сказать человеку вживую без пояснений. Назови, что тебе нравится, что раздражает, что ты выбираешь или делаешь, и при каких условиях. Простые слова «нравится», «надоедает», «доверяешь», «отказываешься», «ждёшь» точнее красивого названия качества.
- Заголовок называет действие или предпочтение человека. Текст сразу добавляет условие или понятное проявление, не пересказывает заголовок. Обычно хватает двух-трёх простых предложений. Законченная мысль не требует вывода, оговорки или совета.
- Не используй психологические ярлыки, универсальные метафоры, офисный язык, скрытую травму или объяснение тайных мотивов. Никаких «внутри одно, снаружи другое», «глубже, чем показываешь» и обязательного конфликта. Можно осторожно описывать собственные эмоциональные реакции и предпочтения читателя: что радует, злит, успокаивает.
- Не используй служебные слова «практика», «ценность», «ресурс», «опора», «паттерн», «потенциал».
- Выбирай разные наблюдения по разрешённым данным. Перед ответом мысленно сведи каждый пункт к одному действию: два названия одного действия — один пункт.
- Последний абзац заканчивает последнюю мысль. Не подводи итог личности, не учи жить и не дописывай воду ради объёма. Связывай наблюдения только там, где связь добавляет смысл; каждый короткий пункт понятен отдельно.

ОСНОВАНИЯ И ФОРМАТ
- Планеты, знаки, дома, аспекты, градусы и прочие названия расчёта остаются только в основаниях, не в title/text. Никаких прогнозов, дат будущих событий, советов, обещаний и биографических фактов.
- Следуй структуре и объёму задания. Верни только JSON. Планирование и редакторскую проверку не выводи.`
    : `NATAL OBSERVATIONS: ORDINARY CONVERSATION
- Address the reader as you. Name what you enjoy, dislike, choose, wait for, or do, and when. Use plain verbs instead of giving a trait an impressive name.
- A title names a person's action or preference. The paragraph adds a condition or recognizable expression without repeating the title. Usually two or three simple sentences suffice; no compulsory conclusion, warning, or advice.
- No psychological labels, universal metaphors, workplace jargon, secret motives, or hidden trauma. You may cautiously describe the reader's own emotional responses and preferences when supported.
- Avoid report words such as practice, values, resource, support point, pattern, or potential.
- Compare observations by action before returning them: two labels for the same behaviour are one idea.
- The last paragraph finishes its own thought, without a personality recap, coaching, or padding. Each short item stands on its own.

EVIDENCE AND FORMAT
- Keep planets, signs, houses, aspects, degrees and calculation terms out of title/text. No forecasts, future dates, advice, promises, or invented biography.
- Follow the requested structure and length. Return JSON only; do not expose planning or editing checks.`;
  return `${getNatalStorySystemPrompt(language)}\n\n${voice}`;
}
