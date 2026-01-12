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
            "На улице {temp}°C. Твой {planet} в {sign} говорит: «{trait}». Но давай честно — ты останешься дома 🏠",
            "Холодно ({temp}°C)! Твоя Луна в {moonSign} требует горячего чая и пледа. Марс протестует, но проиграет ☕",
            "{temp}°C за окном. Твой {sign} хотел бы героически выйти на мороз, но {moonSign} Луна уже включила сериал 📺",
        ],
        en: [
            "It's {temp}°C outside. Your {planet} in {sign} says: «{trait}». But let's be honest — you're staying home 🏠",
            "Cold ({temp}°C)! Your Moon in {moonSign} demands hot tea and a blanket. Mars protests but will lose ☕",
            "{temp}°C outside. Your {sign} wanted to heroically face the cold, but your {moonSign} Moon started Netflix 📺",
        ]
    },
    warm: {
        ru: [
            "Отличные {temp}°C! Твой {sign} кричит: «На улицу!», а {moonSign} Луна: «Но сначала кофе» ☕",
            "{temp}°C — идеально! Твой Марс в {marsSign} готов к подвигам. Венера предлагает подвиг на диване 🛋️",
            "Погода {temp}°C. Твой внутренний {sign} — {trait}. Внешний ты — в телефоне 📱",
        ],
        en: [
            "Nice {temp}°C! Your {sign} screams: «Go outside!», and your {moonSign} Moon: «But coffee first» ☕",
            "{temp}°C — perfect! Your Mars in {marsSign} is ready for action. Venus suggests couch adventures 🛋️",
            "Weather is {temp}°C. Your inner {sign} — {trait}. Actual you — on your phone 📱",
        ]
    },
    hot: {
        ru: [
            "Жара {temp}°C! Твой {sign} и {moonSign} Луна наконец согласны — мороженое. Срочно 🍦",
            "{temp}°C 🔥 Твой огненный {sign} в своей стихии! Твоя водная Венера ищет кондиционер 😅",
            "На улице {temp}°C. Твой {sign} {trait}, но при такой жаре даже он хочет в тень 🌴",
        ],
        en: [
            "Hot {temp}°C! Your {sign} and {moonSign} Moon finally agree — ice cream. Now 🍦",
            "{temp}°C 🔥 Your fiery {sign} is in its element! Your watery Venus is looking for AC 😅",
            "It's {temp}°C outside. Your {sign} {trait}, but even they want shade now 🌴",
        ]
    },
    rain: {
        ru: [
            "Дождь при {temp}°C. Твоя {moonSign} Луна: «Идеально для меланхолии». Твой {sign}: «{trait}» 🌧️",
            "Льёт дождь! Твой {sign} хотел продуктивный день, {moonSign} Луна включила lo-fi и смотрит в окно 🎵",
            "Дождливо ({temp}°C). Водные знаки счастливы. Ты, как {sign}, — {trait} 💧",
        ],
        en: [
            "Rain at {temp}°C. Your {moonSign} Moon: «Perfect for melancholy». Your {sign}: «{trait}» 🌧️",
            "It's raining! Your {sign} wanted a productive day, {moonSign} Moon started lo-fi and stares at window 🎵",
            "Rainy ({temp}°C). Water signs are happy. You, as a {sign}, — {trait} 💧",
        ]
    }
};

// Ежедневные шутки (не привязанные к погоде)
const DAILY_JOKES = {
    ru: [
        "Сегодня твой {sign} хочет {trait}. Луна в {moonSign} вносит коррективы: сначала поспать 😴",
        "Меркурий шепчет тебе: «Отправь это сообщение». Твоя {moonSign} Луна: «Подожди до завтра» 📱",
        "Венера в твоей карте говорит о любви. Марс отвечает: «А что насчёт пиццы?» 🍕",
        "Твой {sign} сегодня на высоте! Ну, или будет. После кофе. И ещё одного кофе ☕☕",
        "Звёзды говорят, что сегодня отличный день. Твой {moonSign} внутренний голос: «Посмотрим» 🌟",
        "Юпитер обещает удачу! Сатурн напоминает о дедлайне. Классика 📅",
        "Сегодня идеальный день чтобы {trait}. Или чтобы притвориться, что собираешься 😏",
        "Твой {sign} сегодня особенно {sign_adj}. Окружающие пока не в курсе, но скоро узнают ✨",
    ],
    en: [
        "Today your {sign} wants to {trait}. Your {moonSign} Moon adjusts: sleep first 😴",
        "Mercury whispers: «Send that message». Your {moonSign} Moon: «Wait until tomorrow» 📱",
        "Venus in your chart talks about love. Mars replies: «What about pizza?» 🍕",
        "Your {sign} is on fire today! Well, will be. After coffee. And another coffee ☕☕",
        "Stars say it's a great day. Your {moonSign} inner voice: «We'll see» 🌟",
        "Jupiter promises luck! Saturn reminds about the deadline. Classic 📅",
        "Perfect day to {trait}. Or to pretend you're going to 😏",
        "Your {sign} is especially {sign_adj} today. Others don't know yet, but they will ✨",
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
    language: 'ru' | 'en' = 'ru'
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

    // Заполняем шаблон
    return template
        .replace(/{temp}/g, String(Math.round(temperature)))
        .replace(/{sign}/g, sunSign)
        .replace(/{moonSign}/g, moonSign)
        .replace(/{marsSign}/g, marsSign || 'Aries')
        .replace(/{planet}/g, language === 'ru' ? 'Марс' : 'Mars')
        .replace(/{trait}/g, trait);
}

/**
 * Получить ежедневную шутку
 */
export function getDailyJoke(
    sunSign: string,
    moonSign: string,
    language: 'ru' | 'en' = 'ru',
    dayOfYear?: number
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

    return template
        .replace(/{sign}/g, sunSign)
        .replace(/{moonSign}/g, moonSign)
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
