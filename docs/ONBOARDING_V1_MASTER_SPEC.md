# Onboarding V1 — Master Specification

Status: product direction fixed for implementation review.
Languages: RU / EN / ES.
Scope: first launch, path selection, birth-data setup, zodiac-only entry, first calculation, legal consent, analytics.

## 1. Product goal

Onboarding must sell the whole application, not one feature. It introduces:

- personal forecasts for Today / Week / Month / Year;
- natal chart;
- compatibility;
- zodiac-sign horoscope;
- personalized questions and answers.

The flow must not force every new user to enter birth data. A person may start with a zodiac horoscope and add personal data later.

The onboarding is not a gallery of screenshots. It is a short interactive story with an early choice of path.

## 2. Principles

1. Five screens maximum before the chosen path starts.
2. The path choice appears on screen 3.
3. Screens 1–2 sell value, not mechanics.
4. Screen 3 is interactive and makes a real product decision.
5. Birth data is requested only after the user chooses personal mode.
6. Zodiac-only users enter the app without being treated as incomplete users.
7. The personal-data path ends with a live calculation/reveal screen.
8. Onboarding is optional after the first screen: a discreet Skip action is available.
9. No forced paywall before the user sees product value.
10. Legal links are visible at the moment of consent but do not dominate the story.

## 3. Final flow

### Screen 1 — Main promise

Purpose: establish the app voice and difference.

RU title: `Гороскоп, который говорит по делу`
RU body: `Личный разбор, натальная карта, совместимость и прогнозы — без воды и сказок.`
Primary CTA: `Дальше`
Secondary action: `Пропустить`

Visual: one expressive editorial scene, no app screenshot, no mystical galaxy.

### Screen 2 — Product universe

Purpose: sell the entire application.

RU title: `Здесь есть всё, что правда интересно о тебе`
RU body: `Сегодня, неделя, месяц, год, любовь, работа, деньги, натальная карта и совместимость.`
Primary CTA: `Показать дальше`
Secondary action: `Пропустить`

Visual: a product-universe composition. It may reference multiple functions, but must not look like a feature grid or presentation slide.

### Screen 3 — Path choice

Purpose: let the user choose how to enter.

RU eyebrow: `С чего начнём?`
RU title: `Выбери, что тебе ближе`

Choice A:
- title: `Личный разбор`
- body: `Прогноз под твои данные`

Choice B:
- title: `Гороскоп по знаку`
- body: `Сразу перейти к своему знаку`

Primary CTA: `Продолжить`

Rules:
- the user must select one choice;
- remember the selection locally before network calls;
- back navigation preserves the choice;
- do not explicitly say “without birth date” in marketing copy.

### Screen 4A — Birth data setup

Shown only for Personal path.

RU eyebrow: `Личный разбор`
RU title: `Соберём твой первый разбор`
RU body: `Нужны дата рождения, время и место. Чем точнее данные — тем точнее расчёт.`

Fields:
- date of birth — required;
- time of birth — optional only if the product already supports an “unknown time” mode; otherwise required;
- place of birth — required;
- name — optional/personalization only;
- gender/pronouns — request only if actually used in copy generation.

Primary CTA: `Продолжить`

Rules:
- validate inline;
- explain why time/place are needed near the field, not in a modal wall of text;
- allow editing before final submission;
- never invent a default time;
- show a clear “I don’t know the exact time” path only if supported by calculations.

### Screen 4B — Zodiac selection

Shown only for Zodiac path.

RU eyebrow: `Гороскоп по знаку`
RU title: `Выбери свой знак`
RU body: `Откроем прогноз и сразу покажем, что там сегодня.`

Primary CTA: `Открыть гороскоп`

Rules:
- twelve signs in a clean grid/list;
- sign name must always accompany the symbol for accessibility;
- selection is saved locally;
- after selection, open the Zodiac section directly;
- later show contextual invitations to add birth data, but never block Zodiac content.

### Screen 5A — First calculation/reveal

Shown only for Personal path.

RU eyebrow: `Первый расчёт`
RU title: `Собираем твой прогноз`
RU body: `Считаем карту, день и первые персональные разборы.`

Progress items:
- `Твой день`
- `Любовь, работа и деньги`
- `Натальная база для следующих разборов`

Final CTA after success: `Поехали`

Rules:
- progress must reflect real server/client states, not a fake fixed timer;
- if calculation is already ready, reveal quickly without artificial delay;
- on partial failure, open the app with available content and retry missing content in background;
- on complete failure, keep entered data and show a calm retry state;
- route success directly to Today personal feed.

### Screen 5B — Zodiac entry

No separate fifth story is required. After sign selection, open the Zodiac section directly. A lightweight first-use tip may highlight:

`Хочешь разбор именно под себя? Добавь данные рождения позже.`

This tip appears contextually after the user has seen value, not as another onboarding wall.

## 4. Skip behaviour

- Skip on screens 1–2 leads to screen 3, not blindly to the home screen.
- A user who closes onboarding from screen 3 defaults to Zodiac entry, never to a broken personal state.
- Completed onboarding version is stored, for example `onboarding_version = 1`.
- A future onboarding refresh must use versioning, not reset every user.

## 5. Legal consent

At the bottom of screen 4A and any account-creation step:

`Продолжая, вы принимаете Условия использования и Политику конфиденциальности.`

Both links are tappable and open in an in-app browser or external browser with a clear return path.

Birth data consent must state that date, time and place of birth are used to create personalized astrological calculations and readings.

Do not use a pre-ticked optional marketing-consent checkbox.

## 6. Visual direction

The first generated beige editorial set is Direction A only, not the final lock.

Final production visual requirements:

- bright lifestyle/editorial look;
- no dark cosmic backgrounds as the base style;
- no generic galaxy, crystal ball or fortune-teller clichés;
- one strong scene per screen;
- text remains native UI, never baked into the image;
- visual assets are exported without system status bars;
- safe text zone in lower 42–48% of the screen;
- vertical source asset at least 1440×2560;
- additional wide crop for tablets if needed;
- all images must survive RU, EN and ES text-length differences;
- no brands, trademarked devices or copyrighted UI replicas.

Recommended visual routes for review:

A. Editorial warm: paper, soft daylight, premium tactile materials.
B. Bright modern app: white base, bold color fields, layered paper/3D objects, more energetic.
C. Real-animal mascot route: realistic sticker-style cat/capybara integrated sparingly, not on every screen.

Production should compare all three routes before locking one.

## 7. Content voice

Voice: a bold, kind friend who tells the truth, supports when needed, and never uses fatalism.

Avoid:

- “энергия дня”;
- “доверься своему пути”;
- “вселенная подсказывает”;
- “найди внутренний баланс”;
- vague mystical promises;
- fear-based conversion language.

Onboarding copy must be short, confident and commercial without sounding like an ad banner.

## 8. Localization

All strings live in localization files, never in images.

Required locales:

- `ru-RU` default for Russian build;
- `en-US` baseline English;
- `es-ES` baseline Spanish.

Spanish must be written natively, not translated word-for-word from Russian. Avoid region-specific slang in V1.

Layouts must support:

- 30–40% longer English/Spanish body text;
- dynamic font sizing only within safe limits;
- two-line titles without clipping;
- screen-reader labels for symbols and progress.

## 9. Analytics events

Minimum events:

- `onboarding_view` with `screen_id`;
- `onboarding_skip` with `screen_id`;
- `onboarding_next` with `screen_id`;
- `onboarding_path_selected` with `personal|zodiac`;
- `birth_date_entered`;
- `birth_time_entered` with `known|unknown`;
- `birth_place_entered`;
- `zodiac_sign_selected`;
- `personal_calculation_started`;
- `personal_calculation_succeeded`;
- `personal_calculation_failed` with reason category;
- `onboarding_completed` with chosen path and duration.

Do not send raw birth date, time, place or name to analytics.

## 10. Accessibility and QA

- minimum touch target 44×44 pt / 48×48 dp;
- contrast passes WCAG AA for normal text;
- reduced-motion mode disables parallax and decorative transitions;
- keyboard/back button behaviour tested on Android;
- screen-reader order follows visual order;
- no critical meaning is conveyed only by color;
- test RU/EN/ES on small Android, large Android and iPhone-sized viewport;
- test slow network, offline, invalid place, unknown time, API failure and app restart mid-flow.

## 11. Acceptance criteria

1. New user can reach Zodiac without birth data.
2. New user can complete personal setup and land in Today.
3. Screens 1–2 communicate the whole product.
4. The path choice is on screen 3.
5. No screenshots are embedded as onboarding teaching cards.
6. No paywall blocks first product value.
7. Legal links are accessible before birth-data submission.
8. Copy exists in RU/EN/ES.
9. Images contain no text or system UI.
10. Analytics contains no raw personal birth data.
11. Back/skip/restart preserve valid progress.
12. Existing users never see V1 onboarding again unless version explicitly changes.
