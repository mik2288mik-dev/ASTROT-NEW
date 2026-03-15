
import { Language } from "./types";

export const APP_NAME = "Lumia";

/**
 * Lumia Oracle Chat — системная инструкция для чата с Астрой.
 * Тон согласован с Lumia: тёплый, умный, личный, без кринжа.
 */
export const SYSTEM_INSTRUCTION_ASTRA = `
Ты — Lumia: современный умный астролог, который переводит карту в ясный, личный язык. Ты отвечаешь в чате как добрый друг-эксперт.

Тон: тёплый, умный, личный, эмоционально резонирующий. Не холодный, не роботизированный, не псевдо-духовная чепуха.
Обращайся на «ты». Пиши коротко и по делу. Не запугивай, не предсказывай ужасов.
Не говори «ты должен/обязан» — используй «можно попробовать», «может быть полезно».
Используй 1–3 иконки (не эмодзи), не перегружай.

Задачи:
– объяснять натальную карту и астрологические темы понятными словами;
– давать поддержку и реалистичные советы без фатализма;
– опираться на данные карты, но переводить на язык жизни: характер, привычки, эмоции, отношения, работа;
– не использовать сухие формулировки («Солнце в 10 доме»). Говори: «по характеру ты…», «в работе тебе важно…»;
– избегать категоричных обещаний; говорить в формате тенденций и возможностей;
– не давать медицинских, юридических или финансовых диагнозов.

Структура: короткие абзацы, списки. Не повторять знаки и градусы дословно — интерпретировать.
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
      typing: "Lumia печатает...",
      intro: "Приветствую, {name}. Я изучила твою карту...",
      done: "Это лишь 10% потенциала вашей натальной карты. Бесплатный расчет завершен.\n\nЧтобы раскрыть всю карту, получить персональный прогноз на день, месяц и узнать о кармических задачах, активируйте подписку.",
      cta_button: "Узнать больше"
    },
    premium_preview: {
      title: "Lumia Premium",
      tagline: "Раскрой звёзды",
      feature_oracle: "Оракул",
      feature_oracle_desc: "Безлимитные диалоги с Lumia.",
      feature_forecast: "Прогноз",
      feature_forecast_desc: "Персональные транзиты и влияние Луны.",
      feature_deep: "Глубокие разборы",
      feature_deep_desc: "Интерактивный анализ Любви и Карьеры.",
      feature_passport: "Космический паспорт",
      feature_passport_desc: "Полный разбор планет и аспектов.",
      cta: "Открыть 1 неделю • 250 Stars"
    },
    paywall: {
      title: "Lumia Premium",
      subtitle: "Ваша карта — навигатор. Раскройте её полностью.",
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
      context_weather: "Погода за окном",
      horoscope_today: "Гороскоп на сегодня",
      forecast_date: "Дата прогноза",
      mood: "Настроение",
      color: "Цвет",
      special_day: "Сегодня тебя ждёт особенный день",
      detailed_forecast: "Подробный прогноз →",
      horoscope_footer: "Гороскоп по вашим планетам и данным рождения",
      chart_subtitle: "Личность, судьба, карма и прогнозы",
      synastry_subtitle: "Совместимость",
      synastry_free: "Бесплатный тизер",
      oracle_subtitle: "Спроси у Lumia",
      loading_weather: "Загрузка погоды...",
      set_city_hint: "Укажите город в настройках для отображения погоды",
      tap_settings: "Нажмите, чтобы открыть настройки →",
      my_charts: "Мои карты",
      my_charts_subtitle: "Управление картами и слотами"
    },
    chart: {
      title: "Твоя Натальная Карта",
      summary: "Портрет Личности",
      deeper: "Глубже в тебя",
      loading_wisdom: "Загружаю космическую мудрость...",
      unlock_full: "✨ Открыть полный анализ",
      greeting: "Привет",
      friend: "друг",
      soul_connector: "с душой",
      soul_suffix: "",
      chart_legend: "Солнце — твоя основа и характер, Луна — эмоции и привычки, Асцендент — первое впечатление и стиль поведения.",
      loading_intro: "Твоя натальная карта",
      placements: "Полный Анализ",
      tap_to_learn: "Раскрыть",
      premium_lock: "PRO",
      section_personality: "Личность и Характер",
      section_love: "Любовь и Отношения",
      section_career: "Карьера и Самореализация",
      section_weakness: "Зоны Роста и Вызовы",
      section_karma: "Кармическая Задача",
      forecast_title: "Персональный Прогноз",
      forecast_day: "На Сегодня",
      forecast_week: "На Неделю",
      forecast_month: "На Месяц",
      free_teaser_title: "Космический Паспорт"
    },
    charts: {
      title: "Мои карты",
      slots: "Слотов",
      slots_used: "карт",
      no_charts: "Пока нет сохранённых карт.",
      add_chart: "Добавить карту",
      buy_slot: "Купить слот за",
      buy_slot_lumi: "Lumi",
      limit_reached: "Достигнут лимит карт. Купите слот за Lumi.",
      balance: "Баланс",
      purchasing: "Покупка...",
      loading: "Загрузка карт..."
    },
    synastry: {
      title: "Синастрия",
      desc: "Узнайте космическую совместимость с партнером.",
      partner_from_manual: "Ввести вручную",
      partner_from_charts: "Выбрать из моих карт",
      optional_more: "Дополнительно (для более точного анализа)",
      partner_name: "Имя Партнера",
      calc_btn: "Рассчитать Совместимость",
      score: "Совместимость",
      emotional: "Эмоциональная связь",
      intellectual: "Интеллект и общение",
      challenge: "Кармический урок",
      input_title: "Данные Партнера",
      brief_btn: "Краткий обзор (Бесплатно)",
      full_btn: "Глубокий разбор (Премиум)",
      loading: "Считываем звездную совместимость..."
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
      plan_pro: "Lumia Premium активна",
      plan_basic: "Базовый план",
      plan_active: "Активна",
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
    },
    zodiac: {
      Aries: "Овен",
      Taurus: "Телец",
      Gemini: "Близнецы",
      Cancer: "Рак",
      Leo: "Лев",
      Virgo: "Дева",
      Libra: "Весы",
      Scorpio: "Скорпион",
      Sagittarius: "Стрелец",
      Capricorn: "Козерог",
      Aquarius: "Водолей",
      Pisces: "Рыбы"
    },
    elements: {
      Fire: "Огонь",
      Water: "Вода",
      Air: "Воздух",
      Earth: "Земля"
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
      typing: "Lumia is typing...",
      intro: "Greetings, {name}. I have studied your chart...",
      done: "This is only 10% of your chart's potential. Free calculation complete.\n\nTo reveal your full chart, get daily forecasts, and uncover karmic tasks, activate subscription.",
      cta_button: "Learn more"
    },
    premium_preview: {
      title: "Lumia Premium",
      tagline: "Unlock the Stars",
      feature_oracle: "Oracle Chat",
      feature_oracle_desc: "Unlimited AI conversations with Lumia.",
      feature_forecast: "Daily Forecast",
      feature_forecast_desc: "Personal transits & Moon impact.",
      feature_deep: "Deep Dives",
      feature_deep_desc: "Interactive analysis of Love & Career.",
      feature_passport: "Cosmic Passport",
      feature_passport_desc: "Full planetary breakdown & aspects.",
      cta: "Unlock 1 Week • 250 Stars"
    },
    paywall: {
      title: "Lumia Premium",
      subtitle: "Your chart is a map. Unlock it fully.",
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
      context_weather: "Weather outside",
      horoscope_today: "Today's Horoscope",
      forecast_date: "Forecast date",
      mood: "Mood",
      color: "Color",
      special_day: "A special day awaits you",
      detailed_forecast: "Detailed forecast →",
      horoscope_footer: "Horoscope from your planets and birth data",
      chart_subtitle: "Personality, Fate, Karma & Forecasts",
      synastry_subtitle: "Check compatibility",
      synastry_free: "Free preview",
      oracle_subtitle: "Ask Lumia anything",
      loading_weather: "Loading weather...",
      set_city_hint: "Set city in settings to see weather",
      tap_settings: "Tap to open settings →",
      my_charts: "My Charts",
      my_charts_subtitle: "Manage charts & slots"
    },
    chart: {
      title: "Natal Chart",
      summary: "Personality Portrait",
      deeper: "Deeper Into You",
      loading_wisdom: "Loading cosmic wisdom...",
      unlock_full: "✨ Unlock Full Analysis",
      greeting: "Hey",
      friend: "friend",
      soul_connector: "with a",
      soul_suffix: " soul",
      chart_legend: "Sun = your core, Moon = emotions and habits, Rising = first impression and style.",
      loading_intro: "Your natal chart",
      placements: "Full Analysis",
      tap_to_learn: "Reveal",
      premium_lock: "PRO",
      section_personality: "Personality & Character",
      section_love: "Love & Relationships",
      section_career: "Career & Self-Realization",
      section_weakness: "Growth Areas & Challenges",
      section_karma: "Karmic Mission",
      forecast_title: "Personal Forecast",
      forecast_day: "Today",
      forecast_week: "This Week",
      forecast_month: "This Month",
      free_teaser_title: "Cosmic Passport"
    },
    charts: {
      title: "My Charts",
      slots: "Slots",
      slots_used: "charts",
      no_charts: "No saved charts yet.",
      add_chart: "Add chart",
      buy_slot: "Buy slot for",
      buy_slot_lumi: "Lumi",
      limit_reached: "Chart limit reached. Buy a slot with Lumi.",
      balance: "Balance",
      purchasing: "Purchasing...",
      loading: "Loading charts..."
    },
    synastry: {
      title: "Synastry",
      desc: "Discover cosmic compatibility with a partner.",
      partner_from_manual: "Enter manually",
      partner_from_charts: "Select from my charts",
      optional_more: "Optional (for more accurate analysis)",
      partner_name: "Partner Name",
      calc_btn: "Calculate Compatibility",
      score: "Compatibility",
      emotional: "Emotional Bond",
      intellectual: "Intellectual Bond",
      challenge: "Karmic Challenge",
      input_title: "Partner Details",
      brief_btn: "Brief Overview (Free)",
      full_btn: "Deep Analysis (Premium)",
      loading: "Reading star compatibility..."
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
      plan_pro: "Lumia Premium active",
      plan_basic: "Basic plan",
      plan_active: "Active",
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
    },
    zodiac: {
      Aries: "Aries",
      Taurus: "Taurus",
      Gemini: "Gemini",
      Cancer: "Cancer",
      Leo: "Leo",
      Virgo: "Virgo",
      Libra: "Libra",
      Scorpio: "Scorpio",
      Sagittarius: "Sagittarius",
      Capricorn: "Capricorn",
      Aquarius: "Aquarius",
      Pisces: "Pisces"
    },
    elements: {
      Fire: "Fire",
      Water: "Water",
      Air: "Air",
      Earth: "Earth"
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

export const getZodiacSign = (lang: Language, sign: string): string => {
  const zodiacTranslations = TRANSLATIONS[lang].zodiac as Record<string, string>;
  return zodiacTranslations[sign] || sign;
};

export const getElement = (lang: Language, element: string): string => {
  const elementTranslations = TRANSLATIONS[lang].elements as Record<string, string>;
  return elementTranslations[element] || element;
};
