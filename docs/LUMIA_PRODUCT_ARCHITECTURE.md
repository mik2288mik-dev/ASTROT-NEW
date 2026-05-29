# Lumia Product Architecture

Связанные документы:

- [LUMIA_PRODUCT_CONSTITUTION.md](./LUMIA_PRODUCT_CONSTITUTION.md)
- [LUMIA_CONTENT_TIER_SPEC.md](./LUMIA_CONTENT_TIER_SPEC.md)
- [lib/contentAccessMatrix.ts](../lib/contentAccessMatrix.ts) — матрица доступа к контенту
- [lib/logger.ts](../lib/logger.ts) — безопасное структурное логирование

## 1. Главный принцип

**Accuracy is not paywalled. Access is paywalled.**

- Расчётный слой всегда точный и общий для всех пользователей.
- Free, Premium и Lumi не отличаются точностью расчёта.
- Бесплатный пользователь получает полный расчётный слой там, где это технически возможно.
- Платность влияет только на доступ, глубину интерпретации, архив, историю, количество вопросов и подробность текста.
- AI не является источником расчёта — AI только объясняет уже подготовленный расчётный контекст.

## 2. Слои архитектуры

| Слой | Назначение |
|------|------------|
| **Calculation Layer** | Натальная карта, транзиты (Swiss Ephemeris), Today Pulse (24 точки), chartQuality / birthTimeQuality, calculation source/version. Общий для всех tier. |
| **Persistence Layer** | `natal_charts`, кэши расчётов, `content_interpretations`, `content_unlocks`, история вопросов и check-in. |
| **Personalization Context Layer** | `PersonalizationContext`: карта, качество, Today Pulse, check-in паттерны, недавние вопросы, relationship context — для AI-интерпретации, не для подмены расчёта. |
| **Interpretation Layer** | AI-тексты по tier (free / premium / lumi): прогнозы, портрет, Ask Lumia, synastry narrative. Разная глубина, один расчётный вход. |
| **Access Layer** | Premium entitlement, Lumi unlock, preview/teaser/locked card. Матрица: [lib/contentAccessMatrix.ts](../lib/contentAccessMatrix.ts). |
| **Logging / Observability Layer** | Структурные события без PII: [lib/logger.ts](../lib/logger.ts), health metrics (Swiss Ephemeris, Today Pulse). |

## 3. Что считается всем пользователям

При наличии данных профиля и карты:

- natal chart (канонический расчёт)
- `chartQuality` / `birthTimeQuality`
- exact transits (Swiss Ephemeris; без silent fallback в production)
- Today Pulse (24 Swiss Ephemeris points)
- layers: energy / focus / emotions / money / relationships
- check-in derived patterns (где доступны check-in)
- calculation source / version

## 4. Что открывается платно

| Доступ | Примеры |
|--------|---------|
| Premium | Полный день; утро / день / вечер; полный портрет; planet insight; полный союз; глубокие Ask Lumia; неделя / месяц (полный слой); история и архив; дополнительные интерпретации |
| Lumi (разово) | Ask Lumia one-off; forecast day unlock; synastry extended; отдельные Lumi-unlock поверх free |

Free остаётся: anchor natal, daily pulse, brief synastry, starter Ask Lumia question.

## 5. Что запрещено

- **free = approximate, premium = accurate** — tier не меняет точность расчёта.
- **Скрытая подмена swisseph на algorithmic в production** — `ALLOW_APPROXIMATE_TRANSITS` только dev/test; в production — ошибка или unavailable.
- **Сохранение fake-personal forecast** — интерпретация без реального расчётного контекста.
- **AI как источник расчёта** — AI только интерпретирует подготовленный контекст.
- **Логирование PII** — полные вопросы/ответы Ask Lumia, даты/места рождения, полный PersonalizationContext, партнёрские данные целиком.

## 6. История

- 2026-05: первая версия архитектурного документа; закрепление принципа accuracy vs access; content access matrix и privacy-safe logger.
