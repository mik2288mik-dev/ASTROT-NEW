
import { Language } from "./types";

export const APP_NAME = "Astrot";

export const SYSTEM_INSTRUCTION_ASTRA = `
You are Astra, a high-end, professional, and deeply spiritual astrologer.
Your tone is "Vogue meets Mysticism" — elegant, concise, strict but soulful.
You are NOT a generic bot. You are a personal astrological consultant using specific Natal Chart data.

CRITICAL RULES:
1. STRICTLY LIMIT your scope to Astrology, Natal Charts, Transits, and Spiritual Psychology.
2. If the user asks about non-astrological topics (recipes, politics, code, small talk), POLITELY IGNORE and steer back to their chart.
3. ALWAYS be personalized. Never say "Pisces are usually...", say "With your Pisces Sun and Aries Moon...".
4. Response style: Clean, modern, avoiding emojis unless strictly necessary for structure.
5. Language: Strictly adhere to the requested language (Russian or English).
`;

export const TRANSLATIONS = {
  ru: {
    loading: "Космическая загрузка...",
    tabs: {
      daily: "СЕГОДНЯ",
      weekly: "НЕДЕЛЯ",
      monthly: "МЕСЯЦ",
    },
    nav: {
      today: "Главная",
      chart: "Карта",
      oracle: "Оракул",
      settings: "Настройки"
    },
    dashboard: {
      premium_badge: "PRO",
      free_badge: "BASIC",
      locked_title: "Доступно в PRO",
      locked_desc: "Глубокие транзиты, лунный календарь и детальный прогноз.",
      get_premium: "Открыть доступ (Stars)",
      cosmic_vibe: "Энергия дня",
      color: "Цвет",
      number: "Число",
      transit: "Аспект дня",
      moon_impact: "Влияние Луны",
      big_three: "Ваша Триада",
      explore_system: "Орбиты",
      solar_system_title: "МАКРОКОСМОС",
      passport: "Космический паспорт",
      element: "Стихия",
      ruler: "Управитель"
    },
    chart: {
      title: "Натальная Карта",
      summary: "Суть Личности",
      placements: "Планеты",
      deep_dive: "Глубокий анализ",
      tap_to_analyze: "Анализ аспекта",
      premium_lock: "Детальный разбор в PRO",
    },
    settings: {
      title: "Настройки",
      profile: "Профиль",
      language: "Язык",
      theme: "Оформление",
      theme_dark: "Полночь",
      theme_light: "Латте",
      edit: "Редактировать",
      subscription: "Подписка",
      restore: "Восстановить покупки",
      switch_lang: "Switch to English",
      save: "Сохранить"
    },
    oracle: {
      placeholder: "Задай вопрос звездам...",
      intro: "Здравствуй. Карта открыта. О чем поведают звезды сегодня?"
    },
    planets: {
      sun: "Солнце: Эго и жизненная сила",
      moon: "Луна: Эмоции и подсознание",
      mercury: "Меркурий: Интеллект и связь",
      venus: "Венера: Любовь и ценности",
      mars: "Марс: Действие и воля",
      jupiter: "Юпитер: Удача и расширение",
      saturn: "Сатурн: Уроки и дисциплина",
      earth: "Земля: Материальный мир"
    }
  },
  en: {
    loading: "Cosmic Loading...",
    tabs: {
      daily: "TODAY",
      weekly: "WEEKLY",
      monthly: "MONTHLY",
    },
    nav: {
      today: "Home",
      chart: "Chart",
      oracle: "Oracle",
      settings: "Settings"
    },
    dashboard: {
      premium_badge: "PRO",
      free_badge: "BASIC",
      locked_title: "PRO Feature",
      locked_desc: "Unlock deep transits, moon cycles, and detailed forecasts.",
      get_premium: "Unlock (Stars)",
      cosmic_vibe: "Daily Vibe",
      color: "Power Color",
      number: "Number",
      transit: "Daily Transit",
      moon_impact: "Moon Impact",
      big_three: "Big Three",
      explore_system: "Orbits",
      solar_system_title: "MACROCOSM",
      passport: "Cosmic Passport",
      element: "Element",
      ruler: "Ruler"
    },
    chart: {
      title: "Natal Chart",
      summary: "Core Essence",
      placements: "Placements",
      deep_dive: "Deep Dive",
      tap_to_analyze: "Analyze Aspect",
      premium_lock: "Detailed analysis in PRO",
    },
    settings: {
      title: "Settings",
      profile: "Profile",
      language: "Language",
      theme: "Theme",
      theme_dark: "Midnight",
      theme_light: "Latte",
      edit: "Edit Profile",
      subscription: "Subscription",
      restore: "Restore",
      switch_lang: "Переключить на Русский",
      save: "Save Changes"
    },
    oracle: {
      placeholder: "Ask the stars...",
      intro: "Greetings. Your chart is open before me. What destiny shall we explore?"
    },
    planets: {
      sun: "Sun: Ego & Will",
      moon: "Moon: Soul & Emotion",
      mercury: "Mercury: Intellect",
      venus: "Venus: Love & Taste",
      mars: "Mars: Action",
      jupiter: "Jupiter: Luck",
      saturn: "Saturn: Structure",
      earth: "Earth: Material World"
    }
  }
};

export const getText = (lang: Language, key: string) => {
   const keys = key.split('.');
   let current: any = TRANSLATIONS[lang];
   for (const k of keys) {
       if (current[k] === undefined) return key;
       current = current[k];
   }
   return current;
};
