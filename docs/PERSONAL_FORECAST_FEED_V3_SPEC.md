# Personal Forecast AI Contract

> The filename is retained for existing links. This document supersedes the
> historical multi-section “Feed V3” specification.

## Decision

Personal forecasts for **Today**, **Week**, and **Month** are fully authored by
OpenAI Luna. The saved natal chart is the private context that lets the model
write about this particular person; it is not a visible technical explanation,
a separate daily transit calculation, or a set of pre-written themes.

The product is a short personal story that users want to open in the morning.
It is not a chat, coach, diagnostics report, list of life areas, feed of cards,
or a lesson in astrology.

## One story, three periods

| Period | Model input | Visible result |
|---|---|---|
| Today | local date, timezone, private natal/profile context | one story for this day |
| Week | exact seven-day range, timezone, private natal/profile context | one cohesive story for this week |
| Month | exact calendar-month range, timezone, private natal/profile context | one cohesive story for this month |

The date/range changes the story. There are no mandatory themes, behavioural
patterns, Monday-to-Sunday breakdowns, separate advice blocks, or formulaic
life-area sections.

## Generation input

The server—not the client and not the model—builds the prompt input. It may
include only what is needed to personalise the story:

- selected period, exact date/range, language, and timezone;
- name only when it improves natural address;
- saved birth date, birth time, and birth place when available;
- a compact summary derived from the user’s saved natal chart, including chart
  quality when it changes how specific the text may be.

The model has no database access and must not fetch, infer, or expose private
data. It may interpret the supplied context, but must not claim calculated
transits, aspects, exact event dates, biographical facts, medical/financial
advice, or certainty about the future.

## Writer role

Luna writes as a perceptive, intelligent ally who knows the reader’s context.
The voice is direct, calm, vivid, and occasionally lightly playful. It does not
perform a role-played “guru”, use youth slang, or explain astrology.

Every response contains only:

1. a heading of 3–8 words;
2. one or two natural paragraphs;
3. no more than 150 words including the heading.

The text begins with an alive personal observation and unfolds as a miniature
story. It can describe a recognisable situation, choice, pause, contact, or
possibility, but never invents an event that supposedly happened or will happen.
It avoids filler, fatalism, jargon, mysticism, clinical language, motivational
coaching, generic reassurance, lists, questions to the reader, separate advice,
and technical astrology terms.

## Technical response and validation

The model response is strict structured JSON. Its public semantic shape is:

```ts
type PersonalForecastStory = {
  title: string;
  paragraphs: string[]; // one or two items
};
```

The server validates the schema, 3–8 word title, 1–2 paragraphs, 150-word
limit, language, application voice, prohibited technical astrology, promises,
and unsupported claims. Invalid output is retried once with validation errors;
a persistent failure results in an honest unavailable/retry state, never an
invented fallback forecast.

Prompt version, voice version, model identity, natal-chart fingerprint, period,
timezone, and language belong to the cache identity. Changing any of them
creates a new story; legacy cache rows remain untouched.

## Screen and navigation

- The Diary (`Dashboard`) is the only personal-forecast surface.
- The left diary drawer chooses Today, Week, or Month. No top period tabs,
  selector pills, or separate primary navigation sections are allowed.
- The screen displays the period date/range, then the story.
- Text is the default presentation. No card, visual frame, image behind text,
  or captioned newspaper clipping is part of the forecast.
- One curated image at most may support a story. A small sticker may appear
  rarely after a complete story as an editorial pause; the app chooses it from
  curated tags and it never determines, explains, or interrupts the text.
- No questions, feedback collection, generic news, celebrity references,
  compatibility sales block, or cross-product banner belongs in this contract.
  Any later continuation link requires a separate product decision.

## Boundaries

- Zodiac is a separate sign-based content product.
- Natal chart calculation remains deterministic and separate from generated
  forecast prose.
- Compatibility and natal readings remain separate destinations.
- The forecast must not become a social feed, messenger, or chat interface.
- Do not remove historical database rows or migrations while simplifying this
  runtime contract.

## Acceptance checks for a future implementation

- Exactly one readable AI story appears for the chosen period.
- All three periods use the same story contract and their own exact ranges.
- The model receives sufficient saved personal context without exposing it.
- No transit/evidence calculation or technical astrology is visible in the
  story.
- Loading and error states are honest and keep navigation usable.
- Targeted generation/contract tests and `npx tsc --noEmit` pass for changes
  that alter this runtime.
