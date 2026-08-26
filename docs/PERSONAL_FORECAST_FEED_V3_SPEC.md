# Personal Forecast AI Contract

> The filename is retained for existing links. This is the current contract for
> personal Today / Week / Month forecasts.

## Visible output

Luna returns strict JSON with exactly four user-facing strings:

```ts
type PersonalForecastWriterOutput = {
  title: string;
  punchline: string;
  forecast: string;
  closing: string;
};
```

- `title`: 1–5 words; the name of the selected day, week, or month.
- `punchline`: one short, biting sentence separate from the forecast body.
- `forecast`: one cohesive forecast in ordinary human language.
- `closing`: a short, concrete conclusion or piece of advice.

All three periods use this shape. For Today, the server maps the title,
punchline, and first forecast paragraph to `overview`, keeps the remaining
forecast paragraphs in ordered untitled sections, and puts `closing` in the
final action section. Week and Month keep the whole forecast body in `overview`
and the closing in one final action section. The UI can therefore place the
punchline by the Today clock while keeping the title, body, and advice distinct.
There are no `takeaway`, `do`, `dont`, semantic keys, evidence IDs, or visible
technical labels in provider output.

Visible total length:

| Period | Words |
|---|---:|
| Today | 65–115 |
| Week | 85–130 |
| Month | 100–150 |

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

The developer prompt treats the complete user-supplied corpus as the only voice
reference: compact title, biting punchline, direct forecast, imperative advice.
The hidden brief remains the only source of the new personal plot. User-visible
copy has no astrology, invented biography, diagnoses, or guaranteed events.

`lib/personalForecastExamples.ts` is the only approved runtime corpus: 21 Today,
15 Week, and 20 Month examples. The old ten-example corpus is removed. Every
reference for the selected period is sent as a voice-and-structure-only
input/output pair in the static developer instructions. Reference inputs contain
no synthetic name, date, range, timezone, or copied personal brief. The live
writer input supplies the real grammatical gender separately for agreement.

## Validation, versions, and delivery

- Strict JSON Schema, `additionalProperties:false`, and `store:false` are
  mandatory.
- A max-token incomplete response may retry once with the original input and a
  doubled provider budget.
- Writer validation checks shape, length, voice, unsafe claims, period mismatch,
  and similarity to approved, own-history, and cross-user copy.
- The server calculates all fingerprints and semantic signatures.
- Prompt, voice, calculation/input, contract, cache, and client local-storage
  versions reject prior three-part, six-field, or fragment-based packages.
- Local-first rendering, current UI, visual selection, and Free/Premium access
  behaviour remain unchanged.
