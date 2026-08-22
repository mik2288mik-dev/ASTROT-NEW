# Personal AI forecast guide

## Product contract

`Dashboard` shows one personal reading for the selected `day`, `week`, or
`month`. The current UI, navigation, Free/Premium composition, and visual
selection stay outside generation.

The visible reading has exactly three parts:

1. `headline` — a 2–5-word sharp opening;
2. `forecast` — one cohesive personal forecast paragraph;
3. `closing` — a separate 3–12-word final line.

There are no visible technical labels, categories, advice cards, `takeaway`,
`do`, or `dont` fields.

## Runtime boundary

The only active path is:

```text
raw birth profile + selected period + own anti-repeat history
→ hidden astrologer brief
→ Luna writer
→ strict server validation and anti-repeat
→ PersonalForecastPackage
→ current UI
```

The brief receives raw birth fields and period dates. It returns a short hidden
period interpretation. The writer receives only the reader name/language,
period, accepted brief, and up to 15 previous forecasts from the same user. It
does not receive the raw birth profile.

The personal forecast runtime receives no calculated natal chart, Swiss
Ephemeris output, chart ID/data, planet positions, houses, angles, aspects, or
transits. Cross-user copy is used only by the local server similarity validator
and is never sent to Luna.

## Voice

Write in simple, lively Russian: direct, upbeat, bold, occasionally sharp or
funny, never rude. The forecast is short and concrete, without visible
astrology, esotericism, psychology, coaching, office prose, literary ornament,
invented biography, or guaranteed events. A positive forecast may remain fully
positive.

`lib/personalForecastExamples.ts` is the only approved runtime corpus. It holds
exactly 10 complete examples: 4 Today, 3 Week, and 3 Month. Only three examples
for the selected period enter a request. They teach voice and form; the hidden
brief supplies the new personal content.

## Safety and changes

- The Responses API uses strict Structured Outputs and `store:false`.
- Provider budget retry is limited to one retry for max-token incomplete
  responses; writer validation is limited to two drafts.
- Prompt, voice, contract, cache, and local-storage versions must invalidate old
  six-field and fragment-based packages.
- Do not change Zodiac, natal readings, compatibility, questions, payments,
  authentication, UI, or visual composition while editing this product.
