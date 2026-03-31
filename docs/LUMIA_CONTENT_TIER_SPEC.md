# Lumia Content Tier Specification

Связанные документы:

- [LUMIA_PRODUCT_CONSTITUTION.md](./LUMIA_PRODUCT_CONSTITUTION.md)
- [LUMIA_PRODUCT_MODEL.md](./LUMIA_PRODUCT_MODEL.md)
- [LUMIA_MASTER_REBUILD_ROADMAP.md](./LUMIA_MASTER_REBUILD_ROADMAP.md)
- [NATAL_SCREEN_IA.md](./NATAL_SCREEN_IA.md)

Этот документ — **единый источник правды** для сочетаний `access_tier × content_surface × content_variant` в текущей кодовой базе. Противоречия с конституцией помечаются в разделе Backlog.

## 1. Типы (TypeScript)

Источник: [types.ts](../types.ts).

| Поле | Значения |
|------|-----------|
| `ContentAccessTier` | `free`, `premium`, `lumi` |
| `ContentSurface` | `natal`, `forecast`, `synastry`, `question` |
| `ContentVariant` | `anchor`, `living`, `daily`, `morning`, `day`, `evening`, `weekly`, `monthly`, `brief`, `full`, `one_off` |
| `ContentModelTier` | `base`, `premium` |

## 2. Матрица слоёв и привязка к коду

| access_tier | surface | variant | Публичное назначение (UI) | API (основной) | Экран / клиент |
|-------------|---------|---------|---------------------------|----------------|----------------|
| free | forecast | daily | Один личный прогноз на день (базовая интерпретация) | `POST/GET /api/content/forecast/daily` | [views/Horoscope.tsx](../views/Horoscope.tsx), [views/Dashboard.tsx](../views/Dashboard.tsx) |
| premium | forecast | morning / day / evening | Слой дня по частям: утро, день, вечер (другой класс интерпретации) | `POST/GET /api/content/forecast/daypart` + `slot` | [views/Horoscope.tsx](../views/Horoscope.tsx), [services/astrologyService.ts](../services/astrologyService.ts) |
| free | natal | anchor | Постоянная «основа» карты (не самопроизвольно перезаписывается) | `POST/GET /api/content/natal/anchor` | [views/NatalChart.tsx](../views/NatalChart.tsx) |
| premium | natal | living | Живой слой периода (тема, активации, отношения, деньги) | `POST/GET /api/content/natal/living` | [views/NatalChart.tsx](../views/NatalChart.tsx) |
| free | question | brief | Стартовый бесплатный вопрос (лимит через unlock) | `POST/GET /api/content/question/ask` | [views/OracleChat.tsx](../views/OracleChat.tsx) |
| lumi | question | one_off | Разовый вопрос за Lumi | то же | то же |
| premium | question | full | Вопросы в рамках Premium | то же | то же |
| free | synastry | (legacy `brief`) | Короткий бесплатный вход по двум картам | `POST /api/astrology/synastry-brief` | [views/Synastry.tsx](../views/Synastry.tsx) |
| lumi | synastry | one_off | Средний слой (связь, напряжение, навигация, контекст типа связи), разовый unlock + кэш | `POST /api/content/synastry/extended` (`allowLumiSpend`) | то же |
| premium | synastry | (legacy `full`) | Полный глубокий разбор | `POST /api/astrology/synastry-full` (entitlement по БД) | то же |

Генерация текста прогноза: [lib/forecastContent.ts](../lib/forecastContent.ts), промпты: [lib/prompts.ts](../lib/prompts.ts) (`createDailyForecastV2Prompt`, `createDaypartForecastPrompt`).

Unlock / интерпретации в БД: [lib/contentArchitecture.ts](../lib/contentArchitecture.ts), `db.content_interpretations`, `db.content_unlocks`.

## 3. Продуктовый словарь (UI vs dev)

Решения на соответствие [LUMIA_MASTER_REBUILD_ROADMAP.md](./LUMIA_MASTER_REBUILD_ROADMAP.md) §3:

| Dev / код | Пользовательский язык (текущий) | Примечание |
|-----------|----------------------------------|------------|
| ViewState `oracle`, API `question` | **«Спросить Lumia»** / Ask Lumia (`constants`: `menu_oracle`, экран вопросов) | «Oracle» как бренд в коде допустим; в UI — человекоцентричная формулировка |
| Deep Dive | **Deep Dive** в paywall / фичах | Переименование в более «человеческий» слой — **открытый вопрос**; до смены — сохранять единообразие в premium messaging |
| Regenerate / refresh | **Обновить разбор** (Lumi), внутренне `refresh` | Не выносить слово «Regenerate» в пользовательский текст |
| `daily-horoscope` (legacy) | Семейство **прогноза на день** | Новый контракт — `content` forecast `daily`; legacy endpoint остаётся мостом для старых клиентов |
| Forecast dayparts | **Утро / день / вечер** (Premium) | Не позиционировать как «тот же текст три раза» |

Ключи copy для прогноза: `horoscope.*`, `dashboard.*` в [constants.ts](../constants.ts).

## 4. Правила copy (кратко)

- Без погоды, цвета дня, числа дня и лунных gimmicks на **главном пользовательском пути** (конституция §2, §9).
- Погода только как **опциональная настройка** (фон), не как смысл Lumia — см. тексты `settings.weather_*`.
- Free = честный базовый слой; Premium = **другой класс интерпретации**, не «длиннее то же самое».

## 5. Backlog / известные зазоры

- **Synastry**: Lumi-слой пишет в `content_interpretations` + `synastry_cache` (`mode: extended`); free/full по-прежнему на legacy `synastry-brief` / `synastry-full` (кэш `brief`/`full`). При желании позже — единый маршрут `requestedTier`.
- **Weekly / monthly** forecast: варианты в типах; отдельные consumer endpoints — по мере Phase 4 roadmap.
- **Lumi reason taxonomy** (earn / spend / purchase / system): код и подписи в [lib/lumiReasonTaxonomy.ts](../lib/lumiReasonTaxonomy.ts); расширять при новых `reason` в БД.

## 6. История

- 2026-03: первая версия спеки после Dashboard Phase 2, forecast/dayparts, Ask Lumia и natal anchor/living в UI.
- 2026-03: Phase 6 — три слоя синастрии (free / Lumi extended / Premium full) и выравнивание копирайта вопросов.
- 2026-03: Phase 7 (часть) — таксономия причин Lumi в `lib/lumiReasonTaxonomy.ts`, кошелёк и admin на общих подписях.
