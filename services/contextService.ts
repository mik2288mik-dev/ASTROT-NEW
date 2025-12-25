
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
        const url = `${API_BASE_URL}/api/weather?city=${encodeURIComponent(city)}`;
        
        console.log('[ContextService] Fetching weather from:', url);
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });
        
        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            console.warn('[ContextService] Failed to fetch weather:', {
                status: response.status,
                statusText: response.statusText,
                error: errorText
            });
            return null;
        }

        const result = await response.json();
        console.log('[ContextService] Weather API response:', result);
        
        if (result.success && result.data) {
            console.log('[ContextService] Weather data received successfully:', {
                city: result.data.city,
                temp: result.data.temp,
                condition: result.data.condition
            });
            return result.data;
        }
        
        console.warn('[ContextService] Weather API returned unsuccessful response:', result);
        return null;
    } catch (error: any) {
        console.error('[ContextService] Error fetching weather:', {
            error: error.message,
            stack: error.stack
        });
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
    const weatherCity = profile.weatherCity?.trim();
    if (weatherCity && weatherCity.length > 0) {
        console.log('[ContextService] Fetching weather for city:', weatherCity);
        try {
            const weatherData = await fetchWeatherData(weatherCity);
            if (weatherData && weatherData.city && weatherData.condition) {
                context.weatherData = weatherData;
                // Для обратной совместимости сохраняем также в weather
                context.weather = weatherData.condition;
                context.moonPhase = weatherData.moonPhase;
                console.log('[ContextService] Weather data loaded successfully', {
                    city: weatherData.city,
                    temp: weatherData.temp,
                    condition: weatherData.condition,
                    hasMoonPhase: !!weatherData.moonPhase
                });
            } else {
                console.warn('[ContextService] Weather API returned invalid data:', weatherData);
            }
        } catch (error: any) {
            console.error('[ContextService] Error fetching weather data:', {
                error: error.message,
                city: weatherCity
            });
            // Не прерываем выполнение, просто не добавляем погоду в контекст
        }
    } else {
        console.log('[ContextService] No weather city set, skipping weather fetch');
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
