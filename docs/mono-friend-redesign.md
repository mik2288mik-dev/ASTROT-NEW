# LUMIA · Mono Friend — план редизайна

> Направление: монохромный line-art «дружелюбный друг», не дневник и не космос.  
> Референсы: feed+article, chat-landing, bento-student — **адаптация под LUMIA**, не копия.

## Принципы

| Что | Как |
|-----|-----|
| Фон | `#FAFAFA` / `#FFFFFF`, без точечной сетки и washi |
| Типографика | Manrope bold заголовки; опционально Lora/serif для длинных статей и Союза |
| Иллюстрации | Line-art на серой плашке `#F2F2F2`, люди/пары/сцены |
| CTA | Чёрные pill-кнопки; terracotta `#C45C4A` только на hero «Совместимость» |
| Акценты | Без пастели, маркеров, Caveat, RoughBorder |

## Жёсткие ограничения

- **Не трогать:** API, routing, hooks, premium, Telegram, `App.tsx` ViewState.
- Только визуальный слой: CSS, JSX-разметка, SVG-иллюстрации.

## Приоритет продукта

1. Гороскоп  
2. Натальная карта  
3. **Совместимость** — hero на Home (чёрный bento), Share на результатах  

---

## Фазы

### Phase 0 — Foundation ✅ старт здесь

**Файлы:** `styles/globals.css`, `tailwind.config.js`, `components/mono-ui/*`

- CSS-токены `--mono-*` (bg, plate, ink, muted, line, accent)
- Tailwind `mono.*`, `font-monoDisplay`
- Примитивы: `MonoPage`, `MonoCard`, `MonoButton`, `MonoAvatar`, `MonoHeader`, `MonoTag`, `MonoBentoTile`, `MonoListRow`, `MonoArticle`, `MonoChatBubble`, `MonoSegment`, `MonoInput`, `MonoShareBar`
- Иллюстрации: `MonoIllustrations` (person, couple, horoscope, chart)
- Класс `.mono-page` вместо `.doodle-paper`

**Критерий:** tsc проходит, примитивы экспортируются из `components/mono-ui/index.ts`.

---

### Phase 1 — Dashboard (Today)

**Файл:** `views/Dashboard.tsx`

- Hello header: аватар + «Привет, {name}» + дата
- Hero: серая плашка + line-art «личный день», pill-тег, стрелка
- Date selector: белые кapsule, активный день — чёрный круг
- Bento «Твой план»:
  - **Чёрная плитка «Совместимость»** (hero CTA)
  - Серая «Гороскоп»
  - Белая «Натальная карта» + знаки
  - Ряд быстрых действий (Ask / Personal day)
- `DaySheet`, `HoroscopeStories`, `PersonalDailyStories` — без изменения логики

---

### Phase 2 — Tab bar + shell

**Файлы:** `components/lumia-ui/LumiaBottomTabBar.tsx`, `styles/globals.css`

- Минимальный tab bar: line icons, активный — чёрный fill
- Белый фон, тонкая линия сверху
- Safe-area без изменения высоты/clearance

---

### Phase 3 — Horoscope

**Файлы:** `views/Horoscope.tsx`, `components/lumia-ui/HoroscopeStories.tsx`

- Обложка stories: mono hero (серая плашка + doodle)
- Типографика статей: sans заголовки, muted body
- Pill-теги знака / «сегодня»
- Убрать cosmic gradients

---

### Phase 4 — Personal daily + DaySheet

**Файлы:** `components/lumia-ui/PersonalDailyStories.tsx`, `components/lumia-ui/DaySheet.tsx`

- Тот же article/stories паттерн, mono palette
- DaySheet: белая шторка, чёрные строки дня

---

### Phase 5 — Natal chart

**Файлы:** `views/NatalChart.tsx`, `components/NatalReading/HumanReport.tsx`

- Empty state: mono card + CTA
- Report: article layout (kicker, h1, sections, gray quote blocks)
- Без astro-dark и фиолетовых kickers

---

### Phase 6 — Synastry (Union)

**Файл:** `views/Synastry.tsx`

- Landing: serif headline + couple illustration
- `MonoSegment` для режимов
- Форма: mono inputs
- Результаты: `MonoArticle` секции + `MonoShareBar` внизу
- Terracotta только на primary CTA «Проверить связь»

---

### Phase 7 — Ask Lumia

**Файл:** `views/OracleChat.tsx`

- Chat bubbles: серый (user) / чёрный (Lumia)
- Quick reply pills
- Mono header «Спроси Lumia»

---

### Phase 8 — Onboarding + My Charts

**Файлы:** `views/Onboarding.tsx`, `views/MyCharts.tsx`

- Splash-hero + illustration + «Let's go» black CTA
- My Charts: чёрные list rows, search bar, segmented filter

---

### Phase 9 — Settings + Paywall

**Файлы:** `views/Settings.tsx`, `views/Paywall.tsx`

- Светлый mono (не `bg-astro-bg` dark)
- List rows, toggles, premium card
- Paywall: белый фон, feature list, black CTA

---

### Phase 10 — Polish

- `DailyContentScreens`, `AdminPanel` — минимальный mono shell
- `prefers-reduced-motion`
- Аудит: нет `doodle-*`, `font-doodle*`, `RoughBorder` в views
- `npm test`, `tsc --noEmit`

---

## Карта экранов

| Экран | ViewState / route | Phase |
|-------|-------------------|-------|
| Dashboard | `dashboard` | 1 |
| Horoscope | `horoscope` | 3 |
| Natal | `chart` | 5 |
| Synastry | `synastry` | 6 |
| Ask Lumia | overlay | 7 |
| Onboarding | first launch | 8 |
| My Charts | modal | 8 |
| Settings | `settings` | 9 |
| Paywall | overlay | 9 |
| DaySheet | sheet | 4 |
| Stories | modals | 3–4 |

---

## Статус

| Phase | Статус |
|-------|--------|
| 0 Foundation | ✅ done |
| 1 Dashboard | ✅ done |
| 2 Tab bar | ✅ done |
| 3 Horoscope | ✅ done |
| 4 Personal + DaySheet | ✅ done |
| 5 Natal | 🔄 partial (HumanReport kickers) |
| 6 Synastry | ✅ done |
| 7 Oracle | ✅ done |
| 8 Onboarding + Charts | 🔄 partial (MyCharts pending) |
| 9 Settings + Paywall | ✅ done |
| 10 Polish | ⏳ |

---

*Единственный актуальный UI-план. Старый `doodle-redesign.md` удалён.*
