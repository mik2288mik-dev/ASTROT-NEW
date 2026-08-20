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
| Today | one visible shared 2–5-word opening hook followed by 4–6 sequential untitled text fragments |
| Week | one visible shared 2–5-word opening hook and exactly one cohesive untitled story fragment |
| Month | one visible shared 2–5-word opening hook and exactly one cohesive untitled story fragment |

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
- up to 15 recent forecast fragments for the same user and saved chart across
  `day`, `week`, and `month`, used only as anti-repeat context.

The personal Responses request uses `store: false`. A rejected draft remains
inside the server repeat validator; a repair attempt receives only generic
validation errors and never the rejected text.

The prompt must not inject a preselected generic psychological subject. The old
`profileNarrativeDirection`, editorial theme rotation, behavioural-pattern
catalogue, and similar topic cues are not part of this product.

Recent copy is negative context. It may not be quoted, described, treated as a
biographical fact, or returned as fallback content for the new period.

## Forecast-specific voice

The global app voice remains calm and consistent. Personal forecasts add the
separately versioned v3 layer: an intelligent acquaintance who understands this
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
`космос`, `аура`, `судьба`, `знак свыше`, their direct equivalents, and
technical astrology. The writer never says “твоя карта показывает” or explains
why the text is personal.

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

`closing` makes the requested ending explicit without a fragile verb whitelist.
The server validates it, appends `closing.text` to the final fragment without a
heading, transfers its `advice_key` into the persisted diversity fingerprint,
and never exposes the wrapper itself. The final body may not repeat or closely
paraphrase the closing.

`presentation_style` is also hidden from the reader and is copied to the package
as optional `ForecastSection.presentationStyle`. The first and final Today
fragments are always `prose`; Today requires at least two `prose` fragments
overall, at most one `pull_quote` of 6–18 words, and at most one `paper_note` of
4–12 words. These rules remain part of schema validation. The current
`TodayEditorialFeed` path does not branch on the field and renders every
fragment as continuous prose; it does not mount separate quote or paper-note
surfaces. The Week/Month story schema omits the field. A current-contract
package may omit it and renders as prose; normal prompt/voice-version cache
invalidation still rejects genuinely stale packages.

The existing `PersonalForecastPackage` remains the external contract and is
exchanged end to end by `/api/content/forecast/personal`, its cache, and the
client service. Legacy `aiPersonalHoroscope*` state is inactive. Today maps
fragment 1 to `overview` and fragments 2–6 to `sections`; Week and Month map
their only fragment to `overview` and keep `sections` empty.

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

## Active Today visual

`TodayEditorialFeed` renders one `calendar-editorial` composition. Its hero
contains `TodayLineField` and `TodayCalendarClock`; the reading continues below
as ordinary, untitled prose fragments.

`lib/todayVisualPresets.ts` contains 15 clock presets and 12 line presets. Both
selectors derive their choice deterministically from `userId + periodKey`, so
the same person and date reopen with the same composition without database or
client visual history. Luna never selects a clock, line, asset, coordinate,
colour, or layout.

The former personal visual system remains in the repository as an inactive
library: `lib/personalForecastVisuals/diaryVisualEngine.ts`, its five layouts,
309 assets under `/assets/personal-editorial/`, and 19 paper templates under
`/assets/personal-paper-templates/`. The active Today path does not mount that
planner, `EditorialForecastVisual`, or `EditorialPaperNote`.

Zodiac is the only product that can use retained legacy newspaper imagery. Its
separate `/assets/zodiac-legacy-special/` source contains 48 explicitly
allowlisted files: 24 psychedelic images and 24 approved funny-animal images.
`lib/personalForecastVisuals/editorialSelectors.ts` reads only the personal and
paper manifests. `lib/zodiacLegacyVisuals/index.ts` reads only
`zodiac-legacy-special.manifest.json`, backed by a typed allowlist, and cannot
see retired newspaper assets.

## Cache and history

Cache identity includes the authenticated user, owned chart ID, the full saved
natal fingerprint, and a hash of sanitized `name`, `birthDate`, `birthTime`,
`birthPlace`, and `birthTimezone` fields. It also includes period,
timezone-aware period key, language, model, and calculation, contract, prompt,
global voice, and forecast-voice versions. A relevant change creates new
content identity; the semantic contract is `personal-forecast-feed-v13`. Old
rows and migrations remain untouched.

On generation, the cache layer reads up to 15 recent fragments for the same
user and chart across `day`, `week`, and `month`. A safe fallback may inspect
older same-period cache entries if the cross-period query is unavailable.
History is negative prompt context only. Older content is never accepted as the
new cache entry or compatible stale output; stale delivery requires the current
prompt identity.

## Delivery and prewarm

Delivery remains local-first. The client paints a valid local package, checks
the server cache with `GET`, and starts generation with `POST`. After a `202`,
it waits for `retryAfterMs` and polls with the same `POST` and
`regenerate: false` until ready or the retry limit is reached.

Startup never waits for generation. Free sequentially prewarms only the current
`day`; Premium sequentially prewarms the current `day`, `week`, and `month` in
the background. Server-side access slicing remains authoritative.

## Screen and navigation boundaries

- The Diary (`Dashboard`) remains the personal-forecast surface.
- One controlled Today/Week/Month tablist sits directly below the Diary header;
  periods do not become primary navigation destinations.
- One shared `LumiaBottomTabBar` is mounted on the main screens and the old
  drawer is not mounted. Its left, centre, and right zones own quick forecast
  links, the product hub, and Settings/Store/Premium respectively; the top
  profile action opens personal data and saved charts.
- The active Today hero contains only the deterministic clock and line field.
  Body prose remains unframed, outside imagery, and free of fragment titles.
- The legacy five-layout image and paper-note planner remains library-only and
  is not a category, explanation, prompt input, or active renderer.
- Zodiac, natal readings, compatibility, and “Вопрос астрологу” remain separate
  products or flows.

## Acceptance checks

- Today materialises 4–6 ordered fragments as `overview + sections`.
- Week and Month materialise one cohesive `overview` each.
- The visible common opening hook contains 2–5 words; fragment titles stay
  hidden, and the validated `closing` is appended to the final fragment without
  a visible rubric.
- No visible categories or hidden service keys leak into copy.
- Presentation metadata obeys prose/quote/note counts and length rules, but the
  active Today renderer displays all fragments as continuous prose.
- All 15 clock presets and 12 line presets participate in deterministic active
  Today selection. The five-layout personal planner, 309-image library, and 19
  paper templates remain inactive; Zodiac keeps its separate typed selector.
- Saved natal context personalises prose without visible astrology or invented
  period calculations.
- Up to 15 cross-period fragments for the same user and chart, plus the
  server-only rejected draft, influence only anti-repeat behavior; the ten
  period-local examples cannot be copied.
- Strict schema, semantic validators, maximum two attempts, local-first cache,
  and Premium access all remain active.
- A `202` is polled with `POST` and `regenerate: false`; startup prewarms only
  `day` for Free and all three current periods for Premium.
