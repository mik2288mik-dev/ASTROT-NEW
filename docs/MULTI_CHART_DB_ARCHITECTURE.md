# Lumia: Архитектура БД для нескольких натальных карт

## Контекст

Текущая архитектура предполагает **1 карту на пользователя** (`user_id BIGINT UNIQUE` в `natal_charts`).  
Продуктовая логика Lumia требует поддержки **нескольких карт на пользователя** (своя, партнёра, друзей, родителей, детей) для synastry, deep dive, horoscope, AI-анализ. Пользователь сможет покупать дополнительные слоты карт за Lumi.

---

## 1. NATAL_CHARTS

### Текущая структура (проблема)

```sql
natal_charts (
  id SERIAL PRIMARY KEY,
  user_id BIGINT UNIQUE REFERENCES users(id),  -- ❌ только 1 карта на user
  sun, moon, ascendant, ... JSONB,
  chart_data JSONB,
  input_hash TEXT,
  birth_date, birth_time, birth_place,
  created_at
);
```

### Предлагаемая структура

```sql
CREATE TABLE natal_charts (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                    -- "Моя карта", "Партнёр", "Мама"
  birth_date DATE NOT NULL,
  birth_time TIME NOT NULL,
  birth_place TEXT NOT NULL,
  chart_data JSONB NOT NULL,
  input_hash TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,      -- основная карта пользователя
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, input_hash)           -- одна карта на уникальный набор birth данных
);
```

### UUID

**UUID не обязателен.** `BIGSERIAL` достаточно для внутренних ID. UUID имеет смысл, если:
- нужны публичные ссылки на карты (sharing)
- интеграция с внешними системами

Рекомендация: **оставить BIGSERIAL** для простоты. При необходимости можно добавить `uuid UUID DEFAULT gen_random_uuid() UNIQUE` позже.

### Индексы

```sql
CREATE INDEX idx_natal_charts_user ON natal_charts(user_id);
CREATE INDEX idx_natal_charts_user_primary ON natal_charts(user_id) WHERE is_primary = TRUE;
CREATE INDEX idx_natal_charts_input_hash ON natal_charts(input_hash);
```

### UNIQUE ограничения

- `UNIQUE (user_id, input_hash)` — предотвращает дубликаты карт с одинаковыми birth данными у одного пользователя.
- Допускает несколько карт с разными `input_hash` (разные люди).

---

## 2. INTERPRETATIONS (AI cache)

### Текущая модель

- `(user_id, type, input_hash)` — кэш привязан к пользователю.
- Проблема: при нескольких картах одна и та же интерпретация (например, deep_dive_personality) должна быть разной для каждой карты.

### Предлагаемая модель

**Два типа интерпретаций:**

| Тип | Привязка | Пример |
|-----|----------|--------|
| **chart-level** | `chart_id` | natal_intro, natal_amateur, natal_pro, daily_natal_card, deep_dive_* |
| **user-level** | `user_id` | question_answer (вопросы в контексте диалога) |

**Структура:**

```sql
CREATE TABLE interpretations (
  id BIGSERIAL PRIMARY KEY,
  chart_id BIGINT REFERENCES natal_charts(id) ON DELETE CASCADE,  -- NULL для user-level
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,          -- для question_answer
  type interpretation_type NOT NULL,
  input_hash TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT interpretations_chart_or_user CHECK (
    (chart_id IS NOT NULL AND user_id IS NULL) OR
    (chart_id IS NULL AND user_id IS NOT NULL)
  )
);

-- Уникальность для chart-level
CREATE UNIQUE INDEX idx_interpretations_chart_lookup
  ON interpretations(chart_id, type, input_hash)
  WHERE chart_id IS NOT NULL;

-- Уникальность для user-level
CREATE UNIQUE INDEX idx_interpretations_user_lookup
  ON interpretations(user_id, type, input_hash)
  WHERE user_id IS NOT NULL;
```

**Альтернатива (проще):** оставить одну колонку `chart_id` и добавить `user_id` только для `question_answer`. Для chart-level: `user_id` можно вывести через JOIN с `natal_charts`, но для кэш-поиска нужен `chart_id`.

**Рекомендация:** использовать `chart_id` для всех chart-level типов. Для `question_answer` — `user_id`, `chart_id = NULL`.

### Индексы

```sql
CREATE INDEX idx_interpretations_chart ON interpretations(chart_id) WHERE chart_id IS NOT NULL;
CREATE INDEX idx_interpretations_user ON interpretations(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_interpretations_type ON interpretations(type);
```

---

## 3. DAILY_NATAL_CARDS

### Текущая модель

- `(user_id, date)` — один daily на пользователя.

### Предлагаемая модель

- `(chart_id, date)` — каждый daily привязан к конкретной карте.

```sql
CREATE TABLE daily_natal_cards (
  id BIGSERIAL PRIMARY KEY,
  chart_id BIGINT NOT NULL REFERENCES natal_charts(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (chart_id, date)
);
```

---

## 4. SYNASTRY

Synastry — анализ пары карт. Нужна отдельная таблица.

### Таблица synastry_cache

```sql
CREATE TABLE synastry_cache (
  id BIGSERIAL PRIMARY KEY,
  chart1_id BIGINT NOT NULL REFERENCES natal_charts(id) ON DELETE CASCADE,
  chart2_id BIGINT NOT NULL REFERENCES natal_charts(id) ON DELETE CASCADE,
  mode TEXT NOT NULL,                    -- 'brief' | 'full'
  input_hash TEXT NOT NULL,              -- hash(chart1_id, chart2_id, mode, language, ...)
  content JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT synastry_chart_order CHECK (chart1_id < chart2_id)
);

CREATE UNIQUE INDEX idx_synastry_cache_lookup
  ON synastry_cache(chart1_id, chart2_id, mode, input_hash);
```

### Избежание дубликатов

- **Нормализация порядка:** `chart1_id < chart2_id` — синастрия (A,B) и (B,A) хранятся как одна запись.
- **input_hash:** включает mode, language, relationshipType и т.п., чтобы разные варианты запроса не перезаписывали друг друга.
- **UNIQUE (chart1_id, chart2_id, mode, input_hash)** — один результат на уникальную комбинацию.

---

## 5. AI CACHE — рекомендации

### input_hash

- **Natal / Deep dive:** `hash(birth_date, birth_time, birth_place)` или `input_hash` из `natal_charts`.
- **Daily natal card:** `hash(chart_id, date)`.
- **Synastry:** `hash(chart1_id, chart2_id, mode, language, relationshipType)`.
- **Question:** `hash(question_text)`.

### Защита от повторных вызовов OpenAI

1. **Перед вызовом OpenAI:** `SELECT` по `(chart_id, type, input_hash)` или `(user_id, type, input_hash)`.
2. **После ответа:** `INSERT ... ON CONFLICT DO UPDATE` — идемпотентность.
3. **UNIQUE constraint** — гарантия отсутствия дубликатов на уровне БД.

### Race conditions

- Использовать `tryAcquireLock` (как в daily-horoscope) для критичных путей.
- `INSERT ... ON CONFLICT` — атомарность на уровне БД.

---

## 6. CHART SLOTS (покупка слотов)

### Вариант A: колонка в users

```sql
ALTER TABLE users ADD COLUMN chart_slots INTEGER DEFAULT 1;
```

- Плюсы: просто, один запрос.
- Минусы: нет истории покупок.

### Вариант B: отдельная таблица

```sql
CREATE TABLE chart_slot_transactions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,    -- +1 слот
  reason TEXT,               -- 'purchase_lumi', 'premium_bonus'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- users.chart_slots = 1 + SUM(amount) из chart_slot_transactions
```

- Плюсы: аудит, гибкость.
- Минусы: нужен пересчёт или триггер.

### Рекомендация

**Вариант A** — `users.chart_slots INTEGER DEFAULT 1`. При покупке: `UPDATE users SET chart_slots = chart_slots + 1`. Лимит: `chart_slots` — максимум карт у пользователя. Premium может давать бонусные слоты.

---

## 7. Сводка: chart_id vs user_id

| Таблица | Ключ | Причина |
|---------|------|---------|
| users | user_id | Владелец |
| natal_charts | user_id | Владелец карты |
| interpretations (chart-level) | chart_id | Интерпретация привязана к карте |
| interpretations (user-level) | user_id | question_answer — контекст пользователя |
| daily_natal_cards | chart_id | Daily привязан к карте |
| synastry_cache | chart1_id, chart2_id | Пара карт |
| lumi_transactions | user_id | Баланс пользователя |
| roulette_spins | user_id | Спины пользователя |
| astro_questions | user_id | Вопросы пользователя |
| daily_horoscopes | zodiac_sign, date | Общий гороскоп по знаку |

---

## 8. Индексы (сводка)

| Таблица | Индекс | Назначение |
|---------|--------|------------|
| natal_charts | idx_natal_charts_user | Список карт пользователя |
| natal_charts | idx_natal_charts_user_primary | Быстрый поиск основной карты |
| natal_charts | idx_natal_charts_input_hash | Поиск по хэшу |
| interpretations | idx_interpretations_chart_lookup (UNIQUE) | Кэш по карте |
| interpretations | idx_interpretations_user_lookup (UNIQUE) | Кэш по пользователю |
| daily_natal_cards | idx_daily_natal_cards_chart_date | Поиск daily по карте и дате |
| synastry_cache | idx_synastry_cache_lookup (UNIQUE) | Кэш синастрии |
| synastry_cache | idx_synastry_chart1, idx_synastry_chart2 | Поиск по карте |

---

## 9. Масштабирование (1M пользователей)

### Избыточные поля

- `users`: birth_date, birth_time, birth_place дублируют данные основной карты. Можно оставить для быстрого доступа к "моей" карте или убрать при миграции на multi-chart.
- `natal_charts.chart_data` — JSONB, можно партиционировать по `user_id` при росте.

### Дублирование

- Synastry (A,B) и (B,A) — одно хранение за счёт `chart1_id < chart2_id`.

### Race conditions

- Lock на уровне приложения для генерации (daily, natal).
- `ON CONFLICT` в БД для кэша.

### AI cache при росте

- Партиционирование `interpretations` по `chart_id` или `user_id` (hash).
- TTL/архивация старых записей при необходимости.
- Connection pooling (уже есть в проекте).

---

## 10. Рекомендации по AI cache

### input_hash — правила формирования

| Тип | input_hash | Пример |
|-----|------------|--------|
| natal_intro, natal_amateur, natal_pro | `input_hash` из natal_charts | `base64(birth_date\|birth_time\|birth_place)` |
| daily_natal_card | `date` (YYYY-MM-DD) | `2025-03-10` |
| deep_dive_* | topic key | `personality`, `love`, `career` |
| synastry | `hash(chart1_id, chart2_id, mode, lang)` | SHA256 или base64 |
| question_answer | `hash(question_text)` | SHA256 первых 64 символов |

### Порядок операций (защита от дубликатов)

1. **Перед вызовом OpenAI:** `SELECT content FROM interpretations WHERE chart_id = $1 AND type = $2 AND input_hash = $3`
2. **При наличии:** вернуть кэш, не вызывать OpenAI
3. **При отсутствии:** вызвать OpenAI
4. **После ответа:** `INSERT INTO interpretations (...) VALUES (...) ON CONFLICT (chart_id, type, input_hash) DO UPDATE SET content = EXCLUDED.content`

### Synastry: нормализация пары

```typescript
const [c1, c2] = [chart1Id, chart2Id].sort((a, b) => a - b);
const inputHash = createHash(chart1Id, chart2Id, mode, language);
// INSERT into synastry_cache (chart1_id, chart2_id, ...) VALUES (c1, c2, ...)
```

---

## 11. Список изменений (чеклист)

- [ ] `natal_charts`: убрать `user_id UNIQUE`, добавить `name`, `is_primary`, `UNIQUE(user_id, input_hash)`
- [ ] `interpretations`: добавить `chart_id`, изменить логику на chart_id/user_id
- [ ] `daily_natal_cards`: заменить `user_id` на `chart_id`
- [ ] Создать `synastry_cache`
- [ ] `users`: добавить `chart_slots`
- [ ] Обновить `lib/db.ts` под новую схему
- [ ] Обновить API: natal-chart, daily-horoscope, deep-dive, synastry, regenerate
- [ ] Миграция данных: одна карта на user → создать запись в `natal_charts` с `is_primary=true`
