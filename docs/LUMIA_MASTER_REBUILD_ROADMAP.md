# Lumia Master Rebuild Roadmap

Этот документ фиксирует главный поэтапный план перестройки Lumia от текущего состояния к новой целостной продуктовой модели.

Важно:

- это не техническая реализация одной задачи
- это не финальная схема БД
- это не разовый редизайн всего приложения
- это главный порядок работ, по которому дальше должны идти UX, copy, контентные слои, Lumi economy, дизайн и поддерживающие backoffice-изменения

Связанные документы:

- [LUMIA_PRODUCT_CONSTITUTION.md](./LUMIA_PRODUCT_CONSTITUTION.md)
- [LUMIA_PRODUCT_MODEL.md](./LUMIA_PRODUCT_MODEL.md)
- [LUMIA_CONTENT_TIER_SPEC.md](./LUMIA_CONTENT_TIER_SPEC.md)
- [MULTI_CHART_DB_ARCHITECTURE.md](./MULTI_CHART_DB_ARCHITECTURE.md)

## 1. Базовый порядок

Lumia перестраивается по принципу `consumer core first`.

Это значит:

- сначала собираем сильное пользовательское ядро
- не делаем хаотичный редизайн всех экранов сразу
- не ломаем БД заранее "на всякий случай"
- не делаем admin главным потоком, пока не собран основной пользовательский опыт

Зафиксированный порядок:

1. Dashboard Phase 2
2. Content-tier spec и продуктовый словарь
3. Forecast rebuild
4. Natal rebuild
5. Questions and Synastry rebuild
6. Lumi economy and retention system
7. AIR UI rollout
8. Support track для admin и notifications
9. Финальный cleanup старой модели

## 2. Phase 2 — Dashboard Product Hierarchy

Цель: сделать главный экран настоящим входом в личный сервис Lumia.

Что должно получиться:

- dashboard перестаёт ощущаться как widget hub
- главный смысл экрана строится вокруг человека, а не вокруг декоративной астрологии
- верхняя иерархия закрепляется как:
  - hero today
  - what matters today
  - natal entry
  - secondary actions
- `Synastry`, `Questions`, `Forecast entry` становятся вторичным слоем и больше не спорят с главным смыслом
- CTA приводятся к продуктовой логике:
  - прогноз = что важно сегодня
  - натал = твоя основа
  - совместимость = понять отношения
  - вопросы = получить личный ответ

Ограничения:

- без новых paywall-слоёв
- без DB-изменений
- без новой монетизации в этой фазе

## 3. Phase 3 — Content-Tier Spec and Product Vocabulary

После Dashboard Phase 2 фиксируется отдельная техспека новой продуктовой модели.

Нужно определить:

- `free vs premium forecast`
- `free natal anchor vs premium living natal`
- `free / lumi / premium synastry`
- `free / lumi / premium questions`

Параллельно фиксируется пользовательский язык Lumia:

- что остаётся публичным названием
- что уходит во внутренние dev-термины
- нужно ли переименовывать `Deep Dive`
- нужно ли переименовывать `Oracle`
- нужно ли убирать внешнее слово `Regenerate`

Также фиксируются правила copy:

- без дешёвой мистики
- без vague fluff
- без пустых красивых фраз
- Premium объясняется как другой класс продукта
- Lumi объясняется как точечные действия

## 4. Phase 4 — Forecast Layer Rebuild

Цель: сделать прогнозы отдельным сильным слоем Lumia по новой модели.

### Free forecast

- один серьёзный личный прогноз на день
- короткий
- полезный
- не фальшивый

### Premium forecast

- утро / день / вечер
- сильнее персонализация
- ближе к реальным состояниям, решениям, отношениям, деньгам, напряжению и шансам

Дополнительно:

- подготовить продуктовую основу для weekly/monthly слоёв
- убрать из consumer surface весь мусорный контент вроде color/number/day gimmicks
- moon-поля допускаются только как внутренняя часть расчётов, но не как дешёвый consumer gimmick

## 5. Phase 5 — Natal Rebuild Under New Product Law

Цель: пересобрать натальную часть по модели `anchor + living layer`.

### Free natal

- один серьёзный базовый разбор
- закрепляется за пользователем
- не перезаписывается автоматически

### Premium natal

- не просто длиннее
- это отдельный живой слой:
  - что активировалось сейчас
  - тема периода
  - сила и уязвимость
  - что меняется в отношениях, целях, деньгах

### Lumi

- отдельный точечный пересчёт
- новый ракурс
- дополнительное открытие

Natal screen должен ясно показывать разницу между:

- базовой картой
- живым premium-слоем
- Lumi-действиями

## 6. Phase 6 — Questions and Synastry Rebuild

**Статус (2026-03):** реализовано в продукте — синастрия: free brief, Lumi extended (`/api/content/synastry/extended`), Premium full с проверкой entitlement на сервере; кэш клиента по `chart_${id}`; спека: [LUMIA_CONTENT_TIER_SPEC.md](./LUMIA_CONTENT_TIER_SPEC.md).

Цель: усилить два самых эмоциональных продукта Lumia.

### Questions

- free limited entry
- Lumi one-off
- Premium deeper / stronger / higher-priority answers
- пользовательский нейминг `Oracle` должен быть отдельно переоценён

### Synastry

- free short entry
- Lumi one-off middle layer
- Premium full compatibility layer
- продукт должен работать не только для романтики, но и для:
  - дружбы
  - семьи
  - бизнеса
  - общего взаимопонимания

Оба экрана должны стать более человеческими и менее техническими.

## 7. Phase 7 — Lumi Economy and Retention System

Цель: сделать Lumi полноценной продуктовой экономикой.

Частично в коде: таксономия причин earn/spend/purchase/system и подписи транзакций — [lib/lumiReasonTaxonomy.ts](../lib/lumiReasonTaxonomy.ts); кошелёк — [Wallet.tsx](../views/Wallet.tsx); ежедневный вход и бонусы серии — `processDailyLogin` / `streakService` / БД.

### Earn loops

- daily login
- streaks
- roulette / daily bonus
- referrals / reposts
- другие meaningful engagement actions

### Spend taxonomy

- natal recalculation
- question
- synastry one-off
- extra forecast / transit reading
- другие точечные unlock actions

### Wallet direction

Wallet должен ясно объяснять:

- как получать Lumi
- на что тратить Lumi
- почему Lumi полезна
- почему это не просто "монетки ради монеток"

## 8. Phase 8 — AIR UI Design System Rollout

Чеклист порядка экранов: [AIR_UI_ROLLOUT.md](./AIR_UI_ROLLOUT.md).

Дизайн внедряется не одним редизайном, а экран за экраном.

Зафиксированное направление:

- light / dark AIR UI
- много воздуха
- минимум тяжёлых карточек
- мягкие градиенты
- мягкий depth и 3D-объекты без шума
- дорогой, спокойный, премиальный feel

Порядок внедрения:

1. dashboard
2. forecast
3. natal
4. synastry
5. questions
6. wallet / settings

Правило:

каждый новый экран Lumia должен ощущаться частью одной системы, а не отдельным экспериментом.

## 9. Support Track — Admin and Notifications

Ориентир для трека: [ADMIN_NOTIFICATIONS_SUPPORT.md](./ADMIN_NOTIFICATIONS_SUPPORT.md).

Admin остаётся supporting subsystem и не ведёт consumer roadmap.

Его задача:

- поддерживать новые content tiers
- поддерживать notification logic для free и premium
- давать редактуру шаблонов
- давать удобную сегментацию аудитории
- со временем дать нормальную recurring notification настройку

Но:

- admin не становится главным продуктовым потоком, пока не собран consumer core

## 10. Final Cleanup Track

Чеклист: [LEGACY_CLEANUP_CHECKLIST.md](./LEGACY_CLEANUP_CHECKLIST.md).

После сборки нового consumer core проводится cleanup старой модели.

Что сюда входит:

- удаление старых surface names, которые не ложатся в новый язык Lumia
- удаление устаревших widget/gimmick surfaces
- сведение старых content paths к новой tier architecture
- безопасный code/data cleanup только после закрепления новой схемы

## 11. Зафиксированные будущие технические направления

На текущем этапе код и БД не меняются этим документом, но направление заранее фиксируется.

После Dashboard Phase 2 и content-tier spec система должна уметь различать:

- `free daily`
- `premium morning`
- `premium day`
- `premium evening`
- `free natal anchor`
- `premium living natal`
- `free / lumi / premium synastry`
- `free / lumi / premium question`

Также в будущем должны появиться формальные продуктовые поля:

- `access_tier`
- `content_surface`
- `content_variant`
- `model_tier`
- `is_persistent`
- `can_regenerate_for_lumi`
- `valid_from`
- `valid_to`

И отдельно:

- Lumi должен получить понятную reason taxonomy для earn/spend
- surface naming в UI может измениться даже при временном сохранении старых backend endpoints

## 12. Правила принятия следующих фаз

Каждая следующая фаза принимается отдельно.

### Product acceptance

- экран ощущается user-centered, а не astrology-centered
- free слой выглядит серьёзным и полезным
- premium слой ощущается как другой класс продукта
- Lumi выглядит понятной валютой точечных действий

### UX acceptance

- copy взрослый, ясный, без мистического мусора
- интерфейс становится легче, чище и стабильнее на mobile / tablet / desktop

### Technical acceptance

- нет регрессий в расчётах карты
- нет регрессий в caching
- нет регрессий в multi-chart
- нет регрессий в wallet / premium / synastry / questions / admin auth

## 13. Ближайший следующий шаг

Состояние на текущую итерацию:

- **Dashboard Phase 2** — иерархия главного экрана (hero, «что важно», натал, вторичные действия); итерации — по конституции и [LUMIA_CONTENT_TIER_SPEC.md](./LUMIA_CONTENT_TIER_SPEC.md).
- **Content-tier spec** — матрица `tier × surface × variant` и ссылки на код в [LUMIA_CONTENT_TIER_SPEC.md](./LUMIA_CONTENT_TIER_SPEC.md).
- **Phase 6 (Questions + Synastry)** — закрыта в продукте (см. §6 выше): три слоя синастрии, вопросы free/Lumi/Premium.

Ближайшие implementation-фокусы:

1. **Phase 7 — Lumi economy**: углубление earn/spend (кошелёк, таксономия причин, новые петли начисления). База: [lib/lumiReasonTaxonomy.ts](../lib/lumiReasonTaxonomy.ts), [views/Wallet.tsx](../views/Wallet.tsx), ежедневный вход и серии уже в БД/API.
2. **Phase 8 — AIR UI**: поэкранный rollout — [AIR_UI_ROLLOUT.md](./AIR_UI_ROLLOUT.md) (Tailwind: токен `spacing.air`).
3. **Phase 9 — Support track**: admin и уведомления — [ADMIN_NOTIFICATIONS_SUPPORT.md](./ADMIN_NOTIFICATIONS_SUPPORT.md).
4. **Phase 10 — Cleanup**: чеклист — [LEGACY_CLEANUP_CHECKLIST.md](./LEGACY_CLEANUP_CHECKLIST.md).

Параллельно по зрелости продукта: **forecast** и **natal** остаются в зоне приёмки конституции (единый контракт, без gimmicks, якорь vs living) без смены номера фазы в §1.

Это текущий рабочий порядок Lumia.
