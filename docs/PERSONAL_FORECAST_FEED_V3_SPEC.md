# Personal Forecast AI Contract

> The filename is retained for existing links. This document defines the
> release contract for the personal forecast feed.

## Decision

Personal forecasts for **Today**, **Week**, and **Month** are fully authored by
OpenAI Luna. Personal-forecast writer input uses only the raw name and
available birth date, time, place, timezone, gender, period, and own recent
history. Luna performs its interpretive work internally and returns only
ordinary human language.

The selected date or range is a writing frame. The forecast runtime does not
calculate or invent period transits, exact event dates, or other period-specific
period calculation evidence.

## Visible product by period

| Period | Visible result |
|---|---|
| Today | one shared 2–5-word headline followed by 4–6 sequential untitled text fragments |
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
- bounded recent same-person, same-period forecast excerpts, used only as
  anti-repeat context.

A separate bounded corpus of recent same-period copy from other users is used
only by the server repeat validator. It is never included in Luna's prompt.
Rejected draft text also stays inside the server validator and is never
serialized into a repair request; the second attempt receives only generic
validation errors without excerpts.

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
`внутренний ребёнок`, `закрыть гештальт`, `внутренняя ясность`, `опора
внутри`, `твоя сила в спокойном присутствии`, abstract “пространство для себя”,
their direct equivalents, and technical astrology. The writer never says “твоя
карта показывает” or explains why the text is personal.

Every Today reading includes at least one recognisable possible human situation:
a conversation, message, request, decision, agreement, household detail, work
task, choice, or pause. It is phrased conditionally rather than claimed as an
event. Conflict, risk, irony, and comparison are optional; the model must not
force the same rhetorical structure into every day. A favourable reading may
stay completely positive instead of inventing a catch or warning.

The final fragment always closes with practical value: a suggestion, concrete
action, something to decline, a wish, or brief motivation. This ending has no
visible category label. The period-local references in
`lib/personalForecastExamples.ts` are style examples rather than templates;
Today has four and Week/Month have three each. Their tone metadata is never
sent, and their copy is included in validation as negative anti-copy context.

The key editorial test: with the app name removed, the text must feel written
for one person rather than every person with the same zodiac sign.

## Structured writer response

The Responses API uses strict JSON Schema. Its internal shape for Today is:

```ts
type WriterResponse = {
  headline: {
    text: string;
    evidence_ids: ['profile:personal'];
  };
  fragments: Array<{
    text: string;
    presentation_style: 'prose' | 'pull_quote' | 'paper_note';
    main_idea_key: string;
    life_plot_key: string;
    advice_key: string;       // advice inside this body, empty when absent
    comparison_key: string;   // empty when no comparison is present
    evidence_ids: ['profile:personal'];
  }>;
  closing: {
    text: string;
    kind: 'advice' | 'action' | 'avoidance' | 'wish' | 'motivation';
    advice_key: string;
    evidence_ids: ['profile:personal'];
  };
};
```

The hidden `*_key` fields are short post-hoc descriptions of what the model
actually wrote. They are service metadata for diversity checks, never a creative
brief, visible label, category, heading, or UI field.

`closing` makes the requested ending explicit without a fragile verb
whitelist. The server validates it, appends `closing.text` to the final fragment
without a heading, transfers its `advice_key` into the persisted diversity
fingerprint, and never exposes the wrapper itself. The final body may not repeat
or closely paraphrase the closing.

`presentation_style` is also hidden from the reader, but unlike the diversity
keys it is copied to the package as optional `ForecastSection.presentationStyle`
for rendering. The first and final Today fragments are always `prose`; Today
requires at least two `prose` fragments overall, at most one
`pull_quote` of 6–18 words, and at most one `paper_note` of 4–12 words. The two
special forms must advance the same forecast and may not introduce a new fact
or become a generic motivational quote. The Week/Month story schema omits this
field entirely. A current-contract package may omit the optional package field
and renders it as prose; normal prompt/voice-version cache invalidation still
rejects genuinely stale packages.

The existing `PersonalForecastPackage` remains the external contract. Today
maps fragment 1 to `overview` and fragments 2–6 to `sections`; Week and Month
map their only fragment to `overview` and keep `sections` empty.

Visible copy remains at most 150 words including the shared headline. Today
contains 90–150 words total; Week 80–150; Month 100–150.

## Validation and attempts

The writer has at most two attempts. A rejected first response remains only in
the server validator for the second attempt; Luna receives generic validation
errors, never the rejected copy. Persistent failure produces the existing
honest unavailable/retry state; the server never invents fallback prose.

Application validation rejects:

- the wrong fragment count or malformed hidden keys/evidence references;
- missing or unknown presentation metadata, fewer than two prose fragments,
  a non-prose first fragment, repeated special styles, or invalid
  pull-quote/paper-note length;
- visible astrology, mysticism, pseudopsychology, or coaching language;
- formal Russian `вы`, formal imperatives, or non-Russian fragment output for a
  Russian request;
- guaranteed events, invented biography, medical claims, and financial claims;
- time-of-day, weekday, hourly, or calendar-segment structure;
- repeated openings, near-duplicate wording, repeated main ideas, life plots,
  advice, characteristic comparisons, or reference-example copy;
- a headline outside 2–5 words or a missing/malformed explicit closing;
- a closing with a visible rubric, question, excessive length, or duplicated
  final-body wording.

Anti-repeat checks include the shared headline and use deterministic text
normalization, opening comparison, word-shingle containment, stop-word-filtered
advice/comparison overlap, and compact exact plus token signatures derived from
the hidden keys. No embeddings or vector database are required for release.

## Today visual engine

Today has one branded editorial system, not a model-designed collage. The
original Diary-eligible library remains intact with 895 approved assets:

- 83 cat/capybara mascots and 24 object stickers from `public/stickers/`;
- 788 main editorial assets: 180 photo, 140 associative, 60 surreal, 20
  graphic, and 388 psychedelic-humor.

`public/stickers/editorial-v2/` adds 221 app-ready transparent WebP files under
one manifest. Of 195 non-brand visual entries, 142 text-free visuals enter the
generic strong-visual selector; 53 embedded-copy entries remain packaged but
await per-asset locale/copy metadata. Another 19 entries are empty paper
templates with safe runtime-text metadata. Seven camera, instant-camera,
laptop, and sneaker files remain packaged but are marked non-selectable pending
manual review. The generic strong-visual selector therefore sees 1,037 assets;
the paper templates form a separate deterministic pool.

Dedicated synastry (200) and zodiac (12) collections stay isolated. Legacy
`/foni` and astro background images are not eligible because forecast text is
never placed on imagery.

The application chooses one of five layouts: `editorial_right`,
`editorial_left`, `quote_first`, `visual_overlap`, or `editorial_clean`.
`visual_overlap` may overlap paper or illustration edges with editorial
whitespace, never the readable text. `editorial_clean` is deliberately
image-free; every other layout receives at most one strong visual. A paper-note
template is a text surface rather than a second decorative visual.

Selection is stateless and deterministic. A stable seed built from `userId +
periodKey + contractVersion` (plus the visual-engine version) fixes the same
plan when a day is reopened. A stable five-layout permutation guarantees that
adjacent days use different layouts. Weighted, disjoint asset families and a
calendar-indexed asset ring guarantee that the same asset does not occur on
adjacent days without a database or client history. Manifest rarity, visual
weight, orientation, aspect, and layout compatibility constrain selection.
Common mascot, object,
animal, photo/editorial, and graphic families dominate; associative and surreal
appear periodically; psychedelic-humor has a real but approximately 3% share
of illustrated days.

Luna never selects an asset, layout, coordinate, colour, or composition. A
paper note uses a deterministically selected empty template plus the real
runtime string positioned within its manifest safe area; text is never baked
into PNG or WebP.

## Cache and history

Cache identity includes model, prompt version, global voice version,
forecast-voice version, contract/calculation versions, user scope, a normalized
fingerprint of all raw profile fields, period, timezone, language, and access
tier. A prompt, forecast-voice, or raw birth-profile change creates new content
identity; the semantic contract is `personal-forecast-feed-v14-raw-profile`.

On generation, the cache layer reads a bounded number of previous same-period
keys with `allowExpired: true`. It may also extract one latest older-version
package through a narrow text-only reader so the first release day has some
anti-repeat protection. Older content is never accepted as the new cache entry
or as compatible stale output: stale delivery requires the current prompt
identity.

The cache layer also reads a small recent cross-user corpus for server-side
headline, wording, advice, situation, and comparison checks. Only generated
content documents are selected, never user or chart identifiers; they are
immediately reduced to text and repeat fingerprints. This corpus never enters
the provider request.

Local-first delivery and Premium access slicing remain unchanged.

## Screen and navigation boundaries

- The Diary (`Dashboard`) remains the personal-forecast surface.
- The drawer chooses Today, Week, or Month. Do not restore top tabs or make
  periods primary navigation destinations.
- Body prose remains unframed and is never placed on an image. The only text
  surface is an optional `paper_note`: live text on an empty paper treatment,
  never text baked into raster artwork.
- At most one curated image supports a Today reading. Some days are clean and
  image-free; an asset is never a category, explanation, or prompt input.
- Zodiac, natal readings, compatibility, and “Вопрос астрологу” remain separate
  products or flows.

## Acceptance checks

- Today materialises 4–6 ordered fragments as `overview + sections`.
- Week and Month materialise one cohesive `overview` each.
- No visible categories or hidden service keys leak into copy.
- Presentation metadata obeys prose/quote/note counts and length rules; paper
  text remains a runtime string.
- All five deterministic layouts, the 1,037 text-free generic strong-visual
  universe, and all 19 paper templates are reachable without adjacent-day
  layout or asset repeats. All 195 non-brand v2 visuals remain catalogued; 53
  embedded-copy entries await metadata and seven review-required files remain
  excluded.
- Raw profile fields personalise prose without visible astrology or invented
  period calculations.
- Same-person history is the only generated copy sent as negative prompt
  context. The recent cross-user corpus and rejected draft stay server-only and
  influence only anti-repeat validation.
- Strict schema, semantic validators, maximum two attempts, local-first cache,
  and Premium access all remain active.
