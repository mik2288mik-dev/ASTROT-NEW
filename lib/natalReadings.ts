import type {
  NatalAnchorReading,
  NatalDictionaryTerm,
  NatalLivingReading,
  NatalReadingPoint,
} from '../types';

export const NATAL_ANCHOR_PROMPT_VERSION = 'natal_anchor.human_air.v2';
export const NATAL_LIVING_PROMPT_VERSION = 'natal_living.human_air.v2';

export const NATAL_ANCHOR_CACHE_KEY = 'human-air-v2';

export function buildNatalLivingCacheKey(periodKey: string) {
  return `${periodKey}:human-air-v2`;
}

function cleanLine(value: unknown, fallback: string) {
  const normalized = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized || fallback;
}

function cleanParagraphs(value: unknown, fallback: string) {
  const normalized = String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return normalized || fallback;
}

function splitParagraphs(value: unknown) {
  return String(value || '')
    .split(/\n\s*\n/)
    .map((item) => item.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function cleanList(value: unknown, fallbacks: string[]) {
  const items = Array.isArray(value)
    ? value.map((item) => cleanLine(item, '')).filter(Boolean).slice(0, 3)
    : [];

  return items.length === 3 ? items : fallbacks;
}

function cleanPoints(value: unknown, fallbacks: NatalReadingPoint[]) {
  const items = Array.isArray(value)
    ? value
        .map((item) => {
          if (typeof item === 'string') {
            return { title: cleanLine(item, ''), body: '' };
          }
          const raw = (item && typeof item === 'object' ? item : {}) as Partial<NatalReadingPoint>;
          return {
            title: cleanLine(raw.title, ''),
            body: cleanLine(raw.body, ''),
          };
        })
        .filter((item) => item.title || item.body)
        .slice(0, fallbacks.length)
    : [];

  return items.length >= Math.min(3, fallbacks.length) ? items : fallbacks;
}

function cleanDictionary(value: unknown, fallbacks: NatalDictionaryTerm[]) {
  const items = Array.isArray(value)
    ? value
        .map((item) => {
          const raw = (item && typeof item === 'object' ? item : {}) as Partial<NatalDictionaryTerm>;
          return {
            term: cleanLine(raw.term, ''),
            meaning: cleanLine(raw.meaning, ''),
          };
        })
        .filter((item) => item.term && item.meaning)
        .slice(0, 10)
    : [];

  return items.length >= 4 ? items : fallbacks;
}

export function getCurrentNatalPeriodKey() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
}

export function buildNatalAnchorFallback(lang: 'ru' | 'en'): NatalAnchorReading {
  return lang === 'ru'
    ? {
        headline: 'Твой внутренний ритм',
        summary:
          'В карте видно человека, которому важно не просто двигаться по событиям, а понимать, зачем он в них входит и что они меняют внутри.',
        reading:
          'Ты тонко чувствуешь людей и быстро улавливаешь настроение пространства. Иногда это помогает тебе увидеть правду раньше других, а иногда перегружает, если вокруг слишком много чужих ожиданий.\n\nТебе важно, чтобы в жизни был смысл. Когда дело, разговор или связь становятся пустыми, энергия уходит быстрее, чем ты успеваешь себе объяснить почему.\n\nВнутри есть мягкость, но это не слабость. Скорее способность долго держать контакт с тем, что чувствуешь, и не терять человечность даже в сложных моментах.\n\nТвоя сила раскрывается там, где можно быть честным с собой без спешки. Когда ты перестаёшь подстраиваться под внешний шум, решения становятся спокойнее и точнее.\n\nЛюди могут видеть в тебе сдержанность, но за ней часто стоит не холодность, а осторожность: ты не сразу открываешь то, что для тебя действительно важно.',
        threeAnchors: [
          {
            title: 'Солнце',
            body: 'Показывает твой характер и то, через что ты чувствуешь себя живым.',
          },
          {
            title: 'Луна',
            body: 'Показывает эмоциональный ритм: что успокаивает, ранит и возвращает к себе.',
          },
          {
            title: 'Асцендент',
            body: 'Показывает первое впечатление и способ, которым ты входишь в новые ситуации.',
          },
        ],
        perceivedByOthers:
          'Со стороны ты можешь казаться спокойнее, чем чувствуешь себя внутри. Люди могут тянуться к твоей глубине, но не всегда сразу понимают, сколько всего ты замечаешь и проживаешь молча.',
        strengths: [
          'Ты чувствуешь людей и ситуации глубже, чем это видно со стороны.',
          'У тебя есть внутренняя опора, которая помогает собираться в важный момент.',
          'Ты лучше раскрываешься там, где есть смысл, а не просто суета.',
        ],
        patterns: [
          'Тебе трудно долго оставаться в поверхностных сценариях и пустых связях.',
          'Когда внутреннего смысла мало, энергия быстро падает и появляется отстранённость.',
          'Самые сильные решения приходят, когда ты перестаёшь спешить и слышишь себя.',
        ],
        watchouts: [
          'Не всё, что ты чувствуешь, нужно сразу брать на себя.',
          'Не стоит соглашаться только потому, что так спокойнее для других.',
          'Если энергия падает, проверь не лень ли это, а потеря смысла.',
        ],
        dictionaryTerms: [
          { term: 'Солнце', meaning: 'твоя основная энергия, характер и способ проявляться' },
          { term: 'Луна', meaning: 'эмоции, привычные реакции и то, что даёт чувство безопасности' },
          { term: 'Асцендент', meaning: 'первое впечатление и твой способ входить в мир' },
          { term: 'Знак', meaning: 'стиль, через который проявляется планета или часть карты' },
          { term: 'Аспект', meaning: 'связь между двумя частями карты: где они помогают или спорят друг с другом' },
        ],
      }
    : {
        headline: 'Your inner rhythm',
        summary:
          'Your chart points to someone who needs more than movement through events; you need to understand why you enter them and what they change inside.',
        reading:
          'You sense people and atmospheres quickly. Sometimes this helps you see what is real before others do, and sometimes it overloads you when there are too many unspoken expectations around you.\n\nMeaning matters to you. When a task, conversation, or connection becomes empty, your energy can drop before you can explain why.\n\nThere is softness in you, but it is not weakness. It is the ability to stay close to what you feel and remain human even when things are complicated.\n\nYour strength opens where you can be honest with yourself without rushing. When you stop adjusting to outside noise, your choices become calmer and more precise.\n\nPeople may read you as composed, but underneath that is often caution rather than coldness: you do not reveal what matters to you immediately.',
        threeAnchors: [
          { title: 'Sun', body: 'Shows your character and what makes you feel alive.' },
          { title: 'Moon', body: 'Shows your emotional rhythm: what soothes, hurts, and brings you back to yourself.' },
          { title: 'Rising', body: 'Shows first impression and how you enter new situations.' },
        ],
        perceivedByOthers:
          'From the outside, you can look calmer than you feel inside. People may be drawn to your depth without immediately understanding how much you notice and process silently.',
        strengths: [
          'You feel people and situations more deeply than it may seem.',
          'You have an inner steadiness that helps you gather yourself when it matters.',
          'You show your best side where there is meaning instead of empty noise.',
        ],
        patterns: [
          'It is hard for you to stay long in shallow patterns or empty connections.',
          'When meaning is missing, your energy drops and distance grows.',
          'Your strongest decisions come when you stop rushing and actually hear yourself.',
        ],
        watchouts: [
          'Not everything you feel needs to become your responsibility.',
          'Do not agree only because it makes things easier for others.',
          'When energy drops, check whether it is not laziness but loss of meaning.',
        ],
        dictionaryTerms: [
          { term: 'Sun', meaning: 'your core energy, character, and way of expressing yourself' },
          { term: 'Moon', meaning: 'emotions, habitual reactions, and what creates safety' },
          { term: 'Rising', meaning: 'first impression and how you enter the world' },
          { term: 'Sign', meaning: 'the style through which a planet or part of the chart speaks' },
          { term: 'Aspect', meaning: 'a connection between two parts of the chart: where they support or challenge each other' },
        ],
      };
}

export function buildNatalLivingFallback(lang: 'ru' | 'en', periodKey: string): NatalLivingReading {
  return lang === 'ru'
    ? {
        periodKey,
        headline: 'Сегодня для тебя важна внутренняя точность',
        summary:
          'День просит меньше действовать на автомате и чаще сверяться с тем, что для тебя действительно спокойно и честно.',
        activeTheme:
          'На первый план выходит способность не тащить всё сразу. Если внутри много шума, полезно сузить фокус до одного понятного решения.',
        strength:
          'Твоя сила сегодня в спокойной наблюдательности: ты можешь увидеть, где ситуация требует действия, а где достаточно не поддаваться первому импульсу.',
        vulnerability:
          'Слабое место дня — желание быстро закрыть напряжение: согласиться, промолчать или наоборот ответить резче, чем нужно.',
        relationships:
          'В отношениях лучше говорить проще и прямее. Не додумывай за другого человека и не проверяй близость через молчание: сегодня честная фраза работает лучше длинного внутреннего сценария.',
        money:
          'В делах и деньгах день просит собранности. Хорошо идут задачи, где нужно навести порядок, уточнить условия, не распыляться и не принимать решение из тревоги.',
        guidance:
          'Не пытайся прожить день идеально. Достаточно несколько раз остановиться и спросить себя: я сейчас выбираю из ясности или из напряжения? Этот вопрос уже вернёт тебе управление.',
        fullPersonality:
          'В твоей карте заметна способность глубоко считывать людей и долго держать внутреннюю нить смысла. Ты не всегда показываешь, насколько много замечаешь, но именно это помогает тебе принимать решения не только головой, а всем внутренним опытом.',
        today:
          'Сегодня особенно важно не отдавать внимание всему подряд. Чем спокойнее ты выбираешь, на что реагировать, тем точнее складывается день.',
        daySituations: [
          {
            title: 'В разговоре',
            body: 'Может захотеться объяснить больше, чем нужно. Попробуй сказать главное коротко и посмотреть на реакцию.',
          },
          {
            title: 'В делах',
            body: 'Лучше работает не рывок, а аккуратная последовательность: одно завершённое действие даст больше, чем пять начатых.',
          },
          {
            title: 'Внутри себя',
            body: 'Если появится усталость, не спеши обвинять себя. Возможно, тебе просто нужен тише темп и меньше чужого шума.',
          },
        ],
        relationshipsToday:
          'В близости сегодня лучше не играть в угадывание. Если что-то важно, назови это спокойно: без проверки, без давления, без длинной подготовки.',
        workMoneyToday:
          'В работе и деньгах полезно выбирать решения, которые укрепляют позицию, а не просто снимают тревогу на пару часов.',
        evening:
          'Вечером хорошо отпустить мысль, что нужно было сделать больше. Забери из дня один честный вывод и не тащи в ночь чужое напряжение.',
        repeatingScenario:
          'Сейчас может проявляться сценарий, где ты слишком долго терпишь неясность, а потом резко устаёшь от неё. Чем раньше ты называешь важное, тем меньше внутреннего перегруза.',
        questionOfDay: 'Где я сегодня могу выбрать спокойную честность вместо привычного напряжения?',
      }
    : {
        periodKey,
        headline: 'Today asks for inner precision',
        summary:
          'The day asks you to act less on autopilot and check more often with what feels calm and honest for you.',
        activeTheme:
          'Your main theme is not carrying everything at once. If there is too much inner noise, narrow the focus to one clear decision.',
        strength:
          'Your strength today is calm observation: you can see where a situation needs action and where it only needs you not to follow the first impulse.',
        vulnerability:
          'The vulnerable point is trying to close tension too quickly: agreeing, going silent, or answering more sharply than needed.',
        relationships:
          'In relationships, speak more simply and directly. Do not guess for the other person or test closeness through silence; an honest sentence works better today.',
        money:
          'In work and money, the day asks for steadiness. Tasks that require order, clarity, and fewer scattered decisions are favored.',
        guidance:
          'Do not try to live the day perfectly. It is enough to pause a few times and ask: am I choosing from clarity or from pressure?',
        fullPersonality:
          'Your chart shows a person who reads people deeply and keeps a strong inner thread of meaning. You do not always show how much you notice, but this is exactly what helps you decide with more than logic alone.',
        today:
          'Today it matters not to give your attention to everything at once. The calmer you choose what deserves a response, the clearer the day becomes.',
        daySituations: [
          { title: 'In conversation', body: 'You may want to explain more than necessary. Try saying the main thing briefly and watching the response.' },
          { title: 'In work', body: 'A steady sequence works better than a push. One finished action brings more than five half-started ones.' },
          { title: 'Inside yourself', body: 'If fatigue appears, do not rush to blame yourself. You may simply need a quieter tempo and less outside noise.' },
        ],
        relationshipsToday:
          'In closeness, do not play guessing games. If something matters, name it calmly without testing, pressure, or a long inner rehearsal.',
        workMoneyToday:
          'In work and money, choose decisions that strengthen your position instead of only easing anxiety for a few hours.',
        evening:
          'In the evening, release the thought that you should have done more. Take one honest insight from the day and do not carry outside tension into the night.',
        repeatingScenario:
          'A familiar pattern may show up: tolerating uncertainty for too long and then suddenly feeling exhausted by it. The earlier you name what matters, the less overloaded you become.',
        questionOfDay: 'Where can I choose calm honesty today instead of familiar pressure?',
      };
}

export function coerceNatalAnchorReading(content: unknown, lang: 'ru' | 'en'): NatalAnchorReading {
  const fallback = buildNatalAnchorFallback(lang);

  if (typeof content === 'string') {
    const paragraphs = splitParagraphs(content);
    const first = paragraphs[0] || fallback.summary;
    return {
      ...fallback,
      headline: first.length <= 90 ? first : fallback.headline,
      summary: first,
      reading: paragraphs.join('\n\n') || fallback.reading,
    };
  }

  const raw = (content && typeof content === 'object' ? content : {}) as Partial<NatalAnchorReading>;
  const strengths = cleanList(raw.strengths, fallback.strengths);
  const patterns = cleanList(raw.patterns, fallback.patterns);

  return {
    headline: cleanLine(raw.headline, fallback.headline),
    summary: cleanLine(raw.summary, fallback.summary),
    reading: cleanParagraphs(raw.reading, fallback.reading),
    strengths,
    patterns,
    threeAnchors: cleanPoints(raw.threeAnchors, fallback.threeAnchors),
    perceivedByOthers: cleanParagraphs(raw.perceivedByOthers, fallback.perceivedByOthers),
    watchouts: cleanList(raw.watchouts, patterns.length === 3 ? patterns : fallback.watchouts),
    dictionaryTerms: cleanDictionary(raw.dictionaryTerms, fallback.dictionaryTerms),
  };
}

export function coerceNatalLivingReading(
  content: unknown,
  lang: 'ru' | 'en',
  periodKey = getCurrentNatalPeriodKey()
): NatalLivingReading {
  const fallback = buildNatalLivingFallback(lang, periodKey);

  if (content && typeof content === 'object' && 'sections' in (content as Record<string, unknown>)) {
    const sections = ((content as { sections?: Record<string, unknown> }).sections || {}) as Record<string, unknown>;
    return {
      ...fallback,
      activeTheme: cleanLine(sections.personality || sections.karma, fallback.activeTheme),
      strength: cleanLine(sections.career || sections.personality, fallback.strength),
      vulnerability: cleanLine(sections.weakness, fallback.vulnerability),
      relationships: cleanLine(sections.love, fallback.relationships),
      money: cleanLine(sections.career, fallback.money),
      guidance: cleanLine(sections.karma || sections.personality, fallback.guidance),
    };
  }

  const raw = (content && typeof content === 'object' ? content : {}) as Partial<NatalLivingReading>;
  return {
    periodKey: cleanLine(raw.periodKey, periodKey),
    headline: cleanLine(raw.headline, fallback.headline),
    summary: cleanLine(raw.summary, fallback.summary),
    activeTheme: cleanParagraphs(raw.activeTheme, fallback.activeTheme),
    strength: cleanParagraphs(raw.strength, fallback.strength),
    vulnerability: cleanParagraphs(raw.vulnerability, fallback.vulnerability),
    relationships: cleanParagraphs(raw.relationships, fallback.relationships),
    money: cleanParagraphs(raw.money, fallback.money),
    guidance: cleanParagraphs(raw.guidance, fallback.guidance),
    fullPersonality: cleanParagraphs(raw.fullPersonality, fallback.fullPersonality),
    today: cleanParagraphs(raw.today, fallback.today),
    daySituations: cleanPoints(raw.daySituations, fallback.daySituations),
    relationshipsToday: cleanParagraphs(raw.relationshipsToday, fallback.relationshipsToday),
    workMoneyToday: cleanParagraphs(raw.workMoneyToday, fallback.workMoneyToday),
    evening: cleanParagraphs(raw.evening, fallback.evening),
    repeatingScenario: cleanParagraphs(raw.repeatingScenario, fallback.repeatingScenario),
    questionOfDay: cleanLine(raw.questionOfDay, fallback.questionOfDay),
  };
}

export function mapNatalAnchorToLegacyIntro(reading: NatalAnchorReading) {
  return [reading.summary, reading.reading].filter(Boolean).join('\n\n').trim();
}
