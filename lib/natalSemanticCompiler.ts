import type {
  BirthTimeQuality,
  InterpretationSectionKey,
  NatalAspectData,
  NatalChartData,
  PlanetPosition,
} from '../types';
import { hasAppVoiceViolation } from './appVoice';

export const NATAL_SEMANTIC_VERSION = 'natal-semantics-v1';

export const FREE_NATAL_SECTION_KEYS = [
  'base_portrait',
  'thinking',
  'reactions',
  'love_relationships',
  'work_money',
  'strengths',
  'difficulties',
] as const satisfies readonly InterpretationSectionKey[];

export const PREMIUM_NATAL_SECTION_KEYS = [
  'inner_reactions',
  'communication',
  'relationships_deep',
  'conflicts',
  'work',
  'money',
  'abilities',
  'central_contradictions',
  'important_aspects',
] as const satisfies readonly InterpretationSectionKey[];

export type NatalSemanticTier = 'free' | 'premium';
export type NatalSemanticLanguage = 'ru' | 'en';
export type FreeNatalSectionKey = (typeof FREE_NATAL_SECTION_KEYS)[number];
export type PremiumNatalSectionKey = (typeof PREMIUM_NATAL_SECTION_KEYS)[number];
export type NatalSemanticSectionKey = FreeNatalSectionKey | PremiumNatalSectionKey;

type PlanetKey =
  | 'sun'
  | 'moon'
  | 'mercury'
  | 'venus'
  | 'mars'
  | 'jupiter'
  | 'saturn'
  | 'uranus'
  | 'neptune'
  | 'pluto'
  | 'chiron'
  | 'rising'
  | 'mc';

type SemanticTopic = NatalSemanticSectionKey | 'general';

export type NatalSemanticFact = {
  id: string;
  kind: 'placement' | 'aspect' | 'aggregate';
  score: number;
  topics: SemanticTopic[];
  label: string;
  claim: string;
  planet?: PlanetKey;
  sign?: string;
  house?: number | null;
  aspectType?: NatalAspectData['type'];
  orb?: number | null;
  from?: PlanetKey;
  to?: PlanetKey;
};

export type NatalSemanticSectionPlan = {
  key: NatalSemanticSectionKey;
  title: string;
  purpose: string;
  facts: NatalSemanticFact[];
  evidenceIds: string[];
  blocks: NatalSemanticBlockPlan[];
};

export type NatalSemanticBlockRole = 'conclusion' | 'detail';

export type NatalSemanticBlockPlan = {
  id: string;
  role: NatalSemanticBlockRole;
  semanticFactId: string;
  evidenceId: string;
  exactMeaning: string;
};

export type GeneratedNatalBlockPayload = {
  id?: unknown;
  role?: unknown;
  semantic_fact_id?: unknown;
  evidence_id?: unknown;
  text?: unknown;
};

export type GeneratedNatalSectionPayload = {
  id?: unknown;
  blocks?: unknown;
};

export type GeneratedNatalPayload = {
  sections?: unknown;
};

export type ValidatedNatalBlock = {
  id: string;
  role: NatalSemanticBlockRole;
  semanticFactId: string;
  evidenceId: string;
  text: string;
};

export type ValidatedNatalWriterResult = {
  blocksBySectionId: Map<string, ValidatedNatalBlock[]>;
  errors: string[];
};

export type NatalSemanticCompilation = {
  version: typeof NATAL_SEMANTIC_VERSION;
  tier: NatalSemanticTier;
  language: NatalSemanticLanguage;
  reliability: {
    birthTimeQuality: BirthTimeQuality;
    housesReliable: boolean;
    anglesReliable: boolean;
    note: string;
  };
  facts: NatalSemanticFact[];
  sections: NatalSemanticSectionPlan[];
  rejectedFacts: Array<{ id: string; reason: 'weak_orb' | 'unreliable_birth_time' | 'invalid_fact' }>;
};

const PLANET_KEYS: readonly PlanetKey[] = [
  'sun',
  'moon',
  'mercury',
  'venus',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
  'pluto',
  'chiron',
  'rising',
  'mc',
] as const;

const PLANET_ALIASES: Record<string, PlanetKey> = {
  sun: 'sun',
  'солнце': 'sun',
  moon: 'moon',
  'луна': 'moon',
  mercury: 'mercury',
  'меркурий': 'mercury',
  venus: 'venus',
  'венера': 'venus',
  mars: 'mars',
  'марс': 'mars',
  jupiter: 'jupiter',
  'юпитер': 'jupiter',
  saturn: 'saturn',
  'сатурн': 'saturn',
  uranus: 'uranus',
  'уран': 'uranus',
  neptune: 'neptune',
  'нептун': 'neptune',
  pluto: 'pluto',
  'плутон': 'pluto',
  chiron: 'chiron',
  'хирон': 'chiron',
  rising: 'rising',
  asc: 'rising',
  ascendant: 'rising',
  'асцендент': 'rising',
  mc: 'mc',
  midheaven: 'mc',
};

const PLANET_LABELS: Record<PlanetKey, { ru: string; en: string }> = {
  sun: { ru: 'Солнце', en: 'Sun' },
  moon: { ru: 'Луна', en: 'Moon' },
  mercury: { ru: 'Меркурий', en: 'Mercury' },
  venus: { ru: 'Венера', en: 'Venus' },
  mars: { ru: 'Марс', en: 'Mars' },
  jupiter: { ru: 'Юпитер', en: 'Jupiter' },
  saturn: { ru: 'Сатурн', en: 'Saturn' },
  uranus: { ru: 'Уран', en: 'Uranus' },
  neptune: { ru: 'Нептун', en: 'Neptune' },
  pluto: { ru: 'Плутон', en: 'Pluto' },
  chiron: { ru: 'Хирон', en: 'Chiron' },
  rising: { ru: 'Асцендент', en: 'Ascendant' },
  mc: { ru: 'MC', en: 'MC' },
};

const PLANET_FUNCTIONS: Record<PlanetKey, { ru: string; en: string }> = {
  sun: { ru: 'самоопределение и выбор направления', en: 'identity and choice of direction' },
  moon: { ru: 'автоматические реакции и способ восстанавливаться', en: 'automatic reactions and recovery needs' },
  mercury: { ru: 'мышление, речь и работу с информацией', en: 'thinking, speech, and information handling' },
  venus: { ru: 'симпатии, близость и выбор ценного', en: 'attachment, closeness, and value choices' },
  mars: { ru: 'действие, напор и ответ на конфликт', en: 'action, assertion, and conflict response' },
  jupiter: { ru: 'расширение возможностей и масштаб решений', en: 'growth, opportunity, and scale of judgment' },
  saturn: { ru: 'границы, ответственность и выдержку', en: 'boundaries, responsibility, and endurance' },
  uranus: { ru: 'самостоятельность и реакцию на перемены', en: 'independence and response to change' },
  neptune: { ru: 'воображение и чувствительность к неясности', en: 'imagination and sensitivity to ambiguity' },
  pluto: { ru: 'контроль, давление и глубокую перестройку', en: 'control, pressure, and deep restructuring' },
  chiron: { ru: 'уязвимую тему и способ обходиться с ней', en: 'a sensitive theme and the way it is handled' },
  rising: { ru: 'самоподачу и первое движение', en: 'self-presentation and first response' },
  mc: { ru: 'публичную роль и направление результата', en: 'public role and visible direction' },
};

const PLANET_WEIGHTS: Record<PlanetKey, number> = {
  sun: 25,
  moon: 25,
  rising: 23,
  mc: 22,
  mercury: 21,
  venus: 20,
  mars: 21,
  jupiter: 14,
  saturn: 16,
  uranus: 10,
  neptune: 10,
  pluto: 11,
  chiron: 8,
};

const PLANET_TOPICS: Record<PlanetKey, SemanticTopic[]> = {
  sun: ['general', 'base_portrait', 'work', 'abilities', 'central_contradictions'],
  moon: ['general', 'reactions', 'love_relationships', 'inner_reactions', 'relationships_deep', 'central_contradictions'],
  mercury: ['thinking', 'communication', 'conflicts', 'abilities'],
  venus: ['love_relationships', 'work_money', 'relationships_deep', 'money'],
  mars: ['base_portrait', 'work_money', 'difficulties', 'conflicts', 'work'],
  jupiter: ['strengths', 'work_money', 'work', 'money', 'abilities'],
  saturn: ['work_money', 'difficulties', 'work', 'money', 'central_contradictions'],
  uranus: ['abilities', 'central_contradictions'],
  neptune: ['reactions', 'inner_reactions', 'central_contradictions'],
  pluto: ['difficulties', 'conflicts', 'central_contradictions'],
  chiron: ['difficulties', 'inner_reactions'],
  rising: ['base_portrait', 'communication'],
  mc: ['work_money', 'work', 'abilities'],
};

type SignMeaning = { styleRu: string; riskRu: string; styleEn: string; riskEn: string; ruPrep: string };

const SIGN_MEANINGS: Record<string, SignMeaning> = {
  Aries: { ruPrep: 'Овне', styleRu: 'прямой и быстрый способ включаться', riskRu: 'поторопить решение', styleEn: 'a direct, fast way of engaging', riskEn: 'rushing the decision' },
  Taurus: { ruPrep: 'Тельце', styleRu: 'устойчивый и практичный темп', riskRu: 'слишком долго держаться за привычное', styleEn: 'a steady, practical pace', riskEn: 'holding on to the familiar for too long' },
  Gemini: { ruPrep: 'Близнецах', styleRu: 'гибкость, вопросы и быстрый обмен идеями', riskRu: 'распылиться между вариантами', styleEn: 'flexibility, questions, and rapid exchange of ideas', riskEn: 'scattering attention across options' },
  Cancer: { ruPrep: 'Раке', styleRu: 'чуткость к атмосфере и защиту своего круга', riskRu: 'закрыться вместо прямого ответа', styleEn: 'sensitivity to atmosphere and protection of close ties', riskEn: 'withdrawing instead of answering directly' },
  Leo: { ruPrep: 'Льве', styleRu: 'выразительность и ориентацию на заметный результат', riskRu: 'защищать самолюбие вместо сути', styleEn: 'expressiveness and focus on a visible result', riskEn: 'protecting pride instead of addressing the point' },
  Virgo: { ruPrep: 'Деве', styleRu: 'точность, проверку деталей и улучшение системы', riskRu: 'перепроверять дольше, чем нужно', styleEn: 'precision, detail checking, and system improvement', riskEn: 'checking longer than necessary' },
  Libra: { ruPrep: 'Весах', styleRu: 'сравнение позиций и поиск рабочей договорённости', riskRu: 'откладывать выбор ради идеального баланса', styleEn: 'comparing positions and seeking workable agreement', riskEn: 'delaying a choice in search of perfect balance' },
  Scorpio: { ruPrep: 'Скорпионе', styleRu: 'глубину, собранность и настойчивость', riskRu: 'усилить контроль там, где нужен разговор', styleEn: 'depth, focus, and persistence', riskEn: 'increasing control where a conversation is needed' },
  Sagittarius: { ruPrep: 'Стрельце', styleRu: 'широкий взгляд, прямоту и интерес к новому', riskRu: 'пообещать больше, чем позволяет ситуация', styleEn: 'a broad view, candor, and interest in new ground', riskEn: 'promising more than the situation allows' },
  Capricorn: { ruPrep: 'Козероге', styleRu: 'структуру, дисциплину и длинный горизонт', riskRu: 'сделать правило слишком жёстким', styleEn: 'structure, discipline, and a long horizon', riskEn: 'making the rule too rigid' },
  Aquarius: { ruPrep: 'Водолее', styleRu: 'самостоятельность и нестандартный взгляд на систему', riskRu: 'отстраниться от человеческой стороны вопроса', styleEn: 'independence and an unconventional view of systems', riskEn: 'detaching from the human side of the issue' },
  Pisces: { ruPrep: 'Рыбах', styleRu: 'интуитивное считывание ситуации и гибкость', riskRu: 'оставить границы и условия неясными', styleEn: 'intuitive reading of the situation and flexibility', riskEn: 'leaving boundaries and terms unclear' },
};

const SIGN_ALIASES: Record<string, keyof typeof SIGN_MEANINGS> = {
  aries: 'Aries', 'овен': 'Aries', 'овне': 'Aries',
  taurus: 'Taurus', 'телец': 'Taurus', 'тельце': 'Taurus',
  gemini: 'Gemini', 'близнецы': 'Gemini', 'близнецах': 'Gemini',
  cancer: 'Cancer', 'рак': 'Cancer', 'раке': 'Cancer',
  leo: 'Leo', 'лев': 'Leo', 'льве': 'Leo',
  virgo: 'Virgo', 'дева': 'Virgo', 'деве': 'Virgo',
  libra: 'Libra', 'весы': 'Libra', 'весах': 'Libra',
  scorpio: 'Scorpio', 'скорпион': 'Scorpio', 'скорпионе': 'Scorpio',
  sagittarius: 'Sagittarius', 'стрелец': 'Sagittarius', 'стрельце': 'Sagittarius',
  capricorn: 'Capricorn', 'козерог': 'Capricorn', 'козероге': 'Capricorn',
  aquarius: 'Aquarius', 'водолей': 'Aquarius', 'водолее': 'Aquarius',
  pisces: 'Pisces', 'рыбы': 'Pisces', 'рыбах': 'Pisces',
};

const ASPECT_CONFIG: Record<NatalAspectData['type'], { maxOrb: number; weight: number; ru: string; en: string; tension: boolean }> = {
  conjunction: { maxOrb: 6, weight: 15, ru: 'Соединение', en: 'Conjunction', tension: false },
  opposition: { maxOrb: 6, weight: 14, ru: 'Оппозиция', en: 'Opposition', tension: true },
  square: { maxOrb: 5, weight: 14, ru: 'Квадрат', en: 'Square', tension: true },
  trine: { maxOrb: 5, weight: 11, ru: 'Трин', en: 'Trine', tension: false },
  sextile: { maxOrb: 4, weight: 8, ru: 'Секстиль', en: 'Sextile', tension: false },
};

const ASPECT_DYNAMICS: Record<NatalAspectData['type'], { ru: string; en: string }> = {
  conjunction: { ru: 'две функции включаются вместе и усиливают общий акцент', en: 'the two functions operate together and intensify the same emphasis' },
  opposition: { ru: 'две потребности тянут в разные стороны и требуют явного выбора или договорённости', en: 'two needs pull in different directions and require an explicit choice or agreement' },
  square: { ru: 'между функциями есть трение, поэтому навык формируется через действие и корректировку', en: 'the functions create friction, so the skill develops through action and adjustment' },
  trine: { ru: 'функции легко поддерживают друг друга, хотя этот ресурс можно принимать как должное', en: 'the functions support each other easily, although the resource may be taken for granted' },
  sextile: { ru: 'функции могут поддержать друг друга, когда человек сам использует эту возможность', en: 'the functions can support each other when the opportunity is used deliberately' },
};

const HOUSE_THEMES: Record<number, { ru: string; en: string }> = {
  1: { ru: 'самоподача и личная инициатива', en: 'self-presentation and personal initiative' },
  2: { ru: 'деньги, ресурсы и личные приоритеты', en: 'money, resources, and personal priorities' },
  3: { ru: 'разговоры, информация и обучение', en: 'communication, information, and learning' },
  4: { ru: 'дом, семья и личная база', en: 'home, family, and private foundation' },
  5: { ru: 'самовыражение, интерес и романтическая инициатива', en: 'self-expression, interest, and romantic initiative' },
  6: { ru: 'повседневная работа, обязанности и режим', en: 'daily work, duties, and routine' },
  7: { ru: 'отношения, партнёрство и договорённости', en: 'relationships, partnership, and agreements' },
  8: { ru: 'доверие, общие ресурсы и границы', en: 'trust, shared resources, and boundaries' },
  9: { ru: 'обучение, взгляды и расширение опыта', en: 'learning, worldview, and wider experience' },
  10: { ru: 'работа, публичная роль и результат', en: 'work, public role, and visible results' },
  11: { ru: 'друзья, команды и долгие планы', en: 'friends, teams, and long-term plans' },
  12: { ru: 'уединение, восстановление и скрытая работа', en: 'solitude, recovery, and work behind the scenes' },
};

const SECTION_META: Record<NatalSemanticSectionKey, { ru: [string, string]; en: [string, string] }> = {
  base_portrait: { ru: ['Главный портрет', 'Собрать узнаваемый общий способ действовать без биографических догадок.'], en: ['Core portrait', 'Describe the recognizable overall way of acting without biographical guesses.'] },
  thinking: { ru: ['Мышление', 'Объяснить, как человек обрабатывает информацию, говорит и принимает умственные решения.'], en: ['Thinking', 'Explain how the person handles information, speaks, and makes mental decisions.'] },
  reactions: { ru: ['Реакции', 'Показать автоматическую реакцию на давление, перемены и близкий контакт.'], en: ['Reactions', 'Show the automatic response to pressure, change, and close contact.'] },
  love_relationships: { ru: ['Отношения', 'Дать законченный базовый вывод о сближении, симпатии и договорённостях.'], en: ['Relationships', 'Give a complete base conclusion about closeness, attachment, and agreements.'] },
  work_money: { ru: ['Работа и деньги', 'Показать общий способ работать, брать ответственность и принимать решения о ресурсах без обещаний дохода.'], en: ['Work and money', 'Show the broad approach to work, responsibility, and resource decisions without income promises.'] },
  strengths: { ru: ['Сильные стороны', 'Выделить способности, которые подтверждены несколькими сильными факторами.'], en: ['Strengths', 'Highlight abilities supported by the strongest chart factors.'] },
  difficulties: { ru: ['Сложности', 'Назвать реальные напряжения карты без диагнозов, травм и фатализма.'], en: ['Difficulties', 'Name genuine chart tensions without diagnoses, trauma claims, or fatalism.'] },
  inner_reactions: { ru: ['Внутренние реакции', 'Подробно разобрать эмоциональный автоматизм, восстановление и реакцию под давлением.'], en: ['Inner reactions', 'Examine emotional reflexes, recovery, and pressure response in detail.'] },
  communication: { ru: ['Общение', 'Отдельно разобрать речь, обработку информации, объяснение и слушание.'], en: ['Communication', 'Examine speech, information handling, explaining, and listening as a separate chapter.'] },
  relationships_deep: { ru: ['Отношения подробно', 'Углубить базовый раздел: сближение, ожидания, границы и способ договариваться.'], en: ['Relationships in depth', 'Extend the base section into closeness, expectations, boundaries, and negotiation.'] },
  conflicts: { ru: ['Конфликты', 'Показать реакцию на давление, спор и необходимость отстаивать позицию.'], en: ['Conflict', 'Show the response to pressure, disagreement, and the need to assert a position.'] },
  work: { ru: ['Работа', 'Отдельно разобрать рабочий темп, ответственность, подходящие типы задач и ограничения без выдуманной профессии.'], en: ['Work', 'Examine work pace, responsibility, suitable task types, and limits without inventing a profession.'] },
  money: { ru: ['Деньги', 'Отдельно разобрать стиль решений о ресурсах и риски без финансовых обещаний.'], en: ['Money', 'Examine resource decisions and risks without financial promises.'] },
  abilities: { ru: ['Способности', 'Показать сочетание навыков и подходящих задач, не назначая профессию или судьбу.'], en: ['Abilities', 'Show a combination of skills and suitable tasks without assigning a profession or destiny.'] },
  central_contradictions: { ru: ['Главные противоречия', 'Связать самые сильные разнонаправленные факторы и объяснить, где нужен осознанный выбор.'], en: ['Central contradictions', 'Connect the strongest competing factors and explain where a conscious choice is required.'] },
  important_aspects: { ru: ['Важные аспекты', 'Объяснить только самые точные и значимые связи карты отдельной технически спокойной главой.'], en: ['Important aspects', 'Explain only the most exact and consequential chart connections in a restrained technical chapter.'] },
};

function normalizePlanet(value: string | null | undefined): PlanetKey | null {
  return PLANET_ALIASES[String(value || '').trim().toLowerCase()] || null;
}

function normalizeSign(value: string | null | undefined): keyof typeof SIGN_MEANINGS | null {
  return SIGN_ALIASES[String(value || '').trim().toLowerCase()] || null;
}

function birthTimeQuality(chart: NatalChartData): BirthTimeQuality {
  return chart.birthTimeQuality || chart.chartQuality?.birthTimeQuality || 'unknown';
}

export function getNatalReliability(chart: NatalChartData) {
  const quality = birthTimeQuality(chart);
  const housesReliable = quality === 'exact'
    && chart.chartQuality?.housesReliable !== false
    && chart.chartQuality?.houseBasedPersonalization !== false
    && Array.isArray(chart.houses)
    && chart.houses.length >= 12;
  const anglesReliable = quality === 'exact'
    && chart.chartQuality?.ascendantReliable !== false;
  return { birthTimeQuality: quality, housesReliable, anglesReliable };
}

function numberHouse(position: PlanetPosition | null | undefined): number | null {
  const raw = position?.house;
  const value = typeof raw === 'number' ? raw : Number.parseInt(String(raw || ''), 10);
  return Number.isFinite(value) && value >= 1 && value <= 12 ? value : null;
}

function placementClaim(
  planet: PlanetKey,
  position: PlanetPosition,
  language: NatalSemanticLanguage,
  housesReliable: boolean,
): { label: string; claim: string; sign: string; house: number | null } | null {
  const sign = normalizeSign(position.sign);
  if (!sign) return null;
  const meaning = SIGN_MEANINGS[sign];
  const planetLabel = PLANET_LABELS[planet][language];
  const fn = PLANET_FUNCTIONS[planet][language];
  const house = housesReliable ? numberHouse(position) : null;
  const houseLabel = house ? HOUSE_THEMES[house]?.[language] : null;
  if (language === 'ru') {
    return {
      sign,
      house,
      label: `${planetLabel} в ${meaning.ruPrep}${house ? ` · ${house} дом` : ''}`,
      claim: `${planetLabel} в ${meaning.ruPrep}: в теме «${fn}» чаще заметны ${meaning.styleRu}. Под давлением риск — ${meaning.riskRu}.${houseLabel ? ` При точном времени рождения это особенно относится к сфере «${houseLabel}».` : ''}`,
    };
  }
  return {
    sign,
    house,
    label: `${planetLabel} in ${sign}${house ? ` · house ${house}` : ''}`,
    claim: `${planetLabel} in ${sign}: ${fn} tends to use ${meaning.styleEn}. Under pressure, the risk is ${meaning.riskEn}.${houseLabel ? ` With an exact birth time, this is especially relevant to ${houseLabel}.` : ''}`,
  };
}

function placementFact(
  chart: NatalChartData,
  planet: PlanetKey,
  language: NatalSemanticLanguage,
  housesReliable: boolean,
  anglesReliable: boolean,
): NatalSemanticFact | null {
  if (planet === 'rising' && !anglesReliable) return null;
  if (planet === 'mc' && !housesReliable) return null;
  const position = planet === 'mc'
    ? (() => {
        const tenth = chart.houses?.find((house) => house.house === 10);
        return tenth ? {
          planet: 'MC',
          sign: tenth.sign,
          degree: tenth.degree,
          longitude: tenth.longitude,
          house: 10,
          description: '',
        } satisfies PlanetPosition : null;
      })()
    : (chart as unknown as Record<string, PlanetPosition | null | undefined>)[planet];
  if (!position) return null;
  const rendered = placementClaim(planet, position, language, housesReliable);
  if (!rendered) return null;
  return {
    id: `natal:placement:${planet}:${rendered.sign.toLowerCase()}${rendered.house ? `:h${rendered.house}` : ''}`,
    kind: 'placement',
    score: PLANET_WEIGHTS[planet] + (rendered.house ? 2 : 0),
    topics: PLANET_TOPICS[planet],
    label: rendered.label,
    claim: rendered.claim,
    planet,
    sign: rendered.sign,
    house: rendered.house,
  };
}

function aspectTopics(from: PlanetKey, to: PlanetKey): SemanticTopic[] {
  const topics = new Set<SemanticTopic>(['important_aspects']);
  const pair = new Set([from, to]);
  for (const planet of pair) {
    for (const topic of PLANET_TOPICS[planet]) topics.add(topic);
  }
  if (pair.has('sun') && pair.has('moon')) {
    topics.add('base_portrait');
    topics.add('reactions');
    topics.add('central_contradictions');
  }
  if (pair.has('mercury') && pair.has('mars')) {
    topics.add('thinking');
    topics.add('communication');
    topics.add('conflicts');
  }
  if (pair.has('venus') && pair.has('mars')) {
    topics.add('love_relationships');
    topics.add('relationships_deep');
    topics.add('conflicts');
  }
  if (pair.has('moon') && pair.has('venus')) {
    topics.add('inner_reactions');
    topics.add('relationships_deep');
  }
  if (pair.has('saturn')) {
    topics.add('work');
    topics.add('difficulties');
    topics.add('central_contradictions');
  }
  return [...topics];
}

function aspectFact(
  aspect: NatalAspectData,
  index: number,
  language: NatalSemanticLanguage,
  anglesReliable: boolean,
  housesReliable: boolean,
): { fact?: NatalSemanticFact; rejected?: NatalSemanticCompilation['rejectedFacts'][number] } {
  const from = normalizePlanet(aspect.from);
  const to = normalizePlanet(aspect.to);
  const idBase = `natal:aspect:${String(aspect.from || 'unknown').toLowerCase()}:${aspect.type}:${String(aspect.to || 'unknown').toLowerCase()}:${index}`;
  if (!from || !to || !ASPECT_CONFIG[aspect.type] || !Number.isFinite(aspect.orb)) {
    return { rejected: { id: idBase, reason: 'invalid_fact' } };
  }
  if (
    (!anglesReliable && (from === 'rising' || to === 'rising'))
    || (!housesReliable && (from === 'mc' || to === 'mc'))
  ) {
    return { rejected: { id: idBase, reason: 'unreliable_birth_time' } };
  }
  const orb = Math.abs(Number(aspect.orb));
  const config = ASPECT_CONFIG[aspect.type];
  if (orb > config.maxOrb) {
    return { rejected: { id: idBase, reason: 'weak_orb' } };
  }
  const precision = Math.round(40 * (1 - orb / config.maxOrb));
  const pointImportance = Math.round((PLANET_WEIGHTS[from] + PLANET_WEIGHTS[to]) / 2);
  const score = precision + pointImportance + config.weight;
  const fromLabel = PLANET_LABELS[from][language];
  const toLabel = PLANET_LABELS[to][language];
  const dynamic = ASPECT_DYNAMICS[aspect.type][language];
  const claim = language === 'ru'
    ? `${config.ru} ${fromLabel} и ${toLabel} связывает ${PLANET_FUNCTIONS[from].ru} с темой «${PLANET_FUNCTIONS[to].ru}»: ${dynamic}.`
    : `${config.en} between ${fromLabel} and ${toLabel} connects ${PLANET_FUNCTIONS[from].en} with ${PLANET_FUNCTIONS[to].en}: ${dynamic}.`;
  return {
    fact: {
      id: `natal:aspect:${from}:${aspect.type}:${to}`,
      kind: 'aspect',
      score,
      topics: aspectTopics(from, to),
      label: `${fromLabel} · ${config[language]} · ${toLabel} · ${orb.toFixed(1)}°`,
      claim,
      aspectType: aspect.type,
      orb,
      from,
      to,
    },
  };
}

function withConfirmationScores(facts: NatalSemanticFact[]): NatalSemanticFact[] {
  const topicCounts = new Map<SemanticTopic, number>();
  for (const fact of facts) {
    for (const topic of fact.topics) topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
  }
  return facts.map((fact) => {
    const confirmation = Math.max(
      0,
      ...fact.topics.map((topic) => Math.min(10, Math.max(0, (topicCounts.get(topic) || 1) - 1) * 2)),
    );
    return { ...fact, score: fact.score + confirmation };
  });
}

function prefersFact(key: NatalSemanticSectionKey, fact: NatalSemanticFact): number {
  if (key === 'important_aspects') return fact.kind === 'aspect' ? 30 : -30;
  if (key === 'central_contradictions' || key === 'difficulties' || key === 'conflicts') {
    return fact.kind === 'aspect' && (fact.aspectType === 'square' || fact.aspectType === 'opposition') ? 18 : 0;
  }
  if (key === 'strengths' || key === 'abilities') {
    return fact.kind === 'aspect' && (fact.aspectType === 'trine' || fact.aspectType === 'sextile') ? 14 : 0;
  }
  return 0;
}

function neutralFactForSection(
  key: NatalSemanticSectionKey,
  language: NatalSemanticLanguage,
): NatalSemanticFact {
  const title = SECTION_META[key][language][0];
  return {
    id: `natal:aggregate:${key}:no-strong-indicator`,
    kind: 'aggregate',
    score: 0,
    topics: [key],
    label: language === 'ru' ? `${title}: нет отдельного сильного показателя` : `${title}: no separate strong indicator`,
    claim: language === 'ru'
      ? `Для темы «${title}» не выбран отдельный достаточно сильный показатель. Здесь нельзя усиливать вывод за счёт слабых или чужих по смыслу факторов.`
      : `No separate sufficiently strong indicator was selected for “${title}”. Weak or unrelated factors must not be inflated into a conclusion here.`,
  };
}

function sectionPlan(
  key: NatalSemanticSectionKey,
  language: NatalSemanticLanguage,
  facts: NatalSemanticFact[],
  usage: Map<string, number>,
): NatalSemanticSectionPlan {
  const limit = key === 'important_aspects' ? 4 : 2;
  const candidates = facts
    .filter((fact) => key === 'important_aspects'
      ? fact.kind === 'aspect' && fact.topics.includes(key)
      : fact.topics.includes(key) || (key === 'base_portrait' && fact.topics.includes('general')))
    .sort((a, b) => (
      b.score + prefersFact(key, b)
    ) - (
      a.score + prefersFact(key, a)
    ));
  const eligible = key === 'important_aspects'
    ? candidates
    : candidates.filter((fact) => !usage.has(fact.id));
  const selected = (eligible.length ? eligible : [neutralFactForSection(key, language)]).slice(0, limit);
  for (const fact of selected) usage.set(fact.id, (usage.get(fact.id) || 0) + 1);
  const meta = SECTION_META[key][language];
  const blocks: NatalSemanticBlockPlan[] = selected.map((fact, index) => ({
    id: `${key}:${index === 0 ? 'conclusion' : 'detail'}:${index + 1}`,
    role: index === 0 ? 'conclusion' : 'detail',
    semanticFactId: fact.id,
    evidenceId: fact.id,
    exactMeaning: fact.claim,
  }));
  return {
    key,
    title: meta[0],
    purpose: meta[1],
    facts: selected,
    evidenceIds: selected.map((fact) => fact.id),
    blocks,
  };
}

export function compileNatalSemantics(
  chart: NatalChartData,
  tier: NatalSemanticTier,
  language: NatalSemanticLanguage = 'ru',
): NatalSemanticCompilation {
  const reliability = getNatalReliability(chart);
  const rejectedFacts: NatalSemanticCompilation['rejectedFacts'] = [];
  const placements = PLANET_KEYS
    .map((planet) => placementFact(chart, planet, language, reliability.housesReliable, reliability.anglesReliable))
    .filter((fact): fact is NatalSemanticFact => !!fact);

  if (!reliability.anglesReliable && chart.rising) {
    rejectedFacts.push({ id: 'natal:placement:rising', reason: 'unreliable_birth_time' });
  }
  if (!reliability.housesReliable) {
    rejectedFacts.push({ id: 'natal:placement:mc', reason: 'unreliable_birth_time' });
  }

  const aspects: NatalSemanticFact[] = [];
  for (const [index, aspect] of (chart.aspects || []).entries()) {
    const result = aspectFact(
      aspect,
      index,
      language,
      reliability.anglesReliable,
      reliability.housesReliable,
    );
    if (result.fact) aspects.push(result.fact);
    if (result.rejected) rejectedFacts.push(result.rejected);
  }

  const facts = withConfirmationScores([...placements, ...aspects])
    .sort((a, b) => b.score - a.score);
  const keys = tier === 'free' ? FREE_NATAL_SECTION_KEYS : PREMIUM_NATAL_SECTION_KEYS;
  const usage = new Map<string, number>();
  const sections = keys.map((key) => sectionPlan(key, language, facts, usage));

  return {
    version: NATAL_SEMANTIC_VERSION,
    tier,
    language,
    reliability: {
      ...reliability,
      note: language === 'ru'
        ? reliability.housesReliable && reliability.anglesReliable
          ? 'Время рождения точное: дома, Асцендент и MC можно использовать как контекст.'
          : reliability.anglesReliable
            ? 'Асцендент доступен, но дома и MC исключены как недостаточно надёжные.'
            : reliability.housesReliable
              ? 'Дома и MC доступны, но Асцендент исключён как недостаточно надёжный.'
              : 'Время рождения недостаточно точное: дома, Асцендент и MC исключены.'
        : reliability.housesReliable && reliability.anglesReliable
          ? 'Birth time is exact: houses, Ascendant, and MC may be used as context.'
          : reliability.anglesReliable
            ? 'Ascendant is available, but houses and MC are excluded as unreliable.'
            : reliability.housesReliable
              ? 'Houses and MC are available, but Ascendant is excluded as unreliable.'
              : 'Birth time is not exact enough: houses, Ascendant, and MC are excluded.',
    },
    facts,
    sections,
    rejectedFacts,
  };
}

export function natalPromptPayload(compilation: NatalSemanticCompilation) {
  return {
    semanticVersion: compilation.version,
    tier: compilation.tier,
    language: compilation.language,
    reliability: compilation.reliability,
    sections: compilation.sections.map((section) => ({
      key: section.key,
      title: section.title,
      purpose: section.purpose,
      evidenceIds: section.evidenceIds,
      confirmedClaims: section.facts.map((fact) => ({
        evidenceId: fact.id,
        score: fact.score,
        basis: fact.label,
        meaning: fact.claim,
      })),
      requiredBlocks: section.blocks.map((block) => ({
        id: block.id,
        role: block.role,
        semanticFactId: block.semanticFactId,
        evidenceId: block.evidenceId,
        exactMeaningToRephrase: block.exactMeaning,
      })),
    })),
  };
}

const INVENTED_BIOGRAPHY_PATTERNS = [
  /(?:травм\w*|в детстве|твоя мать|твой отец|твои родители|диагноз\w*|заболеван\w*|ты работаешь (?:как|в)|твоя профессия|тебя уволили|ты переехал\w*|ты пережил\w*)/iu,
  /\b(?:trauma|in childhood|your mother|your father|your parents|diagnos(?:is|ed)|disease|you work as|your profession|you were fired|you moved|you went through)\b/iu,
];

const UNRELIABLE_HOUSE_PATTERNS = [
  /(?:\bMC\b|\bIC\b|\d{1,2}[- ]?(?:й|ый|ой)?\s+дом(?:е|а|ом)?)/iu,
  /\b(?:midheaven|house\s+\d{1,2})\b/iu,
];

const UNRELIABLE_ASCENDANT_PATTERNS = [
  /(?:асцендент|десцендент)/iu,
  /\b(?:ascendant|descendant|rising\s+sign)\b/iu,
];

const GENERATED_COPY_FORBIDDEN_PATTERNS = [
  /(?:гарантированно|неизбежно|обязательно\s+произойд[её]т|точно\s+случится)/iu,
  /\b(?:guaranteed|inevitable|will\s+definitely\s+happen)\b/iu,
  /[#*_`]/u,
];

const COPY_STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'can', 'for', 'from',
  'in', 'is', 'it', 'may', 'not', 'of', 'on', 'or', 'that', 'the', 'this', 'to',
  'under', 'with', 'you', 'your', 'tends', 'theme', 'pressure',
  'а', 'без', 'быть', 'в', 'для', 'до', 'и', 'или', 'из', 'к', 'как', 'между',
  'на', 'не', 'но', 'о', 'от', 'по', 'под', 'при', 'с', 'со', 'тема', 'чаще',
  'это', 'этот', 'эта', 'ты', 'твой', 'твоя', 'твои', 'может', 'риск', 'давлением',
  'sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus',
  'neptune', 'pluto', 'chiron', 'ascendant', 'mc', 'солнце', 'луна', 'меркурий',
  'венера', 'марс', 'юпитер', 'сатурн', 'уран', 'нептун', 'плутон', 'хирон',
  'асцендент', 'овен', 'телец', 'близнецы', 'рак', 'лев', 'дева', 'весы',
  'скорпион', 'стрелец', 'козерог', 'водолей', 'рыбы',
]);

type NatalReliabilityGate = Pick<
  NatalSemanticCompilation['reliability'],
  'housesReliable' | 'anglesReliable'
>;

export function hasUnsupportedNatalClaim(text: unknown, reliability: NatalReliabilityGate): boolean {
  const value = String(text || '');
  if (INVENTED_BIOGRAPHY_PATTERNS.some((pattern) => pattern.test(value))) return true;
  if (!reliability.housesReliable && UNRELIABLE_HOUSE_PATTERNS.some((pattern) => pattern.test(value))) return true;
  return !reliability.anglesReliable && UNRELIABLE_ASCENDANT_PATTERNS.some((pattern) => pattern.test(value));
}

function tokenStem(token: string): string {
  let value = token.toLocaleLowerCase();
  if (/^[a-z]+$/u.test(value) && value.length > 4) {
    value = value.replace(/(?:ingly|edly|ing|ed|es|s)$/u, '').replace(/(?:tion|ment)$/u, '');
  }
  return value.length <= 5 ? value : value.slice(0, 6);
}

function contentStems(value: string): Set<string> {
  const tokens = value.toLocaleLowerCase().match(/\p{L}+/gu) || [];
  return new Set(tokens
    .filter((token) => token.length >= 3 && !COPY_STOP_WORDS.has(token))
    .map(tokenStem)
    .filter((token) => token.length >= 3));
}

function copyMeaningIsGrounded(text: string, exactMeaning: string): boolean {
  const approved = contentStems(exactMeaning);
  const candidate = contentStems(text);
  if (!approved.size || !candidate.size) return false;
  const overlap = [...candidate].filter((token) => approved.has(token)).length;
  return overlap >= 2 && overlap / candidate.size >= 0.45;
}

function generatedNatalTextValid(text: string, reliability: NatalReliabilityGate): boolean {
  const trimmed = text.trim();
  return trimmed.length >= 25
    && trimmed.length <= 520
    && !hasAppVoiceViolation(trimmed)
    && !hasUnsupportedNatalClaim(trimmed, reliability)
    && GENERATED_COPY_FORBIDDEN_PATTERNS.every((pattern) => !pattern.test(trimmed));
}

export function validateGeneratedNatalPayload(input: {
  raw: GeneratedNatalPayload;
  plans: NatalSemanticSectionPlan[];
  reliability: NatalReliabilityGate;
}): ValidatedNatalWriterResult {
  const errors: string[] = [];
  const rawSections = Array.isArray(input.raw?.sections)
    ? input.raw.sections as GeneratedNatalSectionPayload[]
    : [];
  if (rawSections.length !== input.plans.length) {
    errors.push(`expected ${input.plans.length} sections, received ${rawSections.length}`);
  }
  const blocksBySectionId = new Map<string, ValidatedNatalBlock[]>();
  const seenSections = new Set<string>();
  for (let sectionIndex = 0; sectionIndex < input.plans.length; sectionIndex += 1) {
    const plan = input.plans[sectionIndex];
    const rawSection = rawSections[sectionIndex];
    if (rawSection?.id !== plan.key || seenSections.has(plan.key)) {
      errors.push(`${plan.key}: changed, missing, or duplicate section identity`);
      continue;
    }
    seenSections.add(plan.key);
    const rawBlocks = Array.isArray(rawSection.blocks)
      ? rawSection.blocks as GeneratedNatalBlockPayload[]
      : [];
    if (rawBlocks.length !== plan.blocks.length) {
      errors.push(`${plan.key}: expected ${plan.blocks.length} blocks, received ${rawBlocks.length}`);
      continue;
    }
    const validated: ValidatedNatalBlock[] = [];
    for (let blockIndex = 0; blockIndex < plan.blocks.length; blockIndex += 1) {
      const expected = plan.blocks[blockIndex];
      const rawBlock = rawBlocks[blockIndex];
      const text = typeof rawBlock?.text === 'string' ? rawBlock.text.trim() : '';
      if (
        rawBlock?.id !== expected.id
        || rawBlock?.role !== expected.role
        || rawBlock?.semantic_fact_id !== expected.semanticFactId
        || rawBlock?.evidence_id !== expected.evidenceId
      ) {
        errors.push(`${plan.key}: block ${blockIndex + 1} changed its semantic identity`);
        continue;
      }
      if (!generatedNatalTextValid(text, input.reliability)) {
        errors.push(`${plan.key}: block ${expected.id} failed independent copy validation`);
        continue;
      }
      if (!copyMeaningIsGrounded(text, expected.exactMeaning)) {
        errors.push(`${plan.key}: block ${expected.id} is not grounded in its approved meaning`);
        continue;
      }
      validated.push({
        id: expected.id,
        role: expected.role,
        semanticFactId: expected.semanticFactId,
        evidenceId: expected.evidenceId,
        text,
      });
    }
    if (validated.length === plan.blocks.length) blocksBySectionId.set(plan.key, validated);
  }
  return { blocksBySectionId, errors };
}

export function deterministicNatalBlocks(plan: NatalSemanticSectionPlan): ValidatedNatalBlock[] {
  return plan.blocks.map((block) => ({
    id: block.id,
    role: block.role,
    semanticFactId: block.semanticFactId,
    evidenceId: block.evidenceId,
    text: block.exactMeaning,
  }));
}

export function buildNatalSectionFallbackContent(section: NatalSemanticSectionPlan): string {
  return deterministicNatalBlocks(section).map((block) => block.text).join('\n\n');
}
