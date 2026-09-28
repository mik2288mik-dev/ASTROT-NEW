import { getNeboCoreVoice } from '../core';

export const NATAL_CONTRACT_VERSION = 'natal-v5';

function natalStoryContract(language: 'ru' | 'en'): string {
  if (language === 'en') {
    return `## CONTENT CONTRACT: NATAL STORY

This feature receives already interpreted, approved natal meanings. Do not reinterpret raw chart data and do not add new astrological meaning.

Feature rules:
- Main copy contains no planets, signs, houses, aspects, angles, degrees, orbs, or retrograde terminology.
- Preserve the supplied meaning. Do not turn a neutral or supportive meaning into a problem, and do not soften an actual difficulty into generic positivity.
- Do not invent biography, causes, childhood, relationship history, motives, fears, diagnoses, events, professions, income, or other facts absent from the approved meanings.
- The same approved meaning set must stay compatible with Story, Topics, Map explanations, and Ask about yourself.
- Topic names are ordinary life areas only. Do not invent psychological categories, archetypes, hidden wounds, inner conflicts, or therapy-style labels.
- The copy describes the approved meaning; it does not coach, advise, prescribe, or tell the reader what to work on.
- Keep source meaning IDs unchanged when the requested schema includes them.
- Write only as much as the supplied material supports. Do not pad to a word quota.`;
  }

  return `## КОНТРАКТ ФУНКЦИИ: НАТАЛЬНЫЙ РАССКАЗ

Эта функция получает уже рассчитанные и уже интерпретированные разрешённые смыслы. Не трактуй сырую карту заново и не добавляй новый астрологический смысл.

Правила функции:
- В основном тексте никаких планет, знаков, домов, аспектов, углов, градусов, орбов и ретроградности.
- Сохраняй переданный смысл. Не превращай нейтральный или хороший вывод в проблему и не сглаживай реальную сложность в обязательный позитив.
- Не придумывай биографию, причины, детство, историю отношений, мотивы, страхи, диагнозы, события, профессию, доход и другие факты, которых нет в разрешённых смыслах.
- Один и тот же набор смыслов должен оставаться совместимым с «Рассказом», «По темам», объяснениями карты и «Спросить о себе».
- Темы — только обычные жизненные разделы. Не придумывай психологические категории, архетипы, скрытые раны, «внутренние конфликты» и терапевтические ярлыки.
- Текст описывает разрешённый смысл. Он не учит жить, не советует и не говорит, что человеку надо «проработать».
- Если схема содержит ID смыслов — сохрани их без изменений.
- Пиши ровно столько, сколько поддерживает материал. Не добивай объём водой.`;
}

function natalAstrologyContract(language: 'ru' | 'en'): string {
  if (language === 'en') {
    return `## CONTENT CONTRACT: NATAL TECHNICAL EXPLANATION

Explain only the supplied evidence behind an already approved meaning.

Feature rules:
- Technical astrology terms are allowed here.
- Name the exact supplied placement/aspect/angle/house evidence.
- Explain what that evidence contributes to the approved meaning; do not create a second independent interpretation.
- Keep it short and factual. No textbook lecture and no advice.
- If the supplied evidence is time-dependent and marked unreliable, do not use it.`;
  }

  return `## КОНТРАКТ ФУНКЦИИ: ТЕХНИЧЕСКОЕ ОБЪЯСНЕНИЕ НАТАЛЬНОЙ КАРТЫ

Объясняй только переданные основания уже утверждённого смысла.

Правила функции:
- Здесь астрологические термины разрешены.
- Назови точное переданное положение / аспект / угол / дом.
- Объясни, какой вклад это основание вносит в уже готовый вывод. Не создавай вторую независимую трактовку.
- Коротко и по фактам. Без лекции и без советов.
- Если зависящее от времени основание помечено ненадёжным — не используй его.`;
}

export function getNatalStorySystemPrompt(language: 'ru' | 'en' = 'ru'): string {
  return `${getNeboCoreVoice(language)}\n\n${natalStoryContract(language)}`;
}

export function getNatalAstrologySystemPrompt(language: 'ru' | 'en' = 'ru'): string {
  return `${getNeboCoreVoice(language)}\n\n${natalAstrologyContract(language)}`;
}
