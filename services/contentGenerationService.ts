import { UserProfile, NatalChartData, UserGeneratedContent, DailyHoroscope, WeeklyHoroscope, MonthlyHoroscope, ThreeKeys } from "../types";
import { getThreeKeys, getDailyHoroscope, getWeeklyHoroscope, getMonthlyHoroscope, getDeepDiveAnalysis } from "./astrologyService";
import { saveProfile } from "./storageService";

// Logging utility
const log = {
  info: (message: string, data?: any) => {
    console.log(`[ContentGenerationService] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[ContentGenerationService] ERROR: ${message}`, error || '');
  },
  warn: (message: string, data?: any) => {
    console.warn(`[ContentGenerationService] WARNING: ${message}`, data || '');
  }
};

/**
 * Проверяет, нужно ли обновить контент на основе временных меток
 */
export const shouldUpdateContent = (timestamps: UserGeneratedContent['timestamps'], contentType: 'daily' | 'weekly' | 'monthly' | 'threeKeys' | 'deepDive'): boolean => {
  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;
  const ONE_WEEK = 7 * ONE_DAY;
  const ONE_MONTH = 30 * ONE_DAY;

  switch (contentType) {
    case 'daily':
      // Обновляем ежедневно
      const lastDaily = timestamps.dailyHoroscopeGenerated || 0;
      return now - lastDaily > ONE_DAY;
    
    case 'weekly':
      // Обновляем еженедельно
      const lastWeekly = timestamps.weeklyHoroscopeGenerated || 0;
      return now - lastWeekly > ONE_WEEK;
    
    case 'monthly':
      // Обновляем ежемесячно
      const lastMonthly = timestamps.monthlyHoroscopeGenerated || 0;
      return now - lastMonthly > ONE_MONTH;
    
    case 'threeKeys':
      // Три ключа генерируются только один раз (или при регенерации)
      return !timestamps.threeKeysGenerated;
    
    case 'deepDive':
      // Deep Dive генерируется только один раз
      return !timestamps.deepDiveGenerated;
    
    default:
      return true;
  }
};

/**
 * Генерирует ВСЕ данные для пользователя сразу
 * Вызывается при первом входе или когда данных нет
 */
export const generateAllContent = async (profile: UserProfile, chartData: NatalChartData): Promise<UserGeneratedContent> => {
  log.info('[generateAllContent] Starting full content generation', {
    userId: profile.id,
    name: profile.name
  });

  const startTime = Date.now();
  const generatedContent: UserGeneratedContent = {
    timestamps: {}
  };

  try {
    // 1. Генерируем три ключа (если еще нет)
    log.info('[generateAllContent] Generating Three Keys...');
    try {
      const threeKeys = await getThreeKeys(profile, chartData);
      generatedContent.threeKeys = threeKeys;
      generatedContent.timestamps.threeKeysGenerated = Date.now();
      log.info('[generateAllContent] Three Keys generated successfully');
    } catch (error) {
      log.error('[generateAllContent] Failed to generate Three Keys', error);
    }

    // 2. Генерируем гороскопы
    log.info('[generateAllContent] Generating horoscopes...');
    try {
      const [daily, weekly, monthly] = await Promise.all([
        getDailyHoroscope(profile, chartData).catch(e => {
          log.error('[generateAllContent] Failed to generate daily horoscope', e);
          return null;
        }),
        getWeeklyHoroscope(profile, chartData).catch(e => {
          log.error('[generateAllContent] Failed to generate weekly horoscope', e);
          return null;
        }),
        getMonthlyHoroscope(profile, chartData).catch(e => {
          log.error('[generateAllContent] Failed to generate monthly horoscope', e);
          return null;
        })
      ]);

      if (daily) {
        generatedContent.dailyHoroscope = daily;
        generatedContent.timestamps.dailyHoroscopeGenerated = Date.now();
      }
      if (weekly) {
        generatedContent.weeklyHoroscope = weekly;
        generatedContent.timestamps.weeklyHoroscopeGenerated = Date.now();
      }
      if (monthly) {
        generatedContent.monthlyHoroscope = monthly;
        generatedContent.timestamps.monthlyHoroscopeGenerated = Date.now();
      }
      log.info('[generateAllContent] Horoscopes generated successfully');
    } catch (error) {
      log.error('[generateAllContent] Failed to generate horoscopes', error);
    }

    // 3. Генерируем Deep Dive анализы (все 5 разделов сразу)
    log.info('[generateAllContent] Generating Deep Dive analyses...');
    const deepDiveTopics = [
      { key: 'personality', title: profile.language === 'ru' ? 'Личность' : 'Personality' },
      { key: 'love', title: profile.language === 'ru' ? 'Любовь' : 'Love' },
      { key: 'career', title: profile.language === 'ru' ? 'Карьера' : 'Career' },
      { key: 'weakness', title: profile.language === 'ru' ? 'Слабости' : 'Weakness' },
      { key: 'karma', title: profile.language === 'ru' ? 'Карма' : 'Karma' }
    ];

    generatedContent.deepDiveAnalyses = {};

    try {
      // Генерируем все Deep Dive анализы параллельно
      const deepDivePromises = deepDiveTopics.map(async (topic) => {
        try {
          const analysis = await getDeepDiveAnalysis(profile, topic.title, chartData);
          return { key: topic.key, analysis };
        } catch (error) {
          log.error(`[generateAllContent] Failed to generate Deep Dive for ${topic.key}`, error);
          return { key: topic.key, analysis: null };
        }
      });

      const deepDiveResults = await Promise.all(deepDivePromises);
      
      deepDiveResults.forEach((result) => {
        if (result.analysis && generatedContent.deepDiveAnalyses) {
          (generatedContent.deepDiveAnalyses as any)[result.key] = result.analysis;
        }
      });

      generatedContent.timestamps.deepDiveGenerated = Date.now();
      log.info('[generateAllContent] Deep Dive analyses generated successfully');
    } catch (error) {
      log.error('[generateAllContent] Failed to generate Deep Dive analyses', error);
    }

    // 4. Инициализируем пустой объект для синастрий
    generatedContent.synastries = {};

    const duration = Date.now() - startTime;
    log.info(`[generateAllContent] Full content generation completed in ${duration}ms`, {
      hasThreeKeys: !!generatedContent.threeKeys,
      hasDaily: !!generatedContent.dailyHoroscope,
      hasWeekly: !!generatedContent.weeklyHoroscope,
      hasMonthly: !!generatedContent.monthlyHoroscope,
      deepDiveCount: Object.keys(generatedContent.deepDiveAnalyses || {}).length
    });

    return generatedContent;
  } catch (error) {
    log.error('[generateAllContent] Critical error during content generation', error);
    throw error;
  }
};

/**
 * Обновляет контент, если необходимо (проверяет временные метки)
 */
export const updateContentIfNeeded = async (profile: UserProfile, chartData: NatalChartData): Promise<UserGeneratedContent> => {
  log.info('[updateContentIfNeeded] Checking if content needs update', {
    userId: profile.id,
    hasGeneratedContent: !!profile.generatedContent
  });

  // Если контента вообще нет - генерируем все
  if (!profile.generatedContent) {
    log.info('[updateContentIfNeeded] No content found, generating all');
    return await generateAllContent(profile, chartData);
  }

  const existingContent = profile.generatedContent;
  const timestamps = existingContent.timestamps || {};
  let updated = false;

  // Проверяем и обновляем гороскопы по расписанию
  if (shouldUpdateContent(timestamps, 'daily')) {
    log.info('[updateContentIfNeeded] Updating daily horoscope');
    try {
      existingContent.dailyHoroscope = await getDailyHoroscope(profile, chartData);
      existingContent.timestamps.dailyHoroscopeGenerated = Date.now();
      updated = true;
    } catch (error) {
      log.error('[updateContentIfNeeded] Failed to update daily horoscope', error);
    }
  }

  if (shouldUpdateContent(timestamps, 'weekly')) {
    log.info('[updateContentIfNeeded] Updating weekly horoscope');
    try {
      existingContent.weeklyHoroscope = await getWeeklyHoroscope(profile, chartData);
      existingContent.timestamps.weeklyHoroscopeGenerated = Date.now();
      updated = true;
    } catch (error) {
      log.error('[updateContentIfNeeded] Failed to update weekly horoscope', error);
    }
  }

  if (shouldUpdateContent(timestamps, 'monthly')) {
    log.info('[updateContentIfNeeded] Updating monthly horoscope');
    try {
      existingContent.monthlyHoroscope = await getMonthlyHoroscope(profile, chartData);
      existingContent.timestamps.monthlyHoroscopeGenerated = Date.now();
      updated = true;
    } catch (error) {
      log.error('[updateContentIfNeeded] Failed to update monthly horoscope', error);
    }
  }

  // Если что-то обновилось - сохраняем профиль
  if (updated) {
    log.info('[updateContentIfNeeded] Content updated, saving profile');
    try {
      const updatedProfile = { ...profile, generatedContent: existingContent };
      await saveProfile(updatedProfile);
    } catch (error) {
      log.error('[updateContentIfNeeded] Failed to save updated profile', error);
    }
  } else {
    log.info('[updateContentIfNeeded] No updates needed');
  }

  return existingContent;
};

/**
 * Получает или генерирует Deep Dive анализ для конкретной темы
 */
export const getOrGenerateDeepDive = async (
  profile: UserProfile,
  chartData: NatalChartData,
  topic: 'personality' | 'love' | 'career' | 'weakness' | 'karma'
): Promise<string> => {
  log.info(`[getOrGenerateDeepDive] Getting Deep Dive for topic: ${topic}`, {
    userId: profile.id,
    hasGeneratedContent: !!profile.generatedContent
  });

  // Проверяем, есть ли уже сгенерированный контент
  if (profile.generatedContent?.deepDiveAnalyses?.[topic]) {
    log.info(`[getOrGenerateDeepDive] Using cached Deep Dive for ${topic}`);
    return profile.generatedContent.deepDiveAnalyses[topic]!;
  }

  // Если нет - генерируем
  log.info(`[getOrGenerateDeepDive] Generating new Deep Dive for ${topic}`);
  const topicTitle = {
    personality: profile.language === 'ru' ? 'Личность' : 'Personality',
    love: profile.language === 'ru' ? 'Любовь' : 'Love',
    career: profile.language === 'ru' ? 'Карьера' : 'Career',
    weakness: profile.language === 'ru' ? 'Слабости' : 'Weakness',
    karma: profile.language === 'ru' ? 'Карма' : 'Karma'
  }[topic];

  try {
    const analysis = await getDeepDiveAnalysis(profile, topicTitle, chartData);
    
    // Сохраняем в кэш
    if (!profile.generatedContent) {
      profile.generatedContent = {
        deepDiveAnalyses: {},
        synastries: {},
        timestamps: {}
      };
    }
    if (!profile.generatedContent.deepDiveAnalyses) {
      profile.generatedContent.deepDiveAnalyses = {};
    }
    profile.generatedContent.deepDiveAnalyses[topic] = analysis;
    profile.generatedContent.timestamps.deepDiveGenerated = Date.now();

    // Сохраняем профиль
    try {
      await saveProfile(profile);
      log.info(`[getOrGenerateDeepDive] Deep Dive saved for ${topic}`);
    } catch (error) {
      log.error(`[getOrGenerateDeepDive] Failed to save Deep Dive for ${topic}`, error);
    }

    return analysis;
  } catch (error) {
    log.error(`[getOrGenerateDeepDive] Failed to generate Deep Dive for ${topic}`, error);
    throw error;
  }
};

/**
 * Получает или генерирует гороскоп (с проверкой актуальности)
 */
export const getOrGenerateHoroscope = async (
  profile: UserProfile,
  chartData: NatalChartData,
  period: 'daily' | 'weekly' | 'monthly'
): Promise<DailyHoroscope | WeeklyHoroscope | MonthlyHoroscope> => {
  log.info(`[getOrGenerateHoroscope] Getting ${period} horoscope`, {
    userId: profile.id,
    hasGeneratedContent: !!profile.generatedContent
  });

  const timestamps = profile.generatedContent?.timestamps || {};

  // Проверяем, нужно ли обновить
  const needsUpdate = shouldUpdateContent(timestamps, period);

  if (!needsUpdate) {
    // Возвращаем кэшированный гороскоп
    if (period === 'daily' && profile.generatedContent?.dailyHoroscope) {
      log.info('[getOrGenerateHoroscope] Using cached daily horoscope');
      return profile.generatedContent.dailyHoroscope;
    }
    if (period === 'weekly' && profile.generatedContent?.weeklyHoroscope) {
      log.info('[getOrGenerateHoroscope] Using cached weekly horoscope');
      return profile.generatedContent.weeklyHoroscope;
    }
    if (period === 'monthly' && profile.generatedContent?.monthlyHoroscope) {
      log.info('[getOrGenerateHoroscope] Using cached monthly horoscope');
      return profile.generatedContent.monthlyHoroscope;
    }
  }

  // Генерируем новый гороскоп
  log.info(`[getOrGenerateHoroscope] Generating new ${period} horoscope`);
  try {
    let horoscope: DailyHoroscope | WeeklyHoroscope | MonthlyHoroscope;

    if (period === 'daily') {
      horoscope = await getDailyHoroscope(profile, chartData);
      if (!profile.generatedContent) {
        profile.generatedContent = { deepDiveAnalyses: {}, synastries: {}, timestamps: {} };
      }
      profile.generatedContent.dailyHoroscope = horoscope as DailyHoroscope;
      profile.generatedContent.timestamps.dailyHoroscopeGenerated = Date.now();
    } else if (period === 'weekly') {
      horoscope = await getWeeklyHoroscope(profile, chartData);
      if (!profile.generatedContent) {
        profile.generatedContent = { deepDiveAnalyses: {}, synastries: {}, timestamps: {} };
      }
      profile.generatedContent.weeklyHoroscope = horoscope as WeeklyHoroscope;
      profile.generatedContent.timestamps.weeklyHoroscopeGenerated = Date.now();
    } else {
      horoscope = await getMonthlyHoroscope(profile, chartData);
      if (!profile.generatedContent) {
        profile.generatedContent = { deepDiveAnalyses: {}, synastries: {}, timestamps: {} };
      }
      profile.generatedContent.monthlyHoroscope = horoscope as MonthlyHoroscope;
      profile.generatedContent.timestamps.monthlyHoroscopeGenerated = Date.now();
    }

    // Сохраняем профиль
    try {
      await saveProfile(profile);
      log.info(`[getOrGenerateHoroscope] ${period} horoscope saved`);
    } catch (error) {
      log.error(`[getOrGenerateHoroscope] Failed to save ${period} horoscope`, error);
    }

    return horoscope;
  } catch (error) {
    log.error(`[getOrGenerateHoroscope] Failed to generate ${period} horoscope`, error);
    throw error;
  }
};

/**
 * Получает или генерирует синастрию для конкретного партнера
 */
export const getOrGenerateSynastry = async (
  profile: UserProfile,
  partnerName: string,
  partnerDate: string,
  partnerTime?: string,
  partnerPlace?: string,
  relationshipType?: string,
  mode: 'brief' | 'full' = 'brief'
): Promise<any> => {
  log.info(`[getOrGenerateSynastry] Getting synastry for partner: ${partnerName}`, {
    userId: profile.id,
    mode,
    hasGeneratedContent: !!profile.generatedContent
  });

  // Создаем уникальный ключ для партнера (на основе имени и даты рождения)
  const partnerId = `${partnerName.toLowerCase().trim()}_${partnerDate}`;

  // Проверяем, есть ли уже сохраненная синастрия
  const cachedSynastry = profile.generatedContent?.synastries?.[partnerId];
  
  if (cachedSynastry) {
    if (mode === 'brief' && cachedSynastry.briefResult) {
      log.info(`[getOrGenerateSynastry] Using cached brief synastry for ${partnerName}`);
      return cachedSynastry.briefResult;
    }
    if (mode === 'full' && cachedSynastry.fullResult) {
      log.info(`[getOrGenerateSynastry] Using cached full synastry for ${partnerName}`);
      return cachedSynastry.fullResult;
    }
  }

  // Если нет кэша - генерируем
  log.info(`[getOrGenerateSynastry] Generating new ${mode} synastry for ${partnerName}`);
  
  try {
    const { calculateBriefSynastry, calculateFullSynastry } = await import('./astrologyService');
    
    let result: any;
    if (mode === 'brief') {
      result = await calculateBriefSynastry(
        profile,
        partnerName,
        partnerDate,
        partnerTime,
        partnerPlace,
        relationshipType
      );
    } else {
      result = await calculateFullSynastry(
        profile,
        partnerName,
        partnerDate,
        partnerTime,
        partnerPlace,
        relationshipType
      );
    }

    // Сохраняем результат в кэш
    if (!profile.generatedContent) {
      profile.generatedContent = {
        deepDiveAnalyses: {},
        synastries: {},
        timestamps: {}
      };
    }
    if (!profile.generatedContent.synastries) {
      profile.generatedContent.synastries = {};
    }
    if (!profile.generatedContent.synastries[partnerId]) {
      profile.generatedContent.synastries[partnerId] = {
        partnerName,
        partnerDate,
        timestamp: Date.now()
      };
    }

    if (mode === 'brief') {
      profile.generatedContent.synastries[partnerId].briefResult = result;
    } else {
      profile.generatedContent.synastries[partnerId].fullResult = result;
    }

    // Сохраняем профиль
    try {
      await saveProfile(profile);
      log.info(`[getOrGenerateSynastry] Synastry saved for ${partnerName}`);
    } catch (error) {
      log.error(`[getOrGenerateSynastry] Failed to save synastry for ${partnerName}`, error);
    }

    return result;
  } catch (error) {
    log.error(`[getOrGenerateSynastry] Failed to generate synastry for ${partnerName}`, error);
    throw error;
  }
};
