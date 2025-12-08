
import { UserProfile, UserContext, ZodiacSign } from "../types";

const SOCIAL_PROOF_TEMPLATES = {
    ru: [
        "87% пользователей с вашим знаком нашли любовь в этом месяце.",
        "Вчера 5 человек с вашим Асцендентом получили повышение.",
        "Люди с вашей Луной сегодня особенно интуитивны.",
        "Ваш уровень осознанности выше, чем у 65% пользователей."
    ],
    en: [
        "87% of users with your placement found love this month.",
        "Yesterday, 5 people with your Rising sign got promoted.",
        "People with your Moon are especially intuitive today.",
        "Your awareness score is higher than 65% of users."
    ]
};

/**
 * Fetches weather data from WeatherAPI.com
 */
const fetchWeatherData = async (city: string): Promise<UserContext['weatherData'] | null> => {
    try {
        const API_BASE_URL = typeof window !== 'undefined' ? '' : process.env.NEXT_PUBLIC_API_URL || '';
        const response = await fetch(`${API_BASE_URL}/api/weather?city=${encodeURIComponent(city)}`);
        
        if (!response.ok) {
            console.warn('[ContextService] Failed to fetch weather:', response.status);
            return null;
        }

        const result = await response.json();
        if (result.success && result.data) {
            return result.data;
        }
        
        return null;
    } catch (error) {
        console.error('[ContextService] Error fetching weather:', error);
        return null;
    }
};

/**
 * Gets user context including weather and social proof
 */
export const getUserContext = async (profile: UserProfile): Promise<UserContext> => {
    const context: UserContext = {
        mood: 'Neutral' // Default, updated by Chat
    };

    // 1. Fetch Weather Data if city is set
    if (profile.weatherCity) {
        const weatherData = await fetchWeatherData(profile.weatherCity);
        if (weatherData) {
            context.weatherData = weatherData;
            // Для обратной совместимости сохраняем также в weather
            context.weather = weatherData.condition;
            context.moonPhase = weatherData.moonPhase;
        }
    }
    
    // 2. Generate Social Proof based on Sign/Profile
    const proofs = profile.language === 'ru' ? SOCIAL_PROOF_TEMPLATES.ru : SOCIAL_PROOF_TEMPLATES.en;
    const randomProof = proofs[Math.floor(Math.random() * proofs.length)];
    context.socialProof = randomProof;

    return context;
};

/**
 * Simple heuristic to detect mood from text (Mock for on-device AI)
 */
export const detectMoodFromText = (text: string): string => {
    const lower = text.toLowerCase();
    if (lower.includes('love') || lower.includes('heart') || lower.includes('happy')) return 'Romantic';
    if (lower.includes('sad') || lower.includes('lost') || lower.includes('pain')) return 'Melancholy';
    if (lower.includes('work') || lower.includes('money') || lower.includes('job')) return 'Focused';
    return 'Curious';
};
