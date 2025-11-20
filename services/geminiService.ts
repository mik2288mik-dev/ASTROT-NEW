
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { UserProfile, NatalChartData, DailyHoroscope, WeeklyHoroscope, MonthlyHoroscope } from "../types";
import { SYSTEM_INSTRUCTION_ASTRA } from "../constants";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_NAME = "gemini-2.5-flash";

export const calculateNatalChart = async (profile: UserProfile): Promise<NatalChartData> => {
  const langPrompt = profile.language === 'ru' ? "Response must be in Russian language." : "Response must be in English.";
  
  const prompt = `
    Calculate the natal chart for ${profile.name}, born ${profile.birthDate} at ${profile.birthTime} in ${profile.birthPlace}.
    1. Identify Signs for Sun, Moon, Rising, Mercury, Venus, Mars.
    2. Identify the Dominant Element (Fire, Water, Air, Earth).
    3. Identify the Chart Ruler (Ruling Planet).
    4. Write a 2-paragraph professional, soulful summary of their personality.
    ${langPrompt}
  `;

  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      sun: { type: Type.OBJECT, properties: { planet: { type: Type.STRING }, sign: { type: Type.STRING }, description: { type: Type.STRING } } },
      moon: { type: Type.OBJECT, properties: { planet: { type: Type.STRING }, sign: { type: Type.STRING }, description: { type: Type.STRING } } },
      rising: { type: Type.OBJECT, properties: { planet: { type: Type.STRING }, sign: { type: Type.STRING }, description: { type: Type.STRING } } },
      mercury: { type: Type.OBJECT, properties: { planet: { type: Type.STRING }, sign: { type: Type.STRING }, description: { type: Type.STRING } } },
      venus: { type: Type.OBJECT, properties: { planet: { type: Type.STRING }, sign: { type: Type.STRING }, description: { type: Type.STRING } } },
      mars: { type: Type.OBJECT, properties: { planet: { type: Type.STRING }, sign: { type: Type.STRING }, description: { type: Type.STRING } } },
      element: { type: Type.STRING, description: "Dominant element" },
      rulingPlanet: { type: Type.STRING, description: "Chart ruler" },
      summary: { type: Type.STRING },
    },
    required: ["sun", "moon", "rising", "mercury", "venus", "mars", "element", "rulingPlanet", "summary"]
  };

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION_ASTRA,
      responseMimeType: "application/json",
      responseSchema: responseSchema,
      temperature: 0.7,
    }
  });

  if (!response.text) throw new Error("Failed to generate chart data");
  return JSON.parse(response.text) as NatalChartData;
};

export const getDailyHoroscope = async (profile: UserProfile, chartData: NatalChartData): Promise<DailyHoroscope> => {
  const langPrompt = profile.language === 'ru' ? "Response must be in Russian." : "Response must be in English.";
  
  // Highly personalized prompt asking for specific transit calculations
  const prompt = `
    Perform a DEEP astrological analysis for ${profile.name}.
    Birth Data: ${profile.birthDate}, ${profile.birthTime}, ${profile.birthPlace}.
    Target Date: ${new Date().toLocaleDateString()}.

    CRITICAL INSTRUCTIONS FOR PERSONALIZATION:
    1. Calculate the current transits relative to the user's NATAL CHART HOUSES (Placidus or Whole Sign).
    2. "Moon Impact": Identify strictly which NATAL HOUSE the Moon is transiting today and how that affects the user emotionally (e.g., "Moon in your 5th house of creativity").
    3. "Transit Focus": Identify one major specific aspect happening today (e.g. Transiting Mars square Natal Venus) and explain it.
    4. "Mood": Abstract feeling based on the elements.
    5. "Color" & "Number": Based on the day's planetary ruler.

    Your tone must be soulful, strict, and highly professional. No fluff.
    ${langPrompt}
  `;

  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      date: { type: Type.STRING },
      mood: { type: Type.STRING },
      color: { type: Type.STRING },
      number: { type: Type.NUMBER },
      content: { type: Type.STRING, description: "General advice based on transits" },
      moonImpact: { type: Type.STRING, description: "Specific house transit analysis for Moon" },
      transitFocus: { type: Type.STRING, description: "Specific planetary aspect active today" }
    },
    required: ["date", "mood", "color", "number", "content", "moonImpact"]
  };

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION_ASTRA,
      responseMimeType: "application/json",
      responseSchema: responseSchema,
    }
  });

  if (!response.text) throw new Error("Failed to generate horoscope");
  return JSON.parse(response.text) as DailyHoroscope;
};

export const getWeeklyHoroscope = async (profile: UserProfile, chartData: NatalChartData): Promise<WeeklyHoroscope> => {
  const langPrompt = profile.language === 'ru' ? "Response must be in Russian." : "Response must be in English.";
  
  const prompt = `
    Generate a weekly horoscope for ${profile.name}.
    Placements: Sun ${chartData.sun.sign}, Rising ${chartData.rising.sign}, Moon ${chartData.moon.sign}.
    Focus on real, actionable advice based on planetary movements for the week.
    ${langPrompt}
  `;

  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      weekRange: { type: Type.STRING },
      theme: { type: Type.STRING },
      advice: { type: Type.STRING },
      love: { type: Type.STRING },
      career: { type: Type.STRING }
    },
    required: ["weekRange", "theme", "advice", "love", "career"]
  };

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION_ASTRA,
      responseMimeType: "application/json",
      responseSchema: responseSchema,
    }
  });

  if (!response.text) throw new Error("Failed to generate weekly horoscope");
  return JSON.parse(response.text) as WeeklyHoroscope;
};

export const getMonthlyHoroscope = async (profile: UserProfile, chartData: NatalChartData): Promise<MonthlyHoroscope> => {
  const langPrompt = profile.language === 'ru' ? "Response must be in Russian." : "Response must be in English.";
  
  const prompt = `
    Generate a monthly horoscope for next month for ${profile.name}.
    Placements: Sun ${chartData.sun.sign}, Rising ${chartData.rising.sign}.
    Style: Editorial, comprehensive, analyzing major transits.
    ${langPrompt}
  `;

  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      month: { type: Type.STRING },
      theme: { type: Type.STRING },
      focus: { type: Type.STRING },
      content: { type: Type.STRING }
    },
    required: ["month", "theme", "focus", "content"]
  };

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION_ASTRA,
      responseMimeType: "application/json",
      responseSchema: responseSchema,
    }
  });

  if (!response.text) throw new Error("Failed to generate monthly horoscope");
  return JSON.parse(response.text) as MonthlyHoroscope;
};

export const getDeepDiveAnalysis = async (profile: UserProfile, topic: string, chartData: NatalChartData): Promise<string> => {
  const langPrompt = profile.language === 'ru' ? "Response must be in Russian." : "Response must be in English.";
  
  const prompt = `
    The user ${profile.name} wants a deep dive analysis on: "${topic}".
    Chart: Sun ${chartData.sun.sign}, Moon ${chartData.moon.sign}, Rising ${chartData.rising.sign}, Venus ${chartData.venus.sign}.
    Explain strictly based on their chart.
    ${langPrompt}
  `;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION_ASTRA,
    }
  });

  return response.text || "Stars are silent.";
};

export const chatWithAstra = async (history: { role: 'user' | 'model', text: string }[], message: string, profile: UserProfile): Promise<string> => {
    const langInstruction = profile.language === 'ru' ? "You must speak Russian." : "You must speak English.";
    
    const chat = ai.chats.create({
        model: MODEL_NAME,
        config: {
            systemInstruction: `
              ${SYSTEM_INSTRUCTION_ASTRA} 
              ${langInstruction} 
              Context: User is ${profile.name}, born ${profile.birthDate} in ${profile.birthPlace}.
              IMPORTANT: IGNORE non-astrology/spiritual questions. Return the user to the path of the stars.
            `,
        },
        history: history.map(h => ({
            role: h.role,
            parts: [{ text: h.text }]
        }))
    });

    const result = await chat.sendMessage({ message });
    return result.text || "The stars are clouded right now.";
}
