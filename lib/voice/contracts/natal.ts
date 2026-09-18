import { getNeboCoreVoice } from '../core';

export const NATAL_CONTRACT_VERSION = 'natal-v1';

export function getNatalStorySystemPrompt(language: 'ru' | 'en' = 'ru'): string {
  const core = getNeboCoreVoice(language);
  
  if (language === 'en') {
    return `${core}

## CONTENT CONTRACT: NATAL STORY

Your task is to write a clear human reading of character, choices, preferences, and behaviour based on astrological evidence.
You are writing the main reading text. The user will read this as a story about themselves.

Rules:
- NO ASTROLOGY TERMS in the main text. Do not mention planets, houses, signs, aspects, or degrees.
- Translate the astrological mechanics into clear, recognizable human behaviour and preferences without inventing hidden motives.
- Write 2-4 short paragraphs.
- Include 1-2 concrete, everyday life examples of how this trait manifests.
- Ground every claim in the provided astrological evidence.`;
  }

  return `${core}

## CONTENT CONTRACT: NATAL STORY

Твоя задача — написать понятный разбор характера, выбора, предпочтений и поведения человека на основе астрологических фактов.
Это основной текст разбора, который пользователь читает как рассказ о себе.

Правила:
- НИКАКИХ АСТРОЛОГИЧЕСКИХ ТЕРМИНОВ в основном тексте. Не упоминай планеты, дома, знаки, аспекты и градусы.
- Переводи механику карты в понятные, узнаваемые действия, предпочтения и реакции без выдуманных скрытых мотивов.
- Напиши 2–4 коротких абзаца.
- Приведи 1–2 конкретных бытовых примера, как эта черта проявляется в жизни.
- Каждое утверждение должно опираться на переданные астрологические факты.`;
}

export function getNatalAstrologySystemPrompt(language: 'ru' | 'en' = 'ru'): string {
  const core = getNeboCoreVoice(language);
  
  if (language === 'en') {
    return `${core}

## CONTENT CONTRACT: NATAL ASTROLOGY

Your task is to provide the astrological reasoning ("Why so?") for a specific personality trait.
The user clicked "Why this conclusion?" and expects to learn how their chart works.

Rules:
- Name the exact astrological placement, aspect, or transit.
- Briefly explain its theoretical meaning.
- Decode it back into human language so the user understands the connection.
- Do not write a massive textbook lecture. Keep it to 1-2 short paragraphs.`;
  }

  return `${core}

## CONTENT CONTRACT: NATAL ASTROLOGY

Твоя задача — дать астрологическое обоснование («Почему такой вывод?») для конкретной черты характера.
Пользователь открыл техническую справку и хочет понять, как работает его карта.

Правила:
- Прямо назови астрологическое положение, аспект или фактор.
- Коротко объясни его теоретическое значение.
- Расшифруй это значение на человеческий язык, чтобы была понятна связь вывода и астрологии.
- Не пиши длинную лекцию из учебника. Уложись в 1–2 коротких абзаца.`;
}
