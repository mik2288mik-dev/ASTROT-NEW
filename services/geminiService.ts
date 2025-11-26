
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { UserProfile, NatalChartData, DailyHoroscope, WeeklyHoroscope, MonthlyHoroscope, ThreeKeys, SynastryResult, UserContext, UserEvolution } from "../types";
import { SYSTEM_INSTRUCTION_ASTRA } from "../constants";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || process.env.GEMINI_API_KEY || '' });
const MODEL_NAME = "gemini-2.5-flash";

// Helper to select language prompt
const getLangPrompt = (lang: string) => lang === 'ru' ? "Response must be in Russian." : "Response must be in English.";

export const calculateNatalChart = async (profile: UserProfile): Promise<NatalChartData> => {
  const prompt = `
    Calculate natal chart for ${profile.name}, ${profile.birthDate} ${profile.birthTime}, ${profile.birthPlace}.
    Return strict JSON.
    1. Sun/Moon/Rising/Mercury/Venus/Mars signs.
    2. Dominant Element & Ruler.
    3. A professional, soulful summary (2 paragraphs).
    ${getLangPrompt(profile.language)}
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
      element: { type: Type.STRING },
      rulingPlanet: { type: Type.STRING },
      summary: { type: Type.STRING },
    },
    required: ["sun", "moon", "rising", "mercury", "venus", "mars", "element", "rulingPlanet", "summary"]
  };

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: { systemInstruction: SYSTEM_INSTRUCTION_ASTRA, responseMimeType: "application/json", responseSchema: responseSchema }
  });

  return JSON.parse(response.text!) as NatalChartData;
};

export const getThreeKeys = async (profile: UserProfile, chartData: NatalChartData): Promise<ThreeKeys> => {
  const prompt = `
    Create a "Hook" analysis for ${profile.name} based on their chart (${chartData.sun.sign} Sun, ${chartData.moon.sign} Moon, ${chartData.rising.sign} Rising).
    Generate 3 short, punchy, intriguing "Keys" to their personality.
    Key 1 (Energy): Combine Sun/Moon/Rising into a "Superpower".
    Key 2 (Love): Analyze Venus (${chartData.venus.sign}) + Mars. Define their "Love Style".
    Key 3 (Career): Define their "Career Archetype" based on the chart.
    
    Style: Mystical, direct, intriguing. Like a best friend revealing a secret.
    ${getLangPrompt(profile.language)}
  `;

  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      key1: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, text: { type: Type.STRING } } },
      key2: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, text: { type: Type.STRING } } },
      key3: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, text: { type: Type.STRING } } },
    },
    required: ["key1", "key2", "key3"]
  };

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: { systemInstruction: SYSTEM_INSTRUCTION_ASTRA, responseMimeType: "application/json", responseSchema: responseSchema }
  });

  return JSON.parse(response.text!) as ThreeKeys;
};

export const calculateSynastry = async (profile: UserProfile, partnerName: string, partnerDate: string): Promise<SynastryResult> => {
    const prompt = `
      Calculate Synastry (Compatibility) between ${profile.name} (Born: ${profile.birthDate}) and ${partnerName} (Born: ${partnerDate}).
      Analyze the planetary aspects roughly based on signs.
      Provide a Compatibility Score (0-100).
      Describe the Emotional Connection, Intellectual Bond, and the Main Challenge.
      ${getLangPrompt(profile.language)}
    `;

    const responseSchema: Schema = {
        type: Type.OBJECT,
        properties: {
            compatibilityScore: { type: Type.NUMBER },
            emotionalConnection: { type: Type.STRING },
            intellectualConnection: { type: Type.STRING },
            challenge: { type: Type.STRING },
            summary: { type: Type.STRING }
        },
        required: ["compatibilityScore", "emotionalConnection", "intellectualConnection", "challenge", "summary"]
    };

    const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: { systemInstruction: SYSTEM_INSTRUCTION_ASTRA, responseMimeType: "application/json", responseSchema: responseSchema }
    });

    return JSON.parse(response.text!) as SynastryResult;
};

export const getDailyHoroscope = async (profile: UserProfile, chartData: NatalChartData, context?: UserContext): Promise<DailyHoroscope> => {
  // Injecting Context for "Wow" factor
  const contextString = context 
      ? `User Context: Weather is ${context.weather}. Current Mood/Vibe: ${context.mood || 'Neutral'}.` 
      : "";

  const prompt = `
    Personalized Daily Horoscope for ${profile.name}.
    Focus: Transits to Natal Houses.
    ${contextString}
    IMPORTANT: If context is provided, weave it into the advice (e.g. "Since it's ${context?.weather}, Mercury suggests...").
    1. "Moon Impact": Specific House transit.
    2. "Transit Focus": One major aspect.
    3. Mood/Color/Number.
    ${getLangPrompt(profile.language)}
  `;

  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      date: { type: Type.STRING },
      mood: { type: Type.STRING },
      color: { type: Type.STRING },
      number: { type: Type.NUMBER },
      content: { type: Type.STRING },
      moonImpact: { type: Type.STRING },
      transitFocus: { type: Type.STRING }
    },
    required: ["date", "mood", "color", "number", "content", "moonImpact"]
  };

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: { systemInstruction: SYSTEM_INSTRUCTION_ASTRA, responseMimeType: "application/json", responseSchema: responseSchema }
  });

  return JSON.parse(response.text!) as DailyHoroscope;
};

export const updateUserEvolution = async (profile: UserProfile): Promise<UserEvolution> => {
    // If no evolution exists, initialize
    const currentEvo = profile.evolution || {
        level: 1,
        title: "Seeker",
        stats: { intuition: 50, confidence: 50, awareness: 50 },
        lastUpdated: Date.now()
    };

    // Simulate "AI Analysis" of recent growth (Mocking complexity for speed)
    // In a real app, we would analyze chat history depth.
    const updatedStats = {
        intuition: Math.min(100, currentEvo.stats.intuition + Math.floor(Math.random() * 5)),
        confidence: Math.min(100, currentEvo.stats.confidence + Math.floor(Math.random() * 3)),
        awareness: Math.min(100, currentEvo.stats.awareness + Math.floor(Math.random() * 4)),
    };
    
    let newLevel = currentEvo.level;
    if ((updatedStats.intuition + updatedStats.confidence + updatedStats.awareness) / 3 > (newLevel * 30)) {
        newLevel += 1;
    }

    // AI could generate the title based on stats
    const titles = ["Seeker", "Apprentice", "Mystic", "Guide", "Master"];
    const newTitle = titles[Math.min(newLevel - 1, 4)];

    return {
        level: newLevel,
        title: newTitle,
        stats: updatedStats,
        lastUpdated: Date.now()
    };
};

export const getWeeklyHoroscope = async (profile: UserProfile, chartData: NatalChartData): Promise<WeeklyHoroscope> => {
  const prompt = `
    Weekly Horoscope for ${profile.name}.
    Focus: Actionable advice for the week ahead based on transits.
    ${getLangPrompt(profile.language)}
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
      config: { systemInstruction: SYSTEM_INSTRUCTION_ASTRA, responseMimeType: "application/json", responseSchema: responseSchema }
  });
  return JSON.parse(response.text!) as WeeklyHoroscope;
};

export const getMonthlyHoroscope = async (profile: UserProfile, chartData: NatalChartData): Promise<MonthlyHoroscope> => {
    const prompt = `Monthly Horoscope for ${profile.name}. Editorial style. ${getLangPrompt(profile.language)}`;
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
        config: { systemInstruction: SYSTEM_INSTRUCTION_ASTRA, responseMimeType: "application/json", responseSchema: responseSchema }
    });
    return JSON.parse(response.text!) as MonthlyHoroscope;
};

export const getDeepDiveAnalysis = async (profile: UserProfile, topic: string, chartData: NatalChartData): Promise<string> => {
  const prompt = `Deep dive on ${topic} for ${profile.name}. Chart: Sun ${chartData.sun.sign}. ${getLangPrompt(profile.language)}`;
  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: { systemInstruction: SYSTEM_INSTRUCTION_ASTRA }
  });
  return response.text || "Stars are silent.";
};

export const chatWithAstra = async (history: { role: 'user' | 'model', text: string }[], message: string, profile: UserProfile): Promise<string> => {
    const chat = ai.chats.create({
        model: MODEL_NAME,
        config: {
            systemInstruction: `${SYSTEM_INSTRUCTION_ASTRA} ${getLangPrompt(profile.language)} Context: User ${profile.name}.`,
        },
        history: history.map(h => ({ role: h.role, parts: [{ text: h.text }] }))
    });
    const result = await chat.sendMessage({ message });
    return result.text || "The stars are clouded.";
}