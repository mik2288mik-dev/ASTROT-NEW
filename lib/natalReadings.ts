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
        headline: 'Сейчас для тебя включается период внутренней перенастройки',
        summary:
          'Этот период просит не просто собранности, а более взрослой честности с собой: что тебя действительно питает, а что ты продолжаешь держать только по привычке, долгу или тревоге. Чем меньше внутреннего шума, тем точнее становится ощущение собственного курса.',
        activeTheme: 'На первый план выходит пересборка приоритетов и внутренней опоры. Сейчас особенно заметно, где ты по-настоящему включён и растёшь, а где продолжаешь жить на инерции, потому что так было проще не менять привычный порядок.',
        strength: 'Твоя сила сейчас в способности остановиться раньше перегруза, увидеть суть и не разменять себя на всё сразу. Это хороший период для более точных решений, зрелой избирательности и возвращения к тому, что действительно усиливает тебя, а не просто держит в движении.',
        vulnerability: 'Уязвимость периода связана с соблазном слишком долго терпеть неясность, внутренне всё тащить на себе и откладывать честный пересмотр того, что уже перестало работать. Из-за этого может расти усталость, раздражение или чувство, будто сил меньше, чем есть на самом деле.',
        relationships: 'В отношениях этот период делает важнее честность, чем привычную вежливую форму. Может сильнее цеплять всё, что связано с недосказанностью, эмоциональной дистанцией или ощущением, что твои реальные потребности остаются за кадром. Чем прямее и спокойнее ты называешь важное, тем меньше шансов уйти в накопленное напряжение.',
        money: 'В деньгах, работе и целях период учит отличать движение от настоящего продвижения. Полезно смотреть, какие решения дают только краткое облегчение, а какие действительно укрепляют твою позицию, ресурс и долгий вектор. Сейчас выигрывает не скорость, а стратегия, в которой меньше лишнего и больше смысла.',
        guidance:
          'Этот период лучше проживать не через давление на себя, а через точную внутреннюю настройку. Убирай лишнее, не бойся пересобирать приоритеты и регулярно возвращайся к вопросу: что из этого действительно моё, а что я просто продолжаю нести по инерции. Чем честнее будет этот ответ, тем спокойнее и сильнее ты пройдёшь этот этап.',
      }
    : {
        periodKey,
        headline: 'A period of inner recalibration is opening for you now',
        summary:
          'This period asks for more than basic steadiness. It asks for a more adult honesty with yourself about what genuinely nourishes you and what you are still carrying out of habit, duty, or anxiety. The less inner noise you drag along, the clearer your direction becomes.',
        activeTheme: 'Your priorities and inner support system are being reorganized. It becomes easier to see where you are truly alive and growing, and where you have been moving by inertia because change felt more disruptive than staying half-committed.',
        strength: 'Your strength now is the ability to stop before overload, recognize what matters, and refuse to spend yourself on everything at once. This is a strong period for precise decisions, mature selectivity, and returning to what genuinely strengthens you instead of merely keeping you in motion.',
        vulnerability: 'The main sensitivity now is the temptation to tolerate too much uncertainty, carry everything internally, and postpone an honest review of what has already stopped working. That can create fatigue, irritation, or the feeling that you have less strength than you actually do.',
        relationships: 'In relationships, this period makes honesty more important than polished form. Anything tied to unspoken tension, emotional distance, or the feeling that your real needs stay offstage may hit harder. The more calmly and directly you name what matters, the less likely it is to turn into stored pressure.',
        money: 'In money, work, and direction, this period teaches the difference between movement and real progress. It helps to notice which decisions bring only short relief and which ones actually strengthen your position, resources, and long-term vector. Speed matters less than strategy with fewer distractions and more meaning.',
        guidance:
          'Live this period through precise inner recalibration rather than pressure. Remove what is extra, do not be afraid to reset priorities, and keep returning to one question: what here is genuinely mine, and what am I only continuing out of inertia? The more honest that answer becomes, the calmer and stronger this phase will feel.',
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
