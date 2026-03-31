# AIR UI rollout (Phase 8)

Направление из [LUMIA_MASTER_REBUILD_ROADMAP.md](./LUMIA_MASTER_REBUILD_ROADMAP.md) §8: светлый/тёмный AIR UI, больше воздуха, мягкие градиенты, премиальный спокойный тон.

## Порядок внедрения (экран за экраном)

1. [views/Dashboard.tsx](../views/Dashboard.tsx)
2. [views/Horoscope.tsx](../views/Horoscope.tsx) (прогноз / dayparts)
3. [views/NatalChart.tsx](../views/NatalChart.tsx)
4. [views/Synastry.tsx](../views/Synastry.tsx)
5. [views/OracleChat.tsx](../views/OracleChat.tsx)
6. [views/Wallet.tsx](../views/Wallet.tsx) и блок настроек

## Правила приёмки

- Один визуальный ритм с дашбордом: отступы, радиусы, типографика.
- Меньше «тяжёлых» карточек подряд; группировка по смыслу.
- Не ломать контраст и читаемость в тёмной теме ([styles/globals.css](../styles/globals.css), Tailwind-токены `astro-*`).

## Статус

Чеклист: по мере прохождения отмечать в PR / коммитах; этот файл — якорь для порядка работ, не единичный редизайн всего приложения.
