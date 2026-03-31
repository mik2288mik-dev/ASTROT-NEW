# Legacy cleanup checklist (Phase 10)

После закрепления consumer core — [LUMIA_MASTER_REBUILD_ROADMAP.md](./LUMIA_MASTER_REBUILD_ROADMAP.md) §10.

## Когда начинать

Когда матрица [LUMIA_CONTENT_TIER_SPEC.md](./LUMIA_CONTENT_TIER_SPEC.md) и основные экраны стабильны; каждый пункт — отдельный безопасный PR.

## Кандидаты на проверку

- Дублирующие consumer-пути (legacy `daily-horoscope` vs `content/forecast/daily`) — свести к одному контракту на клиенте, оставить мост только при необходимости.
- Устаревшие имена surface в UI (внутренний `Oracle` vs «Спросить Lumia» — уже зафиксировано в спеке §3).
- Виджетные gimmicks вне главного пути (цвет дня, число дня и т.д. — конституция §2, §9).
- Мёртвые флаги/эксперименты и неиспользуемые API-обёртки после миграции на `content/*`.

## Правило

Не удалять legacy до подтверждённого отсутствия клиентов и миграции данных/кэша, если затронута БД.
