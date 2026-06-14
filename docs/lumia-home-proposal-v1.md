# LUMIA · Предложение v1 (Home + всё приложение)

> Основано на 3 референсах пользователя + описание блоков Home.  
> Статус: **на согласование** — код не пишем до «ок».

---

## Референсы → что берём в LUMIA

| # | Референс | Паттерн | Где в LUMIA |
|---|----------|---------|-------------|
| 1 | Feed + Article | Hello + hero card + tags + article reader + Share bar (white/black) | Home cards, Horoscope, Natal, Union results |
| 2 | Channel:D | Serif hero, line-art scene, chat bubbles, black pill CTA, quick replies | Onboarding, Ask Lumia full, Union landing |
| 3 | Student App | 2×2 metrics bento, black/white cards, black list rows, bottom nav | Home «факты дня», My Charts, preset questions |

**Общий стиль:** monochrome line-art на `#F2F2F2`, Manrope UI, serif только на больших заголовках статей.

---

## Home «Сегодня» — порядок блоков сверху вниз

```
┌─────────────────────────────┐
│ (○)  Привет          ⚙️    │  ← avatar → Settings
│      {Имя}                  │
│      «мотивация дня»        │  ← italic/muted, 1 строка
├─────────────────────────────┤
│  ┌──────────┬──────────┐   │
│  │ Настроение│ Энергия  │   │  ← 2×2 bento (ref 3)
│  │   72%    │   65%    │   │
│  ├──────────┼──────────┤   │
│  │ Общение  │ Фокус    │   │
│  │   58%    │   81%    │   │
│  └──────────┴──────────┘   │
│  подпись: «пик 12:00–15:00»│  ← одна строка, не esoteric
├─────────────────────────────┤
│ [illustration plate]        │
│ ♌ Лев · гороскоп            │  ← ref 1 hero card
│ «2 строки summary…»         │
│              Read →         │
├─────────────────────────────┤
│ [illustration wheel]        │
│ Факт по твоей карте         │
│ «Сегодня Меркурий…»         │
│              Карта →        │
├─────────────────────────────┤
│ ■ Союз (black card)         │
│ Овен + Телец · 78%          │  ← free preview OR CTA
│ Дружба 82% · Разговор 71%   │
│         Узнать больше →     │
├─────────────────────────────┤
│ Спроси Lumia                │
│ [pill] [pill] [pill]        │  ← horizontal scroll
│ «Что ждёт в любви?» …       │
└─────────────────────────────┘
│ Today · Horoscope · Chart · Union · Ask │  ← bottom bar
└─────────────────────────────┘
```

---

## Блок 1 · Шапка

| Элемент | Поведение |
|---------|-----------|
| Круглый avatar слева | Telegram photo или initial → Settings |
| «Привет» / «Доброе утро» | По времени суток (утро/день/вечер) |
| Имя | `profile.name`, bold |
| Мотивация под именем | **Новая каждый день**, без API |

### Мотивация дня (локально)

Ротация по `(date + theme)` из 6 тем:

| День недели | Тема | Пример тона |
|-------------|------|-------------|
| Пн | работа | «Сегодня лучше один завершённый шаг, чем пять начатых» |
| Вт | деньги | «Не принимай финансовых решений на эмоциях до обеда» |
| Ср | знания | «Спроси себя: что я хочу понять, а не доказать» |
| Чт | дружба | «Напиши тому, о ком думала сегодня утром» |
| Пт | любовь | «Говори прямо — намёки сегодня не работают» |
| Сб–Вс | жизнь | «Выбери одно «да» и одно спокойное «нет»» |

~30–50 фраз на тему в JSON, `hash(date) % length` — **0 API**.

---

## Блок 2 · Полезные факты дня (НЕ эзотерика)

### ❌ Не показываем

Число дня, цвет дня, камень, «удачное направление», generic lucky hours без контекста.

### ✅ Предлагаем 4 метрики (2×2 bento, ref Student)

| Метрика | Что значит для пользователя | Источник данных |
|---------|------------------------------|-----------------|
| **Настроение** | Насколько день эмоционально ровный | Premium+chart: **Today Pulse** score → %; Free: из summary знака (mapping) |
| **Энергия** | Есть ли силы на дела | Pulse `day` phase или personal forecast energy cue |
| **Общение** | Удачно ли говорить / договариваться | Pulse `bestFor` содержит communication ИЛИ sign reading focus |
| **Фокус** | Глубокая работа vs распыление | Pulse peak window + «лучшее время» одной строкой под grid |

**Под grid одна строка (ref 1 metadata style):**

`Пик дня 12:00–15:00 · не решай из тревоги` — из Pulse или sign advice.

**Free без карты:** 4 метрики считаются из **статической таблицы знак × день недели** (локально, без API) + 1 строка из кэша sign horoscope если есть.

**Premium + карта:** реальные Pulse 24h (уже есть в коде `TodayPulseResult`).

Tap на любую плитку → **Personal Daily** (tab overview) или sheet «что это значит».

---

## Блок 3 · Гороскоп (teaser)

**Композиция (ref 1 feed card):**

- Серая плашка с **line-art знака** (не emoji) — крупный, центр или справа
- Kicker: `{Знак} · сегодня`
- **2 строки** из `signReading.summary`
- Стрелка / «Читать» → tab **Горoscope** (full article reader, не stories)

**Если знак не выбран:** card «Выбери знак» → sheet grid 12 знаков (ref 1 pills style).

---

## Блок 4 · Натальная карта (teaser)

**Два режима:**

| Состояние | Card |
|-----------|------|
| Нет карты | Illustration + «Создай карту — узнай, кто ты на самом деле» + black CTA |
| Есть карта | **Факт дня по карте** — 1 предложение (transit/house theme), меняется daily |

**Факт дня (Premium):** из personal daily / today assistant API (уже есть).  
**Факт дня (Free):** только **бесплатный слой** — «☉ Лев · ☾ Рак · ASC Весы» + 1 статическая строка из base portrait teaser.

Tap → tab **Карта** (magazine reader).

---

## Блок 5 · Союз / человек (compact на Home)

### Free (на Home, без API)

**Мини-калькулятор знаков** — полностью **in-app**:

- JSON матрица 12×12: `friendship`, `talk`, `spark`, `friction` (0–100%)
- UI: два pill-select знака (свой + друг/партнёр) **или** «мой знак» auto + выбор второго
- Показ 3–4 progress bars с % (ref Student numbers style)
- Короткая строка: «Вы хорошо понимаете друг друга в…»

**Tap «Подробнее»** → tab **Союз** (full screen).

### Premium (teaser на Home)

Black card:

- «Рассказ о человеке по карте»
- «Имя, дата — что между вами на самом деле»
- Lock icon + «Premium» → paywall или tab Союз personal mode

**На Home не форма** — только tease + % free preview.

---

## Блок 6 · Спроси Lumia (compact)

**Ref 2 quick reply pills** — horizontal scroll, 4–6 видимых:

Примеры preset (из constants, ~40–60 штук):

- «Что ждёт меня в любви сегодня?»
- «Стоит ли говорить с начальником?»
- «Где я сегодня перегибаю?»
- «Что с деньгами на этой неделе?»
- «Почему меня так тянет к этому человеку?»

Tap pill → tab **Ask** с **prefilled question** в composer.

Card footer: «Все вопросы →» opens Ask with category chips.

---

## Bottom navigation (предложение)

| Tab | Icon | Экран |
|-----|------|-------|
| **Сегодня** | home | Home feed (выше) |
| **Гороскоп** | compass/sun | Article reader |
| **Карта** | wheel | Natal magazine |
| **Союз** | two people | Union room |
| **Спроси** | message | Ask Lumia chat |

Profile — **только через avatar** в шапке Home (не 6-я иконка).

---

## Остальные экраны (кратко)

### Гороскоп (full) — ref 1 Article

- Back не нужен (tab), header: знак + date + change sign
- Illustration plate → serif h1 → sections → **Share bar** fixed

### Карта (full) — ref 1 + ref 3 list

- Cover + portrait (free)
- Locked chapters = gray blur cards (Premium)
- Daily personal section = «сегодня по твоей карте»

### Союз (full) — ref 2 landing + ref 1 article

**Landing:** illustration couple + serif headline + terracotta CTA  
**Segment:** «По знакам» | «По картам» (Premium)  
**Free signs:** local matrix, bars, no API  
**Premium personal:** form → article results + Share bar

### Спроси (full) — ref 2 chat

- Minimal header «Lumia»
- Bubbles gray/black
- Quick replies row above input
- Premium/Stars — one line над composer

### Onboarding — ref 3 splash + ref 2

- Step 1: illustration + «Let's go» black pill
- Step 2: birth form minimal

### My Charts — ref 3 Classes list

- Black rows, search, segment

### Paywall / Settings — ref 1 monochrome

- White, numbered features, black CTA

---

## Motion

- Home: stagger cards 70ms (Framer)
- % bars: animate width on appear
- Tab switch: layoutId pill
- Article sections: whileInView fade
- reduced-motion: instant

---

## Открытые вопросы к тебе

1. **5 tabs** (с Ask отдельно) или **4 tabs + FAB** для Ask?  
2. **Метрики 2×2** — ок или хочешь 3 в ряд горизонтально?  
3. **Free compatibility на Home** — всегда два знака или запоминать «партнёрский знак»?  
4. **Мотивация** — только из локального пула или смешивать с AI раз в N дней (Premium)?

---

*После твоих правок → v2 → Phase A код.*
