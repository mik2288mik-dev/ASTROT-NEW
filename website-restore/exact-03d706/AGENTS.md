# Repository working rules

## Local commands

- Run commands from the repository root. Install the locked dependencies with `npm ci` when setup is required.
- Start the application with `npm run dev`.
- Start the local synthetic UI Preview with `npm exec -- cross-env NEXT_PUBLIC_UI_PREVIEW=1 npm run dev`, then open a localhost URL with `?uiPreview=1`.
- Run a focused Jest file with `npm test -- --runInBand <path-to-test>`.
- Run the repository checks only when the concrete task calls for them: `npm run lint` and `npm run build`.

## Local-only execution

- All tasks are performed in the current local checkout.
- Do not run `git fetch`, `git pull`, `git push`, GitHub Actions, remote workflows, or PR commands unless the user explicitly requests that exact remote action.
- Preserve unrelated local changes and untracked files; never add them implicitly.
- Keep every change scoped to the user request and its explicit allowlist.

## Product navigation architecture

- Primary navigation is the persistent bottom bar shown in the current product UI. Its items and labels are:
  1. Сегодня
  2. Зодиак
  3. Натальная карта
  4. Сравнить
  5. Меню
- Do not replace the bottom navigation with a left slide-out panel, drawer, navigation sheet, hamburger trigger, or planet-style navigation mark.
- `Меню` opens the existing full menu screen; it is not a trigger for a drawer.
- Сегодня, Неделя и Месяц remain the existing period tabs at the top of the personal forecast and `Зодиак` screens. Do not move them into another navigation surface or rewrite their product behavior without direct instruction.
- The product brand mark is the cloud-style `NEBO` wordmark used in the current application screenshots. Do not substitute a planet icon or an unrelated navigation symbol for it.
- Inside `Натальная карта`, preserve the four existing tabs and their order: `Карта`, `Разбор`, `Спросить о себе`, `Матрица судьбы`.

## Натальный разбор

- База бесплатная: короткие самостоятельные наблюдения с понятными заголовками. Обычно 6–8, если каждое добавляет новый смысл; не растягивать текст ради количества. Основной текст читается сразу, без каталога вопросов.
- В основном тексте говорим на «ты» простым русским языком. Расчётные названия, градусы и основания каждого наблюдения доступны под его кнопкой «Почему так?».
- В конце — 2–3 конкретных вопроса, вытекающих из прочитанного и ведущих в существующие главы Premium. Глава отвечает по своей теме и добавляет новые наблюдения. Не выдавать смену заголовка за новый смысл и не обещать бесконечные новые ответы в конечном наборе глав.
- Runtime и проверка качества описаны в `docs/agents/natal-reading.md`. Сохранённые расчёты не пересчитываются ради новых текстов.

## Спросить о себе

- `Спросить о себе` remains the existing tab inside `Натальная карта`; do not move it to a bottom sheet, drawer, or separate primary screen.
- Accept only questions that can be answered from the user's saved natal chart. Reject unrelated general requests such as recipes or household instructions before generation.
- Premium users can submit up to 5 accepted questions per day. Rejected off-topic questions do not consume the limit.
- Keep the selectable starter questions above the free-form input.
- Do not turn the application into a chat-interface clone.
- Do not add a separate full-screen chat without the user's direct instruction.

## Version-one boundaries

- Do not implement friends, a messenger, or a social feed yet.
- Do not add them as navigation placeholders.

## Visual rules

- System navigation remains clean and free of stickers.
- Newspaper-psychedelic imagery is used rarely.
- A forecast usually has no more than one strong image.
- Some screens should remain image-free.
- In forecasts, do not place an image behind or over the reading text. Existing editorial cards and the interactive old-TV clock are allowed foreground components.
- Straight, torn, round, oval, and free paper-like shapes are allowed.

## Today clock and broadcast

- Keep the wide old-TV visual with the current date and time on Today.
- Tapping the TV cycles the existing still broadcasts: `Тихий горизонт`, `Дождь за стеклом`, `Ночной сигнал`.
- The TV is forecast content, not navigation or a brand mark. Add GIF or video only on direct instruction.

## Voice and personal forecast rules

- Personal forecasts for Today, Week, and Month are AI-written user-facing products. Old forecast wording, old cached copies, and old visual assumptions must not be carried into the new NEBO design.
- Voice: simple conversational Russian on «ты». Clear first, character second. A sharp phrase or dry joke is welcome when it fits, but never required.
- No astrology terminology in user-visible forecast copy. No psychology, therapy, coaching, self-help jargon, mysticism, or corporate/report language.
- Do not use product/astrology abstractions such as «период», «динамика», «напряжение», «сфера», «ресурс», «проработка», «осознанность», «трансформация» when normal spoken wording can say the same thing.
- Do not invent biography, current relationships, profession, purchases, trips, or plans. External events are possibilities, not guarantees.
- Do not pad to a word quota, sentence quota, or fixed number of paragraphs. The reading should be as long as needed to feel complete and easy to read in the approved mobile UI.
- The visible UI must clearly identify Today / Week / Month and place the reading in the approved NEBO render-parity layouts. The forecast itself must remain readable prose, not a dashboard of pseudo-scores.
- Forecast-specific prompt identity must be versioned so old forecast cache never silently reappears after a voice rewrite.
- Safety remains strict: no diagnosis, medical treatment, investment instruction, guaranteed outcomes, or claims about another person’s private thoughts.

## Verification and file boundaries

- Run only checks explicitly listed in the concrete task.
- Do not fix unrelated failing tests or diagnostics.
- Do not modify files outside the task allowlist.
- If another file is required, stop and report its path; do not modify it autonomously.
- Before committing, verify that only allowlisted files are staged.
- Remote publication is forbidden unless the user explicitly requests it.
