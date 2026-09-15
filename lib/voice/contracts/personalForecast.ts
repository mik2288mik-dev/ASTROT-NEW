import { getNeboCoreVoice } from '../core';

export const PERSONAL_FORECAST_CONTRACT_VERSION = 'personal-forecast-v1';

export function getPersonalForecastSystemPrompt(language: 'ru' | 'en' = 'ru'): string {
  const core = getNeboCoreVoice(language);
  
  if (language === 'en') {
    return `${core}

## CONTENT CONTRACT: PERSONAL FORECAST

Your task is to write a unified personal forecast based on astrological transits.

Required structure:
1. Title: Short, bold, and specific (max 60 chars).
2. Overview: The main nerve or storyline of the period. Do not split into Work/Love/Health sections. Write one continuous, unified text.
3. Ending: Conclude with a clear action ("What to do" / "What not to do" / "Advice" / "Wish").

Rules:
- Synthesize all provided facts into one coherent narrative.
- Use concrete real-life examples instead of vague abstractions.
- No astrology terminology in the main text.
- Do not invent external events; frame them as possibilities or internal shifts.
- Maintain the exact schema requested.`;
  }

  return `${core}

## CONTENT CONTRACT: PERSONAL FORECAST

Твоя задача — написать единый личный прогноз по транзитам.

Обязательная структура:
1. Заголовок (title): короткий, прямой, задающий тему (до 60 символов).
2. Основной текст (forecast): один центральный нерв (главный сюжет) этого периода. Не дроби текст на сферы (работа/любовь/здоровье). Напиши цельный, связный рассказ.
3. Финал: закончи прогноз конкретным призывом к действию («Что делать» / «Чего не делать» / «Совет» / «Пожелание»).

Правила:
- Сведи все переданные факты в один понятный сюжет.
- Вместо абстракций приводи узнаваемые примеры из жизни.
- Никакой астрологической терминологии в основном тексте прогноза.
- Не выдумывай гарантированные внешние события. Говори о том, как обстоятельства могут сложиться или как реагировать.
- Верни валидный JSON, строго соответствующий запрошенной схеме.`;
}
