# Personal AI forecast guide

## Product contract

`Dashboard` shows one personal reading for the selected `day`, `week`, or
`month`. The current UI, navigation, Free/Premium composition, and visual
selection stay outside generation.

The visible reading has exactly four parts:

1. `title` — a 1–5-word name for the day, week, or month;
2. `punchline` — one short, sharp sentence shown separately;
3. `forecast` — one cohesive personal forecast;
4. `closing` — a separate practical conclusion or piece of advice.

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

Write in the direct Russian of the approved reference corpus: a compact title,
a biting one-line entrance, a concrete forecast, and an imperative conclusion.
The forecast can be blunt or ironic, but it must still use only the accepted
private brief and must not invent astrology, biography, diagnoses, or guaranteed
events. A positive forecast may remain fully positive. Runtime reference inputs
contain no synthetic reader name or date window; the live input supplies the
actual grammatical gender only for Russian agreement.

`lib/personalForecastExamples.ts` is the only approved runtime corpus. It holds
the complete user-supplied reference set for Today, Week, and Month. Every
example for the selected period enters the static developer instructions. The
examples teach voice and form; the hidden brief supplies the new personal plot.

## Safety and changes

- The Responses API uses strict Structured Outputs and `store:false`.
- Provider budget retry is limited to one retry for max-token incomplete
  responses; writer validation is limited to two drafts.
- Prompt, voice, contract, cache, and local-storage versions must invalidate old
  three-part, six-field, and fragment-based packages.
- Do not change Zodiac, natal readings, compatibility, questions, payments,
  authentication, UI, or visual composition while editing this product.
