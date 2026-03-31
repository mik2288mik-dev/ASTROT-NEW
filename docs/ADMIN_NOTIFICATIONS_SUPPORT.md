# Admin and notifications — support track (Phase 9)

Из [LUMIA_MASTER_REBUILD_ROADMAP.md](./LUMIA_MASTER_REBUILD_ROADMAP.md) §9: admin остаётся supporting subsystem и не ведёт consumer roadmap.

## Текущая база в коде

- Админ-панель: [views/AdminPanel.tsx](../views/AdminPanel.tsx), вкладки в `views/admin/`.
- Уведомления: маршруты `pages/api/admin/notifications/*`, шаблоны и доставка.

## Цели трека

- Поддержка новых content tiers (`free` / `lumi` / `premium`) в сегментации и шаблонах.
- Редактируемые шаблоны уведомлений и предпросмотр.
- Сегментация аудитории (premium, активность, need attention — см. admin users).
- В перспективе: нормальные recurring-настройки уведомлений для пользователя (не блокирует consumer core).

## Ограничение

До стабилизации consumer core (прогноз, натал, вопросы, синастрия, Lumi) приоритет изменений здесь — **поддержка**, а не расширение admin вместо продукта.
