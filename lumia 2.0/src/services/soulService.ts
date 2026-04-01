import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface NatalData {
  birthDate: string;
  birthTime: string;
  birthPlace: string;
}

export interface SoulMapResponse {
  core: {
    title: string;
    description: string;
  };
  traits: {
    label: string;
    description: string;
  }[];
  advice: string;
  premiumPreview?: string;
}

export async function getSoulMap(data: NatalData, isPremium: boolean = false): Promise<SoulMapResponse> {
  const prompt = `
    Ты — эксперт по натальным картам, который говорит на простом, "человеческом" языке. 
    Твоя задача: составить "Карту Души" для человека, родившегося ${data.birthDate} в ${data.birthTime} в городе ${data.birthPlace}.
    
    ПРАВИЛА:
    1. НИКАКИХ астрологических терминов (Луна в Тельце, 5-й дом, тригон, ретроградный Меркурий — ЗАПРЕЩЕНО).
    2. Используй только понятные психологические и жизненные описания.
    3. Стиль: вдохновляющий, глубокий, но приземленный.
    4. Язык: Русский.
    
    Формат ответа (JSON):
    {
      "core": {
        "title": "Название твоей сути (метафоричное, например: Хранитель внутреннего света)",
        "description": "Глубокое описание того, кто ты есть (начинай с 'Вы — человек...' или 'Твоя природа...') — 3-4 предложения."
      },
      "traits": [
        { "label": "Общение и мысли", "description": "Цельный, красивый текст о том, как человек взаимодействует с миром и информацией." },
        { "label": "Внутренняя опора", "description": "Рассказ о скрытых талантах и том, что дает силы." },
        { "label": "Жизненный урок", "description": "О том, с чем приходится сталкиваться и как это преодолевать." }
      ],
      "advice": "Совет на текущий период жизни",
      "premiumPreview": "${isPremium ? "" : "Краткий тизер того, что доступно в премиум-версии (например, глубокий разбор предназначения)"}"
    }
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    },
  });

  try {
    return JSON.parse(response.text || "{}");
  } catch (e) {
    throw new Error("Failed to parse soul map");
  }
}

export interface CompatibilityData extends NatalData {
  name?: string;
}

export type UnionType = 'love' | 'business' | 'friendship' | 'family';

export async function getCompatibility(
  person1: CompatibilityData, 
  person2: CompatibilityData, 
  type: UnionType = 'love'
): Promise<any> {
  const typeLabels = {
    love: 'Романтический союз',
    business: 'Деловое партнерство',
    friendship: 'Дружба',
    family: 'Семейные узы'
  };

  const prompt = `
    Проанализируй совместимость двух людей для типа отношений: ${typeLabels[type]}.
    Человек 1: ${person1.birthDate}, ${person1.birthTime}, ${person1.birthPlace}
    Человек 2: ${person2.birthDate}, ${person2.birthTime}, ${person2.birthPlace}
    
    Опиши их взаимодействие на простом, глубоком языке без астрологических терминов.
    Формат JSON:
    {
      "score": 0-100,
      "summary": "Общая суть этого союза (2-3 предложения)",
      "strengths": ["сильная сторона 1", "сильная сторона 2"],
      "challenges": ["над чем работать 1", "над чем работать 2"],
      "advice": "Главный совет для гармонии в этом союзе"
    }
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    },
  });

  return JSON.parse(response.text || "{}");
}

export async function getZodiacHoroscope(sign: string): Promise<string> {
  const prompt = `Напиши вдохновляющий гороскоп на сегодня для знака ${sign} на простом человеческом языке без сложной астрологии. 2-3 предложения.`;
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
  });
  return response.text || "";
}

export async function getPersonalizedHoroscope(data: NatalData): Promise<string> {
  const prompt = `
    Составь персональный прогноз на сегодня на основе натальных данных: ${data.birthDate}, ${data.birthTime}, ${data.birthPlace}.
    Используй транзиты, но описывай их как "внутренние ритмы" и "атмосферу дня". 
    НИКАКИХ терминов типа "квадрат Сатурна". 
    Стиль: глубокий, поддерживающий. 3-4 предложения.
  `;
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
  });
  return response.text || "";
}
