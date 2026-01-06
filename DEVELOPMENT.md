# 🌟 Astrot - Development Guide

> Астрологическое приложение на Next.js + PostgreSQL + OpenAI

---

## 🚀 Quick Start

```bash
# 1. Установи зависимости
npm install

# 2. Настрой .env (скопируй из .env.example)
DATABASE_URL=postgresql://...
OPENAI_API_KEY=sk-...
NEXT_PUBLIC_OWNER_ID=твой_telegram_id
EPHE_PATH=./ephe
WEATHER_API=твой_ключ_weatherapi

# 3. Запусти миграции (только первый раз)
npm run migrate

# 4. Запусти
npm run dev
```

Откройте http://localhost:3000

---

## 📁 Структура проекта

```
/pages/api/          → API endpoints (Next.js)
  /astrology/        → Астрологические расчеты и AI
  /users/            → Управление пользователями
  /subscriptions/    → Premium подписки
  
/lib/                → Библиотеки и утилиты
  db.ts              → PostgreSQL клиент
  migrations.ts      → Миграции БД
  swisseph-calculator.ts → Swiss Ephemeris
  prompts.ts         → AI промпты
  rateLimit.ts       → Rate limiting
  premiumConfig.ts   → Premium конфигурация
  
/services/           → Бизнес-логика
  astrologyService.ts
  contentGenerationService.ts
  storageService.ts  → API запросы к серверу
  
/views/              → React компоненты (страницы)
/components/         → UI компоненты
/ephe/               → Файлы эфемерид Swiss Ephemeris
/types.ts            → TypeScript типы
```

---

## 🗄️ База данных

### Таблицы:
- `users` - профили пользователей
- `charts` - натальные карты
- `deep_dive_analyses` - глубокие анализы
- `synastry_cache` - кэш совместимости
- `forecasts_cache` - кэш прогнозов
- `daily_horoscopes_cache` - дневные гороскопы (по знакам)
- `regenerations` - история регенераций
- `migrations` - применённые миграции

### Миграции:

**Миграции запускаются ОДИН раз при деплое:**
```bash
# При сборке (автоматически)
npm run build  # = next build && npm run migrate

# Вручную (для разработки)
npm run migrate
```

> ⚠️ **Важно:** Миграции НЕ запускаются через API эндпоинты, чтобы избежать блокировок БД при одновременных запросах.

---

## 💎 Premium vs Free

### 🆓 Бесплатно:
- Расчет натальной карты
- Вступление карты (портрет личности)
- Ежедневный гороскоп
- 3 краткие синастрии
- 10 сообщений Oracle чат/день
- 3 регенерации/неделю

### 💎 Premium (399 ⭐):
- Все 5 секций натальной карты
- Недельные/месячные гороскопы
- Полная синастрия
- Hook Chat (глубокий)
- Неограниченные регенерации
- Transit forecast
- Уведомления

Конфигурация: `lib/premiumConfig.ts`

---

## 🔒 Безопасность

### Rate Limiting:
- **Free:** 10 req/min (общие), 5 req/min (AI)
- **Premium:** 60 req/min (общие), 30 req/min (AI)
- Код: `lib/rateLimit.ts`

### Owner/Admin:
```env
NEXT_PUBLIC_OWNER_ID=123456789  # Твой Telegram ID
```

### Environment Variables:
```env
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql://...
EPHE_PATH=./ephe
WEATHER_API=...
NEXT_PUBLIC_OWNER_ID=...
```

---

## 🔮 Swiss Ephemeris (Натальные карты)

### Файлы эфемерид:
Папка `/ephe/` содержит файлы `.se1` для точных астрономических расчетов.

### Автоматическое определение пути:
Код проверяет пути в следующем порядке:
1. `EPHE_PATH` (переменная окружения)
2. `./ephe` (локальная разработка)
3. `/app/ephe` (Docker)
4. `/workspace/ephe` (Railway)

### Диагностика:
Если расчеты не работают, проверь логи `[SwissephCalculator]`:
- `✓ Ephemeris path set to: ...` - путь найден
- `Эфемериды не найдены` - файлы отсутствуют

---

## 🌤️ Погода (WeatherAPI)

### Архитектура:
Запросы к WeatherAPI проксируются через сервер:
```
Frontend → /api/weather?city=... → WeatherAPI
```

Это решает:
- CORS проблемы
- Безопасное хранение API ключа

### Настройка:
```env
WEATHER_API=твой_ключ_от_weatherapi.com
```

---

## 🛠️ API Endpoints

### Астрология:
- `POST /api/astrology/natal-chart` - расчет карты
- `POST /api/astrology/natal-intro` - вступление карты
- `POST /api/astrology/deep-dive` - глубокий анализ
- `POST /api/astrology/daily-horoscope` - дневной гороскоп
- `POST /api/astrology/chat` - чат с Астрой
- `POST /api/astrology/synastry-brief` - краткая совместимость
- `POST /api/astrology/synastry-full` - полная совместимость

### Пользователи:
- `GET /api/users/:id` - получить профиль
- `POST /api/users/:id` - создать/обновить
- `GET /api/users` - все пользователи (admin)

### Система:
- `GET /api/health` - health check (проверка БД)
- `GET /api/weather?city=...` - погода

---

## 📊 Кэширование

### Ежедневный гороскоп:
Кэшируется по знаку зодиака и дате в `daily_horoscopes_cache`.
Один гороскоп на знак в день для всех пользователей.

### Прогнозы:
Кэшируются по пользователю в `forecasts_cache`.

### Deep Dive:
Сохраняются в `deep_dive_analyses` по пользователю и теме.

---

## 👑 Админ панель

Доступ: пользователь с `id === NEXT_PUBLIC_OWNER_ID`

### Вкладки:
- **USERS** - управление пользователями (Premium/Admin toggle)
- **STATS** - статистика и аналитика
- **ERRORS** - мониторинг ошибок
- **SETTINGS** - настройки системы

Код: `views/AdminPanel.tsx`

---

## 🧪 Тестирование

```bash
# Запустить тесты
npm test

# Покрытие
npm run test:coverage
```

Тесты: `__tests__/`

---

## 📦 Деплой

### Railway:
1. Подключи GitHub репозиторий
2. Настрой Environment Variables
3. Railway автоматически деплоит при push

### Docker:
Dockerfile автоматически:
1. Устанавливает зависимости
2. Собирает приложение
3. Копирует папку `ephe/` с эфемеридами
4. Запускает миграции при старте
5. Запускает приложение

### Важно перед деплоем:
- ✅ Настроен `NEXT_PUBLIC_OWNER_ID`
- ✅ Настроен `DATABASE_URL` (public, не internal!)
- ✅ Настроен `OPENAI_API_KEY`
- ✅ Настроен `WEATHER_API`
- ✅ Папка `ephe/` содержит файлы `.se1`

---

## 🔧 Troubleshooting

### Миграции не применяются:
```bash
# Запусти вручную
npm run migrate

# Проверь логи
# [Migrations] Starting database migrations...
```

### Натальные карты не работают:
1. Проверь наличие файлов в `ephe/`
2. Проверь логи `[SwissephCalculator]`
3. Проверь переменную `EPHE_PATH`

### Погода не работает:
1. Проверь `WEATHER_API` в .env
2. Проверь логи `[Weather API]`

### Rate limit слишком строгий:
Настрой в `lib/rateLimit.ts`

---

## 📊 Мониторинг

### Логи:
Все важные операции логируются с префиксами:
- `[API/...]` - API endpoints
- `[DB]` - Database operations
- `[SwissephCalculator]` - Расчеты эфемерид
- `[ContentGenerationService]` - AI генерация
- `[Weather API]` - Погода
- `[Migrations]` - Миграции

---

## 🆘 Поддержка

**Проблемы с кодом?**
- Все функции имеют JSDoc комментарии
- Типы в `types.ts`
- Примеры использования в компонентах

**Проблемы с БД?**
- Логи в консоли: `[DB]`
- Проверь `/api/health`
- Посмотри `lib/migrations.ts`

**Проблемы с AI?**
- Проверь логи: `[ContentGenerationService]`
- Fallback генерация всегда работает
- Промпты в `lib/prompts.ts`

---

**🎉 Проект готов к production!**
