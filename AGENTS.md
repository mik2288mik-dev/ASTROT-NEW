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
- Сегодня, Неделя, and Месяц are internal tabs of Дневник, not separate primary sections.
- Do not create separate primary sections for those periods.

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
- Calculated astrology is not invented, altered, or overridden by the model.
- `lib/appVoice.ts` is the runtime source of generated-content voice.

## Verification and file boundaries

- Run only checks explicitly listed in the concrete task.
- Do not fix unrelated failing tests or diagnostics.
- Do not modify files outside the task allowlist.
- If another file is required, stop and report its path; do not modify it autonomously.
- Before committing, verify that only allowlisted files are staged.
- Remote publication is forbidden unless the user explicitly requests it.
