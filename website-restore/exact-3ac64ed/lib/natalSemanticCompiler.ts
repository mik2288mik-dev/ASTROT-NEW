import type {
  BirthTimeQuality,
  InterpretationSectionKey,
  NatalAspectData,
  NatalChartData,
  PlanetPosition,
} from '../types';
import { hasAppVoiceViolation } from './appVoice';

export const NATAL_SEMANTIC_VERSION = 'natal-semantics-v2';

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
  kind: 'placement' | 'aspect';
  score: number;
  topics: SemanticTopic[];
  label: string;
  claim: string;
  sectionClaims?: Partial<Record<NatalSemanticSectionKey, string>>;
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
  sun: ['general', 'base_portrait', 'strengths', 'work', 'abilities'],
  moon: ['general', 'reactions', 'love_relationships', 'inner_reactions', 'relationships_deep'],
  mercury: ['thinking', 'communication', 'strengths', 'abilities'],
  venus: ['love_relationships', 'work_money', 'relationships_deep', 'money'],
  mars: ['base_portrait', 'work_money', 'difficulties', 'conflicts', 'work'],
  jupiter: ['strengths', 'work_money', 'work', 'money', 'abilities'],
  saturn: ['work_money', 'difficulties', 'work', 'money'],
  uranus: ['strengths', 'abilities'],
  neptune: ['reactions', 'inner_reactions', 'abilities'],
  pluto: ['strengths', 'difficulties', 'conflicts'],
  chiron: ['difficulties', 'inner_reactions'],
  rising: ['base_portrait', 'communication'],
  mc: ['work_money', 'work', 'abilities'],
};

type SignElement = 'fire' | 'earth' | 'air' | 'water';
type SignModality = 'cardinal' | 'fixed' | 'mutable';
type SignKey = keyof typeof SIGN_STRUCTURE;
type LocalizedMeaning = { ru: string; en: string };

const SIGN_STRUCTURE = {
  Aries: { ruPrep: 'Овне', element: 'fire', modality: 'cardinal' },
  Taurus: { ruPrep: 'Тельце', element: 'earth', modality: 'fixed' },
  Gemini: { ruPrep: 'Близнецах', element: 'air', modality: 'mutable' },
  Cancer: { ruPrep: 'Раке', element: 'water', modality: 'cardinal' },
  Leo: { ruPrep: 'Льве', element: 'fire', modality: 'fixed' },
  Virgo: { ruPrep: 'Деве', element: 'earth', modality: 'mutable' },
  Libra: { ruPrep: 'Весах', element: 'air', modality: 'cardinal' },
  Scorpio: { ruPrep: 'Скорпионе', element: 'water', modality: 'fixed' },
  Sagittarius: { ruPrep: 'Стрельце', element: 'fire', modality: 'mutable' },
  Capricorn: { ruPrep: 'Козероге', element: 'earth', modality: 'cardinal' },
  Aquarius: { ruPrep: 'Водолее', element: 'air', modality: 'fixed' },
  Pisces: { ruPrep: 'Рыбах', element: 'water', modality: 'mutable' },
} as const satisfies Record<string, { ruPrep: string; element: SignElement; modality: SignModality }>;

const PLANET_ELEMENT_MEANINGS: Record<PlanetKey, Record<SignElement, LocalizedMeaning>> = {
  sun: {
    fire: { ru: 'направление выбирается через личную инициативу и видимую цель', en: 'direction is chosen through personal initiative and a visible aim' },
    earth: { ru: 'направление закрепляется через конкретный результат и проверяемую опору', en: 'direction is secured through concrete results and verifiable support' },
    air: { ru: 'направление уточняется через идеи, сравнение позиций и обратную связь', en: 'direction is refined through ideas, comparison, and feedback' },
    water: { ru: 'направление сверяется с внутренней реакцией и значимостью для близкого круга', en: 'direction is checked against inner response and meaning for close ties' },
  },
  moon: {
    fire: { ru: 'эмоциональная реакция быстрее разряжается через действие и прямой отклик', en: 'emotional response discharges faster through action and direct response' },
    earth: { ru: 'спокойствие возвращается через предсказуемый ритм и ощутимую устойчивость', en: 'calm returns through predictable rhythm and tangible stability' },
    air: { ru: 'реакцию легче понять через слова, вопросы и смену точки зрения', en: 'reactions are easier to understand through words, questions, and reframing' },
    water: { ru: 'реакция тонко улавливает атмосферу и требует времени на внутреннюю переработку', en: 'response closely reads the atmosphere and needs time for inner processing' },
  },
  mercury: {
    fire: { ru: 'мысль быстрее превращается в тезис, решение или прямой вопрос', en: 'thought turns quickly into a position, decision, or direct question' },
    earth: { ru: 'информация проверяется по фактам, последовательности и практической применимости', en: 'information is checked against facts, sequence, and practical use' },
    air: { ru: 'мышление работает через связи, аргументы и обмен несколькими версиями', en: 'thinking works through connections, arguments, and exchange among alternatives' },
    water: { ru: 'смысл считывается не только из слов, но и из контекста, пауз и интонации', en: 'meaning is read not only from words but also from context, pauses, and tone' },
  },
  venus: {
    fire: { ru: 'симпатия проявляется через заметный интерес, инициативу и живой отклик', en: 'attachment shows through visible interest, initiative, and lively response' },
    earth: { ru: 'ценность подтверждается надёжностью, поступками и устойчивым присутствием', en: 'value is confirmed through reliability, actions, and steady presence' },
    air: { ru: 'близость строится через разговор, взаимный интерес и понятные договорённости', en: 'closeness grows through conversation, shared interest, and clear agreements' },
    water: { ru: 'сближение зависит от эмоциональной безопасности и тонкого взаимного отклика', en: 'closeness depends on emotional safety and subtle mutual response' },
  },
  mars: {
    fire: { ru: 'действие набирает силу через быстрый старт, конкуренцию и прямую инициативу', en: 'action gains force through a quick start, competition, and direct initiative' },
    earth: { ru: 'усилие направляется в конкретную задачу и держится до измеримого результата', en: 'effort is directed into a concrete task and sustained to a measurable result' },
    air: { ru: 'напор включается через спор, стратегию, переговоры и интеллектуальный вызов', en: 'assertion activates through debate, strategy, negotiation, and intellectual challenge' },
    water: { ru: 'действие зависит от внутреннего импульса, доверия и защищённости границ', en: 'action depends on inner impulse, trust, and protected boundaries' },
  },
  jupiter: {
    fire: { ru: 'возможности расширяются через смелую пробу, обучение действием и широкий замысел', en: 'opportunity expands through bold trials, learning by doing, and broad aims' },
    earth: { ru: 'рост строится через накопление компетенции, ресурсов и устойчивой практики', en: 'growth is built through accumulated skill, resources, and steady practice' },
    air: { ru: 'масштаб появляется через знания, связи и сопоставление разных систем', en: 'scale develops through knowledge, networks, and comparing different systems' },
    water: { ru: 'рост связан с доверием, смыслом и пониманием невысказанных потребностей', en: 'growth is tied to trust, meaning, and understanding unspoken needs' },
  },
  saturn: {
    fire: { ru: 'ответственность требует управлять личной инициативой и доводить импульс до формы', en: 'responsibility means governing initiative and carrying impulse into form' },
    earth: { ru: 'ответственность выражается через правила, сроки и устойчивую систему действий', en: 'responsibility is expressed through rules, deadlines, and a durable system' },
    air: { ru: 'границы устанавливаются через точные условия, аргументы и распределение ролей', en: 'boundaries are set through precise terms, reasoning, and role allocation' },
    water: { ru: 'выдержка формируется через ясные эмоциональные границы и надёжные обязательства', en: 'endurance develops through clear emotional boundaries and dependable commitments' },
  },
  uranus: {
    fire: { ru: 'перемены запускаются резким экспериментом и отказом ждать готового разрешения', en: 'change begins through sudden experiment and refusal to wait for permission' },
    earth: { ru: 'новшество проверяется тем, улучшает ли оно реальную систему и результат', en: 'innovation is tested by whether it improves a real system and result' },
    air: { ru: 'независимость выражается через новые связи, концепции и способы координации', en: 'independence is expressed through new connections, concepts, and coordination' },
    water: { ru: 'перемена начинается, когда привычная эмоциональная схема перестаёт работать', en: 'change begins when a familiar emotional pattern stops working' },
  },
  neptune: {
    fire: { ru: 'воображение питается образом будущего и эмоционально заряженной целью', en: 'imagination is fed by a vision of the future and an emotionally charged aim' },
    earth: { ru: 'неясный образ становится понятнее через форму, ремесло и конкретный процесс', en: 'an unclear image becomes clearer through form, craft, and concrete process' },
    air: { ru: 'воображение работает через язык, символы и множество возможных трактовок', en: 'imagination works through language, symbols, and multiple interpretations' },
    water: { ru: 'чувствительность легко улавливает подтекст, настроение и размытые границы', en: 'sensitivity easily catches subtext, mood, and blurred boundaries' },
  },
  pluto: {
    fire: { ru: 'давление усиливает потребность вернуть влияние через решительное действие', en: 'pressure intensifies the need to regain influence through decisive action' },
    earth: { ru: 'контроль сосредоточен на ресурсах, устойчивости и реальных рычагах системы', en: 'control focuses on resources, stability, and the system’s concrete levers' },
    air: { ru: 'сила проявляется через информацию, аргументацию и управление связями', en: 'power works through information, argument, and control of connections' },
    water: { ru: 'глубокая перестройка затрагивает доверие, привязанность и эмоциональные границы', en: 'deep restructuring affects trust, attachment, and emotional boundaries' },
  },
  chiron: {
    fire: { ru: 'чувствительная тема касается права действовать, пробовать и занимать место', en: 'the sensitive theme concerns the right to act, try, and take up space' },
    earth: { ru: 'чувствительная тема касается полезности, надёжности и права на ошибку в практике', en: 'the sensitive theme concerns usefulness, reliability, and room for practical error' },
    air: { ru: 'чувствительная тема касается права говорить, быть понятым и менять мнение', en: 'the sensitive theme concerns the right to speak, be understood, and revise a view' },
    water: { ru: 'чувствительная тема касается доверия к собственной реакции и личным границам', en: 'the sensitive theme concerns trust in one’s own response and personal boundaries' },
  },
  rising: {
    fire: { ru: 'первое движение заметно через инициативу и готовность обозначить себя', en: 'the first move is visible through initiative and readiness to state a position' },
    earth: { ru: 'первое впечатление строится на собранности, практичности и понятном темпе', en: 'first impression rests on composure, practicality, and a clear pace' },
    air: { ru: 'контакт начинается через наблюдение, вопрос и настройку способа общения', en: 'contact begins through observation, questions, and adjusting communication' },
    water: { ru: 'первый отклик учитывает атмосферу, безопасность и эмоциональную дистанцию', en: 'the first response accounts for atmosphere, safety, and emotional distance' },
  },
  mc: {
    fire: { ru: 'публичный результат требует личной инициативы и заметной ответственности за курс', en: 'visible results require initiative and clear ownership of direction' },
    earth: { ru: 'публичный результат строится на компетенции, системе и измеримом качестве', en: 'visible results rest on competence, systems, and measurable quality' },
    air: { ru: 'публичная роль развивается через знания, коммуникацию и координацию людей', en: 'public role develops through knowledge, communication, and coordination' },
    water: { ru: 'публичная роль связана с пониманием контекста, доверия и скрытых потребностей', en: 'public role is tied to understanding context, trust, and unspoken needs' },
  },
};

const MODALITY_MEANINGS: Record<SignModality, LocalizedMeaning> = {
  cardinal: { ru: 'Функция быстрее проявляется через самостоятельный старт и обозначение курса.', en: 'The function appears fastest through an independent start and a stated direction.' },
  fixed: { ru: 'Функция раскрывается через удержание выбранного курса и накопление устойчивости.', en: 'The function develops through holding a chosen course and building stability.' },
  mutable: { ru: 'Функция раскрывается через корректировку, обучение и смену способа действия.', en: 'The function develops through adjustment, learning, and changing the method.' },
};

const SIGN_ALIASES: Record<string, SignKey> = {
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
  inner_reactions: { ru: ['Внутренние реакции', 'Разобрать скорость реакции, способ обработки сильных впечатлений и условия восстановления.'], en: ['Inner reactions', 'Examine response speed, processing of strong impressions, and recovery conditions.'] },
  communication: { ru: ['Общение', 'Отдельно разобрать речь, обработку информации, объяснение и слушание.'], en: ['Communication', 'Examine speech, information handling, explaining, and listening as a separate chapter.'] },
  relationships_deep: { ru: ['Отношения подробно', 'Углубить базовый раздел: сближение, ожидания, границы и способ договариваться.'], en: ['Relationships in depth', 'Extend the base section into closeness, expectations, boundaries, and negotiation.'] },
  conflicts: { ru: ['Конфликты', 'Показать реакцию на давление, спор и необходимость отстаивать позицию.'], en: ['Conflict', 'Show the response to pressure, disagreement, and the need to assert a position.'] },
  work: { ru: ['Работа', 'Отдельно разобрать рабочий темп, ответственность, подходящие типы задач и ограничения без выдуманной профессии.'], en: ['Work', 'Examine work pace, responsibility, suitable task types, and limits without inventing a profession.'] },
  money: { ru: ['Деньги', 'Отдельно разобрать стиль решений о ресурсах и риски без финансовых обещаний.'], en: ['Money', 'Examine resource decisions and risks without financial promises.'] },
  abilities: { ru: ['Способности', 'Показать сочетание навыков и подходящих задач, не назначая профессию или судьбу.'], en: ['Abilities', 'Show a combination of skills and suitable tasks without assigning a profession or destiny.'] },
  central_contradictions: { ru: ['Главные противоречия', 'Связать самые сильные разнонаправленные факторы и объяснить, где нужен осознанный выбор.'], en: ['Central contradictions', 'Connect the strongest competing factors and explain where a conscious choice is required.'] },
  important_aspects: { ru: ['Важные аспекты', 'Объяснить только самые точные и значимые связи карты отдельной технически спокойной главой.'], en: ['Important aspects', 'Explain only the most exact and consequential chart connections in a restrained technical chapter.'] },
};

const SECTION_LENSES: Record<NatalSemanticSectionKey, LocalizedMeaning> = {
  base_portrait: { ru: 'Общий способ действовать', en: 'Overall way of acting' },
  thinking: { ru: 'Мышление и решения', en: 'Thinking and decisions' },
  reactions: { ru: 'Автоматическая реакция', en: 'Automatic response' },
  love_relationships: { ru: 'Базовый способ сближаться', en: 'Basic way of building closeness' },
  work_money: { ru: 'Работа, ответственность и ресурсы', en: 'Work, responsibility, and resources' },
  strengths: { ru: 'Практическая сильная сторона', en: 'Practical strength' },
  difficulties: { ru: 'Зона, где нужна осознанная корректировка', en: 'Area requiring deliberate adjustment' },
  inner_reactions: { ru: 'Первая реакция и восстановление', en: 'First response and recovery' },
  communication: { ru: 'Речь, объяснение и слушание', en: 'Speech, explanation, and listening' },
  relationships_deep: { ru: 'Ожидания, границы и договорённости в отношениях', en: 'Expectations, boundaries, and agreements in relationships' },
  conflicts: { ru: 'Ответ на спор и давление', en: 'Response to disagreement and pressure' },
  work: { ru: 'Рабочий темп и тип задач', en: 'Work pace and task type' },
  money: { ru: 'Решения о деньгах и ресурсах', en: 'Money and resource decisions' },
  abilities: { ru: 'Способность, полезная в конкретных задачах', en: 'Ability useful in concrete tasks' },
  central_contradictions: { ru: 'Главное внутреннее противоречие', en: 'Central inner contradiction' },
  important_aspects: { ru: 'Связь, которая заметно меняет общий портрет', en: 'Connection that materially changes the overall portrait' },
};

function normalizePlanet(value: string | null | undefined): PlanetKey | null {
  return PLANET_ALIASES[String(value || '').trim().toLowerCase()] || null;
}

function normalizeSign(value: string | null | undefined): SignKey | null {
  return SIGN_ALIASES[String(value || '').trim().toLowerCase()] || null;
}

function sentenceCase(value: string): string {
  if (!value) return value;
  return value[0].toLocaleUpperCase() + value.slice(1);
}

function buildSectionClaims(
  topics: SemanticTopic[],
  coreMeaning: string,
  supportingMeaning: string | null,
  language: NatalSemanticLanguage,
): Partial<Record<NatalSemanticSectionKey, string>> {
  const claims: Partial<Record<NatalSemanticSectionKey, string>> = {};
  for (const topic of topics) {
    if (topic === 'general') continue;
    const lens = SECTION_LENSES[topic][language];
    claims[topic] = `${lens}: ${sentenceCase(coreMeaning)}.${supportingMeaning ? ` ${supportingMeaning}` : ''}`;
  }
  return claims;
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
): {
  label: string;
  claim: string;
  sectionClaims: Partial<Record<NatalSemanticSectionKey, string>>;
  sign: string;
  house: number | null;
} | null {
  const sign = normalizeSign(position.sign);
  if (!sign) return null;
  const structure = SIGN_STRUCTURE[sign];
  const planetLabel = PLANET_LABELS[planet][language];
  const house = housesReliable ? numberHouse(position) : null;
  const houseLabel = house ? HOUSE_THEMES[house]?.[language] : null;
  const coreMeaning = PLANET_ELEMENT_MEANINGS[planet][structure.element][language];
  const modalityMeaning = MODALITY_MEANINGS[structure.modality][language];
  const houseMeaning = houseLabel
    ? language === 'ru'
      ? `При точном времени рождения эта функция особенно заметна в сфере «${houseLabel}».`
      : `With an exact birth time, this function is especially visible in ${houseLabel}.`
    : null;
  const supportingMeaning = [modalityMeaning, houseMeaning].filter(Boolean).join(' ');
  const topics = PLANET_TOPICS[planet];
  if (language === 'ru') {
    return {
      sign,
      house,
      label: `${planetLabel} в ${structure.ruPrep}${house ? ` · ${house} дом` : ''}`,
      claim: `${planetLabel} в ${structure.ruPrep}: ${sentenceCase(coreMeaning)}. ${supportingMeaning}`.trim(),
      sectionClaims: buildSectionClaims(topics, coreMeaning, supportingMeaning, language),
    };
  }
  return {
    sign,
    house,
    label: `${planetLabel} in ${sign}${house ? ` · house ${house}` : ''}`,
    claim: `${planetLabel} in ${sign}: ${sentenceCase(coreMeaning)}. ${supportingMeaning}`.trim(),
    sectionClaims: buildSectionClaims(topics, coreMeaning, supportingMeaning, language),
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
    sectionClaims: rendered.sectionClaims,
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
  const topics = aspectTopics(from, to);
  const semanticMeaning = language === 'ru'
    ? `Связь тем «${PLANET_FUNCTIONS[from].ru}» и «${PLANET_FUNCTIONS[to].ru}» означает, что ${dynamic}`
    : `The link between ${PLANET_FUNCTIONS[from].en} and ${PLANET_FUNCTIONS[to].en} means that ${dynamic}`;
  const claim = language === 'ru'
    ? `${config.ru} ${fromLabel} и ${toLabel}: ${semanticMeaning}.`
    : `${config.en} between ${fromLabel} and ${toLabel}: ${semanticMeaning}.`;
  return {
    fact: {
      id: `natal:aspect:${from}:${aspect.type}:${to}`,
      kind: 'aspect',
      score,
      topics,
      label: `${fromLabel} · ${config[language]} · ${toLabel} · ${orb.toFixed(1)}°`,
      claim,
      sectionClaims: buildSectionClaims(topics, semanticMeaning, null, language),
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

function factIsStrongEnough(fact: NatalSemanticFact): boolean {
  if (fact.kind === 'aspect') return true;
  return !!fact.planet && PLANET_WEIGHTS[fact.planet] >= 14;
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
      : factIsStrongEnough(fact)
        && (fact.topics.includes(key) || (key === 'base_portrait' && fact.topics.includes('general'))))
    .sort((a, b) => (
      b.score + prefersFact(key, b) - ((usage.get(b.id) || 0) * 10)
    ) - (
      a.score + prefersFact(key, a) - ((usage.get(a.id) || 0) * 10)
    ));
  const selected = candidates.slice(0, limit);
  for (const fact of selected) usage.set(fact.id, (usage.get(fact.id) || 0) + 1);
  const meta = SECTION_META[key][language];
  const blocks: NatalSemanticBlockPlan[] = selected.map((fact, index) => ({
    id: `${key}:${index === 0 ? 'conclusion' : 'detail'}:${index + 1}`,
    role: index === 0 ? 'conclusion' : 'detail',
    semanticFactId: fact.id,
    evidenceId: fact.id,
    exactMeaning: fact.sectionClaims?.[key] || fact.claim,
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
  const seenCopyBySemanticFact = new Map<string, Set<string>>();
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
      const copyFingerprint = text.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
      const previousCopies = seenCopyBySemanticFact.get(expected.semanticFactId) || new Set<string>();
      if (previousCopies.has(copyFingerprint)) {
        errors.push(`${plan.key}: block ${expected.id} duplicates copy already used for the same semantic fact`);
        continue;
      }
      previousCopies.add(copyFingerprint);
      seenCopyBySemanticFact.set(expected.semanticFactId, previousCopies);
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
