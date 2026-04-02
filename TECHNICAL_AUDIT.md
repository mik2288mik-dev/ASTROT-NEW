# Lumia (ASTROT-NEW) — Technical Audit Report

> **Примечание:** Проект исторически назывался Astrot. Целевое название — Lumia. В коде и константах встречается "Astrot".

---

## 1. PROJECT OVERVIEW

| Параметр | Значение |
|----------|----------|
| **Тип** | Telegram Mini App |
| **Стек** | Next.js 15, React 19, TypeScript, Tailwind CSS |
| **БД** | PostgreSQL (Railway) |
| **Деплой** | Railway, Docker |
| **Пакет** | `copy-of-astrot---soulful-astrology` |

**Ключевые зависимости:**
- `swisseph-v2` — расчёт натальной карты (Swiss Ephemeris)
- `openai` — AI-генерация контента (Astra)
- `pg` — PostgreSQL
- `framer-motion` — анимации
- `date-fns-tz`, `tz-lookup` — часовые пояса

**Архитектура:** SPA внутри Next.js. Один `App.tsx` управляет view state. API routes на сервере. Без localStorage — всё через API и БД.

---

## 2. FOLDER STRUCTURE

```
ASTROT-NEW/
├── App.tsx                 # Главный компонент, view state, навигация
├── types.ts                # TypeScript типы
├── constants.ts            # Переводы (ru/en), APP_NAME, SYSTEM_INSTRUCTION_ASTRA
├── package.json
├── tailwind.config.js
├── next.config.js
│
├── pages/
│   ├── index.tsx           # Рендер App
│   ├── _app.tsx            # Next.js app wrapper
│   ├── _document.tsx       # HTML document
│   └── api/                # REST API
│       ├── users/          # GET/POST профиль
│       ├── charts/         # GET/POST карта (legacy)
│       ├── astrology/     # Натальная карта, гороскопы, синастрия, чат
│       ├── weather/       # Погода
│       ├── telegram/      # Stars payment
│       ├── subscriptions/ # Premium
│       └── health.ts
│
├── views/                  # Экраны приложения
├── components/             # UI компоненты
│   ├── Dashboard/         # CosmicPassport, WeatherWidget, SoulEvolution
│   ├── Horoscope/        # ZodiacHeader, HoroscopeContent
│   ├── NatalChart/       # DeepDiveSection, AnalysisModal
│   └── ui/               # Loading
│
├── services/               # Бизнес-логика, API-клиенты
├── lib/                    # Утилиты, БД, астрология
├── styles/
│   └── globals.css
├── __tests__/
├── scripts/
│   └── migrate.ts
└── types/                  # .d.ts для swisseph, tz-lookup, assets
```

---

## 3. NAVIGATION FLOW

**ViewState** (`types.ts`):
```
'onboarding' | 'hook' | 'paywall' | 'dashboard' | 'chart' | 
'horoscope' | 'synastry' | 'oracle' | 'settings' | 'admin'
```

**Схема навигации:**

```
[Загрузка]
    │
    ├─ Нет tgId ──────────────────────────► STOP (onboarding не показывается)
    │
    ├─ Нет профиля / !isSetup ─────────────► onboarding
    │
    └─ Профиль есть
           │
           ├─ Загрузка карты (chartService)
           │      ├─ Успех ───────────────► dashboard
           │      └─ Ошибка/нет данных ──► onboarding
           │
[onboarding] ─ onComplete ─────────────────► hook
[hook] ─ onComplete ───────────────────────► dashboard

[dashboard] ─ onNavigate ─► chart | horoscope | synastry | oracle
[oracle] (без Premium) ────────────────────► paywall
[paywall] ─ onClose/onPurchase ────────────► dashboard

[chart|horoscope|synastry|oracle|settings] ─ handleBack ─► dashboard
[admin] ─ handleBack ─────────────────────► settings
```

**Свайп назад:** Включён для chart, horoscope, synastry, oracle, settings, admin. Отключён для dashboard, onboarding, hook, paywall.

---

## 4. SCREENS

| View | Файл | Назначение |
|------|------|------------|
| **onboarding** | `Onboarding.tsx` | Ввод имени, даты/времени/места рождения. Создание профиля. |
| **hook** | `HookChat.tsx` | Пост-онбординг: natal intro от Astra, CTA к Premium. |
| **paywall** | `Paywall.tsx` | Paywall Premium (250 Stars, 7 дней). |
| **dashboard** | `Dashboard.tsx` | Хаб: CosmicPassport, WeatherWidget, карточки навигации. |
| **chart** | `NatalChart.tsx` | Натальная карта, Deep Dive (premium). |
| **horoscope** | `Horoscope.tsx` | Дневной/недельный/месячный гороскоп. |
| **synastry** | `Synastry.tsx` | Совместимость (brief free, full premium). |
| **oracle** | `OracleChat.tsx` | AI-чат с Astra (premium). |
| **settings** | `Settings.tsx` | Язык, тема, город погоды, Premium, Admin. |
| **admin** | `AdminPanel.tsx` | Админ: пользователи, Premium, статистика. |

---

## 5. COMPONENTS

| Компонент | Путь | Назначение |
|-----------|------|------------|
| **Header** | `Header.tsx` | Заголовок, кнопка «Назад», заголовок по view. |
| **BackgroundLayers** | `BackgroundLayers.tsx` | Фоны и оверлеи по view/theme/context. |
| **SolarSystem** | `SolarSystem.tsx` | Визуализация планет. |
| **TextCard** | `TextCard.tsx` | Универсальная текстовая карточка. |
| **PremiumPreview** | `PremiumPreview.tsx` | Модальное окно Premium. |
| **RegenerateButton** | `RegenerateButton.tsx` | Регенерация контента (premium, Stars). |
| **Loading** | `ui/Loading.tsx` | Индикатор загрузки с прогрессом. |
| **CosmicPassport** | `Dashboard/CosmicPassport.tsx` | Sun/Moon/Rising, элемент, управитель. |
| **WeatherWidget** | `Dashboard/WeatherWidget.tsx` | Погода, фаза луны. |
| **SoulEvolution** | `Dashboard/SoulEvolution.tsx` | Уровень, интуиция, уверенность. |
| **ZodiacHeader** | `Horoscope/ZodiacHeader.tsx` | Заголовок гороскопа. |
| **HoroscopeContent** | `Horoscope/HoroscopeContent.tsx` | Контент гороскопа. |
| **DeepDiveSection** | `NatalChart/DeepDiveSection.tsx` | Секция Deep Dive с premium lock. |
| **AnalysisModal** | `NatalChart/AnalysisModal.tsx` | Модальное окно анализа. |

---

## 6. SERVICES

| Сервис | Файл | Назначение |
|--------|------|------------|
| **storageService** | `storageService.ts` | `getProfile()`, `saveProfile()` через `/api/users`. |
| **chartService** | `chartService.ts` | `getOrCalculateChart()` — GET charts, при 404 — POST natal-chart. |
| **contentGenerationService** | `contentGenerationService.ts` | `generateAllContent()`, `getOrGenerateHoroscope()`, `getOrGenerateDeepDive()`, `updateContentIfNeeded()`. |
| **astrologyService** | `astrologyService.ts` | Клиент API: natal chart, natal intro, horoscopes, synastry, deep dive, chat. |
| **telegramService** | `telegramService.ts` | `requestStarsPayment()` — Telegram Stars popup (250 Stars). |
| **weatherService** | `weatherService.ts` | `getTodayWeather()`, `getWeatherSettings()`, `saveWeatherCity()`. |

---

## 7. ASTROLOGY MODULES

| Модуль | Путь | Назначение |
|--------|------|------------|
| **swisseph-calculator** | `lib/swisseph-calculator.ts` | Swiss Ephemeris: `calculateNatalChart()`, планеты, дома, timezone (tz-lookup). |
| **transits-calculator** | `lib/transits-calculator.ts` | `getCurrentTransits()`, фаза луны, транзиты. |
| **zodiac-utils** | `lib/zodiac-utils.ts` | Знаки, элементы, управители, `getApproximateSunSignByDate()`. |
| **prompts** | `lib/prompts.ts` | Промпты для natal intro, Deep Dive, synastry, horoscopes. |
| **cosmic-jokes** | `lib/cosmic-jokes.ts` | Шутки по знаку зодиака (RU/EN). |
| **descriptions** | `lib/descriptions.ts` | Краткие описания Sun/Moon/Ascendant по знакам (если есть). |

**API astrology:**
- `natal-chart` — расчёт натальной карты (идемпотентный)
- `natal-intro` — вступление натальной карты
- `daily-horoscope`, `weekly-horoscope`, `monthly-horoscope`
- `deep-dive` — Deep Dive анализ
- `synastry-brief`, `synastry-full`
- `chat` — Oracle (Astra)
- `regenerate` — регенерация за Stars
- `transit-forecast`

---

## 8. USER DATA

**Хранение:** PostgreSQL, без localStorage.

**Таблицы (migrations):**
- `users` — профиль (id, name, birth_*, is_setup, language, theme, is_premium, generated_content, weather_city, evolution, premium_*)
- `charts` — натальная карта (user_id PK, chart_data JSONB, input_hash)
- `user_settings` — weather_city
- `synastry_cache` — кэш синастрий
- `forecasts_cache` — кэш прогнозов
- `regenerations` — учёт регенераций
- `daily_horoscopes_cache` — гороскопы по знаку и дате
- `deep_dive_analyses` — Deep Dive
- `daily_horoscope` — персональный дневной гороскоп

**Профиль (UserProfile):**
- id, name, birthDate, birthTime, birthPlace, isSetup
- language, theme, isPremium, isAdmin
- evolution, generatedContent, weatherCity, lumiBalance

**Карта (NatalChartData):**
- sun, moon, rising (PlanetPosition)
- mercury, venus, mars
- element, rulingPlanet, summary, keywords

**Контент (UserGeneratedContent):**
- natalIntro, dailyHoroscope, weeklyHoroscope, monthlyHoroscope
- deepDiveAnalyses (personality, love, career, weakness, karma)
- synastries (по partnerId)

---

## 9. MONETIZATION

| Механизм | Описание |
|----------|----------|
| **Premium** | `profile.isPremium`. 250 Telegram Stars за 7 дней. |
| **Paywall** | Показывается при попытке открыть Oracle без Premium. |
| **Oracle** | Только для Premium. |
| **Full Synastry** | Только для Premium. |
| **Deep Dive** | Только для Premium. |
| **Регенерация** | Premium + Stars. 1 бесплатная в неделю, далее 50 Stars. |
| **Stars** | `requestStarsPayment()` → `tg.showPopup()`. Верификация через `/api/telegram/stars` (TODO: реальная проверка). |

---

## 10. LEGACY PARTS

| Элемент | Расположение | Примечание |
|---------|--------------|------------|
| **Название Astrot** | `constants.ts` (APP_NAME), `Header.tsx` (titles), README | Целевое название — Lumia. |
| **initializeDatabase()** | `lib/db.ts` | Deprecated, используется migrations. |
| **POST /api/charts/[id]** | `pages/api/charts/[id].ts` | Legacy. Предпочтительно `/api/astrology/natal-chart`. |
| **storageService.saveChartData()** | `services/storageService.ts` | Использует legacy POST charts. |
| **Telegram Stars verification** | `pages/api/telegram/stars.ts` | TODO: реальная верификация. |
| **Sentry/errorTracking** | `lib/errorTracking.ts` | TODO: отправка в Sentry/LogRocket. |
| **Дубликат natal-chart** | `pages/api/astrology/natal-chart.ts` и `pages\api\astrology\natal-chart.ts` | Возможный дубликат пути (Windows). |

---

## 11. POTENTIALLY REUSABLE MODULES

| Модуль | Путь | Применимость |
|--------|------|--------------|
| **zodiac-utils** | `lib/zodiac-utils.ts` | Общая логика знаков, элементов, управителей. |
| **validation** | `lib/validation.ts` | Валидация входных данных API. |
| **cache** | `lib/cache.ts` | Конфигурация и хелперы кэша. |
| **rateLimit** | `lib/rateLimit.ts` | `withRateLimit()` для API. |
| **serverLocks** | `lib/serverLocks.ts` | `tryAcquireLock()`, `releaseLock()`. |
| **errorTracking** | `lib/errorTracking.ts` | `logError()`, `withErrorTracking()`, `useErrorTracking()`. |
| **useSwipeBack** | `lib/useSwipeBack.ts` | Хук свайпа назад (iOS-стиль). |
| **cosmic-jokes** | `lib/cosmic-jokes.ts` | Шутки по знаку (RU/EN). |
| **getText** | `constants.ts` | i18n (ru/en). |
| **Loading** | `components/ui/Loading.tsx` | Универсальный индикатор загрузки. |
| **TextCard** | `components/TextCard.tsx` | Универсальная текстовая карточка. |
| **swisseph-calculator** | `lib/swisseph-calculator.ts` | Расчёт натальной карты (при необходимости вынести в отдельный пакет). |

---

*Отчёт сформирован на основе анализа кодовой базы. Код не изменялся.*
