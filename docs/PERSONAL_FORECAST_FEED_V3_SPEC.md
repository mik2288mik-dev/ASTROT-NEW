# Personal Forecast AI Contract

> The filename is retained for existing links. This document defines the
> release contract for the personal forecast feed.

## Decision

Personal forecasts for **Today**, **Week**, and **Month** are fully authored by
OpenAI Luna. The Swiss Ephemeris natal chart remains deterministic, saved, and
private. It personalises the prose but is not shown as a technical explanation
and is not replaced by model-generated astrology.

The selected date or range is a writing frame. The forecast runtime does not
calculate or invent period transits, exact event dates, or other period-specific
Swiss evidence.

## Visible product by period

| Period | Visible result |
|---|---|
| Today | one shared 3–8-word headline followed by 4–6 sequential untitled text fragments |
| Week | one shared headline and exactly one cohesive personal story fragment |
| Month | one shared headline and exactly one cohesive personal story fragment |

Today is a continuous reading, not a dashboard of topic cards. The first/main
fragment is persisted in `overview`; the remaining fragments are persisted in
`sections` in natural reading order. Those sections have no visible titles or
Love/Work/Mood categories.

There are no polls, feedback controls, “hit/miss” reactions, questions, games,
chat, morning/day/evening sections, hourly structure, or calendar breakdown.

## Private generation input

The server builds the prompt from:

- selected period, exact date/range, language, and timezone;
- name, used in visible copy only when it sounds natural;
- available saved birth date, time, and place;
- compact deterministic positions, reliable houses/angles, reliable stored
  natal aspects, and birth-time quality from the saved natal chart;
- bounded recent same-period forecast excerpts and a rejected first draft when
  present, used only as anti-repeat context.

The prompt must not inject a preselected generic psychological subject. The old
`profileNarrativeDirection`, editorial theme rotation, behavioural-pattern
catalogue, and similar topic cues are not part of this product.

Recent copy is negative context. It may not be quoted, described, treated as a
biographical fact, or returned as fallback content for the new period.

## Forecast-specific voice

The global app voice remains calm and consistent. Personal forecasts add a
separately versioned layer: an intelligent acquaintance who understands this
reader, speaks directly, has character, and may occasionally use light irony or
one unexpected comparison.

This writer is not a stand-up comedian and does not joke in every fragment. It
does not role-play a friend, psychologist, therapist, coach, esoteric guide,
guru, or fortune-teller. It does not use rudeness, forced familiarity, or
artificial youth slang.

Forbidden forecast language includes `ресурс`, `проявленность`, `поток`,
`осознанность`, `прислушайся к себе`, `позволь себе`, `будь в моменте`,
`внутренний ребёнок`, `закрыть гештальт`, their direct equivalents, and
technical astrology. The writer never says “твоя карта показывает” or explains
why the text is personal.

The key editorial test: with the app name removed, the text must feel written
for one person rather than every person with the same zodiac sign.

## Structured writer response

The Responses API uses strict JSON Schema. Its internal shape is:

```ts
type WriterResponse = {
  headline: {
    text: string;
    evidence_ids: ['profile:personal'];
  };
  fragments: Array<{
    text: string;
    main_idea_key: string;
    life_plot_key: string;
    advice_key: string;       // empty when no advice is present
    comparison_key: string;   // empty when no comparison is present
    evidence_ids: ['profile:personal'];
  }>;
};
```

The four `*_key` fields are short post-hoc descriptions of what the model
actually wrote. They are service metadata for diversity checks, never a creative
brief, visible label, category, heading, or UI field.

The existing `PersonalForecastPackage` remains the external contract. Today
maps fragment 1 to `overview` and fragments 2–6 to `sections`; Week and Month
map their only fragment to `overview` and keep `sections` empty.

Visible copy remains at most 150 words including the shared headline. Today
contains 90–150 words total; Week 80–150; Month 100–150.

## Validation and attempts

The writer has at most two attempts. A rejected first response is added to the
second prompt as copy to avoid, not text to patch. Persistent failure produces
the existing honest unavailable/retry state; the server never invents fallback
prose.

Application validation rejects:

- the wrong fragment count or malformed hidden keys/evidence references;
- visible astrology, mysticism, pseudopsychology, or coaching language;
- formal Russian `вы`, formal imperatives, or non-Russian fragment output for a
  Russian request;
- guaranteed events, invented biography, medical claims, and financial claims;
- time-of-day, weekday, hourly, or calendar-segment structure;
- repeated openings, near-duplicate wording, repeated main ideas, life plots,
  advice, and characteristic comparisons.

Anti-repeat checks include the shared headline and use deterministic text
normalization, opening comparison, word-shingle containment, stop-word-filtered
advice/comparison overlap, and compact exact plus token signatures derived from
the hidden keys. No embeddings or vector database are required for release.

## Cache and history

Cache identity includes model, prompt version, global voice version,
forecast-voice version, contract/calculation versions, chart fingerprint,
period, timezone, and language. A prompt or forecast-voice change creates new
content identity; the semantic contract is `personal-forecast-feed-v13`. The
chart fingerprint covers every saved natal field sent to Luna, including
retrograde flags, Chiron, reliable MC, and the selected stored aspects. Old rows
and migrations remain untouched.

On generation, the cache layer reads a bounded number of previous same-period
keys with `allowExpired: true`. It may also extract one latest older-version
package through a narrow text-only reader so the first release day has some
anti-repeat protection. Older content is never accepted as the new cache entry
or as compatible stale output: stale delivery requires the current prompt
identity.

Local-first delivery and Premium access slicing remain unchanged.

## Screen and navigation boundaries

- The Diary (`Dashboard`) remains the personal-forecast surface.
- The drawer chooses Today, Week, or Month. Do not restore top tabs or make
  periods primary navigation destinations.
- Text remains the default. No image behind text and no additional card/frame.
- At most one curated image may support the reading. A rare sticker can be an
  editorial pause, but never a category, explanation, or prompt input.
- Zodiac, natal readings, compatibility, and “Вопрос астрологу” remain separate
  products or flows.

## Acceptance checks

- Today materialises 4–6 ordered fragments as `overview + sections`.
- Week and Month materialise one cohesive `overview` each.
- No visible categories or hidden service keys leak into copy.
- Saved natal context personalises prose without visible astrology or invented
  period calculations.
- Recent history and the rejected draft influence only anti-repeat behavior.
- Strict schema, semantic validators, maximum two attempts, local-first cache,
  and Premium access all remain active.
