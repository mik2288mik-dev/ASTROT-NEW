# Руководство по AI Промптам для Астры

Этот документ описывает систему промптов для генерации астрологических интерпретаций через AI модели (OpenAI, Google Gemini, Anthropic Claude и т.д.).

## 📁 Структура

Все промпты находятся в файле `/lib/prompts.ts`.

## 🎭 Базовый SYSTEM Промпт

**Файл**: `SYSTEM_PROMPT_ASTRA` в `lib/prompts.ts`

Этот промпт определяет личность Астры - добрую и мудрую астрологиню, которая говорит простым человеческим языком. 

### Ключевые характеристики Астры:

- ✅ Говорит на "ты", тепло и уважительно
- ✅ Переводит астрологию на язык жизни (характер, привычки, эмоции)
- ✅ Даёт поддержку без запугивания и фатализма
- ❌ Не использует технические термины ("квадратура", "тригон", "MC")
- ❌ Не даёт категоричных обещаний
- ❌ Не даёт медицинских, юридических или финансовых диагнозов

### Использование:

```typescript
import { SYSTEM_PROMPT_ASTRA } from '../lib/prompts';

// Для OpenAI
const response = await openai.chat.completions.create({
  model: "gpt-4",
  messages: [
    { role: "system", content: SYSTEM_PROMPT_ASTRA },
    { role: "user", content: userPrompt }
  ]
});

// Для Google Gemini
const model = genAI.getGenerativeModel({ 
  model: "gemini-pro",
  systemInstruction: SYSTEM_PROMPT_ASTRA
});
```

## 🔑 Промпты для конкретных задач

### 1. Три Ключа (Three Keys)

**Функция**: `createThreeKeysPrompt(natalData, profile)`

Генерирует 3 ключевых блока:
- 🔥 **ТВОЯ ЭНЕРГИЯ** - ядро личности, стиль, жизненная сила
- 💖 **ТВОЙ СТИЛЬ ЛЮБВИ** - как человек чувствует, любит, строит отношения
- 💼 **ТВОЯ КАРЬЕРА** - как проявляется в работе и самореализации

**Формат ответа**: JSON

```json
{
  "key1": {
    "title": "ТВОЯ ЭНЕРГИЯ",
    "text": "2-3 абзаца текста (400-600 знаков)",
    "advice": ["совет 1", "совет 2", "совет 3"]
  },
  "key2": {
    "title": "ТВОЙ СТИЛЬ ЛЮБВИ",
    "text": "...",
    "advice": ["..."]
  },
  "key3": {
    "title": "ТВОЯ КАРЬЕРА",
    "text": "...",
    "advice": ["..."]
  }
}
```

**Пример использования**:

```typescript
import { SYSTEM_PROMPT_ASTRA, createThreeKeysPrompt } from '../lib/prompts';

const userPrompt = createThreeKeysPrompt(chartData, profile);

const response = await openai.chat.completions.create({
  model: "gpt-4",
  messages: [
    { role: "system", content: SYSTEM_PROMPT_ASTRA },
    { role: "user", content: userPrompt }
  ],
  response_format: { type: "json_object" }
});

const threeKeys = JSON.parse(response.choices[0].message.content);
```

### 2. Паспорт Души (Soul Passport)

**Функция**: `createSoulPassportPrompt(natalData, profile)`

Генерирует краткое общее описание человека - "мини-паспорт души".

**Формат ответа**: Текст (800-1200 знаков)

Структура:
1. Обращение по имени
2. 2-3 абзаца общего описания (характер, энергия, способ воспринимать мир)
3. Список из 3-5 буллетов "о тебе":
   - "ты легко..."
   - "тебе важно..."
   - "у тебя сильная сторона в том, что..."

**Пример использования**:

```typescript
import { SYSTEM_PROMPT_ASTRA, createSoulPassportPrompt } from '../lib/prompts';

const userPrompt = createSoulPassportPrompt(chartData, profile);

const response = await openai.chat.completions.create({
  model: "gpt-4",
  messages: [
    { role: "system", content: SYSTEM_PROMPT_ASTRA },
    { role: "user", content: userPrompt }
  ]
});

const soulPassport = response.choices[0].message.content;
```

### 3. Персональный Прогноз на День

**Функция**: `createDailyForecastPrompt(natalData, profile, currentDate)`

Генерирует прогноз на день с учётом текущих транзитов.

**Формат ответа**: JSON

```json
{
  "mood": "Вдохновлённый",
  "content": "2-3 абзаца (300-500 знаков)",
  "advice": ["совет 1", "совет 2", "совет 3"],
  "color": "Фиолетовый",
  "number": 7
}
```

### 4. Недельный Прогноз

**Функция**: `createWeeklyForecastPrompt(natalData, profile, weekRange)`

**Формат ответа**: JSON

```json
{
  "theme": "Новые возможности",
  "advice": "Общий совет на неделю (2-3 абзаца)",
  "love": "Фокус в любви",
  "career": "Фокус в карьере"
}
```

### 5. Месячный Прогноз

**Функция**: `createMonthlyForecastPrompt(natalData, profile, month)`

**Формат ответа**: JSON

```json
{
  "theme": "Трансформация",
  "focus": "Главный фокус месяца (1 предложение)",
  "content": "Развёрнутый прогноз (3-4 абзаца, 600-900 знаков)"
}
```

### 6. Глубокий Анализ (Deep Dive)

**Функция**: `createDeepDivePrompt(natalData, profile, topic)`

Создаёт глубокий персональный анализ по конкретной теме (например, "карьера", "отношения", "здоровье").

**Формат ответа**: Текст (800-1200 знаков)

### 7. Совместимость (Синастрия)

**Функция**: `createSynastryPrompt(natalData1, profile1, natalData2, partnerName)`

Анализирует совместимость между двумя людьми.

**Формат ответа**: JSON

```json
{
  "compatibilityScore": 75,
  "emotionalConnection": "2-3 предложения",
  "intellectualConnection": "2-3 предложения",
  "challenge": "2-3 предложения",
  "summary": "2-3 предложения"
}
```

## 🌍 Поддержка Языков

Все промпты написаны на русском языке, но содержат инструкцию о том, что Астра должна отвечать на языке пользователя (русский или английский).

Для добавления языковой инструкции используйте:

```typescript
import { addLanguageInstruction } from '../lib/prompts';

const prompt = createThreeKeysPrompt(chartData, profile);
const promptWithLang = addLanguageInstruction(prompt, profile.language);
```

## 🔧 Интеграция с AI Сервисами

### OpenAI GPT-4

```typescript
import OpenAI from 'openai';
import { SYSTEM_PROMPT_ASTRA, createThreeKeysPrompt } from '../lib/prompts';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateThreeKeys(chartData, profile) {
  const userPrompt = createThreeKeysPrompt(chartData, profile);
  
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      { role: "system", content: SYSTEM_PROMPT_ASTRA },
      { role: "user", content: userPrompt }
    ],
    response_format: { type: "json_object" }, // Для JSON ответов
    temperature: 0.7,
  });

  return JSON.parse(response.choices[0].message.content);
}
```

### Google Gemini

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';
import { SYSTEM_PROMPT_ASTRA, createThreeKeysPrompt } from '../lib/prompts';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function generateThreeKeys(chartData, profile) {
  const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-pro",
    systemInstruction: SYSTEM_PROMPT_ASTRA
  });
  
  const userPrompt = createThreeKeysPrompt(chartData, profile);
  const result = await model.generateContent(userPrompt);
  const response = await result.response;
  
  return JSON.parse(response.text());
}
```

### Anthropic Claude

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT_ASTRA, createThreeKeysPrompt } from '../lib/prompts';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function generateThreeKeys(chartData, profile) {
  const userPrompt = createThreeKeysPrompt(chartData, profile);
  
  const response = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 2000,
    system: SYSTEM_PROMPT_ASTRA,
    messages: [
      { role: "user", content: userPrompt }
    ]
  });

  return JSON.parse(response.content[0].text);
}
```

## 📊 Пример полной интеграции в API

Создайте файл `/pages/api/astrology/ai-three-keys.ts`:

```typescript
import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import { SYSTEM_PROMPT_ASTRA, createThreeKeysPrompt, ThreeKeysAIResponse } from '../../../lib/prompts';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { profile, chartData } = req.body;

    if (!chartData || !chartData.sun || !chartData.moon) {
      return res.status(400).json({ error: 'Invalid chart data' });
    }

    // Создаём промпт
    const userPrompt = createThreeKeysPrompt(chartData, profile);

    // Отправляем в OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: SYSTEM_PROMPT_ASTRA },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    // Парсим ответ
    const threeKeys: ThreeKeysAIResponse = JSON.parse(
      response.choices[0].message.content || '{}'
    );

    return res.status(200).json(threeKeys);
  } catch (error: any) {
    console.error('Error generating three keys:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
```

## 🎨 Настройка стиля ответов

Температура (Temperature) влияет на креативность:
- `0.3-0.5` - более предсказуемые, точные ответы
- `0.7-0.8` - хороший баланс точности и креативности (рекомендуется)
- `0.9-1.0` - очень креативные, менее предсказуемые

```typescript
const response = await openai.chat.completions.create({
  model: "gpt-4",
  temperature: 0.7, // ⬅ Настройте здесь
  // ...
});
```

## 💡 Лучшие практики

1. **Всегда используйте SYSTEM_PROMPT_ASTRA** как системный промпт - он задаёт личность Астры
2. **Включайте полные данные натальной карты** - больше данных = более точные интерпретации
3. **Используйте JSON mode для структурированных ответов** - проще парсить и валидировать
4. **Добавляйте обработку ошибок** - AI может вернуть невалидный JSON
5. **Кэшируйте результаты** - не генерируйте одно и то же многократно
6. **Следите за токенами** - длинные промпты = больше расходов

## 🔐 Безопасность

1. **НИКОГДА не коммитьте API ключи** - используйте `.env`:

```bash
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...
ANTHROPIC_API_KEY=...
```

2. **Используйте rate limiting** для защиты от злоупотреблений

3. **Валидируйте входные данные** перед отправкой в AI

## 📈 Мониторинг и логирование

Добавьте логирование для отслеживания качества:

```typescript
console.log('[AI] Prompt tokens:', response.usage.prompt_tokens);
console.log('[AI] Completion tokens:', response.usage.completion_tokens);
console.log('[AI] Total cost:', calculateCost(response.usage));
```

## 🧪 Тестирование

Создайте тестовые данные для разработки:

```typescript
const testNatalData = {
  sun: { planet: 'Sun', sign: 'Leo', degree: 15.5, description: '...' },
  moon: { planet: 'Moon', sign: 'Cancer', degree: 8.2, description: '...' },
  // ...
};

const testProfile = {
  name: 'Анна',
  language: 'ru',
  birthDate: '1990-08-15',
  // ...
};
```

## 📚 Дополнительные ресурсы

- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Google Gemini API](https://ai.google.dev/docs)
- [Anthropic Claude API](https://docs.anthropic.com/)

## 🆘 Поддержка

При возникновении вопросов или проблем:
1. Проверьте логи API
2. Убедитесь, что API ключи действительны
3. Проверьте формат входных данных
4. Посмотрите примеры в этом документе

---

**Версия**: 1.0
**Последнее обновление**: 2025-11-28
