# Статус фаз 2–9 (roadmap) и оставшиеся зазоры

Источник порядка: [LUMIA_MASTER_REBUILD_ROADMAP.md](./LUMIA_MASTER_REBUILD_ROADMAP.md) §1–§9. Ниже — сверка с кодом и доками на 2026-03.

## Сводка

| Фаза (§) | Тема | Статус | Комментарий |
|----------|------|--------|-------------|
| 2 | Dashboard Phase 2 | **Сделано** | [views/Dashboard.tsx](../views/Dashboard.tsx): hero из прогноза, блок «что важно», натал, вторичные CTA; [AIR_UI_ROLLOUT.md](./AIR_UI_ROLLOUT.md) помечает Dashboard как Done. |
| 3 | Content-tier spec + словарь | **Сделано** | [LUMIA_CONTENT_TIER_SPEC.md](./LUMIA_CONTENT_TIER_SPEC.md) — матрица tier×surface×variant, UI-имена (Ask Lumia, без Regenerate в copy). Открытые вопросы спеки: Deep Dive naming, weekly/monthly forecast. |
| 4 | Forecast rebuild | **В основном сделано** | Free daily + premium dayparts; недельный/месячный слои в `content/forecast/weekly` и `monthly` (free краткий / premium полный), UI в Horoscope. Legacy astrology weekly/monthly помечены заголовками deprecation. |
| 5 | Natal anchor + living | **Сделано** | Спека и API `content/natal/anchor`, `living`; экран [NatalChart.tsx](../views/NatalChart.tsx). |
| 6 | Questions + Synastry | **Сделано** | Зафиксировано в roadmap §6 и в спеке (free / Lumi / Premium). |
| 7 | Lumi economy | **Частично** | Кошелёк, стрики, рулетка, рефералы в [Wallet.tsx](../views/Wallet.tsx), [lumiReasonTaxonomy.ts](../lib/lumiReasonTaxonomy.ts). **Зазоры:** roadmap перечисляет reposts и прочие петли — оценивать по продуктовому приоритету; углубление copy/онбординга «зачем Lumi». |
| 8 | AIR UI rollout | **Помечено Done** | [AIR_UI_ROLLOUT.md](./AIR_UI_ROLLOUT.md) — все перечисленные экраны Done; регрессия — ручная (TMA, темы, safe area). |
| 9 | Admin + notifications | **Частично → закрывается** | Оболочка админки и шаблоны есть. **Зазор:** сегментация по трём тирам из спеки — добавлен явный сегмент **`lumi`** (не Premium, `lumi_balance > 0`). Recurring user notification settings — по-прежнему перспектива в [ADMIN_NOTIFICATIONS_SUPPORT.md](./ADMIN_NOTIFICATIONS_SUPPORT.md). |

**Фаза 10 (cleanup)** в §1 списка — отдельный трек; в запрос «до 9» не входит. Чеклист: [LEGACY_CLEANUP_CHECKLIST.md](./LEGACY_CLEANUP_CHECKLIST.md).

## План работ по оставшимся зазорам (приоритет)

1. **Phase 9 — сегмент `lumi`** — реализовано в коде (список пользователей, broadcast, шаблоны по слотам, SQL получателей, KPI в шапке админки).
2. **Phase 4 — weekly/monthly forecast** — проектирование API и UI, после стабилизации daily/dayparts.
3. **Phase 7** — новые earn-петли и полировка Wallet по roadmap; не блокирует Phase 9.
4. **Phase 10** — сведение legacy `daily-horoscope` → `content/forecast`, вычистка gimmicks, только после подтверждённой миграции клиентов.
5. **Приёмка** — ручной прогон: рассылка в сегмент Lumi, список пользователей с фильтром Lumi, автomation templates.

## Определение сегмента `lumi` (admin)

**Lumi economy users:** активная подписка Premium отсутствует (`premium_until` NULL или в прошлом) **и** `lumi_balance > 0`.  
Сегмент **`free`** по-прежнему означает всех не-Premium (включая нулевой баланс Lumi). **`premium`** и **`lumi`** не пересекаются.
