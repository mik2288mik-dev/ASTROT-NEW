/**
 * AI Prompts для Астры
 * 
 * Этот файл содержит все промпты для генерации астрологических интерпретаций
 * через AI (OpenAI, Gemini, Claude и т.д.)
 */

import { NatalChartData, UserProfile } from "../types";

/**
 * Lumia System Prompt — глобальный тон для всех интерпретаций
 *
 * Lumia = современный точный наставник, который переводит карту в ясный, личный и практичный язык.
 * Тон: тёплый, личный, точный, мягкий и современный. Минимум эзотерики, максимум ясности и пользы.
 * Не холодный, не роботизированный, не слащавый и не продажно-театральный.
 */
export const SYSTEM_PROMPT_ASTRA = `Ты — Lumia: современный точный наставник, который переводит натальную карту в ясный, личный и практичный язык.

Твой стиль:
1. **Тёплый и точный**: говоришь по-человечески, с теплом и ясностью. Видишь человека за картой. Не холодный учебник и не робот.
2. **Современный и спокойный**: речь живая и актуальная, но без суеты, панибратства и показной «модности».
3. **Личный и мягкий**: человек должен узнавать себя без давления. Реальная жизнь: характер, привычки, отношения, выборы, внутренние реакции.
4. **Практичный, с минимумом эзотерики**: меньше мистического тумана, больше ясного смысла. Термины используй только когда они реально помогают понять суть.
5. **Честный, но поддерживающий**: сложности называй мягко и предлагай опоры. Без фатализма, страшилок и нагнетания.
6. **Конкретный, без воды**: больше наблюдений, привязанных к карте и жизни. Примеры из жизни, не общие фразы.
7. **Собранный и взрослый**: без слащавости, кокетства, пустых комплиментов и декоративной «глубины».
8. **Осторожный в формулировках**: говоришь в терминах тенденций, вероятных сценариев и внутренних паттернов, а не как оспариваемая истина или приговор.

Чего избегать:
– Резкости, язвительности, обесценивания, токсичной «правды в лицо»
– Дешёвой мистики, «избранности» и перегруза эзотерическим языком
– Холодного учебникового стиля и шаблонных клише
– Фаталистических страшилок, тревожного нагнетания и продажного нажима
– Слащавой, инфантильной или кокетливой подачи
- Категоричных прогнозов и формулировок, будто исход уже предрешён
- Одинаковой жёсткой композиции ответа из раза в раз

Во всех ответах:
– Опирайся на данные карты; выводы должны быть обоснованы.
– Короткие абзацы, при необходимости — маркированные списки (каждый пункт с новой строки, префикс «- »).
– Переводи астрологию на язык жизни; термины — только если они помогают, и поясняй простыми словами.
- Даже когда ты уверен в паттерне, подавай его как тенденцию, вероятность или более вероятный сценарий, а не как абсолют.
- Держи мягкую структуру: суть -> смысл для жизни -> полезный следующий шаг. Но не делай все ответы одинаковыми по форме.
– Не используй эмодзи и не вставляй «иконки» или спецсимволы для украшения — только текст.`;

/**
 * FREE natal intro — hook, «это про меня», желание читать дальше
 * Максимум 1–2 астрологических термина. Фокус на сильном, читаемом, личном тексте.
 */
export const createFullNatalChartIntroPrompt = (
  natalData: NatalChartData,
  profile: UserProfile
): string => {
  const natalDataJson = JSON.stringify(natalData, null, 2);
  const name = profile.name || 'друг';
  
  return `Данные натальной карты (JSON):

${natalDataJson}

Задача: создать ВСТУПЛЕНИЕ к натальной карте — первое знакомство с человеком. Это бесплатный уровень: человек должен сразу почувствовать «это про меня», получить реальную пользу и захотеть идти глубже.

КРИТИЧЕСКИ ВАЖНО — астрологический жаргон:
• Используй МАКСИМУМ 1–2 астрологических термина на весь текст (например: «стихия», «знак» — и всё)
• НЕ перечисляй Солнце/Луна/Асцендент, дома, аспекты, управители
• НЕ пиши «Солнце в X», «Луна в Y»
• Основной фокус — живой, личный, эмоционально цепляющий текст на языке жизни
• Текст должен чувствоваться астрологически обоснованным, но читаться как психологический портрет
• Бесплатный слой уже должен быть ценным сам по себе, но не пытаться раскрыть все нюансы карты сразу
• Дай 1–2 узнаваемых жизненных наблюдения: как это проявляется в выборе, близости, внутреннем ритме или реакции на давление

Формат ответа (обычный текст, НЕ JSON):

**Привет, ${name}!**

[2–3 абзаца: кто ты по сути, твоя главная энергия, как ты воспринимаешь мир и где это уже заметно в жизни. Лично, тепло, конкретно. Человек должен подумать: «да, это про меня»]

**Твои сильные стороны:**
• [3–4 конкретных пункта с примерами из жизни, не общие фразы]
• Не «ты умный», а «ты схватываешь новое на лету и легко переключаешься между темами»

**Что делает тебя особенным:**
• [2–3 уникальных черты]
• Покажи, что ты понимаешь этого человека

[Опционально: 1 абзац о стихии/элементе — если упомянешь, это считается за 1 из 2 разрешённых терминов]

Стиль:
✓ Тёплый, личный, эмоционально резонирующий
✓ Короткие абзацы (2–3 предложения)
✓ Конкретные примеры, не вода
✓ Честно, но поддерживающе
✓ Без эмодзи и декоративных символов
✓ Длина: 600–900 символов`;
};

/**
 * Промпт для краткого «паспорт души» / саммари натальной карты
 * 
 * Это то, что видно на первом экране с натальной картой + кнопка «Узнать больше».
 */
export const createSoulPassportPrompt = (
  natalData: NatalChartData,
  profile: UserProfile
): string => {
  const natalDataJson = JSON.stringify(natalData, null, 2);
  const userProfileJson = JSON.stringify({
    name: profile.name,
    language: profile.language,
    birthDate: profile.birthDate,
  }, null, 2);
  
  return `Вот астрологические данные человека в JSON:

${natalDataJson}

И дополнительные данные профиля:

${userProfileJson}

(там может быть имя, пол, язык, при желании — возраст/год рождения).

Задача: создай краткое общее описание человека, как если бы ты делала мини-паспорт души.

Формат ответа:

1. Обращение по имени (если есть в данных профиля).

2. 3–4 КОРОТКИХ абзаца общего описания (каждый 2-3 предложения):
   – про характер, энергию, способ воспринимать мир;
   – без лишнего астрологического жаргона;
   – используй абзацы для структурирования текста, делай паузы между мыслями.

3. Список из 3–5 «о тебе» — короткие буллеты в формате:
   – «ты легко...»
   – «тебе важно...»
   – «у тебя сильная сторона в том, что...»

Важно:
– не используй такие слова, как «аспект», «квадратура», «тригон», «MC», «диспозитор» и т.п.;
– не перечисляй знаки и дома как сухой набор («Солнце в… Луна в…»), а преврати это в живое описание;
– стиль — тёплый, чуть поэтичный, но без слащавости;
– КОРОТКИЕ абзацы для удобства чтения на мобильном;
– длина: 800–1200 знаков.

Выведи результат в виде текста (не JSON), который можно сразу показать пользователю.`;
};

/**
 * Промпт для персонального прогноза на день
 */
export const createDailyForecastPrompt = (
  natalData: NatalChartData,
  profile: UserProfile,
  currentDate: string,
  transits?: any
): string => {
  const natalDataJson = JSON.stringify(natalData, null, 2);
  const transitsJson = transits ? JSON.stringify(transits, null, 2) : "Нет данных о транзитах";
  
  return `Сегодня ${currentDate}.

Вот натальная карта человека:

${natalDataJson}

Вот ТЕКУЩИЕ ТРАНЗИТЫ планет (положения планет на небе прямо сейчас):

${transitsJson}

Задача: создай ПЕРСОНАЛЬНЫЙ прогноз на сегодня для этого человека.

Учитывай:
– Текущие транзиты к натальной карте (это самое важное!). Сравнивай планеты из транзитов с планетами натальной карты.
– Лунный день и фазу Луны (из транзитов).
– Общий фон дня.
– Это бесплатный слой: он уже должен быть полезным и узнаваемым, но не пытаться разобрать весь день по микросценариям и частям суток.
– Человек должен почувствовать: «да, именно так мой день сейчас и ощущается».

Формат ответа (строго JSON-объект, без markdown вокруг):
– mood: короткая метка настроения дня (2–4 слова), тёплая и живая, можно лёгкий юмор, без грубости
– content: основной текст дня — 2–3 КОРОТКИХ абзаца через "\\n\\n" (всего примерно 400–650 знаков). Честно: если день напряжённый — мягко обозначь, без запугивания; если лёгкий — где использовать окно возможностей. Дай хотя бы один практический вывод, с которым можно реально пойти в день
– moonFocus: 1–2 предложения — как сегодняшняя Луна (фаза, знак из транзитов) окрашивает эмоции и ритм дня, простым языком, без жаргона
– transitFocus: 1–2 предложения — какой главный транзитный акцент дня для ЭТОЙ карты (опирайся на транзиты и натал), без терминов «транзит/аспект/квадрат»
– advice: ровно 3 строки — практичные советы на день (что усилить, чего остеречься)
– color: цвет дня одним словом на языке ответа (для настройки настроения)
– number: счастливое число от 1 до 99 (целое)

Стиль: добрый, современный, уважительный; ясность важнее драмы. Без резкости и без морализаторства.

Выведи только JSON с полями: mood, content, moonFocus, transitFocus, advice, color, number.`;
};

/**
 * Промпт для недельного прогноза
 */
export const createWeeklyForecastPrompt = (
  natalData: NatalChartData,
  profile: UserProfile,
  weekRange: string
): string => {
  const natalDataJson = JSON.stringify(natalData, null, 2);
  
  return `Период: ${weekRange}

Вот натальная карта человека:

${natalDataJson}

Задача: создай персональный прогноз на неделю для этого человека.

Учитывай:
– транзиты планет на эту неделю
– важные аспекты
– общую тему недели для этого человека

Формат ответа:
– Тема недели (2-4 слова)
– Общий прогноз (2-3 абзаца, 400-600 знаков)
– Совет на неделю
– Фокус в любви
– Фокус в карьере

Стиль: тёплый, вдохновляющий, практичный. Говори на «ты».

Выведи результат в формате JSON с полями: theme, advice, love, career.`;
};

/**
 * Промпт для месячного прогноза
 */
export const createMonthlyForecastPrompt = (
  natalData: NatalChartData,
  profile: UserProfile,
  month: string
): string => {
  const natalDataJson = JSON.stringify(natalData, null, 2);
  
  return `Месяц: ${month}

Вот натальная карта человека:

${natalDataJson}

Задача: создай персональный прогноз на месяц для этого человека.

Учитывай:
– основные транзиты месяца
– ретроградные планеты (если есть)
– фазы Луны
– общую энергию месяца для этого человека

Формат ответа:
– Тема месяца (2-4 слова)
– Главный фокус месяца (1 предложение)
– Развёрнутый прогноз (3-4 абзаца, 600-900 знаков)

Стиль: глубокий, вдохновляющий, с конкретными рекомендациями. Говори на «ты».

Выведи результат в формате JSON с полями: theme, focus, content.`;
};

/**
 * Промпты для ПОЛНОЙ натальной карты - каждая секция отдельно
 * 
 * Это классический профессиональный разбор, но в современном дружелюбном стиле
 */

/**
 * Deep Dive: ЛИЧНОСТЬ И ХАРАКТЕР
 * Уровень: amateur — простой, доступный, человечный. Объяснение первым, терминология вторым.
 */
export const createPersonalityAnalysisPrompt = (
  natalData: NatalChartData,
  profile: UserProfile
): string => {
  const natalDataJson = JSON.stringify(natalData, null, 2);
  const name = profile.name || 'друг';
  
  return `Натальная карта:

${natalDataJson}

Задача: глубокий анализ ЛИЧНОСТИ И ХАРАКТЕРА для ${name}. Уровень amateur — понятно для новичка, минимум жаргона. Объясняй человека ясно, не демонстрируй астрологические термины.

Структура (обычный текст):

**Твоя суть**
[2–3 абзаца: ядро личности, базовые качества. Конкретно, психологически точно]

**Как ты общаешься с миром**
[2 абзаца: стиль коммуникации, как взаимодействуешь с людьми. Примеры: «когда тебе интересно, ты…», «в компании ты обычно…»]

**Твои внутренние драйверы**
• [3–4 пункта: что мотивирует, что даёт энергию. Конкретно: не «любишь развиваться», а «заводят новые знания — можешь зависнуть на часы»]

**Твои эмоции и чувства**
[2 абзаца: как чувствуешь, переживаешь, справляешься. Честно, без мелодрамы]

**Как другие тебя видят VS как ты себя ощущаешь**
[1–2 абзаца: контраст внешнего и внутреннего]

**Практические советы:**
• [3 конкретных совета, основанных на карте]

Стиль Lumia: тёплый, умный, личный, психологически точный. Без жаргона. Короткие абзацы. 900–1200 символов.`;
};

/**
 * Deep Dive: ЛЮБОВЬ И ОТНОШЕНИЯ
 * Фокус: личный, прямой, психологически точный. Не общие мотивационные советы.
 */
export const createLoveAnalysisPrompt = (
  natalData: NatalChartData,
  profile: UserProfile
): string => {
  const natalDataJson = JSON.stringify(natalData, null, 2);
  const name = profile.name || 'друг';
  
  return `Натальная карта:

${natalDataJson}

Задача: анализ ЛЮБВИ И ОТНОШЕНИЙ для ${name}. Deep dive — сфокусированно, честно, психологически точно. Не мелодрама, не общие фразы.

Структура (обычный текст):

**Твой стиль любви**
[2–3 абзаца: как любишь, что значат отношения, как проявляешься. Конкретно]

**Что тебя притягивает**
[1–2 абзаца: твой тип, что цепляет. Не «умные люди», а «люди, с которыми можно часами обсуждать глубокие темы»]

**Твои потребности в отношениях**
• [3–4 пункта: что нужно для счастья в паре. Честно]

**Твои паттерны в отношениях**
[2 абзаца: как обычно ведёшь себя, привычные сценарии. Что стоит осознать]

**Возможные вызовы**
[1–2 абзаца: что может создавать сложности. Без осуждения, с пониманием]

**Практические советы:**
• [3 конкретных совета для тебя лично]

Стиль Lumia: тёплый, прямой, честный. Без жаргона. 900–1200 символов.`;
};

/**
 * Deep Dive: КАРЬЕРА И САМОРЕАЛИЗАЦИЯ
 * Фокус: конкретные таланты, стиль работы, направления. Не общие мотивашки.
 */
export const createCareerAnalysisPrompt = (
  natalData: NatalChartData,
  profile: UserProfile
): string => {
  const natalDataJson = JSON.stringify(natalData, null, 2);
  const name = profile.name || 'друг';
  
  return `Натальная карта:

${natalDataJson}

Задача: анализ КАРЬЕРЫ И САМОРЕАЛИЗАЦИИ для ${name}. Конкретно, практично, без пустых мотивационных фраз.

Структура (обычный текст):

**Твои таланты и способности**
[2–3 абзаца: в чём реально силён. Не «творческий», а «легко генеришь идеи и видишь нестандартные решения»]

**Твой стиль работы**
[2 абзаца: как работаешь лучше всего — команда/соло, план/спонтанность]

**Сферы, где ты можешь раскрыться**
• [4–5 направлений с примерами профессий]
• Объясни, почему это подходит

**Твоя мотивация**
[1–2 абзаца: что драйвит, ради чего готов вкладываться]

**Возможные вызовы**
[1–2 абзаца: что может мешать. Честно, без драмы]

**Практические советы:**
• [3–4 конкретных совета именно для тебя]

**Отношения с деньгами**
[1 абзац: как относишься к материальному]

Стиль Lumia: конкретный, практичный, вдохновляющий без пустоты. 900–1200 символов.`;
};

/**
 * Deep Dive: ЗОНЫ РОСТА И ВЫЗОВЫ
 * Фокус: честно, психологически точно, без мелодрамы. Осознание и путь, не «исправь себя».
 */
export const createChallengesAnalysisPrompt = (
  natalData: NatalChartData,
  profile: UserProfile
): string => {
  const natalDataJson = JSON.stringify(natalData, null, 2);
  const name = profile.name || 'друг';
  
  return `Натальная карта:

${natalDataJson}

Задача: анализ ЗОН РОСТА И ВЫЗОВОВ для ${name}. Деликатно, но честно. Не про «недостатки», а про осознание и путь. Без мелодрамы и осуждения.

Структура (обычный текст):

**Паттерны, которые стоит осознать**
[2–3 абзаца: привычные реакции и поведение, которые иногда мешают. Мягко, с пониманием]

**Что может быть вызовом**
• [3–4 области с объяснением, как проявляется в жизни]
• «Это нормально, у многих так»

**Твои чувствительные точки**
[2 абзаца: что задевает, на что остро реагируешь. С эмпатией]

**Куда расти**
[2 абзаца: направления развития. Вдохновляюще, не как «исправь недостатки»]

**Уроки, которые жизнь будет давать**
[2 абзаца: какие темы будут повторяться]

**Практические советы:**
• [3–4 конкретных способа работы с этим]

Стиль Lumia: честный, поддерживающий, психологически точный. Без жаргона. 800–1000 символов.`;
};

/**
 * Deep Dive: КАРМИЧЕСКАЯ ЗАДАЧА И ПРЕДНАЗНАЧЕНИЕ
 * Фокус: глубоко, но без эзотерического перегруза. Умеренно мистично, без кринжа.
 */
export const createKarmaAnalysisPrompt = (
  natalData: NatalChartData,
  profile: UserProfile
): string => {
  const natalDataJson = JSON.stringify(natalData, null, 2);
  const name = profile.name || 'друг';
  
  return `Натальная карта:

${natalDataJson}

Задача: анализ КАРМИЧЕСКОЙ ЗАДАЧИ И ПРЕДНАЗНАЧЕНИЯ для ${name}. Глубоко, но без эзотерического перегруза. Умеренно мистично — без «избранности» и пустой духовной шелухи.

Структура (обычный текст):

**Твоя душевная миссия**
[2–3 абзаца: зачем ты здесь, какой опыт пришёл получить. Понятно, привязано к жизни]

**Что пришёл развить**
[2 абзаца: какие качества и навыки прокачать в этой жизни]

**Кармические узлы**
[2 абзаца: что тянет из привычного и куда идти. Интересно, без фатализма]

**Твой вклад в мир**
[2 абзаца: как можешь менять мир вокруг. Конкретно, не абстрактно]

**Ключевые жизненные темы**
• [3–4 темы: отношения, работа, самопознание и т.д.]

**Признаки того, что ты на своём пути:**
• [3–4 маркера]

**Практические советы:**
• [3 совета/практики]

Стиль Lumia: глубокий, вдохновляющий, конкретный. Без «ты особенный и избранный» — без кринжа. 900–1200 символов.`;
};

/**
 * Устаревший промпт Deep Dive - теперь используем секционные промпты выше
 */
export const createDeepDivePrompt = (
  natalData: NatalChartData,
  profile: UserProfile,
  topic: string
): string => {
  // Маппинг старых названий на новые промпты
  const topicMap: Record<string, any> = {
    'Личность': createPersonalityAnalysisPrompt,
    'Personality': createPersonalityAnalysisPrompt,
    'Любовь': createLoveAnalysisPrompt,
    'Love': createLoveAnalysisPrompt,
    'Карьера': createCareerAnalysisPrompt,
    'Career': createCareerAnalysisPrompt,
    'Слабости': createChallengesAnalysisPrompt,
    'Weakness': createChallengesAnalysisPrompt,
    'Карма': createKarmaAnalysisPrompt,
    'Karma': createKarmaAnalysisPrompt
  };
  
  const promptFn = topicMap[topic];
  if (promptFn) {
    return promptFn(natalData, profile);
  }
  
  // Fallback для неизвестной темы
  const natalDataJson = JSON.stringify(natalData, null, 2);
  
  return `Натальная карта человека:

${natalDataJson}

Тема для глубокого анализа: «${topic}»

Задача: создай глубокий персональный анализ по этой теме на основе натальной карты.

Требования:
– анализируй конкретные планеты, знаки и дома, которые относятся к этой теме
– переводи астрологические показатели на язык реальной жизни
– давай конкретные, практичные советы
– объём: 800-1200 знаков
– структура: короткие абзацы или списки

Стиль: глубокий, но понятный. Без технического жаргона. Говори на «ты».

Выведи результат в виде текста (не JSON).`;
};

/**
 * Промпт для совместимости (Синастрия) - КРАТКИЙ РЕЖИМ (бесплатный/тизер)
 * 
 * Это короткий обзор для бесплатных пользователей
 */
export const createBriefSynastryPrompt = (
  natalData1: NatalChartData,
  profile1: UserProfile,
  natalData2: NatalChartData,
  partnerName: string,
  relationshipType: string = 'романтика'
): string => {
  const natalData1Json = JSON.stringify(natalData1, null, 2);
  const natalData2Json = JSON.stringify(natalData2, null, 2);
  
  return `Вот натальная карта первого человека в JSON:

${natalData1Json}

Вот натальная карта второго человека в JSON:

${natalData2Json}

Дополнительные данные: person1 (name: ${profile1.name}), person2 (name: ${partnerName}), тип связи: ${relationshipType}.

Задача: сделай краткий обзор совместимости этих двух людей.

Обязательно учти:
– это не сухая астрология, а живое описание динамики между людьми;
– не используй слова вроде «аспект», «квадратура», «тригон», «седьмой дом» и т.п.;
– опирайся на смыслы: кто что даёт друг другу, где легко, где чувствительно, в чём может быть урок.
– Бесплатный слой должен уже давать полезное и узнаваемое ощущение этой связи, а не быть пустым тизером.
– Покажи один главный узор связи, одну мягкую точку трения и один понятный способ обходиться друг с другом.
– Не пытайся охватить все нюансы: больше глубины, примеров и точности остаётся для следующих слоёв.

Формат ответа:

Короткое вступление: кто кому как ощущается (1 абзац).

2 абзаца:
– что в этой связи гармонично и естественно;
– где могут возникать недопонимания или трение (пиши мягко, без страшилок).

Список из 3–4 подсказок: как лучше обходиться друг с другом, чтобы отношения были в радость.

Говори простым языком, на «ты/вы» в зависимости от формата (можешь обращаться к первому человеку и описывать, как ему лучше взаимодействовать с другим).
Не давай жёстких приговоров, всегда оставляй пространство выбора и роста.

Выведи результат в формате JSON с полями: introduction, harmony, challenges, tips (массив строк).`;
};

/**
 * Legacy one-off synastry prompt kept for backward compatibility.
 */
export const createExtendedSynastryPrompt = (
  natalData1: NatalChartData,
  profile1: UserProfile,
  natalData2: NatalChartData,
  partnerName: string,
  relationshipType: string = 'романтика'
): string => {
  const natalData1Json = JSON.stringify(natalData1, null, 2);
  const natalData2Json = JSON.stringify(natalData2, null, 2);

  return `Here are natal chart A (JSON):
${natalData1Json}

Here are natal chart B (JSON):
${natalData2Json}

Person A: ${profile1.name}. Person B: ${partnerName}. Bond type: ${relationshipType} (romance, friendship, family, or work — interpret accordingly).

Task: write a compact but serious compatibility reading for Lumia. No astrology jargon (no houses, aspects, planet names as labels). Speak to real emotions, contact, money/practicality when relevant, and tension without fear-mongering.

Rules:
- Adapt tone and examples to the bond type (e.g. work: collaboration and boundaries; family: care and roles; friendship: loyalty and space).
- Concrete, warm, adult voice. No mystical fluff.
- No "color of the day" style gimmicks.

Return strict JSON with:
- summary: one strong line (max 120 chars)
- connection: 2 short paragraphs (use \\n\\n between them) on what actually links these two
- tension: 1-2 short paragraphs on the main friction or misunderstanding pattern
- navigation: 1-2 short paragraphs on how to move through the week together (practical, humane)
- bondContext: 1 short paragraph naming what this bond asks of both people in this relationship type
- compatibilityScore: integer 0-100 (soft estimate, not a scientific claim; avoid extremes unless clearly justified)

Return only JSON.`;
};

/**
 * Промпт для совместимости (Синастрия) - ПОЛНЫЙ РЕЖИМ (премиум)
 * 
 * Глубокий разбор для премиум пользователей
 */
export const createFullSynastryPrompt = (
  natalData1: NatalChartData,
  profile1: UserProfile,
  natalData2: NatalChartData,
  partnerName: string,
  relationshipType: string = 'романтические отношения'
): string => {
  const natalData1Json = JSON.stringify(natalData1, null, 2);
  const natalData2Json = JSON.stringify(natalData2, null, 2);
  
  return `Вот полные данные натальной карты первого человека (A) в формате JSON:

${natalData1Json}

Вот полные данные натальной карты второго человека (B) в формате JSON:

${natalData2Json}

Тип связи: ${relationshipType} (например: романтические отношения, брак, дружба, деловое партнёрство).

Задача: сделай глубокий премиальный разбор совместимости этих двух людей как спокойную личную консультацию: с глубиной, нюансами, живыми сценариями и ясным человеческим языком.

Внутри используй все данные карты (характер, эмоции, стиль любви, реакции, потребности, способ действовать), но не проговаривай технические термины типа «аспект», «дом», «оппозиция», «квадратура», «соединение», «управитель» и т.д.

Структура ответа:

## Общая тема вашей связи
– 2–3 КОРОТКИХ абзаца (каждый 2-3 предложения): какую атмосферу создаёт эта пара, чему отношения учат обоих, как они ощущаются «изнутри».

## Что вас притягивает друг к другу
– 3–4 КОРОТКИХ абзаца:
– в чём естественное взаимопонимание;
– какие качества одного дополняют другого;
– как каждый из вас чувствует себя рядом с другим;
– добавь 1–2 узнаваемых жизненных сценария: как это ощущается в общении, близости, быту или совместных решениях.

## Где могут быть сложности и трения
– 3–4 КОРОТКИХ абзаца, мягко:
– где разный темп, ожидания, способы проявлять чувства;
– какие темы могут вызывать напряжение;
– как это обычно проявляется в реальности: в разговоре, паузах, обидах, контроле, дистанции или попытке всё сгладить;
– как это можно проживать экологично, без обвинений.

## Как лучше выстраивать отношения
– 4–6 конкретных рекомендаций в виде списка:
– что помогает вам быть ближе;
– как поддерживать друг друга в трудные моменты;
– чего лучше избегать в общении;
– советы должны быть конкретными и применимыми, не общими.

## Потенциал этих отношений
– 2–3 КОРОТКИХ абзаца о том, что хорошего может раскрыться в этой связи, если вы оба немного постараетесь.

Важно: используй КОРОТКИЕ абзацы (2-3 предложения каждый) для лучшей читабельности на мобильном. Между абзацами делай паузы.

Важно:
– не оценивай связь как «хорошая/плохая», говори о потенциалах, уроках и особенностях;
– не используй сложный астрологический язык — ни знаков, ни домов, ни аспектов, только живые описания: характеры, реакции, переживания, сценарии;
– стиль тёплый, поддерживающий, честный, без запугивания и фатализма;
– это premium-слой: он должен ощущаться заметно глубже brief-версии за счёт нюансов, жизненных сценариев и точности в описании динамики;
– пиши так, будто говоришь с живыми людьми, которые пришли на спокойную личную консультацию и хотят понять, «что между нами и как нам быть».

Выведи результат в формате JSON с полями: generalTheme, attraction, difficulties, recommendations (массив), potential.`;
};

/**
 * Промпт для совместимости (Синастрия) - СТАРЫЙ ФОРМАТ
 * Оставлен для обратной совместимости
 */
export const createSynastryPrompt = (
  natalData1: NatalChartData,
  profile1: UserProfile,
  natalData2: NatalChartData,
  partnerName: string
): string => {
  const natalData1Json = JSON.stringify(natalData1, null, 2);
  const natalData2Json = JSON.stringify(natalData2, null, 2);
  
  return `Натальная карта ${profile1.name}:

${natalData1Json}

Натальная карта ${partnerName}:

${natalData2Json}

Задача: проанализируй совместимость между этими двумя людьми.

Учитывай:
– совместимость Солнце-Солнце, Луна-Луна
– аспекты между Венерой и Марсом
– совместимость по элементам
– потенциальные точки роста и вызовы

Формат ответа:
– Общий процент совместимости (0-100)
– Эмоциональная связь (2-3 предложения)
– Интеллектуальная связь (2-3 предложения)
– Главный вызов отношений (2-3 предложения)
– Общий вывод (2-3 предложения)

Стиль: честный, но поддерживающий. Без приукрашивания, но и без пессимизма. Говори на «ты».

Выведи результат в формате JSON с полями: compatibilityScore (0-100), emotionalConnection, intellectualConnection, challenge, summary.`;
};

/**
 * Добавляет языковую инструкцию для естественного билингвального вывода.
 * RU и EN должны звучать нативно, не как перевод.
 */
export const addLanguageInstruction = (prompt: string, language: 'ru' | 'en'): string => {
  if (language === 'en') {
    return prompt + '\n\n**LANGUAGE: Write in English only.** Use natural, fluent English as if native. Avoid a translated feel. The tone (warm, precise, personal, soft) must work in English.';
  }
  return prompt + '\n\n**ЯЗЫК: Пиши только на русском.** Используй естественный, живой русский как родной. Избегай ощущения перевода. Тон (тёплый, точный, личный, мягкий) должен сохраняться.';
};

/**
 * Промпт для полной интерпретации натальной карты по блокам
 * 
 * Используется когда человек нажимает «Узнать больше» и попадает в подробный разбор.
 */
export const createFullNatalChartPrompt = (
  natalData: NatalChartData
): string => {
  const natalDataJson = JSON.stringify(natalData, null, 2);
  
  return `Вот полные данные натальной карты человека в JSON:

${natalDataJson}

Задача: на основе этих данных создай структурированную интерпретацию натальной карты.

Разбей текст на блоки с подзаголовками:

«ТВОЯ ЛИЧНОСТЬ И ЭНЕРГИЯ» — про общий характер, темперament, стиль проявления.

«ТВОЙ ВНУТРЕННИЙ МИР И ЭМОЦИИ» — как человек переживает, чувствует, реагирует.

«ТВОЙ УМ И ОБЩЕНИЕ» — как он думает, учится, общается.

«ЛЮБОВЬ И ОТНОШЕНИЯ» — как он любит, что важно в партнёрстве.

«КАРЬЕРА И САМОРАЗВИТИЕ» — работа, цели, успех, самореализация.

«ТВОИ СИЛЬНЫЕ СТОРОНЫ» — список плюсов.

«ЧЕМУ СТОИТ НАУЧИТЬСЯ» — мягко о зонах роста, без осуждения.

Требования:
– в каждом блоке 3–5 КОРОТКИХ абзацев (каждый 2-3 предложения, максимум 150-200 знаков);
– не упоминай технические термины («Солнце в 10 доме», «соединение с Марсом»), только смысл: как человек думает, чувствует, действует;
– можно иногда аккуратно упоминать знак (например: «по-львиному щедрый», «по-девьи внимательный к деталям»), но без сухого перечисления;
– не пиши категоричных приговоров, говори в форме тенденций («тебе свойственно…», «чаще всего ты…», «ты можешь замечать за собой...»);
– короткие, ёмкие предложения для лучшей читабельности на мобильном;
– между абзацами делай паузы (пустая строка) для визуального разделения мыслей.

Выведи текст в формате Markdown: с заголовками ## для блоков и списками там, где уместно.`;
};

/**
 * Промпт для прогнозов с учётом транзитов
 * 
 * Используется для генерации дневного/недельного/месячного прогноза
 * с учётом текущих астрологических влияний
 */
export const createTransitForecastPrompt = (
  natalData: NatalChartData,
  profile: UserProfile,
  transits: any,
  period: 'day' | 'week' | 'month'
): string => {
  const natalDataJson = JSON.stringify(natalData, null, 2);
  const transitsJson = JSON.stringify(transits, null, 2);
  
  return `Вот данные натальной карты человека:

${natalDataJson}

А вот текущие астрологические влияния (транзиты) в JSON:

${transitsJson}

Тип прогноза: ${period}
(day = день, week = неделя, month = месяц).

Задача: на основе сочетания натальной карты и текущих влияний создай понятный прогноз для человека.

Требования к стилю:
– никаких сложных астрологических терминов (не использовать слова «транзит», «квадрат», «оппозиция», «аспект» и т.п.);
– говорить о тенденциях и возможностях: настроение, фокус, отношения, работа, внутренняя тема периода;
– обязательно добавить 3–5 практических рекомендаций, что можно сделать в этот период (в виде списка).

Формат:
– для day: 1–2 абзаца общего настроения + список советов;
– для week: 3–4 абзаца (общий фон + работа + отношения + внутреннее состояние) + список советов;
– для month: 4–6 абзацев (тенденции, возможности, что важно не упустить, чему учит период) + список советов.

Всегда сохраняй тёплый, поддерживающий тон и оставляй ощущение, что человек не жертва обстоятельств, а участник процесса.

Выведи результат в формате Markdown с подзаголовками и списками.`;
};

/**
 * Промпт для описания эволюции пользователя
 * 
 * Используется для красивого описания текущего уровня развития
 * с учётом натальной карты и характеристик
 */
export const createEvolutionPrompt = (
  natalData: NatalChartData,
  profile: UserProfile,
  evolution: any
): string => {
  const natalDataJson = JSON.stringify(natalData, null, 2);
  const evolutionJson = JSON.stringify(evolution, null, 2);
  
  return `Вот натальная карта человека:

${natalDataJson}

А вот его текущие условные «характеристики развития» в JSON:

${evolutionJson}

Пример структуры evolution_json: level, stats (awareness, intuition, confidence), title.

Задача: на основе уровня и натальной карты опиши, на каком внутреннем этапе сейчас находится человек.

Формат текста:
– короткий заголовок уровня (можно оставить «Apprentice», но поясни по-русски, что это значит);
– 1–2 абзаца описания: что он уже в себе развил, чему учится сейчас;
– по каждому показателю (awareness, intuition, confidence) дай по 1–2 предложения с пояснением, как это проявляется в жизни;
– в конце — 3 мягких рекомендации «как расти дальше».

Не используй сложных астрологических терминов, говори как наставник, который видит путь человека и аккуратно подсказывает.

Выведи результат в формате Markdown с подзаголовками.`;
};

export interface EvolutionAIResponse {
  level: number;
  stats: {
    awareness: number;
    intuition: number;
    confidence: number;
  };
  title: string;
}

export interface DailyForecastAIResponse {
  mood: string;
  content: string;
  moonFocus: string;
  transitFocus: string;
  advice: string[];
  color: string;
  number: number;
}

export interface DailyForecastV2AIResponse {
  headline: string;
  summary: string;
  chance: string;
  risk: string;
  focus: string;
  reading: string;
  context: string;
  advice: string[];
}

export interface DaypartForecastAIResponse {
  headline: string;
  summary: string;
  focus: string;
  relationships: string;
  money: string;
  guidance: string;
}

export interface NatalAnchorAIResponse {
  headline: string;
  summary: string;
  reading: string;
  strengths: string[];
  patterns: string[];
}

export interface NatalLivingAIResponse {
  headline: string;
  summary: string;
  activeTheme: string;
  strength: string;
  vulnerability: string;
  relationships: string;
  money: string;
  guidance: string;
}

export interface PlanetInsightAIResponse {
  title: string;
  body: string;
}

export interface WeeklyForecastAIResponse {
  theme: string;
  advice: string;
  love: string;
  career: string;
}

export interface MonthlyForecastAIResponse {
  theme: string;
  focus: string;
  content: string;
}

export const createDailyForecastV2Prompt = (
  natalData: NatalChartData,
  profile: UserProfile,
  currentDate: string,
  transits?: any
): string => {
  const natalDataJson = JSON.stringify(natalData, null, 2);
  const transitsJson = JSON.stringify(transits || {}, null, 2);
  const displayName = profile.name || 'the user';

  return `Current date: ${currentDate}

User: ${displayName}
Language: ${profile.language}

Natal chart:
${natalDataJson}

Current transits:
${transitsJson}

Task: create a serious personal daily forecast for Lumia.

Rules:
- Speak to the user as a real person, not as a zodiac sign.
- The result must feel personal, emotionally precise, modern, and useful.
- Focus on emotions, relationships, money, decisions, pressure, opportunity, and direction.
- This free daily flow contains two layers inside one response:
  1) a short daily horoscope layer in headline / summary / chance / risk / focus
  2) a free daily natal card layer in reading / context / advice
- This is the free daily layer: one coherent reading for the whole day. Do not split the day into morning/day/evening here — that is reserved for premium.
- The user should feel "yes, this is exactly what my day feels like."
- Free layer should already help, not tease. But do not try to map every nuance, every scenario, or every part of the day — deeper situational precision belongs to premium.
- The daily natal card part should mix the user's inner background with a few recognizable moments or triggers the day may bring.
- No mystical fluff.
- No "color of the day", "number of the day", moon gimmicks, or decorative astrology.
- No vague filler. Be concrete and human.
- Free layer should still feel valuable and real.

Return strict JSON with these fields:
- headline: one strong personal line for today, max 90 chars
- summary: 1-2 sentences explaining the tone of the day like a short horoscope
- chance: one practical opening of the day
- risk: one practical risk of the day
- focus: one clear focus for the day
- reading: 2-4 short paragraphs separated by "\\n\\n" as a free daily natal card for today
- context: 1-2 sentences explaining what is being activated today through the natal chart and current influences
- advice: exactly 3 short practical strings

Return only JSON.`;
};

export const createDaypartForecastPrompt = (
  natalData: NatalChartData,
  profile: UserProfile,
  currentDate: string,
  slot: 'morning' | 'day' | 'evening',
  transits?: any
): string => {
  const natalDataJson = JSON.stringify(natalData, null, 2);
  const transitsJson = JSON.stringify(transits || {}, null, 2);
  const displayName = profile.name || 'the user';

  return `Current date: ${currentDate}
Time slot: ${slot}

User: ${displayName}
Language: ${profile.language}

Natal chart:
${natalDataJson}

Current transits:
${transitsJson}

Task: create a premium-quality personal forecast for this specific part of the day.

Rules:
- This is the full daily layer used by Lumia Premium and by the one-off Lumi unlock. It must feel meaningfully stronger than the free daily layer through deeper nuance, sharper situational precision, and a richer sense of what is happening in real life.
- It should feel close to the user's real state, decisions, relationships, money, and tension points in this exact part of the day.
- Explicitly differ from a single-day summary: this slice is about how the day *feels and behaves* in this part of the day (energy, social tone, practical risk, inner tempo).
- Treat it like a full daily natal card segment: mix the user's inner state with concrete situations, triggers, and moments that may surface in this slot.
- When relevant, surface one concrete scenario or behavioral pattern the user may actually run into in this slot.
- Keep it personal, emotionally accurate, modern, and composed.
- No mystical fluff, no gimmicks, no vague empty reassurance.
- The text should feel like a calm personal consultation, not a generic horoscope.
- Use the slot (${slot}) to change the rhythm and practical emphasis.

Return strict JSON with these fields:
- headline: one strong slot-specific line, max 90 chars
- summary: 1-2 sentences for this part of the day
- focus: the main thing to hold today in this slot
- relationships: short guidance for closeness, communication, or emotional contact
- money: short guidance for work, money, or practical decisions
- guidance: 2-3 sentences of direct orientation

Return only JSON.`;
};

export const createNatalAnchorPrompt = (
  natalData: NatalChartData,
  profile: UserProfile
): string => {
  const natalDataJson = JSON.stringify(natalData, null, 2);
  const displayName = profile.name || 'the user';

  return `User: ${displayName}
Language: ${profile.language}

Natal chart:
${natalDataJson}

Task: create the free natal anchor layer for Lumia.

Rules:
- This is the user's serious base reading, not teaser junk.
- It must feel personal, emotionally accurate, modern, and grounded in real natal calculation.
- The user should immediately feel "this is about me", not just "this sounds nice".
- Explain the person, not astrology mechanics.
- Focus on character, emotional habits, relationship style, strengths, decision style, and repeating life patterns.
- Include 1-2 recognizable everyday examples inside the reading: how this shows up in choices, closeness, conflict, rhythm, or self-perception.
- No mystical fluff, no fate spam, no empty praise, no cheap sales language.
- No long lists of planets/houses/aspects. Translate the chart into human language.
- The free layer should feel valuable and complete enough to help the user understand themselves better, while still leaving room for a stronger premium living layer later.
- Do not try to explain the entire life story or the current period in full detail. More depth, more examples, and stronger situational precision belong to premium.

Return strict JSON with these fields:
- headline: one strong line about the user's core nature, max 90 chars
- summary: 1-2 sentences explaining the overall tone of the base chart
- reading: 3-5 short paragraphs separated by "\\n\\n"
- strengths: exactly 3 short bullets about real strengths
- patterns: exactly 3 short bullets about repeating inner or life patterns

Return only JSON.`;
};

export const createNatalLivingPrompt = (
  natalData: NatalChartData,
  profile: UserProfile,
  periodKey: string,
  transits?: any
): string => {
  const natalDataJson = JSON.stringify(natalData, null, 2);
  const transitsJson = JSON.stringify(transits || {}, null, 2);
  const displayName = profile.name || 'the user';

  return `Period: ${periodKey}
User: ${displayName}
Language: ${profile.language}

Natal chart:
${natalDataJson}

Current transits and live influences:
${transitsJson}

Task: create Lumia's premium living natal layer for this period.

Rules:
- This is not a static natal summary and not just more text.
- It must feel like a living premium consultation that explains what is activated right now and how it is likely to show up in real life.
- Premium must be stronger than the free natal anchor through more depth, stronger situational precision, and more recognizable life scenarios.
- Focus on the main theme of the period, strength, vulnerability, relationships, money/goals, and direct guidance.
- Show how this period may affect choices, closeness, work rhythm, confidence, or pressure points when relevant.
- Be personal, emotionally precise, serious, modern, and useful.
- No mystical fluff, no vague filler, no decorative astrology language.
- Write like a calm, intelligent personal guide, not a therapist and not a fortune-teller.

Return strict JSON with these fields:
- headline: one strong current-period line, max 90 chars
- summary: 2-3 sentences on the period tone
- activeTheme: what is being activated most strongly now
- strength: where the user's current power is
- vulnerability: where current pressure or sensitivity is
- relationships: 2-3 sentences on how this period changes closeness, trust, or contact
- money: 2-3 sentences on how this period affects money, work, goals, or practical direction
- guidance: 3-4 sentences of direct orientation for the user

Return only JSON.`;
};

export const createPlanetInsightPrompt = (
  natalData: NatalChartData,
  profile: UserProfile,
  options: {
    planetLabel: string;
    planetSign: string;
    planetDegree: number | null;
    house: number | null;
    anchorSummary: string;
  }
): string => {
  const natalDataJson = JSON.stringify(
    {
      sun: natalData.sun,
      moon: natalData.moon,
      rising: natalData.rising,
      target: {
        planet: options.planetLabel,
        sign: options.planetSign,
        degree: options.planetDegree,
        house: options.house,
      },
    },
    null,
    2
  );
  const displayName = profile.name || 'the user';

  return `User: ${displayName}
Language: ${profile.language}

Core chart anchors:
${natalDataJson}

Reference summary:
${options.anchorSummary}

Task: write a short personal natal insight for one placement in Lumia's dashboard insight panel.

Rules:
- You are an astrologer-psychologist writing for a real person.
- Explain what ${options.planetLabel} in ${options.planetSign}${options.house ? ` in house ${options.house}` : ''} means in this person's life.
- Use warm, modern second-person language: you / your.
- Keep it personal and concrete, with recognizable emotional or daily-life texture.
- No mystical fluff, no fear language, no long astrology lectures.
- No bullet lists.
- The result should feel clear and intimate inside a compact mobile panel.
- Keep the body to 2-3 sentences.

Return strict JSON with:
- title: a short title for this placement, max 70 chars
- body: 2-3 sentences, compact but meaningful

Return only JSON.`;
};

export interface SynastryAIResponse {
  compatibilityScore: number;
  emotionalConnection: string;
  intellectualConnection: string;
  challenge: string;
  summary: string;
}

export interface BriefSynastryAIResponse {
  introduction: string;
  harmony: string;
  challenges: string;
  tips: string[];
}

export interface FullSynastryAIResponse {
  generalTheme: string;
  attraction: string;
  difficulties: string;
  recommendations: string[];
  potential: string;
}

export interface ExtendedSynastryAIResponse {
  summary: string;
  connection: string;
  tension: string;
  navigation: string;
  bondContext: string;
  compatibilityScore?: number;
}

/** Content v2: free weekly (короткий слой). */
export interface FreeWeeklyForecastV2AIResponse {
  headline: string;
  summary: string;
  focus: string;
}

/** Content v2: premium weekly (полный слой). */
export interface PremiumWeeklyForecastV2AIResponse {
  headline: string;
  summary: string;
  focus: string;
  theme: string;
  opportunities: string;
  challenges: string;
  relationships: string;
  career: string;
  guidance: string;
  reading: string;
}

export interface FreeMonthlyForecastV2AIResponse {
  headline: string;
  summary: string;
  focus: string;
}

export interface PremiumMonthlyForecastV2AIResponse {
  headline: string;
  summary: string;
  focus: string;
  theme: string;
  opportunities: string;
  challenges: string;
  relationships: string;
  money: string;
  guidance: string;
  reading: string;
}

export const createFreeWeeklyForecastPrompt = (
  natalData: NatalChartData,
  profile: UserProfile,
  periodKey: string,
  periodLabel: string,
  transits?: any
): string => {
  const natalDataJson = JSON.stringify(natalData, null, 2);
  const transitsJson = JSON.stringify(transits || {}, null, 2);
  const displayName = profile.name || 'the user';

  return `Forecast period (ISO week): ${periodKey}
Human-readable range: ${periodLabel}

User: ${displayName}
Language: ${profile.language}

Natal chart:
${natalDataJson}

Current transits (context):
${transitsJson}

Task: Lumia FREE weekly layer — one honest, compact orientation for this calendar week.

Rules:
- Short and useful: this is not the premium deep layer.
- Personal, modern, emotionally precise; no mystical fluff.
- User should feel recognized, not just informed.
- Give one clear emotional pattern for the week and one practical focus that is worth carrying through the week.
- Make it useful now, but do not try to cover every domain or every scenario. Premium goes deeper, gives more examples, and maps more nuance.
- No color/number/lucky day gimmicks. No moon-sign fluff for entertainment.
- Speak to the real person; connect week-scale tone to chart + transits.

Return strict JSON:
- headline: max 90 chars, one strong line for the week
- summary: 1-2 sentences
- focus: one clear practical focus for the week

Return only JSON.`;
};

export const createPremiumWeeklyForecastPrompt = (
  natalData: NatalChartData,
  profile: UserProfile,
  periodKey: string,
  periodLabel: string,
  transits?: any
): string => {
  const natalDataJson = JSON.stringify(natalData, null, 2);
  const transitsJson = JSON.stringify(transits || {}, null, 2);
  const displayName = profile.name || 'the user';

  return `Forecast period (ISO week): ${periodKey}
Human-readable range: ${periodLabel}

User: ${displayName}
Language: ${profile.language}

Natal chart:
${natalDataJson}

Current transits:
${transitsJson}

Task: Lumia PREMIUM weekly layer — full-class forecast for the week (stronger than free, not just longer).

Rules:
- This is a premium weekly consultation, not a teaser expanded for length.
- Combine depth, situational precision, and recognizable life scenarios across the week.
- Be emotionally precise and useful for decisions, relationships, work/money, tension, opportunity, and timing.
- Clearly richer than the free weekly layer; different class of interpretation.
- When relevant, show how the week may unfold in actual behavior, conversations, pressure, or momentum.
- Write with the tone of a calm personal consultation.
- No gimmicks (no color/number games). No vague filler.

Return strict JSON:
- headline: max 90 chars
- summary: 2-3 sentences
- focus: one line
- theme: 2-5 words naming the week
- opportunities: 2-3 sentences
- challenges: 2-3 sentences
- relationships: 2-3 sentences
- career: 2-3 sentences (work, money, direction)
- guidance: 3-4 sentences direct orientation
- reading: 4-6 short paragraphs separated by "\\n\\n"

Return only JSON.`;
};

export const createFreeMonthlyForecastPrompt = (
  natalData: NatalChartData,
  profile: UserProfile,
  periodKey: string,
  periodLabel: string,
  transits?: any
): string => {
  const natalDataJson = JSON.stringify(natalData, null, 2);
  const transitsJson = JSON.stringify(transits || {}, null, 2);
  const displayName = profile.name || 'the user';

  return `Forecast month: ${periodKey} (${periodLabel})

User: ${displayName}
Language: ${profile.language}

Natal chart:
${natalDataJson}

Transits context:
${transitsJson}

Task: Lumia FREE monthly layer — compact month orientation.

Rules:
- Brief but serious; personal; no gimmicks.
- User should feel "yes, this is my month", not just get a decorative summary.
- Give one recognizable monthly tension or emphasis and one practical focus.
- Free layer should already orient the month, but not replace the deeper premium month reading with more nuance, examples, and situational detail.

Return strict JSON:
- headline: max 90 chars
- summary: 1-2 sentences
- focus: one line for the month

Return only JSON.`;
};

export const createPremiumMonthlyForecastPrompt = (
  natalData: NatalChartData,
  profile: UserProfile,
  periodKey: string,
  periodLabel: string,
  transits?: any
): string => {
  const natalDataJson = JSON.stringify(natalData, null, 2);
  const transitsJson = JSON.stringify(transits || {}, null, 2);
  const displayName = profile.name || 'the user';

  return `Forecast month: ${periodKey} (${periodLabel})

User: ${displayName}
Language: ${profile.language}

Natal chart:
${natalDataJson}

Transits:
${transitsJson}

Task: Lumia PREMIUM monthly layer — deep month reading (premium class, not inflated length).

Rules:
- This is a premium monthly consultation: dense, nuanced, and grounded in how the month is actually likely to unfold.
- Combine depth, situational precision, and real-life scenarios across relationships, money/work, energy, and choices.
- Show tradeoffs, emotional undercurrents, and where momentum may build or stall.
- Write with the tone of a calm personal consultation.
- No gimmicks.

Return strict JSON:
- headline: max 90 chars
- summary: 2-3 sentences
- focus: one line
- theme: 2-5 words
- opportunities: 2-3 sentences
- challenges: 2-3 sentences
- relationships: 2-4 sentences
- money: 2-4 sentences
- guidance: 3-4 sentences
- reading: 5-7 short paragraphs separated by "\\n\\n"

Return only JSON.`;
};

