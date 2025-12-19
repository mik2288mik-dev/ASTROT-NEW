/**
 * Конфигурация Premium и Free контента
 * 
 * Здесь четко разделяются все функции на бесплатные и премиальные
 */

export interface FeatureAccess {
  free: boolean;      // Доступно бесплатно
  premium: boolean;   // Доступно с премиумом
  description: string;
  limit?: number;     // Лимит использования для free (undefined = без лимита)
}

export const PREMIUM_FEATURES: Record<string, FeatureAccess> = {
  // ==================== НАТАЛЬНАЯ КАРТА ====================
  
  'natal_chart_calculation': {
    free: true,
    premium: true,
    description: 'Расчет натальной карты',
    limit: undefined // Без лимита
  },
  
  'natal_chart_intro': {
    free: true,
    premium: true,
    description: 'Вступление и общий портрет личности',
    limit: undefined
  },
  
  'natal_chart_personality': {
    free: false,
    premium: true,
    description: 'Глубокий анализ личности и характера',
  },
  
  'natal_chart_love': {
    free: false,
    premium: true,
    description: 'Анализ любви и отношений',
  },
  
  'natal_chart_career': {
    free: false,
    premium: true,
    description: 'Анализ карьеры и самореализации',
  },
  
  'natal_chart_challenges': {
    free: false,
    premium: true,
    description: 'Зоны роста и вызовы',
  },
  
  'natal_chart_karma': {
    free: false,
    premium: true,
    description: 'Кармическая задача и предназначение',
  },
  
  // ==================== ГОРОСКОПЫ ====================
  
  'daily_horoscope': {
    free: true,
    premium: true,
    description: 'Ежедневный гороскоп',
    limit: undefined
  },
  
  'weekly_horoscope': {
    free: false,
    premium: true,
    description: 'Недельный гороскоп',
  },
  
  'monthly_horoscope': {
    free: false,
    premium: true,
    description: 'Месячный гороскоп',
  },
  
  'transit_forecast': {
    free: false,
    premium: true,
    description: 'Прогноз транзитов',
  },
  
  // ==================== СИНАСТРИЯ ====================
  
  'synastry_brief': {
    free: true,
    premium: true,
    description: 'Краткая совместимость',
    limit: 3 // 3 проверки бесплатно
  },
  
  'synastry_full': {
    free: false,
    premium: true,
    description: 'Полный анализ совместимости',
  },
  
  // ==================== ЧАТЫ ====================
  
  'oracle_chat': {
    free: true,
    premium: true,
    description: 'Чат с Астрой (простые вопросы)',
    limit: 10 // 10 сообщений в день
  },
  
  'hook_chat': {
    free: false,
    premium: true,
    description: 'Глубокий разговор с контекстом карты',
  },
  
  // ==================== ПРОЧЕЕ ====================
  
  'regenerate_content': {
    free: true,
    premium: true,
    description: 'Перегенерация контента',
    limit: 3 // 3 перегенерации в неделю для free
  },
  
  'weather_widget': {
    free: true,
    premium: true,
    description: 'Виджет погоды',
  },
  
  'export_chart': {
    free: false,
    premium: true,
    description: 'Экспорт натальной карты в PDF',
  },
  
  'notifications': {
    free: false,
    premium: true,
    description: 'Уведомления о важных транзитах',
  }
};

/**
 * Проверка доступа к функции
 */
export function hasFeatureAccess(
  featureKey: string, 
  isPremium: boolean, 
  usageCount?: number
): {
  hasAccess: boolean;
  reason?: string;
  upgradePrompt?: string;
} {
  const feature = PREMIUM_FEATURES[featureKey];
  
  if (!feature) {
    console.warn(`[PremiumConfig] Unknown feature: ${featureKey}`);
    return { hasAccess: false, reason: 'Unknown feature' };
  }
  
  // Premium пользователи имеют доступ ко всему
  if (isPremium && feature.premium) {
    return { hasAccess: true };
  }
  
  // Бесплатные пользователи
  if (!isPremium) {
    if (!feature.free) {
      return {
        hasAccess: false,
        reason: 'premium_only',
        upgradePrompt: `${feature.description} доступен только с Premium подпиской`
      };
    }
    
    // Проверка лимита
    if (feature.limit !== undefined && usageCount !== undefined && usageCount >= feature.limit) {
      return {
        hasAccess: false,
        reason: 'limit_exceeded',
        upgradePrompt: `Вы достигли лимита для "${feature.description}". Обновитесь до Premium для неограниченного доступа`
      };
    }
    
    return { hasAccess: true };
  }
  
  return { hasAccess: false, reason: 'no_access' };
}

/**
 * Получить список всех премиум функций
 */
export function getPremiumFeaturesList(): Array<{
  key: string;
  description: string;
  freeLimit?: number;
}> {
  return Object.entries(PREMIUM_FEATURES)
    .filter(([_, feature]) => feature.premium && !feature.free)
    .map(([key, feature]) => ({
      key,
      description: feature.description,
      freeLimit: feature.limit
    }));
}

/**
 * Получить статистику использования для free пользователя
 */
export function getUsageStats(isPremium: boolean, usageCounts: Record<string, number>) {
  if (isPremium) {
    return { message: 'Premium: неограниченный доступ ко всем функциям' };
  }
  
  const stats: Record<string, any> = {};
  
  Object.entries(PREMIUM_FEATURES).forEach(([key, feature]) => {
    if (feature.free && feature.limit !== undefined) {
      const used = usageCounts[key] || 0;
      const remaining = Math.max(0, feature.limit - used);
      
      stats[key] = {
        description: feature.description,
        used,
        limit: feature.limit,
        remaining,
        percentage: Math.round((used / feature.limit) * 100)
      };
    }
  });
  
  return stats;
}

/**
 * Русские тексты для Paywall
 */
export const PREMIUM_TEXTS = {
  ru: {
    title: 'Откройте полный доступ к звёздам',
    subtitle: 'Получите глубокие знания о себе и своём пути',
    
    features: [
      'Полный разбор натальной карты (все 5 секций)',
      'Глубокий анализ любви и отношений',
      'Карьера и предназначение',
      'Кармическая задача',
      'Недельные и месячные гороскопы',
      'Безлимитный чат с Астрой',
      'Полная синастрия (совместимость)',
      'Неограниченные перегенерации',
      'Прогнозы транзитов',
      'Уведомления о важных событиях'
    ],
    
    price: '399 звёзд Telegram',
    
    cta: 'Получить Premium',
    
    guarantee: '7 дней гарантия возврата средств'
  },
  
  en: {
    title: 'Unlock Full Access to the Stars',
    subtitle: 'Get deep insights about yourself and your path',
    
    features: [
      'Full natal chart analysis (all 5 sections)',
      'Deep love & relationships analysis',
      'Career & life purpose',
      'Karmic mission',
      'Weekly & monthly horoscopes',
      'Unlimited Astra chat',
      'Full synastry (compatibility)',
      'Unlimited regenerations',
      'Transit forecasts',
      'Important event notifications'
    ],
    
    price: '399 Telegram Stars',
    
    cta: 'Get Premium',
    
    guarantee: '7-day money-back guarantee'
  }
};
