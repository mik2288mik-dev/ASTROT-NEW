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

- `lib/swisseph-calculator.ts` deterministically creates the saved natal chart.
- `lib/personalForecastGeneration.ts` builds one private generation input from
  the selected period, locale/timezone, available birth details, and a compact
  natal-profile summary.
- OpenAI Luna writes the entire user-facing forecast. The server owns the
  prompt, structured schema, validation, cache identity, and access control.
- The model receives no authority to calculate or claim unsupplied transits,
  aspects, dates of events, or biographical facts.
- Do not expose birth data, raw chart data, evidence IDs, prompt text, or
  technical astrology in the forecast itself.

## Story shape and voice

- Today: one heading of 3–8 words and 4–6 ordered fragments; first maps to
  `overview`, the rest to untitled `sections`. Week and Month: one cohesive
  `overview`. Every period stays within 150 visible words.
- Today has hidden `presentationStyle`: the first fragment and at least one
  more are `prose`, with at most one 6–18-word `pull_quote` and at most one
  4–12-word `paper_note`. Week and Month
  use prose. These are rendering hints, not visible categories.
- It is an intimate, concrete story about this person in this exact period.
  The day, week, and month differ by their date range, not by fixed themes,
  pre-written behavioural patterns, or a daily timetable.
- Write like a perceptive, straight-talking ally: alive, specific, sometimes
  lightly playful, never slangy, fatalistic, mystical, clinical, or coaching.
- Do not append a separate advice block, a list, a question to the reader, a
  summary, a call to action, or an explanation of the calculation.
- A recognisable scene is welcome; an invented event, relationship, diagnosis,
  or certainty about the future is not.
- Today must contain a recognisable possible conversation, message, request,
  decision, agreement, household/work detail, choice, or pause. Advice and
  conflict are optional. Reject abstract coaching language and repeated form.

## Visual boundary

- Text is primary. Today has at most one strong visual and one of five app-owned layouts:
  `editorial_right`, `editorial_left`, `quote_first`, `visual_overlap`, or
  image-free `editorial_clean`.
- Personal products share 309 assets under `/assets/personal-editorial/`: 202
  `editorial-v2` assets, 45 cats, 38 capybaras, and 24 objects. Embedded-text
  and review-excluded assets stay in the library but never enter automatic
  selection. A separate `/assets/personal-paper-templates/` pool contains 19
  empty templates for runtime text.
- Zodiac alone can use the 48 explicitly allowlisted legacy assets under
  `/assets/zodiac-legacy-special/`: 24 psychedelic and 24 approved
  funny-animal images. Personal manifests and selectors never import this pool;
  the Zodiac selector cannot see any other retired newspaper asset.
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
