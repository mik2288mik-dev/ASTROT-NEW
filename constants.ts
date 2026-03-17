
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
      tagline: "Больше глубины в твоей карте",
      subtitle: "Открой второй слой чтения: больше смысла, больше контекста, больше личной глубины.",
      feature_oracle: "Личное guidance",
      feature_oracle_desc: "Oracle и прогнозы, которые продолжают чтение карты, а не живут отдельно.",
      feature_forecast: "Прогнозы с контекстом",
      feature_forecast_desc: "День, неделя и месяц через призму твоей натальной карты.",
      feature_deep: "Все темы Deep Dive",
      feature_deep_desc: "Любовь, карьера, вызовы и кармические уроки как отдельный слой анализа.",
      feature_passport: "Полное натальное чтение",
      feature_passport_desc: "Больше деталей по ключевым паттернам, планетам и внутренним противоречиям.",
      cta: "Открыть 1 неделю • 250 Stars"
    },
    paywall: {
      title: "Lumia Premium",
      subtitle: "Бесплатный слой уже открыт. Lumia Premium раскрывает любовь, карьеру, рост и более глубокую интерпретацию карты.",
      feature1: "Deep Dive: Любовь, Карьера, Вызовы и Карма",
      feature2: "Более полное натальное чтение по главным паттернам карты",
      feature3: "Более глубокая совместимость в Synastry",
      feature4: "Oracle и прогнозы как личное продолжение разбора",
      cta: "Открыть Lumia Premium • 250 Stars",
      footer: "7 дней полной глубины Lumia"
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
      my_charts_subtitle: "Управление картами и слотами",
      charts_overview_title: "Сохранённые карты",
      charts_overview_hint: "Сохранённые карты можно быстро использовать в синастрии и других сценариях Lumia.",
      charts_overview_cta: "Открыть карты"
    },
    chart: {
      title: "Твоя Натальная Карта",
      summary: "Твоё чтение",
      deeper: "Deep Dive",
      loading_wisdom: "Загружаю космическую мудрость...",
      unlock_full: "Открыть Deep Dive с Lumia Premium",
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
      free_layer_label: "Бесплатный слой",
      core_title: "Опорная карта",
      core_body: "Солнце, Луна и Асцендент дают первый ясный слой понимания — как ты проявляешься, чувствуешь и входишь в мир.",
      deeper_intro: "Deep Dive — это второй слой чтения. Сначала ты видишь основу, затем раскрываешь более точные темы жизни.",
      deeper_free_label: "В бесплатном чтении",
      deeper_free_body: "Один открытый Deep Dive показывает, как Lumia читает твою карту глубже, но без перегруза.",
      deeper_premium_label: "С Lumia Premium",
      deeper_premium_body: "Любовь, карьера, вызовы и кармические уроки становятся отдельными глубокими темами вместо одного общего портрета.",
      topic_free_included: "Включено",
      topic_premium_badge: "Premium",
      topic_personality_teaser: "Какой внутренний ритм стоит за твоим характером, реакциями и способом проживать жизнь.",
      topic_love_teaser: "Как ты сближаешься, чего ждёшь от связи и где рождается настоящая близость.",
      topic_career_teaser: "Как карта показывает твой способ реализовываться, выбирать направление и удерживать смысл.",
      topic_weakness_teaser: "Где карта указывает на уязвимости, повторяющиеся паттерны и точки роста.",
      topic_karma_teaser: "Какие уроки тянут тебя в зрелость и какие темы карта возвращает снова и снова.",
      premium_value_title: "Lumia Premium открывает следующий слой",
      premium_value_body: "Не просто больше текста, а более точные темы, в которых карта начинает говорить про любовь, реализацию, вызовы и кармический вектор отдельно.",
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
      loading: "Загрузка карт...",
      value_title: "Карты в Lumia — это не просто список.",
      value_body: "Сохранённые карты можно быстро открывать, сравнивать в синастрии и использовать без повторного ввода данных.",
      primary_role: "Ваша базовая карта для Lumia",
      saved_role: "Сохранённая карта для совместимости и сравнений",
      use_in_synastry: "В синастрию",
      slots_full_title: "Слоты заполнены",
      slots_full_body: "Ещё один слот нужен, чтобы сохранить карту партнёра и быстро возвращаться к синастрии.",
      slots_need_more_lumi: "Не хватает Lumi для нового слота.",
      empty_title: "Начните со своей карты",
      empty_body: "Когда здесь появятся карты партнёра, их можно будет использовать в синастрии без повторного ввода.",
      single_chart_body: "Ещё одна сохранённая карта откроет быстрое сравнение в синастрии."
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
      loading: "Считываем звездную совместимость...",
      primary_title: "Ваша сторона",
      partner_title: "Партнёр",
      primary_hint: "В синастрии всегда используется текущая primary карта.",
      selected_saved: "Сохранённая карта",
      selected_manual: "Ручной ввод",
      no_saved_title: "Нет карт партнёра",
      no_saved_body: "Сохраните ещё одну карту в My Charts, чтобы запускать синастрию без повторного ввода данных.",
      open_charts: "Открыть My Charts",
      buy_slot: "Купить слот",
      change_partner: "Сменить партнёра",
      compare_again: "Сравнить другую карту",
      result_saved_badge: "Из сохранённой карты",
      result_manual_badge: "Ручной ввод",
      saved_first_hint: "Лучше выбирать сохранённую карту: так пару можно открывать повторно без нового ввода.",
      manual_hint: "Ручной ввод подойдёт для разовой проверки, если карта ещё не сохранена."
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
      tagline: "More depth in your chart",
      subtitle: "Unlock the second layer of interpretation: more meaning, more context, more personal depth.",
      feature_oracle: "Guidance with context",
      feature_oracle_desc: "Oracle and forecasts that continue your chart reading instead of feeling separate.",
      feature_forecast: "Forecasts with context",
      feature_forecast_desc: "Day, week, and month through the lens of your natal chart.",
      feature_deep: "All Deep Dive themes",
      feature_deep_desc: "Love, career, challenges, and karmic lessons as distinct interpretation layers.",
      feature_passport: "Full natal reading",
      feature_passport_desc: "More detail on core patterns, planetary dynamics, and inner tensions.",
      cta: "Unlock 1 Week • 250 Stars"
    },
    paywall: {
      title: "Lumia Premium",
      subtitle: "Your free layer is already open. Lumia Premium reveals love, career, growth, and a deeper interpretation of your chart.",
      feature1: "Deep Dive: Love, Career, Challenges, and Karma",
      feature2: "A fuller natal reading built around your chart’s main patterns",
      feature3: "A richer compatibility layer in Synastry",
      feature4: "Oracle and forecasts as a personal continuation of the reading",
      cta: "Unlock Lumia Premium • 250 Stars",
      footer: "7 days of full Lumia depth"
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
      my_charts_subtitle: "Manage charts & slots",
      charts_overview_title: "Saved charts",
      charts_overview_hint: "Saved charts can be reused in Synastry and future Lumia flows.",
      charts_overview_cta: "Open charts"
    },
    chart: {
      title: "Natal Chart",
      summary: "Your Reading",
      deeper: "Deep Dive",
      loading_wisdom: "Loading cosmic wisdom...",
      unlock_full: "Unlock Deep Dive with Lumia Premium",
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
      free_layer_label: "Free layer",
      core_title: "Core Chart",
      core_body: "Sun, Moon, and Rising give the first clear layer of understanding — how you show up, feel, and meet the world.",
      deeper_intro: "Deep Dive is the second layer of interpretation. First you see the foundation, then you open the life themes in more depth.",
      deeper_free_label: "Included in free reading",
      deeper_free_body: "One open Deep Dive topic shows how Lumia reads your chart more deeply without overwhelming the first experience.",
      deeper_premium_label: "With Lumia Premium",
      deeper_premium_body: "Love, career, challenges, and karmic lessons become distinct themes instead of one general portrait.",
      topic_free_included: "Included",
      topic_premium_badge: "Premium",
      topic_personality_teaser: "See the inner rhythm behind your character, reactions, and the way you move through life.",
      topic_love_teaser: "Understand how you bond, what closeness means to you, and where intimacy becomes real.",
      topic_career_teaser: "See how your chart points to direction, motivation, and the kind of work that feels meaningful.",
      topic_weakness_teaser: "Find where your chart shows repeating patterns, pressure points, and real growth edges.",
      topic_karma_teaser: "See which lessons keep returning and what kind of maturity your chart is pushing you toward.",
      premium_value_title: "Lumia Premium opens the next layer",
      premium_value_body: "Not just more text, but more precise themes where your chart starts speaking separately about love, purpose, challenges, and karmic direction.",
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
      loading: "Loading charts...",
      value_title: "Saved charts are reusable assets in Lumia.",
      value_body: "Open them anytime, reuse them in Synastry, and stop re-entering partner birth data.",
      primary_role: "Your base chart in Lumia",
      saved_role: "Reusable chart for compatibility and comparisons",
      use_in_synastry: "Use in Synastry",
      slots_full_title: "Your slots are full",
      slots_full_body: "One more slot lets you save another partner chart and return to Synastry faster.",
      slots_need_more_lumi: "You need more Lumi to unlock another slot.",
      empty_title: "Start with your chart",
      empty_body: "When partner charts are saved here, they can be reused in Synastry without retyping the data.",
      single_chart_body: "One more saved chart unlocks faster Synastry comparisons."
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
      loading: "Reading star compatibility...",
      primary_title: "You",
      partner_title: "Partner",
      primary_hint: "Synastry always uses your current primary chart on your side.",
      selected_saved: "Saved chart",
      selected_manual: "Manual input",
      no_saved_title: "No partner charts saved yet",
      no_saved_body: "Save another chart in My Charts to compare again without re-entering partner details.",
      open_charts: "Open My Charts",
      buy_slot: "Buy slot",
      change_partner: "Change partner",
      compare_again: "Compare another chart",
      result_saved_badge: "From saved chart",
      result_manual_badge: "Manual input",
      saved_first_hint: "Saved charts are the fastest way to reopen Synastry later.",
      manual_hint: "Manual input is best for one-off comparisons."
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
