# Personal AI forecast guide

## Product contract

`Dashboard` shows one personal story for the chosen `day`, `week`, or `month`.
The person chooses a period in the diary drawer. There are no period tabs on the
main screen, thematic sections, forecast cards, questions, feedback prompts, or
separate forecast-reader pages.

The story is the product. Do not turn it into a checklist, an astrological
report, a multi-block feed, or a chat.

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

- One heading of 3–8 words and one or two natural paragraphs; no more than 150
  words in total.
- It is an intimate, concrete story about this person in this exact period.
  The day, week, and month differ by their date range, not by fixed themes,
  pre-written behavioural patterns, or a daily timetable.
- Write like a perceptive, straight-talking ally: alive, specific, sometimes
  lightly playful, never slangy, fatalistic, mystical, clinical, or coaching.
- Do not append a separate advice block, a list, a question to the reader, a
  summary, a call to action, or an explanation of the calculation.
- A recognisable scene is welcome; an invented event, relationship, diagnosis,
  or certainty about the future is not.

## Visual boundary

- Text is the default. A forecast normally has no image and never has more than
  one strong image.
- A sticker may appear as a rare, small editorial pause after a complete story.
  It has no caption, never sits behind text, and is selected from curated tags
  by the application—not directly by the model.
- Do not restore newspaper scenes, visual cues, section art, or promo banners
  as part of the forecast contract.

## Safe changes

- For a prompt, schema, word-limit, or validation change, update the prompt or
  cache version deliberately and cover the contract with targeted tests.
- Keep Zodiac, natal readings, and compatibility as separate products.
- A request that only changes visual styling must not alter the private natal
  context, the generation route, cache, or entitlement rules.
