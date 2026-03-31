# AIR UI rollout (Phase 8)

Направление из [LUMIA_MASTER_REBUILD_ROADMAP.md](./LUMIA_MASTER_REBUILD_ROADMAP.md) §8: светлый/тёмный AIR UI, больше воздуха, мягкие градиенты, премиальный спокойный тон.

## Токены (единый источник)

| Токен | Где задан | Назначение |
|-------|-----------|------------|
| `--space-air-sm` | [styles/globals.css](../styles/globals.css) (`:root`) | Малый вертикальный шаг (clamp) |
| `--space-air` | `globals.css` `:root` | Базовый шаг между блоками |
| `--space-air-lg` | `globals.css` `:root` | Крупные разрывы между секциями |
| `--radius-air` / `--radius-air-sm` / `--radius-air-panel` | `globals.css` `:root` | Радиусы карточек и вложенных блоков |
| Tailwind `p-air`, `gap-air`, `space-y-air`, `rounded-air-panel` | [tailwind.config.js](../tailwind.config.js) | Утилиты поверх CSS variables |
| `astro-*` | CSS variables + Tailwind | Фон, текст, акцент, границы |
| `lumia-glass` | [styles/globals.css](../styles/globals.css) | Стеклянная поверхность карточки |

**Стили:** только сборка Next.js + PostCSS ([tailwind.config.js](../tailwind.config.js), [styles/globals.css](../styles/globals.css)). CDN Tailwind в документе не используется — один источник правды.

## Примитивы layout

- [components/layout/ScreenShell.tsx](../components/layout/ScreenShell.tsx) — `ScreenShell`, `ReadingScreenShell`, `AirSection`, константа `AIR_GLASS_PANEL_CLASS`.
- [components/layout/ReadingLayout.tsx](../components/layout/ReadingLayout.tsx) — колонка чтения `READING_PAGE_CLASS`, `READING_GLASS_SECTION_CLASS` (= glass-панель AIR).

**Ширина `main`:** `max-w-md md:max-w-reading-wide` в [App.tsx](../App.tsx) — узкая колонка на телефоне, комфортная ширина для текста на планшете и десктопе.

## Порядок внедрения (экран за экраном)

1. [views/Dashboard.tsx](../views/Dashboard.tsx) — эталон ритма
2. [views/Horoscope.tsx](../views/Horoscope.tsx) + [components/Horoscope/HoroscopeContent.tsx](../components/Horoscope/HoroscopeContent.tsx)
3. [views/NatalChart.tsx](../views/NatalChart.tsx)
4. [views/Synastry.tsx](../views/Synastry.tsx)
5. [views/OracleChat.tsx](../views/OracleChat.tsx)
6. [views/Wallet.tsx](../views/Wallet.tsx) и [views/Settings.tsx](../views/Settings.tsx)

### Статус чеклиста

| Экран | Статус |
|-------|--------|
| Dashboard | Done — ScreenShell, AirSection, `rounded-air-panel`, CTA ≥44px |
| Horoscope | Done — ReadingScreenShell, READING_GLASS_SECTION_CLASS, `space-y-air` |
| NatalChart | Done — ReadingScreenShell, glass-панели, `min-h-0` / кнопки |
| Synastry | Done — ScreenShell, `rounded-air-panel`, hero glass |
| Oracle | Done — `min-h-0` flex, air spacing, крупные tap-зоны |
| Wallet / Settings | Done — glass-панели, ScreenShell |

Глобально: `:focus-visible`, `prefers-reduced-motion` в [styles/globals.css](../styles/globals.css); header — минимальные tap-зоны 44px ([components/Header.tsx](../components/Header.tsx)).

## Правила приёмки

- Один визуальный ритм с дашбордом: отступы (`air*`), радиусы (`air-panel`), типографика.
- Меньше «тяжёлых» карточек подряд; группировка по смыслу через `space-y-air-lg`.
- Не ломать контраст и читаемость в тёмной теме (`astro-*`, `lumia-glass`).

## Матрица регрессии (ручная)

После релиза проверить: Telegram Mini App (iOS / Android), светлая и тёмная тема; ширины 320 / 390 / 768; нижний safe-area и скролл внутри `main` без горизонтального overflow; фокус с клавиатуры на десктопе.
