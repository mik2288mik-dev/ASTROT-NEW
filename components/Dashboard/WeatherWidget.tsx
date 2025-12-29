import React, { memo } from 'react';
import { UserProfile, NatalChartData, UserContext, DailyHoroscope } from '../../types';
import { getZodiacSign } from '../../constants';
import { motion } from 'framer-motion';

interface WeatherWidgetProps {
  profile: UserProfile;
  chartData: NatalChartData;
  weatherData: UserContext['weatherData'];
  dailyHoroscope?: DailyHoroscope | null;
}

// Функция для перевода погоды на русский
const translateWeather = (condition: string, language: string): string => {
    if (language !== 'ru') return condition;
    
    const translations: Record<string, string> = {
        'sunny': 'Солнечно',
        'clear': 'Ясно',
        'partly cloudy': 'Переменная облачность',
        'cloudy': 'Облачно',
        'overcast': 'Пасмурно',
        'mist': 'Туман',
        'fog': 'Туман',
        'light rain': 'Небольшой дождь',
        'moderate rain': 'Умеренный дождь',
        'heavy rain': 'Сильный дождь',
        'light snow': 'Небольшой снег',
        'moderate snow': 'Умеренный снег',
        'heavy snow': 'Сильный снег',
        'sleet': 'Мокрый снег',
        'light drizzle': 'Моросящий дождь',
        'moderate drizzle': 'Умеренная морось',
        'heavy drizzle': 'Сильная морось',
        'freezing drizzle': 'Ледяная морось',
        'freezing rain': 'Ледяной дождь',
        'freezing fog': 'Ледяной туман',
        'patchy rain': 'Местами дождь',
        'patchy snow': 'Местами снег',
        'patchy sleet': 'Местами мокрый снег',
        'patchy freezing drizzle': 'Местами ледяная морось',
        'thundery outbreaks': 'Грозовые ливни',
        'blowing snow': 'Метель',
        'blizzard': 'Метель',
        'light snow showers': 'Небольшие снежные ливни',
        'moderate snow showers': 'Умеренные снежные ливни',
        'heavy snow showers': 'Сильные снежные ливни',
        'light rain showers': 'Небольшие дождевые ливни',
        'moderate rain showers': 'Умеренные дождевые ливни',
        'heavy rain showers': 'Сильные дождевые ливни',
    };
    
    const lowerCondition = condition.toLowerCase();
    for (const [key, value] of Object.entries(translations)) {
        if (lowerCondition.includes(key)) {
            return value;
        }
    }
    
    return condition;
};

// Функция для получения эмодзи погоды
const getWeatherEmoji = (condition: string, temp: number): string => {
    const lowerCondition = condition.toLowerCase();
    
    if (lowerCondition.includes('rain') || lowerCondition.includes('дождь') || lowerCondition.includes('drizzle')) {
        return '🌧️';
    }
    if (lowerCondition.includes('snow') || lowerCondition.includes('снег') || lowerCondition.includes('sleet')) {
        return '❄️';
    }
    if (lowerCondition.includes('sun') || lowerCondition.includes('солн') || lowerCondition.includes('clear') || lowerCondition.includes('ясн')) {
        return temp > 25 ? '☀️' : '🌤️';
    }
    if (lowerCondition.includes('cloud') || lowerCondition.includes('облач') || lowerCondition.includes('overcast') || lowerCondition.includes('пасмурно')) {
        return '☁️';
    }
    if (lowerCondition.includes('fog') || lowerCondition.includes('mist') || lowerCondition.includes('туман')) {
        return '🌫️';
    }
    if (lowerCondition.includes('thunder') || lowerCondition.includes('гроз')) {
        return '⛈️';
    }
    return '🌍';
};

// Функция для перевода фазы луны на русский
const translateMoonPhase = (phase: string, language: string): string => {
    if (language !== 'ru') return phase;
    
    const translations: Record<string, string> = {
        'new moon': 'Новолуние',
        'waxing crescent': 'Растущий серп',
        'first quarter': 'Первая четверть',
        'waxing gibbous': 'Растущая луна',
        'full moon': 'Полнолуние',
        'waning gibbous': 'Убывающая луна',
        'last quarter': 'Последняя четверть',
        'waning crescent': 'Убывающий серп',
    };
    
    const lowerPhase = phase.toLowerCase();
    for (const [key, value] of Object.entries(translations)) {
        if (lowerPhase.includes(key)) {
            return value;
        }
    }
    
    return phase;
};

/**
 * Генерирует веселые и прикольные комментарии о погоде на основе знака зодиака
 */
const generateFunnyWeatherComment = (
    zodiacSign: string,
    weatherCondition: string,
    temp: number,
    dailyHoroscope: DailyHoroscope | null | undefined,
    language: string
): string => {
    const lowerCondition = weatherCondition.toLowerCase();
    const isRu = language === 'ru';
    
    // Определяем тип погоды
    let weatherType = 'cloudy';
    if (lowerCondition.includes('sun') || lowerCondition.includes('clear') || lowerCondition.includes('солн') || lowerCondition.includes('ясн')) {
        weatherType = 'sunny';
    } else if (lowerCondition.includes('rain') || lowerCondition.includes('дождь') || lowerCondition.includes('drizzle')) {
        weatherType = 'rain';
    } else if (lowerCondition.includes('snow') || lowerCondition.includes('снег') || lowerCondition.includes('sleet')) {
        weatherType = 'snow';
    }
    
    // Веселые комментарии по знакам зодиака
    const funnyComments: Record<string, Record<string, Record<string, string[]>>> = {
        ru: {
            'Aries': {
                'sunny': [
                    '🔥 Овен, солнце сегодня просто огонь! Твоя энергия зашкаливает!',
                    '☀️ Овен, даже солнце завидует твоей энергии! Вперед, покоряй мир!',
                    '✨ Овен, солнечная погода + твоя огненная натура = взрывной микс!'
                ],
                'rain': [
                    '🌧️ Овен, дождь? Не проблема! Ты пробежишься и высушишь все вокруг!',
                    '💪 Овен, даже дождь не остановит твою огненную энергию!',
                    '⚡ Овен, дождь - это просто дополнительный вызов для тебя!'
                ],
                'cloudy': [
                    '☁️ Овен, облака пытаются скрыть твою энергию, но у них не получится!',
                    '🌟 Овен, даже в пасмурный день ты сияешь ярче солнца!',
                    '🔥 Овен, облачность? Твоя энергия пробивает любые тучи!'
                ],
                'snow': [
                    '❄️ Овен, снег? Отличный повод для зимних приключений!',
                    '⛄ Овен, даже снег не заморозит твою страсть к действию!',
                    '🎿 Овен, снежная погода - это просто новый вызов для тебя!'
                ]
            },
            'Taurus': {
                'sunny': [
                    '☀️ Телец, солнечная погода - идеальное время для наслаждения жизнью!',
                    '🌻 Телец, солнце согревает твою душу и создает атмосферу уюта!',
                    '✨ Телец, солнечный день - это твоя стихия комфорта и гармонии!'
                ],
                'rain': [
                    '🌧️ Телец, дождь - отличный повод остаться дома и насладиться уютом!',
                    '☕ Телец, дождливая погода = идеальное время для чая и хорошей книги!',
                    '🏠 Телец, дождь создает атмосферу уюта - твою любимую!'
                ],
                'cloudy': [
                    '☁️ Телец, пасмурная погода не испортит твоего настроения!',
                    '🌿 Телец, облачность - это просто повод найти красоту в мелочах!',
                    '💚 Телец, даже в серый день ты находишь уют и гармонию!'
                ],
                'snow': [
                    '❄️ Телец, снег создает особую атмосферу уюта - твою стихию!',
                    '🏡 Телец, снежная погода - идеальное время для домашнего комфорта!',
                    '🕯️ Телец, снег - это просто еще один повод для уюта и тепла!'
                ]
            },
            'Gemini': {
                'sunny': [
                    '☀️ Близнецы, солнечная погода идеальна для твоих переменчивых планов!',
                    '🌈 Близнецы, солнце + твоя многогранность = бесконечные возможности!',
                    '✨ Близнецы, солнечный день - идеальное время для новых знакомств!'
                ],
                'rain': [
                    '🌧️ Близнецы, дождь не остановит твое желание общаться и узнавать новое!',
                    '💬 Близнецы, дождливая погода - отличная тема для разговора!',
                    '📱 Близнецы, дождь - это просто повод для новых интересных бесед!'
                ],
                'cloudy': [
                    '☁️ Близнецы, переменная облачность отражает твою многогранность!',
                    '🔄 Близнецы, облачность? Ты видишь в этом новые возможности!',
                    '💡 Близнецы, пасмурная погода не помешает твоему любопытству!'
                ],
                'snow': [
                    '❄️ Близнецы, снег - это новая тема для обсуждения и изучения!',
                    '🎭 Близнецы, снежная погода? Ты найдешь в этом что-то интересное!',
                    '💭 Близнецы, снег - это просто еще один повод для разговора!'
                ]
            },
            'Cancer': {
                'sunny': [
                    '☀️ Рак, солнечная погода согревает твою чувствительную душу!',
                    '🌊 Рак, солнце + твоя водная природа = идеальная гармония!',
                    '💙 Рак, солнечный день наполняет тебя теплом и уютом!'
                ],
                'rain': [
                    '🌧️ Рак, дождь резонирует с твоей водной природой - это твоя стихия!',
                    '💧 Рак, дождливая погода? Ты чувствуешь себя как дома!',
                    '🌊 Рак, дождь - это просто еще один способ выразить эмоции!'
                ],
                'cloudy': [
                    '☁️ Рак, пасмурная погода создает атмосферу для размышлений!',
                    '🌙 Рак, облачность? Ты найдешь в этом глубину и смысл!',
                    '💭 Рак, пасмурная погода идеальна для твоих размышлений!'
                ],
                'snow': [
                    '❄️ Рак, снег создает особую атмосферу уюта и тепла!',
                    '🏠 Рак, снежная погода? Ты превратишь это в момент для души!',
                    '💙 Рак, снег - это просто еще один повод для эмоций!'
                ]
            },
            'Leo': {
                'sunny': [
                    '👑 Лев, солнце - это твоя стихия! Ты сияешь ярче любого светила!',
                    '✨ Лев, солнечный день создан для того, чтобы ты блистал!',
                    '🌟 Лев, солнце + твоя королевская энергия = невероятное сияние!'
                ],
                'rain': [
                    '🌧️ Лев, даже дождь не может затмить твое сияние!',
                    '👑 Лев, дождливая погода? Ты превратишь это в драматический спектакль!',
                    '✨ Лев, дождь - это просто декорации для твоего величия!'
                ],
                'cloudy': [
                    '☁️ Лев, облака не могут скрыть твою королевскую натуру!',
                    '👑 Лев, пасмурная погода? Ты все равно будешь сиять!',
                    '🌟 Лев, даже в облачную погоду ты остаешься королем!'
                ],
                'snow': [
                    '❄️ Лев, снег создает идеальный фон для твоего величия!',
                    '👑 Лев, снежная погода? Ты превратишь это в королевский бал!',
                    '✨ Лев, снег - это просто еще один повод для величия!'
                ]
            },
            'Virgo': {
                'sunny': [
                    '☀️ Дева, солнечная погода идеальна для твоих планов и организации!',
                    '📋 Дева, солнце + твоя продуктивность = идеальный день!',
                    '✨ Дева, солнечный день - отличное время для реализации планов!'
                ],
                'rain': [
                    '🌧️ Дева, дождь - отличный повод для домашних дел и порядка!',
                    '🏠 Дева, дождливая погода? Ты найдешь в этом возможность для организации!',
                    '📝 Дева, дождь - это просто еще один повод для порядка!'
                ],
                'cloudy': [
                    '☁️ Дева, пасмурная погода идеальна для анализа и планирования!',
                    '📊 Дева, облачность? Ты используешь это время для совершенствования!',
                    '💡 Дева, пасмурная погода не помешает твоей продуктивности!'
                ],
                'snow': [
                    '❄️ Дева, снег - отличный повод для создания идеального порядка!',
                    '🏡 Дева, снежная погода? Ты превратишь это в возможность для организации!',
                    '✨ Дева, снег - это просто еще один повод для совершенства!'
                ]
            },
            'Libra': {
                'sunny': [
                    '☀️ Весы, солнечная погода идеальна для гармонии и красоты!',
                    '⚖️ Весы, солнце + твой баланс = идеальная гармония!',
                    '✨ Весы, солнечный день создан для красоты и равновесия!'
                ],
                'rain': [
                    '🌧️ Весы, дождь создает особую атмосферу романтики и гармонии!',
                    '💕 Весы, дождливая погода? Ты найдешь в этом красоту и баланс!',
                    '🌹 Весы, дождь - это просто еще один способ найти гармонию!'
                ],
                'cloudy': [
                    '☁️ Весы, пасмурная погода идеальна для поиска внутреннего баланса!',
                    '⚖️ Весы, облачность? Ты используешь это для гармонии!',
                    '💫 Весы, пасмурная погода не нарушит твоего равновесия!'
                ],
                'snow': [
                    '❄️ Весы, снег создает идеальную атмосферу для красоты и гармонии!',
                    '❄️ Весы, снежная погода? Ты превратишь это в эстетическое наслаждение!',
                    '✨ Весы, снег - это просто еще один повод для красоты!'
                ]
            },
            'Scorpio': {
                'sunny': [
                    '☀️ Скорпион, солнечная погода не может скрыть твою глубину!',
                    '🦂 Скорпион, солнце + твоя трансформация = мощная энергия!',
                    '✨ Скорпион, даже в солнечный день ты сохраняешь свою таинственность!'
                ],
                'rain': [
                    '🌧️ Скорпион, дождь резонирует с твоей водной природой - это твоя стихия!',
                    '💧 Скорпион, дождливая погода? Ты чувствуешь себя как дома!',
                    '🌊 Скорпион, дождь - это просто еще один способ трансформации!'
                ],
                'cloudy': [
                    '☁️ Скорпион, пасмурная погода идеальна для твоих глубоких размышлений!',
                    '🌙 Скорпион, облачность? Ты найдешь в этом глубину и смысл!',
                    '💭 Скорпион, пасмурная погода не помешает твоей интуиции!'
                ],
                'snow': [
                    '❄️ Скорпион, снег создает атмосферу таинственности и глубины!',
                    '🦂 Скорпион, снежная погода? Ты превратишь это в момент трансформации!',
                    '✨ Скорпион, снег - это просто еще один повод для глубины!'
                ]
            },
            'Sagittarius': {
                'sunny': [
                    '☀️ Стрелец, солнечная погода идеальна для твоих приключений!',
                    '🏹 Стрелец, солнце + твоя жажда путешествий = неудержимая энергия!',
                    '✈️ Стрелец, солнечный день создан для открытий и приключений!'
                ],
                'rain': [
                    '🌧️ Стрелец, даже дождь не остановит твою жажду приключений!',
                    '🎒 Стрелец, дождливая погода? Ты превратишь это в новое приключение!',
                    '🌍 Стрелец, дождь - это просто еще один вызов для путешественника!'
                ],
                'cloudy': [
                    '☁️ Стрелец, пасмурная погода не помешает твоему оптимизму!',
                    '🗺️ Стрелец, облачность? Ты видишь в этом новые горизонты!',
                    '✨ Стрелец, пасмурная погода не остановит твоих планов!'
                ],
                'snow': [
                    '❄️ Стрелец, снег - это просто еще один повод для приключений!',
                    '🎿 Стрелец, снежная погода? Ты превратишь это в зимнее путешествие!',
                    '🏔️ Стрелец, снег - это просто еще один способ исследовать мир!'
                ]
            },
            'Capricorn': {
                'sunny': [
                    '☀️ Козерог, солнечная погода идеальна для твоих амбиций!',
                    '🏔️ Козерог, солнце + твоя целеустремленность = идеальный день!',
                    '💼 Козерог, солнечный день создан для работы и успеха!'
                ],
                'rain': [
                    '🌧️ Козерог, дождь не остановит твою целеустремленность!',
                    '📈 Козерог, дождливая погода? Ты используешь это для продуктивности!',
                    '💪 Козерог, дождь - это просто еще один повод для дисциплины!'
                ],
                'cloudy': [
                    '☁️ Козерог, пасмурная погода идеальна для сосредоточенной работы!',
                    '📊 Козерог, облачность? Ты используешь это время для достижения целей!',
                    '🎯 Козерог, пасмурная погода не помешает твоей дисциплине!'
                ],
                'snow': [
                    '❄️ Козерог, снег - отличный повод для упорной работы!',
                    '🏆 Козерог, снежная погода? Ты превратишь это в возможность для роста!',
                    '💎 Козерог, снег - это просто еще один повод для амбиций!'
                ]
            },
            'Aquarius': {
                'sunny': [
                    '☀️ Водолей, солнечная погода идеальна для твоих инноваций!',
                    '💡 Водолей, солнце + твои идеи = идеальный день для творчества!',
                    '🚀 Водолей, солнечный день создан для свободы и инноваций!'
                ],
                'rain': [
                    '🌧️ Водолей, дождь не остановит твою оригинальность!',
                    '💭 Водолей, дождливая погода? Ты найдешь в этом вдохновение!',
                    '✨ Водолей, дождь - это просто еще один повод для инноваций!'
                ],
                'cloudy': [
                    '☁️ Водолей, пасмурная погода идеальна для твоих размышлений!',
                    '🔮 Водолей, облачность? Ты используешь это для новых идей!',
                    '💫 Водолей, пасмурная погода не помешает твоему творчеству!'
                ],
                'snow': [
                    '❄️ Водолей, снег - это просто еще один повод для оригинальности!',
                    '🎨 Водолей, снежная погода? Ты превратишь это в творческий эксперимент!',
                    '🌟 Водолей, снег - это просто еще один способ выразить себя!'
                ]
            },
            'Pisces': {
                'sunny': [
                    '☀️ Рыбы, солнечная погода согревает твою мечтательную душу!',
                    '🌊 Рыбы, солнце + твоя мечтательность = идеальный день для вдохновения!',
                    '✨ Рыбы, солнечный день наполняет тебя творческой энергией!'
                ],
                'rain': [
                    '🌧️ Рыбы, дождь резонирует с твоей водной природой - это твоя стихия!',
                    '💧 Рыбы, дождливая погода? Ты чувствуешь себя как дома!',
                    '🌊 Рыбы, дождь - это просто еще один способ мечтать!'
                ],
                'cloudy': [
                    '☁️ Рыбы, пасмурная погода идеальна для твоих мечтаний!',
                    '🌙 Рыбы, облачность? Ты найдешь в этом вдохновение!',
                    '💭 Рыбы, пасмурная погода не помешает твоей интуиции!'
                ],
                'snow': [
                    '❄️ Рыбы, снег создает атмосферу мечтательности и вдохновения!',
                    '🎭 Рыбы, снежная погода? Ты превратишь это в момент для души!',
                    '✨ Рыбы, снег - это просто еще один повод для мечтаний!'
                ]
            }
        },
        en: {
            'Aries': {
                'sunny': ['🔥 Aries, the sun is on fire today! Your energy is off the charts!', '☀️ Aries, even the sun envies your energy! Go conquer the world!'],
                'rain': ['🌧️ Aries, rain? No problem! You\'ll run and dry everything around!', '💪 Aries, even rain can\'t stop your fiery energy!'],
                'cloudy': ['☁️ Aries, clouds try to hide your energy, but they won\'t succeed!', '🌟 Aries, even on a cloudy day you shine brighter than the sun!'],
                'snow': ['❄️ Aries, snow? Great excuse for winter adventures!', '⛄ Aries, even snow can\'t freeze your passion for action!']
            },
            'Taurus': {
                'sunny': ['☀️ Taurus, sunny weather - perfect time to enjoy life!', '🌻 Taurus, the sun warms your soul and creates a cozy atmosphere!'],
                'rain': ['🌧️ Taurus, rain - great reason to stay home and enjoy coziness!', '☕ Taurus, rainy weather = perfect time for tea and a good book!'],
                'cloudy': ['☁️ Taurus, cloudy weather won\'t spoil your mood!', '🌿 Taurus, cloudiness is just a reason to find beauty in small things!'],
                'snow': ['❄️ Taurus, snow creates a special cozy atmosphere - your element!', '🏡 Taurus, snowy weather - perfect time for home comfort!']
            },
            'Gemini': {
                'sunny': ['☀️ Gemini, sunny weather is perfect for your changeable plans!', '🌈 Gemini, sun + your versatility = endless possibilities!'],
                'rain': ['🌧️ Gemini, rain won\'t stop your desire to communicate and learn new things!', '💬 Gemini, rainy weather - great topic for conversation!'],
                'cloudy': ['☁️ Gemini, variable cloudiness reflects your multifaceted nature!', '🔄 Gemini, cloudiness? You see new opportunities in this!'],
                'snow': ['❄️ Gemini, snow is a new topic for discussion and study!', '🎭 Gemini, snowy weather? You\'ll find something interesting in this!']
            },
            'Cancer': {
                'sunny': ['☀️ Cancer, sunny weather warms your sensitive soul!', '🌊 Cancer, sun + your water nature = perfect harmony!'],
                'rain': ['🌧️ Cancer, rain resonates with your water nature - it\'s your element!', '💧 Cancer, rainy weather? You feel at home!'],
                'cloudy': ['☁️ Cancer, cloudy weather creates atmosphere for reflection!', '🌙 Cancer, cloudiness? You\'ll find depth and meaning in this!'],
                'snow': ['❄️ Cancer, snow creates a special atmosphere of coziness and warmth!', '🏠 Cancer, snowy weather? You\'ll turn it into a moment for the soul!']
            },
            'Leo': {
                'sunny': ['👑 Leo, the sun is your element! You shine brighter than any luminary!', '✨ Leo, sunny day is made for you to shine!'],
                'rain': ['🌧️ Leo, even rain can\'t dim your radiance!', '👑 Leo, rainy weather? You\'ll turn it into a dramatic performance!'],
                'cloudy': ['☁️ Leo, clouds can\'t hide your royal nature!', '👑 Leo, cloudy weather? You\'ll still shine!'],
                'snow': ['❄️ Leo, snow creates perfect background for your greatness!', '👑 Leo, snowy weather? You\'ll turn it into a royal ball!']
            },
            'Virgo': {
                'sunny': ['☀️ Virgo, sunny weather is perfect for your plans and organization!', '📋 Virgo, sun + your productivity = perfect day!'],
                'rain': ['🌧️ Virgo, rain - great reason for housework and order!', '🏠 Virgo, rainy weather? You\'ll find opportunity for organization!'],
                'cloudy': ['☁️ Virgo, cloudy weather is perfect for analysis and planning!', '📊 Virgo, cloudiness? You use this time for improvement!'],
                'snow': ['❄️ Virgo, snow - great reason to create perfect order!', '🏡 Virgo, snowy weather? You\'ll turn it into opportunity for organization!']
            },
            'Libra': {
                'sunny': ['☀️ Libra, sunny weather is perfect for harmony and beauty!', '⚖️ Libra, sun + your balance = perfect harmony!'],
                'rain': ['🌧️ Libra, rain creates special atmosphere of romance and harmony!', '💕 Libra, rainy weather? You\'ll find beauty and balance in this!'],
                'cloudy': ['☁️ Libra, cloudy weather is perfect for finding inner balance!', '⚖️ Libra, cloudiness? You use this for harmony!'],
                'snow': ['❄️ Libra, snow creates perfect atmosphere for beauty and harmony!', '❄️ Libra, snowy weather? You\'ll turn it into aesthetic enjoyment!']
            },
            'Scorpio': {
                'sunny': ['☀️ Scorpio, sunny weather can\'t hide your depth!', '🦂 Scorpio, sun + your transformation = powerful energy!'],
                'rain': ['🌧️ Scorpio, rain resonates with your water nature - it\'s your element!', '💧 Scorpio, rainy weather? You feel at home!'],
                'cloudy': ['☁️ Scorpio, cloudy weather is perfect for your deep reflections!', '🌙 Scorpio, cloudiness? You\'ll find depth and meaning in this!'],
                'snow': ['❄️ Scorpio, snow creates atmosphere of mystery and depth!', '🦂 Scorpio, snowy weather? You\'ll turn it into a moment of transformation!']
            },
            'Sagittarius': {
                'sunny': ['☀️ Sagittarius, sunny weather is perfect for your adventures!', '🏹 Sagittarius, sun + your thirst for travel = unstoppable energy!'],
                'rain': ['🌧️ Sagittarius, even rain won\'t stop your thirst for adventures!', '🎒 Sagittarius, rainy weather? You\'ll turn it into a new adventure!'],
                'cloudy': ['☁️ Sagittarius, cloudy weather won\'t interfere with your optimism!', '🗺️ Sagittarius, cloudiness? You see new horizons in this!'],
                'snow': ['❄️ Sagittarius, snow is just another reason for adventures!', '🎿 Sagittarius, snowy weather? You\'ll turn it into a winter journey!']
            },
            'Capricorn': {
                'sunny': ['☀️ Capricorn, sunny weather is perfect for your ambitions!', '🏔️ Capricorn, sun + your determination = perfect day!'],
                'rain': ['🌧️ Capricorn, rain won\'t stop your determination!', '📈 Capricorn, rainy weather? You\'ll use this for productivity!'],
                'cloudy': ['☁️ Capricorn, cloudy weather is perfect for focused work!', '📊 Capricorn, cloudiness? You use this time to achieve goals!'],
                'snow': ['❄️ Capricorn, snow - great reason for hard work!', '🏆 Capricorn, snowy weather? You\'ll turn it into opportunity for growth!']
            },
            'Aquarius': {
                'sunny': ['☀️ Aquarius, sunny weather is perfect for your innovations!', '💡 Aquarius, sun + your ideas = perfect day for creativity!'],
                'rain': ['🌧️ Aquarius, rain won\'t stop your originality!', '💭 Aquarius, rainy weather? You\'ll find inspiration in this!'],
                'cloudy': ['☁️ Aquarius, cloudy weather is perfect for your reflections!', '🔮 Aquarius, cloudiness? You use this for new ideas!'],
                'snow': ['❄️ Aquarius, snow is just another reason for originality!', '🎨 Aquarius, snowy weather? You\'ll turn it into a creative experiment!']
            },
            'Pisces': {
                'sunny': ['☀️ Pisces, sunny weather warms your dreamy soul!', '🌊 Pisces, sun + your dreaminess = perfect day for inspiration!'],
                'rain': ['🌧️ Pisces, rain resonates with your water nature - it\'s your element!', '💧 Pisces, rainy weather? You feel at home!'],
                'cloudy': ['☁️ Pisces, cloudy weather is perfect for your dreams!', '🌙 Pisces, cloudiness? You\'ll find inspiration in this!'],
                'snow': ['❄️ Pisces, snow creates atmosphere of dreaminess and inspiration!', '🎭 Pisces, snowy weather? You\'ll turn it into a moment for the soul!']
            }
        }
    };
    
    // Получаем комментарии для знака зодиака
    const signComments = funnyComments[language]?.[zodiacSign]?.[weatherType];
    
    if (signComments && signComments.length > 0) {
        // Выбираем случайный комментарий
        const randomComment = signComments[Math.floor(Math.random() * signComments.length)];
        
        // Добавляем связь с гороскопом, если есть
        if (dailyHoroscope && dailyHoroscope.mood) {
            const horoscopeMood = dailyHoroscope.mood.toLowerCase();
            if (isRu) {
                if (horoscopeMood.includes('happy') || horoscopeMood.includes('радост') || horoscopeMood.includes('счастл') || horoscopeMood.includes('вдохнов')) {
                    return `${randomComment} И это идеально сочетается с твоим сегодняшним настроением! ✨`;
                }
            } else {
                if (horoscopeMood.includes('happy') || horoscopeMood.includes('inspired') || horoscopeMood.includes('joyful')) {
                    return `${randomComment} And this perfectly matches your mood today! ✨`;
                }
            }
        }
        
        return randomComment;
    }
    
    // Fallback комментарий
    const lang = language as 'ru' | 'en';
    return isRu 
        ? `Погода сегодня ${translateWeather(weatherCondition, language).toLowerCase()}, ${temp}°C - идеально для ${getZodiacSign(lang, zodiacSign)}! ✨`
        : `Weather today is ${translateWeather(weatherCondition, language).toLowerCase()}, ${temp}°C - perfect for ${getZodiacSign(lang, zodiacSign)}! ✨`;
};

export const WeatherWidget = memo<WeatherWidgetProps>(({ 
  profile, 
  chartData, 
  weatherData,
  dailyHoroscope
}) => {
  if (!weatherData) {
    return null;
  }

  const zodiacSign = chartData?.sun?.sign || 'Aries';
  const weatherEmoji = getWeatherEmoji(weatherData.condition, weatherData.temp);
  const weatherComment = generateFunnyWeatherComment(
    zodiacSign,
    weatherData.condition,
    weatherData.temp,
    dailyHoroscope,
    profile.language
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative bg-gradient-to-br from-astro-card via-astro-card/95 to-astro-bg rounded-2xl p-6 border-2 border-astro-border shadow-lg overflow-hidden group hover:border-astro-highlight/50 transition-all duration-300"
    >
      {/* Декоративный градиентный фон */}
      <div className="absolute -top-20 -right-20 w-64 h-64 bg-astro-highlight rounded-full blur-3xl opacity-20 group-hover:opacity-30 transition-opacity duration-300"></div>
      <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-blue-500 rounded-full blur-2xl opacity-10"></div>
      
      <div className="relative z-10">
        {/* Заголовок */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[10px] uppercase tracking-widest text-astro-subtext font-bold">
            {profile.language === 'ru' ? 'Космическая Погода' : 'Cosmic Weather'}
          </h3>
          <div className="text-2xl animate-pulse">{weatherEmoji}</div>
        </div>
        
        {/* Основная информация о погоде */}
        <div className="flex items-center gap-4 mb-4">
          <div className="text-5xl">{weatherEmoji}</div>
          <div className="flex-1">
            <p className="text-2xl font-serif font-bold text-astro-text mb-1">
              {translateWeather(weatherData.condition, profile.language)}
            </p>
            <div className="flex items-center gap-3 text-sm text-astro-subtext">
              <span className="font-semibold text-astro-text">{weatherData.temp}°C</span>
              {weatherData.humidity && (
                <>
                  <span>•</span>
                  <span>{weatherData.humidity}% {profile.language === 'ru' ? 'влажность' : 'humidity'}</span>
                </>
              )}
            </div>
            <p className="text-xs text-astro-subtext mt-1">
              {weatherData.city}
            </p>
          </div>
        </div>
        
        {/* Веселый персонализированный комментарий */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-r from-astro-highlight/10 via-astro-highlight/5 to-transparent rounded-xl p-4 border border-astro-highlight/20 mt-4"
        >
          <p className="text-sm font-serif text-astro-text leading-relaxed">
            {weatherComment}
          </p>
        </motion.div>
        
        {/* Фаза луны, если доступна */}
        {weatherData.moonPhase && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-4 pt-4 border-t border-astro-border/30"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-astro-subtext uppercase tracking-wider mb-1">
                  {profile.language === 'ru' ? 'Фаза Луны' : 'Moon Phase'}
                </p>
                <p className="text-sm font-serif text-astro-text">
                  🌙 {translateMoonPhase(weatherData.moonPhase.phase, profile.language)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-astro-text">
                  {weatherData.moonPhase.illumination}%
                </p>
                <p className="text-[9px] text-astro-subtext/70 mt-1">
                  {profile.language === 'ru' ? 'освещенность' : 'illumination'}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
});

WeatherWidget.displayName = 'WeatherWidget';
