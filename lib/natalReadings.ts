import type { NatalAnchorReading, NatalLivingReading } from '../types';

function cleanLine(value: unknown, fallback: string) {
  const normalized = String(value || '')
    .replace(/\s+/g, ' ')
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

export function getCurrentNatalPeriodKey() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function buildNatalAnchorFallback(lang: 'ru' | 'en'): NatalAnchorReading {
  return lang === 'ru'
    ? {
        headline: 'В тебе много внутренней глубины и собранной силы',
        summary:
          'Твоя карта показывает человека, которому важно не просто проживать события, а понимать их смысл и чувствовать, что жизнь движется в честном для него направлении.',
        reading:
          'Ты сильнее всего раскрываешься там, где можно быть собой без лишней роли. Обычно у тебя хорошо получается чувствовать, что в людях и ситуациях настоящее, а что держится только на внешней форме.\n\nВнутри тебя есть потребность в устойчивости, но одновременно и в живом внутреннем движении. Поэтому тебе особенно важно, чтобы отношения, работа и цели не были пустыми по смыслу: без этого быстро уходит энергия.\n\nТвоя карта не про поверхностность. Она про человека, который может быть мягким, но при этом внутренне очень собранным. Когда ты доверяешь себе, вокруг тебя тоже становится больше ясности.',
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
      }
    : {
        headline: 'There is a lot of inner depth and steady strength in you',
        summary:
          'Your chart points to a person who does not just live through events, but needs to understand their meaning and feel that life is moving in a direction that is honest for them.',
        reading:
          'You open most fully where you can be yourself without performing a role. You tend to sense what is real in people and situations and what is only held together by appearance.\n\nInside, you need both stability and living inner movement. That is why relationships, work, and goals have to mean something to you; without that, energy fades quickly.\n\nYour chart is not about surface living. It is about someone who can be soft while staying deeply collected. When you trust yourself, more clarity appears around you as well.',
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
      };
}

export function buildNatalLivingFallback(lang: 'ru' | 'en', periodKey: string): NatalLivingReading {
  return lang === 'ru'
    ? {
        periodKey,
        headline: 'Сейчас в тебе активируется тема внутренней ясности',
        summary:
          'Период просит меньше распыления и больше честности с собой. Это время, когда особенно важно не тратить силы на лишний шум.',
        activeTheme: 'На первый план выходит пересборка приоритетов: где ты по-настоящему включён, а где давно живёшь на инерции.',
        strength: 'Сейчас твоя сила в умении вовремя остановиться, увидеть главное и выбрать более точный ритм вместо хаотичной спешки.',
        vulnerability: 'Уязвимость периода — сомнения и эмоциональная перегрузка там, где ты слишком долго пытаешься удержать то, что уже не даёт опоры.',
        relationships: 'В отношениях этот период требует больше честности и меньше автоматических реакций. Лучше говорить прямо, чем делать вид, что всё в порядке.',
        money: 'В деньгах и целях полезнее не разбрасываться. Сейчас выигрывает не скорость, а ясная стратегия и один действительно важный фокус.',
        guidance:
          'Этот период лучше проживать не через давление на себя, а через собранность. Убирай лишнее, не бойся пересобирать приоритеты и держись ближе к тому, что действительно твоё.',
      }
    : {
        periodKey,
        headline: 'A theme of inner clarity is being activated in you now',
        summary:
          'This period asks for less scattering and more honesty with yourself. It is a time when extra noise costs too much energy.',
        activeTheme: 'Your priorities are being reorganized: where you are truly alive and where you have been moving only by inertia.',
        strength: 'Your current strength is the ability to pause, see what matters, and choose a more precise rhythm instead of chaotic speed.',
        vulnerability: 'The main sensitivity now is doubt and emotional overload where you keep holding on to what no longer gives real support.',
        relationships: 'In relationships this period asks for more honesty and fewer automatic reactions. It is better to speak directly than to pretend everything is fine.',
        money: 'For money and goals, the wiser move is not to scatter yourself. Clarity and strategy matter more than speed right now.',
        guidance:
          'Live this period through steadiness rather than pressure. Remove what is extra, do not be afraid to reset priorities, and stay close to what is genuinely yours.',
      };
}

export function coerceNatalAnchorReading(content: unknown, lang: 'ru' | 'en'): NatalAnchorReading {
  const fallback = buildNatalAnchorFallback(lang);

  if (typeof content === 'string') {
    const paragraphs = splitParagraphs(content);
    const first = paragraphs[0] || fallback.summary;
    return {
      headline: first.length <= 90 ? first : fallback.headline,
      summary: first,
      reading: paragraphs.join('\n\n') || fallback.reading,
      strengths: fallback.strengths,
      patterns: fallback.patterns,
    };
  }

  const raw = (content && typeof content === 'object' ? content : {}) as Partial<NatalAnchorReading>;
  return {
    headline: cleanLine(raw.headline, fallback.headline),
    summary: cleanLine(raw.summary, fallback.summary),
    reading: cleanLine(raw.reading, fallback.reading),
    strengths: cleanList(raw.strengths, fallback.strengths),
    patterns: cleanList(raw.patterns, fallback.patterns),
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
      periodKey,
      headline: fallback.headline,
      summary: fallback.summary,
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
    activeTheme: cleanLine(raw.activeTheme, fallback.activeTheme),
    strength: cleanLine(raw.strength, fallback.strength),
    vulnerability: cleanLine(raw.vulnerability, fallback.vulnerability),
    relationships: cleanLine(raw.relationships, fallback.relationships),
    money: cleanLine(raw.money, fallback.money),
    guidance: cleanLine(raw.guidance, fallback.guidance),
  };
}

export function mapNatalAnchorToLegacyIntro(reading: NatalAnchorReading) {
  return [reading.summary, reading.reading].filter(Boolean).join('\n\n').trim();
}
