/**
 * Система персонализированных космических шуток
 * Шутки генерируются на основе знаков Солнца, Луны и других планет
 */

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
        "{name}, today's mood is «{trait}». You're good to go 😴",
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
