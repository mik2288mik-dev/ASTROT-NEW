# Repository working rules

## Local-only execution

- All tasks are performed in the current local checkout.
- Do not run `git fetch`, `git pull`, `git push`, GitHub Actions, remote workflows, or PR commands unless the user explicitly requests that exact remote action.
- Preserve unrelated local changes and untracked files; never add them implicitly.
- Keep every change scoped to the user request and its explicit allowlist.

## Product navigation architecture

- The bottom navigation is not part of the target architecture.
- Primary navigation lives in the left slide-out panel. Its only items are:
  1. Дневник
  2. Гороскоп по знакам
  3. Совместимость
  4. Карта
- The bottom of the panel contains a profile block linking to Settings.
- Сегодня, Неделя и Месяц — это периоды одного личного прогноза в «Дневнике», а не отдельные первичные разделы.
- Период выбирается только внутри шторки/меню «Дневника». Не добавлять на главный экран tabs, pills или иной переключатель периодов.

## Astrologer questions

- «Задать вопрос астрологу» is an in-product action, not a primary tab.
- Open the question flow in a bottom sheet.
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
- Never place an image behind text, over text, or inside an additional UI frame.
- Straight, torn, round, oval, and free paper-like shapes are allowed.

## Voice and calculation rules

- The application is an ally: it supports the user without blindly agreeing.
- A heading or notification may sometimes be sharp, ironic, or playful.
- The main forecast remains serious, concrete, and short.
- Do not use artificial youth slang.
- Do not make anxiety, conflict, or problems the default subject.
- Positive possibilities, calm, confidence, and support must be considered alongside risks.
- Личный прогноз на сегодня, неделю и месяц полностью пишет ИИ. Сервер передаёт ему выбранный период и приватный контекст из сохранённой натальной карты; этот контекст персонализирует рассказ, но не является отдельным «расчётом прогноза» для показа пользователю.
- Today — непрерывная персональная лента из 4–6 последовательных текстовых фрагментов. `overview` хранит первый/главный фрагмент, `sections` — следующие в порядке чтения. Не возвращать Today к одной короткой истории.
- Week и Month — по одной цельной персональной истории. Не дробить их на календарные этапы или фиксированные жизненные рубрики.
- В Today нет видимых категорий Love/Work/Mood, заголовков фрагментов, опросов, feedback, «попал/мимо», игр, чата, утро/день/вечер или почасовой структуры. Служебные типы допустимы только внутри генерации и никогда не показываются пользователю.
- Персональность строится из сохранённого personal/natal context, периода и anti-repeat истории. Не подсовывать модели заранее выбранные абстрактные темы, психологические паттерны или выдуманную биографию.
- Нельзя приписывать ИИ несуществующие транзиты, аспекты, даты событий или иные периодные расчёты. Натальная карта остаётся детерминированно рассчитанной и сохраняется отдельно.
- `lib/appVoice.ts` is the runtime source of generated-content voice. Общий app voice остаётся спокойным; характер, редкая ирония и неожиданное сравнение личного прогноза задаются только forecast-specific layer с отдельной version identity.

## Verification and file boundaries

- Run only checks explicitly listed in the concrete task.
- Do not fix unrelated failing tests or diagnostics.
- Do not modify files outside the task allowlist.
- If another file is required, stop and report its path; do not modify it autonomously.
- Before committing, verify that only allowlisted files are staged.
- Remote publication is forbidden unless the user explicitly requests it.
