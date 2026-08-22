# Personal Forecast AI Contract

> The filename is retained for existing links. This is the current contract for
> personal Today / Week / Month forecasts.

## Visible output

Luna returns strict JSON with exactly three user-facing strings:

```ts
type PersonalForecastWriterOutput = {
  headline: string;
  forecast: string;
  closing: string;
};
```

- `headline`: 2–5 words; a short, direct, bold hook.
- `forecast`: one cohesive forecast paragraph in ordinary human language.
- `closing`: 3–12 words; a separate strong, warm, sharp, or funny final line.

All three periods use this shape. The server maps `forecast` to `overview` and
`closing` to one untitled section so the current UI keeps the three visible
parts separate. There are no `takeaway`, `do`, `dont`, fragment keys, semantic
keys, evidence IDs, or visible technical labels in provider output.

Visible total length:

| Period | Words |
|---|---:|
| Today | 35–90 |
| Week | 50–115 |
| Month | 50–130 |

## Two-stage generation

The server first requests a hidden astrologer brief from raw profile fields and
the exact selected period. The brief is an AI interpretation; it is not a Swiss
Ephemeris calculation and never becomes visible copy.

The writer receives only:

```json
{
  "reader": { "name": "string", "language": "ru | en" },
  "selected_period": {
    "period": "day | week | month",
    "period_key": "string",
    "current_date": "YYYY-MM-DD",
    "period_start": "YYYY-MM-DD",
    "period_end": "YYYY-MM-DD",
    "timezone": "string"
  },
  "astrologer_brief": {
    "tone": "favorable | mixed | demanding",
    "core_forecast": "string",
    "secondary_forecast": "string | null",
    "distinctive_detail": "string",
    "opportunity": "string | null",
    "friction": "string | null",
    "likely_result": "string"
  },
  "anti_repeat_context": { "recent_forecasts": [] }
}
```

The writer never receives birth date/time/place/timezone/gender or the complete
profile. The accepted brief is its only source of content; few-shots teach only
voice and shape.

## Privacy and personalisation

The brief stage receives name, birth date, birth time or `null`, time mode,
uncertainty, place or `null`, timezone or `null`, gender, language, and selected
period dates. Unknown time remains `null`; the runtime never substitutes 12:00.

This product receives no `NatalChartData`, chart data/ID, saved natal context,
Swiss output, planet positions, houses, angles, aspects, transits, Ascendant,
or MC. Natal chart calculation remains a separate product.

Up to 15 previous forecasts from the same user are sent as negative anti-repeat
context. Up to 64 recent same-period forecasts from other users are reduced to
server-side signatures only. Other users' text and birth data never enter the
prompt.

## Voice and examples

The one developer prompt asks for simple, lively, direct Russian with character:
bold and upbeat, sometimes sharp or funny, never rude. User-visible copy has no
astrological terms, esotericism, psychology, coaching, office prose, literary
ornament, invented biography, diagnoses, or guaranteed events. A good period
does not need an artificial warning.

`lib/personalForecastExamples.ts` is the only approved runtime corpus and is
locked by a full-output SHA-256 test. It contains 4 Today, 3 Week, and 3 Month
examples. Exactly three examples for the selected period are sent to Luna.

## Validation, versions, and delivery

- Strict JSON Schema, `additionalProperties:false`, and `store:false` are
  mandatory.
- A max-token incomplete response may retry once with the original input and a
  doubled provider budget.
- Writer validation checks shape, length, voice, unsafe claims, period mismatch,
  and similarity to approved, own-history, and cross-user copy.
- The server calculates all fingerprints and semantic signatures.
- Prompt, voice, calculation/input, contract, cache, and client local-storage
  versions reject prior six-field or fragment-based packages.
- Local-first rendering, current UI, visual selection, and Free/Premium access
  behaviour remain unchanged.
