
export type Language = 'ru' | 'en';
export type Theme = 'dark' | 'light';
export type NotificationFrequency = 'quiet' | 'important' | 'daily' | 'twice_daily';
export interface UserEvolution {
  level: number;
  title: string; // e.g. "Seeker", "Awakened", "Master"
  stats: {
    intuition: number; // 0-100
    confidence: number;
    awareness: number;
  };
  lastUpdated: number;
}

export interface UserContext {
  weather?: string; // e.g. "Rainy", "Sunny"
  weatherData?: {
    condition: string; // e.g. "Rainy", "Sunny"
    temp: number; // Температура в градусах Цельсия
    humidity: number; // Влажность в процентах
    city: string; // Название города
    moonPhase?: {
      phase: string; // Фаза луны
      illumination: number; // Освещенность в процентах
    };
  };
  moonPhase?: {
    phase: string; // Фаза луны
    illumination: number; // Освещенность в процентах
  };
  socialProof?: string; // e.g. "87% of Scorpios..."
  mood?: string; // e.g. "Anxious", "Excited" (detected from chat)
}

export interface UserProfile {
  id?: string; // Telegram ID
  name: string;
  birthDate: string; // YYYY-MM-DD
  birthTime: string; // HH:MM
  birthPlace: string;
  isSetup: boolean;
  language: Language;
  theme: Theme; 
  isPremium: boolean; 
  premiumUntil?: string | null;
  trialStartedAt?: string | null;
  selectedZodiacSign?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  isAdmin?: boolean;
  evolution?: UserEvolution;
  lastContext?: UserContext;
  loginStreak?: number; // Consecutive daily login count
  chartSlots?: number; // Max charts user can have
  /** Personal invite code for Telegram startapp deep links */
  refCode?: string;
  /** User already linked to an inviter (one-time referral) */
  referralApplied?: boolean;
  notificationFrequency?: NotificationFrequency;
  weatherCity?: string; // Город для погоды (например, "Moscow" или "Москва")

  // Все генерации пользователя (кэшируются)
  generatedContent?: UserGeneratedContent;
}

export enum ZodiacSign {
  Aries = "Aries",
  Taurus = "Taurus",
  Gemini = "Gemini",
  Cancer = "Cancer",
  Leo = "Leo",
  Virgo = "Virgo",
  Libra = "Libra",
  Scorpio = "Scorpio",
  Sagittarius = "Sagittarius",
  Capricorn = "Capricorn",
  Aquarius = "Aquarius",
  Pisces = "Pisces"
}

export interface PlanetPosition {
  planet: string;
  sign: string;
  degree?: number;
  longitude?: number;
  house?: string | number;
  retrograde?: boolean;
  speedLongitude?: number;
  description: string;
}

export interface NatalHouseData {
  house: number;
  sign: string;
  degree: number;
  longitude: number;
}

export interface NatalAspectData {
  type: 'conjunction' | 'sextile' | 'square' | 'trine' | 'opposition';
  angle: number;
  orb: number;
  from: string;
  to: string;
}

export type BirthTimeQuality = 'exact' | 'approximate' | 'unknown';

export interface ChartQuality {
  birthTimeQuality: BirthTimeQuality;
  ascendantReliable: boolean;
  housesReliable: boolean;
  houseBasedPersonalization: boolean;
  notes: string[];
}

export interface NatalChartData {
  sun: PlanetPosition;
  moon: PlanetPosition;
  rising: PlanetPosition; 
  mercury: PlanetPosition | null;
  venus: PlanetPosition | null;
  mars: PlanetPosition | null;
  jupiter?: PlanetPosition | null;
  saturn?: PlanetPosition | null;
  uranus?: PlanetPosition | null;
  neptune?: PlanetPosition | null;
  pluto?: PlanetPosition | null;
  chiron?: PlanetPosition | null;
  
  // New Personalization Fields
  element: string; // Fire, Water, Air, Earth
  rulingPlanet: string; // e.g. Mars for Aries
  latitude?: number;
  longitude?: number;
  timezone?: string;
  houses?: NatalHouseData[];
  aspects?: NatalAspectData[];
  calculationVersion?: string;
  birthTimeQuality?: BirthTimeQuality;
  chartQuality?: ChartQuality;
  
  summary: string; 
  keywords?: {
    love: string;
    career: string;
    karma: string;
  }
}

// Полное хранилище всех генераций пользователя
export interface UserGeneratedContent {
  // НОВОЕ: Вступление натальной карты (бесплатное)
  natalIntro?: string;
  
  // Гороскопы (обновляются по расписанию)
  dailyHoroscope?: DailyHoroscope;
  weeklyHoroscope?: WeeklyHoroscope;
  monthlyHoroscope?: MonthlyHoroscope;
  
  // Deep Dive анализы - полные секции натальной карты (премиум)
  deepDiveAnalyses?: {
    personality?: string;    // Личность и характер
    love?: string;          // Любовь и отношения
    career?: string;        // Карьера и самореализация
    weakness?: string;      // Зоны роста и вызовы
    karma?: string;         // Кармическая задача
  };
  
  // История синастрий (кэшируется по партнерам)
  synastries?: {
    [partnerId: string]: {
      partnerName: string;
      partnerDate: string;
      partnerChartId?: number;
      source?: 'saved-chart' | 'manual';
      briefResult?: SynastryResult;
      extendedResult?: SynastryResult;
      fullResult?: SynastryResult;
      timestamp: number;
    };
  };
  
  // Временные метки для обновления
  timestamps: {
    natalIntroGenerated?: number;
    dailyHoroscopeGenerated?: number;
    weeklyHoroscopeGenerated?: number;
    monthlyHoroscopeGenerated?: number;
    deepDiveGenerated?: number;
  };
}

export interface SynastryResult {
  compatibilityScore?: number; // 0-100 (опционально для краткого режима)
  
  // Краткий режим (бесплатный) - тизер
  briefOverview?: {
    introduction: string; // 1 абзац - кто кому как ощущается
    harmony: string; // что гармонично и естественно
    challenges: string; // где могут быть недопонимания
    tips: string[]; // 3-4 подсказки как лучше обходиться друг с другом
  };
  
  // Legacy Lumi shape kept for backward compatibility with older cached results
  extendedOverview?: {
    connection: string;
    tension: string;
    navigation: string;
    bondContext: string;
  };

  // Полный режим (премиум) - глубокий разбор
  fullAnalysis?: {
    generalTheme: string; // Общая тема связи (1-2 абзаца)
    attraction: string; // Что притягивает (2-3 абзаца)
    difficulties: string; // Где могут быть сложности (2-3 абзаца)
    recommendations: string[]; // 3-6 конкретных рекомендаций
    potential: string; // Потенциал отношений (1-3 абзаца)
  };
  
  // Общие поля (для обратной совместимости)
  emotionalConnection?: string;
  intellectualConnection?: string;
  challenge?: string;
  summary: string;
}

export interface DailyHoroscope {
  date: string;
  mood?: string;
  color?: string;
  number?: number;
  content: string;
  /** Up to three practical tips when the model returns them */
  advice?: string[];
  moonImpact?: string; 
  transitFocus?: string; 
  persisted?: boolean;
  source?: 'cache' | 'generated' | 'generated-not-persisted' | 'cache-after-wait';
  code?: 'PRIMARY_CHART_MISSING' | 'GENERATION_IN_PROGRESS' | 'DAILY_CACHE_READ_FAILED' | 'DAILY_PERSIST_FAILED';
  message?: string;
}

export interface ForecastDailyReading {
  date: string;
  headline: string;
  summary: string;
  chance: string;
  risk: string;
  focus: string;
  reading: string;
  context: string;
  advice: string[];
}

export type TodayMetricKey = 'resource' | 'stress' | 'love' | 'focus';

export interface TodayMetricPoint {
  date: string;
  value: number;
}

export interface TodayMetric {
  key: TodayMetricKey;
  label: string;
  value: number;
  description: string;
  history: TodayMetricPoint[];
}

export type TodayPulseLayerKey = 'energy' | 'focus' | 'emotions' | 'money' | 'relationships';
export type TodayPulsePhase = 'restore' | 'entry' | 'focus_peak' | 'decisions' | 'relationships' | 'reflection';
export type TodayPulseTone = 'calm' | 'rise' | 'peak' | 'social' | 'caution' | 'restore';

export interface TodayPulseLayers {
  energy: number;
  focus: number;
  emotions: number;
  money: number;
  relationships: number;
}

export interface TodayPulsePoint {
  time: string;
  hour: number;
  score: number;
  layers: TodayPulseLayers;
  phase: TodayPulsePhase;
  title: string;
  summary: string;
  reasons: string[];
  bestFor: string[];
  avoid: string[];
  tone: TodayPulseTone;
  isKeyMoment: boolean;
}

export interface TodayPulseWindow {
  start: string;
  end: string;
  label: string;
  summary: string;
  score: number;
  dominantLayer: TodayPulseLayerKey;
  tone: TodayPulseTone;
}

export interface TodayPulse {
  date: string;
  timezone: string;
  generatedAt: string;
  source: 'swisseph' | 'algorithmic' | 'mixed';
  currentTime: string;
  currentPoint: TodayPulsePoint;
  peakPoint: TodayPulsePoint;
  layers: TodayPulseLayers;
  points: TodayPulsePoint[];
  windows: TodayPulseWindow[];
  keyMoments: TodayPulsePoint[];
  calculationVersion: string;
}

export type TodayPulseResult =
  | {
      status: 'ready';
      pulse: TodayPulse;
      chartId: number | null;
      source: string;
    }
  | {
      status: 'needs_setup';
      code: 'PROFILE_BIRTH_DATA_REQUIRED';
      message: string;
      actionLabel: string;
    };

export type DailyCheckInFocus = 'low' | 'normal' | 'high';
export type DailyCheckInMood = 'heavy' | 'steady' | 'good';
export type DailyCheckInPeople = 'social' | 'quiet';
export type DailyCheckInForecastFit = 'yes' | 'partial' | 'no';

export interface DailyCheckInInput {
  focus: DailyCheckInFocus;
  mood: DailyCheckInMood;
  people: DailyCheckInPeople;
  forecastFit: DailyCheckInForecastFit;
}

export interface DailyCheckIn extends DailyCheckInInput {
  id: number;
  userId: string;
  chartId: number | null;
  date: string;
  timezone: string;
  pulseTime: string;
  pulsePhase: TodayPulsePhase;
  pulseScore: number;
  pulseLayers: TodayPulseLayers;
  createdAt: string;
  updatedAt: string;
}

export type ActionTimingKey = 'message' | 'money' | 'purchase' | 'serious_talk' | 'work' | 'rest';
export type ActionTimingState = 'now' | 'later' | 'no_edge';

export interface ActionTimingRecommendation {
  actionKey: ActionTimingKey;
  state: ActionTimingState;
  title: string;
  summary: string;
  bestWindow: {
    start: string;
    end: string;
    label: string;
    score: number;
  };
  targetPoint: TodayPulsePoint;
  confidence: number;
  reasons: string[];
  caution: string;
  date: string;
  timezone: string;
  generatedAt: string;
}

export interface TodayAssistantAccuracySummary {
  historyCount: number;
  title: string;
  summary: string;
  bestMatchedLayer: 'focus' | 'mood' | 'people' | 'overall' | 'none';
  forecastFitRate: number;
  progressToInsight: {
    current: number;
    target: number;
  };
}

export interface PersonalPatternInsight {
  id: string;
  kind: 'first_repeat' | 'focus' | 'people' | 'month';
  windowDays: 7 | 14 | 30;
  title: string;
  summary: string;
  evidence: string;
  confidence: number;
}

export interface PersonalPatternTeaser {
  state: 'collecting' | 'ready';
  title: string;
  summary: string;
  progress: {
    current: number;
    target: number;
  };
}

export type TodayAssistantDayMode = 'morning' | 'day' | 'evening';

export type TodayAssistantHomeResult =
  | {
      status: 'ready';
      pulse: TodayPulse;
      chartId: number | null;
      source: string;
      dayMode: TodayAssistantDayMode;
      checkInPulse?: TodayPulse;
      checkInDate?: string;
      checkInDateMode?: 'same_day' | 'previous_day_tail';
      checkIn: {
        status: 'open' | 'completed';
        entry?: DailyCheckIn;
      };
      quickActions: ActionTimingRecommendation[];
      accuracySummary: TodayAssistantAccuracySummary;
      patternTeaser: PersonalPatternTeaser;
      insights: PersonalPatternInsight[];
    }
  | {
      status: 'needs_setup';
      code: 'PROFILE_BIRTH_DATA_REQUIRED';
      message: string;
      actionLabel: string;
    };

export interface DailyCheckInSubmitResult {
  status: 'saved';
  checkIn: DailyCheckIn;
  accuracySummary: TodayAssistantAccuracySummary;
  patternTeaser: PersonalPatternTeaser;
  insights: PersonalPatternInsight[];
}

export type HoroscopeReactionKey = 'spot_on' | 'funny' | 'gentle' | 'not_mine';

export interface HoroscopeReactionCount {
  key: HoroscopeReactionKey;
  label: string;
  count: number;
}

export interface HoroscopeReactionSummary {
  userReaction: HoroscopeReactionKey | null;
  counts: HoroscopeReactionCount[];
  total: number;
}

export interface TodayOverview {
  date: string;
  dateLabel: string;
  sign: string;
  signLabel: string;
  headline: string;
  summary: string;
  phrase: string;
  bestAction: string;
  softRisk: string;
  horoscopeExcerpt: string;
  joke: string;
  comparison: string;
  metrics: TodayMetric[];
  personalForecast: ForecastDailyReading;
  signHoroscope: ForecastDailyReading;
  reactions: HoroscopeReactionSummary;
}

export type TodayOverviewResult =
  | {
      status: 'ready';
      overview: TodayOverview;
      chartId: number | null;
      source: string;
    }
  | {
      status: 'generating';
      code: 'GENERATION_IN_PROGRESS';
      retryAfterMs: number;
      chartId: number | null;
    };

export type HoroscopeLayer = 'sign' | 'chart' | 'love' | 'work_money';
export type HoroscopeOpenMode = 'overview' | 'single';
export type HoroscopeDailySectionKey =
  | 'daily_love'
  | 'daily_work_business'
  | 'daily_money'
  | 'daily_goals';
export type PersonalDailySection = 'overview' | 'love' | 'money' | 'work' | 'goals';
export type HoroscopeOpenOptions = {
  mode?: HoroscopeOpenMode;
  source?: string;
  dailySectionKey?: HoroscopeDailySectionKey;
};

export type ForecastDaypartSlot = 'morning' | 'day' | 'evening';

export interface ForecastDaypartReading {
  date: string;
  slot: ForecastDaypartSlot;
  headline: string;
  summary: string;
  focus: string;
  relationships: string;
  money: string;
  guidance: string;
  risk?: string;
  chartReason?: string;
}

/** Free tier: короткий слой; Premium — дополнительные поля заполнены. */
export interface ForecastWeeklyReading {
  periodKey: string;
  periodLabel: string;
  headline: string;
  summary: string;
  focus: string;
  theme?: string;
  opportunities?: string;
  challenges?: string;
  relationships?: string;
  career?: string;
  guidance?: string;
  reading?: string;
}

/** Free tier: короткий слой; Premium — развёрнутый период. */
export interface ForecastMonthlyReading {
  periodKey: string;
  periodLabel: string;
  headline: string;
  summary: string;
  focus: string;
  theme?: string;
  opportunities?: string;
  challenges?: string;
  relationships?: string;
  money?: string;
  guidance?: string;
  reading?: string;
}

export interface NatalReadingPoint {
  title: string;
  body: string;
  evidenceIds?: string[];
}

export interface NatalDictionaryTerm {
  term: string;
  meaning: string;
}

export interface NatalHumanSection {
  id: string;
  title: string;
  subtitle: string;
  body: string;
  examples: string[];
  astroSource: string;
  evidenceIds: string[];
}

export interface AstroEvidenceItem {
  id: string;
  type: 'placement' | 'aspect' | 'transit' | 'house' | 'signature';
  label: string;
  detail: string;
  humanMeaning?: string;
  priority?: number;
  planet?: string;
  sign?: string;
  house?: number | null;
  aspectType?: string;
  orb?: number | null;
}

export interface NatalAnchorReadingV4 {
  headline: string;
  lead: string;
  sections: NatalHumanSection[];
  dictionaryTerms: NatalDictionaryTerm[];
  astroEvidence: AstroEvidenceItem[];
  /** Legacy bridges kept for older APIs while UI uses `sections`. */
  summary?: string;
  portrait?: string;
  threeAnchors?: NatalReadingPoint[];
  perceivedByOthers?: string;
  strengths?: NatalReadingPoint[];
  watchouts?: NatalReadingPoint[];
  reading?: string;
}

export interface NatalFullReadingV4 {
  headline: string;
  lead: string;
  sections: NatalHumanSection[];
  synthesis: string;
  astroEvidence: AstroEvidenceItem[];
  /** Legacy bridges kept for older APIs while UI uses `sections`. */
  summary?: string;
  mainConfiguration?: string;
  reactions?: string;
  choices?: string;
  closeness?: string;
  strengths?: string;
  tensionPattern?: string;
  integration?: string;
}

export interface NatalDailyReadingV3 {
  periodKey: string;
  headline: string;
  summary: string;
  whyToday: string;
  situations: NatalReadingPoint[];
  relationships: string;
  workMoney: string;
  evening: string;
  questionOfDay: string;
  astroEvidence: AstroEvidenceItem[];
  /** Legacy bridge for older clients. Use `situations` in new UI. */
  daySituations?: NatalReadingPoint[];
}

export type NatalAnchorReading = NatalAnchorReadingV4;
export type NatalFullReading = NatalFullReadingV4;
export type NatalLivingReading = NatalDailyReadingV3;

export type InterpretationAccess = 'free' | 'paid' | 'premium';

export type InterpretationSectionKey =
  | 'base_portrait'
  | 'main_formula'
  | 'sun_code'
  | 'moon_code'
  | 'ascendant_code'
  | 'strengths'
  | 'growth_zones'
  | 'how_others_see_you'
  | 'emotional_world'
  | 'self_relationship'
  | 'main_advice'
  | 'summary'
  | 'today_by_chart'
  | 'work_business'
  | 'love_relationships'
  | 'money_stability'
  | 'goals_actions'
  | 'friendship_social'
  | 'family_home'
  | 'shadow_patterns'
  | 'potential_purpose'
  | 'communication_conflicts'
  | 'energy_recovery'
  | 'personal_growth_scenario'
  | 'daily_overview'
  | 'daily_work_business'
  | 'daily_love'
  | 'daily_money'
  | 'daily_goals'
  | 'daily_communication'
  | 'daily_friendship'
  | 'daily_family'
  | 'daily_energy'
  | 'daily_risks'
  | 'daily_best_action'
  | 'daily_advice';

export interface InterpretationSection {
  key: InterpretationSectionKey;
  title: string;
  subtitle?: string;
  access: InterpretationAccess;
  isLocked?: boolean;
  teaser?: string;
  content: string;
  bullets?: string[];
  ctaLabel?: string;
}

export interface NatalInterpretationReport {
  userName: string;
  birthData: {
    birthDate: string;
    birthTime?: string | null;
    birthPlace: string;
  };
  calculatedAt: string;
  freeSections: InterpretationSection[];
  paidSections: InterpretationSection[];
  premiumSections?: InterpretationSection[];
  shortCard: {
    title: string;
    keywords: string[];
    text: string;
    advice: string;
  };
}

export type NatalStoryCardId =
  | 'first_impression'
  | 'inner_base'
  | 'strengths'
  | 'overload'
  | 'relationships'
  | 'today_bridge';

export type NatalStoryCta =
  | 'read_deeper'
  | 'open_today'
  | 'open_checkin'
  | 'scroll_full_report'
  | 'save_card';

export interface ProfileCard {
  id: string;
  order: number;
  mapperVersion?: string;
  title: string;
  subtitle?: string;
  chips: string[];
  shortText: string;
  body?: {
    life: string;
    plus: string;
    risk: string;
    action?: string;
  };
  freeText: string;
  premiumText?: string;
  premiumBody?: {
    work: string;
    relationships: string;
    money: string;
    recommendation: string;
    why: string;
  };
  freeBullets?: string[];
  premiumBullets?: string[];
  teaser?: string;
  isPremiumLocked: boolean;
  sourceKeys: string[];
  sourceDebug?: string[];
  confidence: 'high' | 'medium' | 'low';
  visualKey?: string;
  assetKey?: string;
  primaryCta?: {
    label: string;
    action: string;
    deepLink?: string;
  };
  secondaryCta?: {
    label: string;
    action: string;
  };
}

export interface NatalStoryCard extends ProfileCard {
  id: NatalStoryCardId;
  index: number;
  order: number;
  eyebrow: string;
  chipHints?: Record<string, string>;
  summaryShort: string;
  shortText: string;
  bodyFree: string;
  freeText: string;
  bodyPremium?: string;
  premiumText?: string;
  tease: string;
  previewBullet?: string;
  ctaPrimary: {
    type: NatalStoryCta;
    label: string;
  };
  ctaSecondary?: {
    type: NatalStoryCta;
    label: string;
  };
  illustrationKey:
    | 'hero_halo_portrait'
    | 'hero_core_rings'
    | 'hero_strength_spark'
    | 'hero_noise_fade'
    | 'hero_dual_orbit'
    | 'hero_path_focus';
  paidSectionKey?: InterpretationSectionKey;
}

export type NatalStoryShareFormat = 'story' | 'feed';

export interface PlanetInsightTag {
  id: string;
  label: string;
  tone?: 'water' | 'fire' | 'earth' | 'air' | 'neutral';
}

export interface PlanetInsight {
  planetId: string;
  title: string;
  sign: string;
  degree: number | null;
  house: number | null;
  body: string;
  tags: PlanetInsightTag[];
}

export interface WeeklyHoroscope {
  weekRange: string;
  theme: string;
  advice: string;
  love?: string; 
  career?: string; 
}

export interface MonthlyHoroscope {
  month: string;
  theme: string;
  focus: string;
  content: string;
}

export type ContentAccessTier = 'free' | 'premium';
export type ContentSurface = 'natal' | 'forecast' | 'synastry' | 'question';
export type ContentVariant =
  | 'anchor'
  | 'living'
  | 'planet_insight'
  | 'daily'
  | 'morning'
  | 'day'
  | 'evening'
  | 'weekly'
  | 'monthly'
  | 'brief'
  | 'full';
export type ContentModelTier = 'base' | 'premium';
export type ContentUnlockType = 'free' | 'premium';
export type PremiumTierName = 'lumia_premium';
export type PremiumEntitlementStatus = 'active' | 'expired' | 'cancelled';

export interface ContentInterpretation<T = any> {
  id: number;
  userId: string | null;
  chartId: number | null;
  accessTier: ContentAccessTier;
  contentSurface: ContentSurface;
  contentVariant: ContentVariant;
  modelTier: ContentModelTier;
  cacheKey: string;
  inputHash?: string | null;
  content: T;
  promptVersion?: string | null;
  calculationVersion?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
  isPersistent: boolean;
  canRegenerateForLumi: boolean;
  regenerationCostLumi?: number | null;
  legacySource?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContentUnlock {
  id: number;
  userId: string;
  chartId: number | null;
  accessTier: ContentAccessTier;
  contentSurface: ContentSurface;
  contentVariant: ContentVariant;
  unlockType: ContentUnlockType;
  cacheKey: string;
  lumiSpent: number;
  metadata?: Record<string, any> | null;
  unlockedAt: string;
  expiresAt?: string | null;
  revokedAt?: string | null;
}

export interface PremiumEntitlement {
  id: number;
  userId: string;
  tierName: PremiumTierName;
  status: PremiumEntitlementStatus;
  source: string;
  startsAt: string;
  endsAt: string;
  metadata?: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContentLookupQuery {
  userId: string;
  chartId?: number | null;
  accessTier: ContentAccessTier;
  contentSurface: ContentSurface;
  contentVariant: ContentVariant;
  cacheKey?: string;
}

export interface ContentUnlockRequest {
  userId: string;
  chartId?: number | null;
  accessTier: ContentAccessTier;
  contentSurface: ContentSurface;
  contentVariant: ContentVariant;
  cacheKey?: string;
  expiresAt?: string | null;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface OracleHistoryEntry {
  question: string;
  answer: string;
  createdAt: string;
}

export type AskLumiaTier = 'free' | 'premium';

export interface AskLumiaState {
  nextTier: AskLumiaTier;
  freeStarterAvailable: boolean;
  isPremium: boolean;
}

export interface OracleChatResponse {
  answer: string;
  createdAt: string;
  reusedRecent?: boolean;
  tier?: AskLumiaTier;
  state?: AskLumiaState;
}

export type AdminPremiumFilter = 'all' | 'premium' | 'free';
export type AdminUserSegment =
  | 'all'
  | 'premium'
  | 'free'
  | 'lumi'
  | 'active_7d'
  | 'inactive_3d'
  | 'inactive_7d'
  | 'inactive_30d'
  | 'need_attention';
export type AdminUserSortBy = 'last_seen' | 'created_at' | 'premium_until' | 'saved_charts_count' | 'name';
export type AdminSortOrder = 'asc' | 'desc';

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface AdminUserSummary {
  id: string;
  name: string;
  isPremium: boolean;
  premiumUntil: string | null;
  loginStreak: number;
  chartSlots: number;
  savedChartsCount: number;
  isAdmin: boolean;
  createdAt: string | null;
  lastLogin: string | null;
  lastSeenAt?: string | null;
}

export interface AdminUsersOverview {
  totalUsers: number;
  activePremiumUsers: number;
  activeUsers7d: number;
  needAttentionUsers: number;
}

export interface AdminUsersResponse {
  users: AdminUserSummary[];
  overview: AdminUsersOverview;
  pagination: PaginationMeta;
}

export interface AdminChartSummary {
  id: number;
  name: string;
  birthDate: string;
  birthTime: string;
  birthPlace: string;
}

export interface AdminRecentPayment {
  starsAmount: number;
  createdAt: string;
}

export interface AdminUserSession {
  sessionId: string;
  telegramPlatform: string | null;
  deviceLabel: string | null;
  userAgent: string | null;
  startedAt: string;
  lastSeenAt: string;
}

export interface AdminOracleQuestion {
  question: string;
  answer: string;
  createdAt: string;
}

export interface AdminUserDetail extends AdminUserSummary {
  birthDate: string;
  birthTime: string;
  birthPlace: string;
  primaryChart: AdminChartSummary | null;
  latestStarsPayment: AdminRecentPayment | null;
  lastSeenAt: string | null;
  currentDeviceLabel: string | null;
  recentSessions: AdminUserSession[];
  recentOracleQuestions: AdminOracleQuestion[];
}

export type AdminNotificationTemplateKind = 'personal' | 'broadcast' | 'both';
export type AdminNotificationTargetSegment =
  | 'all'
  | 'premium'
  | 'free'
  | 'lumi'
  | 'active_7d'
  | 'inactive_3d'
  | 'inactive_7d'
  | 'inactive_30d'
  | 'need_attention'
  | 'new_user_no_birth_data'
  | 'birth_data_no_time'
  | 'free_natal_ready_not_opened'
  | 'free_natal_opened_no_premium'
  | 'daily_active_free'
  | 'daily_active_premium'
  | 'inactive_2_days'
  | 'inactive_14_days'
  | 'love_interested'
  | 'money_interested'
  | 'work_interested'
  | 'assistant_user'
  | 'high_intent_premium';
export type AdminNotificationModeFilter = 'all' | 'personal' | 'broadcast';
export type AdminHistoryResultFilter = 'all' | 'success' | 'partial' | 'failed';

export interface AdminNotificationTemplate {
  id: number;
  title: string;
  bodyRu: string;
  bodyEn: string;
  kind: AdminNotificationTemplateKind;
  assetId?: number | null;
  assetPublicUrl?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminNotificationFailureSample {
  userId: string;
  userName: string;
  error: string;
  createdAt: string;
}

export interface AdminNotificationHistoryItem {
  id: number;
  mode: 'personal' | 'broadcast';
  targetSegment: AdminNotificationTargetSegment | null;
  targetUserId: string | null;
  targetUserName: string | null;
  templateId: number | null;
  title: string;
  bodyRu: string;
  bodyEn: string;
  assetId?: number | null;
  assetPublicUrl?: string | null;
  totalRecipients: number;
  successCount: number;
  failedCount: number;
  createdAt: string;
  sentAt: string | null;
  recentFailures: AdminNotificationFailureSample[];
}

export interface AdminNotificationHistoryResponse {
  history: AdminNotificationHistoryItem[];
  pagination: PaginationMeta;
}

export interface AdminNotificationSendResult {
  campaign: AdminNotificationHistoryItem;
}

export type NotificationSlot =
  | 'morning'
  | 'day'
  | 'evening'
  | 'daily_lumi'
  | 'upsell'
  | 'promo'
  | 'custom';
export type ScheduledNotificationMessageType = 'text' | 'photo';
export type NotificationVisualMode = 'none' | 'uploaded' | 'generated';
export type NotificationGeneratedZodiacMode = 'none' | 'sun_sign' | 'custom';
export type NotificationDayPart = 'morning' | 'day' | 'evening' | 'reactivation';
export type NotificationImageMode = 'auto' | 'manual' | 'none';

export interface AdminNotificationScenario {
  id: number;
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  dayPart: NotificationDayPart;
  timeWindowStart: string;
  timeWindowEnd: string;
  timezoneMode: string;
  priority: number;
  triggerRuleJson: Record<string, any>;
  audienceRuleJson: Record<string, any>;
  maxPerDay: number;
  cooldownHours: number;
  imageMode: NotificationImageMode | string;
  imageStrategyJson: Record<string, any>;
  defaultMediaAssetId: number | null;
  deepLink: string;
  buttons: Array<Record<string, any>>;
  templatesCount: number;
  activeTemplatesCount: number;
  lastSentAt: string | null;
  sentCount: number;
  clickedCount: number;
  ctr: number;
  errorCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminNotificationScenarioPayload {
  name: string;
  description: string;
  enabled: boolean;
  dayPart: NotificationDayPart;
  timeWindowStart: string;
  timeWindowEnd: string;
  priority: number;
  triggerRuleJson: Record<string, any>;
  audienceRuleJson: Record<string, any>;
  maxPerDay: number;
  cooldownHours: number;
  imageMode: NotificationImageMode | string;
  imageStrategyJson: Record<string, any>;
  defaultMediaAssetId: number | null;
  deepLink: string;
  buttons: Array<Record<string, any>>;
}

export interface AdminNotificationTemplatePayload {
  id?: number | null;
  scenarioId?: number | null;
  name?: string | null;
  slot?: NotificationSlot | string | null;
  targetSegment?: AdminNotificationTargetSegment | null;
  title?: string | null;
  body?: string | null;
  text?: string | null;
  buttonText?: string | null;
  deepLink?: string | null;
  assetId?: number | null;
  isActive?: boolean;
  tags?: string[];
  weight?: number;
  visualMode?: NotificationVisualMode;
  notes?: string | null;
}

export interface AdminScheduledNotificationAsset {
  id: number;
  fileName: string;
  publicUrl: string;
  mimeType: string;
  fileSize: number;
  refCount: number;
  telegramFileId?: string | null;
  title?: string | null;
  category?: string;
  tags?: string[];
  mood?: string | null;
  dayPart?: string | null;
  enabled?: boolean;
  lastUsedAt?: string | null;
  cooldownDays?: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminScheduledNotificationTemplate {
  id: number;
  scenarioId?: number | null;
  scenarioKey?: string | null;
  name: string;
  slot: NotificationSlot;
  targetSegment: AdminNotificationTargetSegment | null;
  messageType: ScheduledNotificationMessageType;
  visualMode: NotificationVisualMode;
  title?: string;
  body?: string;
  text: string;
  buttonText: string;
  deepLink: string;
  assetId: number | null;
  assetPublicUrl: string | null;
  assetMimeType: string | null;
  assetFileName: string | null;
  tags?: string[];
  weight?: number;
  lastUsedAt?: string | null;
  generatedPreset: string | null;
  generatedTitle: string | null;
  generatedSubtitle: string | null;
  generatedAccent: string | null;
  generatedShowDate: boolean;
  generatedShowSlotLabel: boolean;
  generatedZodiacMode: NotificationGeneratedZodiacMode | string | null;
  generatedCustomZodiac: string | null;
  isActive: boolean;
  sortOrder: number;
  rotationGroup: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  schedules?: AdminNotificationSchedule[];
}

export interface AdminNotificationEngineStats {
  sent: number;
  delivered: number;
  clicked: number;
  ctr: number;
  checkinCompleted: number;
  openedApp: number;
  disabledNotifications: number;
  errors: number;
  byScenario: Array<{
    scenarioKey: string;
    sent: number;
    clicked: number;
    ctr: number;
    errors: number;
  }>;
  bestTemplates: Array<{
    templateId: number;
    title: string;
    sent: number;
    clicked: number;
    ctr: number;
  }>;
  worstTemplates: Array<{
    templateId: number;
    title: string;
    sent: number;
    clicked: number;
    ctr: number;
  }>;
  bestTimeWindows: Array<{
    label: string;
    sent: number;
    clicked: number;
    ctr: number;
  }>;
}

export type RetentionNotificationStatus =
  | 'scheduled'
  | 'sending'
  | 'sent'
  | 'failed'
  | 'skipped'
  | 'cancelled';

export interface AdminScheduledNotificationQueueItem {
  id: number;
  userId: string;
  userName: string | null;
  notificationType: string;
  segment: string | null;
  status: RetentionNotificationStatus;
  scheduledAt: string;
  sentAt: string | null;
  attemptCount: number;
  campaignId: number | null;
  scenarioId: number | null;
  scenarioKey: string | null;
  templateId: number | null;
  reason: string | null;
  title: string;
  body: string;
  buttonText: string;
  deepLink: string;
  telegramMessageId: number | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminNotificationCampaignQueueItem {
  id: number;
  name: string;
  type: string;
  segment: string | null;
  status: string;
  startAt: string | null;
  endAt: string | null;
  maxSendsPerUser: number;
  abTestEnabled: boolean;
  totalRecipients: number;
  successCount: number;
  failedCount: number;
  sentAt: string | null;
  createdAt: string;
}

export interface AdminNotificationSchedule {
  id: number;
  templateId: number;
  sendTime: string;
  timezone: string;
  repeatMode: string;
  isActive: boolean;
  lastSentAt: string | null;
  createdAt: string;
  updatedAt: string;
  templateName?: string;
  templateSlot?: string;
}

export interface AdminNotificationDeliveryLogItem {
  id: number;
  templateId: number | null;
  templateName: string | null;
  scheduledFor: string | null;
  sentAt: string | null;
  recipientCount: number;
  successCount: number;
  failureCount: number;
  status: string;
  errorSummary: string | null;
  visualMode: string | null;
  generatedPreset: string | null;
  assetId: number | null;
  generatedCacheHit: boolean | null;
  createdAt: string;
}

export type ViewState =
  | 'onboarding'
  | 'hook'
  | 'paywall'
  | 'dashboard'
  | 'chart'
  | 'horoscope'
  | 'personal_daily'
  | 'synastry'
  | 'oracle'
  | 'settings'
  | 'admin'
  | 'charts';

// Cached text types
export interface CachedText<T = any> {
  data: T;
  updatedAt?: Date | string;
  createdAt?: Date | string;
}

// Regeneration types
export type ContentType = 'natal_summary' | 'full_natal' | 'synastry' | 'forecast' | 'natal_intro';

export interface RegenerationLimits {
  canRegenerate: boolean;
  isFree: boolean;
  costInStars: number;
  regenerationsToday: number;
  message?: string;
}

export interface RegenerationRequest {
  userId: string;
  contentType: ContentType;
}

export interface RegenerationResponse {
  success: boolean;
  data?: any;
  error?: string;
  newBalance?: number;
}
