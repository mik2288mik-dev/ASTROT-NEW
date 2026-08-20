# Personal AI forecast guide

## Product contract

`Dashboard` shows one personal reading for the chosen `day`, `week`, or `month`.
The person chooses a period through one controlled Today/Week/Month tablist
directly below the Diary header. Today is a continuous editorial feed; Week and
Month are cohesive stories. There are no visible thematic sections, forecast
cards, questions, feedback prompts, or separate forecast-reader pages.

The reading is the product. Do not turn it into a checklist, an astrological
report, a dashboard of cards, a social feed, or a chat.

## Generation boundary

- `lib/swisseph-calculator.ts` deterministically creates the saved natal chart.
- `lib/personalForecastGeneration.ts` builds one private generation input from
  the selected period, locale/timezone, available birth details, and a compact
  saved natal-profile summary, plus up to 15 recent fragments for the same user
  and chart across `day`, `week`, and `month` as anti-repeat history.
- OpenAI Luna writes the entire user-facing forecast. The server owns the
  prompt, structured schema, validation, cache identity, and access control.
- Cache identity includes the authenticated user, owned chart ID, full
  saved-natal fingerprint, hash of sanitized profile fields, period and
  timezone-aware key, language, model, and calculation, contract, prompt, and
  voice versions.
- Personal forecast Responses requests use `store: false`. Rejected draft text
  remains inside server validation; a repair attempt receives only generic
  validation errors.
- The model receives no authority to calculate or claim unsupplied transits,
  aspects, dates of events, or biographical facts.
- Do not expose birth data, raw chart data, evidence IDs, prompt text, or
  technical astrology in the forecast itself.

## Story shape and voice

- Every period opens with one visible common hook of 2–5 words; fragment titles
  stay hidden. Today continues with 4–6 ordered fragments: the first maps to
  `overview`, the rest to untitled `sections`. Week and Month use one cohesive
  `overview`. Every period stays within 150 visible words.
- Today has hidden `presentationStyle`: the first and final fragments are
  `prose`, with at most one 6–18-word `pull_quote` and at most one
  4–12-word `paper_note`. Week and Month omit this metadata. The current Today
  renderer does not branch on these values and displays every fragment as
  continuous prose; they are not visible categories or mounted quote/note
  surfaces.
- It is an intimate, concrete story about this person in this exact period.
  The day, week, and month differ by their date range, not by fixed themes,
  pre-written behavioural patterns, or a daily timetable.
- Write like a perceptive, straight-talking ally: alive, specific, sometimes
  lightly playful, never slangy, fatalistic, mystical, clinical, or coaching.
- A favourable reading may stay fully positive. Never manufacture a warning,
  catch, or undercutting contrast merely to sound sharp.
- Require the strict `closing` object: visible text, one of
  `advice|action|avoidance|wish|motivation`, a post-hoc advice key, and the
  profile evidence id. The server appends its text to the final fragment, so it
  stays inside the story without a separate advice block, visible label, list,
  question, CTA, or calculation explanation.
- A recognisable scene is welcome; an invented event, relationship, diagnosis,
  or certainty about the future is not.
- Today must contain a recognisable possible conversation, message, request,
  decision, agreement, household/work detail, choice, or pause. Conflict is
  optional. Reject abstract coaching language and repeated form.
- `lib/personalForecastExamples.ts` contains four Today runtime references and
  three each for Week and Month. Pass only the selected period's examples,
  never their tone metadata, and reject copied or closely paraphrased reference
  copy.

## Visual boundary

- Text is primary. Active Today uses one deterministic `calendar-editorial`
  composition: `TodayLineField` selects one of 12 line presets and
  `TodayCalendarClock` selects one of 15 clock presets from `userId +
  periodKey`; untitled prose fragments follow below.
- The former five-layout planner, 309 personal assets, and 19 paper templates
  remain library-only. The active Today path does not mount their image or
  paper-note renderers.
- Zodiac alone can use the 48 explicitly allowlisted legacy assets under
  `/assets/zodiac-legacy-special/`: 24 psychedelic and 24 approved
  funny-animal images. Personal manifests and selectors never import this pool;
  the Zodiac selector cannot see any other retired newspaper asset.
- The application derives the active clock and line presets from `userId +
  periodKey`; Luna never chooses design. Do not reconnect the legacy planner
  without an explicit product change and renderer coverage.
- Never place body prose behind or over imagery, add captions, or restore promo
  banners.

## Safe changes

- For a prompt, schema, word-limit, or validation change, update the prompt or
  cache version deliberately and cover the contract with targeted tests.
- Keep Zodiac, natal readings, and compatibility as separate products.
- A request that only changes visual styling must not alter the private natal
  context, the generation route, cache, or entitlement rules.
- Keep `/api/content/forecast/personal`, the cache, and the client service on
  `PersonalForecastPackage`; legacy `aiPersonalHoroscope*` state is inactive.
- Preserve the delivery sequence: local package, server `GET`, generation
  `POST`, then `POST` polling with `regenerate: false` after `202`.
- Keep startup prewarm non-blocking: Free requests only the current `day`;
  Premium sequentially requests the current `day`, `week`, and `month`.
