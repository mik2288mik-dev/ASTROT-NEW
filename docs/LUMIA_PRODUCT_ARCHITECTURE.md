# Lumia Product Architecture

Связанные документы:

- [LUMIA_PRODUCT_CONSTITUTION.md](./LUMIA_PRODUCT_CONSTITUTION.md)
- [LUMIA_CONTENT_TIER_SPEC.md](./LUMIA_CONTENT_TIER_SPEC.md)
- [lib/contentAccessMatrix.ts](../lib/contentAccessMatrix.ts) — матрица доступа к контенту
- [lib/premiumPricing.ts](../lib/premiumPricing.ts) — Premium Telegram Stars pricing
- [lib/starsInvoiceCatalog.ts](../lib/starsInvoiceCatalog.ts) — Premium invoice catalog (`premium_week` only)
- [lib/logger.ts](../lib/logger.ts) — безопасное структурное логирование

## 1. Главный принцип

**Accuracy is not paywalled. Access is paywalled.**

- Расчётный слой всегда точный и общий для всех пользователей.
- Free и Premium не отличаются точностью расчёта.
- Бесплатный пользователь получает полный расчётный слой там, где это технически возможно.
- Платность влияет только на доступ, глубину интерпретации, архив, историю, количество вопросов и подробность текста.
- AI не является источником расчёта — AI только объясняет уже подготовленный расчётный контекст.

## 2. Монетизация (2026-05, обновлено)

| Слой | Механика |
|------|----------|
| **Free** | Базовый доступ: гороскоп, базовая натальная карта, стартовый Ask Lumia, краткая синастрия |
| **Premium** | Полный доступ к платному контенту. Оплата через Telegram Stars только как payment rail для подписки (`premium_week` → webhook) |

**User-facing модель: Free + Premium.** Разовых покупок контента в UI нет.

**Telegram Stars** используются только как технический способ оплаты Premium внутри Telegram (`premium_week`).

**One-off content purchases удалены полностью** из runtime-кода (UI, API, invoice catalog, unlock flows).

**Lumi как продуктовая валюта снята.** Legacy DB rows могут оставаться до отдельной migration.

## 3. Слои архитектуры

| Слой | Назначение |
|------|------------|
| **Calculation Layer** | Натальная карта, транзиты (Swiss Ephemeris), Today Pulse (24 точки), chartQuality / birthTimeQuality. Общий для всех tier. |
| **Persistence Layer** | `natal_charts`, кэши расчётов, `content_interpretations`, `content_unlocks`, `star_payments`, история вопросов и check-in. |
| **Personalization Context Layer** | `PersonalizationContext` для AI-интерпретации, не для подмены расчёта. |
| **Interpretation Layer** | AI-тексты по tier (free / premium): прогнозы, портрет, Ask Lumia, synastry. |
| **Access Layer** | Premium entitlement, preview/teaser/locked card. Матрица: [lib/contentAccessMatrix.ts](../lib/contentAccessMatrix.ts). |
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
- 2026-05: Legacy one-off Stars content purchases removed from server/runtime code; only `premium_week` invoices remain.
