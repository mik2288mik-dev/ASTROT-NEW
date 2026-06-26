# Lumia / ASTROT — контекст для следующих задач

Дата аудита: 2026-06-26. Этот файл — короткая подсказка для каждого следующего задания: сначала сверяйся с ним, затем с более подробными документами из `docs/`.

## Что это за приложение

Lumia / ASTROT — Next.js + React + TypeScript приложение для Telegram Mini App и веб-гостей: гороскопы, натальные карты, персональные прогнозы, совместимость, Ask Lumia, Premium через Telegram Stars, админка и система уведомлений.

## Текущая архитектура

- Входная страница Next.js — `pages/index.tsx`, она рендерит корневой `App.tsx`.
- Главный клиентский оркестратор — `App.tsx`: старт Telegram/web guest сессии, профиль, карта, навигация, prewarm контента, deep links из уведомлений.
- UI-экраны лежат в `views/`, переиспользуемые компоненты — в `components/`.
- Клиентские сервисы лежат в `services/`; серверная бизнес-логика, матрицы доступа, промпты, БД и расчёты — в `lib/`.
- API — Pages Router в `pages/api/`; активный продуктовый контур в основном под `/api/content/*`, `/api/charts/*`, `/api/users/*`, `/api/subscriptions/*`, `/api/admin/*`, `/api/cron/*`.
- PostgreSQL/Railway — основной persistence слой; миграции в `lib/migrations.ts` и `scripts/migrate.ts`.
- Swiss Ephemeris использует файлы из `ephe/`; расчёты карты — через `lib/swisseph-calculator.ts` и API `/api/astrology/natal-chart` как совместимый маршрут.

## Продуктовая модель и доступ

- Canonical auth: `requireAppUser` / `lib/auth/appAuth.ts`; поддерживаются Telegram initData, web guest session cookie/Bearer, native session.
- Feature access: `lib/accessMatrix.ts`. Free: sign horoscope, zodiac compatibility, базовая натальная карта при наличии карты. Pro/Premium: personal daily, natal paid sections, transits/synastry by charts/deep report.
- Content policy: `lib/contentMatrix.ts`. Здесь источник правды по типам контента, TTL, cache scope, generation policy, prompt version и модели.
- Новый код не должен возвращаться к legacy `profile.generatedContent`; допустим только server-side fallback compatibility.

## Основные пользовательские потоки

1. Startup: Telegram initData/session → профиль → primary chart → быстрый cache-only prewarm → Dashboard.
2. Onboarding: сбор birth data, сохранение профиля/карты, 14-дневный trial для новых пользователей.
3. Dashboard / Today: общая дневная повестка, sign horoscope, локальная мотивация, personal blocks только при chart + Premium.
4. Horoscope: sign daily/weekly/monthly без обязательной карты; personal dayparts отдельно и gated.
5. Natal: базовая карта free при наличии карты; расширенные секции и living/full/planet insights — Premium.
6. Union/Synastry: sign compatibility free без карты; full synastry requires charts + Premium.
7. Ask Lumia: вопросы через `/api/content/question/*`, история и tiering через content/access matrix.
8. Admin + notifications: управление пользователями, шаблонами, ассетами, сценариями, расписаниями, очередью и cron-диспетчером.

## Важные правила для будущих изменений

- Не ломать `npm test`; текущий baseline — все Jest тесты проходят.
- Перед изменениями в API/доступе сверять `lib/accessMatrix.ts`, `lib/contentMatrix.ts`, `docs/LUMIA_PRODUCT_MODEL.md`, `docs/LUMIA_CONTENT_TIER_SPEC.md`.
- Перед изменениями в контенте/AI-промптах сверять `docs/LUMIA_CONTENT_STYLE.md`, `docs/LUMIA_VOICE_GUARD.md`, `lib/lumiaVoice.ts`, `lib/contentPromptBuilders.ts`.
- Не генерировать тяжёлый AI-контент на старте приложения; prewarm на старте должен оставаться лёгким и cache-only.
- Миграции считать историей: не удалять применённые миграции и не делать опасные resets без явного задания.
- Секреты не хардкодить; использовать `.env.example` как контракт переменных.
- Для Telegram API всегда передавать/проверять initData там, где требуется зарегистрированный пользователь.
- Для web guest flows учитывать отрицательные guest IDs и запрет guest-доступа к registered-only фичам.

## Текущий статус готовности по аудиту

Оценка готовности после cleanup-задачи: примерно **88%**.

Почему не выше:

- Функциональный скелет большой и зрелый: 105 API routes, 262 TS/TSX файла в основных слоях, 55 Jest suites / 338 tests проходят.
- Production build проходит, но в локальной среде возможны предупреждения из-за отсутствующих production-переменных `DATABASE_URL` и `OWNER_ID`.
- Lint baseline приведён к зелёному состоянию: `eslint-plugin-react-hooks` подключён в flat config, unused-symbol baseline разобран.
- Клиентские расчёты карты переведены на canonical `/api/charts`; `/api/astrology/natal-chart` остаётся только совместимым серверным маршрутом для старых клиентов/тестов.
- Legacy-дубликат `lumia 2.0/` удалён из репозитория.
- Добавлены smoke-контракты для startup/onboarding, chart creation, horoscope, natal Premium gate, payment activation, admin notification self-test и observability.
- Админка и notification engine функциональны, но всё ещё требуют ручной TMA/production приёмки, delivery/retry наблюдения и регулярного security/dependency audit.

## Что доделать в ближайших задачах

1. Провести ручной QA в Telegram Mini App: safe areas, back/swipe, deep links из start_param, light/dark themes, slow network.
2. Прогнать smoke-сценарии на staging с реальными Telegram initData, БД, OpenAI и Telegram Stars.
3. Расширить E2E из статических smoke-контрактов до браузерных Playwright/Cypress тестов, когда будет добавлен E2E runner.
4. Завершить удаление совместимого `/api/astrology/natal-chart`, когда будет подтверждено, что старые клиенты больше не вызывают этот маршрут.
5. Усилить внешние алерты: подключить Sentry/LogRocket или другой backend для `lib/errorTracking.ts`, добавить алерты по OpenAI/Telegram/DB failures.
6. Обновить dependency hygiene: browserslist/baseline data, проверить Next/React/ESLint совместимость и security audit.

## Быстрый чеклист перед каждой следующей задачей

- Какой слой меняем: UI (`views/components`), client service (`services`), API (`pages/api`), domain (`lib`), DB migration, docs/tests?
- Нужно ли обновить tests/docs рядом с изменением?
- Не меняет ли задача продуктовый доступ Free/Premium? Если да — обновить access/content matrix и тесты.
- Не создаёт ли задача генерацию AI на startup? Если да — остановиться и пересмотреть.
- Нужна ли миграция БД? Если да — сделать additive/immutable migration и проверить `npm run build`/`npm test`.
