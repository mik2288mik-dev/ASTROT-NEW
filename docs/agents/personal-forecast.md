# Personal AI forecast guide

## Product contract

`Dashboard` shows one personal reading for the chosen `day`, `week`, or `month`.
The person chooses a period in the diary drawer. Today is a continuous editorial
feed; Week and Month are cohesive stories. There are no period tabs on the main
screen, visible thematic sections, forecast cards, questions, feedback prompts,
or separate forecast-reader pages.

The reading is the product. Do not turn it into a checklist, an astrological
report, a dashboard of cards, a social feed, or a chat.

## Generation boundary

- `lib/personalForecastGeneration.ts` builds one private generation input from
  the selected period, locale/timezone, available name and birth details, and
  up to 15 same-person anti-repeat forecasts. It has no natal-chart input. A
  small recent cross-user copy corpus stays inside server validation and never
  enters the provider prompt.
- OpenAI Luna writes the entire user-facing forecast. The server owns the
  prompt, structured schema, validation, cache identity, and access control.
- The model receives no authority to calculate or claim unsupplied transits,
  aspects, dates of events, or biographical facts.
- Do not expose birth data, raw chart data, evidence IDs, prompt text, or
  technical astrology in the forecast itself.

## Story shape and voice

- Today: one heading of 2–5 words and 4–6 ordered fragments; first maps to
  `overview`, the rest to untitled `sections`. Week and Month: one cohesive
  `overview`. Every period stays within 150 visible words.
- Today has hidden `presentationStyle`: the first and final fragments are
  `prose`, with at most one 6–18-word `pull_quote` and at most one
  4–12-word `paper_note`. Week and Month
  use prose. These are rendering hints, not visible categories.
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

- Text is primary. Today has at most one strong visual and one of five app-owned layouts:
  `editorial_right`, `editorial_left`, `quote_first`, `visual_overlap`, or
  image-free `editorial_clean`.
- The original Diary pool contains 895 approved assets. `editorial-v2` adds
  195 non-brand visual entries: 142 text-free entries enter generic automatic
  selection and 53 embedded-copy entries await locale/copy metadata. It also
  adds 19 empty paper templates; seven packaged review-required files stay
  excluded by manifest metadata.
  Synastry/zodiac assets and legacy backgrounds stay isolated.
- The application derives layout and asset from `userId + periodKey +
  contractVersion`; Luna never chooses design. A paper note is a runtime string
  over an empty template, not text baked into PNG/WebP.
- Never place body prose behind or over imagery, add captions, or restore promo
  banners. `visual_overlap` concerns editorial whitespace/paper edges only;
  `paper_note` is live text on an empty paper surface, never rasterised copy.

## Safe changes

- For a prompt, schema, word-limit, or validation change, update the prompt or
  cache version deliberately and cover the contract with targeted tests.
- Keep Zodiac, natal readings, and compatibility as separate products.
- A request that only changes visual styling must not alter the private natal
  context, the generation route, cache, or entitlement rules.
