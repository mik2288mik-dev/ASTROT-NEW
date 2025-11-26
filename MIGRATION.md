# Migration Guide: Vite → Next.js

## Summary

Проект успешно мигрирован с Vite на Next.js. Все компоненты и функциональность сохранены.

## Что изменилось

### Структура проекта

**Было (Vite):**
```
├── index.html
├── index.tsx
├── vite.config.ts
└── ...
```

**Стало (Next.js):**
```
├── pages/
│   ├── _app.tsx
│   ├── _document.tsx
│   ├── index.tsx
│   └── api/
├── styles/
│   └── globals.css
├── next.config.js
└── ...
```

### API Calls

**Было:**
- Прямые запросы к внешнему API через `DATABASE_URL`
- Fallback на localStorage

**Стало:**
- Все запросы идут через Next.js API Routes (`/api/*`)
- Данные сохраняются только в базу данных (Railway)
- localStorage используется только как временный fallback при ошибках

### Переменные окружения

**Было:**
- `DATABASE_URL` - URL внешнего API

**Стало:**
- `DATABASE_URL` - Connection string для Railway Database (PostgreSQL/MySQL)
- `NEXT_PUBLIC_API_URL` - Опционально, для внешних API вызовов

### Стили

**Было:**
- Tailwind через CDN в `index.html`

**Стало:**
- Tailwind через PostCSS (`tailwind.config.js`, `postcss.config.js`)
- Глобальные стили в `styles/globals.css`

## Следующие шаги

### 1. Установка зависимостей

```bash
npm install
```

### 2. Настройка базы данных

1. Создайте базу данных на Railway (PostgreSQL или MySQL)
2. Скопируйте connection string в `.env`:
   ```
   DATABASE_URL=postgresql://user:password@host:port/database
   ```
3. Установите драйвер базы данных:
   ```bash
   # Для PostgreSQL
   npm install pg @types/pg
   
   # ИЛИ для MySQL
   npm install mysql2
   ```
4. Откройте `lib/db.ts` и раскомментируйте соответствующий код подключения к БД

### 3. Инициализация таблиц

Таблицы создаются автоматически при первом запуске через `initializeDatabase()`. 
Или можно создать их вручную через SQL:

```sql
-- PostgreSQL
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255),
  birth_date VARCHAR(50),
  birth_time VARCHAR(50),
  birth_place VARCHAR(255),
  is_setup BOOLEAN DEFAULT false,
  language VARCHAR(10) DEFAULT 'ru',
  theme VARCHAR(10) DEFAULT 'dark',
  is_premium BOOLEAN DEFAULT false,
  is_admin BOOLEAN DEFAULT false,
  three_keys JSONB,
  evolution JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS charts (
  user_id VARCHAR(255) PRIMARY KEY,
  chart_data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### 4. Запуск проекта

```bash
# Development
npm run dev

# Production build
npm run build
npm start
```

## Проверка миграции

### ✅ Что работает

- [x] Все компоненты перенесены
- [x] API Routes созданы для всех эндпоинтов
- [x] Сервисы обновлены для работы с Next.js API
- [x] Стили и анимации сохранены
- [x] Логирование добавлено везде
- [x] Структура Next.js настроена

### ⚠️ Требует настройки

- [ ] Установка драйвера базы данных (pg или mysql2)
- [ ] Настройка подключения к Railway Database в `lib/db.ts`
- [ ] Интеграция Swiss Ephemeris для реальных расчетов
- [ ] Интеграция OpenAI API для чата
- [ ] Верификация Telegram Stars платежей

## API Routes

Все API routes находятся в `pages/api/`:

- `/api/users/[id]` - Управление пользователями
- `/api/users` - Список всех пользователей (admin)
- `/api/charts/[id]` - Управление картами
- `/api/astrology/*` - Астрологические расчеты
- `/api/subscriptions/premium` - Премиум подписки
- `/api/telegram/stars` - Telegram Stars платежи

## Логирование

Все операции логируются:
- **Сервер**: Console logs в терминале
- **Клиент**: Console logs в браузере

Формат логов:
- `[StorageService]` - операции с данными
- `[AstrologyService]` - астрологические расчеты
- `[API/*]` - API routes
- `[DB]` - операции с базой данных

## Troubleshooting

### Ошибка "Database connection not implemented"

Установите драйвер БД и раскомментируйте код в `lib/db.ts`.

### Данные не сохраняются

1. Проверьте `DATABASE_URL` в `.env`
2. Убедитесь, что драйвер БД установлен
3. Проверьте логи в консоли сервера

### Стили не применяются

1. Убедитесь, что Tailwind установлен: `npm install tailwindcss postcss autoprefixer`
2. Проверьте `tailwind.config.js` и `postcss.config.js`

## Поддержка

При возникновении проблем проверьте:
1. Логи сервера (терминал)
2. Логи клиента (браузерная консоль)
3. Railway Database connection
4. Переменные окружения
