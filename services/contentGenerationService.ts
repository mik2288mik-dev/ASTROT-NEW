import { UserProfile, NatalChartData, UserGeneratedContent, DailyHoroscope, WeeklyHoroscope, MonthlyHoroscope, ThreeKeys } from "../types";
import { getThreeKeys, getDailyHoroscope, getWeeklyHoroscope, getMonthlyHoroscope, getDeepDiveAnalysis } from "./astrologyService";
import { saveProfile } from "./storageService";
import { db } from "../lib/db";

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
 * Получает время следующего обновления гороскопа (00:01 по МСК)
 */
const getNextDailyUpdateTime = (): number => {
  // Получаем текущее время в МСК (UTC+3)
  const now = new Date();
  const moscowTime = new Date(now.getTime() + (3 * 60 * 60 * 1000)); // UTC+3
  
  // Создаем дату следующего обновления в 00:01 МСК
  const nextUpdate = new Date(moscowTime);
  nextUpdate.setHours(0, 1, 0, 0);
  
  // Если уже прошло 00:01 сегодня, берем завтра 00:01
  if (moscowTime.getTime() >= nextUpdate.getTime()) {
    nextUpdate.setDate(nextUpdate.getDate() + 1);
  }
  
  // Конвертируем обратно в UTC timestamp
  return nextUpdate.getTime() - (3 * 60 * 60 * 1000);
};

/**
 * Проверяет, нужно ли обновить дневной гороскоп
 * Обновляется каждый день в 00:01 по МСК
 */
const shouldUpdateDailyHoroscope = (lastGenerated: number): boolean => {
  if (!lastGenerated) return true;
  
  const now = Date.now();
  const moscowNow = new Date(now + (3 * 60 * 60 * 1000));
  const moscowLast = new Date(lastGenerated + (3 * 60 * 60 * 1000));
  
  // Получаем дату последнего обновления в 00:01 МСК
  const lastUpdateDate = new Date(moscowLast);
  lastUpdateDate.setHours(0, 1, 0, 0);
  
  // Получаем текущую дату в 00:01 МСК
  const currentUpdateDate = new Date(moscowNow);
  currentUpdateDate.setHours(0, 1, 0, 0);
  
  // Если текущее время после 00:01 и дата изменилась - обновляем
  if (moscowNow.getHours() > 0 || (moscowNow.getHours() === 0 && moscowNow.getMinutes() >= 1)) {
    if (currentUpdateDate.getTime() > lastUpdateDate.getTime()) {
      return true;
    }
  }
  
  // Если прошло больше суток - обновляем в любом случае
  return now - lastGenerated > (24 * 60 * 60 * 1000);
};

/**
 * Проверяет, нужно ли обновить контент на основе временных меток
 */
export const shouldUpdateContent = (timestamps: UserGeneratedContent['timestamps'], contentType: 'daily' | 'weekly' | 'monthly' | 'threeKeys' | 'deepDive'): boolean => {
  const now = Date.now();
  const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;
  const ONE_MONTH = 30 * 24 * 60 * 60 * 1000;

  switch (contentType) {
    case 'daily':
      // Обновляем каждый день в 4:00 утра по МСК
      const lastDaily = timestamps.dailyHoroscopeGenerated || 0;
      return shouldUpdateDailyHoroscope(lastDaily);
    
    case 'weekly':
      // Weekly гороскоп генерируется ОДИН РАЗ при первом входе, не обновляется автоматически
      // Обновление только через платную регенерацию за звезды
      return false;
    
    case 'monthly':
      // Monthly гороскоп генерируется ОДИН РАЗ при первом входе, не обновляется автоматически
      // Обновление только через платную регенерацию за звезды
      return false;
    
    case 'threeKeys':
      // Три ключа генерируются ТОЛЬКО ОДИН РАЗ (НЕ обновляются автоматически)
      // Обновление только через платную регенерацию за звезды
      return false;
    
    case 'deepDive':
      // Deep Dive генерируется ТОЛЬКО ОДИН РАЗ (НЕ обновляется автоматически)
      // Обновление только через платную регенерацию за звезды
      return false;
    
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
 * 
 * ВАЖНО: 
 * - Натальная карта (Three Keys, Deep Dive) генерируется ОДИН РАЗ
 * - Обновляются ТОЛЬКО гороскопы по расписанию
 * - Натальная карта обновляется только через платную регенерацию
 */
export const updateContentIfNeeded = async (profile: UserProfile, chartData: NatalChartData): Promise<UserGeneratedContent> => {
  log.info('[updateContentIfNeeded] Checking if content needs update', {
    userId: profile.id,
    hasGeneratedContent: !!profile.generatedContent
  });

  // Если контента вообще нет - генерируем все (первый вход)
  if (!profile.generatedContent) {
    log.info('[updateContentIfNeeded] No content found, generating all (first time)');
    return await generateAllContent(profile, chartData);
  }

  const existingContent = profile.generatedContent;
  const timestamps = existingContent.timestamps || {};
  let updated = false;

  // Обновляем ТОЛЬКО ежедневный гороскоп по расписанию (каждый день в 00:01 МСК)
  // Weekly, Monthly, Three Keys и Deep Dive НЕ обновляются автоматически
  // Они генерируются один раз при первом входе и сохраняются в БД
  
  if (shouldUpdateContent(timestamps, 'daily')) {
    log.info('[updateContentIfNeeded] Updating daily horoscope (00:01 MSK)');
    try {
      existingContent.dailyHoroscope = await getDailyHoroscope(profile, chartData);
      existingContent.timestamps.dailyHoroscopeGenerated = Date.now();
      updated = true;
    } catch (error) {
      log.error('[updateContentIfNeeded] Failed to update daily horoscope', error);
    }
  }
  
  // Weekly и Monthly гороскопы НЕ обновляются автоматически
  // Они генерируются один раз и сохраняются в БД

  // Если что-то обновилось - сохраняем профиль
  if (updated) {
    log.info('[updateContentIfNeeded] Horoscopes updated, saving profile');
    try {
      const updatedProfile = { ...profile, generatedContent: existingContent };
      await saveProfile(updatedProfile);
    } catch (error) {
      log.error('[updateContentIfNeeded] Failed to save updated profile', error);
    }
  } else {
    log.info('[updateContentIfNeeded] No horoscope updates needed, using cache');
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
 * Для daily гороскопа: проверяет кэш в БД по знаку зодиака и дате
 * Гороскоп генерируется один раз в день для всех пользователей одного знака
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

  // Для daily гороскопа: проверяем централизованный кэш в БД по знаку зодиака
  if (period === 'daily') {
    const zodiacSign = chartData.sun?.sign;
    if (!zodiacSign) {
      log.error('[getOrGenerateHoroscope] No zodiac sign found in chartData');
      throw new Error('Zodiac sign is required for daily horoscope');
    }

    // Получаем сегодняшнюю дату в формате YYYY-MM-DD
    const today = new Date().toISOString().split('T')[0];
    
    try {
      // Проверяем кэш в БД
      const cachedHoroscope = await db.dailyHoroscopesCache.get(zodiacSign, today);
      
      if (cachedHoroscope && cachedHoroscope.data) {
        log.info(`[getOrGenerateHoroscope] Using cached daily horoscope from DB for ${zodiacSign} on ${today}`);
        const horoscope = cachedHoroscope.data as DailyHoroscope;
        
        // Убеждаемся, что дата актуальная
        if (!horoscope.date || horoscope.date !== today) {
          horoscope.date = today;
        }
        
        // Сохраняем в профиль пользователя для быстрого доступа
        if (!profile.generatedContent) {
          profile.generatedContent = { deepDiveAnalyses: {}, synastries: {}, timestamps: {} };
        }
        profile.generatedContent.dailyHoroscope = horoscope;
        profile.generatedContent.timestamps.dailyHoroscopeGenerated = Date.now();
        
        // Сохраняем профиль асинхронно (не ждем)
        saveProfile(profile).catch(error => {
          log.error('[getOrGenerateHoroscope] Failed to save profile with cached horoscope', error);
        });
        
        return horoscope;
      }
      
      // Если нет в кэше - генерируем новый гороскоп
      log.info(`[getOrGenerateHoroscope] No cached horoscope found, generating new one for ${zodiacSign} on ${today}`);
      const horoscope = await getDailyHoroscope(profile, chartData);
      
      // Убеждаемся, что дата актуальная
      if (!horoscope.date || horoscope.date !== today) {
        horoscope.date = today;
      }
      
      // Сохраняем в централизованный кэш БД для всех пользователей этого знака
      try {
        await db.dailyHoroscopesCache.set(zodiacSign, today, horoscope);
        log.info(`[getOrGenerateHoroscope] Daily horoscope cached in DB for ${zodiacSign} on ${today}`);
      } catch (cacheError) {
        log.error('[getOrGenerateHoroscope] Failed to cache horoscope in DB', cacheError);
        // Продолжаем выполнение даже если кэширование не удалось
      }
      
      // Сохраняем в профиль пользователя
      if (!profile.generatedContent) {
        profile.generatedContent = { deepDiveAnalyses: {}, synastries: {}, timestamps: {} };
      }
      profile.generatedContent.dailyHoroscope = horoscope;
      profile.generatedContent.timestamps.dailyHoroscopeGenerated = Date.now();
      
      // Сохраняем профиль
      try {
        await saveProfile(profile);
        log.info(`[getOrGenerateHoroscope] Daily horoscope saved to profile`);
      } catch (error) {
        log.error(`[getOrGenerateHoroscope] Failed to save profile`, error);
      }
      
      return horoscope;
    } catch (error) {
      log.error('[getOrGenerateHoroscope] Error getting daily horoscope from cache', error);
      // Fallback: генерируем как раньше
      const horoscope = await getDailyHoroscope(profile, chartData);
      const today = new Date().toISOString().split('T')[0];
      if (!horoscope.date || horoscope.date !== today) {
        horoscope.date = today;
      }
      return horoscope;
    }
  }

  // Для weekly и monthly гороскопов - проверяем наличие в кэше пользователя
  // Они генерируются только один раз и не обновляются автоматически
  if (period === 'weekly' && profile.generatedContent?.weeklyHoroscope) {
    log.info('[getOrGenerateHoroscope] Using cached weekly horoscope');
    return profile.generatedContent.weeklyHoroscope;
  }
  
  if (period === 'monthly' && profile.generatedContent?.monthlyHoroscope) {
    log.info('[getOrGenerateHoroscope] Using cached monthly horoscope');
    return profile.generatedContent.monthlyHoroscope;
  }

  // Генерируем новый гороскоп для weekly/monthly
  log.info(`[getOrGenerateHoroscope] Generating new ${period} horoscope`);
  try {
    let horoscope: DailyHoroscope | WeeklyHoroscope | MonthlyHoroscope;

    if (period === 'weekly') {
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
