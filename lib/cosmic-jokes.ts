/**
 * Система персонализированных космических шуток
 * Шутки генерируются на основе знаков Солнца, Луны и других планет
 */

// Типы знаков
type ZodiacSign = 'Aries' | 'Taurus' | 'Gemini' | 'Cancer' | 'Leo' | 'Virgo' | 
                  'Libra' | 'Scorpio' | 'Sagittarius' | 'Capricorn' | 'Aquarius' | 'Pisces';

// Характеристики знаков для шуток
const SIGN_TRAITS: Record<string, { ru: string[]; en: string[] }> = {
    Aries: {
        ru: ['хочешь всё и сразу', 'готов к бою', 'уже бежишь впереди всех', 'не терпишь ждать'],
        en: ['want everything now', 'ready for battle', 'already running ahead', 'hate waiting']
    },
    Taurus: {
        ru: ['думаешь о еде', 'хочешь комфорта', 'никуда не торопишься', 'ценишь стабильность'],
        en: ['thinking about food', 'want comfort', 'taking your time', 'value stability']
    },
    Gemini: {
        ru: ['ведёшь 5 разговоров сразу', 'уже передумал', 'скучаешь через 5 минут', 'знаешь всё обо всём'],
        en: ['having 5 conversations', 'already changed your mind', 'bored in 5 minutes', 'know everything']
    },
    Cancer: {
        ru: ['переживаешь за всех', 'хочешь домой', 'вспоминаешь детство', 'готовишь что-то вкусное'],
        en: ['worrying about everyone', 'want to go home', 'remembering childhood', 'cooking something']
    },
    Leo: {
        ru: ['ждёшь аплодисментов', 'сияешь ярче всех', 'драматизируешь', 'заслуживаешь лучшего'],
        en: ['waiting for applause', 'shining brighter', 'being dramatic', 'deserve the best']
    },
    Virgo: {
        ru: ['всё анализируешь', 'видишь все недостатки', 'составляешь список', 'помогаешь другим'],
        en: ['analyzing everything', 'seeing all flaws', 'making a list', 'helping others']
    },
    Libra: {
        ru: ['не можешь выбрать', 'хочешь гармонии', 'избегаешь конфликтов', 'думаешь о красоте'],
        en: ['can\'t decide', 'want harmony', 'avoiding conflict', 'thinking about beauty']
    },
    Scorpio: {
        ru: ['смотришь в душу', 'помнишь всё', 'чувствуешь подвох', 'трансформируешься'],
        en: ['looking into souls', 'remember everything', 'sensing betrayal', 'transforming']
    },
    Sagittarius: {
        ru: ['планируешь путешествие', 'говоришь правду', 'ищешь смысл жизни', 'хочешь свободы'],
        en: ['planning a trip', 'speaking truth', 'seeking meaning', 'wanting freedom']
    },
    Capricorn: {
        ru: ['работаешь над целью', 'думаешь о карьере', 'всё под контролем', 'строишь планы'],
        en: ['working on goals', 'thinking about career', 'in control', 'making plans']
    },
    Aquarius: {
        ru: ['думаешь о будущем', 'хочешь изменить мир', 'делаешь по-своему', 'удивляешь всех'],
        en: ['thinking about future', 'want to change world', 'doing it your way', 'surprising everyone']
    },
    Pisces: {
        ru: ['мечтаешь', 'чувствуешь всё', 'уплываешь в фантазии', 'сопереживаешь всем'],
        en: ['daydreaming', 'feeling everything', 'floating away', 'empathizing with all']
    }
};

// Шаблоны шуток для погоды
const WEATHER_JOKE_TEMPLATES = {
    cold: {
        ru: [
            "{name}, на улице {temp}°C. Ты {trait}, но плед сегодня сильнее 🧣",
            "Холодно ({temp}°C). {name}, твой настрой: «{trait}», и это идеально для чая ☕",
            "{temp}°C за окном. {name}, ты {trait}, но мороз намекает на сериал 📺",
        ],
        en: [
            "{name}, it's {temp}°C outside. You're {trait}, but the blanket wins today 🧣",
            "Cold ({temp}°C). {name}, your vibe says: «{trait}», and it's perfect for tea ☕",
            "{temp}°C outside. {name}, you're {trait}, but the cold votes for Netflix 📺",
        ]
    },
    warm: {
        ru: [
            "{name}, {temp}°C — самое то для небольшой прогулки. Ты {trait} 😌",
            "{temp}°C — идеально. {name}, ты {trait}, но сначала кофе — это закон ☕",
            "Погода {temp}°C. {name}, ты {trait}, а значит можно и на улицу, и в плед — как решишь 🫶",
        ],
        en: [
            "{name}, {temp}°C is perfect for a little walk. You're {trait} 😌",
            "{temp}°C — just right. {name}, you're {trait}, but coffee first ☕",
            "Weather is {temp}°C. {name}, you're {trait}, so both outdoors and couch are valid 🫶",
        ]
    },
    hot: {
        ru: [
            "Жара {temp}°C. {name}, ты {trait}, но сейчас главное — вода и тень 🧊",
            "{temp}°C 🔥 {name}, твой режим «{trait}», но кондиционер сегодня герой 😅",
            "На улице {temp}°C. {name}, ты {trait}, но жара просит лёгкий темп 🌴",
        ],
        en: [
            "Hot {temp}°C. {name}, you're {trait}, but water and shade come first 🧊",
            "{temp}°C 🔥 {name}, your mode is «{trait}», but AC is the hero 😅",
            "It's {temp}°C outside. {name}, you're {trait}, but even you want shade 🌴",
        ]
    },
    rain: {
        ru: [
            "Дождь при {temp}°C. {name}, ты {trait} — отличный повод для уюта 🌧️",
            "Льёт дождь! {name}, ты {trait}, так что музыка и окно сегодня в тему 🎵",
            "Дождливо ({temp}°C). {name}, ты {trait}, можно чуть замедлиться ☔",
        ],
        en: [
            "Rain at {temp}°C. {name}, you're {trait} — perfect for cozy vibes 🌧️",
            "It's raining! {name}, you're {trait}, so lo-fi and window-gazing fit 🎵",
            "Rainy ({temp}°C). {name}, you're {trait}, it's okay to slow down ☔",
        ]
    }
};

// Ежедневные шутки (не привязанные к погоде)
const DAILY_JOKES = {
    ru: [
        "{name}, сегодня твой настрой: «{trait}». Можно смело действовать 😴",
        "{name}, если хочется написать «то самое» сообщение — ты {trait}, это нормально 📱",
        "{name}, сегодня день для маленьких радостей. Ты {trait}, и это твой козырь 🍕",
        "{name}, ты сегодня особенно {sign_adj}. Кофе это только подтверждает ☕☕",
        "{name}, звёзды тут ни при чём — ты {trait}, значит день уже хороший 🌟",
        "{name}, удача рядом. Ты {trait}, осталось только заметить 📅",
        "{name}, сегодня идеальный день чтобы {trait}. Или хотя бы задуматься 😏",
        "{name}, ты сегодня особенно {sign_adj}. Окружающие скоро поймут ✨",
    ],
    en: [
        "{name}, today's vibe is «{trait}». You're good to go 😴",
        "{name}, if you want to send that message — you're {trait}, it makes sense 📱",
        "{name}, today is for small joys. You're {trait}, that's the advantage 🍕",
        "{name}, you're especially {sign_adj} today. Coffee agrees ☕☕",
        "{name}, stars are optional — you're {trait}, so the day is already good 🌟",
        "{name}, luck is nearby. You're {trait}, just notice it 📅",
        "{name}, perfect day to be {trait}. Or to plan it 😏",
        "{name}, you're especially {sign_adj} today. Others will notice ✨",
    ]
};

// Прилагательные для знаков
const SIGN_ADJECTIVES: Record<string, { ru: string; en: string }> = {
    Aries: { ru: 'боевой', en: 'fierce' },
    Taurus: { ru: 'упёртый', en: 'stubborn' },
    Gemini: { ru: 'разговорчивый', en: 'chatty' },
    Cancer: { ru: 'заботливый', en: 'caring' },
    Leo: { ru: 'величественный', en: 'majestic' },
    Virgo: { ru: 'внимательный', en: 'attentive' },
    Libra: { ru: 'гармоничный', en: 'balanced' },
    Scorpio: { ru: 'загадочный', en: 'mysterious' },
    Sagittarius: { ru: 'свободолюбивый', en: 'free-spirited' },
    Capricorn: { ru: 'целеустремлённый', en: 'ambitious' },
    Aquarius: { ru: 'необычный', en: 'unique' },
    Pisces: { ru: 'мечтательный', en: 'dreamy' },
};

/**
 * Получить шутку для погоды
 */
export function getWeatherJoke(
    temperature: number,
    weatherCondition: string,
    sunSign: string,
    moonSign: string,
    marsSign?: string,
    language: 'ru' | 'en' = 'ru',
    displayName?: string
): string {
    // Определяем тип погоды
    let weatherType: 'cold' | 'warm' | 'hot' | 'rain' = 'warm';
    
    if (weatherCondition.toLowerCase().includes('rain') || weatherCondition.toLowerCase().includes('дождь')) {
        weatherType = 'rain';
    } else if (temperature < 5) {
        weatherType = 'cold';
    } else if (temperature > 25) {
        weatherType = 'hot';
    }

    // Выбираем случайный шаблон
    const templates = WEATHER_JOKE_TEMPLATES[weatherType][language];
    const template = templates[Math.floor(Math.random() * templates.length)];

    // Получаем черту знака
    const sunTraits = SIGN_TRAITS[sunSign]?.[language] || SIGN_TRAITS['Aries'][language];
    const trait = sunTraits[Math.floor(Math.random() * sunTraits.length)];

    const name = displayName?.trim() 
        ? displayName.trim() 
        : (language === 'ru' ? 'друг' : 'friend');

    // Заполняем шаблон
    return template
        .replace(/{temp}/g, String(Math.round(temperature)))
        .replace(/{name}/g, name)
        .replace(/{trait}/g, trait);
}

/**
 * Получить ежедневную шутку
 */
export function getDailyJoke(
    sunSign: string,
    moonSign: string,
    language: 'ru' | 'en' = 'ru',
    dayOfYear?: number,
    displayName?: string
): string {
    // Используем день года для детерминированного выбора (одна шутка в день)
    const day = dayOfYear ?? Math.floor(Date.now() / (1000 * 60 * 60 * 24));
    
    const templates = DAILY_JOKES[language];
    const template = templates[day % templates.length];

    // Получаем черту знака
    const sunTraits = SIGN_TRAITS[sunSign]?.[language] || SIGN_TRAITS['Aries'][language];
    const traitIndex = day % sunTraits.length;
    const trait = sunTraits[traitIndex];

    // Получаем прилагательное
    const adjective = SIGN_ADJECTIVES[sunSign]?.[language] || SIGN_ADJECTIVES['Aries'][language];

    const name = displayName?.trim() 
        ? displayName.trim() 
        : (language === 'ru' ? 'друг' : 'friend');

    return template
        .replace(/{name}/g, name)
        .replace(/{trait}/g, trait)
        .replace(/{sign_adj}/g, adjective);
}

/**
 * Получить случайный космический факт
 */
export function getCosmicFact(language: 'ru' | 'en' = 'ru'): string {
    const facts = {
        ru: [
            "Знал(а), что Венера — единственная планета, вращающаяся по часовой стрелке? Как типичная Венера — делает всё по-своему 💅",
            "Юпитер такой большой, что в него поместятся 1300 Земель. Типичный Стрелец — ему всегда мало места 🪐",
            "На Сатурне идут алмазные дожди. Козероги уже считают ROI 💎",
            "День на Меркурии длится 59 земных дней. Близнецы в шоке — это же целая вечность без смены темы! ⏰",
            "Нептун был найден математически, до того как его увидели. Очень по-рыбьи — сначала почувствовать, потом увидеть 🐟",
        ],
        en: [
            "Did you know Venus is the only planet spinning clockwise? Classic Venus — doing everything her way 💅",
            "Jupiter is so big that 1300 Earths could fit inside. Typical Sagittarius — always needs more space 🪐",
            "It rains diamonds on Saturn. Capricorns already calculating ROI 💎",
            "A day on Mercury lasts 59 Earth days. Geminis are shocked — that's forever without changing topics! ⏰",
            "Neptune was found mathematically before being seen. Very Pisces — feel it first, see it later 🐟",
        ]
    };

    const list = facts[language];
    return list[Math.floor(Math.random() * list.length)];
}
