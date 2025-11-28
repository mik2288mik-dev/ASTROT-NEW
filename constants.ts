
import { Language } from "./types";

export const APP_NAME = "Astrot";

export const SYSTEM_INSTRUCTION_ASTRA = `
Ты — Астра, добрый и мудрый астролог, который говорит с человеком простым человеческим языком, без сложного астрологического жаргона.

Твои задачи:
– объяснять натальную карту, прогнозы и любые астрологические темы понятными словами, как близкий друг и проводник;
– давать человеку поддержку, вдохновение и реалистичные советы без запугивания и фатализма;
– говорить на «ты», мягко, уважительно, по-русски (или на английском, если пользователь выбрал English), в современном живом стиле;
– опираться на данные карты (положение планет, знаков, домов, аспекты), но не грузить техническими терминами. Если нужно упомянуть астрологию, переводи это на язык жизни: характер, привычки, эмоции, отношения, работа, выборы;
– не использовать сухие формулировки типа «Солнце в 10 доме в квадрате к Сатурну». Вместо этого говори, например: «по характеру ты…», «в работе тебе важно…», «в любви ты проявляешься так…»;
– избегать категоричных обещаний («точно будет», «гарантированно»), говори в формате тенденций и возможностей;
– не давать медицинских, юридических или финансовых диагнозов, только общие эмоциональные и жизненные рекомендации.

Во всех ответах:
– используй тёплый тон, небольшие метафоры, но без эзотерического перегруза;
– делай текст структурированным: короткие абзацы, списки, подзаголовки, если уместно;
– не повторяй дословно входные данные (знаки, градусы и т.п.), а интерпретируй их.
`;

export const TRANSLATIONS = {
  ru: {
    loading: "Космическая загрузка...",
    nav: {
      home: "Главная",
      chart: "Натальная карта",
      synastry: "Союз",
      oracle: "Оракул",
      settings: "Настройки"
    },
    hook: {
      analyzing: "Считываю звездную карту...",
      typing: "Астра печатает...",
      intro: "Приветствую, {name}. Я изучила твою карту...",
      done: "Это лишь 10% потенциала вашей натальной карты. Бесплатный расчет завершен.\n\nЧтобы раскрыть всю карту, получить персональный прогноз на день, месяц и узнать о кармических задачах, активируйте подписку.",
      cta_button: "Узнать больше",
      key1_title: "ТВОЯ ЭНЕРГИЯ",
      key2_title: "ТВОЙ СТИЛЬ ЛЮБВИ",
      key3_title: "ТВОЯ КАРЬЕРА"
    },
    paywall: {
      title: "ПРЕМИУМ АСТРОЛОГ",
      subtitle: "Ваша карта — это навигатор. Не идите вслепую.",
      feature1: "Мой Полный Анализ (Личность, Любовь, Карьера)",
      feature2: "Персональный Прогноз (День, Неделя, Месяц)",
      feature3: "База Знаний: Ваши Планеты",
      feature4: "Совместимость (Синастрия)",
      cta: "Открыть Доступ • 250 Stars",
      footer: "7 дней полного доступа"
    },
    dashboard: {
      welcome: "С возвращением,",
      passport: "Космический паспорт",
      element: "Стихия",
      ruler: "Управитель",
      menu_analysis: "Натальная карта",
      menu_forecast: "Мой Прогноз",
      menu_synastry: "Совместимость",
      menu_oracle: "Личный Оракул",
      moon_impact: "Луна Сегодня",
      daily_transit: "Транзит Дня",
      daily_advice: "Совет Дня",
      premium_badge: "PRO",
      solar_system_title: "База Знаний: Планеты",
      get_premium: "Купить Premium",
      evolution: "Эволюция Души",
      level: "Уровень",
      stats_intuition: "Интуиция",
      stats_confidence: "Уверенность",
      context_weather: "Погода за окном"
    },
    chart: {
      title: "Натальная карта",
      summary: "Портрет Личности",
      placements: "Полный Анализ",
      tap_to_learn: "Раскрыть",
      premium_lock: "Доступно в PRO",
      section_personality: "Личность и Судьба",
      section_love: "Любовь и Отношения",
      section_career: "Карьера и Финансы",
      section_weakness: "Слабые стороны и Зоны роста",
      section_karma: "Кармическая задача",
      forecast_title: "Персональный Прогноз",
      forecast_day: "На Сегодня",
      forecast_week: "На Неделю",
      forecast_month: "На Месяц"
    },
    synastry: {
      title: "Синастрия",
      desc: "Узнайте космическую совместимость с партнером.",
      partner_name: "Имя Партнера",
      calc_btn: "Рассчитать Совместимость",
      score: "Совместимость",
      emotional: "Эмоциональная связь",
      intellectual: "Интеллект и общение",
      challenge: "Кармический урок",
      input_title: "Данные Партнера"
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
      restore: "Восстановить",
      switch_lang: "Switch to English",
      save: "Сохранить",
      admin: "Админ Панель"
    },
    oracle: {
      placeholder: "Задай вопрос звездам...",
      intro: "Здравствуй. Я вижу твою карту. Что тревожит твою душу сегодня?"
    },
    planets: {
      sun: "Солнце", moon: "Луна", mercury: "Меркурий", venus: "Венера", 
      mars: "Марс", jupiter: "Юпитер", saturn: "Сатурн", earth: "Земля"
    }
  },
  en: {
    loading: "Cosmic Loading...",
    nav: {
      home: "Home",
      chart: "Natal Chart",
      synastry: "Synastry",
      oracle: "Oracle",
      settings: "Settings"
    },
    hook: {
      analyzing: "Reading the star map...",
      typing: "Astra is typing...",
      intro: "Greetings, {name}. I have studied your chart...",
      done: "This is only 10% of your chart's potential. Free calculation complete.\n\nTo reveal your full chart, get daily forecasts, and uncover karmic tasks, activate subscription.",
      cta_button: "Learn more",
      key1_title: "YOUR ENERGY",
      key2_title: "YOUR LOVE STYLE",
      key3_title: "YOUR CAREER"
    },
    paywall: {
      title: "PREMIUM ASTROLOGER",
      subtitle: "Your chart is a map. Don't walk blind.",
      feature1: "Full Analysis (Personality, Love, Career)",
      feature2: "Personal Forecasts (Day, Week, Month)",
      feature3: "Knowledge Base: Your Planets",
      feature4: "Compatibility (Synastry)",
      cta: "Unlock Access • 250 Stars",
      footer: "7 days full access"
    },
    dashboard: {
      welcome: "Welcome back,",
      passport: "Cosmic Passport",
      element: "Element",
      ruler: "Ruler",
      menu_analysis: "Natal Chart",
      menu_forecast: "My Forecast",
      menu_synastry: "Compatibility",
      menu_oracle: "Personal Oracle",
      moon_impact: "Moon Today",
      daily_transit: "Daily Transit",
      daily_advice: "Daily Advice",
      premium_badge: "PRO",
      solar_system_title: "Knowledge Base: Planets",
      get_premium: "Get Premium",
      evolution: "Soul Evolution",
      level: "Level",
      stats_intuition: "Intuition",
      stats_confidence: "Confidence",
      context_weather: "Weather outside"
    },
    chart: {
      title: "Natal Chart",
      summary: "Personality Portrait",
      placements: "Full Analysis",
      tap_to_learn: "Reveal",
      premium_lock: "Available in PRO",
      section_personality: "Personality & Fate",
      section_love: "Love & Relationships",
      section_career: "Career & Finance",
      section_weakness: "Weaknesses & Growth",
      section_karma: "Karmic Task",
      forecast_title: "Personal Forecast",
      forecast_day: "Today",
      forecast_week: "This Week",
      forecast_month: "This Month"
    },
    synastry: {
      title: "Synastry",
      desc: "Discover cosmic compatibility with a partner.",
      partner_name: "Partner Name",
      calc_btn: "Calculate Compatibility",
      score: "Compatibility",
      emotional: "Emotional Bond",
      intellectual: "Intellectual Bond",
      challenge: "Karmic Challenge",
      input_title: "Partner Details"
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
      save: "Save Changes",
      admin: "Admin Panel"
    },
    oracle: {
      placeholder: "Ask the stars...",
      intro: "Greetings. I see your chart. What weighs on your soul today?"
    },
    planets: {
      sun: "Sun", moon: "Moon", mercury: "Mercury", venus: "Venus", 
      mars: "Mars", jupiter: "Jupiter", saturn: "Saturn", earth: "Earth"
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
