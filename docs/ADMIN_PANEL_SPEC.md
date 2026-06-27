# LUMIA — Спецификация админ-панели (v2, полная пересборка)

> Статус: ПРОЕКТ (design-first). Реализация — после согласования стартовой фазы.
> Стек: Next.js (pages router) + Postgres (pg) + Telegram Mini App. Платежи — Telegram Stars.
> Этот документ — источник правды по структуре, ролям, сущностям, правам, UX и критериям приёмки.

---

## 0. Привязка к реальности проекта + готовность к мультиплатформе (важно)

**Контекст:** сейчас это Telegram Mini App, но впереди — миграция на нативные **Android и iOS** (App Store / Google Play). Поэтому админку проектируем **мультиплатформенной с первого дня**: ничего не зашиваем жёстко под Telegram/Stars, а вводим абстракции, в которые потом просто добавится новая платформа/провайдер.

| В брифе | Сейчас (Telegram) | Проектное решение (с заделом на iOS/Android) |
|---|---|---|
| Отдельный web-login + email/пароль + 2FA | Вход по подписанным Telegram `initData` | **Абстракция identity-provider**: `auth_provider ∈ {telegram, apple, google, email}`. Сейчас telegram; админ-RBAC поверх provider-agnostic `user_id`. 2FA включим для email/web-входа на этапе native |
| App Store / Google Play / Stripe | Telegram Stars (`star_payments`) | **Абстракция billing-provider**: `payments`/`subscriptions` с полем `provider ∈ {telegram_stars, app_store, google_play, stripe}`. Раздел «Монетизация» агрегирует по провайдерам; refund-логика — стратегия на провайдер |
| Email-рассылки | Push (Telegram) + in-app | Канал как enum `channel ∈ {push, in_app, email}`; email подключим с native (нужен провайдер). Кампании уже проектируем мультиканальными |
| Amplitude / Mixpanel / Firebase | Внутренняя аналитика `user_app_events` | Свой event-pipeline + **поле `platform`** в каждом событии; интеграции (Firebase/Amplitude/RevenueCat) — как экспорт/синк, опционально |
| iOS/Android, страны, source | `platform` из Telegram, язык, source из deep-link | **`platform ∈ {telegram, ios, android, web}`** на `users` и событиях. Фильтры/сегменты/аналитика — по платформе. `app_version` тоже храним |
| RevenueCat / App Store Server Notifications | — | Заложить вебхуки подписок как **provider-вебхуки** (один контракт `subscription_event`), чтобы native-подписки прилетали в ту же таблицу |

**Ключевые абстракции, которые закладываем сразу (чтобы native-миграция не ломала админку):**
- `platform` (telegram/ios/android/web) — на пользователях и всех событиях.
- `auth_provider` — провайдер идентичности.
- `billing provider` + единый контракт `subscription_event` (purchase/renew/cancel/refund) — Stars сейчас, App Store/Google Play/Stripe потом.
- `channel` для коммуникаций (push/in_app/email).
- `app_version` — для фильтра «минимальная версия» и платформенных багов.

Принцип: **не тащить бутафорию** (NO STUBS — правило проекта), но и **не зашивать Telegram-онли** там, где скоро будет три платформы. Поля-заделы заводим осознанно, со значением `telegram` по умолчанию.

---

## 1. Цель

Дать команде управлять продуктом без участия разработчиков: пользователи, натальные данные, контент/промпты, монетизация, аналитика воронки, push-кампании, поддержка, настройки/feature-flags — под контролем ролей (RBAC), с журналом действий (audit log) и безопасными операциями над приватными данными.

---

## 2. Архитектура и безопасность (фундамент)

### 2.1 Аутентификация
- Вход в админку — только через Telegram Mini App с валидными `initData` (уже проверяется в `lib/adminAuth.ts`).
- `OWNER_ID` (env) → всегда **Super Admin**.
- Доступ к админке — только у пользователей, заведённых в таблице `admin_users` (новая), со статусом `active`.
- Session timeout: для админских роутов ужесточить `TELEGRAM_INIT_DATA_MAX_AGE` (напр. 1–2 ч вместо 24 ч).

### 2.2 Авторизация (RBAC)
- Каждый админский API проходит `requireAdminPermission(req, '<permission_key>')`.
- Разрешения — гранулярные ключи (см. §7). Роль = набор ключей.
- Запрет повышения привилегий: только Super Admin меняет роли; нельзя выдать роль выше своей.

### 2.3 Защита данных
- Чувствительные поля (дата/время/место рождения, координаты) маскируются по умолчанию; раскрытие требует право `user.pii.view` и **логируется** в audit как `pii_viewed`.
- Все мутации — через сервер; никаких прямых правок из клиента.
- Rate-limit на чувствительные действия (refund, рассылка, экспорт, удаление).
- Опасные операции — двойное подтверждение (ввод подтверждающего слова/он-чейн confirm-токен).
- Уведомление Super Admin (push) при критичных событиях (смена роли, массовая рассылка, удаление данных).

### 2.4 Audit log
- Append-only таблица `admin_audit_log`. Нет UI для редактирования/удаления.
- Хелпер `recordAdminAction({...})` вызывается каждым мутирующим эндпоинтом и при просмотре PII.

---

## 3. Карта разделов

```
A. Dashboard            — ключевые метрики, воронка, retention, последние важные события
B. Пользователи         — поиск, фильтры, карточка, статусы, заметки, экспорт/удаление
C. Натальные профили    — астроданные, статус расчёта, пересчёт, тест-режим
D. Контент (CMS)        — гороскопы/интерпретации/онбординг/paywall/push/FAQ: draft→published
E. AI / Промпты         — шаблоны генерации, версии, превью, тест на демо-профиле, A/B, approval
F. Монетизация          — подписки, Stars-платежи, промокоды, paywall-конфиги, revenue
G. Аналитика            — acquisition/activation/engagement/retention/monetization, воронки, когорты
H. Коммуникации         — push-кампании, сегменты, расписание, A/B, статистика доставки
I. Поддержка            — тикеты/жалобы, статусы, SLA, быстрые действия
J. Роли и доступы       — admin_users, роли, матрица прав
K. Audit log            — журнал действий (только чтение)
L. Настройки            — feature flags, A/B, maintenance, лимиты, интеграции
M. Безопасность         — сессии, подтверждения, PII-доступы, политика удаления
```

Левое меню скрывает разделы, к которым у роли нет доступа.

---

## 4. Экраны (по разделам)

### A. Dashboard
- **A1 Обзор**: карточки KPI (новые юзеры day/week/month; DAU/WAU/MAU; всего карт; открытий гороскопа; проверок совместимости; trial-конверсия; оплата-конверсия; MRR/Revenue/ARPU/ARPPU; churn; retention D1/D7/D30; ошибки расчёта карты; ошибки платежей). Ниже — графики, **воронка** (signup → birth_data → natal_chart → interpretation → paywall → purchase), retention/cohort-блок, лента последних важных событий (refund, блокировка, ошибка платежа, новый тикет).

### B. Пользователи
- **B1 Список**: таблица (поиск по id/имени/username; фильтры: дата регистрации, статус аккаунта, подписка, платформа, язык, source, активность (active/inactive Nd), наличие карты, премиум; сортировка; пагинация; сохранённые фильтры; bulk-actions). PII в списке скрыта.
- **B2 Карточка пользователя** (side-panel + полный экран):
  - Профиль, статус (active/blocked/pending_deletion/deleted), премиум/триал.
  - Активность: история сессий, открытые экраны (из `user_app_events`), retention-маркеры.
  - Платежи (Stars), пуши/сообщения, натальные профили, избранные гороскопы/совместимости, тикеты.
  - PII (дата/время/место) — под кнопкой «Показать» (право + audit).
  - Действия: блок/разблок, выдать/снять премиум, пересчитать карту, экспорт данных, запустить удаление, заметки саппорта.

### C. Натальные профили
- **C1 Список профилей**: владелец, имя профиля, дата/время/место (маск.), координаты, TZ, система домов, язык, дата создания, статус расчёта (ok/error), версия алгоритма.
- **C2 Карточка профиля**: входные данные расчёта, результат (Солнце/Луна/Асц/дома/аспекты), ошибки, кнопка «Пересчитать», «Что использовалось для расчёта».
- **C3 Тест-режим**: ввести дату/время/место → проверить расчёт (дергает реальный `calculateNatalChart`), увидеть результат и источник (SWIEPH/Moshier, геокодер). Несколько профилей на юзера поддержаны (я/партнёр/друг/ребёнок).

### D. Контент (CMS)
- **D1 Список контента** по типам: daily/weekly/monthly гороскопы, гороскопы по знакам, интерпретации планет/домов/аспектов, совместимость, матрица судьбы, onboarding stories, paywall-тексты, push-тексты, акции, FAQ, статьи.
- Поля каждого: статус (draft/scheduled/published/archived), язык, регион, дата публикации, автор/редактор, превью, история версий + откат, теги, категории, (SEO/ASO — если web). Bulk-edit.
- **D2 Редактор контента**: форма + превью + расписание публикации + версии.
- Реальность: значительная часть текста — AI/локальные библиотеки. CMS управляет: **статическим** контентом (онбординг/paywall/FAQ/push), **переопределениями** (override авто-генерации) и связкой с разделом E (промпты).

### E. AI / Промпты
- **E1 Список шаблонов/промптов**: тип (natal/daily/compatibility/push/onboarding/paywall), язык, версия, статус (test/active/archived), автор, дата.
- **E2 Редактор промпта**: текст + ограничения тона (мягкий/персональный, без медицинских/финансовых/фаталистичных обещаний — список запретов), draft→preview→approval→publish (нельзя выкатить всем без approval), лог изменений.
- **E3 Тест генерации**: прогон на демо-профиле, сравнение версий, A/B-тест.

### F. Монетизация (provider-agnostic — Stars сейчас, App Store/Google Play/Stripe потом)
- **F1 Подписки**: список (`subscriptions`), тариф, триал, цена, статус, отмены/возвраты, история платежей юзера. Колонка/фильтр **provider** и **platform**.
- **F2 Платежи**: единый журнал (`payments`) по всем провайдерам; статусы, ошибки, фильтр по provider/platform. Refund — **стратегия на провайдер** (Telegram refundStarPayment сейчас; App Store/Google Play/Stripe refund — на этапе native).
- **F3 Промокоды/скидки/акции**: создание, лимиты, срок, использование.
- **F4 Paywall-конфиги**: варианты, цены, A/B-тесты, конверсия каждого paywall (paywall_viewed→trial→purchase).
- **F5 Revenue dashboard**: MRR/Revenue/ARPU/ARPPU/churn.

### G. Аналитика
- **G1 Acquisition** (source/deep-link), **G2 Activation** (дошёл до первой карты), **G3 Engagement** (частота открытий), **G4 Retention** (D1/D7/D30 + когорты), **G5 Monetization** (trial/purchase/renewal/refund/cancel), **G6 Feature usage** (гороскопы/карты/совместимость/push open rate), **G7 Воронки** (конструктор воронки по событиям), **G8 Сегменты**.

### H. Коммуникации
- **H1 Кампании**: создать push-кампанию → сегмент (язык/платформа/подписка/активность) → шаблон → превью → расписание (timezone-aware) → A/B заголовков → лимиты частоты.
- **H2 Статистика**: sent/delivered/opened/conversion по кампании.
- **H3 Сценарии ретеншена** (живой движок): включение/выключение, тексты, диагностика.

### I. Поддержка
- **I1 Тикеты**: список (пользователь, тема, статус, приоритет, ответственный, SLA), переписка, внутренние заметки, теги.
- **I2 Быстрые действия**: refund, проверить подписку, заблокировать, отправить инструкцию.
- **I3 Аналитика обращений** по типам.

### J. Роли и доступы
- **J1 Admin users**: список админов, роль, статус, кем добавлен.
- **J2 Матрица прав**: роль × разрешения (см. §7), редактирование — только Super Admin.

### K. Audit log
- **K1 Журнал**: фильтры (админ, тип действия, сущность, дата, результат), детальная запись (старое/новое значение, IP, UA, роль, ошибка). Только чтение.

### L. Настройки
- **L1 Feature flags / A/B**, **L2 Maintenance mode + мин. версия**, **L3 Языки/регионы**, **L4 Лимиты генерации**, **L5 Интеграции** (Stars/Telegram/аналитика-экспорт).

### M. Безопасность
- **M1 Активные сессии админов**, **M2 PII-доступы (из audit)**, **M3 Очередь удалений данных**, **M4 Подтверждения опасных операций**.

---

## 5. Сущности и связи (модель данных)

Существующие (reuse): `users`, `natal_charts`, `star_payments`, `user_app_events`, `notification_*` (scenarios/templates/campaigns/log/queue), `user_notification_settings`, `daily_cards`, `content_interpretations`, `synastry_cache`.

**Заделы под мультиплатформу (добавить полями, default `telegram`):**
- `users`: `platform`, `auth_provider`, `app_version`, `country`.
- `user_app_events`: `platform`, `app_version` (в payload или колонками).
- Биллинг: НЕ расширять `star_payments`, а ввести единый слой `payments` + `subscriptions` с `provider` (см. ниже); `star_payments` остаётся источником для провайдера `telegram_stars` (или мигрируется в общий `payments`).

Новые таблицы:
- `admin_users(user_id PK, role, status, created_by, created_at, updated_at)`
- `admin_roles(role PK, name, permissions JSONB)` *(или роли в коде + переопределения в БД)*
- `admin_audit_log(id, actor_user_id, actor_role, action, entity_type, entity_id, before JSONB, after JSONB, ip, user_agent, result, error, created_at)` — append-only
- `cms_content(id, type, locale, region, status, title, body JSONB, tags, category, author_id, scheduled_at, published_at, version, created_at, updated_at)`
- `cms_content_versions(id, content_id, version, body JSONB, editor_id, created_at)`
- `ai_prompts(id, type, locale, version, status, body, tone_rules JSONB, author_id, approved_by, created_at)` + `ai_prompt_versions`
- `payments(id, user_id, provider, provider_txn_id, amount, currency, status, app_version, platform, created_at)` — единый журнал платежей по всем провайдерам (telegram_stars сейчас; app_store/google_play/stripe потом)
- `subscriptions(id, user_id, provider, plan, status, trial_until, current_period_end, auto_renew, platform, created_at, updated_at)` — единый слой подписок; native-провайдеры прилетают через вебхуки в тот же контракт
- `promo_codes(code PK, type, value, max_uses, used_count, starts_at, expires_at, status, created_by)`
- `promo_redemptions(id, code, user_id, redeemed_at)`
- `paywall_configs(id, key, variant, config JSONB, is_active, ab_weight)`
- `support_tickets(id, user_id, subject, status, priority, assignee_id, sla_due_at, tags, created_at, updated_at)` + `support_messages(id, ticket_id, author_type, author_id, body, internal BOOL, created_at)`
- `feature_flags(key PK, value JSONB, description, updated_by, updated_at)`
- `data_deletion_requests(id, user_id, requested_by, status, scheduled_for, completed_at)`

Связи: `admin_users.user_id → users.id`; `natal_charts.user_id → users.id`; `star_payments.user_id → users.id`; `cms_content_versions.content_id → cms_content.id`; `support_messages.ticket_id → support_tickets.id`; audit ссылается на любую сущность через `(entity_type, entity_id)`.

---

## 6. Event taxonomy (аналитика)

Канон событий в `user_app_events(event_type, section, source, payload_json, occurred_at)`. Минимум:

`app_opened, signup_started, signup_completed, onboarding_started, onboarding_completed, birth_data_started, birth_data_completed, natal_chart_generated, natal_chart_opened, horoscope_opened, compatibility_started, compatibility_completed, paywall_viewed, trial_started, subscription_started, subscription_cancelled, purchase_failed, push_sent, push_opened, account_delete_requested`.

Общие properties: `user_id, platform, app_version, country, language, subscription_status, source, timestamp`. Спец-properties по событию (напр. `natal_chart_generated`: profileId, calcSource, durationMs; `paywall_viewed`: paywallKey, variant; `purchase_failed`: reason).

Часть уже шлётся (`screen_view, paywall_view, purchase, push_*`). Нужно: привести к канону, дослать недостающие из клиента, описать единый `track()` контракт.

---

## 7. Роли и матрица прав (RBAC)

Роли: **Super Admin, Admin, Content Manager, Support, Analyst, Finance, Marketing, Read Only.**

Разрешения (ключи): `users.view, users.edit, users.block, user.pii.view, users.delete, users.export, charts.view, charts.recalc, content.view, content.edit, content.publish, ai.view, ai.edit, ai.publish, billing.view, billing.refund, promo.manage, paywall.manage, analytics.view, push.send, push.manage, support.view, support.act, roles.manage, audit.view, settings.manage`.

Матрица (✓ = есть право):

| Право | Super | Admin | Content | Support | Analyst | Finance | Marketing | ReadOnly |
|---|---|---|---|---|---|---|---|---|
| users.view | ✓ | ✓ | – | ✓ | ✓ | – | ✓ | ✓ |
| users.edit | ✓ | ✓ | – | ✓ | – | – | – | – |
| users.block | ✓ | ✓ | – | ✓ | – | – | – | – |
| user.pii.view | ✓ | ✓ | – | ✓¹ | – | – | – | – |
| users.delete | ✓ | – | – | – | – | – | – | – |
| users.export | ✓ | ✓ | – | ✓ | – | – | – | – |
| charts.view | ✓ | ✓ | – | ✓ | ✓ | – | – | ✓ |
| charts.recalc | ✓ | ✓ | – | ✓ | – | – | – | – |
| content.view | ✓ | ✓ | ✓ | – | ✓ | – | ✓ | ✓ |
| content.edit | ✓ | ✓ | ✓ | – | – | – | ✓ | – |
| content.publish | ✓ | ✓ | ✓ | – | – | – | – | – |
| ai.view | ✓ | ✓ | ✓ | – | ✓ | – | – | – |
| ai.edit | ✓ | ✓ | – | – | – | – | – | – |
| ai.publish | ✓ | – | – | – | – | – | – | – |
| billing.view | ✓ | ✓ | – | ✓ | ✓ | ✓ | – | ✓ |
| billing.refund | ✓ | ✓ | – | – | – | ✓ | – | – |
| promo.manage | ✓ | ✓ | – | – | – | ✓ | ✓ | – |
| paywall.manage | ✓ | ✓ | – | – | – | – | ✓ | – |
| analytics.view | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| push.send | ✓ | ✓ | – | – | – | – | ✓ | – |
| push.manage | ✓ | ✓ | – | – | – | – | ✓ | – |
| support.view | ✓ | ✓ | – | ✓ | – | – | – | ✓ |
| support.act | ✓ | ✓ | – | ✓ | – | – | – | – |
| roles.manage | ✓ | – | – | – | – | – | – | – |
| audit.view | ✓ | ✓ | – | – | – | – | – | – |
| settings.manage | ✓ | – | – | – | – | – | – | – |

¹ Support видит PII только в контексте открытого тикета этого юзера.

---

## 8. Audit log — что логируем

`admin_login, admin_login_failed, role_changed, pii_viewed, user_edited, user_blocked, user_unblocked, user_deleted, data_exported, subscription_changed, refund_issued, content_published, content_reverted, prompt_changed, prompt_published, push_sent, campaign_created, settings_changed, feature_flag_changed, deletion_requested, deletion_completed`.

Каждая запись: actor, роль, время, entity_type/id, before/after, IP, UA, result(ok/error), error. Хранение — append-only.

---

## 9. UX-логика (таблицы/фильтры/действия)
- Левое меню по ролям; глобальный поиск (юзер/тикет/платёж).
- Таблицы: серверная пагинация, сортировка, фильтры, сохранённые фильтры, bulk-actions, quick-view side-panel.
- Понятные статусы (бейджи), breadcrumbs, пустые/loading/error состояния.
- Опасные действия — модал подтверждения с явным текстом и (для критичных) вводом подтверждающего слова.
- Только релевантные роли действия показываются.
- Адаптив tablet/desktop; единый дизайн (fresh-ui токены проекта).

---

## 10. Опасные операции (всегда подтверждение + audit)
Удаление пользователя/данных; блокировка; refund; массовая рассылка; публикация контента; изменение/публикация prompt; изменение paywall; смена роли; maintenance mode; изменение feature-flag; экспорт PII.

---

## 11. Acceptance criteria (когда готово)
1. Найти любого юзера и открыть карточку (поиск/фильтр/сортировка/пагинация работают на больших объёмах).
2. Безопасно менять статус юзера (блок/разблок, премиум) — с подтверждением и audit.
3. Видеть и фильтровать натальные профили; пересчитать карту; тест-режим расчёта работает.
4. Управлять контентом с draft/scheduled/published/archived + версии/откат.
5. RBAC: обычный админ не имеет доступа к Super-Admin функциям; меню/право скрыты и защищены на сервере.
6. Audit log пишется на все опасные действия и просмотр PII; неизменяем из UI.
7. Dashboard с ключевыми метриками + воронка + retention.
8. Базовая продуктовая аналитика (acquisition/activation/retention/monetization/feature usage).
9. Push-кампании: сегмент → шаблон → расписание → статистика.
10. Монетизация: подписки/платежи/paywall/промокоды; refund защищён.
11. Экспорт и удаление данных пользователя (GDPR-style) с очередью и подтверждением.
12. Все ошибки показаны понятно; админка не падает на больших списках.

---

## 12. План реализации (фазы)

> Старую админку **не удаляем разом** — иначе доступ к управлению пропадёт на время сборки. Удаляем по мере замены, экран за экраном. Финально — чистка `views/admin/*` и старых роутов.

- **Фаза 1 — Фундамент (БЕЗ него остальное небезопасно):** `admin_users` + RBAC (`requireAdminPermission`), `admin_audit_log` + `recordAdminAction`, новый admin-shell (левое меню по ролям), экран **Roles/доступы**, базовый **Dashboard** (KPI из уже имеющихся данных), новый **Users** (список+карточка+блок+премиум+PII-gate+audit). Параллельно старые вкладки ещё доступны.
- **Фаза 2 — Натальные профили + Аналитика-воронка:** раздел C (список/карточка/пересчёт/тест-режим) + канон event taxonomy + воронка/ретеншн на Dashboard.
- **Фаза 3 — Монетизация:** Stars-платежи, подписки, refund (защищён), промокоды, paywall-конфиги, revenue.
- **Фаза 4 — Контент (CMS) + AI/Промпты:** draft→published + версии/откат; промпты с approval/preview/тест.
- **Фаза 5 — Коммуникации + Поддержка:** перенос/обновление push-кампаний под новый каркас; тикеты/SLA.
- **Фаза 6 — Настройки/Feature flags + Безопасность + чистка старого админ-кода.**

Каждая фаза: миграции БД → серверные эндпоинты с RBAC+audit → экраны → тесты → удаление замещённого старого.
```
```
