# Lumia Product Architecture

Связанные документы:

- [LUMIA_PRODUCT_CONSTITUTION.md](./LUMIA_PRODUCT_CONSTITUTION.md)
- [LUMIA_CONTENT_TIER_SPEC.md](./LUMIA_CONTENT_TIER_SPEC.md)
- [lib/contentAccessMatrix.ts](../lib/contentAccessMatrix.ts) — матрица доступа к контенту
- [lib/starsPricing.ts](../lib/starsPricing.ts) — Stars one-off pricing (legacy Lumi aliases)
- [lib/logger.ts](../lib/logger.ts) — безопасное структурное логирование

## 1. Главный принцип

**Accuracy is not paywalled. Access is paywalled.**

- Расчётный слой всегда точный и общий для всех пользователей.
- Free, Premium и Stars one-off не отличаются точностью расчёта.
- Бесплатный пользователь получает полный расчётный слой там, где это технически возможно.
- Платность влияет только на доступ, глубину интерпретации, архив, историю, количество вопросов и подробность текста.
- AI не является источником расчёта — AI только объясняет уже подготовленный расчётный контекст.

## 2. Монетизация (2026-05, обновлено)

| Слой | Механика |
|------|----------|
| **Free** | Базовый доступ: гороскоп, базовая натальная карта, стартовый Ask Lumia, краткая синастрия |
| **Premium** | Полный доступ к платному контенту. Оплата через Telegram Stars только как payment rail для подписки (`premium_week` → webhook) |

**User-facing модель: Free + Premium.** Разовых покупок контента в UI нет.

**Telegram Stars** могут использоваться только как технический способ оплаты Premium внутри Telegram. Stars не показываются пользователю как валюта «открыть кусок».

**Legacy one-off server support** (`ask_lumia_one_off`, `forecast_full_day`, `synastry_full`, `natal_human_*`) оставлен для старых unlock rows и webhook-тестов, но текущий UI его не вызывает.

**Lumi как продуктовая валюта снята.** Legacy unlocks с `accessTier='lumi'` временно читаются как stars-like unlock rows.

## 3. Слои архитектуры

| Слой | Назначение |
|------|------------|
| **Calculation Layer** | Натальная карта, транзиты (Swiss Ephemeris), Today Pulse (24 точки), chartQuality / birthTimeQuality. Общий для всех tier. |
| **Persistence Layer** | `natal_charts`, кэши расчётов, `content_interpretations`, `content_unlocks`, `star_payments`, история вопросов и check-in. |
| **Personalization Context Layer** | `PersonalizationContext` для AI-интерпретации, не для подмены расчёта. |
| **Interpretation Layer** | AI-тексты по tier (free / premium / stars): прогнозы, портрет, Ask Lumia, synastry. |
| **Access Layer** | Premium entitlement, preview/teaser/locked card. Legacy stars unlock rows читаются, но UI не предлагает one-off. Матрица: [lib/contentAccessMatrix.ts](../lib/contentAccessMatrix.ts). |
| **Logging / Observability Layer** | [lib/logger.ts](../lib/logger.ts), health metrics. |

## 4. Что считается всем пользователям

- natal chart, chartQuality / birthTimeQuality
- exact transits, Today Pulse (24 Swiss Ephemeris points)
- layers: energy / focus / emotions / money / relationships
- check-in derived patterns, calculation source / version

## 5. Что открывается платно

| Доступ | Примеры |
|--------|---------|
| Premium | Полный день; утро / день / вечер; полный портрет; planet insight; полный союз; глубокие Ask Lumia; неделя / месяц; история и архив |

Free: anchor natal, daily pulse, brief synastry, starter Ask Lumia question.

Non-premium locked content ведёт в Premium paywall, не в Stars one-off.

## 6. Что запрещено

- free = approximate, premium = accurate
- Скрытая подмена swisseph на algorithmic в production
- Сохранение fake-personal forecast
- AI как источник расчёта
- Логирование PII
- **Новые продуктовые сценарии через Lumi balance / Lumi packs**
- **User-facing one-off content purchases через Stars**

## 7. История

- 2026-05: первая версия; content access matrix; privacy-safe logger.
- 2026-05: переход Free / Premium / Stars one-off; снятие Lumi как продуктовой валюты.
- 2026-05: Premium-only user model — one-off content purchases removed from UI; Stars остаются payment rail для Premium.
