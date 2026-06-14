# LUMIA · Zero Design (greenfield)

> **Это единственный актуальный дизайн-документ.**  
> Предыдущий `mono-friend-redesign.md` — ошибочный путь: reskin текущих экранов, не новый продукт.

## 0. Что пошло не так

| Было сделано (неправильно) | Что нужно было |
|----------------------------|----------------|
| Перекрасили Dashboard, Stories, Settings | Спроектировать **новую** IA и композицию |
| Сохранили «Привет + bento + date pills» | Новый Home = **feed + главная история дня** |
| Stories остались гороскопом | Horoscope = **reader / article**, не fullscreen stories |
| Тот же tab bar, те же view-файлы | Новые **layout-паттерны** и иерархия контента |
| `mono-ui` = обёртки старой разметки | Новая **design system** + новые screen shells |

**Правило дальше:** Home v2 утверждён в `lumia-home-proposal-v2.md`. Реализация идёт через `views/v2/TodayFeed.tsx`, не reskin Dashboard.

---

## 1. Продуктовая идея (one-liner)

**LUMIA — личный астролог в формате утреннего журнала + переписка с другом.**

Не дневник, не космос, не виджет-дашборд. Читаешь, отвечаешь, делишься.

### Приоритеты (не меняются)

1. **Гороскоп** — ежедневная привычка  
2. **Натальная карта** — «кто я»  
3. **Совместимость** — «узнать про парня/девушку/пару» — **главный viral CTA**

### Ограничения реализации (технические)

- ViewState / routing / premium / API / Telegram — **не ломаем** на первом этапе  
- Меняем: **композиция экранов, навигация внутри экрана, типографика, иллюстрации, motion, copy-раскладка**  
- Допустимо позже: замена Stories → Reader (тот же data layer)

---

## 2. Design direction · «Editorial Friend»

Синтез трёх референсов (не копия):

| Референс | Берём | Не берём |
|----------|-------|----------|
| Feed + Article | Лента карточек, hero-иллюстрация, чтение как статья, Share bar | Чужой контент, чужие категории |
| Chat landing | Landing hero + один black CTA, bubbles, quick replies | Generic chatbot UI |
| Student bento | Чёткие black rows, search, segment — **только** для списков (карты, люди) | Gamified student chrome |

### Визуальный язык

```
Фон          #FAFAFA / #FFFFFF
Плашка art   #F2F2F2  (line-art, люди, пары)
Текст        #111111
Вторичный    #6B6B6B
Линии        rgba(17,17,17,0.08)
CTA primary  #111 pill
CTA Union    #C45C4A (единственный цветной акцент)
```

**Типографика**

- UI / заголовки: **Manrope** 600–700  
- Long read / Union headlines: **Lora** или serif только для h1 статей  
- **Запрещено:** Caveat, cosmic gradients, фиолетовые kickers, astro-dark paywall

**Иллюстрации**

- Line-art: один человек, пара, сцена «разговор», силуэт знака  
- Всегда на серой плашке, не floating stickers  
- Не эзотерика: нет лунных фонов, орбит, nebula

**Motion (Framer Motion)**

- Feed: stagger карточек 60–80ms  
- Reader: fade секций при scroll (`whileInView`)  
- Tab: sliding indicator  
- Sheets: spring снизу  
- `prefers-reduced-motion`: отключить stagger и parallax

---

## 3. Новая информационная архитектура

### Tab bar (4 + профиль, не 5 равных)

| Tab | Роль | Старое (убрать) |
|-----|------|-----------------|
| **Сегодня** | Feed дня | Dashboard bento «Твой пlan» |
| **Гороскоп** | Reader знака | Fullscreen Stories |
| **Карта** | Magazine «Кто я» | Technical HumanReport stack |
| **Союз** | Compatibility hub | Form-first synastry page |

**Профиль** — avatar chip **слева от tab bar** или top-left на Feed (не 5-я иконка «домик профиля»).

**Ask Lumia** — **FAB** (чёрный круг, message icon) над tab bar справа, не строка кнопок на Home.

```
┌─────────────────────────────┐
│  Feed content               │
│                             │
│                    ┌───┐    │
│                    │ ? │ FAB│
├────────────────────┴───┴────┤
│ 👤  Today · Horoscope · Map · Union │
└─────────────────────────────┘
```

---

## 4. Экраны · с нуля (wireframes)

### 4.1 Splash / Onboarding (первый запуск)

**Не** форма сразу. **Да:** 2-step emotional onboarding.

**Step 1 — Welcome**
```
┌──────────────────────────┐
│ LUMIA                    │
│                          │
│   [ line-art: person ]   │
│   на серой плашке        │
│                          │
│  Твой личный             │
│  астролог                │
│                          │
│  Коротко о дне,          │
│  карте и отношениях      │
│                          │
│  [ Let's go — black ]    │
└──────────────────────────┘
```

**Step 2 — Birth data** (минимальная форма, одна колонка, без serif wall of text)

---

### 4.2 Home · «Сегодня» (NEW — не Dashboard)

**Концепция:** вертикальный **feed**, не grid.

**Порядок карточек (scroll):**

1. **Greeting strip** — «Доброе утро, {name}» + дата (без giant avatar circle)
2. **Hero story** — одна большая карта «Твой день»  
   - Серая плашка + illustration  
   - 2 строки summary  
   - Tap → Personal Daily **reader** (не stories)
3. **Union card (black)** — full width, terracotta micro-label «Союз»  
   - «Узнай про него / неё / вас»  
   - Illustration couple line-art  
   - **Главный CTA продукта**
4. **Horoscope teaser** — знак + 1 абзац + «Читать» → Horoscope tab
5. **Chart teaser** — ☉ ☾ ASC одной строкой + «Моя карта»
6. **Week strip** — горизонтальный календарь (7 дней), tap → DaySheet

**Убрать навсегда с Home:**

- «Твой пlan» + bento 2×2  
- Pink quick-actions row  
- Дублирующие кнопки Ask / Personal day внизу  

---

### 4.3 Horoscope · Reader (NEW — не Stories)

**Концепция:** Medium-style article, не Instagram stories.

```
┌──────────────────────────┐
│ ←  Овен · сегодня    ⚙️  │  ← смена знака
├──────────────────────────┤
│ [illustration plate]     │
│                          │
│  Заголовок дня           │  serif h1
│  Lead paragraph          │
│                          │
│  ── Фокус ──             │  section
│  text...                 │
│                          │
│  ── Совет ──             │
│  text...                 │
│                          │
│  [ pill tags ]           │
├──────────────────────────┤
│      Share (fixed)       │
└──────────────────────────┘
```

- Progress: thin line под header (optional)  
- Free: сегодня; Premium: архив дней через week strip / calendar sheet  
- Sign picker: **sheet** с grid знаков, не story slide 1

---

### 4.4 Natal · Magazine (NEW shell)

**Концепция:** журнал о человеке, не «отчёт API».

**Структура scroll:**

1. Cover — имя, дата рождения, illustration «silhouette + wheel line»
2. **Главный портрет** — 1 экран текста (free)
3. **Glance row** — ☉ ☾ ↑ pills
4. **Premium chapters** — locked cards с blur preview (как Medium paywall block)
5. **Technical** — collapsed «Положения планет» (details)

CTA sticky: «Личный день» → Personal Daily

---

### 4.5 Union · Relationship room (NEW)

**Концепция:** landing как ref chat — потом форма.

**Landing (default):**
```
┌──────────────────────────┐
│ Союз                     │
│ [ couple illustration ]  │
│                          │
│  serif: Проверь          │
│  вашу связь              │
│                          │
│  2–3 строки value prop     │
│                          │
│  [ Проверить — terracotta]│
│  [ По знакам — ghost ]   │
└──────────────────────────┘
```

**После CTA** — segment + form (минимум полей видимо).

**Results** — article sections + **Share bar fixed** (ref feed article).

---

### 4.6 Ask Lumia · DM (NEW)

**Концепция:** чистый messenger, без двух glass-панелей сверху.

```
┌──────────────────────────┐
│ ←  Lumia                 │
├──────────────────────────┤
│  [assistant bubble]      │
│        [user bubble]     │
│  quick reply pills       │
├──────────────────────────┤
│ [ input........ ] [send] │
└──────────────────────────┘
```

- Premium / Stars state — **одна строка** над input, не hero block  
- History loads with fade-in bubbles

---

### 4.7 Personal Daily · Reader

Заменить таб-каши на **horizontal chapter dots** под title OR bottom segment.

Контент — **одна колонка текста**, cards для bullets (не icon watermark 188px).

---

### 4.8 My Charts · Library

Black list rows (ref student), search, filter segment. Без astro gradients.

---

### 4.9 Settings + Paywall

Settings = white mono list groups.  
Paywall = illustration + 4 features numbered + black CTA (не gold cosmic).

---

## 5. Design system · компонents (новые имена)

Не переиспользовать `mono-ui` как финал. Новый kit **`lumia-ui/v2/`**:

| Component | Назначение |
|-----------|------------|
| `FeedPage` | scroll shell + safe area |
| `FeedCard` | hero / teaser / black CTA variants |
| `ArticleReader` | kicker, h1, sections, share bar |
| `UnionLanding` | hero + dual CTA |
| `Messenger` | bubbles, composer, quick replies |
| `LibraryList` | black rows + search |
| `IllustrationPlate` | gray box + SVG slot |
| `FloatingAsk` | FAB |
| `TabDock` | 4 tabs + profile chip |

Tokens: `--lz-*` (новые, не `--mono-*` mix с legacy).

---

## 6. Mapping: старый код → новый UI

| ViewState | Старый файл | Новый shell (создать) |
|-----------|-------------|------------------------|
| dashboard | `Dashboard.tsx` | `views/v2/TodayFeed.tsx` |
| horoscope | `Horoscope.tsx` + Stories | `views/v2/HoroscopeReader.tsx` |
| chart | `NatalChart.tsx` | `views/v2/NatalMagazine.tsx` |
| synastry | `Synastry.tsx` | `views/v2/UnionRoom.tsx` |
| oracle overlay | `OracleChat.tsx` | `views/v2/AskLumia.tsx` |
| personal_daily | `DailyContentScreens` | `views/v2/DailyReader.tsx` |
| settings | `Settings.tsx` | restyle in place OR v2 |

**Стратегия:** новые view-компоненты подключаются в `App.tsx` **swap одной строкой** на view — hooks/props те же.

---

## 7. Фазы реализации (только после утверждения дизайна)

| Phase | Deliverable | Критерий «готово» |
|-------|-------------|-------------------|
| **A** | Tokens `--lz-*`, `lumia-ui/v2` primitives | Storybook или static preview page |
| **B** | TodayFeed replaces Dashboard | Home не содержит bento/stories CTAs |
| **C** | HoroscopeReader replaces Stories | Нет fullscreen story gradient |
| **D** | NatalMagazine shell | Cover + portrait + locked chapters |
| **E** | UnionRoom landing + results article | Share bar on results |
| **F** | AskLumia messenger | Single composer, no double header |
| **G** | TabDock + FAB | 4 tabs + Ask FAB |
| **H** | Motion pass | stagger, reader, reduced-motion |
| **I** | Delete legacy skins | doodle/, mono partials, story-only UI |

**Не начинать Phase B**, пока не approved §4.2 Home wireframe.

---

## 8. Что удалить после миграции

- `components/doodle/*`  
- Reskin-logic в `mono-ui` (или rename → v2)  
- `HoroscopeStories` as primary UX  
- Dashboard bento / date pill layout  
- Astro-dark paywall classes on user screens  

---

## 9. Open questions (нужен твой ответ)

1. **Tab bar:** оставляем 4 tab + FAB или 5 tab как сейчас?  
2. **Horoscope:** полностью убираем stories или stories = optional «быстрый режим»?  
3. **Home hero:** «Личный день» или «Гороскоп» выше Union card? (сейчас в §4.2: день → union → horoscope)  
4. **Референс-картинки:** скинешь снова 3 mockup в чат для pixel-level check?

---

*Статус: **DRAFT — ждёт утверждения**. Код Phase A+ не пишем без «ок».*
