import React, { memo } from 'react';
import { UserProfile, NatalChartData, UserContext, DailyHoroscope } from '../../types';
import { getZodiacSign } from '../../constants';

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

// Функция для получения иконки погоды
const getWeatherIcon = (condition: string): string => {
    const lowerCondition = condition.toLowerCase();
    if (lowerCondition.includes('rain') || lowerCondition.includes('дождь')) return '';
    if (lowerCondition.includes('snow') || lowerCondition.includes('снег')) return '';
    if (lowerCondition.includes('sun') || lowerCondition.includes('солн') || lowerCondition.includes('clear') || lowerCondition.includes('ясн')) return '';
    if (lowerCondition.includes('cloud') || lowerCondition.includes('облач') || lowerCondition.includes('overcast') || lowerCondition.includes('пасмурно')) return '';
    if (lowerCondition.includes('fog') || lowerCondition.includes('mist') || lowerCondition.includes('туман')) return '';
    return '';
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

// Генерация персонализированных комментариев на основе знака зодиака и погоды
const generateWeatherComment = (
    zodiacSign: string,
    weatherCondition: string,
    temp: number,
    dailyHoroscope: DailyHoroscope | null | undefined,
    language: string
): string => {
    const lowerCondition = weatherCondition.toLowerCase();
    const isRu = language === 'ru';
    
    // Комментарии по знакам зодиака и погоде
    const comments: Record<string, Record<string, Record<string, string[]>>> = {
        ru: {
            'Aries': {
                'sunny': [
                    'Овен, сегодня солнце подпитывает твою огненную энергию!',
                    'Идеальный день для Овна - солнце заряжает твою страсть к действию!',
                    'Солнечная погода + Овен = неудержимая энергия! Вперед!'
                ],
                'rain': [
                    'Дождь не остановит Овна! Твоя внутренняя энергия сильнее любой непогоды',
                    'Овен, даже под дождем ты горишь ярче солнца!',
                    'Дождь? Для Овна это просто дополнительный вызов!'
                ],
                'cloudy': [
                    'Облака не могут скрыть твою огненную натуру, Овен!',
                    'Овен, даже в пасмурный день твоя энергия пробивается сквозь тучи!',
                    'Облачность? Овен не обращает внимания на мелочи!'
                ],
                'snow': [
                    'Овен, снег не охладит твой пыл! Ты создан для движения!',
                    'Снежная погода? Овен превратит это в приключение!',
                    'Овен, даже снег не может заморозить твою страсть!'
                ]
            },
            'Taurus': {
                'sunny': [
                    'Телец, солнечная погода идеальна для твоей любви к комфорту!',
                    'Телец наслаждается каждым солнечным днем - это твоя стихия!',
                    'Солнце + Телец = идеальный день для наслаждения жизнью!'
                ],
                'rain': [
                    'Телец, дождь - отличный повод остаться дома и насладиться уютом!',
                    'Дождливая погода? Телец знает, как сделать это комфортным!',
                    'Телец, дождь - это просто повод для чая и хорошей книги!'
                ],
                'cloudy': [
                    'Телец, пасмурная погода не испортит твоего настроения!',
                    'Облачность? Телец найдет красоту даже в сером небе!',
                    'Телец, ты умеешь находить уют в любой погоде!'
                ],
                'snow': [
                    'Телец, снег создает особую атмосферу уюта - твою стихию!',
                    'Снежная погода? Телец превратит это в праздник комфорта!',
                    'Телец, снег - это просто еще один повод для уюта!'
                ]
            },
            'Gemini': {
                'sunny': [
                    'Близнецы, солнечная погода идеальна для твоей переменчивой натуры!',
                    'Солнце + Близнецы = бесконечные возможности для общения!',
                    'Близнецы, солнечный день - идеальное время для новых знакомств!'
                ],
                'rain': [
                    'Близнецы, дождь не остановит твое желание общаться и узнавать новое!',
                    'Дождливая погода? Близнецы найдут интерес даже в каплях дождя!',
                    'Близнецы, дождь - это просто новая тема для разговора!'
                ],
                'cloudy': [
                    'Близнецы, переменная облачность отражает твою многогранность!',
                    'Облачность? Близнецы видят в этом новые возможности!',
                    'Близнецы, пасмурная погода не помешает твоему любопытству!'
                ],
                'snow': [
                    'Близнецы, снег - это новая тема для обсуждения и изучения!',
                    'Снежная погода? Близнецы найдут в этом что-то интересное!',
                    'Близнецы, снег - это просто еще один повод для разговора!'
                ]
            },
            'Cancer': {
                'sunny': [
                    'Рак, солнечная погода согревает твою чувствительную душу!',
                    'Солнце + Рак = идеальный день для эмоционального комфорта!',
                    'Рак, солнечный день наполняет тебя теплом и уютом!'
                ],
                'rain': [
                    'Рак, дождь резонирует с твоей водной природой - это твоя стихия!',
                    'Дождливая погода? Рак чувствует себя как дома!',
                    'Рак, дождь - это просто еще один способ выразить эмоции!'
                ],
                'cloudy': [
                    'Рак, пасмурная погода создает атмосферу для размышлений!',
                    'Облачность? Рак найдет в этом глубину и смысл!',
                    'Рак, пасмурная погода идеальна для твоих размышлений!'
                ],
                'snow': [
                    'Рак, снег создает особую атмосферу уюта и тепла!',
                    'Снежная погода? Рак превратит это в момент для души!',
                    'Рак, снег - это просто еще один повод для эмоций!'
                ]
            },
            'Leo': {
                'sunny': [
                    'Лев, солнце - это твоя стихия! Ты сияешь ярче любого светила!',
                    'Солнце + Лев = королевская энергия! Сегодня ты в центре внимания!',
                    'Лев, солнечный день создан для того, чтобы ты блистал!'
                ],
                'rain': [
                    'Лев, даже дождь не может затмить твое сияние!',
                    'Дождливая погода? Лев превратит это в драматический спектакль!',
                    'Лев, дождь - это просто декорации для твоего величия!'
                ],
                'cloudy': [
                    'Лев, облака не могут скрыть твою королевскую натуру!',
                    'Пасмурная погода? Лев все равно будет сиять!',
                    'Лев, даже в облачную погоду ты остаешься королем!'
                ],
                'snow': [
                    'Лев, снег создает идеальный фон для твоего величия!',
                    'Снежная погода? Лев превратит это в королевский бал!',
                    'Лев, снег - это просто еще один повод для величия!'
                ]
            },
            'Virgo': {
                'sunny': [
                    'Дева, солнечная погода идеальна для твоих планов и организации!',
                    'Солнце + Дева = идеальный день для продуктивности!',
                    'Дева, солнечный день - отличное время для реализации планов!'
                ],
                'rain': [
                    'Дева, дождь - отличный повод для домашних дел и порядка!',
                    'Дождливая погода? Дева найдет в этом возможность для организации!',
                    'Дева, дождь - это просто еще один повод для порядка!'
                ],
                'cloudy': [
                    'Дева, пасмурная погода идеальна для анализа и планирования!',
                    'Облачность? Дева использует это время для совершенствования!',
                    'Дева, пасмурная погода не помешает твоей продуктивности!'
                ],
                'snow': [
                    'Дева, снег - отличный повод для создания идеального порядка!',
                    'Снежная погода? Дева превратит это в возможность для организации!',
                    'Дева, снег - это просто еще один повод для совершенства!'
                ]
            },
            'Libra': {
                'sunny': [
                    'Весы, солнечная погода идеальна для гармонии и красоты!',
                    'Солнце + Весы = идеальный баланс и гармония!',
                    'Весы, солнечный день создан для красоты и равновесия!'
                ],
                'rain': [
                    'Весы, дождь создает особую атмосферу романтики и гармонии!',
                    'Дождливая погода? Весы найдут в этом красоту и баланс!',
                    'Весы, дождь - это просто еще один способ найти гармонию!'
                ],
                'cloudy': [
                    'Весы, пасмурная погода идеальна для поиска внутреннего баланса!',
                    'Облачность? Весы используют это для гармонии!',
                    'Весы, пасмурная погода не нарушит твоего равновесия!'
                ],
                'snow': [
                    'Весы, снег создает идеальную атмосферу для красоты и гармонии!',
                    'Снежная погода? Весы превратят это в эстетическое наслаждение!',
                    'Весы, снег - это просто еще один повод для красоты!'
                ]
            },
            'Scorpio': {
                'sunny': [
                    'Скорпион, солнечная погода не может скрыть твою глубину!',
                    'Солнце + Скорпион = мощная энергия трансформации!',
                    'Скорпион, даже в солнечный день ты сохраняешь свою таинственность!'
                ],
                'rain': [
                    'Скорпион, дождь резонирует с твоей водной природой - это твоя стихия!',
                    'Дождливая погода? Скорпион чувствует себя как дома!',
                    'Скорпион, дождь - это просто еще один способ трансформации!'
                ],
                'cloudy': [
                    'Скорпион, пасмурная погода идеальна для твоих глубоких размышлений!',
                    'Облачность? Скорпион найдет в этом глубину и смысл!',
                    'Скорпион, пасмурная погода не помешает твоей интуиции!'
                ],
                'snow': [
                    'Скорпион, снег создает атмосферу таинственности и глубины!',
                    'Снежная погода? Скорпион превратит это в момент трансформации!',
                    'Скорпион, снег - это просто еще один повод для глубины!'
                ]
            },
            'Sagittarius': {
                'sunny': [
                    'Стрелец, солнечная погода идеальна для твоих приключений!',
                    'Солнце + Стрелец = неудержимая жажда путешествий!',
                    'Стрелец, солнечный день создан для открытий и приключений!'
                ],
                'rain': [
                    'Стрелец, даже дождь не остановит твою жажду приключений!',
                    'Дождливая погода? Стрелец превратит это в новое приключение!',
                    'Стрелец, дождь - это просто еще один вызов для путешественника!'
                ],
                'cloudy': [
                    'Стрелец, пасмурная погода не помешает твоему оптимизму!',
                    'Облачность? Стрелец видит в этом новые горизонты!',
                    'Стрелец, пасмурная погода не остановит твоих планов!'
                ],
                'snow': [
                    'Стрелец, снег - это просто еще один повод для приключений!',
                    'Снежная погода? Стрелец превратит это в зимнее путешествие!',
                    'Стрелец, снег - это просто еще один способ исследовать мир!'
                ]
            },
            'Capricorn': {
                'sunny': [
                    'Козерог, солнечная погода идеальна для твоих амбиций!',
                    'Солнце + Козерог = идеальный день для достижения целей!',
                    'Козерог, солнечный день создан для работы и успеха!'
                ],
                'rain': [
                    'Козерог, дождь не остановит твою целеустремленность!',
                    'Дождливая погода? Козерог использует это для продуктивности!',
                    'Козерог, дождь - это просто еще один повод для дисциплины!'
                ],
                'cloudy': [
                    'Козерог, пасмурная погода идеальна для сосредоточенной работы!',
                    'Облачность? Козерог использует это время для достижения целей!',
                    'Козерог, пасмурная погода не помешает твоей дисциплине!'
                ],
                'snow': [
                    'Козерог, снег - отличный повод для упорной работы!',
                    'Снежная погода? Козерог превратит это в возможность для роста!',
                    'Козерог, снег - это просто еще один повод для амбиций!'
                ]
            },
            'Aquarius': {
                'sunny': [
                    'Водолей, солнечная погода идеальна для твоих инноваций!',
                    'Солнце + Водолей = идеальный день для новых идей!',
                    'Водолей, солнечный день создан для творчества и свободы!'
                ],
                'rain': [
                    'Водолей, дождь не остановит твою оригинальность!',
                    'Дождливая погода? Водолей найдет в этом вдохновение!',
                    'Водолей, дождь - это просто еще один повод для инноваций!'
                ],
                'cloudy': [
                    'Водолей, пасмурная погода идеальна для твоих размышлений!',
                    'Облачность? Водолей использует это для новых идей!',
                    'Водолей, пасмурная погода не помешает твоему творчеству!'
                ],
                'snow': [
                    'Водолей, снег - это просто еще один повод для оригинальности!',
                    'Снежная погода? Водолей превратит это в творческий эксперимент!',
                    'Водолей, снег - это просто еще один способ выразить себя!'
                ]
            },
            'Pisces': {
                'sunny': [
                    'Рыбы, солнечная погода согревает твою мечтательную душу!',
                    'Солнце + Рыбы = идеальный день для вдохновения!',
                    'Рыбы, солнечный день наполняет тебя творческой энергией!'
                ],
                'rain': [
                    'Рыбы, дождь резонирует с твоей водной природой - это твоя стихия!',
                    'Дождливая погода? Рыбы чувствуют себя как дома!',
                    'Рыбы, дождь - это просто еще один способ мечтать!'
                ],
                'cloudy': [
                    'Рыбы, пасмурная погода идеальна для твоих мечтаний!',
                    'Облачность? Рыбы найдут в этом вдохновение!',
                    'Рыбы, пасмурная погода не помешает твоей интуиции!'
                ],
                'snow': [
                    'Рыбы, снег создает атмосферу мечтательности и вдохновения!',
                    'Снежная погода? Рыбы превратят это в момент для души!',
                    'Рыбы, снег - это просто еще один повод для мечтаний!'
                ]
            }
        },
        en: {
            'Aries': {
                'sunny': [
                    'Aries, sunny weather fuels your fiery energy!',
                    'Perfect day for Aries - sun charges your passion for action!',
                    'Sunny weather + Aries = unstoppable energy! Go ahead!'
                ],
                'rain': [
                    'Rain won\'t stop Aries! Your inner energy is stronger than any weather',
                    'Aries, even in the rain you burn brighter than the sun!',
                    'Rain? For Aries it\'s just an additional challenge!'
                ],
                'cloudy': [
                    'Clouds can\'t hide your fiery nature, Aries!',
                    'Aries, even on a cloudy day your energy breaks through!',
                    'Cloudiness? Aries doesn\'t pay attention to trifles!'
                ],
                'snow': [
                    'Aries, snow won\'t cool your ardor! You\'re made for movement!',
                    'Snowy weather? Aries will turn it into an adventure!',
                    'Aries, even snow can\'t freeze your passion!'
                ]
            },
            'Taurus': {
                'sunny': [
                    'Taurus, sunny weather is perfect for your love of comfort!',
                    'Taurus enjoys every sunny day - it\'s your element!',
                    'Sun + Taurus = perfect day to enjoy life!'
                ],
                'rain': [
                    'Taurus, rain is a great reason to stay home and enjoy coziness!',
                    'Rainy weather? Taurus knows how to make it comfortable!',
                    'Taurus, rain is just a reason for tea and a good book!'
                ],
                'cloudy': [
                    'Taurus, cloudy weather won\'t spoil your mood!',
                    'Cloudiness? Taurus will find beauty even in gray sky!',
                    'Taurus, you know how to find comfort in any weather!'
                ],
                'snow': [
                    'Taurus, snow creates a special atmosphere of coziness - your element!',
                    'Snowy weather? Taurus will turn it into a comfort celebration!',
                    'Taurus, snow is just another reason for coziness!'
                ]
            },
            'Gemini': {
                'sunny': [
                    'Gemini, sunny weather is perfect for your changeable nature!',
                    'Sun + Gemini = endless opportunities for communication!',
                    'Gemini, sunny day is perfect time for new acquaintances!'
                ],
                'rain': [
                    'Gemini, rain won\'t stop your desire to communicate and learn new things!',
                    'Rainy weather? Gemini will find interest even in raindrops!',
                    'Gemini, rain is just a new topic for conversation!'
                ],
                'cloudy': [
                    'Gemini, variable cloudiness reflects your multifaceted nature!',
                    'Cloudiness? Gemini sees new opportunities in this!',
                    'Gemini, cloudy weather won\'t interfere with your curiosity!'
                ],
                'snow': [
                    'Gemini, snow is a new topic for discussion and study!',
                    'Snowy weather? Gemini will find something interesting in this!',
                    'Gemini, snow is just another reason for conversation!'
                ]
            },
            'Cancer': {
                'sunny': [
                    'Cancer, sunny weather warms your sensitive soul!',
                    'Sun + Cancer = perfect day for emotional comfort!',
                    'Cancer, sunny day fills you with warmth and coziness!'
                ],
                'rain': [
                    'Cancer, rain resonates with your water nature - it\'s your element!',
                    'Rainy weather? Cancer feels at home!',
                    'Cancer, rain is just another way to express emotions!'
                ],
                'cloudy': [
                    'Cancer, cloudy weather creates atmosphere for reflection!',
                    'Cloudiness? Cancer will find depth and meaning in this!',
                    'Cancer, cloudy weather is perfect for your reflections!'
                ],
                'snow': [
                    'Cancer, snow creates a special atmosphere of coziness and warmth!',
                    'Snowy weather? Cancer will turn it into a moment for the soul!',
                    'Cancer, snow is just another reason for emotions!'
                ]
            },
            'Leo': {
                'sunny': [
                    'Leo, sun is your element! You shine brighter than any luminary!',
                    'Sun + Leo = royal energy! Today you\'re in the spotlight!',
                    'Leo, sunny day is made for you to shine!'
                ],
                'rain': [
                    'Leo, even rain can\'t dim your radiance!',
                    'Rainy weather? Leo will turn it into a dramatic performance!',
                    'Leo, rain is just decorations for your greatness!'
                ],
                'cloudy': [
                    'Leo, clouds can\'t hide your royal nature!',
                    'Cloudy weather? Leo will still shine!',
                    'Leo, even in cloudy weather you remain the king!'
                ],
                'snow': [
                    'Leo, snow creates perfect background for your greatness!',
                    'Snowy weather? Leo will turn it into a royal ball!',
                    'Leo, snow is just another reason for greatness!'
                ]
            },
            'Virgo': {
                'sunny': [
                    'Virgo, sunny weather is perfect for your plans and organization!',
                    'Sun + Virgo = perfect day for productivity!',
                    'Virgo, sunny day is great time to implement plans!'
                ],
                'rain': [
                    'Virgo, rain is a great reason for housework and order!',
                    'Rainy weather? Virgo will find opportunity for organization!',
                    'Virgo, rain is just another reason for order!'
                ],
                'cloudy': [
                    'Virgo, cloudy weather is perfect for analysis and planning!',
                    'Cloudiness? Virgo uses this time for improvement!',
                    'Virgo, cloudy weather won\'t interfere with your productivity!'
                ],
                'snow': [
                    'Virgo, snow is a great reason to create perfect order!',
                    'Snowy weather? Virgo will turn it into opportunity for organization!',
                    'Virgo, snow is just another reason for perfection!'
                ]
            },
            'Libra': {
                'sunny': [
                    'Libra, sunny weather is perfect for harmony and beauty!',
                    'Sun + Libra = perfect balance and harmony!',
                    'Libra, sunny day is made for beauty and balance!'
                ],
                'rain': [
                    'Libra, rain creates special atmosphere of romance and harmony!',
                    'Rainy weather? Libra will find beauty and balance in this!',
                    'Libra, rain is just another way to find harmony!'
                ],
                'cloudy': [
                    'Libra, cloudy weather is perfect for finding inner balance!',
                    'Cloudiness? Libra uses this for harmony!',
                    'Libra, cloudy weather won\'t disturb your balance!'
                ],
                'snow': [
                    'Libra, snow creates perfect atmosphere for beauty and harmony!',
                    'Snowy weather? Libra will turn it into aesthetic enjoyment!',
                    'Libra, snow is just another reason for beauty!'
                ]
            },
            'Scorpio': {
                'sunny': [
                    'Scorpio, sunny weather can\'t hide your depth!',
                    'Sun + Scorpio = powerful transformation energy!',
                    'Scorpio, even on a sunny day you keep your mystery!'
                ],
                'rain': [
                    'Scorpio, rain resonates with your water nature - it\'s your element!',
                    'Rainy weather? Scorpio feels at home!',
                    'Scorpio, rain is just another way of transformation!'
                ],
                'cloudy': [
                    'Scorpio, cloudy weather is perfect for your deep reflections!',
                    'Cloudiness? Scorpio will find depth and meaning in this!',
                    'Scorpio, cloudy weather won\'t interfere with your intuition!'
                ],
                'snow': [
                    'Scorpio, snow creates atmosphere of mystery and depth!',
                    'Snowy weather? Scorpio will turn it into a moment of transformation!',
                    'Scorpio, snow is just another reason for depth!'
                ]
            },
            'Sagittarius': {
                'sunny': [
                    'Sagittarius, sunny weather is perfect for your adventures!',
                    'Sun + Sagittarius = unstoppable thirst for travel!',
                    'Sagittarius, sunny day is made for discoveries and adventures!'
                ],
                'rain': [
                    'Sagittarius, even rain won\'t stop your thirst for adventures!',
                    'Rainy weather? Sagittarius will turn it into a new adventure!',
                    'Sagittarius, rain is just another challenge for a traveler!'
                ],
                'cloudy': [
                    'Sagittarius, cloudy weather won\'t interfere with your optimism!',
                    'Cloudiness? Sagittarius sees new horizons in this!',
                    'Sagittarius, cloudy weather won\'t stop your plans!'
                ],
                'snow': [
                    'Sagittarius, snow is just another reason for adventures!',
                    'Snowy weather? Sagittarius will turn it into a winter journey!',
                    'Sagittarius, snow is just another way to explore the world!'
                ]
            },
            'Capricorn': {
                'sunny': [
                    'Capricorn, sunny weather is perfect for your ambitions!',
                    'Sun + Capricorn = perfect day to achieve goals!',
                    'Capricorn, sunny day is made for work and success!'
                ],
                'rain': [
                    'Capricorn, rain won\'t stop your determination!',
                    'Rainy weather? Capricorn will use this for productivity!',
                    'Capricorn, rain is just another reason for discipline!'
                ],
                'cloudy': [
                    'Capricorn, cloudy weather is perfect for focused work!',
                    'Cloudiness? Capricorn uses this time to achieve goals!',
                    'Capricorn, cloudy weather won\'t interfere with your discipline!'
                ],
                'snow': [
                    'Capricorn, snow is a great reason for hard work!',
                    'Snowy weather? Capricorn will turn it into opportunity for growth!',
                    'Capricorn, snow is just another reason for ambitions!'
                ]
            },
            'Aquarius': {
                'sunny': [
                    'Aquarius, sunny weather is perfect for your innovations!',
                    'Sun + Aquarius = perfect day for new ideas!',
                    'Aquarius, sunny day is made for creativity and freedom!'
                ],
                'rain': [
                    'Aquarius, rain won\'t stop your originality!',
                    'Rainy weather? Aquarius will find inspiration in this!',
                    'Aquarius, rain is just another reason for innovations!'
                ],
                'cloudy': [
                    'Aquarius, cloudy weather is perfect for your reflections!',
                    'Cloudiness? Aquarius uses this for new ideas!',
                    'Aquarius, cloudy weather won\'t interfere with your creativity!'
                ],
                'snow': [
                    'Aquarius, snow is just another reason for originality!',
                    'Snowy weather? Aquarius will turn it into a creative experiment!',
                    'Aquarius, snow is just another way to express yourself!'
                ]
            },
            'Pisces': {
                'sunny': [
                    'Pisces, sunny weather warms your dreamy soul!',
                    'Sun + Pisces = perfect day for inspiration!',
                    'Pisces, sunny day fills you with creative energy!'
                ],
                'rain': [
                    'Pisces, rain resonates with your water nature - it\'s your element!',
                    'Rainy weather? Pisces feels at home!',
                    'Pisces, rain is just another way to dream!'
                ],
                'cloudy': [
                    'Pisces, cloudy weather is perfect for your dreams!',
                    'Cloudiness? Pisces will find inspiration in this!',
                    'Pisces, cloudy weather won\'t interfere with your intuition!'
                ],
                'snow': [
                    'Pisces, snow creates atmosphere of dreaminess and inspiration!',
                    'Snowy weather? Pisces will turn it into a moment for the soul!',
                    'Pisces, snow is just another reason for dreams!'
                ]
            }
        }
    };
    
    // Определяем тип погоды
    let weatherType = 'cloudy';
    if (lowerCondition.includes('sun') || lowerCondition.includes('clear') || lowerCondition.includes('солн') || lowerCondition.includes('ясн')) {
        weatherType = 'sunny';
    } else if (lowerCondition.includes('rain') || lowerCondition.includes('дождь') || lowerCondition.includes('drizzle')) {
        weatherType = 'rain';
    } else if (lowerCondition.includes('snow') || lowerCondition.includes('снег') || lowerCondition.includes('sleet')) {
        weatherType = 'snow';
    }
    
    // Получаем комментарии для знака зодиака
    const signComments = comments[language]?.[zodiacSign]?.[weatherType];
    
    let result: string;
    
    if (signComments && signComments.length > 0) {
        // Выбираем случайный комментарий
        const randomComment = signComments[Math.floor(Math.random() * signComments.length)];
        
        // Если есть гороскоп, можем добавить связь с ним
        if (dailyHoroscope && dailyHoroscope.content) {
            // Извлекаем ключевое слово из гороскопа (например, настроение или цвет)
            const horoscopeMood = dailyHoroscope.mood?.toLowerCase() || '';
            
            // Добавляем связь с гороскопом, если это уместно
            if (horoscopeMood && (horoscopeMood.includes('happy') || horoscopeMood.includes('радост') || horoscopeMood.includes('счастл'))) {
                result = `${randomComment} ${isRu ? 'И это идеально сочетается с твоим сегодняшним настроением!' : 'And this perfectly matches your mood today!'}`;
            } else {
                result = randomComment;
            }
        } else {
            result = randomComment;
        }
    } else {
        // Fallback комментарий
        const lang = language as 'ru' | 'en';
        result = isRu 
            ? `Погода сегодня ${translateWeather(weatherCondition, language).toLowerCase()}, ${temp}°C - идеально для ${getZodiacSign(lang, zodiacSign)}!`
            : `Weather today is ${translateWeather(weatherCondition, language).toLowerCase()}, ${temp}°C - perfect for ${getZodiacSign(lang, zodiacSign)}!`;
    }
    
    return result;
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
  const weatherComment = generateWeatherComment(
    zodiacSign,
    weatherData.condition,
    weatherData.temp,
    dailyHoroscope,
    profile.language
  );

  return (
    <div className="bg-gradient-to-r from-astro-card to-astro-bg p-5 rounded-xl border border-astro-border relative overflow-hidden">
      <div className="absolute -top-10 -right-10 w-48 h-48 bg-astro-highlight rounded-full blur-3xl opacity-20"></div>
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="text-[10px] uppercase tracking-widest text-astro-subtext mb-2">
              {profile.language === 'ru' ? 'Космическая Погода' : 'Cosmic Weather'}
            </h3>
            
            {/* Основная информация о погоде */}
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-3xl">{getWeatherIcon(weatherData.condition)}</span>
              <div>
                <p className="text-xl font-serif text-astro-text">
                  {translateWeather(weatherData.condition, profile.language)}
                </p>
                <p className="text-sm text-astro-subtext">
                  {weatherData.temp}°C
                  {weatherData.humidity && ` • ${weatherData.humidity}% ${profile.language === 'ru' ? 'влажность' : 'humidity'}`}
                </p>
              </div>
            </div>
            
            {/* Город */}
            <p className="text-xs text-astro-subtext mb-3">
              {weatherData.city}
            </p>
            
            {/* Персонализированный комментарий */}
            <div className="bg-astro-bg/50 rounded-lg p-3 border border-astro-border/30 mt-3">
              <p className="text-sm font-serif text-astro-text leading-relaxed">
                {weatherComment}
              </p>
            </div>
          </div>
        </div>
        
        {/* Фаза луны, если доступна */}
        {weatherData.moonPhase && (
          <div className="mt-4 pt-4 border-t border-astro-border/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-astro-subtext uppercase tracking-wider">
                  {profile.language === 'ru' ? 'Фаза Луны' : 'Moon Phase'}
                </p>
                <p className="text-sm font-serif text-astro-text mt-1">
                  {translateMoonPhase(weatherData.moonPhase.phase, profile.language)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-astro-subtext">
                  {weatherData.moonPhase.illumination}%
                </p>
                <p className="text-[9px] text-astro-subtext/70 mt-1">
                  {profile.language === 'ru' ? 'освещенность' : 'illumination'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

WeatherWidget.displayName = 'WeatherWidget';
