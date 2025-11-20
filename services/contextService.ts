
import { UserProfile, UserContext, ZodiacSign } from "../types";

// Mock data pools for "Wow" features
const WEATHER_CONDITIONS = ['Rainy', 'Sunny', 'Cloudy', 'Stormy', 'Clear Night'];

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
 * Simulates gathering external context (API integrations would go here)
 */
export const getUserContext = async (profile: UserProfile): Promise<UserContext> => {
    // 1. Simulate Weather API call
    const randomWeather = WEATHER_CONDITIONS[Math.floor(Math.random() * WEATHER_CONDITIONS.length)];
    
    // 2. Generate Social Proof based on Sign/Profile
    const proofs = profile.language === 'ru' ? SOCIAL_PROOF_TEMPLATES.ru : SOCIAL_PROOF_TEMPLATES.en;
    const randomProof = proofs[Math.floor(Math.random() * proofs.length)];

    return {
        weather: randomWeather,
        socialProof: randomProof,
        mood: 'Neutral' // Default, updated by Chat
    };
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
